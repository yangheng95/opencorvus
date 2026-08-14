import { tool } from "ai"
import type z from "zod"
import {
  dispatchAdapterContinuationPrompt,
  requireDispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import type { FactCheckReview } from "@/fact-check/schema"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { Log } from "@/util/log"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { FactCheckAgent } from "@/fact-check"
import { resolveDispatchOccurrenceAuthority } from "@/engine/dispatch-lineage"

const log = Log.create({ service: "fact-check-tool" })

export type FactCheckToolInput = {
  target_session_id: string
  target_message_id: string
  target_agent?: string
  reason: string
}

export type FactCheckStageInput = {
  target_session_id: string
  target_agent: string
  reason: string
  target_message_id: string
  target_message_content_hash: string
}

export type FactCheckToolDependencies = {
  inputSchema: z.ZodType<FactCheckToolInput>
  stageInputSchema: z.ZodType<FactCheckStageInput>
  taskID: string
  orchestratorSessionID: string
  signal?: AbortSignal
  requireTask(): { id: string }
  resolveTargetScope(input: {
    taskID: string
    targetSessionID: string
    targetMessageID: string
    assertedTargetAgent?: string
  }): Promise<{ targetAgent: string; targetMessageID: string; targetMessageContentHash: string } | { error: string }>
  runFactCheck?: typeof FactCheckAgent.run
}

export function renderFactCheckReview(review: FactCheckReview): string {
  const sections: string[] = []
  sections.push(
    `**scope**: target_session=\`${review.scope.target_session_id}\` agent=\`${review.scope.target_agent}\` ` +
      `items=${review.scope.items_inspected}/${review.scope.items_total} verdict=\`${review.overall_verdict}\``,
  )
  if (review.corrected.length > 0) {
    sections.push(
      `### Corrected (${review.corrected.length})\n` +
        review.corrected
          .map(
            (item, index) =>
              `${index + 1}. [${item.severity}] ${item.claim}\n` +
              `   → **${item.correction}**\n` +
              `   impact: ${item.impact}\n` +
              item.evidence
                .map((evidence) => `   - [${evidence.kind}] ${evidence.pointer}: ${evidence.excerpt.slice(0, 240)}`)
                .join("\n"),
          )
          .join("\n\n"),
    )
  }
  if (review.unresolved.length > 0) {
    sections.push(
      `### Unresolved (${review.unresolved.length})\n` +
        review.unresolved
          .map((item, index) => `${index + 1}. [${item.severity}, ${item.why_unresolved}] ${item.claim}`)
          .join("\n"),
    )
  }
  if (review.verified.length > 0) {
    sections.push(
      `### Verified (${review.verified.length})\n` +
        review.verified
          .map(
            (item, index) =>
              `${index + 1}. ${item.claim}\n` +
              item.evidence
                .map((evidence) => `   - [${evidence.kind}] ${evidence.pointer}: ${evidence.excerpt.slice(0, 240)}`)
                .join("\n"),
          )
          .join("\n\n"),
    )
  }
  return sections.join("\n\n")
}

function factCheckReviewScopeMatchesTarget(
  review: FactCheckReview,
  target: FactCheckStageInput,
): boolean {
  return (
    review.scope.target_session_id === target.target_session_id &&
    review.scope.target_agent === target.target_agent &&
    review.scope.target_message_id === target.target_message_id &&
    review.scope.target_message_content_hash === target.target_message_content_hash
  )
}

export function createFactCheckTool(dependencies: FactCheckToolDependencies) {
  const runFactCheck = dependencies.runFactCheck ?? FactCheckAgent.run
  return tool({
    description:
      "Ask a projected fact-check agent to inspect factual claims from a visible assistant message or domain artifact. " +
      "The streamed child Turn may finish naturally, but Fact Check domain completion requires one valid FactCheckReview Artifact. " +
      "A Turn without that review settles as durable domain-incomplete evidence and never opens workflow successors.",
    inputSchema: dependencies.inputSchema,
    execute: async (args, executionInput) => {
      const execution = requireDispatchAdapterExecutionContext(executionInput)
      const task = dependencies.requireTask()
      const factCheckAgentName = execution.agentID
      const targetScope = await dependencies.resolveTargetScope({
        taskID: task.id,
        targetSessionID: args.target_session_id,
        targetMessageID: args.target_message_id,
        assertedTargetAgent: args.target_agent,
      })
      if ("error" in targetScope) {
        return DispatchOutcome.infrastructureFailure({
          operation: "resolve_fact_check_target",
          message: `Projected agent "${factCheckAgentName}" was not started via the fact_check adapter: ${targetScope.error}`,
          recoveryAuthority: resolveDispatchOccurrenceAuthority({
            taskID: task.id,
            dispatchID: execution.dispatch.dispatchID,
          }),
        })
      }
      const resolvedArgs = dependencies.stageInputSchema.parse({
        target_session_id: args.target_session_id,
        target_agent: targetScope.targetAgent,
        reason: args.reason,
        target_message_id: targetScope.targetMessageID,
        target_message_content_hash: targetScope.targetMessageContentHash,
      })

      const result = await runFactCheck({
        agentID: factCheckAgentName,
        packageRevision: execution.projectedAgent.packageRevision,
        workScope: execution.workScope,
        newSessionID: execution.newSessionID,
        existingSessionID: execution.existingSessionID,
        continuationPrompt: dispatchAdapterContinuationPrompt(execution),
        dispatchTurn: execution.dispatch.turn,
        targetSessionID: resolvedArgs.target_session_id,
        targetAgent: resolvedArgs.target_agent,
        targetMessageID: resolvedArgs.target_message_id,
        targetMessageContentHash: resolvedArgs.target_message_content_hash,
        reason: resolvedArgs.reason,
        orchestratorSessionID: dependencies.orchestratorSessionID,
        taskID: task.id,
        signal: dependencies.signal,
        onSessionCreated: (sessionID) => execution.dispatch.observeSession(sessionID),
        onDispatchAuthorityCommit: (sessionID, descriptor) => execution.dispatch.commitSession(sessionID, descriptor),
      })
      if (isAgentCoordinationHandoffResult(result)) {
        return DispatchOutcome.coordination(result)
      }
      try {
        const { recordFactCheckIncomplete, recordFactCheckReview } = await import("@/fact-check/persist")
        const provenance = artifactProvenanceForAgentTurn(result.sessionID, result.finalMessageID)
        const settleIncomplete = (reason: "review_not_published" | "review_scope_mismatch") => {
          const domainArtifact = recordFactCheckIncomplete({
            taskID: task.id,
            factCheckSessionID: result.sessionID,
            finalMessageID: result.finalMessageID,
            targetSessionID: resolvedArgs.target_session_id,
            targetAgent: resolvedArgs.target_agent,
            targetMessageID: resolvedArgs.target_message_id,
            targetMessageContentHash: resolvedArgs.target_message_content_hash,
            invokedByOrchestratorSessionID: dependencies.orchestratorSessionID,
            observedArtifactLocators: provenance.observedArtifactLocators,
            sourceArtifactLocators: provenance.sourceArtifactLocators,
            reason,
          })
          return DispatchOutcome.domainIncomplete({
            sessionID: result.sessionID,
            finalMessageID: result.finalMessageID,
            domain: "fact_check",
            domainArtifact,
          })
        }
        if (!result.review) return settleIncomplete("review_not_published")
        if (!factCheckReviewScopeMatchesTarget(result.review, resolvedArgs)) {
          return settleIncomplete("review_scope_mismatch")
        }
        recordFactCheckReview({
          taskID: task.id,
          factCheckSessionID: result.sessionID,
          targetSessionID: resolvedArgs.target_session_id,
          targetAgent: resolvedArgs.target_agent,
          targetMessageID: resolvedArgs.target_message_id,
          targetMessageContentHash: resolvedArgs.target_message_content_hash,
          invokedByOrchestratorSessionID: dependencies.orchestratorSessionID,
          observedArtifactLocators: provenance.observedArtifactLocators,
          sourceArtifactLocators: provenance.sourceArtifactLocators,
          review: result.review,
        })
        return DispatchOutcome.terminal({
          sessionID: result.sessionID,
          finalMessageID: result.finalMessageID,
        })
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        log.error("fact_check: post-turn persistence failed", {
          taskID: task.id,
          sessionID: result.sessionID,
          error: reason,
        })
        const infrastructureObservationRef = recordTaskInfrastructureErrorBestEffort(
          {
            taskID: task.id,
            component: "fact-check",
            operation: "persist-domain-artifact",
            reason,
            errorName: error instanceof Error ? error.name : undefined,
            sessionID: result.sessionID,
            now: Date.now(),
          },
          {
            onFailure: (observationError) =>
              log.error("fact_check persistence observation also failed", {
                taskID: task.id,
                sessionID: result.sessionID,
                error: observationError instanceof Error ? observationError.message : String(observationError),
              }),
          },
        )
        return DispatchOutcome.partial({
          sessionID: result.sessionID,
          finalMessageID: result.finalMessageID,
          failedOperation: "persist-domain-artifact",
          infrastructureError: infrastructureObservationRef,
        })
      }
    },
  })
}
