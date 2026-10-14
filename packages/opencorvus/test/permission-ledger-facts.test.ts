import { afterEach, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { Config } from "@/config/config"
import { PermissionAuthority } from "@/permission/authority"
import { readPermissionRequestFacts, validateCurrentPermissionLedger } from "@/permission/ledger-facts"
import { PermissionLedgerTable } from "@/permission/permission.sql"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Server } from "@/server/server"
import { publicUnknownErrorMessage } from "@/server/error-handler"
import { Database, eq, sql } from "@/storage/db"
import { standalonePendingPermission } from "@/protocol/session-mirror"
import { withTimeout } from "@/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => { await Instance.disposeAll(); await resetMemoryDatabase() })

function invocation(sessionID: string, call: string, url = "https://example.test/public-report") {
  return { projectID: Instance.project.id, sessionID, messageID: `msg_${call}`, toolCallID: `call_${call}`,
    providerKind: "builtin" as const, providerID: "builtin", toolName: "webfetch", args: { url } }
}
async function pending(sessionID: string, call: string, url?: string) {
  const asked = Promise.withResolvers<PermissionAuthority.Request>()
  const stop = Bus.subscribe(PermissionAuthority.Event.Asked, event => { asked.resolve(event.properties) })
  const execution = PermissionAuthority.authorizeAndExecute(invocation(sessionID, call, url), async () => ({ output: `${call} report` }))
  void execution.catch(() => undefined)
  try { return { request: await withTimeout(asked.promise, 10000, "actual Permission Asked"), execution } }
  finally { stop() }
}
function snapshot() {
  return Database.use(db => ({ rows: db.select().from(PermissionLedgerTable).orderBy(sql`rowid`).all(),
    publications: db.select().from(BusPublicationOutboxTable).where(eq(BusPublicationOutboxTable.event_type, "permission.replied")).orderBy(sql`rowid`).all() }))
}
function fault(requestID: string, eventType: "denied" | "grant_used") {
  const name = "grant_decision_exact_fault"
  Database.use(db => db.run(sql.raw(`CREATE TEMP TRIGGER ${name} BEFORE INSERT ON permission_ledger
    WHEN NEW.request_id='${requestID}' AND NEW.event_type='${eventType}'
    BEGIN SELECT RAISE(ABORT, 'GRANT_DECISION_EXACT_FAULT'); END`)))
  return { [Symbol.dispose]() { Database.use(db => db.run(sql.raw(`DROP TRIGGER ${name}`))) } }
}

test("saved-grant reuse has one original authority, automatic owned publication, result and exact pending projection", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    const session = await Session.create({ kind: "assistant", title: "Canonical saved permission" })
    const first = await pending(session.id, "first")
    const approved = await PermissionAuthority.reply({ requestID: first.request.id, decision: "allow_project", actorID: "operator", autoReply: false })
    expect(await first.execution).toEqual({ output: "first report" })
    const secondInput = invocation(session.id, "second")
    const result = await PermissionAuthority.authorizeAndExecute(secondInput, async () => ({ output: "second report" }))
    const reused = snapshot().rows.find(row => row.event_type === "grant_used")!
    const facts = Database.use(db => readPermissionRequestFacts(db, reused.request_id))!
    expect({ result, authority: facts.authority, slot: facts.slotLocator, decision: facts.decision, autoReply: facts.autoReply })
      .toEqual({ result: { output: "second report" }, authority: reused, slot: reused, decision: "allow_project", autoReply: true })
    expect({ source: reused.source_event_id, actor: reused.actor_id, startSource: facts.start?.source_event_id, stored: facts.result?.result })
      .toEqual({ source: approved.eventID, actor: "saved-grant-policy", startSource: reused.id, stored: { kind: "json", value: result } })
    expect(snapshot().publications.map(row => row.properties)).toEqual([
      { sessionID: session.id, requestID: first.request.id, decision: "allow_project", actorID: "operator", autoReply: false },
      { sessionID: session.id, requestID: reused.request_id, decision: "allow_project", actorID: "saved-grant-policy", autoReply: true },
    ])
    const current = await pending(session.id, "fresh-unapproved", "https://example.test/another-report")
    expect(await PermissionAuthority.list()).toEqual([current.request])
    expect((await PermissionAuthority.list()).map(request => standalonePendingPermission(request, Instance.project.id)))
      .toEqual([{ ...current.request, orderKey: expect.any(String) }])
    await PermissionAuthority.reply({ requestID: current.request.id, decision: "allow_once", actorID: "operator", autoReply: false })
    expect(await current.execution).toEqual({ output: "fresh-unapproved report" })
    Database.use(validateCurrentPermissionLedger)
  } })
})

