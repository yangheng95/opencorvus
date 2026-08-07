import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { createDecisionLog } from "@/decision-log"
import { persistGoalWorkloadForDomainRefs } from "@/engine/persist"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import { tool } from "ai"
import type { z } from "zod"
import {
  dispatchAdapterContinuationPrompt,
  requireDispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { GoalWorkloadAnalystAgent } from "@/goal-workload-analyst/agent"

const log = Log.create({ service: "workload-analysis-tool" })

type WorkloadAnalysisInput = { reason: string; goal_ids: string[] }

export function createWorkloadAnalysisTool<TSchema extends z.ZodType<WorkloadAnalysisInput>>(input: {
  inputSchema: TSchema
  taskID: string
  agentSessionID: string
  signal?: AbortSignal
}) {
  return {
    workload_analysis: tool({
      description:
        "Optional read-only workload-analysis adapter. It reads the exact goal_ids as Delivery Slice revision subjects and independently discovers relevant Task Artifacts, then produces a per-Slice " +
        "workload brief: countable work surface, why-it-is-not-smaller, underestimation traps, a " +
        "verification inventory, and a `decomposition_concern` when a Slice contract is too broad or " +
        "under-specified to provide an unambiguous delivery and acceptance subject. It is an independent sizing reviewer with no " +
        "implementation bias — it never writes code and never creates / modifies / splits Slices. Workflow nodes still execute once per Task.\n\n" +
        "Missing selected specs, Delivery Slices, or Artifacts are visible input facts for the specialist, not Host admission gates. Empty ref lists never expand to Task-latest facts. The active expert-squad package decides when and how to use the resulting evidence.",
      inputSchema: input.inputSchema,
      execute: async ({ reason, goal_ids }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const agentID = execution.agentID

        let completedTurn: { sessionID: string; finalMessageID: string } | undefined
        try {
          const result = await GoalWorkloadAnalystAgent.analyze({
            agentID,
            packageRevision: execution.projectedAgent.packageRevision,
            workScope: execution.workScope,
            newSessionID: execution.newSessionID,
            existingSessionID: execution.existingSessionID,
            continuationPrompt: dispatchAdapterContinuationPrompt(execution),
            dispatchTurn: execution.dispatch.turn,
            instruction: reason,
            goalIDs: goal_ids,
            taskID: input.taskID,
            parentSessionID: input.agentSessionID,
            signal: input.signal,
            onSessionCreated: async (sessionID) => {
              execution.dispatch.observeSession(sessionID)
            },
            onDispatchAuthorityCommit: (sessionID, descriptor) => execution.dispatch.commitSession(sessionID, descriptor),
          })
          if (isAgentCoordinationHandoffResult(result)) {
            return DispatchOutcome.coordination(result)
          }
          completedTurn = {
            sessionID: result.sessionID,
            finalMessageID: result.finalMessageID,
          }
          const provenance = artifactProvenanceForAgentTurn(result.sessionID, result.finalMessageID)
          Database.use((db) =>
            persistGoalWorkloadForDomainRefs(db, {
              taskID: input.taskID,
              sessionID: result.sessionID,
              finalMessageID: result.finalMessageID,
              observedArtifactLocators: provenance.observedArtifactLocators,
              sourceArtifactLocators: provenance.sourceArtifactLocators,
              briefs: result.briefs,
              now: Date.now(),
            }),
          )
          return DispatchOutcome.terminal({
            sessionID: result.sessionID,
            finalMessageID: result.finalMessageID,
          })
        } catch (error) {
          const failureReason = error instanceof Error ? error.message : String(error)
          if (completedTurn) {
            log.error("workload analysis: post-turn persistence failed", {
              taskID: input.taskID,
              sessionID: completedTurn.sessionID,
              error: failureReason,
            })
            const infrastructureObservationRef = recordTaskInfrastructureErrorBestEffort(
              {
                taskID: input.taskID,
                component: "workload-analysis",
                operation: "persist-workload-brief",
                reason: failureReason,
                errorName: error instanceof Error ? error.name : undefined,
                sessionID: completedTurn.sessionID,
                now: Date.now(),
              },
              {
                onFailure: (observationError) =>
                  log.error("workload analysis persistence observation also failed", {
                    taskID: input.taskID,
                    sessionID: completedTurn?.sessionID,
                    error: observationError instanceof Error ? observationError.message : String(observationError),
                  }),
              },
            )
            return DispatchOutcome.partial({
              sessionID: completedTurn.sessionID,
              finalMessageID: completedTurn.finalMessageID,
              failedOperation: "persist-workload-brief",
              infrastructureError: infrastructureObservationRef,
            })
          }
          createDecisionLog(input.taskID).append({
            phase: "workload_analysis",
            key: "abort_workload_analysis_failed",
            value: `Projected agent "${agentID}" aborted via the workload_analysis adapter: ${failureReason.slice(0, 400)}`,
            reason: "workload_analysis_threw",
          })
          throw error
        }
      },
    }),
  }
}
