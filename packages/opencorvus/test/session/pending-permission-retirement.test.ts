import { afterEach, expect, test } from "bun:test"
import { Bus } from "../../src/bus"
import { BusPublicationOutboxTable } from "../../src/bus/bus.sql"
import { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"
import { PermissionAuthority } from "../../src/permission/authority"
import { PermissionLedgerTable } from "../../src/permission/permission.sql"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Message } from "../../src/session/message"
import { MessageStore } from "../../src/session/message-store"
import { MessageTable } from "../../src/session/session.sql"
import { createExecutionCancellationOrigin } from "../../src/session/prompt/cancellation"
import { Database, asc, eq, sql } from "../../src/storage/db"
import { withTimeout } from "../../src/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

async function pending(session?: Session.Info) {
  await Config.updateProjectPatch({ permission_mode: "ask" })
  session ??= await Session.create({ kind: "assistant", title: "Pending permission retirement" })
  const user = await Session.updateMessage({ id: Identifier.ascending("message"), sessionID: session.id,
    role: "user", author: "user", agent: "coding", time: { created: Date.now() },
    model: { providerID: "contract", modelID: "pending-permission" } })
  const assistant = Message.Assistant.parse(await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, parentID: user.id,
    role: "assistant", author: "coding", agent: "coding", time: { created: Date.now() },
    providerID: "contract", modelID: "pending-permission", path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0, tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }))
  const callID = Identifier.ascending("part")
  const part = await Session.updatePart({ id: Identifier.ascending("part"), sessionID: session.id,
    messageID: assistant.id, type: "tool", tool: "webfetch", callID,
    state: { status: "running", input: { url: "https://example.test/permission" }, time: { start: Date.now() } } })
  const asked = Promise.withResolvers<PermissionAuthority.Request>()
  const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
    if (properties.toolCallID === callID) asked.resolve(properties)
  })
  const execution = PermissionAuthority.authorizeAndExecute({
    projectID: Instance.project.id, sessionID: session.id, messageID: assistant.id, toolCallID: callID,
    toolPartID: part.id, providerKind: "builtin", providerID: "builtin", toolName: "webfetch", args: part.state.input,
  }, async () => ({ output: "Authorized execution result", title: "Contract", metadata: {} }))
    .then(result => ({ kind: "delivered" as const, result }), error => ({ kind: "rejected" as const, error }))
  try {
    return { session, assistant, part, execution, request: await withTimeout(asked.promise, 10000, "Permission request") }
  } finally { stop() }
}

type Pending = Awaited<ReturnType<typeof pending>>

async function conclusion(value: Pending, cancelled = true): Promise<Message.Assistant> {
  const origin = createExecutionCancellationOrigin({ actor: "user", source: "session.abort", surface: "contract",
    reason: "The user stopped this occurrence", targetSessionID: value.session.id })
  const error = new Message.AbortedError({ message: origin.reason, ...(cancelled ? { cancellation: origin } : {}) }).toObject()
  await Session.updatePart({ ...value.part, state: { status: "error", input: value.part.state.input,
    failure: { kind: error.name, name: error.name, message: origin.reason, classification: "llm-activity",
      originSite: "pending-permission-retirement.contract" },
    time: { start: value.part.state.time.start, end: Date.now() } } })
  return { ...value.assistant, error, finish: "error", time: { ...value.assistant.time, completed: Date.now() } }
}

function ledger(value: Pending) {
  return Database.use(db => db.select().from(PermissionLedgerTable)
    .where(eq(PermissionLedgerTable.request_id, value.request.id)).orderBy(asc(sql`rowid`)).all())
}

function publication(value: Pending) {
  return Database.use(db => db.select().from(BusPublicationOutboxTable)
    .where(sql`json_extract(${BusPublicationOutboxTable.properties}, '$.requestID') = ${value.request.id}`).all())
}

async function assertRetired(value: Pending, status = "cancelled") {
  const result = await withTimeout(value.execution, 10000, "Original permission waiter settlement")
  expect(result).toMatchObject({ kind: "rejected", error: expect.any(PermissionAuthority.RejectedError) })
  const events = ledger(value)
  expect(events.map(row => row.event_type)).toEqual(["requested", status])
  expect(events[1]).toMatchObject({ decision_slot: value.request.id, decision_scope: "invocation" })
  expect(publication(value)).toMatchObject([{ project_id: value.session.projectID, directory: value.session.directory,
    properties: { projectID: value.session.projectID, sessionID: value.session.id, requestID: value.request.id,
      ledgerEventID: events[1]!.id, status } }])
  const reply = await PermissionAuthority.reply({ requestID: value.request.id, decision: "allow_once", actorID: "late-operator" })
  expect(reply).toMatchObject({ decision: "deny", eventID: events[1]!.id })
  expect(ledger(value)).toEqual(events)
}

