import { boardStore, activeTaskID, loadBoard } from "../store/board"
import {
  cancelConversationReplay,
  conversationSourceDirectory,
  hydrateTaskConversation,
  mergeLatestConversationTail,
} from "./conversation"
import { resetSelectedLiveCursor } from "./selected-stream-cursor"
import {
  recordConversationRecoveryAborted,
  recordConversationRecoveryFailed,
  recordConversationRecoveryStarted,
  recordConversationRecoverySucceeded,
} from "./refresh-diagnostics"
import { formatErrorDetails } from "./diagnostics"
import { AppLog } from "../utils/log"

let recoveryGeneration = 0
let recoveryAbort: AbortController | null = null
let rewindClearTaskID = ""
let rewindClearPromise: Promise<number> | null = null

export interface SelectedTaskRecoveryOptions {
  requireFreshBoard?: boolean
}

export type RestartSelectedTaskStream = (
  source: { kind: "task"; id: string },
  after: number,
  options: { replayLive?: boolean; directory: string },
) => void

export interface SelectedTaskRecoveryScheduler {
  recoverConversation(reason: string, taskID: string, options?: SelectedTaskRecoveryOptions): Promise<number>
  recoverAfterRewindClear(reason: string, taskID: string): Promise<number>
}

export function createSelectedTaskRecoveryScheduler(
  restartStream: RestartSelectedTaskStream,
): SelectedTaskRecoveryScheduler {
  return {
    recoverConversation: (reason, taskID, options) =>
      recoverSelectedTaskConversation(reason, taskID, restartStream, options),
    recoverAfterRewindClear: (reason, taskID) => recoverSelectedTaskAfterRewindClear(reason, taskID, restartStream),
  }
}

function abortError(message: string): DOMException {
  return new DOMException(message, "AbortError")
}

function assertCurrentRecovery(taskID: string, generation: number, signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? abortError("Selected task recovery aborted")
  if (generation !== recoveryGeneration) throw abortError("Selected task recovery superseded")
  if (activeTaskID() !== taskID) throw abortError("Selected task recovery task changed")
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "")
}

function isAbortLike(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}

function reportRecoveryFailure(input: { channel: string; reason: string; taskID: string; error: unknown }): void {
  const title =
    input.channel === "rewind-clear" ? "Conversation rewind recovery failed" : "Conversation recovery failed"
  AppLog.error("conversation", `${input.channel} recovery failed for ${input.taskID}`, {
    taskID: input.taskID,
    reason: input.reason,
    error: formatErrorDetails(input.error),
    diagnosticID: `conversation:${input.channel}-recovery-failed:${input.taskID}`,
    diagnosticTitle: title,
    diagnosticMessage: `OpenCorvus could not recover the conversation for task ${input.taskID}.`,
    diagnosticDetails: formatErrorDetails(input.error),
  })
}

function resumeSequence(): number {
  return Math.max(0, Math.floor(Number(boardStore.taskSequence) || 0))
}

function cannotReplayWithoutFullRefresh(reason: string): boolean {
  const normalized = reason.trim().toLowerCase()
  return (
    normalized === "task.replay_expired" ||
    (normalized.includes("replay expired") && !isLiveReplayExpiredReason(reason))
  )
}

function isLiveReplayExpiredReason(reason: string): boolean {
  const normalized = reason.trim().toLowerCase()
  return normalized === "task.live_replay_expired" || normalized.includes("live replay expired")
}

