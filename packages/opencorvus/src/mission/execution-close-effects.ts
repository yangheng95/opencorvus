import { awaitSessionPromptFinishedInScope, cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { createTaskCancellationIncomplete } from "@/engine/cancellation-error"
import type { TaskCancellationOrigin } from "@/engine/cancellation-origin"
import { listActiveMissionTaskIDsPageInTransaction } from "@/engine/store"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { SessionPromptState } from "@/session/prompt/state"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { Database, and, desc, eq, lt } from "@/storage/db"
import { Identifier } from "@/id/id"
import { Session } from "@/session"
import { awaitWithAbort } from "@/util/abort"
import { requireMissionSession } from "./session"
import type { MissionExecutionClosure } from "./execution-closure"
import {
  readActionableMissionProcessRecoveryWake,
  readIncompleteMissionAssistantMessageIDs,
} from "./process-recovery-facts"

const MISSION_CHILD_CANCELLATION_CONCURRENCY = 4
let beforeChildTaskCancellationForTest: ((taskID: string) => void | Promise<void>) | undefined
type RecoveredAssistantTerminalizer = (
  sessionID: string,
  signal?: AbortSignal,
  exactMessages?: readonly { messageID: string; completedAt: number }[],
) => Promise<boolean>
type MissionChildTaskCanceller = (taskID: string, origin: TaskCancellationOrigin) => Promise<boolean>
let recoveredAssistantTerminalizer: RecoveredAssistantTerminalizer | undefined
let missionChildTaskCanceller: MissionChildTaskCanceller | undefined

function requireRecoveredAssistantTerminalizer(): RecoveredAssistantTerminalizer {
  if (!recoveredAssistantTerminalizer) {
    throw new Error("Mission close assistant terminalizer is not bound by Session runtime bootstrap")
  }
  return recoveredAssistantTerminalizer
}

function requireMissionChildTaskCanceller(): MissionChildTaskCanceller {
  if (!missionChildTaskCanceller) {
    throw new Error("Mission close child Task canceller is not bound by Task runtime bootstrap")
  }
  return missionChildTaskCanceller
}

export function bindMissionClosingAssistantTerminalizer(terminalizer: RecoveredAssistantTerminalizer): void {
  recoveredAssistantTerminalizer = terminalizer
}

export function bindMissionClosingChildTaskCanceller(canceller: MissionChildTaskCanceller): void {
  missionChildTaskCanceller = canceller
}

function cancellationOrigin(
  closure: Extract<MissionExecutionClosure, { state: "closing" | "closed" }>,
): TaskCancellationOrigin {
  return {
    actor: "user",
    source: closure.source,
    surface: closure.provenance.surface,
    requestID: closure.requestID,
    reason: closure.provenance.reason,
    sessionID: closure.sessionID,
    missionID: closure.missionID,
  }
}

async function settleMissionPrompt(input: {
  closure: Extract<MissionExecutionClosure, { state: "closing" }>
  signal: AbortSignal
}): Promise<void> {
  const session = await requireMissionSession(input.closure.sessionID)
  const origin = cancellationOrigin(input.closure)
  const executionOrigin = createExecutionCancellationOrigin({
    actor: origin.actor,
    source: origin.source,
    surface: origin.surface,
    requestID: origin.requestID,
    reason: origin.reason,
    targetSessionID: session.id,
    missionID: origin.missionID,
  })

  cancelSessionPromptInScope({
    session,
    handle: input.closure.source,
    origin: executionOrigin,
    settleBeforeReuse: true,
  })
  await awaitSessionPromptFinishedInScope({
    session,
    handle: input.closure.source,
    publishTerminalStatus: input.closure.source === "mission.abort",
    signal: input.signal,
  })

  while (true) {
    input.signal.throwIfAborted()
    const owner = SessionPromptOwner.current(session.id)
    if (!owner) return
    const observation = SessionPromptOwner.observation(owner)
    if (observation === "dead_or_reused") {
      await requireRecoveredAssistantTerminalizer()(session.id, input.signal)
      if (!SessionPromptOwner.release(owner)) {
        throw createTaskCancellationIncomplete({
          handle: input.closure.source,
          cause: new Error(`Mission ${input.closure.missionID} Prompt owner changed during dead-owner settlement`),
        })
      }
      return
    }
    if (SessionPromptState.hasOwnedPrompt(session.id, session.directory)) {
      await awaitSessionPromptFinishedInScope({
        session,
        handle: input.closure.source,
        publishTerminalStatus: input.closure.source === "mission.abort",
        signal: input.signal,
      })
      continue
    }
    await awaitWithAbort(new Promise<void>((resolve) => setTimeout(resolve, 100)), input.signal)
  }
}

async function settleMissionProcessRecoveryWake(input: {
  closure: Extract<MissionExecutionClosure, { state: "closing" }>
  signal: AbortSignal
}): Promise<void> {
  input.signal.throwIfAborted()
  const occurrence = Database.use((db) => {
    const closing = db
      .select({ seq: ProtocolEventTable.seq, emittedAt: ProtocolEventTable.emitted_at })
      .from(ProtocolEventTable)
      .where(eq(ProtocolEventTable.id, input.closure.eventID))
      .get()
    if (!closing) throw new Error(`Mission closing event ${input.closure.eventID} disappeared before recovery settlement`)
    const opened = db
      .select({ id: ProtocolEventTable.id })
      .from(ProtocolEventTable)
      .where(
        and(
          eq(ProtocolEventTable.aggregate_type, "session"),
          eq(ProtocolEventTable.aggregate_id, input.closure.sessionID),
          eq(ProtocolEventTable.type, "mission.execution.opened"),
          lt(ProtocolEventTable.seq, closing.seq),
        ),
      )
      .orderBy(desc(ProtocolEventTable.seq), desc(ProtocolEventTable.id))
      .limit(1)
      .get()
    return { openedEventID: opened?.id, terminalAt: closing.emittedAt }
  })
  if (!occurrence.openedEventID) return
  const recovery = readActionableMissionProcessRecoveryWake({
    sessionID: input.closure.sessionID,
    missionID: input.closure.missionID,
    openedEventID: occurrence.openedEventID,
  })
  if (!recovery) return

  const incompleteFrontier = readIncompleteMissionAssistantMessageIDs(
    input.closure.sessionID,
    recovery.reason.interruptedAssistantMessageIDs,
  )
  if (incompleteFrontier.length > 0) {
    await requireRecoveredAssistantTerminalizer()(
      input.closure.sessionID,
      input.signal,
      incompleteFrontier.map((messageID) => ({ messageID, completedAt: occurrence.terminalAt })),
    )
  }
  if (
    readIncompleteMissionAssistantMessageIDs(
      input.closure.sessionID,
      recovery.reason.interruptedAssistantMessageIDs,
    ).length > 0
  ) {
    throw new Error(
      `Mission ${input.closure.missionID} recovery frontier remained incomplete during close ${input.closure.eventID}`,
    )
  }

  const persisted = await MessageStore.get({
    sessionID: input.closure.sessionID,
    messageID: recovery.messageID,
  })
  if (persisted.info.role !== "user") {
    throw new Error(`Mission recovery Message ${recovery.messageID} changed participant role during close`)
  }
  const session = await requireMissionSession(input.closure.sessionID)
  const origin = cancellationOrigin(input.closure)
  const cancellation = createExecutionCancellationOrigin({
    actor: origin.actor,
    source: origin.source,
    surface: origin.surface,
    requestID: origin.requestID,
    reason: origin.reason,
    targetSessionID: session.id,
    missionID: origin.missionID,
    messageID: recovery.messageID,
  })
  const error = new Message.AbortedError({
    message: `Mission ${input.closure.missionID} recovery wake ${recovery.messageID} was settled by close ${input.closure.eventID}`,
    cancellation,
  }).toObject()
  await Session.beginAssistantReply({
    id: Identifier.deterministic(
      "message",
      `mission-recovery-close-settlement-v1\0${recovery.messageID}\0${input.closure.eventID}`,
    ),
    sessionID: session.id,
    role: "assistant",
    author: persisted.info.agent,
    agent: persisted.info.agent,
    parentID: recovery.messageID,
    acceptedInputMessageIDs: [recovery.messageID],
    providerID: persisted.info.model.providerID,
    modelID: persisted.info.model.modelID,
    ...(persisted.info.variant ? { variant: persisted.info.variant } : {}),
    path: { cwd: session.directory, root: session.directory },
    time: { created: occurrence.terminalAt, completed: occurrence.terminalAt },
    finish: "error",
    error,
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  })
}

export async function executeMissionClosingEffects(input: {
  closure: Extract<MissionExecutionClosure, { state: "closing" }>
  signal: AbortSignal
}): Promise<void> {
  input.signal.throwIfAborted()
  const session = await requireMissionSession(input.closure.sessionID)
  const origin = cancellationOrigin(input.closure)

  await settleMissionPrompt(input)
  input.signal.throwIfAborted()

  await settleMissionProcessRecoveryWake(input)
  input.signal.throwIfAborted()

  let afterTaskID: string | undefined
  while (true) {
    input.signal.throwIfAborted()
    const childTaskIDs = Database.use((db) =>
      listActiveMissionTaskIDsPageInTransaction(db, {
        projectID: session.projectID,
        missionID: session.missionID,
        sessionID: session.id,
        afterTaskID,
        limit: MISSION_CHILD_CANCELLATION_CONCURRENCY,
      }),
    )
    if (childTaskIDs.length === 0) return
    const settled = await Promise.allSettled(
      childTaskIDs.map(async (taskID) => {
        await beforeChildTaskCancellationForTest?.(taskID)
        await awaitWithAbort(requireMissionChildTaskCanceller()(taskID, origin), input.signal)
      }),
    )
    const failures = settled.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (failures.length > 0) {
      throw createTaskCancellationIncomplete({
        handle: input.closure.source,
        cause: new AggregateError(
          failures,
          `Mission ${input.closure.missionID} child Task cancellation did not converge`,
        ),
      })
    }
    afterTaskID = childTaskIDs.at(-1)
  }
}

export const MissionClosingEffectsTestHooks = {
  installBeforeChildTaskCancellation(hook: (taskID: string) => void | Promise<void>): Disposable {
    if (beforeChildTaskCancellationForTest) {
      throw new Error("Mission child Task cancellation hook is already installed")
    }
    beforeChildTaskCancellationForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeChildTaskCancellationForTest === hook) beforeChildTaskCancellationForTest = undefined
      },
    }
  },
}
