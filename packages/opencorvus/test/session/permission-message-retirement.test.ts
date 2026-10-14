import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { BusPublicationOutboxTable } from "../../src/bus/bus.sql"
import { Identifier } from "../../src/id/id"
import { PermissionAuthority } from "../../src/permission/authority"
import { PermissionExecutionResultTable, PermissionLedgerTable } from "../../src/permission/permission.sql"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Message } from "../../src/session/message"
import { MessageStore } from "../../src/session/message-store"
import { SessionPromptOwner } from "../../src/session/prompt/owner"
import { SessionPromptState } from "../../src/session/prompt/state"
import { MessageTable, PartTable, ToolPartRequestTable, ToolPartOutcomeTable } from "../../src/session/session.sql"
import { completedToolExecutionResult } from "../../src/session/tool-outcome-facts"
import { Database, asc, eq, sql } from "../../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { permissionMessageResult } from "../fixture/permission-message-result"
import { completedReadResult } from "../fixture/completed-read-result"

afterEach(resetMemoryDatabase)

type Value = Awaited<ReturnType<typeof permissionMessageResult>>
const events = ["requested", "allowed_once", "execution_started", "execution_succeeded", "stale"]

async function scope(run: (value: Value, owner: SessionPromptOwner.Authority) => Promise<void>, deferredTool = false) {
  await using project = await memoryProject()
  const source = path.join(path.dirname(project.path), `retirement-${Identifier.ascending("part")}.csv`)
  await fs.writeFile(source, "item,quantity\nMaple,3\nIris,4\n")
  try {
    await Instance.provide({ directory: project.path, fn: async () => {
      let request: PermissionAuthority.Request | undefined
      const read = deferredTool ? await completedReadResult({ mode: "ask", filePath: source, approve: async actual => {
        request = actual
        await PermissionAuthority.reply({ requestID: actual.id, decision: "allow_once", actorID: "retirement-contract" })
      } }) : undefined
      const value = read ? { ...read, request: request! } : await permissionMessageResult(source)
      const abort = SessionPromptState.start(value.session.id)
      if (!abort) throw Error("Exact Prompt owner required")
      try {
        await run(value, SessionPromptOwner.current(value.session.id)!)
      } finally {
        await SessionPromptState.finish(value.session.id, abort)
      }
    } })
  } finally {
    await fs.unlink(source)
  }
}

function snapshot(value: Value) {
  return Database.use(db => {
    const ledger = db.select().from(PermissionLedgerTable)
      .where(eq(PermissionLedgerTable.request_id, value.request.id)).orderBy(asc(sql`rowid`)).all()
    const attemptID = ledger.find(row => row.event_type === "execution_started")!.attempt_id!
    return {
      message: db.select().from(MessageTable).where(eq(MessageTable.id, value.assistant.id)).get(),
      parts: db.select().from(PartTable).where(eq(PartTable.message_id, value.assistant.id)).orderBy(asc(PartTable.id)).all(),
      toolRequests: db.select().from(ToolPartRequestTable)
        .where(eq(ToolPartRequestTable.message_id, value.assistant.id)).orderBy(asc(ToolPartRequestTable.id)).all(),
      toolOutcomes: db.select().from(ToolPartOutcomeTable)
        .where(eq(ToolPartOutcomeTable.request_part_id, value.part.id)).orderBy(asc(ToolPartOutcomeTable.id)).all(),
      result: db.select().from(PermissionExecutionResultTable)
        .where(eq(PermissionExecutionResultTable.attempt_id, attemptID)).get(),
      ledger,
      outbox: db.select().from(BusPublicationOutboxTable).where(sql`
        json_extract(${BusPublicationOutboxTable.properties}, '$.info.id') = ${value.assistant.id}
        OR json_extract(${BusPublicationOutboxTable.properties}, '$.part.messageID') = ${value.assistant.id}
      `).orderBy(asc(BusPublicationOutboxTable.occurrence_id)).all(),
    }
  })
}

/** Compute from real Tool outcomes, then undo the entire preparation transaction.
 * This is a local writer candidate, not a committed/model-generated completion. */
function completionCandidate(value: Value, owner: SessionPromptOwner.Authority): Message.Assistant {
  const before = snapshot(value)
  const rollback = new Error("ROLL_BACK_COMPLETION_CANDIDATE")
  let candidate: Message.Assistant | undefined
  expect(() => Database.immediateTransaction(() => {
    const result = Session.completeRecoveredToolMessage({ sessionID: value.session.id, messageID: value.assistant.id, owner })
    expect(result.status).toBe("completed")
    candidate = Message.Assistant.parse(result.info)
    throw rollback
  })).toThrow(rollback)
  expect(snapshot(value)).toEqual(before)
  if (!candidate) throw Error("Production completion candidate required")
  return candidate
}

