import { afterEach, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { Instance } from "../src/project/instance"
import { AutomationService, type AutomationTarget } from "../src/scheduler/automation-service"
import { AutomationProjectTargetTable, AutomationRunTable } from "../src/scheduler/automation.sql"
import { latestAutomationDefinitionInTransaction } from "../src/scheduler/automation-projection"
import { GlobalRoutes } from "../src/server/routes/global"
import { serverErrorResponse } from "../src/server/error-handler"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

const futureRecurrence = "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY"
const definition = (name: string, target: AutomationTarget) => ({
  name,
  target,
  recurrence: futureRecurrence,
  prompt: name,
})
const register = (directory: string) => Instance.provide({ directory, fn: () => Instance.project.id })
function latestMembership(id: string) {
  return Database.use((db) => {
    const revision = latestAutomationDefinitionInTransaction(db, id)!
    const projects = db
      .select()
      .from(AutomationProjectTargetTable)
      .where(eq(AutomationProjectTargetTable.automation_revision_id, revision.id))
      .orderBy(AutomationProjectTargetTable.position)
      .all()
      .map((row) => row.project_id)
    return { revisionID: revision.id, projects }
  })
}

test("real HTTP scope edits project the exact physical revision and survive database reopen", async () => {
  await using first = await memoryProject("target-revision-http-first")
  await using second = await memoryProject("target-revision-http-second")
  const firstID = await register(first.path)
  const secondID = await register(second.path)
  const session = await Instance.provide({ directory: first.path, fn: () => Session.create({ kind: "root" }) })
  const app = new Hono().onError(serverErrorResponse).route("/global", GlobalRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => Instance.provide({ directory: first.path, fn: () => app.fetch(request) }),
  })
  async function request(route: string, method = "GET", body?: unknown) {
    const response = await fetch(new URL(route, server.url), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const value = (await response.json()) as any
    expect(response.status).toBe(method === "POST" ? 201 : 200)
    return value
  }
  try {
    const created = await request("/global/automations", "POST", definition("scope revision", { scope: "global" }))
    const route = `/global/automations/${created.id}`
    await request(route, "PATCH", { status: "paused" })
    for (const target of [
      { scope: "project", projectIds: [secondID, firstID] },
      { scope: "project", projectIds: [secondID] },
      { scope: "session", sessionId: session.id },
      { scope: "project", projectIds: [firstID] },
      { scope: "global" },
      { scope: "project", projectIds: [firstID, secondID] },
    ] satisfies AutomationTarget[]) {
      const updated = await request(route, "PATCH", { target })
      const renamed = await request(route, "PATCH", { name: `scope ${target.scope}` })
      const list = await request("/global/automations")
      expect({
        updated: updated.target,
        renamed: renamed.target,
        listed: list.find((item: any) => item.id === created.id).target,
      }).toEqual({ updated: target, renamed: target, listed: target })
      expect(latestMembership(created.id).projects).toEqual(target.scope === "project" ? target.projectIds : [])
    }
    await Instance.disposeAll()
    await Database.awaitEffectIdle(20_000)
    Database.close()
    const reopened = await request("/global/automations")
    expect(reopened.find((item: any) => item.id === created.id)).toMatchObject({
      target: { scope: "project", projectIds: [firstID, secondID] },
      status: "paused",
    })
  } finally {
    await server.stop(true)
  }
}, 60_000)

test("retargeted manual and due runs bind exact revision members and retain historical run targets", async () => {
  await using first = await memoryProject("target-revision-run-first")
  await using second = await memoryProject("target-revision-run-second")
  const firstID = await register(first.path)
  const secondID = await register(second.path)
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      const observed: Array<{ directory: string; projectID: string; sessionID: string }> = []
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => {
        const session = await Session.get(input.sessionID!)
        observed.push({ directory: session.directory, projectID: session.projectID, sessionID: session.id })
        return {
          sessionID: session.id,
          messageID: input.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: Promise.resolve({ ok: true as const }),
        }
      })
      const created = await AutomationService.create(
        definition("manual exact members", { scope: "project", projectIds: [firstID] }),
      )
      await AutomationService.update({ id: created.id, status: "paused" })
      const originalRun = await AutomationService.runNow(created.id)
      expect(originalRun.map((row) => row.targetProjectId)).toEqual([firstID])
      await AutomationService.update({ id: created.id, target: { scope: "project", projectIds: [secondID, firstID] } })
      const revision = latestMembership(created.id)
      const runs = await AutomationService.runNow(created.id)
      expect(runs.map((row) => row.targetProjectId).sort()).toEqual([firstID, secondID].sort())
      expect(runs.map((row) => row.outcome)).toEqual(["succeeded", "succeeded"])
      for (const run of runs) {
        const row = Database.use(
          (db) => db.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, run.id)).get()!,
        )
        const actual = observed.find((item) => item.sessionID === run.session?.id)!
        expect({
          revisionID: row.automation_revision_id,
          projectID: actual.projectID,
          directory: actual.directory,
        }).toEqual({
          revisionID: revision.revisionID,
          projectID: run.targetProjectId,
          directory: run.targetProjectId === firstID ? first.path : second.path,
        })
      }
      expect(AutomationService.listRuns(created.id).find((row) => row.id === originalRun[0].id)?.targetProjectId).toBe(
        firstID,
      )
      const due = Math.floor(Date.now() / 1_000) * 1_000 + 60_000
      const stamp = new Date(due)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z")
      const scheduled = await AutomationService.create(definition("due retarget", { scope: "global" }))
      const originalScheduledRevision = latestMembership(scheduled.id)
      await AutomationService.update({
        id: scheduled.id,
        target: { scope: "project", projectIds: [secondID] },
        recurrence: `DTSTART:${stamp}\nRRULE:FREQ=DAILY;COUNT=1`,
      })
      const scheduledRevision = latestMembership(scheduled.id)
      using _clock = spyOn(Date, "now").mockImplementation(() => due + 5)
      await AutomationService.TestHooks.runDueWithSignal(new AbortController().signal)
      expect(
        AutomationService.listRuns(scheduled.id).map((row) => ({
          projectID: row.targetProjectId,
          outcome: row.outcome,
        })),
      ).toEqual([{ projectID: secondID, outcome: "succeeded" }])
      expect(
        AutomationService.listFireHistory(scheduled.id).map((row) => ({
          state: row.state,
          revisionID: row.automationRevisionId,
        })),
      ).toEqual([
        { state: "scheduled", revisionID: originalScheduledRevision.revisionID },
        { state: "succeeded", revisionID: scheduledRevision.revisionID },
      ])
    },
  })
}, 60_000)