for (const writer of ["update", "silent", "import"] as const) {
  test(`${writer} settles the original pending permission and retains the next Message's actionable request`, async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const first = await pending()
      const next = await pending(first.session)
      const completed = await conclusion(first)
      if (writer === "update") await Session.updateMessage(completed)
      if (writer === "silent") await Session.saveMessage(completed)
      if (writer === "import") await Session.importSnapshot({ info: first.session,
        messages: [{ info: completed, parts: await MessageStore.parts(first.assistant.id) }] })
      await assertRetired(first)
      expect(await PermissionAuthority.list()).toEqual([next.request])
      await PermissionAuthority.reply({ requestID: next.request.id, decision: "allow_once", actorID: "operator" })
      expect(await next.execution).toMatchObject({ kind: "delivered", result: { output: "Authorized execution result" } })
      const committed = ledger(first)
      await Session.updateMessage(completed)
      expect(ledger(first)).toEqual(committed)
    } })
  })
}

test("a concluded message without a cancellation origin settles its pending request as stale", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const value = await pending()
    await Session.updateMessage(await conclusion(value, false))
    await assertRetired(value, "stale")
  } })
})

function cutRetirement(value: Pending): Disposable {
  Database.use(db => db.run(sql.raw(`CREATE TEMP TRIGGER pending_retirement_cut BEFORE INSERT ON permission_ledger
    WHEN NEW.request_id = '${value.request.id}' AND NEW.event_type = 'cancelled'
    BEGIN SELECT RAISE(ABORT, 'PENDING_RETIREMENT_COMMIT_CUT'); END`)))
  return { [Symbol.dispose]() { Database.use(db => db.run(sql.raw("DROP TRIGGER pending_retirement_cut"))) } }
}

test("retirement failure rolls back Message and termination publication, then the same writer retries successfully", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const value = await pending(), completed = await conclusion(value)
    const original = { ledger: ledger(value), publication: publication(value), message: await MessageStore.get({
      sessionID: value.session.id, messageID: value.assistant.id }) }
    {
      using cut = cutRetirement(value)
      await expect(Session.updateMessage(completed)).rejects.toThrow("PENDING_RETIREMENT_COMMIT_CUT")
      expect({ ledger: ledger(value), publication: publication(value), message: await MessageStore.get({
        sessionID: value.session.id, messageID: value.assistant.id }) }).toEqual(original)
    }
    await Session.updateMessage(completed)
    await assertRetired(value)
  } })
})

// Historical data reproduces the old writer's actual committed shape. New data
// always goes through Session.updateMessage; this local fixture isn't an E2E claim.
async function historical(value: Pending) {
  const { id, sessionID, ...data } = await conclusion(value)
  Database.immediateTransaction(db => db.update(MessageTable).set({ data }).where(eq(MessageTable.id, id)).run())
}

test("startup repairs completed pending requests, isolates a failed Message and retains open requests", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const failed = await pending(), terminal = await pending(), open = await pending()
    await historical(failed)
    await historical(terminal)
    {
      using cut = cutRetirement(failed)
      await PermissionAuthority.resumeApprovedContinuations()
      await assertRetired(terminal)
      expect(await PermissionAuthority.list()).toEqual([failed.request, open.request])
    }
    await PermissionAuthority.resumeApprovedContinuations()
    await assertRetired(failed)
    const committed = ledger(terminal)
    await PermissionAuthority.resumeApprovedContinuations()
    expect(ledger(terminal)).toEqual(committed)
    expect(await PermissionAuthority.list()).toEqual([open.request])
    await PermissionAuthority.reply({ requestID: open.request.id, decision: "allow_once", actorID: "operator" })
    expect(await open.execution).toMatchObject({ kind: "delivered", result: { output: "Authorized execution result" } })
  } })
})

test("foreign ambient imports publish retirement to the actual Session owner and preserve the other Project", async () => {
  await using one = await memoryProject("pending-one"), two = await memoryProject("pending-two")
  const first = await Instance.provide({ directory: one.path, fn: () => pending() })
  const second = await Instance.provide({ directory: two.path, fn: () => pending() })
  const completed = await Instance.provide({ directory: one.path, fn: () => conclusion(first) })
  await Instance.provide({ directory: two.path, fn: async () => {
    await Session.importSnapshot({ info: first.session,
      messages: [{ info: completed, parts: await MessageStore.parts(first.assistant.id) }] })
    expect(ledger(first).map(row => row.event_type)).toEqual(["requested", "cancelled"])
    expect(await PermissionAuthority.list()).toEqual([second.request])
    await PermissionAuthority.reply({ requestID: second.request.id, decision: "allow_once", actorID: "operator" })
    expect(await second.execution).toMatchObject({ kind: "delivered" })
  } })
  await Instance.provide({ directory: one.path, fn: () => assertRetired(first) })
})

test("approval that wins first retains its actual execution and retires with the original decision", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const value = await pending()
    const approved = await PermissionAuthority.reply({ requestID: value.request.id, decision: "allow_once", actorID: "operator" })
    expect(await value.execution).toMatchObject({ kind: "delivered", result: { output: "Authorized execution result" } })
    await Session.updateMessage(await conclusion(value))
    const events = ledger(value)
    expect(events.map(row => row.event_type)).toEqual(["requested", "allowed_once", "execution_started", "execution_succeeded", "stale"])
    expect(events.filter(row => row.decision_slot === value.request.id)).toMatchObject([{ id: approved.eventID, event_type: "allowed_once" }])
  } })
})
