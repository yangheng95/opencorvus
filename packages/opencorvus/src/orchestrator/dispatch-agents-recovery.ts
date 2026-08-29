import { resolvePinnedTaskSchedulerTurnProjection } from "@/engine/task-package-projection"
import { requireTask } from "@/engine/store"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { EffectiveConfig } from "@/config/effective"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import type { Message } from "@/session/message"
import { toolFailureCauseFromUnknown } from "@/session/tool-failure-cause"

type FrontierToolResult = {
  title: string
  output: string
  metadata: Record<string, unknown>
}

export type DispatchAgentsRecoveryTool = {
  execute?: (input: unknown, options: unknown) => Promise<unknown> | unknown
}

export type DispatchAgentsRecoveryToolFactory = (input: {
  taskID: string
  agentSessionID: string
  signal?: AbortSignal
  dispatchAgents: readonly PromptProfileResolver.ResolvedProjectedAgent[]
}) => DispatchAgentsRecoveryTool | undefined

/**
 * Resume one persisted frontier decision whose owning process ended.
 *
 * The outer Part already owns the complete validated model input. The frontier
 * executor derives deterministic child Tool identities from that Part, so a
 * replay resumes missing admissions and reuses every child that already owns a
 * canonical dispatch lineage instead of creating a second occurrence.
 */
export async function recoverInterruptedDispatchAgentsPart(input: {
  sessionID: string
  messageID: string
  part: Message.ToolPart
  createFrontierTool: DispatchAgentsRecoveryToolFactory
  signal?: AbortSignal
}): Promise<"completed" | "failed"> {
  if (input.part.tool !== "dispatch_agents" || input.part.state.status !== "running") {
    throw new Error(`Frontier recovery requires one running dispatch_agents Part, received ${input.part.tool}`)
  }
  const startedAt = input.part.state.time.start
  const settleFailure = async (primary: unknown): Promise<"failed"> => {
    input.signal?.throwIfAborted()
    try {
      await Session.updatePart({
        ...input.part,
        state: {
          status: "error",
          input: input.part.state.input,
          failure: toolFailureCauseFromUnknown({
            error: primary,
            originSite: "orchestrator.dispatch-agents.recovery",
            classification: "tool-execution",
            kind: "tool-execute-error",
            data: { outerToolPartID: input.part.id },
          }),
          time: { start: startedAt, end: Math.max(Date.now(), startedAt + 1) },
        },
      })
    } catch (settlementError) {
      throw new AggregateError(
        [primary, settlementError],
        `dispatch_agents recovery and terminal settlement both failed for ${input.part.id}`,
      )
    }
    return "failed"
  }

  try {
    const session = await Session.get(input.sessionID)
    return await Instance.provide({
      directory: session.directory,
      fn: async () => {
      const taskID = taskIDForSession(input.sessionID)
      if (!taskID) throw new Error(`Frontier recovery Session ${input.sessionID} has no Task authority`)
      const task = requireTask(taskID)
      if (task.project_id !== session.projectID || session.kind !== "orchestrator") {
        throw new Error(`Frontier recovery Session ${input.sessionID} is not Task ${taskID}'s Orchestrator`)
      }
      const [config, capabilityProjectDirectory] = await Promise.all([
        EffectiveConfig.effective({ sessionID: input.sessionID }),
        EffectiveConfig.capabilityProjectDirectory({ sessionID: input.sessionID }),
      ])
      const { schedulerCapability, skillProjection } = await resolvePinnedTaskSchedulerTurnProjection({
        taskID,
        projectDirectory: capabilityProjectDirectory,
        config,
      })
      if (!schedulerCapability.builtInToolIDs.includes("dispatch_agents")) {
        throw new Error(`Task ${taskID} pinned scheduler no longer projects dispatch_agents`)
      }
      const frontier = input.createFrontierTool({
        taskID,
        agentSessionID: input.sessionID,
        signal: input.signal,
        dispatchAgents: [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents],
      })
      if (!frontier?.execute) throw new Error(`Task ${taskID} dispatch_agents recovery executor is unavailable`)

        const result = (await frontier.execute(input.part.state.input as never, {
          toolCallId: input.part.callID,
          abortSignal: input.signal,
          opencorvus: {
            sessionID: input.sessionID,
            messageID: input.messageID,
            toolCallID: input.part.callID,
            toolPartID: input.part.id,
            visibleToolName: "dispatch_agents",
          },
        } as never)) as FrontierToolResult
        await Session.updatePart({
          ...input.part,
          state: {
            status: "completed",
            input: input.part.state.input,
            output: result.output,
            title: result.title,
            metadata: result.metadata,
            time: { start: startedAt, end: Math.max(Date.now(), startedAt + 1) },
          },
        })
        return "completed" as const
      },
    })
  } catch (primary) {
    return await settleFailure(primary)
  }
}