test("retargeted retry reopens its exact Fire after database restart with independent parallel definitions", async () => {
  await using first = await memoryProject("target-revision-retry-first")
  await using second = await memoryProject("target-revision-retry-second")
  const firstID = await register(first.path)
  const secondID = await register(second.path)
  const prepared = await Instance.provide({
    directory: first.path,
    fn: async () => {
      const original = await AutomationService.create(
        definition("retry target", { scope: "project", projectIds: [firstID] }),
      )
      await AutomationService.update({
        id: original.id,
        status: "paused",
        target: { scope: "project", projectIds: [secondID] },
      })
      const peer = await AutomationService.create(definition("parallel target", { scope: "global" }))
      await AutomationService.update({
        id: peer.id,
        status: "paused",
        target: { scope: "project", projectIds: [firstID] },
      })
      using _failure = AutomationService.TestHooks.installBeforeRunReservation(() => {
        throw new Error("target revision retry boundary")
      })
      await expect(AutomationService.runNow(original.id)).rejects.toThrow("target revision retry boundary")
      const retry = AutomationService.listFireHistory(original.id).find((row) => row.origin === "manual_api")!
      expect(retry).toMatchObject({
        state: "retry_wait",
        attemptCount: 1,
        automationRevisionId: latestMembership(original.id).revisionID,
      })
      return { original, peer, retry, revisionID: latestMembership(original.id).revisionID }
    },
  })
  await Instance.disposeAll()
  await Database.awaitEffectIdle(20_000)
  Database.close()
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      const observed: Array<{ projectID: string; directory: string; sessionID: string }> = []
      using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => {
        const session = await Session.get(input.sessionID!)
        observed.push({ projectID: session.projectID, directory: session.directory, sessionID: session.id })
        return {
          sessionID: session.id,
          messageID: input.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: Promise.resolve({ ok: true as const }),
        }
      })
      using _clock = spyOn(Date, "now").mockImplementation(() => prepared.retry.retryAt!)
      const owner = `target-revision:${prepared.retry.fireId}`
      const claimed = AutomationService.TestHooks.claim(
        prepared.original.id,
        owner,
        prepared.retry.retryAt!,
        false,
        prepared.retry.fireId,
      )!
      expect({ revisionID: claimed.revision_id, pendingFire: claimed.pending_fire_id }).toEqual({
        revisionID: prepared.revisionID,
        pendingFire: prepared.retry.fireId,
      })
      await Promise.all([
        AutomationService.TestHooks.executeClaimedOccurrence({ job: claimed, owner, now: prepared.retry.retryAt! }),
        AutomationService.runNow(prepared.peer.id),
      ])
      const retried = AutomationService.listFireHistory(prepared.original.id).find(
        (row) => row.fireId === prepared.retry.fireId,
      )!
      expect({
        state: retried.state,
        attempts: retried.attemptCount,
        revisionID: retried.automationRevisionId,
        targets: retried.runs.map((row) => row.targetProjectId),
      }).toEqual({ state: "succeeded", attempts: 2, revisionID: prepared.revisionID, targets: [secondID] })
      expect(AutomationService.listRuns(prepared.peer.id).map((row) => row.targetProjectId)).toEqual([firstID])
      expect(
        observed
          .map(({ projectID, directory }) => ({ projectID, directory }))
          .sort((a, b) => a.projectID.localeCompare(b.projectID)),
      ).toEqual(
        [
          { projectID: firstID, directory: first.path },
          { projectID: secondID, directory: second.path },
        ].sort((a, b) => a.projectID.localeCompare(b.projectID)),
      )
    },
  })
}, 60_000)
