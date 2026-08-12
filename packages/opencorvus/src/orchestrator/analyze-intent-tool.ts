import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { createDecisionLog } from "@/decision-log"
import type { TaskRow } from "@/engine/store"
import {
  buildClarifiedUserRequest,
  clarificationAnswers,
  clarificationToQuestionInfo,
} from "@/intent-analysis/clarified-request"
import { Question } from "@/question"
import { tool } from "ai"
import type { z } from "zod"
import {
  dispatchAdapterContinuationPrompt,
  requireDispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import { Log } from "@/util/log"
import { Database } from "@/storage/db"
import { persistIntentAnalysisArtifact } from "@/engine/persist"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { IntentAnalysisAgent } from "@/intent-analysis/agent"
import { requireTaskOrchestratorToolExecutionContext } from "./tool-execution-context"

const log = Log.create({ service: "analyze-intent-tool" })

type AnalyzeIntentInput = { reason: string; attachment_refs: string[] }

export function createAnalyzeIntentTool<TSchema extends z.ZodType<AnalyzeIntentInput>>(input: {
  inputSchema: TSchema
  taskID: string
  agentSessionID: string
  signal?: AbortSignal
  requireTask: () => TaskRow
  analyzeIntent?: typeof IntentAnalysisAgent.analyze
  persistIntentArtifact?: typeof persistIntentAnalysisArtifact
}) {
  const persistIntentArtifact = input.persistIntentArtifact ?? persistIntentAnalysisArtifact
  return {
    analyze_intent: tool({
      description:
        "Intent-analysis typed-adapter executor for one exact projected agent. It reconstructs the user's real intent from a terse or ambiguous request, existing task evidence, and read-only repository inspection. It persists the classification and routes blocker clarifications through the real question interaction path. The active expert-squad scheduler decides whether and when to invoke it. Use clarified_user_request when returned; never invent dismissed clarification scope.",
      inputSchema: input.inputSchema,
      execute: async ({ reason, attachment_refs }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const toolExecution = await requireTaskOrchestratorToolExecutionContext(execution.toolOptions, "analyze_intent", {
          taskID: input.taskID,
          agentSessionID: input.agentSessionID,
        })
        const task = input.requireTask()
        const agentID = execution.agentID
        let output
        try {
          output = await (input.analyzeIntent ?? IntentAnalysisAgent.analyze)({
            agentID,
            packageRevision: execution.projectedAgent.packageRevision,
            workScope: execution.workScope,
            newSessionID: execution.newSessionID,
            existingSessionID: execution.existingSessionID,
            continuationPrompt: dispatchAdapterContinuationPrompt(execution),
            dispatchTurn: execution.dispatch.turn,
            instruction: reason,
            taskID: input.taskID,
            attachmentRefs: attachment_refs,
            parentSessionID: input.agentSessionID,
            signal: input.signal,
            onStatus: () => {},
            onSessionCreated: async (sessionID) => {
              execution.dispatch.observeSession(sessionID)
            },
            onDispatchAuthorityCommit: (sessionID, descriptor) => execution.dispatch.commitSession(sessionID, descriptor),
          })
        } catch (error) {
          const errorReason = error instanceof Error ? error.message : String(error)
          createDecisionLog(input.taskID).append({
            phase: "intent_analysis",
            key: "abort_intent_analysis_failed",
            value: `Projected agent "${agentID}" aborted via the intent_analysis adapter: ${errorReason.slice(0, 400)}`,
            reason: "intent_analysis_threw",
          })
          throw error
        }

        if (output.outcome === "coordination_handoff") {
          return DispatchOutcome.coordination(output)
        }
        try {
          const result = output.result
          const extractedSlots = result?.extracted_slots ?? output.facts.slots
          const missingInfo = result?.missing_info ?? output.facts.missing
          const clarifications = result?.clarifications ?? output.facts.clarifications
          const blockers = clarifications.filter((item) => item.priority === "blocker")
          let clarificationStatus:
            | "not_required"
            | "rejected"
            | "expired"
            | "answered" = "not_required"
          let clarificationAnswerRows: Array<{
            header: string
            answers: string[]
          }> = []
          let clarificationQuestionID: string | undefined
          let clarifiedUserRequest: string | undefined
          if (blockers.length > 0) {
            const clarification = await Question.askAndFormat({
              sessionID: input.agentSessionID,
              tool: {
                messageID: toolExecution.orchestratorMessageID,
                callID: toolExecution.toolCallID,
              },
              questions: blockers.map(clarificationToQuestionInfo),
            })
            if (clarification.status !== "answered") {
              clarificationStatus = clarification.status
              clarificationQuestionID = clarification.requestID
            } else {
              const answers = clarification.answers
              const answered = clarificationAnswers({ clarifications: blockers, answers })
              clarificationStatus = "answered"
              clarificationAnswerRows = answered.map((row) => ({
                header: row.clarification.header,
                answers: row.answers,
              }))
              clarifiedUserRequest = buildClarifiedUserRequest({ originalRequest: task.request, answers: answered })
            }
          }
          const locator = Database.transaction((db) =>
            persistIntentArtifact(db, {
              taskID: input.taskID,
              sessionID: output.sessionID,
              finalMessageID: output.finalMessageID,
              payload: {
                schema_version: 1,
                producer: {
                  session_id: output.sessionID,
                  final_message_id: output.finalMessageID,
                },
                ...(() => {
                  const provenance = artifactProvenanceForAgentTurn(
                    output.sessionID,
                    output.finalMessageID,
                  )
                  return {
                    observed_artifact_locators: provenance.observedArtifactLocators,
                    source_artifact_locators: provenance.sourceArtifactLocators,
                  }
                })(),
                judgment: output.facts.judgment ?? null,
                slots: extractedSlots,
                missing_info: missingInfo,
                clarifications,
                clarification_outcome: {
                  status: clarificationStatus,
                  answers: clarificationAnswerRows,
                  clarified_user_request: clarifiedUserRequest ?? null,
                },
              },
              now: Date.now(),
            }),
          )
          createDecisionLog(input.taskID).append({
            phase: "intent_analysis",
            key: "intent_analysis_artifact",
            value: JSON.stringify({
              locator,
              clarification_status: clarificationStatus,
            }),
            reason:
              "Canonical Intent Analysis semantics are stored only in the exact Task Artifact locator.",
          })
          if (clarificationStatus === "rejected" || clarificationStatus === "expired") {
            if (!clarificationQuestionID) {
              throw new Error(`Intent blocker ${clarificationStatus} without an exact Question occurrence`)
            }
            return DispatchOutcome.domainBlocked({
              sessionID: output.sessionID,
              finalMessageID: output.finalMessageID,
              domain: "intent_analysis",
              domainArtifact: locator,
              questionID: clarificationQuestionID,
              questionStatus: clarificationStatus,
            })
          }
          return DispatchOutcome.terminal({
            sessionID: output.sessionID,
            finalMessageID: output.finalMessageID,
          })
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          log.error("intent analysis: post-turn persistence failed", {
            taskID: input.taskID,
            sessionID: output.sessionID,
            error: reason,
          })
          const infrastructureObservationRef = recordTaskInfrastructureErrorBestEffort(
            {
              taskID: input.taskID,
              component: "intent-analysis",
              operation: "persist-intent-analysis-artifact",
              reason,
              errorName: error instanceof Error ? error.name : undefined,
              sessionID: output.sessionID,
              now: Date.now(),
            },
            {
              onFailure: (observationError) =>
                log.error("intent analysis persistence observation also failed", {
                  taskID: input.taskID,
                  sessionID: output.sessionID,
                  error: observationError instanceof Error ? observationError.message : String(observationError),
                }),
            },
          )
          return DispatchOutcome.partial({
            sessionID: output.sessionID,
            finalMessageID: output.finalMessageID,
            failedOperation: "persist-intent-analysis-artifact",
            infrastructureError: infrastructureObservationRef,
          })
        }
      },
    }),
  }
}
