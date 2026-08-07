/**
 * Goal workload-analysis runtime template — independent goal-sizing reviewer
 * and execution-inventory producer for projected plan consumers.
 *
 * Thin shell over `runAgentSession` (rule 24), same shape as architect/agent.ts:
 * the agent-specific code is the user-prompt constructor and the output tool kit;
 * the runner owns model resolution, session creation, system-prompt composition,
 * stream-error capture, and abort propagation.
 *
 * Read-only by construction: the tool surface is the read-only context tools
 * (filtered by the agent's tool pool assignment) plus the two structured-output tools.
 * No write / edit / bash — there is no implementation pressure, which is the
 * whole point (spec §0).
 */
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { createAgentContextTools } from "@/agent/context-tools"
import { createAgentCoordinationRuntimeTools } from "@/agent/coordination-runtime-tools"
import { filterAgentTools } from "@/agent/filter-tools"
import { Log } from "@/util/log"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { createGoalWorkloadOutputTools } from "./output-tools"
import { projectWorkloadInput } from "./input-projection"
import { buildWorkloadUserPrompt } from "./prompt"
import type { WorkloadBrief } from "./types"

const log = Log.create({ service: "goal-workload-analyst" })

export namespace GoalWorkloadAnalystAgent {
  export interface AnalyzeInput {
    instruction: string
    taskID: string
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
    goalIDs: string[]
    parentSessionID?: string
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    model?: { providerID: string; modelID: string }
    signal?: AbortSignal
    onStatus?: (summary: string) => void | Promise<void>
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
  }

  export interface AnalyzeResult {
    briefs: WorkloadBrief[]
    sessionID: string
    finalMessageID: string
  }

  export async function analyze(input: AnalyzeInput): Promise<AnalyzeResult | AgentCoordinationHandoffResult> {
    const projection = projectWorkloadInput(input)
    const knownGoalIDs = projection.goals.map((goal) => goal.id)
    const outputToolKit = createGoalWorkloadOutputTools({ knownGoalIDs })
    const coordinationTools = await createAgentCoordinationRuntimeTools({
      agentID: input.agentID,
      taskID: input.taskID,
      signal: input.signal,
    })
    const contextTools = await filterAgentTools(
      { ...createAgentContextTools(), ...coordinationTools },
      "goal-workload-analyst",
      {
        taskID: input.taskID,
        sessionID: input.parentSessionID,
      },
    )

    log.info("goal-workload-analyst starting", {
      goals: projection.goals.length,
    })

    const out = await runAgentSession({
      agentID: input.agentID,
      packageRevision: input.packageRevision,
      workScope: input.workScope,
      sessionTitle: `${input.agentID} (goal-workload-analyst): ${projection.taskTitle}`,
      newSessionID: input.newSessionID,
      existingSessionID: input.existingSessionID,
      continuationPrompt: input.continuationPrompt,
      dispatchTurn: input.dispatchTurn,
      parentSessionID: input.parentSessionID,
      taskID: input.taskID,
      model: input.model,
      signal: input.signal,
      onStatus: input.onStatus ?? (() => {}),
      onSessionCreated: input.onSessionCreated ? (session) => input.onSessionCreated!(session.id) : undefined,
      onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
        ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
        : undefined,
      onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
      toolKit: {
        tools: { ...contextTools, ...outputToolKit.tools },
        stageOwnedToolIDs: Object.keys(outputToolKit.tools),
        getCollector: () => outputToolKit.getCollector(),
      },
      buildUserPrompt: () =>
        [input.instruction.trim(), buildWorkloadUserPrompt(projection)]
          .filter((section) => section.length > 0)
          .join("\n\n"),
    })

    const coordinationHandoff = agentCoordinationHandoffResult(out)
    if (coordinationHandoff) return coordinationHandoff

    const collector = outputToolKit.getCollector()
    log.info("goal-workload-analyst finished", {
      sessionID: out.session.id,
      briefs: collector.briefs.length,
      flagged: collector.briefs.filter((b) => b.decomposition_concern?.trim()).length,
    })

    return {
      briefs: collector.briefs,
      sessionID: out.session.id,
      finalMessageID: out.finalMessage.info.id,
    }
  }
}