function cutRetirement(requestID: string): Disposable {
  const name = `retirement_cut_${Identifier.ascending("part").replaceAll(/[^a-zA-Z0-9_]/g, "_")}`
  Database.use(db => db.run(sql.raw(`CREATE TEMP TRIGGER ${name} BEFORE INSERT ON permission_ledger
    WHEN NEW.request_id = '${requestID}' AND NEW.event_type = 'stale'
    BEGIN SELECT RAISE(ABORT, 'MESSAGE_RETIREMENT_COMMIT_CUT'); END`)))
  return { [Symbol.dispose]() { Database.use(db => db.run(sql.raw(`DROP TRIGGER ${name}`))) } }
}

async function assertCompleted(value: Value, candidate: Message.Assistant) {
  const actual = await MessageStore.get({ sessionID: value.session.id, messageID: value.assistant.id })
  expect(Message.Assistant.parse(actual.info)).toEqual(candidate)
  expect(snapshot(value).ledger.map(row => row.event_type)).toEqual(events)
  expect(structuredClone(actual.parts.find(part => part.id === value.part.id))).toMatchObject({
    id: value.part.id, state: { status: "completed", output: value.result.output },
  })
  expect(Database.use(db => completedToolExecutionResult(db, value.part))?.value).toEqual(value.result)
}

for (const writer of ["update", "silent", "bundle", "atomic", "import"] as const) {
  test(`${writer} commits the real completion candidate and its exact Permission retirement together`, async () => {
    await scope(async (value, owner) => {
      const candidate = completionCandidate(value, owner)
      const parts = await MessageStore.parts(value.assistant.id)
      const originalOutbox = snapshot(value).outbox
      if (writer === "update") await Session.updateMessage(candidate)
      if (writer === "silent") await Session.saveMessage(candidate)
      if (writer === "bundle") await Session.persistMessage({ info: candidate, parts })
      if (writer === "atomic") Session.updateMessageAndPartWithCommit({
        info: candidate, part: parts.find(part => part.id === value.part.id)!,
      }, () => {})
      if (writer === "import") await Session.importSnapshot({ info: value.session, messages: [{ info: candidate, parts }] })
      await assertCompleted(value, candidate)
      if (writer === "silent" || writer === "import") expect(snapshot(value).outbox).toEqual(originalOutbox)
      const committed = snapshot(value)
      await Session.updateMessage(candidate)
      expect(snapshot(value)).toEqual(committed)
      await assertCompleted(value, candidate)
    })
  })
}

test("retirement insert failure preserves the actual open Message, completed Tool, result and outbox for retry", async () => {
  await scope(async (value, owner) => {
    const candidate = completionCandidate(value, owner)
    const original = snapshot(value)
    {
      using cut = cutRetirement(value.request.id)
      await expect(Session.updateMessage(candidate)).rejects.toThrow("MESSAGE_RETIREMENT_COMMIT_CUT")
      expect(snapshot(value)).toEqual(original)
    }
    await Session.updateMessage(candidate)
    await assertCompleted(value, candidate)
  })
})

