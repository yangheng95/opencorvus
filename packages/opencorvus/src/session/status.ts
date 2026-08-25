import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import type { StreamActivityMonitor } from "@/util/stream-activity"
import { Database, and, eq } from "@/storage/db"
import { MessageTable, SessionTable } from "./session.sql"
import { Identifier } from "@/id/id"
import { timelineOrderKey, timelineOrderKeyDomain } from "@/timeline/order"
import { runAsInstanceActivity } from "@/project/instance"

export function sessionLifecycleOrderKey(sessionID: string): string {
  const row = Database.use((db) =>
    db
      .select({ timeCreated: SessionTable.time_created })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get(),
  )
  if (!row) throw new Error(`session lifecycle ${sessionID} missing persisted row`)
  return timelineOrderKey({
    domain: "session",
    time: row.timeCreated,
    id: sessionID,
  })
}

export function executionLifecycleOrderKey(sessionID: string, inputMessageID: string): string {
  const row = Database.use((db) =>
    db
      .select({ timeCreated: MessageTable.time_created })
      .from(MessageTable)
      .where(and(eq(MessageTable.id, inputMessageID), eq(MessageTable.session_id, sessionID)))
      .get(),
  )
  if (!row) {
    throw new Error(`execution lifecycle ${sessionID}/${inputMessageID} missing persisted input Message`)
  }
  return timelineOrderKey({
    domain: "session",
    time: row.timeCreated,
    id: inputMessageID,
  })
}

function isSessionOrderKey(value: string): boolean {
  try {
    return timelineOrderKeyDomain(value, "session lifecycle orderKey") === "session"
  } catch {
    return false
  }
}

export namespace SessionStatus {
  /**
   * Execution lifecycle fact for one exact input user message. Session rows
   * remain topology; this value describes work caused by an input occurrence.
   *
   *   streaming = LLM round-trip in flight (overlay shows spinner)
   *   retry     = streaming, currently sleeping between provider retries
   *   idle      = between turns, awaiting user message / next wake (no spinner)
   *   terminal  = the physical Turn settled; reason explains why
   *
   * Replaces the per-phase `<phase>.completed` bus events that previously
   * served as the only terminal signal for subagent overlay cards.
   */
  export const Info = z
    .union([
      z.object({
        type: z.literal("idle"),
      }),
      z.object({
        type: z.literal("retry"),
        attempt: z.number(),
        message: z.string(),
        next: z.number(),
      }),
      z.object({
        type: z.literal("streaming"),
      }),
      z.object({
        type: z.literal("terminal"),
        reason: z.enum(["completed", "coordinated", "error", "aborted"]),
        error: z.string().optional(),
      }),
    ])
    .meta({
      ref: "SessionStatus",
    })
  export type Info = z.infer<typeof Info>

  export function isExecuting(status: Info): boolean {
    return status.type === "streaming" || status.type === "retry"
  }

  export const LifecycleOrderKey = z.string().min(1).refine(isSessionOrderKey, {
    message: "expected session orderKey",
  })

  export const Event = {
    Status: BusEvent.define(
      "agent.execution.lifecycle",
      z.object({
        sessionID: z.string(),
        inputMessageID: Identifier.schema("message"),
        taskID: z.string().min(1).optional(),
        orderKey: LifecycleOrderKey,
        status: Info,
      }),
    ),
  }

  // Process-singleton execution facts are keyed by the physical Session and
  // the exact input message that caused the work. A reusable Session can own
  // many occurrences; one occurrence's terminal fact must never seal another.
  const executionStates: Record<string, { inputMessageID: string; status: Info }> = {}
  const activityMonitors: Record<string, StreamActivityMonitor> = {}
  const promptGenerationOwners: Record<string, AbortSignal> = {}
  const finishedPromptGenerationOwners: Record<string, AbortSignal> = {}
  const executionOccurrences: Record<string, { inputMessageID: string; owner?: AbortSignal }> = {}
  const publications: Record<string, { status: Info; completion: Promise<void> }> = {}

  function occurrenceKey(sessionID: string, inputMessageID: string): string {
    return `${sessionID}:${inputMessageID}`
  }

  export function get(sessionID: string) {
    const inputMessageID = executionOccurrences[sessionID]?.inputMessageID
    return (
      (inputMessageID && executionStates[sessionID]?.inputMessageID === inputMessageID
        ? executionStates[sessionID]?.status
        : undefined) ?? {
        type: "idle",
      }
    )
  }

  export function getExecution(sessionID: string, inputMessageID: string): Info {
    const current = executionStates[sessionID]
    return current?.inputMessageID === inputMessageID ? current.status : { type: "idle" }
  }

