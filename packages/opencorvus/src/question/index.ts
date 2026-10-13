import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Database, NotFoundError, and, eq, sql } from "@/storage/db"
import { inArray } from "drizzle-orm"
import { Log } from "@/util/log"
import z from "zod"
import { values as objectValues } from "@/util/object"
import { Answer as _Answer, Expiry as _Expiry, Info as _Info, Option as _Option, Request as _Request } from "./types"
import type {
  Answer as _AnswerType,
  Expiry as _ExpiryType,
  Info as _InfoType,
  Option as _OptionType,
  Request as _RequestType,
} from "./types"
import { InteractionUserInput } from "@/memory/interaction-user-input"

export namespace Question {
  let afterUserOutboxCommitForTest: (() => void) | undefined

  export namespace TestHooks {
    export function failAfterNextUserOutboxCommit(error = new Error("injected post-commit interruption")): Disposable {
      if (afterUserOutboxCommitForTest) throw new Error("Question post-commit interruption hook is already installed")
      afterUserOutboxCommitForTest = () => {
        afterUserOutboxCommitForTest = undefined
        throw error
      }
      return {
        [Symbol.dispose]() {
          afterUserOutboxCommitForTest = undefined
        },
      }
    }
  }

  const log = Log.create({ service: "question" })

  export const Option = _Option
  export type Option = _OptionType

  export const Info = _Info
  export type Info = _InfoType

  export const Request = _Request
  export type Request = _RequestType

  // Re-exported from ./types so schema-only consumers (engine/model) can
  // import directly without pulling in Bus/Instance. External callers using
  // the `Question.Answer` namespace form keep working unchanged.
  export const Answer = _Answer
  export type Answer = _AnswerType

  export const Expiry = _Expiry
  export type Expiry = _ExpiryType

  export const Reply = z.object({
    answers: z
      .array(Answer)
      .describe("User answers in order of questions (each answer is an array of selected option values)"),
  })
  export type Reply = z.infer<typeof Reply>

