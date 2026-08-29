import { createTaskCancellationIncomplete } from "@/engine/cancellation-error"
import type { TaskCancellationOrigin } from "@/engine/cancellation-origin"
import { awaitSessionPromptFinishedInScope, cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { listMissionTasks } from "@/engine/store"
import { deriveTaskStatus } from "@/engine/task-status"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { EngineService } from "@/task-api"
import {
  closeMissionExecutionOperation,
  currentMissionExecutionClosure,
  MissionExecutionCloseSource,
  resumeMissionExecutionClosingOperation,
  type MissionExecutionClosure,
} from "./execution-closure"
import { requireMissionSession, type MissionSession } from "./session"
import {
  TaskCancellationRequestBody,
  type TaskCancellationRequestBody as TaskCancellationRequestBodyValue,
} from "@opencorvus-ai/transport-protocol"

function missionCancellationOrigin(
  session: MissionSession,
  source: MissionExecutionCloseSource,
  requestID: string,
  provenance: TaskCancellationRequestBodyValue,
): TaskCancellationOrigin {
  return {
    actor: "user",
    source,
    surface: provenance.surface,
    requestID,
    reason: provenance.reason,
    sessionID: session.id,
    missionID: session.missionID,
  }
}

async function convergeMissionExecutionClose(input: {
  session: MissionSession
  closure: MissionExecutionClosure
  signal: AbortSignal
}): Promise<void> {
  const source = MissionExecutionCloseSource.parse(input.closure.source)
  const provenance = TaskCancellationRequestBody.parse(input.closure.cancellation)
  const cancellationOrigin = missionCancellationOrigin(input.session, source, input.closure.requestID, provenance)
  const failures: string[] = []
  try {
    const origin = createExecutionCancellationOrigin({
      actor: cancellationOrigin.actor,
      source: cancellationOrigin.source,
      surface: cancellationOrigin.surface,
      requestID: cancellationOrigin.requestID,
      reason: cancellationOrigin.reason,
      targetSessionID: input.session.id,
      missionID: cancellationOrigin.missionID,
    })
    cancelSessionPromptInScope({
      session: input.session,
      handle: source,
      origin,
      settleBeforeReuse: true,
    })
  } catch (error) {
    failures.push(`mission ${input.session.missionID}: ${error instanceof Error ? error.message : String(error)}`)
  }

  const childTasks = listMissionTasks({
    projectID: input.session.projectID,
    missionID: input.session.missionID,
    sessionID: input.session.id,
  }).filter((task) => deriveTaskStatus(task) === "active")
  for (const task of childTasks) {
    try {
      input.signal.throwIfAborted()
      await EngineService.cancelTask(task.id, { origin: cancellationOrigin })
    } catch (error) {
      failures.push(`task ${task.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  try {
    await awaitSessionPromptFinishedInScope({
      session: input.session,
      handle: source,
      publishTerminalStatus: source === "mission.abort",
      signal: input.signal,
    })
  } catch (error) {
    failures.push(`mission ${input.session.missionID}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (failures.length > 0) {
    throw createTaskCancellationIncomplete({
      handle: source,
      cause: new Error(failures.join("; ")),
    })
  }
}

export async function closeMissionExecution(
  session: MissionSession,
  source: MissionExecutionCloseSource,
  requestID: string,
  inputProvenance: TaskCancellationRequestBodyValue,
): Promise<TaskCancellationOrigin> {
  const provenance = TaskCancellationRequestBody.parse(inputProvenance)
  const cancellationOrigin = missionCancellationOrigin(session, source, requestID, provenance)
  await closeMissionExecutionOperation({
    missionID: session.missionID,
    sessionID: session.id,
    source,
    requestID,
    provenance,
    close: async (signal) => {
      const closure = currentMissionExecutionClosure(session.id)
      if (!closure || closure.state !== "closing") {
        throw new Error(`Mission execution close ${session.id} lost its exact closing occurrence`)
      }
      await convergeMissionExecutionClose({ session, closure, signal })
    },
  })
  return cancellationOrigin
}

export async function recoverMissionExecutionClosing(sessionID: string) {
  const session = await requireMissionSession(sessionID)
  return resumeMissionExecutionClosingOperation({
    sessionID,
    close: async (signal) => {
      const closure = currentMissionExecutionClosure(sessionID)
      if (!closure || closure.state !== "closing") {
        throw new Error(`Mission execution recovery ${sessionID} lost its exact closing occurrence`)
      }
      await convergeMissionExecutionClose({ session, closure, signal })
    },
  })
}