  /**
   * Begin a new prompt generation after the previous prompt owner has fully
   * released its slot. Terminal idempotency is generation-scoped: it blocks
   * late writes from the owner that produced that terminal, but it must not
   * seal a reusable Mission or scheduled session forever.
   */
  export function beginPromptGeneration(sessionID: string, owner: AbortSignal): void {
    delete finishedPromptGenerationOwners[sessionID]
    promptGenerationOwners[sessionID] = owner
  }

  export function beginExecutionOccurrence(sessionID: string, inputMessageID: string, owner?: AbortSignal): void {
    requireDurableInputMessage(sessionID, inputMessageID)
    const current = executionOccurrences[sessionID]
    if (current?.inputMessageID === inputMessageID && current.owner === owner) return
    executionOccurrences[sessionID] = { inputMessageID, owner }
    if (executionStates[sessionID]?.inputMessageID !== inputMessageID) delete executionStates[sessionID]
    delete activityMonitors[sessionID]
  }

  export function executionOccurrence(sessionID: string) {
    return executionOccurrences[sessionID]
  }

  /** Wait for one exact input-message generation to leave streaming/retry. */
  export async function waitForExecutionSettlement(input: {
    sessionID: string
    inputMessageID: string
    owner: AbortSignal
  }): Promise<void> {
    const settled = () => {
      const occurrence = executionOccurrences[input.sessionID]
      if (!occurrence || occurrence.inputMessageID !== input.inputMessageID || occurrence.owner !== input.owner) {
        return true
      }
      return !isExecuting(getExecution(input.sessionID, input.inputMessageID))
    }
    if (settled()) return
    await new Promise<void>((resolve) => {
      const unsubscribe = Bus.subscribe(Event.Status, (event) => {
        if (event.properties.sessionID !== input.sessionID || !settled()) return
        unsubscribe()
        resolve()
      })
      if (settled()) {
        unsubscribe()
        resolve()
      }
    })
  }

  /** Publish the accepted boundary of this prompt owner's exact execution occurrence. */
  export function settleAcceptedExecutionOccurrence(sessionID: string, owner: AbortSignal): Promise<void> {
    const occurrence = executionOccurrences[sessionID]
    if (!occurrence || occurrence.owner !== owner) return Promise.resolve()
    return set(sessionID, { type: "idle" }, { promptGenerationOwner: owner, inputMessageID: occurrence.inputMessageID })
  }

  export function finishPromptGeneration(sessionID: string, owner: AbortSignal): void {
    if (promptGenerationOwners[sessionID] !== owner) return
    delete promptGenerationOwners[sessionID]
    finishedPromptGenerationOwners[sessionID] = owner
  }

  export function list() {
    return Object.fromEntries(Object.keys(executionOccurrences).map((sessionID) => [sessionID, get(sessionID)]))
  }

  export function registerActivityMonitor(sessionID: string, monitor: StreamActivityMonitor): () => void {
    activityMonitors[sessionID] = monitor
    return () => {
      if (activityMonitors[sessionID] === monitor) {
        delete activityMonitors[sessionID]
      }
    }
  }

  export function getActivity(sessionID: string) {
    const monitor = activityMonitors[sessionID]
    if (!monitor) return undefined
    return {
      last_activity_at: monitor.lastActivityAt(),
      paused: monitor.paused(),
    }
  }

  /** Renew one Session's inactivity window after a durable execution fact commits. */
  export function observeActivity(sessionID: string): void {
    activityMonitors[sessionID]?.observe()
  }

  export function abortActivityMonitor(sessionID: string, reason?: unknown) {
    activityMonitors[sessionID]?.abort(reason)
  }

  /**
   * Release every process-owned lifecycle resource for a session after its
   * database row has been physically deleted.
   */
  export function release(sessionID: string): void {
    const monitor = activityMonitors[sessionID]
    delete executionStates[sessionID]
    delete activityMonitors[sessionID]
    delete promptGenerationOwners[sessionID]
    delete finishedPromptGenerationOwners[sessionID]
    delete executionOccurrences[sessionID]
    for (const key of Object.keys(publications)) {
      if (key.startsWith(`${sessionID}:`)) delete publications[key]
    }
    if (!monitor) return
    try {
      monitor.abort(new DOMException("session deleted", "AbortError"))
    } finally {
      monitor.dispose()
    }
  }

