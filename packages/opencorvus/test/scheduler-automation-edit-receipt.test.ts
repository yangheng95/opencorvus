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

test("public scheduled edits recover the exact accepted revision across scopes, later edits and reopen", async () => {
  await using first = await memoryProject("automation-edit-first")
  await using second = await memoryProject("automation-edit-second")
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
  const recurrence = "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY;COUNT=1"
  const editedRule = "DTSTART:20990102T000000Z\nRRULE:FREQ=DAILY;COUNT=1"
  try {
    for (const target of [
      { scope: "global" },
      { scope: "project", projectIds: [firstProjectID, secondProjectID] },
      { scope: "session", sessionId: session.id },
    ] satisfies AutomationTarget[]) {
      const opened = await request<{ id: string; revisionId: string }>(endpoint, "POST", {
        target, recurrence, name: `Original ${target.scope} schedule`, prompt: "Original prompt.",
      })
      expect(opened.status).toBe(201)
      const { id, revisionId: openedRevisionID } = opened.body
      expect(id).toStartWith("atm_")
      expect(openedRevisionID).toBe(id)
      const route = `${endpoint}/${id}`
      const input = {
        requestID: `edit-${target.scope}`, expectedRevisionId: openedRevisionID,
        name: "Accepted scheduled edit", recurrence: `\n${editedRule}\n`, prompt: "New schedule prompt.",
      }
      const [accepted, concurrent] = await Promise.all([
        request<AutomationView>(route, "PATCH", input),
        request<AutomationView>(route, "PATCH", input),
      ])
      expect(accepted).toMatchObject({
        status: 200, body: { id, name: input.name, prompt: input.prompt, target, recurrence: editedRule },
      })
      expect(concurrent).toEqual(accepted)
      const frontier = Database.use((db) => db.select().from(AutomationFireFrontierTable)
        .where(eq(AutomationFireFrontierTable.definition_id, id)).all())
      expect(frontier).toEqual([expect.objectContaining({ automation_revision_id: accepted.body.revisionId })])
      expect(await request(route, "PATCH", { ...input, prompt: "Changed reuse." })).toMatchObject({
        status: 409, body: { name: "AutomationUpdateConflictError", data: { automationID: id } },
      })
      expect(await request(route, "PATCH", { ...input, expectedRevisionId: accepted.body.revisionId })).toMatchObject({
        status: 409, body: { name: "AutomationUpdateConflictError", data: { automationID: id } },
      })
      expect(await request(route, "PATCH", { ...input, requestID: "another-explicit-edit" })).toMatchObject({
        status: 409, body: { name: "AutomationRevisionConflictError", data: {
          automationID: id, expectedRevisionId: openedRevisionID, currentRevisionId: accepted.body.revisionId,
        } },
      })
      const latest = await request<AutomationView>(route, "PATCH", {
        requestID: "later-edit", expectedRevisionId: accepted.body.revisionId, name: "Later edit", status: "paused",
      })
      expect(latest).toMatchObject({ status: 200, body: { id, name: "Later edit", target, status: "paused" } })
      await Instance.disposeAll()
      await Database.awaitEffectIdle(20_000)
      Database.close()
      expect(await request(route, "PATCH", { ...input, recurrence: editedRule })).toEqual(accepted)
      expect((await request<AutomationView[]>(endpoint)).body.find((row) => row.id === id)).toEqual(latest.body)
      expect(await request(`${route}?expectedRevisionId=${latest.body.revisionId}`, "DELETE")).toEqual({
        status: 200, body: { id, name: latest.body.name },
      })
      expect(await request(route, "PATCH", input)).toMatchObject({
        status: 410, body: { name: "AutomationUpdateUnavailableError", data: { automationID: id } },
      })
    }
  } finally {
    await server.stop(true)
  }
}, 60_000)