test("equal completed replay retires a real late compound result while ordinary bundle preserves Source admission", async () => {
  await scope(async (value, owner) => {
    const original = snapshot(value)
    const originalParts = await MessageStore.parts(value.assistant.id)
    const receipt = Database.use(db => completedToolExecutionResult(db, value.part))!
    const rollback = new Error("ROLL_BACK_RESULT_AND_COMPLETION_CANDIDATES")
    let materialization: ReturnType<typeof Session.persistCompletedToolResult> | undefined
    let candidate: Message.Assistant | undefined
    let preparationError: unknown
    try {
      Database.immediateTransaction(() => {
        if (value.part.state.status !== "running") throw Error("Original running Tool required")
        // This API's current body performs its canonical transaction synchronously.
        // The owning callback returns no Promise; the one returned operation is joined below.
        materialization = Session.persistCompletedToolResult({
          tool: { ...value.part, state: { status: "completed", input: value.part.state.input,
            output: value.result.output, title: value.result.title, metadata: value.result.metadata,
            time: { start: value.part.state.time.start, end: Math.max(receipt.completedAt, value.part.state.time.start + 1) },
          } },
          sources: value.result.sources, expectedResultAttemptID: receipt.attemptID,
        })
        void materialization.catch(() => undefined)
        const completed = Session.completeRecoveredToolMessage({ sessionID: value.session.id, messageID: value.assistant.id, owner })
        if (completed.status !== "completed") throw Error("Actual result must prepare a complete candidate")
        candidate = Message.Assistant.parse(completed.info)
        throw rollback
      })
    } catch (error) {
      if (error !== rollback) preparationError = error
    }
    let result: Awaited<ReturnType<typeof Session.persistCompletedToolResult>> | undefined
    try {
      if (!materialization) throw Error("Original canonical materialization operation required")
      result = await materialization
    } catch (error) {
      if (preparationError) throw new AggregateError([preparationError, error], "Candidate preparation failed")
      throw error
    }
    if (preparationError) throw preparationError
    expect(snapshot(value)).toEqual(original)
    if (!candidate) throw Error("Production completion candidate required")
    await expect(Session.persistMessage({ info: candidate,
      parts: [...originalParts.filter(part => part.id !== value.part.id), result.tool,
        ...result.parts.map(({ orderKey: _preparedOrderKey, ...part }) => part)],
    })).rejects.toThrow(`Part ${result.parts[0]!.id} is immutable after assistant completion`)
    expect(snapshot(value)).toEqual(original)
    await Session.saveMessage(candidate)
    const committed = await Session.persistCompletedToolResult({
      tool: result.tool, sources: value.result.sources, expectedResultAttemptID: receipt.attemptID,
    })
    expect(structuredClone(committed.parts)).toMatchObject(value.result.sources!.map(source => ({
      ...source, sessionID: value.session.id, messageID: value.assistant.id, toolPartID: value.part.id,
    })))
    const actualParts = await MessageStore.parts(value.assistant.id)
    expect(actualParts.filter(part => committed.parts.some(source => source.id === part.id))).toEqual(committed.parts)
    await Session.updateMessage(candidate)
    await assertCompleted(value, candidate)
  }, true)
})

test("atomic afterWrite failure rolls back the completion and retirement accepted by its nested writers", async () => {
  await scope(async (value, owner) => {
    const candidate = completionCandidate(value, owner)
    const part = (await MessageStore.parts(value.assistant.id)).find(part => part.id === value.part.id)!
    const original = snapshot(value)
    const failure = new Error("ATOMIC_MESSAGE_COMMIT_CUT")
    expect(() => Session.updateMessageAndPartWithCommit({ info: candidate, part }, () => {}, () => {
      expect(snapshot(value).ledger.map(row => row.event_type)).toEqual(events)
      throw failure
    })).toThrow(failure)
    expect(snapshot(value)).toEqual(original)
    Session.updateMessageAndPartWithCommit({ info: candidate, part }, () => {}, () => {
      expect(snapshot(value).ledger.map(row => row.event_type)).toEqual(events)
    })
    await assertCompleted(value, candidate)
  })
})

test("supported foreign-ambient import retires the original Session Project's actual invocation", async () => {
  await using other = await memoryProject()
  await scope(async (value, owner) => {
    const candidate = completionCandidate(value, owner)
    const parts = await MessageStore.parts(value.assistant.id)
    await Instance.provide({ directory: other.path, fn: async () => {
      expect(Instance.directory).toBe(other.path)
      await Session.importSnapshot({ info: value.session, messages: [{ info: candidate, parts }] })
      await assertCompleted(value, candidate)
      expect(snapshot(value).ledger.filter(row => row.event_type === "requested")
        .map(row => ({ project: row.project_id, session: row.session_id, message: row.message_id }))).toEqual([
        { project: value.session.projectID, session: value.session.id, message: value.assistant.id },
      ])
    } })
  })
})

test("typed continuation failure and actual SQLite retirement failure remain two original errors", async () => {
  await scope(async (value) => {
    const original = snapshot(value)
    const cause = new PermissionAuthority.StaleContinuationError(value.request.id, "Exact recovered Tool surface changed")
    let combined: unknown
    {
      using cut = cutRetirement(value.request.id)
      try { await PermissionAuthority.resumeExactContinuation(value.request, async () => { throw cause }) }
      catch (error) { combined = error }
      expect(combined).toBeInstanceOf(AggregateError)
      const errors = (combined as AggregateError).errors
      expect(errors[0]).toBe(cause)
      expect(String(errors[1])).toContain("MESSAGE_RETIREMENT_COMMIT_CUT")
      expect(snapshot(value)).toEqual(original)
    }
    await expect(PermissionAuthority.resumeExactContinuation(value.request, async () => { throw cause })).rejects.toBe(cause)
    expect(snapshot(value).ledger.map(row => row.event_type)).toEqual(events)
    expect(snapshot(value).ledger.at(-1)).toMatchObject({ request_id: value.request.id, reason: cause.message })
  })
})
