import { DispatchOutcome, DispatchOutcomeSchema } from "@/agent/dispatch-outcome"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import {
  findDispatchLineageByCollectionMember,
  resolveDispatchOccurrenceAuthority,
} from "@/engine/dispatch-lineage"
import { findDispatchSettlementByDispatchID, recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { recordTaskInfrastructureErrorInTransaction } from "@/engine/persist"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { Identifier } from "@/id/id"
import { MessageStore } from "@/session/message-store"
import { Session } from "@/session"
import { isExecutionCancellationError } from "@/session/prompt/cancellation"
import { ToolPartProgressTable } from "@/session/session.sql"
import { Database, asc, eq } from "@/storage/db"
import { toolFailureCauseFromUnknown } from "@/session/tool-failure-cause"
import { bindToolDecisionDeclaration } from "@/tool/execution-mode"
import { jsonSchema, tool } from "ai"
import type { JSONSchema7 } from "@ai-sdk/provider"
import { isDeepStrictEqual } from "node:util"
import z from "zod"
import {
  createDispatchAgentsInputSchema,
  readDispatchCollectionProgress,
  writeDispatchCollectionProgress,
  type DispatchCollectionMemberResult,
} from "./dispatch-agents-contract"
import { requireOrchestratorToolExecutionContext } from "./tool-execution-context"
import { dispatchAgentExecutionInputSchema } from "./dispatch-agent-tool"

type DispatchAgentTool = {
  inputSchema: unknown
  execute?: (...args: any[]) => any
}

type DispatchAgentsRuntime = {
  afterMemberSettled?: (input: { outerToolPartID: string; memberIndex: number }) => void | Promise<void>
}

function persistedMemberProgress(outerToolPartID: string): DispatchCollectionMemberResult[] {
  const settled = new Map<number, DispatchCollectionMemberResult>()
  const facts = Database.use((db) =>
    db
      .select({ metadata: ToolPartProgressTable.metadata })
      .from(ToolPartProgressTable)
      .where(eq(ToolPartProgressTable.request_part_id, outerToolPartID))
      .orderBy(asc(ToolPartProgressTable.time_created), asc(ToolPartProgressTable.id))
      .all(),
  )
  for (const fact of facts) {
    for (const member of readDispatchCollectionProgress(fact.metadata)) {
      const existing = settled.get(member.member_index)
      if (existing && !isDeepStrictEqual(existing, member)) {
        throw new Error(
          `dispatch_agents persisted member checkpoint ${member.member_index} conflicts in outer ${outerToolPartID}`,
        )
      }
      settled.set(member.member_index, member)
    }
  }
  return [...settled.values()].sort((left, right) => left.member_index - right.member_index)
}

const productionRuntime: DispatchAgentsRuntime = {}

function settleCommittedMemberExecutionFailure(input: {
  outer: ReturnType<typeof requireOrchestratorToolExecutionContext>
  member: { index: number; name: string; target: string }
  memberCount: number
  error: unknown
}): DispatchOutcome | undefined {
  const taskID = taskIDForSession(input.outer.orchestratorSessionID)
  if (!taskID) return undefined
  return Database.immediateTransaction((db) => {
    const lineage = findDispatchLineageByCollectionMember({
      taskID,
      toolPartID: input.outer.toolPartID,
      toolCallID: input.outer.toolCallID,
      memberIndex: input.member.index,
      memberCount: input.memberCount,
    })
    if (!lineage) return undefined
    if (lineage.payload.target_agent_id !== input.member.target) {
      throw new Error(
        `dispatch_agents committed member ${input.member.index} target ${lineage.payload.target_agent_id} does not match ${input.member.target}`,
      )
    }
    const existing = findDispatchSettlementByDispatchID({ taskID, dispatchID: lineage.dispatchID })
    if (existing) return existing.payload.outcome
    const message = input.error instanceof Error ? input.error.message : String(input.error)
    const errorName = input.error instanceof Error ? input.error.name : "DispatchCollectionMemberExecutionError"
    const infrastructureFactID = recordTaskInfrastructureErrorInTransaction(db, {
      id: Identifier.deterministic(
        "artifact",
        `dispatch-collection-member-execution-failure-v1\0${taskID}\0${lineage.dispatchID}`,
      ),
      taskID,
      component: "dispatch-agents",
      operation: "settle-committed-member-execution",
      reason: message,
      errorName,
      sessionID: lineage.payload.child_session_id,
      context: {
        dispatchID: lineage.dispatchID,
        outerToolPartID: input.outer.toolPartID,
        memberIndex: input.member.index,
        name: input.member.name,
        target: input.member.target,
      },
    })
    const outcome = DispatchOutcome.infrastructureFailure({
      operation: "settle-committed-member-execution",
      message,
      errorName,
      sessionID: lineage.payload.child_session_id,
      recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID, dispatchID: lineage.dispatchID }),
      infrastructureError: exactEngineArtifactLocator({ taskID, artifactID: infrastructureFactID }),
    })
    recordDispatchSettlement({ taskID, dispatchID: lineage.dispatchID, outcome })
    return outcome
  })
}

