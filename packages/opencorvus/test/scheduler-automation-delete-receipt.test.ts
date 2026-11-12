import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { Instance } from "../src/project/instance"
import { type AutomationTarget, type AutomationView } from "../src/scheduler/automation-service"
import { AutomationDefinitionTombstoneTable, AutomationFireFrontierTable } from "../src/scheduler/automation.sql"
import { serverErrorResponse } from "../src/server/error-handler"
import { GlobalRoutes } from "../src/server/routes/global"
import { Session } from "../src/session"
import { Database, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("public scheduled deletion replays the exact accepted receipt across scopes and reopen", async () => {
  await using first = await memoryProject("automation-delete-first")
  await using second = await memoryProject("automation-delete-second")
  const firstProjectID = await Instance.provideProjectIdentity({ directory: first.path, fn: () => Instance.project.id })
  const secondProjectID = await Instance.provideProjectIdentity({ directory: second.path, fn: () => Instance.project.id })
  const session = await Instance.provideProjectIdentity({ directory: second.path, fn: () => Session.create({ kind: "root" }) })
  const app = new Hono().onError(serverErrorResponse).route("/global", GlobalRoutes())
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  const endpoint = "/global/automations"
  async function request<T>(method: string, route: string, input?: object): Promise<{ status: number; body: T }> {
    const response = await fetch(new URL(route, server.url), {
      method,
      headers: input ? { "content-type": "application/json" } : undefined,
      body: input ? JSON.stringify(input) : undefined,
    })
    return { status: response.status, body: await response.json() as T }
  }

  const recurrence = "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY;COUNT=1"
  async function create(name: string, target: AutomationTarget): Promise<{ id: string; revisionId: string }> {
    const result = await request<{ id: string; revisionId: string }>("POST", endpoint, {
      target, recurrence, name, prompt: "Scheduled delivery remains tied to its own project.",
    })
    expect(result.status).toBe(201)
    expect(result.body.id).toStartWith("atm_")
    return result.body
  }

  try {
    const retained = await create("Independent project schedule", { scope: "project", projectIds: [secondProjectID] })
    const initialList = await request<AutomationView[]>("GET", endpoint)
    expect(initialList.status).toBe(200)
    expect(initialList.body.map((item) => item.id)).toEqual([retained.id])
    for (const target of [
      { scope: "global" },
      { scope: "project", projectIds: [firstProjectID, secondProjectID] },
      { scope: "session", sessionId: session.id },
    ] satisfies AutomationTarget[]) {
      const original = await create(`Original ${target.scope} schedule`, target)
      const route = `${endpoint}/${original.id}`
      const name = `Accepted ${target.scope} deletion`
      const edited = await request<AutomationView>("PATCH", route, { expectedRevisionId: original.revisionId, name })
      expect(edited.status).toBe(200)
      expect(edited.body.target).toEqual(target)
      const deletion = (expectedRevisionId: string, requestID: string) => request(
        "DELETE", `${route}?${new URLSearchParams({ expectedRevisionId, requestID })}`,
      )
      const expected = { status: 200, body: { id: original.id, name } }
      const requestID = `delete-${target.scope}`
      expect(await Promise.all([
        deletion(edited.body.revisionId, requestID), deletion(edited.body.revisionId, requestID),
      ])).toEqual([expected, expected])
      expect(await deletion(original.revisionId, requestID)).toMatchObject({
        status: 409, body: { name: "AutomationDeletionConflictError", data: { automationID: original.id } },
      })
      expect(await deletion(edited.body.revisionId, `other-${requestID}`)).toEqual({
        status: 404, body: { name: "NotFoundError", data: { message: `Automation not found: ${original.id}` } },
      })
      await Instance.disposeAll()
      await Database.awaitEffectIdle(20_000)
      Database.close()
      expect(await deletion(edited.body.revisionId, requestID)).toEqual(expected)
      expect(await request("GET", endpoint)).toEqual(initialList)
      const facts = Database.use((db) => ({
        tombstones: db.select({ revision: AutomationDefinitionTombstoneTable.revision })
          .from(AutomationDefinitionTombstoneTable).where(eq(AutomationDefinitionTombstoneTable.definition_id, original.id)).all(),
        frontier: db.select({ definitionID: AutomationFireFrontierTable.definition_id, revisionID: AutomationFireFrontierTable.automation_revision_id })
          .from(AutomationFireFrontierTable).all(),
      }))
      expect(facts).toEqual({
        tombstones: [{ revision: 3 }], frontier: [{ definitionID: retained.id, revisionID: retained.revisionId }],
      })
    }
  } finally {
    await server.stop(true)
  }
}, 60_000)
