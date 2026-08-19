import { DispatchOutcome, type DispatchOutcome as DispatchOutcomeResult } from "@/agent/dispatch-outcome"
import { isAgentCoordinationHandoffResult } from "@/agent/runner"
import { persistTaskFrontendResearchBrief, persistTaskResearchPartial } from "@/engine/persist"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import type { TaskRow } from "@/engine/store"
import { isHttpWebpageUrl } from "@/util/web-url"
import { Log } from "@/util/log"
import { persistCompleteResearchBrief, persistPartialResearchBrief } from "./research-persistence"
import { discardEngineArtifactResources } from "@/task-artifact/store"
import { FrontendResearchAgent } from "@/frontend-research/agent"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"

const log = Log.create({ service: "frontend-research-stage" })

type FrontendResearchStageDependencies = {
  taskID: string
  parentSessionID: string
  signal?: AbortSignal
  runResearch?: typeof FrontendResearchAgent.run
}

export function createFrontendResearchStageDispatcher(dependencies: FrontendResearchStageDependencies) {
  const runResearch = dependencies.runResearch ?? FrontendResearchAgent.run
  return async function dispatchFrontendResearchStage(dispatch: {
    task: TaskRow
    reason: string
    sourceUrls?: string[]
    focus?: string
    deliverySliceRevisionIDs: string[]
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
    if (!dispatchID) throw new Error("Frontend Research dispatch requires current dispatch authority")
    const sourceUrls = dispatch.sourceUrls?.filter(isHttpWebpageUrl)
    try {
      const result = await runResearch({
        agentID: dispatch.agentID,
        packageRevision: dispatch.packageRevision,
        workScope: dispatch.workScope,
        newSessionID: dispatch.newSessionID,
        existingSessionID: dispatch.existingSessionID,
        continuationPrompt: dispatch.continuationPrompt,
        dispatchTurn: dispatch.dispatchTurn,
        title: dispatch.task.title,
        request: dispatch.task.request,
        targetDeliverable: "implementation_input",
        sourceUrls: sourceUrls?.length ? sourceUrls : undefined,
        focus: dispatch.focus,
        reason: dispatch.reason,
        contextSections: [
          `## Exact Delivery Slice revision subjects\n\n${dispatch.deliverySliceRevisionIDs.join(", ") || "(none)"}\n\nThese immutable subjects scope research evidence only; they do not create execution or lifecycle instances.`,
        ],
        taskID: dependencies.taskID,
        parentSessionID: dependencies.parentSessionID,
        signal: dependencies.signal,
        onSessionCreated: async (sessionID) => {
          await dispatch.onSessionCreated?.(sessionID)
        },
        onDispatchAuthorityCommit: dispatch.onDispatchAuthorityCommit,
        onRuntimeReady: dispatch.onRuntimeReady,
      })
      if (isAgentCoordinationHandoffResult(result)) {
        return DispatchOutcome.coordination(result)
      }
      if (result.outcome === "incomplete") {
        const provenance = artifactProvenanceForAgentTurn(result.sessionID, result.finalMessageID)
        return persistPartialResearchBrief({
          taskID: dependencies.taskID,
          dispatchID,
          component: "frontend-research",
          sessionID: result.sessionID,
          finalMessageID: result.finalMessageID,
          persist: () =>
            persistTaskResearchPartial({
              taskID: dependencies.taskID,
              goalID: undefined,
              kind: "frontend_research_brief",
              sessionID: result.sessionID,
              finalMessageID: result.finalMessageID,
              observedArtifactLocators: provenance.observedArtifactLocators,
              sourceArtifactLocators: provenance.sourceArtifactLocators,
              missing: result.missing,
              draft: result.partialDraft,
            }),
        })
      }
      const provenance = artifactProvenanceForAgentTurn(result.sessionID, result.brief.metadata.created_for_message_id)
      if (!result.artifactResources) {
        throw new Error("Frontend Research completed without its required Engine Artifact resource publication")
      }
      const artifactResources = result.artifactResources
      let persisted = false
      try {
        const outcome = persistCompleteResearchBrief({
          taskID: dependencies.taskID,
          dispatchID,
          component: "frontend-research",
          sessionID: result.sessionID,
          finalMessageID: result.brief.metadata.created_for_message_id,
          persist: () =>
            persistTaskFrontendResearchBrief({
              taskID: dependencies.taskID,
              goalID: undefined,
              brief: result.brief,
              observedArtifactLocators: provenance.observedArtifactLocators,
              sourceArtifactLocators: provenance.sourceArtifactLocators,
              artifactResources: {
                resources: artifactResources.publication.artifacts,
                resourceRoles: artifactResources.resourceRoles,
                visualEvidence: artifactResources.visualEvidence,
              },
            }),
        })
        persisted = outcome.kind === "terminal_success"
        return outcome
      } finally {
        if (!persisted) {
          await discardEngineArtifactResources({
            ...artifactResources.authority,
            snapshot: artifactResources.publication.snapshot,
          })
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error("frontend_research tool failed", { taskID: dependencies.taskID, error: message })
      throw error
    }
  }
}