  export const Event = {
    Asked: BusEvent.define("question.asked", Request),
    Replied: BusEvent.define(
      "question.replied",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        answers: z.array(Answer),
        timeResolved: z.number().int().positive(),
        automatic: z.boolean().optional(),
        userInput: InteractionUserInput.optional(),
      }),
    ),
    Rejected: BusEvent.define(
      "question.rejected",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        origin: z.literal("operator"),
        timeResolved: z.number().int().positive(),
        userInput: InteractionUserInput.optional(),
      }),
    ),
    Expired: BusEvent.define(
      "question.expired",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        origin: z.literal("deadline"),
        timeExpires: z.number().int().positive(),
        timeResolved: z.number().int().positive(),
      }),
    ),
    Abandoned: BusEvent.define(
      "question.abandoned",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        origin: z.literal("infrastructure"),
        timeResolved: z.number().int().positive(),
      }),
    ),
  }

  export type TerminalPublication =
    | { type: "question.replied"; occurrenceID: string; properties: z.output<typeof Event.Replied.properties> }
    | { type: "question.rejected"; occurrenceID: string; properties: z.output<typeof Event.Rejected.properties> }
    | { type: "question.expired"; occurrenceID: string; properties: z.output<typeof Event.Expired.properties> }
    | { type: "question.abandoned"; occurrenceID: string; properties: z.output<typeof Event.Abandoned.properties> }

  /** Read the original publication facts, including terminal-first delivery.
   * The physical waiter map is not an independent terminal authority. */
  export function publicationFacts(input: {
    projectID: string
    sessionID: string
    requestID: string
    askedOccurrenceID?: string
    terminalOccurrenceID?: string
  }): { request: Request; askedOccurrenceID: string; terminal?: TerminalPublication } {
    return Database.use((db) => {
      const asked = db
        .select()
        .from(BusPublicationOutboxTable)
        .where(
          input.askedOccurrenceID
            ? eq(BusPublicationOutboxTable.occurrence_id, input.askedOccurrenceID)
            : and(
                eq(BusPublicationOutboxTable.project_id, input.projectID),
                eq(BusPublicationOutboxTable.event_type, Event.Asked.type),
                sql`json_extract(${BusPublicationOutboxTable.properties}, '$.id') = ${input.requestID}`,
                sql`json_extract(${BusPublicationOutboxTable.properties}, '$.sessionID') = ${input.sessionID}`,
              ),
        )
        .limit(2)
        .all()
      if (asked.length !== 1)
        throw new Error(`Question ${input.requestID} requires one original Asked publication; found ${asked.length}`)
      const source = asked[0]!
      if (source.project_id !== input.projectID || source.event_type !== Event.Asked.type) {
        throw new Error(`Question ${input.requestID} Asked publication has a different Project or event owner`)
      }
      const request = Request.parse(source.properties)
      if (request.id !== input.requestID || request.sessionID !== input.sessionID) {
        throw new Error(`Question ${input.requestID} Asked publication has a different Request or Session owner`)
      }
      const terminals = db
        .select()
        .from(BusPublicationOutboxTable)
        .where(
          and(
            eq(BusPublicationOutboxTable.project_id, input.projectID),
            inArray(BusPublicationOutboxTable.event_type, [
              Event.Replied.type,
              Event.Rejected.type,
              Event.Expired.type,
              Event.Abandoned.type,
            ]),
            sql`json_extract(${BusPublicationOutboxTable.properties}, '$.requestID') = ${input.requestID}`,
            sql`json_extract(${BusPublicationOutboxTable.properties}, '$.sessionID') = ${input.sessionID}`,
          ),
        )
        .limit(2)
        .all()
      if (terminals.length > 1)
        throw new Error(`Question ${input.requestID} has conflicting terminal publication identities`)
      const row = terminals[0]
      if (!row) {
        if (input.terminalOccurrenceID)
          throw new Error(`Question ${input.requestID} terminal publication ${input.terminalOccurrenceID} is missing`)
        return { request, askedOccurrenceID: source.occurrence_id }
      }
      if (input.terminalOccurrenceID && row.occurrence_id !== input.terminalOccurrenceID) {
        throw new Error(`Question ${input.requestID} terminal publication differs from its actual occurrence`)
      }
      const terminal = (() => {
        switch (row.event_type) {
          case Event.Replied.type:
            return {
              type: Event.Replied.type,
              occurrenceID: row.occurrence_id,
              properties: Event.Replied.properties.parse(row.properties),
            }
          case Event.Rejected.type:
            return {
              type: Event.Rejected.type,
              occurrenceID: row.occurrence_id,
              properties: Event.Rejected.properties.parse(row.properties),
            }
          case Event.Expired.type:
            return {
              type: Event.Expired.type,
              occurrenceID: row.occurrence_id,
              properties: Event.Expired.properties.parse(row.properties),
            }
          case Event.Abandoned.type:
            return {
              type: Event.Abandoned.type,
              occurrenceID: row.occurrence_id,
              properties: Event.Abandoned.properties.parse(row.properties),
            }
          default:
            throw new Error(`Question ${input.requestID} has an unsupported terminal event ${row.event_type}`)
        }
      })()
      return { request, askedOccurrenceID: source.occurrence_id, terminal }
    })
  }

  type PendingQuestion = {
    info: Request
    durableContinuation: boolean
    waiters: Array<{
      resolve: (answers: Answer[]) => void
      reject: (e: any) => void
    }>
    timer: ReturnType<typeof setTimeout> | undefined
  }

  /**
   * Own the complete pending-question terminal boundary. Removing the entry
   * before invoking the terminal callback makes every competing path
   * (reply/reject/timeout/dispose) exactly-once, while clearing the timer first
   * prevents a resolved question from retaining the process or firing late.
   */
  function takePending(pending: Record<string, PendingQuestion>, requestID: string): PendingQuestion | undefined {
    const entry = pending[requestID]
    if (!entry) return
    clearTimeout(entry.timer)
    delete pending[requestID]
    return entry
  }

  function rejectWaiters(entry: PendingQuestion, error: unknown) {
    for (const waiter of entry.waiters) waiter.reject(error)
  }

  function settlePublishedTerminal(entry: PendingQuestion, terminal: TerminalPublication) {
    switch (terminal.type) {
      case "question.replied":
        for (const waiter of entry.waiters) waiter.resolve(terminal.properties.answers)
        return
      case "question.rejected":
        rejectWaiters(entry, new RejectedError(terminal.properties))
        return
      case "question.expired":
        rejectWaiters(entry, new ExpiredError(terminal.properties))
        return
      case "question.abandoned":
        rejectWaiters(entry, new Error(`Question ${entry.info.id} was abandoned by infrastructure`))
    }
  }

  const state = createInstanceState(
    async () => {
      const pending: Record<string, PendingQuestion> = {}

      return {
        pending,
      }
    },
    async (s) => {
      // Cancel any pending question timers when the instance is disposed so that
      // late-firing automatic-expiry timers cannot bleed into the next test/run.
      // Preserve an already committed terminal for its physical waiters. A newly
      // abandoned request keeps the existing shutdown policy: its caller has
      // abandoned the await, so disposal does not create another rejection.
      for (const id of Object.keys(s.pending)) {
        const entry = takePending(s.pending, id)
        if (!entry) continue
        const facts = publicationFacts({
          projectID: Instance.project.id,
          sessionID: entry.info.sessionID,
          requestID: entry.info.id,
        })
        if (facts.terminal) {
          settlePublishedTerminal(entry, facts.terminal)
          continue
        }
        if (entry.durableContinuation) continue
        const publication = Bus.publishOwnedExact(
          Event.Abandoned,
          {
            sessionID: entry.info.sessionID,
            requestID: entry.info.id,
            origin: "infrastructure",
            timeResolved: Date.now(),
          },
          terminalOccurrenceID(entry.info.id),
        )
        await publication.retry()
      }
    },
    "question",
  )

  const QUESTION_MIN_TIMEOUT_MS = 1000

  function questionExpiryMs() {
    return Math.max(parseInt(process.env.OPENCORVUS_QUESTION_TIMEOUT_MS || "300000", 10), QUESTION_MIN_TIMEOUT_MS)
  }

  function terminalOccurrenceID(requestID: string) {
    return `bus-occurrence:question-terminal:${requestID}`
  }

  function assertSameQuestionRequest(existing: Request, next: Request) {
    if (existing.sessionID !== next.sessionID) {
      throw new Error(`Question request ${next.id} belongs to session ${existing.sessionID}, not ${next.sessionID}`)
    }
    if (JSON.stringify(existing.questions) !== JSON.stringify(next.questions)) {
      throw new Error(`Question request ${next.id} replay changed the question payload`)
    }
    if (JSON.stringify(existing.tool ?? null) !== JSON.stringify(next.tool ?? null)) {
      throw new Error(`Question request ${next.id} replay changed the tool binding`)
    }
    if (JSON.stringify(existing.automatic ?? null) !== JSON.stringify(next.automatic ?? null)) {
      throw new Error(`Question request ${next.id} replay changed the automatic answer contract`)
    }
    if (JSON.stringify(existing.expiry ?? null) !== JSON.stringify(next.expiry ?? null)) {
      throw new Error(`Question request ${next.id} replay changed the expiry contract`)
    }
  }

  function validateAutomaticAnswers(questions: Info[], answers: Answer[]) {
    if (answers.length !== questions.length) {
      throw new Error(`Automatic question answers must cover all ${questions.length} questions`)
    }
    questions.forEach((question, index) => {
      const selected = answers[index] ?? []
      if (selected.length === 0) {
        throw new Error(`Automatic answer ${index + 1} must select an enabled option`)
      }
      if (question.multiple !== true && selected.length !== 1) {
        throw new Error(`Automatic answer ${index + 1} must select exactly one option`)
      }
      for (const value of selected) {
        const option = question.options.find((candidate) => candidate.value === value)
        if (!option || option.disabled === true) {
          throw new Error(`Automatic answer ${index + 1} references unavailable option "${value}"`)
        }
      }
    })
  }

  function armPendingTimer(pending: Record<string, PendingQuestion>, requestID: string) {
    const entry = pending[requestID]
    if (!entry) throw new Error(`Question request ${requestID} disappeared before its deadline was armed`)
    const automatic = entry.info.automatic
    if (automatic) {
      entry.timer = setTimeout(() => {
        const current = takePending(pending, requestID)
        if (!current) return
        void (async () => {
          const timeResolved = Date.now()
          log.info("automatic answer deadline", { id: requestID, questions: current.info.questions.length })
          try {
            const publication = Bus.publishOwnedExact(Event.Replied, {
              sessionID: current.info.sessionID,
              requestID: current.info.id,
              answers: automatic.answers,
              timeResolved: automatic.timeExpires,
              automatic: true,
            }, terminalOccurrenceID(current.info.id))
            await publication.retry()
            for (const waiter of current.waiters) waiter.resolve(automatic.answers)
          } catch (error) {
            rejectWaiters(current, error)
          }
        })()
      }, Math.max(automatic.timeExpires - Date.now(), 1))
      return
    }
    const expiry = entry.info.expiry
    if (!expiry) return
    log.info("question expiry configured", { id: requestID, timeExpires: expiry.timeExpires })
    entry.timer = setTimeout(() => {
      const current = takePending(pending, requestID)
      if (!current) return
      void (async () => {
        const deadline = current.info.expiry!
        log.info("automatic question deadline elapsed", { id: requestID, questions: current.info.questions.length })
        try {
          const publication = Bus.publishOwnedExact(Event.Expired, {
            sessionID: current.info.sessionID,
            requestID: current.info.id,
            origin: deadline.origin,
            timeExpires: deadline.timeExpires,
            timeResolved: deadline.timeExpires,
          }, terminalOccurrenceID(current.info.id))
          await publication.retry()
          rejectWaiters(
            current,
            new ExpiredError({
              requestID: current.info.id,
              timeExpires: deadline.timeExpires,
              timeResolved: deadline.timeExpires,
            }),
          )
        } catch (error) {
          rejectWaiters(current, error)
        }
      })()
    }, Math.max(expiry.timeExpires - Date.now(), 1))
  }

  /** Restore the physical waiter/timer from the immutable Question input. No
   * second question.asked fact is emitted: the supplied Request is its owner. */
  export async function restore(request: Request): Promise<void> {
    const exact = Request.parse(request)
    const s = await state()
    const facts = publicationFacts({ projectID: Instance.project.id, sessionID: exact.sessionID, requestID: exact.id })
    assertSameQuestionRequest(facts.request, exact)
    if (facts.request.timeCreated !== exact.timeCreated)
      throw new Error(`Question ${exact.id} restore changed its original creation time`)
    if (facts.terminal) {
      const entry = takePending(s.pending, exact.id)
      if (entry) settlePublishedTerminal(entry, facts.terminal)
      return
    }
    const existing = s.pending[exact.id]
    if (existing) {
      assertSameQuestionRequest(existing.info, exact)
      return
    }
    s.pending[exact.id] = {
      info: exact,
      durableContinuation: true,
      waiters: [],
      timer: undefined,
    }
    armPendingTimer(s.pending, exact.id)
  }

  export async function ask(input: {
    sessionID: string
    questions: Info[]
    requestID?: string
    tool?: { messageID: string; callID: string }
    /** Override automatic expiry in ms. Defaults to OPENCORVUS_QUESTION_TIMEOUT_MS (5min). */
    timeoutMs?: number
    /** Resolve with these real answers at the explicit deadline instead of rejecting. */
    automatic?: {
      timeoutMs: number
      answers: Answer[]
    }
    /** Exact durable unanswered-question deadline reused by recovery callers. */
    expiry?: Expiry | null
    /** Canonical config projection for a newly created ordinary question. */
    expireOnDeadline?: boolean
    /** Exact durable creation time reused by recovery callers. */
    timeCreated?: number
    /** Optional owner admission executed in the exact transaction that accepts
     * the durable question publication. */
    acceptanceEffects?: (db: Database.TxOrDb) => void
    /** Exact durable Bus occurrence for an owner-admitted question. */
    acceptanceOccurrenceID?: string
  }): Promise<Answer[]> {
    const s = await state()
    const id = input.requestID ? Identifier.ascending("question", input.requestID) : Identifier.ascending("question")
    const automaticTimeout = input.automatic ? Math.max(input.automatic.timeoutMs, QUESTION_MIN_TIMEOUT_MS) : undefined
    if (input.automatic) validateAutomaticAnswers(input.questions, input.automatic.answers)
    if (input.automatic && input.expiry !== undefined) {
      throw new Error(`Question ${id} cannot combine automatic answers with unanswered-question expiry`)
    }
    const existing = s.pending[id]
    const expireOnDeadline = existing
      ? existing.info.expiry !== undefined
      : input.expiry !== undefined
        ? input.expiry !== null
        : !input.automatic && input.expireOnDeadline !== false
    const timeout = Math.max(input.timeoutMs ?? input.expiry?.timeoutMs ?? questionExpiryMs(), QUESTION_MIN_TIMEOUT_MS)
    const timeCreated = existing?.info.timeCreated ?? input.timeCreated ?? Date.now()
    const expiry =
      existing?.info.expiry ??
      (input.expiry === null
        ? undefined
        : (input.expiry ??
          (expireOnDeadline
            ? { origin: "deadline" as const, timeoutMs: timeout, timeExpires: timeCreated + timeout }
            : undefined)))
    if (input.expiry) Expiry.parse(input.expiry)
    log.info("asking", {
      id,
      questions: input.questions.length,
      timeoutMs: automaticTimeout ?? expiry?.timeoutMs,
      automatic: input.automatic !== undefined,
    })

    return new Promise<Answer[]>((resolve, reject) => {
      const automatic = input.automatic
        ? {
            answers: input.automatic.answers,
            timeoutMs: automaticTimeout!,
            timeExpires: existing?.info.automatic?.timeExpires ?? Date.now() + automaticTimeout!,
          }
        : undefined
      const info: Request = {
        id,
        sessionID: input.sessionID,
        timeCreated,
        questions: input.questions,
        tool: input.tool,
        automatic,
        expiry,
      }
      if (existing) {
        assertSameQuestionRequest(existing.info, info)
        existing.waiters.push({ resolve, reject })
        return
      }
      try {
        if (Boolean(input.acceptanceEffects) !== Boolean(input.acceptanceOccurrenceID)) {
          throw new Error(`Question ${id} owner admission requires both effect and exact occurrence identity`)
        }
        Database.immediateTransaction((db) => {
          input.acceptanceEffects?.(db)
          Database.effect(() => {
            s.pending[id] = {
              info,
              durableContinuation: input.requestID !== undefined,
              waiters: [{ resolve, reject }],
              timer: undefined,
            }
            // The timer outlives this synchronous post-commit effect. Keep its
            // Instance owner, but do not inherit the completed DB effect lease.
            Database.runOutsideContext(() => armPendingTimer(s.pending, id))
          })
          if (input.acceptanceOccurrenceID)
            Bus.publishOwnedExactInTransaction(Event.Asked, info, input.acceptanceOccurrenceID)
          else Bus.publishOwnedInTransaction(Event.Asked, info)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  export async function reply(input: {
    requestID: string
    answers: Answer[]
    userInput?: InteractionUserInput
  }): Promise<void> {
    const s = await state()
    const pending = s.pending[input.requestID]
    if (!pending) {
      log.warn("reply for unknown request", { requestID: input.requestID })
      throw new NotFoundError({ message: `Question request not found: ${input.requestID}` })
    }
    log.info("replied", { requestID: input.requestID, answers: input.answers })
    const timeResolved = Date.now()
    let existing: PendingQuestion | undefined
    try {
      let publication: Bus.Publication | undefined
      if (input.userInput) {
        publication = Bus.publishOwnedExact(Event.Replied, {
          sessionID: pending.info.sessionID,
          requestID: pending.info.id,
          answers: input.answers,
          timeResolved,
          userInput: input.userInput,
        }, terminalOccurrenceID(pending.info.id))
        afterUserOutboxCommitForTest?.()
      } else {
        publication = Bus.publishOwnedExact(Event.Replied, {
          sessionID: pending.info.sessionID,
          requestID: pending.info.id,
          answers: input.answers,
          timeResolved,
        }, terminalOccurrenceID(pending.info.id))
      }
      // Do not claim the in-memory question until the user-authored terminal
      // occurrence is durably committed. A failed source transaction therefore
      // leaves the original waiter, deadline, and retry target intact.
      existing = takePending(s.pending, input.requestID)
      if (!existing) throw new Error(`Question request ${input.requestID} changed during reply commit`)
      if (publication) await publication.retry()
      for (const waiter of existing.waiters) waiter.resolve(input.answers)
    } catch (error) {
      if (existing) rejectWaiters(existing, error)
      throw error
    }
  }

  export async function reject(requestID: string, userInput?: InteractionUserInput): Promise<void> {
    const s = await state()
    const pending = s.pending[requestID]
    if (!pending) {
      log.warn("reject for unknown request", { requestID })
      throw new NotFoundError({ message: `Question request not found: ${requestID}` })
    }
    log.info("rejected", { requestID })
    const timeResolved = Date.now()
    let existing: PendingQuestion | undefined
    try {
      let publication: Bus.Publication | undefined
      if (userInput) {
        publication = Bus.publishOwnedExact(Event.Rejected, {
          sessionID: pending.info.sessionID,
          requestID: pending.info.id,
          origin: "operator",
          timeResolved,
          userInput,
        }, terminalOccurrenceID(pending.info.id))
        afterUserOutboxCommitForTest?.()
      } else {
        publication = Bus.publishOwnedExact(Event.Rejected, {
          sessionID: pending.info.sessionID,
          requestID: pending.info.id,
          origin: "operator",
          timeResolved,
        }, terminalOccurrenceID(pending.info.id))
      }
      existing = takePending(s.pending, requestID)
      if (!existing) throw new Error(`Question request ${requestID} changed during reject commit`)
      if (publication) await publication.retry()
      rejectWaiters(existing, new RejectedError({ requestID: existing.info.id, timeResolved }))
    } catch (error) {
      if (existing) rejectWaiters(existing, error)
      throw error
    }
  }

  export class RejectedError extends Error {
    readonly requestID?: string
    readonly origin = "operator" as const
    readonly timeResolved?: number

    constructor(input?: { requestID: string; timeResolved: number }) {
      super("The user dismissed this question")
      this.name = "QuestionRejectedError"
      this.requestID = input?.requestID
      this.timeResolved = input?.timeResolved
    }
  }

  export class ExpiredError extends Error {
    readonly timeExpires: number
    readonly timeResolved: number
    readonly requestID: string
    readonly origin = "deadline" as const

    constructor(input: { requestID: string; timeExpires: number; timeResolved: number }) {
      super("The automatic question deadline elapsed without an operator decision")
      this.name = "QuestionExpiredError"
      this.timeExpires = input.timeExpires
      this.timeResolved = input.timeResolved
      this.requestID = input.requestID
    }
  }

  export async function abandon(input: { requestID: string; error: unknown }): Promise<void> {
    const s = await state()
    const existing = takePending(s.pending, input.requestID)
    if (!existing) {
      throw new NotFoundError({ message: `Question request not found: ${input.requestID}` })
    }
    log.warn("question abandoned by infrastructure", { requestID: input.requestID })
    try {
      const publication = Bus.publishOwnedExact(Event.Abandoned, {
        sessionID: existing.info.sessionID,
        requestID: existing.info.id,
        origin: "infrastructure",
        timeResolved: Date.now(),
      }, terminalOccurrenceID(existing.info.id))
      await publication.retry()
      rejectWaiters(existing, input.error)
    } catch (error) {
      rejectWaiters(existing, error)
      throw error
    }
  }

  /**
   * Publish the terminal occurrence for a durable Question whose owning
   * project Instance was replaced. The former in-memory waiter is already
   * gone, so bootstrap supplies the exact persisted Session/request identity.
   */
  export async function abandonRecovered(input: {
    sessionID: string
    requestID: string
    timeResolved: number
  }): Promise<void> {
    log.warn("recovered question abandoned by infrastructure", { requestID: input.requestID })
    const publication = Bus.publishOwnedExact(Event.Abandoned, {
      sessionID: input.sessionID,
      requestID: input.requestID,
      origin: "infrastructure",
      timeResolved: input.timeResolved,
    }, terminalOccurrenceID(input.requestID))
    await publication.retry()
  }

  export async function list() {
    return (await pendingSnapshotReader())()
  }

  /**
   * Capture the Project-scoped physical waiter set for a transport callback.
   * Each read projects its original durable Request and accepted terminal;
   * the waiter set is not a second terminal authority or a copied snapshot.
   */
  export async function pendingSnapshotReader(): Promise<() => Request[]> {
    const current = await state()
    const projectID = Instance.project.id
    return () =>
      objectValues(current.pending).flatMap((item) => {
        const facts = publicationFacts({ projectID, sessionID: item.info.sessionID, requestID: item.info.id })
        return facts.terminal ? [] : [facts.request]
      })
  }

  /**
   * Ask the user and return both the formatted LLM-facing summary and the raw
   * answers. Shared by the executor-side QuestionTool and the orchestrator's
   * `question` tool so both code paths render the same final string; the raw
   * `answers` are used by clients such as overlay to re-render the tool card.
   *
   * Explicit rejection and automatic deadline expiry are separate outcomes.
   * Both omit answers, while their status and model-visible text preserve the
   * exact operator or deadline provenance.
   */
  export async function askAndFormat(input: {
    sessionID: string
    questions: Info[]
    tool?: { messageID: string; callID: string }
    requestID?: string
    timeoutMs?: number
    automatic?: {
      timeoutMs: number
      answers: Answer[]
    }
  }): Promise<
    | { status: "answered"; output: string; answers: Answer[] }
    | { status: "rejected"; output: string; answers: null; requestID: string }
    | {
        status: "expired"
        output: string
        answers: null
        requestID: string
        timeExpires: number
        timeResolved: number
      }
  > {
    try {
      const config = await Config.get()
      const answers = await ask({
        ...input,
        expireOnDeadline: config.experimental?.auto_question === true,
      })
      const lines = input.questions
        .map((question, index) => {
          const renderedAnswers = (answers[index] ?? []).map((answer) => {
            const option = question.options.find((candidate) => candidate.value === answer)
            return option ? `${option.label} [${option.value}]` : answer
          })
          return `"${question.question}" -> ${renderedAnswers.join(", ") || "(no answer)"}`
        })
        .join("\n")
      return { status: "answered", output: `User answered:\n${lines}`, answers }
    } catch (err) {
      if (err instanceof RejectedError) {
        if (!err.requestID) throw err
        return {
          status: "rejected",
          output: "User dismissed the questions without answering. Decide how to proceed based on available context.",
          answers: null,
          requestID: err.requestID,
        }
      }
      if (err instanceof ExpiredError) {
        return {
          status: "expired",
          output:
            `The automatic question deadline elapsed at ${err.timeExpires} without an operator decision. ` +
            "Continue from the available evidence by choosing a concrete repair action or an explicitly named wait.",
          answers: null,
          requestID: err.requestID,
          timeExpires: err.timeExpires,
          timeResolved: err.timeResolved,
        }
      }
      throw err
    }
  }
}
