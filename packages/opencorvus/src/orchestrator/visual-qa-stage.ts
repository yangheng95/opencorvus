import { DispatchOutcome, type DispatchOutcome as DispatchOutcomeResult } from "@/agent/dispatch-outcome"
import type { TaskRow } from "@/engine/store"
import { Instance } from "@/project/instance"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { Log } from "@/util/log"
import { normalizeVisualQaDispatchContext, renderVisualQaDispatchContext } from "@/visual-qa/context"
import { persistVisualReview } from "@/visual-qa/persist"
import { VisualQaAgent } from "@/visual-qa/agent"
import { recordTaskInfrastructureErrorBestEffort } from "./infrastructure-observation"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"

const log = Log.create({ service: "visual-qa-stage" })

type VisualQaStageDependencies = {
  taskID: string
  parentSessionID: string
  signal?: AbortSignal
  analyze?: typeof VisualQaAgent.analyze
  persistReview?: typeof persistVisualReview
}

export function createVisualQaStageDispatcher(dependencies: VisualQaStageDependencies) {
  return async function dispatchVisualQaStage(dispatch: {
    task: TaskRow
    reason: string
    focus?: string
    appUrl?: string
    previewCommand?: string
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("./dispatch-turn-projection").DispatchTurn
    goalIDs: string[]
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
  }): Promise<DispatchOutcomeResult> {
    const task = dispatch.task
    const selectedGoalIDs = dispatch.goalIDs

    const projectRoot = taskPrimaryProjectRoot(dependencies.taskID, { activeProjectID: Instance.project.id })
    const contextSections = [
      [
        "## Durable Artifact discovery",
        "- Search the Task Artifact catalog yourself for current and historical design, build, research, and review evidence.",
        "- Choose by exact name/kind, recency, and fuzzy relevance, pass each candidate's `artifact_locator_ref` to `artifact_read` until complete, then pass `artifact_read_ref` to `artifact_select` for every Artifact that semantically supports the VisualReview. Complete but unselected reads remain observations; zero selections are valid.",
        "- No upstream participant selected or copied Artifact bodies into this prompt; missing evidence must remain visible.",
      ].join("\n"),
    ]
    const visualQaDispatchContext = normalizeVisualQaDispatchContext({
      appUrl: dispatch.appUrl,
      previewCommand: dispatch.previewCommand,
    })
    const dispatchSection = renderVisualQaDispatchContext(visualQaDispatchContext)
    if (dispatchSection) contextSections.push(dispatchSection)
    try {
      const analyze = dependencies.analyze ?? VisualQaAgent.analyze
      const result = await analyze({
        agentID: dispatch.agentID,
        packageRevision: dispatch.packageRevision,
        workScope: dispatch.workScope,
        newSessionID: dispatch.newSessionID,
        existingSessionID: dispatch.existingSessionID,
        continuationPrompt: dispatch.continuationPrompt,
        dispatchTurn: dispatch.dispatchTurn,
        taskTitle: task.title,
        taskRequest: task.request,
        reason: dispatch.reason,
        focus: dispatch.focus,
        contextSections,
        dispatchContext: visualQaDispatchContext,
        projectRoot,
        taskID: dependencies.taskID,
        parentSessionID: dependencies.parentSessionID,
        signal: dependencies.signal,
        onSessionCreated: async (sessionID) => {
          await dispatch.onSessionCreated?.(sessionID)
        },
        onDispatchAuthorityCommit: dispatch.onDispatchAuthorityCommit,
        onRuntimeReady: dispatch.onRuntimeReady,
      })
      if (result.outcome === "coordination_handoff") {
        return DispatchOutcome.coordination(result)
      }
      const review = result.review
      const finalMessageID = result.finalMessageID

      try {
        const provenance = artifactProvenanceForAgentTurn(result.sessionID, finalMessageID)
        await (dependencies.persistReview ?? persistVisualReview)({
          taskID: dependencies.taskID,
          sessionID: result.sessionID,
          finalMessageID,
          goalIDs: selectedGoalIDs,
          evidenceArtifactLocators: provenance.sourceArtifactLocators,
          observedArtifactLocators: provenance.observedArtifactLocators,
          sourceArtifactLocators: provenance.sourceArtifactLocators,
          review,
          completenessFindings: result.completenessFindings,
          judgmentTool: result.judgmentTool,
        })
        return DispatchOutcome.terminal({
          sessionID: result.sessionID,
          finalMessageID,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error("visual_qa evidence processing failed after specialist observation", {
          taskID: dependencies.taskID,
          sessionID: result.sessionID,
          error: message,
        })
        const infrastructureObservationRef = recordTaskInfrastructureErrorBestEffort(
          {
            taskID: dependencies.taskID,
            component: "visual-qa",
            operation: "persist-domain-evidence",
            reason: message,
            errorName: error instanceof Error ? error.name : undefined,
            sessionID: result.sessionID,
            now: Date.now(),
          },
          {
            onFailure: (observationError) =>
              log.error("visual_qa persistence observation also failed", {
                taskID: dependencies.taskID,
                sessionID: result.sessionID,
                error: observationError instanceof Error ? observationError.message : String(observationError),
              }),
          },
        )
        return DispatchOutcome.partial({
          sessionID: result.sessionID,
          finalMessageID,
          failedOperation: "persist-domain-evidence",
          infrastructureError: infrastructureObservationRef,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error("visual_qa: failed", { taskID: dependencies.taskID, error: message })
      throw error instanceof Error ? error : new Error(message)
    }
  }
}