  export function set(
    sessionID: string,
    status: Info,
    options?: {
      promptGenerationOwner?: AbortSignal
      taskID?: string
      inputMessageID?: string
      /**
       * The caller settled this occurrence against its durable facts — its
       * user Message and Task ledger — not against the live prompt. The
       * prompt-owner gate exists to stop a stale writer from clobbering the
       * live owner's status; a validated settlement is not a stale writer,
       * and silently dropping it would leave the durable occurrence without
       * its terminal publication.
       */
      settledOccurrence?: boolean
    },
  ): Promise<void> {
    const promptOwner = promptGenerationOwners[sessionID]
    if (
      !options?.settledOccurrence &&
      ((promptOwner && options?.promptGenerationOwner !== promptOwner) ||
        (!promptOwner &&
          options?.promptGenerationOwner &&
          options.promptGenerationOwner !== finishedPromptGenerationOwners[sessionID]))
    ) {
      return Promise.resolve()
    }
    const parsedStatus = Info.parse(status)
    const inputMessageID = options?.inputMessageID ?? executionOccurrences[sessionID]?.inputMessageID
    if (!inputMessageID) {
      if (parsedStatus.type === "idle") delete activityMonitors[sessionID]
      return Promise.resolve()
    }
    requireDurableInputMessage(sessionID, inputMessageID)
    if (!executionOccurrences[sessionID]) {
      executionOccurrences[sessionID] = { inputMessageID, owner: options?.promptGenerationOwner }
    }
    const key = occurrenceKey(sessionID, inputMessageID)
    const serializedStatus = JSON.stringify(parsedStatus)
    const isCurrentOccurrence = executionOccurrences[sessionID]?.inputMessageID === inputMessageID
    const previousExecutionState = executionStates[sessionID]
    const restoreTerminalAfterPublicationFailure = () => {
      if (parsedStatus.type !== "terminal" || !isCurrentOccurrence) return
      const observed = executionStates[sessionID]
      if (observed?.inputMessageID !== inputMessageID || JSON.stringify(observed.status) !== serializedStatus) {
        return
      }
      if (previousExecutionState) executionStates[sessionID] = previousExecutionState
      else delete executionStates[sessionID]
    }
    const current = isCurrentOccurrence ? executionStates[sessionID]?.status : undefined
    if (current?.type === "terminal") {
      const activePublication = publications[key]
      if (activePublication) {
        if (JSON.stringify(activePublication.status) === serializedStatus) return activePublication.completion
        return activePublication.completion.catch(() => set(sessionID, parsedStatus, options))
      }
      return Promise.resolve()
    }
    if (current && JSON.stringify(current) === serializedStatus) {
      const activePublication = publications[key]
      if (activePublication && JSON.stringify(activePublication.status) === serializedStatus) {
        return activePublication.completion
      }
    }
    if (parsedStatus.type === "idle") {
      if (isCurrentOccurrence) delete executionStates[sessionID]
      if (executionOccurrences[sessionID]?.inputMessageID === inputMessageID) delete activityMonitors[sessionID]
    } else if (isCurrentOccurrence) {
      executionStates[sessionID] = { inputMessageID, status: parsedStatus }
    }
    {
      // Bus subscribers can synchronously re-enter set() with this same fact.
      // During dispatch that nested write must complete immediately; awaiting
      // the outer publication would form a promise cycle through Bus.publish.
      const dispatchingPublication = { status: parsedStatus, completion: Promise.resolve() }
      publications[key] = dispatchingPublication
      let completion!: Promise<void>
      try {
        completion = runAsInstanceActivity(async () => {
          // The publication must be constructed inside the tracked activity.
          // Wrapping an already-started Bus Promise only tracks its lifetime;
          // it cannot retrofit AsyncLocal activity authority onto subscriber
          // continuations. The resolved placeholder remains visible while
          // the activity factory synchronously starts Bus dispatch, so a
          // re-entrant set() cannot await the publication that is waiting for
          // that same subscriber.
          const orderKey = executionLifecycleOrderKey(sessionID, inputMessageID)
          await Bus.publish(Event.Status, {
            sessionID,
            inputMessageID,
            ...(options?.taskID ? { taskID: options.taskID } : {}),
            orderKey,
            status: parsedStatus,
          })
        })
          .then(() => {
            if (publications[key]?.completion === completion) {
              delete publications[key]
            }
          })
          .catch((error) => {
            if (publications[key]?.completion === completion) delete publications[key]
            restoreTerminalAfterPublicationFailure()
            throw error
          })
      } catch (error) {
        if (publications[key] === dispatchingPublication) delete publications[key]
        restoreTerminalAfterPublicationFailure()
        throw error
      }
      publications[key] = { status: parsedStatus, completion }
      // Callers may deliberately publish without awaiting, but publication is
      // still a tracked Instance activity and therefore finishes before its
      // execution lease can close. Awaiting callers receive the same failure.
      void completion.catch(() => undefined)
      return completion
    }
  }

  function requireDurableInputMessage(sessionID: string, inputMessageID: string): void {
    const message = Database.use((db) =>
      db
        .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
        .from(MessageTable)
        .where(eq(MessageTable.id, inputMessageID))
        .get(),
    )
    if (!message || message.sessionID !== sessionID || message.data.role !== "user") {
      throw new Error(`Execution occurrence ${sessionID}/${inputMessageID} is not its durable user message`)
    }
  }
}