test("a later operator reply returns the real slot winner while real SQL errors propagate with exact retained facts", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    const session = await Session.create({ kind: "assistant", title: "Strict decision CAS" })
    const first = await pending(session.id, "strict")
    const approved = await PermissionAuthority.reply({ requestID: first.request.id, decision: "allow_once", actorID: "winner", autoReply: false })
    expect(await first.execution).toEqual({ output: "strict report" })
    const before = snapshot()
    {
      using trigger = fault(first.request.id, "denied")
      let caught: unknown
      try { await PermissionAuthority.reply({ requestID: first.request.id, decision: "deny", actorID: "loser", autoReply: false }) }
      catch (error) { caught = error }
      expect(caught).toMatchObject({ code: "SQLITE_CONSTRAINT_TRIGGER", errno: 1811, message: "GRANT_DECISION_EXACT_FAULT" })
      const response = await Server.App().request(`/permission/${first.request.id}/reply`, {
        method: "POST", headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
        body: JSON.stringify({ decision: "deny", message: "Actual operator intent reaches the faulting canonical writer" }),
      })
      expect({ status: response.status, body: await response.json(), requestID: response.headers.get("x-opencorvus-request-id") })
        .toEqual({ status: 500, body: { name: "UnknownError", data: { message: publicUnknownErrorMessage() } }, requestID: expect.any(String) })
      expect(snapshot()).toEqual(before)
    }
    const replay = await PermissionAuthority.reply({ requestID: first.request.id, decision: "deny", actorID: "loser", autoReply: false })
    expect(replay).toEqual(approved)
    expect(snapshot()).toEqual(before)
    expect({ pending: await PermissionAuthority.list(), lateAskedProjection: standalonePendingPermission(first.request, Instance.project.id) })
      .toEqual({ pending: [], lateAskedProjection: undefined })
    Database.use(validateCurrentPermissionLedger)
  } })
})

test("grant revoke commits before another capture and the new request receives its own real decision", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    const session = await Session.create({ kind: "assistant", title: "Grant revoke ordering" })
    const first = await pending(session.id, "grant")
    const approved = await PermissionAuthority.reply({ requestID: first.request.id, decision: "allow_project", actorID: "operator", autoReply: false })
    await first.execution
    await PermissionAuthority.revoke(approved.eventID, "revoker")
    const next = await pending(session.id, "after-revoke")
    expect(await PermissionAuthority.list()).toEqual([next.request])
    const denied = await PermissionAuthority.reply({ requestID: next.request.id, decision: "deny", actorID: "operator", autoReply: false })
    await expect(next.execution).rejects.toBeInstanceOf(PermissionAuthority.RejectedError)
    expect(Database.use(db => readPermissionRequestFacts(db, next.request.id))).toMatchObject({
      request: next.request, decision: "deny", autoReply: false, authority: { id: denied.eventID, actor_id: "operator" },
    })
    expect(snapshot().rows.map(row => row.event_type)).toEqual([
      "requested", "grant_created", "execution_started", "execution_succeeded", "revoked", "requested", "denied",
    ])
  } })
})