/**
 * Execute the one real model-authored dispatch collection occurrence.
 *
 * The persisted outer Tool request owns the complete ordered member set. Each
 * immutable dispatch lineage binds that real Tool identity plus its member
 * index; the Host never manufactures child Tool calls or a second frontier
 * state. Individual workers still use the canonical dispatch_agent runtime.
 */
function createDispatchAgentsToolWithRuntime(
  dispatchAgentTool: DispatchAgentTool,
  runtime: DispatchAgentsRuntime,
  childInputSchema: z.ZodType,
) {
  if (!dispatchAgentTool.execute) throw new Error("dispatch_agents requires an executable dispatch_agent Tool")
  const inputSchema = createDispatchAgentsInputSchema(childInputSchema)
  const providerInputSchema = jsonSchema<z.infer<typeof inputSchema>>(
    z.toJSONSchema(inputSchema, { cycles: "ref", reused: "ref" }) as unknown as JSONSchema7,
    {
      validate(value) {
        const parsed = inputSchema.safeParse(value)
        return parsed.success ? { success: true, value: parsed.data } : { success: false, error: parsed.error }
      },
    },
  )

  const collectionTool = tool({
    description:
      "Describe and submit one complete dependency-ready Agent frontier in this visible Tool call. team is the structured Task-local team/workflow description and aligns by index with dispatches. The persisted call is the one collection occurrence; each member binds its exact index to this call and starts through the canonical dispatch runtime. The Host does not choose members, infer dependencies, add work, or manufacture nested Tool calls. Use one call for all currently independent members; use a later call only after real predecessor evidence opens another frontier.",
    inputSchema: providerInputSchema,
    execute: async (rawInput, options) => {
      const parsed = inputSchema.parse(rawInput)
      const outer = requireOrchestratorToolExecutionContext(options, "dispatch_agents")
      if (outer.visibleToolName !== "dispatch_agents") {
        throw new Error(`dispatch_agents cannot execute under visible Tool ${outer.visibleToolName}`)
      }
      const persistedMessage = await MessageStore.get({
        sessionID: outer.orchestratorSessionID,
        messageID: outer.orchestratorMessageID,
      })
      const persistedPart = persistedMessage.parts.find((part) => part.id === outer.toolPartID)
      if (
        !persistedPart ||
        persistedPart.type !== "tool" ||
        persistedPart.tool !== "dispatch_agents" ||
        persistedPart.callID !== outer.toolCallID ||
        (persistedPart.state.status !== "running" && persistedPart.state.status !== "completed") ||
        !isDeepStrictEqual(persistedPart.state.input, parsed)
      ) {
        throw new Error(
          `dispatch_agents persisted occurrence ${outer.toolPartID}/${outer.toolCallID} does not match its exact collection input`,
        )
      }
      if (persistedPart.state.status === "completed") {
        return {
          title: persistedPart.state.title,
          output: persistedPart.state.output,
          metadata: persistedPart.state.metadata,
        }
      }
      const optionRecord = options && typeof options === "object" && !Array.isArray(options) ? options : {}
      const outerMeta =
        (optionRecord as { opencorvus?: unknown }).opencorvus &&
        typeof (optionRecord as { opencorvus?: unknown }).opencorvus === "object" &&
        !Array.isArray((optionRecord as { opencorvus?: unknown }).opencorvus)
          ? (optionRecord as { opencorvus: Record<string, unknown> }).opencorvus
          : {}
      const callerSignal =
        (optionRecord as { abortSignal?: unknown }).abortSignal instanceof AbortSignal
          ? (optionRecord as { abortSignal: AbortSignal }).abortSignal
          : undefined
      const members = parsed.dispatches.map((request, index) => ({
        index,
        request,
        name: parsed.team[index]!.name,
        target: parsed.team[index]!.target,
      }))
      const persistedMetadata = persistedPart.state.metadata
      const settledByIndex = new Map<number, DispatchCollectionMemberResult>()
      for (const settled of persistedMemberProgress(outer.toolPartID)) {
        const member = members[settled.member_index]
        if (!member || settled.name !== member.name || settled.target !== member.target) {
          throw new Error(
            `dispatch_agents persisted member checkpoint ${settled.member_index} does not match outer ${outer.toolPartID}`,
          )
        }
        settledByIndex.set(settled.member_index, settled)
      }
      let checkpointWrites = Promise.resolve()
      const checkpoint = (result: DispatchCollectionMemberResult) => {
        checkpointWrites = checkpointWrites.then(async () => {
          settledByIndex.set(result.member_index, result)
          const snapshot = [...settledByIndex.values()]
          await Session.appendToolProgress({
            sessionID: outer.orchestratorSessionID,
            messageID: outer.orchestratorMessageID,
            partID: outer.toolPartID,
            title: `Settled frontier (${snapshot.length}/${members.length})`,
            metadata: writeDispatchCollectionProgress(persistedMetadata, snapshot),
          })
        })
        return checkpointWrites
      }

      const results = await Promise.all(
        members.map(async (member): Promise<DispatchCollectionMemberResult> => {
          const persisted = settledByIndex.get(member.index)
          if (persisted) return persisted
          let result: DispatchCollectionMemberResult
          try {
            const outcome = DispatchOutcomeSchema.parse(
              await dispatchAgentTool.execute!(member.request, {
                ...(optionRecord as object),
                toolCallId: outer.toolCallID,
                opencorvus: {
                  ...outerMeta,
                  sessionID: outer.orchestratorSessionID,
                  messageID: outer.orchestratorMessageID,
                  toolCallID: outer.toolCallID,
                  toolPartID: outer.toolPartID,
                  visibleToolName: "dispatch_agents",
                  collectionMember: { index: member.index, count: members.length },
                },
              }),
            )
            result = {
              member_index: member.index,
              name: member.name,
              target: member.target,
              status: "completed",
              outcome,
            }
          } catch (error) {
            if (isExecutionCancellationError(error) || callerSignal?.aborted) throw error
            const committedOutcome = settleCommittedMemberExecutionFailure({
              outer,
              member,
              memberCount: members.length,
              error,
            })
            result = committedOutcome
              ? {
                  member_index: member.index,
                  name: member.name,
                  target: member.target,
                  status: "completed",
                  outcome: committedOutcome,
                }
              : {
                  member_index: member.index,
                  name: member.name,
                  target: member.target,
                  status: "failed",
                  failure: toolFailureCauseFromUnknown({
                    error,
                    originSite: "orchestrator.dispatch-agents.member",
                    classification: "tool-execution",
                    kind: "tool-execute-error",
                    data: {
                      outerToolPartID: outer.toolPartID,
                      memberIndex: member.index,
                      target: member.target,
                    },
                  }),
                }
          }
          await checkpoint(result)
          await runtime.afterMemberSettled?.({ outerToolPartID: outer.toolPartID, memberIndex: member.index })
          return result
        }),
      )
      callerSignal?.throwIfAborted()
      const completedCount = results.filter((result) => result.status === "completed").length
      return {
        title: `Settled frontier (${completedCount}/${members.length})`,
        output: JSON.stringify({ members: results }),
        metadata: {
          frontier_size: members.length,
          completed_count: completedCount,
          member_names: members.map((member) => member.name),
          targets: members.map((member) => member.target),
          members: results,
        },
      }
    },
  })

  return bindToolDecisionDeclaration(collectionTool, {
    command: "dispatch_agents",
    commits: () => true,
  })
}

export function createDispatchAgentsTool(dispatchAgentTool: DispatchAgentTool) {
  return createDispatchAgentsToolWithRuntime(
    dispatchAgentTool,
    productionRuntime,
    dispatchAgentExecutionInputSchema(dispatchAgentTool),
  )
}

export const DispatchAgentsToolTestHooks = Object.freeze({
  create(dispatchAgentTool: DispatchAgentTool, input: DispatchAgentsRuntime, childInputSchema: z.ZodType) {
    return createDispatchAgentsToolWithRuntime(dispatchAgentTool, input, childInputSchema)
  },
  settleCommittedMemberExecutionFailure,
})
