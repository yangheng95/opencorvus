import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { Instance } from "../src/project/instance"
import { AutomationService, type AutomationTarget } from "../src/scheduler/automation-service"
import { acquireControlLease } from "../src/engine/control-lease"
import { GlobalRoutes } from "../src/server/routes/global"
import { serverErrorResponse } from "../src/server/error-handler"
import { Session } from "../src/session"
import { Database } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("HTTP mutations require the observed revision across scopes, lease races, deletion and reopen", async () => {
  await using first = await memoryProject("revision-first")
  await using second = await memoryProject("revision-second")
  const projectID = await Instance.provide({ directory: second.path, fn: () => Instance.project.id })
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
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: response.status, body: (await response.json()) as any }
  }
  try {
    for (const target of [
      { scope: "global" },
      { scope: "project", projectIds: [projectID] },
      { scope: "session", sessionId: session.id },
    ] satisfies AutomationTarget[]) {
      const created = await request("/global/automations", "POST", {
        name: target.scope,
        target,
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "original prompt",
      })
      expect(created.status).toBe(201)
      const route = `/global/automations/${created.body.id}`
      const paused = await request(route, "PATCH", { expectedRevisionId: created.body.revisionId, status: "paused" })
      expect({
        target: paused.body.target,
        status: paused.body.status,
        revisionType: typeof paused.body.revisionId,
      }).toEqual({ target, status: "paused", revisionType: "string" })
      const missingUpdate = await request(route, "PATCH", { name: "missing revision" })
      const missingDelete = await request(route, "DELETE")
      expect([missingUpdate.status, missingDelete.status]).toEqual([400, 400])
      expect([missingUpdate.body.success, missingDelete.body.success]).toEqual([false, false])
      const competition = await Promise.all(
        ["left", "right"].map((prompt) =>
          request(route, "PATCH", { expectedRevisionId: paused.body.revisionId, prompt }),
        ),
      )
      expect(competition.map((row) => row.status).sort(), JSON.stringify(competition)).toEqual([200, 409])
      const winner = competition.find((row) => row.status === 200)!.body
      const loser = competition.find((row) => row.status === 409)!.body
      expect(loser).toMatchObject({
        name: "AutomationRevisionConflictError",
        data: {
          automationID: winner.id,
          expectedRevisionId: paused.body.revisionId,
          currentRevisionId: winner.revisionId,
        },
      })
      const staleForm = await request(route, "PATCH", {
        expectedRevisionId: paused.body.revisionId,
        name: "authored old form",
        target,
        prompt: paused.body.prompt,
        model: null,
        reasoningEffort: null,
      })
      expect(staleForm).toMatchObject({ status: 409, body: { name: "AutomationRevisionConflictError" } })
      const current = (await request("/global/automations")).body.find((row: any) => row.id === winner.id)
      expect(current).toEqual(winner)
      const saved = await request(route, "PATCH", { expectedRevisionId: current.revisionId, name: "fresh saved name" })
      expect(saved).toMatchObject({ status: 200, body: { name: "fresh saved name", prompt: winner.prompt, target } })
      await Instance.disposeAll()
      await Database.awaitEffectIdle(20_000)
      Database.close()
      const reopened = (await request("/global/automations")).body.find((row: any) => row.id === winner.id)
      expect(reopened).toEqual(saved.body)
      const staleDelete = await request(`${route}?expectedRevisionId=${current.revisionId}`, "DELETE")
      expect(staleDelete).toMatchObject({
        status: 409,
        body: { name: "AutomationRevisionConflictError", data: { currentRevisionId: reopened.revisionId } },
      })
      const deleted = await request(`${route}?expectedRevisionId=${reopened.revisionId}`, "DELETE")
      expect(deleted).toEqual({ status: 200, body: { id: winner.id, name: "fresh saved name" } })
      expect(
        await request(route, "PATCH", { expectedRevisionId: reopened.revisionId, name: "after delete" }),
      ).toMatchObject({ status: 404, body: { name: "NotFoundError" } })
    }
    await Instance.provide({
      directory: first.path,
      fn: async () => {
        const a = await AutomationService.create({
          name: "leased",
          target: { scope: "global" },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "leased prompt",
        })
        const observed = await AutomationService.update({
          id: a.id,
          expectedRevisionId: a.revisionId,
          status: "paused",
        })
        const peer = await AutomationService.create({
          name: "independent",
          target: { scope: "project", projectIds: [projectID] },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "peer prompt",
        })
        expect(
          acquireControlLease({
            target: "automation",
            targetID: a.id,
            ownerOccurrenceID: "revision-test-owner",
            now: Date.now(),
            leaseMilliseconds: 60_000,
          }).acquired,
        ).toBe(true)
        for (const method of ["PATCH", "DELETE"]) {
          for (const [revision, name] of [
            [a.revisionId, "AutomationRevisionConflictError"],
            [observed.revisionId, "AutomationRunningConflictError"],
          ]) {
            const response = await request(
              `/global/automations/${a.id}${method === "DELETE" ? `?expectedRevisionId=${revision}` : ""}`,
              method,
              method === "PATCH" ? { expectedRevisionId: revision, name: "change" } : undefined,
            )
            expect(response).toMatchObject({ status: 409, body: { name } })
          }
        }
        expect(
          await AutomationService.update({
            id: peer.id,
            expectedRevisionId: peer.revisionId,
            name: "independent saved",
          }),
        ).toMatchObject({ name: "independent saved", target: { scope: "project", projectIds: [projectID] } })
      },
    })
  } finally {
    await server.stop(true)
  }
}, 60_000)
