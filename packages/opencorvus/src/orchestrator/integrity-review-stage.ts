import { integrityPersistenceRefs } from "@/integrity/fact-projection"
import { reviewIntegrity } from "@/integrity/team-agent"
import { Log } from "@/util/log"
import { DispatchOutcome, type DispatchOutcome as DispatchOutcomeResult } from "@/agent/dispatch-outcome"
import type { OrchestratorToolExecutionContext } from "./tool-execution-context"
import type { DispatchAgentLineageHandle } from "./dispatch-agent-tool"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"

const log = Log.create({ service: "integrity-review-stage" })

type IntegrityToolInput = {
  reason?: string
  goal_ids: string[]
  attachment_refs: string[]
}

type IntegrityReviewStageDependencies = {
  taskID: string
  parentSessionID: string
  signal?: AbortSignal
}

export function createIntegrityReviewStage(dependencies: IntegrityReviewStageDependencies) {
  const taskID = dependencies.taskID
  const input = { agentSessionID: dependencies.parentSessionID, signal: dependencies.signal }

  async function runIntegrityReviewOnce(ctx: {
    toolExecution: OrchestratorToolExecutionContext & {
      agentID: string
      packageRevision: PromptProfileResolver.ResolvedPackageRevision
      workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
      newSessionID?: string
      existingSessionID?: string
      continuationPrompt?: string
      dispatchTurn?: import("./dispatch-turn-projection").DispatchTurn
      dispatch: DispatchAgentLineageHandle
      signal: AbortSignal
    }
    toolInput: IntegrityToolInput
  }): Promise<DispatchOutcomeResult> {
    const { toolExecution, toolInput } = ctx
    const integrityAgentID = toolExecution.agentID
    const requestedGoalIDs = toolInput.goal_ids
    const factSelection = {
      taskID,
      goalIDs: requestedGoalIDs,
      artifactLocators: [],
      attachmentRefs: toolInput.attachment_refs,
    }
    let verdict: Awaited<ReturnType<typeof reviewIntegrity>>
    verdict = await reviewIntegrity({
      agentID: integrityAgentID,
      packageRevision: toolExecution.packageRevision,
      workScope: toolExecution.workScope,
      newSessionID: toolExecution.newSessionID,
      existingSessionID: toolExecution.existingSessionID,
      continuationPrompt: toolExecution.continuationPrompt,
      dispatchTurn: toolExecution.dispatchTurn,
      instruction: toolInput.reason ?? "Review the selected Integrity facts.",
      goalIDs: requestedGoalIDs,
      attachmentRefs: toolInput.attachment_refs,
      signal: toolExecution.signal,
      taskID,
      parentSessionID: input.agentSessionID,
      onSessionCreated: async (sessionID) => {
        toolExecution.dispatch.observeSession(sessionID)
      },
      onDispatchAuthorityCommit: (sessionID, descriptor) => toolExecution.dispatch.commitSession(sessionID, descriptor),
    })
    if (isAgentCoordinationHandoffResult(verdict)) {
      return DispatchOutcome.coordination(verdict)
    }

    const { recordIntegrityReview } = await import("@/engine/persist")
    const review = verdict.review
    const provenance = artifactProvenanceForAgentTurn(
      verdict.sessionID,
      verdict.finalMessageID,
    )
    const persistenceRefs = integrityPersistenceRefs({
      ...factSelection,
      artifactLocators: provenance.sourceArtifactLocators,
    })
    let persistenceFailed = false
    let infrastructureObservationRef
    try {
      recordIntegrityReview({
        taskID,
        sessionID: verdict.sessionID,
        finalMessageID: verdict.finalMessageID,
        goalIDs: persistenceRefs.goalIDs,
        requirementSetArtifactLocators: persistenceRefs.requirementSetArtifactLocators,
        contractGraphArtifactLocators: persistenceRefs.contractGraphArtifactLocators,
        evidenceArtifactLocators: persistenceRefs.evidenceArtifactLocators,
        observedArtifactLocators: provenance.observedArtifactLocators,
        sourceArtifactLocators: provenance.sourceArtifactLocators,
        phase: persistenceRefs.phase,
        review,
        completenessFindings: verdict.completenessFindings,
      })
    } catch (err) {
      persistenceFailed = true
      const error = err instanceof Error ? err.message : String(err)
      log.error("integrity: recordIntegrityReview failed", {
        taskID,
        error,
      })
      infrastructureObservationRef = recordTaskInfrastructureErrorBestEffort(
        {
          taskID,
          component: "integrity-review",
          operation: "persist-domain-artifact",
          reason: error,
          errorName: err instanceof Error ? err.name : undefined,
          sessionID: verdict.sessionID,
          now: Date.now(),
        },
        {
          onFailure: (observationError) =>
            log.error("integrity persistence observation also failed", {
              taskID,
              sessionID: verdict.sessionID,
              error: observationError instanceof Error ? observationError.message : String(observationError),
            }),
        },
      )
    }
    return persistenceFailed
      ? DispatchOutcome.partial({
          sessionID: verdict.sessionID,
          finalMessageID: verdict.finalMessageID,
          failedOperation: "persist-domain-artifact",
          infrastructureError: infrastructureObservationRef,
        })
      : DispatchOutcome.terminal({
          sessionID: verdict.sessionID,
          finalMessageID: verdict.finalMessageID,
        })
  }

  return runIntegrityReviewOnce
}
