import { DispatchOutcome, type DispatchOutcome as DispatchOutcomeResult } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { persistTaskResearchBrief, persistTaskResearchPartial } from "@/engine/persist"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import type { TaskRow } from "@/engine/store"
import { Log } from "@/util/log"
import { persistResearchArtifactBestEffort } from "./research-persistence"
import { DeepResearchAgent } from "@/research/agent"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"

const log = Log.create({ service: "deep-research-stage" })

type DeepResearchStageDependencies = {
  taskID: string
  parentSessionID: string
  signal?: AbortSignal
}

export function createDeepResearchStageDispatcher(dependencies: DeepResearchStageDependencies) {
  return async function dispatchDeepResearchStage(dispatch: {
    task: TaskRow
    reason: string
    targetDeliverable?: "prd" | "spec" | "research_report" | "implementation_input" | "mixed"
    sourceUrls?: string[]
    focus?: string
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
  }): Promise<DispatchOutcomeResult> {
    const dispatchID = dispatch.dispatchTurn?.current_dispatch_id
    if (!dispatchID) throw new Error("Deep Research dispatch requires current dispatch authority")
    try {
      const result = await DeepResearchAgent.run({
        agentID: dispatch.agentID,
        packageRevision: dispatch.packageRevision,
        workScope: dispatch.workScope,
        newSessionID: dispatch.newSessionID,
        existingSessionID: dispatch.existingSessionID,
        continuationPrompt: dispatch.continuationPrompt,
        dispatchTurn: dispatch.dispatchTurn,
        title: dispatch.task.title,
        request: dispatch.task.request,
        targetDeliverable: dispatch.targetDeliverable,
        sourceUrls: dispatch.sourceUrls,
        focus: dispatch.focus,
        reason: dispatch.reason,
        taskID: dependencies.taskID,
        parentSessionID: dependencies.parentSessionID,
        signal: dependencies.signal,
        onSessionCreated: dispatch.onSessionCreated,
        onDispatchAuthorityCommit: dispatch.onDispatchAuthorityCommit,
        onRuntimeReady: dispatch.onRuntimeReady,
      })
      if (isAgentCoordinationHandoffResult(result)) {
        return DispatchOutcome.coordination(result)
      }
      if (result.outcome === "incomplete") {
        const provenance = artifactProvenanceForAgentTurn(
          result.sessionID,
          result.finalMessageID,
        )
        return persistResearchArtifactBestEffort({
          taskID: dependencies.taskID,
          dispatchID,
          component: "deep-research",
          operation: "persist-partial-research-brief",
          sessionID: result.sessionID,
          finalMessageID: result.finalMessageID,
          persist: () =>
            persistTaskResearchPartial({
              taskID: dependencies.taskID,
              goalID: undefined,
              kind: "research_brief",
              sessionID: result.sessionID,
              finalMessageID: result.finalMessageID,
              observedArtifactLocators: provenance.observedArtifactLocators,
              sourceArtifactLocators: provenance.sourceArtifactLocators,
              missing: result.missing,
              draft: result.partialDraft,
            }),
        })
      }
      const provenance = artifactProvenanceForAgentTurn(
        result.sessionID,
        result.brief.metadata.created_for_message_id,
      )
      return persistResearchArtifactBestEffort({
        taskID: dependencies.taskID,
        dispatchID,
        component: "deep-research",
        operation: "persist-research-brief",
        sessionID: result.sessionID,
        finalMessageID: result.brief.metadata.created_for_message_id,
        persist: () =>
          persistTaskResearchBrief({
            taskID: dependencies.taskID,
            goalID: undefined,
            brief: result.brief,
            observedArtifactLocators: provenance.observedArtifactLocators,
            sourceArtifactLocators: provenance.sourceArtifactLocators,
          }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error("deep_research tool failed", { taskID: dependencies.taskID, error: message })
      throw error
    }
  }
}