export async function recoverSelectedTaskConversation(
  reason: string,
  requestedTaskID: string,
  restartStream: RestartSelectedTaskStream,
  options: SelectedTaskRecoveryOptions = {},
): Promise<number> {
  const taskID = String(requestedTaskID || "")
  if (!taskID) throw new Error(`selected-task recovery requires a taskID: ${reason}`)
  if (activeTaskID() !== taskID) {
    throw abortError("Selected task recovery task changed")
  }
  if (rewindClearPromise && rewindClearTaskID === taskID) {
    return rewindClearPromise
  }

  recoveryAbort?.abort(abortError("Selected task recovery superseded"))
  const controller = new AbortController()
  recoveryAbort = controller
  const generation = ++recoveryGeneration
  const startedAt = Date.now()

  recordConversationRecoveryStarted({
    channel: "selected-task-recovery",
    reason,
    taskID,
    source: "selected-task-recovery",
  })

  try {
    assertCurrentRecovery(taskID, generation, controller.signal)
    const sequence = resumeSequence()
    if (cannotReplayWithoutFullRefresh(reason)) {
      throw new Error(`Selected task recovery refused full conversation refresh after load: ${reason}`)
    }
    const replayLive = !isLiveReplayExpiredReason(reason)
    const directory = conversationSourceDirectory({ kind: "task", id: taskID })
    if (!replayLive) resetSelectedLiveCursor()
    if (replayLive) cancelConversationReplay()
    if (options.requireFreshBoard === true) {
      await loadBoard({ sync: true, requireFresh: true })
      assertCurrentRecovery(taskID, generation, controller.signal)
    }
    if (!replayLive) {
      await mergeLatestConversationTail(taskID, { directory, signal: controller.signal })
      assertCurrentRecovery(taskID, generation, controller.signal)
    }
    restartStream({ kind: "task", id: taskID }, sequence, { replayLive, directory })
    recordConversationRecoverySucceeded({
      channel: "selected-task-recovery",
      reason,
      taskID,
      source: "selected-task-recovery",
      durationMs: Date.now() - startedAt,
      resumeSequence: sequence,
    })
    return sequence
  } catch (error) {
    const input = {
      channel: "selected-task-recovery",
      reason,
      taskID,
      source: "selected-task-recovery",
      durationMs: Date.now() - startedAt,
      error: errorMessage(error),
    }
    if (isAbortLike(error)) {
      recordConversationRecoveryAborted(input)
    } else {
      recordConversationRecoveryFailed(input)
      reportRecoveryFailure({ channel: "selected-task", reason, taskID, error })
    }
    throw error
  } finally {
    if (recoveryAbort === controller) recoveryAbort = null
  }
}

export async function recoverSelectedTaskAfterRewindClear(
  reason: string,
  requestedTaskID: string,
  restartStream: RestartSelectedTaskStream,
): Promise<number> {
  const taskID = String(requestedTaskID || "")
  if (!taskID) throw new Error(`rewind clear recovery requires a taskID: ${reason}`)
  if (activeTaskID() !== taskID) {
    throw abortError("Rewind clear recovery task changed")
  }
  if (rewindClearPromise && rewindClearTaskID === taskID) {
    return rewindClearPromise
  }

  recoveryAbort?.abort(abortError("Selected task recovery superseded"))
  const controller = new AbortController()
  recoveryAbort = controller
  const generation = ++recoveryGeneration
  const startedAt = Date.now()
  rewindClearTaskID = taskID

  recordConversationRecoveryStarted({
    channel: "rewind-clear",
    reason,
    taskID,
    source: "selected-task-recovery",
  })

  let run: Promise<number>
  run = (async () => {
    try {
      assertCurrentRecovery(taskID, generation, controller.signal)
      resetSelectedLiveCursor()
      const directory = conversationSourceDirectory({ kind: "task", id: taskID })
      const sequence = await hydrateTaskConversation(taskID, {
        signal: controller.signal,
        scrollIntent: "bottom",
        resetCause: "task-rewind-clear",
        directory,
      })
      assertCurrentRecovery(taskID, generation, controller.signal)
      restartStream({ kind: "task", id: taskID }, sequence, { directory })
      recordConversationRecoverySucceeded({
        channel: "rewind-clear",
        reason,
        taskID,
        source: "selected-task-recovery",
        durationMs: Date.now() - startedAt,
        resumeSequence: sequence,
      })
      return sequence
    } catch (error) {
      const input = {
        channel: "rewind-clear",
        reason,
        taskID,
        source: "selected-task-recovery",
        durationMs: Date.now() - startedAt,
        error: errorMessage(error),
      }
      if (isAbortLike(error)) {
        recordConversationRecoveryAborted(input)
      } else {
        recordConversationRecoveryFailed(input)
        reportRecoveryFailure({ channel: "rewind-clear", reason, taskID, error })
      }
      throw error
    } finally {
      if (recoveryAbort === controller) recoveryAbort = null
      if (rewindClearPromise === run) {
        rewindClearPromise = null
        rewindClearTaskID = ""
      }
    }
  })()
  rewindClearPromise = run
  return run
}
