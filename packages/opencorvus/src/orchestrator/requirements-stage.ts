import { DispatchOutcome, type DispatchOutcome as DispatchOutcomeResult } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { createDecisionLog } from "@/decision-log"
import { Event as EngineEvent } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { listRequirementSetArtifacts, type TaskRow } from "@/engine/store"
import { updateTask } from "@/engine/state"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import { RequirementsAgent } from "@/requirements/agent"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"

const log = Log.create({ service: "requirements-stage" })

type RequirementsStageDependencies = {
  taskID: string
  parentSessionID: string
  signal?: AbortSignal
  runRequirements?: typeof RequirementsAgent.run
}

type RequirementsStageDispatch = {
  task: TaskRow
  reason?: string
  attachmentRefs: string[]
  agentID: string
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
  workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
  newSessionID?: string
  existingSessionID?: string
  continuationPrompt?: string
  dispatchTurn?: import("./dispatch-turn-projection").DispatchTurn
  onSessionCreated?: (sessionID: string) => void | Promise<void>
  onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
  onRuntimeReady?: (sessionID: string) => void | Promise<void>
}

export function createRequirementsStageDispatcher(dependencies: RequirementsStageDependencies) {
  const runRequirements = dependencies.runRequirements ?? RequirementsAgent.run
  return async function dispatchRequirementsStage(
    dispatch: RequirementsStageDispatch,
  ): Promise<DispatchOutcomeResult> {
    let task = dispatch.task
    log.info("requirements guard check", {
      taskID: dependencies.taskID,
      requirementSetCount: listRequirementSetArtifacts(task.id).length,
    })
    task = await updateTask(
      task,
      { status: "active" },
      `Projected agent "${dispatch.agentID}" started via the requirements adapter`,
    )
    try {
      const result = await runRequirements({
        agentID: dispatch.agentID,
        packageRevision: dispatch.packageRevision,
        workScope: dispatch.workScope,
        newSessionID: dispatch.newSessionID,
        existingSessionID: dispatch.existingSessionID,
        continuationPrompt: dispatch.continuationPrompt,
        dispatchTurn: dispatch.dispatchTurn,
        instruction:
          dispatch.reason ??
          "Discover the Task evidence catalog and extract requirements from the original request plus exact facts you read.",
        attachmentRefs: dispatch.attachmentRefs,
        taskID: dependencies.taskID,
        parentSessionID: dependencies.parentSessionID,
        signal: dependencies.signal,
        onStatus: () => {},
        onSessionCreated: async (sessionID) => {
          await dispatch.onSessionCreated?.(sessionID)
        },
        onDispatchAuthorityCommit: dispatch.onDispatchAuthorityCommit,
        onRuntimeReady: dispatch.onRuntimeReady,
      })
      if (isAgentCoordinationHandoffResult(result)) {
        return DispatchOutcome.coordination(result)
      }

      const now = Date.now()
      try {
        const { persistRequirementSet } = await import("@/engine/persist")
        const publication = Database.transaction((db) => {
          const persisted = persistRequirementSet(db, {
            taskID: dependencies.taskID,
            sessionID: result.sessionID,
            finalMessageID: result.finalMessageID,
            dispatchID: dispatch.dispatchTurn?.current_dispatch_id ?? (() => {
              throw new Error("Requirements persistence requires the current dispatch occurrence identity.")
            })(),
            requirementSet: {
              requirements: result.requirements,
              decisions: result.decisions,
            },
            finalization: result.finalization,
            now,
          })
          Database.effect(() =>
            EngineProtocol.emit(
              EngineEvent.TaskUpdated,
              {
                taskID: dependencies.taskID,
                summary: `Projected agent "${dispatch.agentID}" persisted requirements via the requirements adapter`,
              },
              { source: "orchestrator.requirements" },
            ),
          )
          return persisted
        })
        if (publication.deliveryStatus === "incomplete") {
          return DispatchOutcome.domainIncomplete({
            sessionID: result.sessionID,
            finalMessageID: result.finalMessageID,
            domain: "requirements",
            domainArtifact: publication.locator,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error("requirements: failed to persist to DB", {
          taskID: dependencies.taskID,
          error: message,
          stack: error instanceof Error ? error.stack : undefined,
        })
        const infrastructureObservationRef = recordTaskInfrastructureErrorBestEffort(
          {
            taskID: dependencies.taskID,
            component: "requirements",
            operation: "persist_requirement_set",
            reason: message,
            errorName: error instanceof Error ? error.name : undefined,
            sessionID: result.sessionID,
            now: Date.now(),
          },
          {
            onFailure: (observationError) =>
              log.error("requirements persistence observation also failed", {
                taskID: dependencies.taskID,
                sessionID: result.sessionID,
                error: observationError instanceof Error ? observationError.message : String(observationError),
              }),
          },
        )
        return DispatchOutcome.partial({
          sessionID: result.sessionID,
          finalMessageID: result.finalMessageID,
          failedOperation: "persist_requirement_set",
          infrastructureError: infrastructureObservationRef,
        })
      }
      return DispatchOutcome.terminal({
        sessionID: result.sessionID,
        finalMessageID: result.finalMessageID,
      })
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error)
      createDecisionLog(dependencies.taskID).append({
        phase: "requirements",
        key: "abort_requirements_failed",
        value: `Projected agent "${dispatch.agentID}" aborted via the requirements adapter: ${failureReason.slice(0, 400)}`,
        reason: "requirements_threw",
      })
      throw error
    }
  }
}
