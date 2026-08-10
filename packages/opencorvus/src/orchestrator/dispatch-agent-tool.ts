import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { tool } from "ai"
import z from "zod"
import { ProjectedAgentWorkScopeSchema } from "@/agent/projected-agent-work-scope"
import { optionsWithVisibleOrchestratorToolName } from "./tool-execution-context"
import {
  createDispatchAdapterExecutionContext,
  type DispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import {
  ExecutionCancellationError,
  createExecutionCancellationOrigin,
  isExecutionCancellationError,
} from "@/session/prompt/cancellation"
import {
  DispatchOutcome,
  DispatchOutcomeSchema,
  type DispatchOutcome as DispatchOutcomeResult,
} from "@/agent/dispatch-outcome"
import {
  DispatchWorkflowSubjectSchema,
  dispatchWorkflowBinding,
  workflowProjectionFromProjectedAgents,
  type SelectedWorkflowBinding,
} from "@/engine/workflow-binding"
import { Identifier } from "@/id/id"
import type { DispatchTurn } from "./dispatch-turn-projection"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { EvidenceLocatorListSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import type { EvidenceLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { WorkerTurnSettlementError } from "@/agent/runner"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { WorkflowNodeOccurrenceConflictError } from "@/engine/workflow-node-occurrence"
import { resolveDispatchOccurrenceAuthority } from "@/engine/dispatch-lineage"
import { Log } from "@/util/log"
import { runAsInstanceActivity } from "@/project/instance"

const log = Log.create({ service: "dispatch-agent-tool" })

export type DispatchAgentExecute = (
  args: unknown,
  context: DispatchAdapterExecutionContext,
) => Promise<DispatchOutcomeResult>
export type DispatchAdapterExecutors = Readonly<Record<AgentDispatchAdapterID, DispatchAgentExecute>>

export interface DispatchAgentLineageHandle {
  readonly dispatchID: string
  readonly deliverySliceRevisionIDs: readonly string[]
  /** Exact existing worker Session reused by continuation or coordination redispatch. */
  readonly existingSessionID?: string
  /** Exact visible user-Turn authority and immutable workflow occurrence for this dispatch. */
  readonly turn: DispatchTurn
  readonly adapterInput: Readonly<Record<string, unknown>>
  readonly continuationGuidance?: string
  /** Observe the physical Session identity without publishing logical dispatch lineage. */
  observeSession(sessionID: string): void
  /** Commit logical dispatch authority only after the exact Turn descriptor is durable. */
  commitSession(sessionID: string, descriptor: WorkerTurnDescriptor.Info): { artifactID: string }
}

export type OpenDispatchAgentLineage = (input: {
  taskID: string
  targetAgentID: string
  projectedAgent: PromptProfileResolver.ResolvedProjectedAgent
  workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
  deliverySliceRevisionIDs: string[]
  workflowBinding?: SelectedWorkflowBinding
  workflowNodeID?: string | null
  coordinationActionID?: string
  continuationDispatchID?: string
  signal?: AbortSignal
  toolOptions: unknown
  adapterInput: Record<string, unknown>
  continuationGuidance?: string
  evidenceLocators?: EvidenceLocator[]
}) => DispatchAgentLineageHandle | Promise<DispatchAgentLineageHandle>

export type RunDispatchAgentInWorktree = <T>(input: {
  taskID: string
  sessionID: string
  existingSessionID?: string
  targetAgentID: string
  dispatchID: string
  run: () => Promise<T>
}) => Promise<T>

export async function detachDispatchExecution(input: {
  execution: () => Promise<DispatchOutcomeResult>
  committedLineage: Promise<{ sessionID: string; artifactID: string }>
  runAsActivity: <T>(run: () => Promise<T>) => Promise<T>
  deliver: (input: { sessionID: string; outcome?: DispatchOutcomeResult; executionError?: unknown }) => Promise<void>
  onDeliveryFailure: (input: { sessionID: string; error: unknown }) => void
}): Promise<DispatchOutcomeResult> {
  type FirstResult =
    | { kind: "completed"; outcome: DispatchOutcomeResult }
    | { kind: "accepted"; lineage: { sessionID: string; artifactID: string } }
  let resolveFirst!: (result: FirstResult) => void
  let rejectFirst!: (error: unknown) => void
  const firstResult = new Promise<FirstResult>((resolve, reject) => {
    resolveFirst = resolve
    rejectFirst = reject
  })
  let acceptedSessionID: string | undefined
  const activity = input.runAsActivity(async () => {
    try {
      // The execution factory must start inside the activity. Tracking an
      // already-started Promise cannot retrofit Instance authority onto its
      // existing AsyncLocal continuations.
      const execution = input.execution()
      const first = await Promise.race<FirstResult>([
        execution.then((outcome) => ({ kind: "completed" as const, outcome })),
        input.committedLineage.then((lineage) => ({ kind: "accepted" as const, lineage })),
      ])
      if (first.kind === "completed") {
        resolveFirst(first)
        return
      }
      acceptedSessionID = first.lineage.sessionID
      resolveFirst(first)
      await execution.then(
        (outcome) => input.deliver({ sessionID: first.lineage.sessionID, outcome }),
        (executionError) => input.deliver({ sessionID: first.lineage.sessionID, executionError }),
      )
    } catch (error) {
      if (!acceptedSessionID) {
        rejectFirst(error)
        return
      }
      throw error
    }
  })
  void activity.catch((error) => {
    if (acceptedSessionID) input.onDeliveryFailure({ sessionID: acceptedSessionID, error })
  })
  const first = await firstResult
  if (first.kind === "completed") return first.outcome
  return DispatchOutcome.accepted({
    sessionID: first.lineage.sessionID,
    dispatchLineageID: first.lineage.artifactID,
  })
}

export function bindDispatchAdapterExecutors(
  input: Record<AgentDispatchAdapterID, DispatchAgentExecute>,
): DispatchAdapterExecutors {
  const keys = Object.keys(input)
  const unknown = keys.filter((id) => !DispatchAdapterContractRegistry.isID(id))
  if (unknown.length > 0) {
    throw new Error(`Unknown dispatch adapter executors: ${unknown.sort().join(", ")}`)
  }
  for (const id of DispatchAdapterContractRegistry.ids) {
    if (typeof input[id] !== "function") {
      throw new Error(`Dispatch adapter ${id} has no bound executor`)
    }
  }
  return Object.freeze({ ...input })
}

export function createDispatchAgentTool(input: {
  taskID: string
  projectedAgents: readonly PromptProfileResolver.ResolvedProjectedAgent[]
  executors: Record<AgentDispatchAdapterID, DispatchAgentExecute>
  signal?: AbortSignal
  openLineage: OpenDispatchAgentLineage
  runInWorktree: RunDispatchAgentInWorktree
}) {
  if (input.projectedAgents.length === 0) {
    throw new Error("dispatch_agent requires at least one projected agent")
  }
  const executors = bindDispatchAdapterExecutors(input.executors)
  const workflowProjection = workflowProjectionFromProjectedAgents(input.projectedAgents)
  const agentsByID = new Map<string, PromptProfileResolver.ResolvedProjectedAgent>()
  const handlersByAgentID = new Map<string, DispatchAgentExecute>()
  const variants: z.ZodObject<any>[] = []
  const projectedInputs = input.projectedAgents.map((projectedAgent) => {
    const adapterInputSchema = DispatchAdapterContractRegistry.inputSchema(
      projectedAgent.identity.dispatchAdapterID,
    ) as z.ZodObject<any>
    const publicAdapterInputSchema =
      projectedAgent.identity.dispatchAdapterID === "build"
        ? adapterInputSchema.omit({ worktreeUsage: true })
        : adapterInputSchema
    return {
      projectedAgent,
      publicAdapterInputSchema,
      acceptedAdapterFields: Object.keys(publicAdapterInputSchema.shape).sort((left, right) =>
        left.localeCompare(right),
      ),
    }
  })
  for (const { projectedAgent, publicAdapterInputSchema, acceptedAdapterFields } of projectedInputs) {
    const { agentID, dispatchAdapterID } = projectedAgent.identity
    if (agentsByID.has(agentID)) {
      throw new Error(`dispatch_agent agent ${agentID} is declared more than once`)
    }
    const execute = executors[dispatchAdapterID]
    agentsByID.set(agentID, projectedAgent)
    handlersByAgentID.set(agentID, execute)
    const commonShape = {
      target: z
        .literal(agentID)
        .describe(
          "Projected expert-squad dispatch target identifier to dispatch through the single scheduler agent-dispatch tool. " +
            `For target ${JSON.stringify(agentID)}, provide only these adapter-specific fields: ${acceptedAdapterFields.join(", ")}; omit fields owned by every other target. ` +
            (dispatchAdapterID === "workload_analysis"
              ? "`goal_ids` contains exact immutable Delivery Slice revision subjects: an empty array produces a zero-Slice review and does not infer Slices from a ContractGraph artifact. For a whole-plan review, copy every exact current Slice revision ref returned by the Architect into `goal_ids`. "
              : "") +
            "Put those adapter-specific fields only in turn.input when turn.kind is initial. Every projected workflow node has one logical occurrence per Task. A continuation uses turn.kind=continuation, names one exact lineage authority, reopens its existing Session for another Turn, and reuses that occurrence. When this adapter accepts exact Delivery Slice revision identifiers, they select contract subjects and never create additional logical occurrences.",
        ),
      work_scope: ProjectedAgentWorkScopeSchema,
      use_worktree: z
        .boolean()
        .describe(
          "Whether this Task-scoped dispatched agent runs in an isolated managed Git worktree. Use true for concurrent write-capable dispatches whose repository ownership requires isolation; read-only or proven-disjoint dispatches may use false.",
        ),
    } as const
    const continuationAuthoritySchema = z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("coordination_action"),
          coordination_action_id: z.string().min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("prior_dispatch"),
          continuation_dispatch_id: z.string().min(1),
        })
        .strict(),
    ])
    const turnSchema = z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("initial"),
          workflow_subject: DispatchWorkflowSubjectSchema.describe(
            "Exact Task workflow subject for this first logical node occurrence.",
          ),
          input: publicAdapterInputSchema.describe(
            `Exact immutable ${agentID} adapter input for the initial worker Turn.`,
          ),
        })
        .strict(),
      z
        .object({
          kind: z.literal("continuation"),
          authority: continuationAuthoritySchema.describe("Exact persisted lineage authority for this successor Turn."),
          guidance: z
            .string()
            .trim()
            .min(1)
            .describe("Only new instruction for this successor Turn; original adapter input remains frozen."),
          evidence_locators: EvidenceLocatorListSchema.default([]).describe(
            "Exact new durable evidence identities selected for this successor Turn. A session_message locator must be Task-owned and pair the Message with its actual producing Session; for a Mission acceptance-repair Task-root message, use the Task root Session authority and never missionSessionID.",
          ),
        })
        .strict(),
    ])
    variants.push(
      z
        .object({
          ...commonShape,
          turn: turnSchema.describe(
            "Explicit initial or continuation Turn authority. Never infer continuation from omitted fields.",
          ),
        })
        .strict(),
    )
  }

  const dispatchSchema = z.discriminatedUnion("target", variants as [z.ZodObject<any>, ...z.ZodObject<any>[]])
  const inputSchema = z
    .object({
      dispatch: dispatchSchema.describe(
        "Exact target-discriminated dispatch request. Select one target and provide only the fields declared by that target's schema.",
      ),
    })
    .strict()

  return tool({
    description:
      "Single scheduler agent dispatch tool. In dispatch, use target to select an exact projected worker identity. Use turn.kind=initial with workflow_subject and target-specific turn.input for a first node occurrence. Use turn.kind=continuation with one explicit lineage authority, guidance, and evidence_locators only for a successor Turn. " +
      "Every call must declare use_worktree. Concurrent write-capable Task dispatches use managed worktrees when repository ownership requires isolation; read-only or proven-disjoint dispatches may use false. " +
      "A newly started worker returns accepted as soon as its durable lineage and Session exist; continue the root control Turn without waiting for that worker. A fast worker may instead return terminal_success, partial, infrastructure_failure, or a coordination request. terminal_success is already terminal: never call wait for it; discover persisted domain facts through artifact_search, exact artifact_read, and artifact_select for semantic sources. " +
      "This replaces separate visible worker-stage tools such as requirements, architect, build, visual_qa, integrity, fact_check, research, workload, intent analysis, and explore.",
    inputSchema,
    outputSchema: DispatchOutcomeSchema,
    execute: async (toolInput, options) => {
      const parsed = inputSchema.parse(toolInput) as {
        dispatch: {
          target: string
          work_scope: unknown
          use_worktree: boolean
          turn:
            | { kind: "initial"; workflow_subject: unknown; input: Record<string, unknown> }
            | {
                kind: "continuation"
                authority:
                  | { kind: "coordination_action"; coordination_action_id: string }
                  | { kind: "prior_dispatch"; continuation_dispatch_id: string }
                guidance: string
                evidence_locators: unknown
              }
        }
      }
      const { target, work_scope: workScope, use_worktree: useWorktree, turn } = parsed.dispatch
      const initialTurn = turn.kind === "initial" ? turn : undefined
      const continuationTurn = turn.kind === "continuation" ? turn : undefined
      const coordinationActionID =
        continuationTurn?.authority.kind === "coordination_action"
          ? continuationTurn.authority.coordination_action_id
          : undefined
      const continuationDispatchID =
        continuationTurn?.authority.kind === "prior_dispatch"
          ? continuationTurn.authority.continuation_dispatch_id
          : undefined
      const continuationGuidance = continuationTurn?.guidance
      const continuationEvidenceLocators = continuationTurn?.evidence_locators
      const workflowSubject = initialTurn?.workflow_subject
      const targetInput = initialTurn?.input ?? {}
      const projectedAgent = agentsByID.get(target)
      const execute = handlersByAgentID.get(target)
      if (!projectedAgent || !execute) {
        throw new Error(`dispatch_agent target ${target} lost its construction-validated runtime binding`)
      }
      const exactWorkScope = ProjectedAgentWorkScopeSchema.parse(workScope)
      const exactWorkflow =
        coordinationActionID || continuationDispatchID
          ? undefined
          : dispatchWorkflowBinding({
              projection: workflowProjection,
              subject: DispatchWorkflowSubjectSchema.parse(workflowSubject),
              targetAgentID: target,
            })
      const deliverySliceRevisionIDs = Array.isArray(targetInput.goal_ids)
        ? targetInput.goal_ids.filter((value): value is string => typeof value === "string")
        : []
      let childSessionID: string | undefined
      let dispatchID: string | undefined
      try {
        const dispatch = await input.openLineage({
          taskID: input.taskID,
          targetAgentID: target,
          projectedAgent,
          workScope: exactWorkScope,
          deliverySliceRevisionIDs,
          ...(exactWorkflow
            ? { workflowBinding: exactWorkflow.binding, workflowNodeID: exactWorkflow.workflowNodeID }
            : {}),
          coordinationActionID,
          continuationDispatchID,
          signal: input.signal,
          toolOptions: options,
          adapterInput: targetInput,
          continuationGuidance,
          evidenceLocators: EvidenceLocatorListSchema.parse(continuationEvidenceLocators ?? []),
        })
        dispatchID = dispatch.dispatchID
        if (input.signal?.aborted) {
          const origin = isExecutionCancellationError(input.signal.reason)
            ? input.signal.reason.origin
            : createExecutionCancellationOrigin({
                actor: "orchestrator",
                source: "dispatch.preparation",
                surface: "orchestrator",
                requestID: dispatch.dispatchID,
                reason: `dispatch_agent ${target} aborted before child session creation`,
                taskID: input.taskID,
              })
          throw new ExecutionCancellationError({
            source: "dispatch_preparation",
            message: `dispatch_agent ${target} aborted before child session creation`,
            origin,
          })
        }
        const executorTargetInput = structuredClone(dispatch.adapterInput)
        const frozenTargetInput = Object.hasOwn(executorTargetInput, "goal_ids")
          ? { ...executorTargetInput, goal_ids: [...dispatch.deliverySliceRevisionIDs] }
          : executorTargetInput
        const adapterInput =
          projectedAgent.identity.dispatchAdapterID === "build"
            ? {
                ...frozenTargetInput,
                worktreeUsage: useWorktree ? "managed_worktree" : "current_project",
              }
            : frozenTargetInput
        const preparedSessionID =
          useWorktree && projectedAgent.identity.dispatchAdapterID !== "build" && !dispatch.existingSessionID
            ? Identifier.descending("session")
            : undefined
        let resolveCommittedLineage!: (lineage: { sessionID: string; artifactID: string }) => void
        const committedLineage = new Promise<{ sessionID: string; artifactID: string }>((resolve) => {
          resolveCommittedLineage = resolve
        })
        const trackedDispatch: DispatchAgentLineageHandle = {
          dispatchID: dispatch.dispatchID,
          deliverySliceRevisionIDs: dispatch.deliverySliceRevisionIDs,
          existingSessionID: dispatch.existingSessionID,
          turn: dispatch.turn,
          adapterInput: dispatch.adapterInput,
          continuationGuidance: dispatch.continuationGuidance,
          observeSession: (sessionID) => {
            if (preparedSessionID && !dispatch.existingSessionID && sessionID !== preparedSessionID) {
              throw new Error(
                `dispatch_agent ${target} created session ${sessionID}; expected preallocated session ${preparedSessionID}`,
              )
            }
            childSessionID = sessionID
            dispatch.observeSession(sessionID)
          },
          commitSession: (sessionID, descriptor) => {
            trackedDispatch.observeSession(sessionID)
            const committed = dispatch.commitSession(sessionID, descriptor)
            resolveCommittedLineage({ sessionID, artifactID: committed.artifactID })
            return committed
          },
        }
        if (dispatch.existingSessionID) {
          childSessionID = dispatch.existingSessionID
          trackedDispatch.observeSession(dispatch.existingSessionID)
        }
        const run = async () => {
          const outcome = await execute(
            adapterInput,
            createDispatchAdapterExecutionContext({
              projectedAgent,
              workScope: exactWorkScope,
              newSessionID: dispatch.existingSessionID ? undefined : preparedSessionID,
              existingSessionID: dispatch.existingSessionID,
              dispatch: trackedDispatch,
              toolOptions: optionsWithVisibleOrchestratorToolName(options, "dispatch_agent"),
            }),
          )
          return DispatchAdapterContractRegistry.outputSchema(projectedAgent.identity.dispatchAdapterID).parse(outcome)
        }
        const execution = () =>
          useWorktree && projectedAgent.identity.dispatchAdapterID !== "build"
            ? (() => {
                const worktreeSessionID = dispatch.existingSessionID ?? preparedSessionID
                if (!worktreeSessionID) {
                  throw new Error(`dispatch_agent ${target} did not allocate its managed-worktree Session identity`)
                }
                return input.runInWorktree({
                  taskID: input.taskID,
                  sessionID: worktreeSessionID,
                  existingSessionID: dispatch.existingSessionID,
                  targetAgentID: target,
                  dispatchID: dispatch.dispatchID,
                  run,
                })
              })()
            : run()
        return await detachDispatchExecution({
          execution,
          committedLineage,
          runAsActivity: runAsInstanceActivity,
          deliver: async ({ sessionID: completedSessionID }) => {
            const { ProtocolStore } = await import("@/protocol/store")
            const descriptor = WorkerTurnDescriptor.findForDispatch({
              sessionID: completedSessionID,
              dispatchID: dispatch.dispatchID,
            })
            if (!descriptor) {
              throw new Error(
                `dispatch_agent ${target} completed without a Turn descriptor for dispatch ${dispatch.dispatchID}`,
              )
            }
            const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
              completedSessionID,
              "agent.execution.lifecycle",
              descriptor.payload.messageAuthority.user_message_id,
            )
            if (!lifecycle) {
              throw new Error(
                `dispatch_agent ${target} completed without a canonical lifecycle event for Session ${completedSessionID}`,
              )
            }
            const { dispatchTaskLoop } = await import("@/engine/queue")
            await dispatchTaskLoop({
              taskID: input.taskID,
              event: {
                note: `Worker Session ${completedSessionID} completed dispatch ${dispatch.dispatchID}.`,
                agentLifecycleDelivery: {
                  eventID: lifecycle.id,
                  sessionID: completedSessionID,
                  dispatchID: dispatch.dispatchID,
                },
              },
            })
          },
          onDeliveryFailure: ({ sessionID: completedSessionID, error }) => {
            log.error("detached dispatch completion delivery failed", {
              taskID: input.taskID,
              target,
              dispatchID: dispatch.dispatchID,
              sessionID: completedSessionID,
              error: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : undefined,
            })
          },
        })
      } catch (error) {
        if (error instanceof WorkflowNodeOccurrenceConflictError) {
          return DispatchOutcome.infrastructureFailure({
            operation: "workflow_node_initial_claim",
            message: error.message,
            errorName: error.name,
            recoveryAuthority: { occurrence_status: "occurrence_not_committed" },
            failureIssues: [
              {
                code: error.code,
                path: ["dispatch", "turn", "workflow_subject", "node_id"],
                message: error.message,
              },
            ],
          })
        }
        if (error instanceof WorkerTurnSettlementError) {
          if (!dispatchID) throw error
          return DispatchOutcome.infrastructureFailure({
            operation: error.operation,
            message: error.message,
            errorName: error.name,
            sessionID: error.sessionID,
            finalMessageID: error.finalMessageID,
            workerTurn: error.evidence,
            recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID: input.taskID, dispatchID }),
            failureIssues: [
              {
                code: error.causeErrorName,
                path: ["worker_turn", error.operation],
                message: error.causeMessage,
              },
            ],
            ...(error.infrastructureArtifactID
              ? {
                  infrastructureError: exactEngineArtifactLocator({
                    taskID: input.taskID,
                    artifactID: error.infrastructureArtifactID,
                  }),
                }
              : {}),
          })
        }
        if (isExecutionCancellationError(error)) {
          if (childSessionID && error.sessionID !== childSessionID) {
            throw new ExecutionCancellationError({
              source: error.source,
              message: error.message,
              sessionID: childSessionID,
              origin: { ...error.origin, targetSessionID: childSessionID },
              cause: error,
            })
          }
          throw error
        }
        if (input.signal?.aborted) {
          if (childSessionID) {
            const origin = isExecutionCancellationError(input.signal.reason)
              ? { ...input.signal.reason.origin, targetSessionID: childSessionID }
              : createExecutionCancellationOrigin({
                  actor: "orchestrator",
                  source: "dispatch.preparation",
                  surface: "orchestrator",
                  ...(dispatchID ? { requestID: dispatchID } : {}),
                  reason: error instanceof Error ? error.message : String(error),
                  targetSessionID: childSessionID,
                  taskID: input.taskID,
                })
            throw new ExecutionCancellationError({
              source: "session_prompt",
              message: error instanceof Error ? error.message : String(error),
              sessionID: childSessionID,
              origin,
              cause: error,
            })
          }
          throw error
        }
        if (!dispatchID) throw error
        return DispatchOutcome.infrastructureFailure({
          operation: `${projectedAgent.identity.dispatchAdapterID}_adapter`,
          message: error instanceof Error ? error.message : String(error),
          sessionID: childSessionID,
          recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID: input.taskID, dispatchID }),
        })
      }
    },
  })
}
