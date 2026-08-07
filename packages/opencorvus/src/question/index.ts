import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { NotFoundError } from "@/storage/db"
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

export namespace Question {
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
      }),
    ),
    Rejected: BusEvent.define(
      "question.rejected",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        origin: z.literal("operator"),
        timeResolved: z.number().int().positive(),
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

  type PendingQuestion = {
    info: Request
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

  function finalizePending(
    pending: Record<string, PendingQuestion>,
    requestID: string,
    terminal: (entry: PendingQuestion) => void,
  ): boolean {
    const entry = takePending(pending, requestID)
    if (!entry) return false
    terminal(entry)
    return true
  }

  function rejectWaiters(entry: PendingQuestion, error: unknown) {
    for (const waiter of entry.waiters) waiter.reject(error)
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
      // We deliberately do NOT call entry.reject — by the time dispose runs, callers
      // have abandoned their await, and rejecting would surface as an unhandled rejection.
      for (const id of Object.keys(s.pending)) {
        finalizePending(s.pending, id, () => {})
      }
    },
    "question",
  )

  const QUESTION_MIN_TIMEOUT_MS = 1000

  function questionExpiryMs() {
    return Math.max(parseInt(process.env.OPENCORVUS_QUESTION_TIMEOUT_MS || "300000", 10), QUESTION_MIN_TIMEOUT_MS)
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
      s.pending[id] = {
        info,
        waiters: [{ resolve, reject }],
        timer: undefined,
      }
      Bus.publish(Event.Asked, info)
      if (automatic) {
        s.pending[id].timer = setTimeout(
          () => {
            const entry = takePending(s.pending, id)
            if (!entry) return
            void (async () => {
              const timeResolved = Date.now()
              log.info("automatic answer deadline", { id, questions: input.questions.length })
              try {
                await Bus.publish(Event.Replied, {
                  sessionID: entry.info.sessionID,
                  requestID: entry.info.id,
                  answers: automatic.answers,
                  timeResolved,
                  automatic: true,
                })
                for (const waiter of entry.waiters) waiter.resolve(automatic.answers)
              } catch (error) {
                rejectWaiters(entry, error)
              }
            })()
          },
          Math.max(automatic.timeExpires - Date.now(), 1),
        )
        return
      }
      if (!expiry) return
      log.info("question expiry configured", { id, timeExpires: expiry.timeExpires })
      s.pending[id].timer = setTimeout(
        () => {
          const entry = takePending(s.pending, id)
          if (!entry) return
          void (async () => {
            const timeResolved = Date.now()
            const deadline = entry.info.expiry!
            log.info("automatic question deadline elapsed", { id, questions: input.questions.length })
            try {
              await Bus.publish(Event.Expired, {
                sessionID: entry.info.sessionID,
                requestID: entry.info.id,
                origin: deadline.origin,
                timeExpires: deadline.timeExpires,
                timeResolved,
              })
              rejectWaiters(
                entry,
                new ExpiredError({ requestID: entry.info.id, timeExpires: deadline.timeExpires, timeResolved }),
              )
            } catch (error) {
              rejectWaiters(entry, error)
            }
          })()
        },
        Math.max(expiry.timeExpires - Date.now(), 1),
      )
    })
  }

  export async function reply(input: { requestID: string; answers: Answer[] }): Promise<void> {
    const s = await state()
    const existing = takePending(s.pending, input.requestID)
    if (!existing) {
      log.warn("reply for unknown request", { requestID: input.requestID })
      throw new NotFoundError({ message: `Question request not found: ${input.requestID}` })
    }
    log.info("replied", { requestID: input.requestID, answers: input.answers })
    const timeResolved = Date.now()
    try {
      await Bus.publish(Event.Replied, {
        sessionID: existing.info.sessionID,
        requestID: existing.info.id,
        answers: input.answers,
        timeResolved,
      })
      for (const waiter of existing.waiters) waiter.resolve(input.answers)
    } catch (error) {
      rejectWaiters(existing, error)
      throw error
    }
  }

  export async function reject(requestID: string): Promise<void> {
    const s = await state()
    const existing = takePending(s.pending, requestID)
    if (!existing) {
      log.warn("reject for unknown request", { requestID })
      throw new NotFoundError({ message: `Question request not found: ${requestID}` })
    }
    log.info("rejected", { requestID })
    const timeResolved = Date.now()
    try {
      await Bus.publish(Event.Rejected, {
        sessionID: existing.info.sessionID,
        requestID: existing.info.id,
        origin: "operator",
        timeResolved,
      })
      rejectWaiters(existing, new RejectedError({ requestID: existing.info.id, timeResolved }))
    } catch (error) {
      rejectWaiters(existing, error)
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
      await Bus.publish(Event.Abandoned, {
        sessionID: existing.info.sessionID,
        requestID: existing.info.id,
        origin: "infrastructure",
        timeResolved: Date.now(),
      })
      rejectWaiters(existing, input.error)
    } catch (error) {
      rejectWaiters(existing, error)
      throw error
    }
  }

  export async function list() {
    return state().then((x) => objectValues(x.pending).map((item) => item.info))
  }

  /**
   * Capture the project-scoped pending-question store while its instance
   * context is available, then read its current contents later from a
   * long-lived transport callback. The returned reader observes the same
   * canonical mutable store; it does not copy or mirror question state.
   */
  export async function pendingSnapshotReader(): Promise<() => Request[]> {
    const current = await state()
    return () => objectValues(current.pending).map((item) => item.info)
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
    | { status: "rejected"; output: string; answers: null }
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
        return {
          status: "rejected",
          output: "User dismissed the questions without answering. Decide how to proceed based on available context.",
          answers: null,
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
