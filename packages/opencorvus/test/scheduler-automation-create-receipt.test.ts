import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { Instance } from "../src/project/instance"
import { type AutomationTarget, type AutomationView } from "../src/scheduler/automation-service"
import { AutomationFireFrontierTable } from "../src/scheduler/automation.sql"
import { serverErrorResponse } from "../src/server/error-handler"
import { GlobalRoutes } from "../src/server/routes/global"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

type CreateReceipt = { id: string; revisionId: string; name: string; nextRun: number | null }

test("public scheduled creation replays one accepted definition across scopes, edits, reopen and deletion", async () => {
  await using first = await memoryProject("automation-create-first")
  await using second = await memoryProject("automation-create-second")
  const firstProjectID = await Instance.provideProjectIdentity({ directory: first.path, fn: () => Instance.project.id })
  const secondProjectID = await Instance.provideProjectIdentity({ directory: second.path, fn: () => Instance.project.id })
  const session = await Instance.provideProjectIdentity({ directory: second.path, fn: () => Session.create({ kind: "root" }) })
  const app = new Hono().onError(serverErrorResponse).route("/global", GlobalRoutes())
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  async function request<T>(route: string, method = "GET", body?: object): Promise<{ status: number; body: T }> {
    const response = await fetch(new URL(route, server.url), {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: response.status, body: await response.json() as T }
  }

  const endpoint = "/global/automations"
  try {
    for (const target of [
      { scope: "global" },
      { scope: "project", projectIds: [firstProjectID, secondProjectID] },
      { scope: "session", sessionId: session.id },
    ] satisfies AutomationTarget[]) {
      const input = {
        name: `Future ${target.scope} schedule`,
        target,
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY;COUNT=1",
        prompt: "Keep the original schedule prompt.",
        requestID: `original-${target.scope}`,
      }
      const [firstReceipt, concurrentReceipt] = await Promise.all([
        request<CreateReceipt>(endpoint, "POST", input),
        request<CreateReceipt>(endpoint, "POST", input),
      ])
      expect(firstReceipt).toMatchObject({ status: 201, body: { name: input.name, nextRun: 4070908800000 } })
      expect(concurrentReceipt).toEqual(firstReceipt)
      const original = firstReceipt.body
      const frontier = Database.use((db) => db.select().from(AutomationFireFrontierTable)
        .where(eq(AutomationFireFrontierTable.definition_id, original.id)).all())
      expect(frontier).toEqual([expect.objectContaining({
        automation_revision_id: original.revisionId, available_at: 4070908800000,
      })])

      const changedTarget: AutomationTarget = target.scope === "project"
        ? { scope: "project", projectIds: [secondProjectID, firstProjectID] }
        : { scope: "project", projectIds: [secondProjectID] }
      expect(await request(endpoint, "POST", { ...input, target: changedTarget })).toMatchObject({
        status: 409, body: { name: "AutomationCreationConflictError", data: { automationID: original.id } },
      })
      const intentional = await request<CreateReceipt>(endpoint, "POST", { ...input, requestID: `another-${target.scope}` })
      expect(intentional).toMatchObject({ status: 201, body: { name: input.name, nextRun: original.nextRun } })
      expect(new Set([intentional.body.id, original.id]).size).toBe(2)

      const route = `${endpoint}/${original.id}`
      const updated = await request<AutomationView>(route, "PATCH", {
        expectedRevisionId: original.revisionId, name: "Current renamed schedule", status: "paused",
      })
      expect(updated).toMatchObject({ status: 200, body: { id: original.id, name: "Current renamed schedule", target } })
      await Instance.disposeAll()
      await Database.awaitEffectIdle(20_000)
      Database.close()
      expect(await request(endpoint, "POST", input)).toEqual(firstReceipt)
      expect((await request<AutomationView[]>(endpoint)).body.find((row) => row.id === original.id)).toEqual(updated.body)
      expect(await request(`${route}?expectedRevisionId=${updated.body.revisionId}`, "DELETE")).toEqual({
        status: 200, body: { id: original.id, name: updated.body.name },
      })
      expect(await request(endpoint, "POST", input)).toMatchObject({
        status: 410, body: { name: "AutomationCreationUnavailableError", data: { automationID: original.id } },
      })
      expect((await request<AutomationView[]>(endpoint)).body.find((row) => row.id === intentional.body.id))
        .toMatchObject({ id: intentional.body.id, name: input.name, prompt: input.prompt, target, status: "active" })
    }
  } finally {
    await server.stop(true)
  }
}, 60_000)
