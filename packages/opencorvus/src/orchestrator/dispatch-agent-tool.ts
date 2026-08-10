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
import { TaskWorkflowBindingConflictError } from "@/engine/workflow-binding-facts"
import { resolveDispatchOccurrenceAuthority } from "@/engine/dispatch-lineage"
import { Log } from "@/util/log"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"

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

export type RunDetachedDispatch = <T>(run: () => Promise<T>) => Promise<T>

const detachedDispatchPipelines = new Set<Promise<void>>()
const detachedDispatchPipelineFailures = new Map<string, { generation: number; error: unknown }>()
const detachedDispatchPipelineGenerations = new Map<string, number>()
let detachedDispatchPipelineGeneration = 0
let detachedDispatchSettlementGate: symbol | undefined

function reserveDetachedDispatchPipeline(): (input: {
  pipeline: Promise<void>
  dispatchLineageID?: string
}) => void {
  if (detachedDispatchSettlementGate) {
    throw new Error("Detached dispatch admission is closed for runtime settlement")
  }
  const runtimeReservation = RuntimeExecutionSettlement.reserve(
    "detached_dispatch_pipeline",
    `detached-dispatch-pipeline:${detachedDispatchPipelineGeneration + 1}`,
  )
  let settle!: (pipeline: Promise<void>) => void
  const reservation = new Promise<void>((resolve, reject) => {
    settle = (pipeline) => void pipeline.then(resolve, reject)
  })
  detachedDispatchPipelines.add(reservation)
  runtimeReservation.settleWith(reservation)
  let committed = false
  return ({ pipeline, dispatchLineageID }) => {
    if (committed) throw new Error("Detached dispatch pipeline reservation was already committed")
    committed = true
    const generation = ++detachedDispatchPipelineGeneration
    if (dispatchLineageID) detachedDispatchPipelineGenerations.set(dispatchLineageID, generation)
    void reservation
      .then(
        () => {
          if (
            dispatchLineageID &&
            detachedDispatchPipelineGenerations.get(dispatchLineageID) === generation
          ) {
            detachedDispatchPipelineFailures.delete(dispatchLineageID)
            detachedDispatchPipelineGenerations.delete(dispatchLineageID)
          }
        },
        (error) => {
          if (
            dispatchLineageID &&
            detachedDispatchPipelineGenerations.get(dispatchLineageID) === generation
          ) {
            detachedDispatchPipelineFailures.set(dispatchLineageID, { generation, error })
          }
        },
      )
      .finally(() => detachedDispatchPipelines.delete(reservation))
    settle(pipeline)
  }
}

/**
 * Clear one process-local failed pipeline barrier only after the exact durable
 * dispatch occurrence has acquired a replacement root-delivery authority.
 * Callers must prove that authority from the committed lineage/ingress; this
 * function deliberately accepts no Session-wide or Task-wide fallback key.
 */
export function settleDetachedDispatchPipelineRecovery(dispatchLineageID: string): void {
  const exactID = dispatchLineageID.trim()
  if (!exactID) throw new Error("Detached dispatch recovery requires an exact dispatch lineage Artifact ID")
  detachedDispatchPipelineFailures.delete(exactID)
  detachedDispatchPipelineGenerations.delete(exactID)
}

export type DetachedDispatchSettlementGate = Disposable & {
  waitForIdle(): Promise<void>
}

export function acquireDetachedDispatchSettlementGate(): DetachedDispatchSettlementGate {
  if (detachedDispatchSettlementGate) throw new Error("Detached dispatch settlement is already in progress")
  const token = Symbol("detached-dispatch-settlement")
  detachedDispatchSettlementGate = token
  return {
    async waitForIdle() {
      while (detachedDispatchPipelines.size > 0) {
        await Promise.allSettled([...detachedDispatchPipelines])
      }
      if (detachedDispatchPipelineFailures.size > 0) {
        const failures = [...detachedDispatchPipelineFailures.entries()].map(
          ([dispatchLineageID, failure]) =>
            new Error(
              `Detached dispatch lineage ${dispatchLineageID} has no successful replacement delivery authority`,
              { cause: failure.error },
            ),
        )
        throw new AggregateError(
          failures,
          `Failed to settle ${failures.length} detached dispatch pipeline(s)`,
        )
      }
    },
    [Symbol.dispose]: () => {
      if (detachedDispatchSettlementGate === token) detachedDispatchSettlementGate = undefined
    },
  }
}

export async function waitForDetachedDispatchPipelinesForTest(): Promise<void> {
  while (detachedDispatchPipelines.size > 0) await Promise.all([...detachedDispatchPipelines])
}

function workerTurnSettlementFailureOutcome(input: {
  taskID: string
  dispatchID: string
  error: WorkerTurnSettlementError
}): Extract<DispatchOutcomeResult, { kind: "infrastructure_failure" }> {
  const outcome = DispatchOutcome.infrastructureFailure({
    operation: input.error.operation,
    message: input.error.message,
    errorName: input.error.name,
    sessionID: input.error.sessionID,
    finalMessageID: input.error.finalMessageID,
    workerTurn: input.error.evidence,
    recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID: input.taskID, dispatchID: input.dispatchID }),
    failureIssues: [
      {
        code: input.error.causeErrorName,
        path: ["worker_turn", input.error.operation],
        message: input.error.causeMessage,
      },
    ],
    ...(input.error.infrastructureArtifactID
      ? {
          infrastructureError: exactEngineArtifactLocator({
            taskID: input.taskID,
            artifactID: input.error.infrastructureArtifactID,
          }),
        }
      : {}),
  })
  if (outcome.kind !== "infrastructure_failure") {
    throw new Error("Worker Turn settlement failure constructor returned a non-infrastructure outcome")
  }
  return outcome
}

export async function detachDispatchExecution(input: {
  execute: () => Promise<DispatchOutcomeResult>
  runDetached: RunDetachedDispatch
  runDetachedRecovery: RunDetachedDispatch
  committedLineage: Promise<{ sessionID: string; artifactID: string }>
  deliver: (input: { sessionID: string; outcome?: DispatchOutcomeResult; executionError?: unknown }) => Promise<void>
  onDeliveryFailure: (input: {
    sessionID: string
    outcome?: DispatchOutcomeResult
    executionError?: unknown
    error: unknown
  }) => void | Promise<void>
  onPipelineOwnerCleanupFailure: (input: { sessionID: string; error: unknown }) => void | Promise<void>
}): Promise<DispatchOutcomeResult> {
  const commitPipelineReservation = reserveDetachedDispatchPipeline()
  const execution = Promise.resolve().then(() => input.runDetached(input.execute))
  let first:
    | { kind: "completed"; outcome: DispatchOutcomeResult }
    | { kind: "accepted"; lineage: { sessionID: string; artifactID: string } }
  try {
    first = await Promise.race([
      execution.then((outcome) => ({ kind: "completed" as const, outcome })),
      input.committedLineage.then((lineage) => ({ kind: "accepted" as const, lineage })),
    ])
  } catch (error) {
    commitPipelineReservation({
      pipeline: execution.then(
        () => undefined,
        () => undefined,
      ),
    })
    throw error
  }
  if (first.kind === "completed") {
    commitPipelineReservation({ pipeline: Promise.resolve() })
    return first.outcome
  }
  const supervisedPipeline = (async () => {
    const deliveryInput = await execution.then(
      (outcome) => ({ sessionID: first.lineage.sessionID, outcome }),
      (executionError) => ({ sessionID: first.lineage.sessionID, executionError }),
    )
    const deliverWithRecovery = async () => {
      try {
        await input.deliver(deliveryInput)
      } catch (error) {
        await input.onDeliveryFailure({ ...deliveryInput, error })
      }
    }
    const publishOwnerCleanupFailure = async (ownerError: unknown) => {
      await input.runDetachedRecovery(async () => {
        await input.onPipelineOwnerCleanupFailure({ sessionID: first.lineage.sessionID, error: ownerError })
      })
    }
    for (let ownerAttempt = 1; ownerAttempt <= 2; ownerAttempt += 1) {
      let callbackCompleted = false
      try {
        await input.runDetached(async () => {
          await deliverWithRecovery()
          callbackCompleted = true
        })
        return
      } catch (ownerError) {
        if (!callbackCompleted && ownerAttempt < 2) continue
        if (callbackCompleted) {
          await publishOwnerCleanupFailure(ownerError)
          return
        }
        let recoveryCompleted = false
        try {
          await input.runDetachedRecovery(async () => {
            await deliverWithRecovery()
            recoveryCompleted = true
          })
          return
        } catch (recoveryError) {
          if (recoveryCompleted) {
            await publishOwnerCleanupFailure(recoveryError)
            return
          }
          throw new AggregateError(
            [ownerError, recoveryError],
            `Detached dispatch ${first.lineage.sessionID} exhausted delivery owners`,
          )
        }
      }
    }
  })()
  commitPipelineReservation({
    pipeline: supervisedPipeline,
    dispatchLineageID: first.lineage.artifactID,
  })
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
  runDetached: RunDetachedDispatch
  runDetachedRecovery: RunDetachedDispatch
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
            "Exact Task workflow subject for this first logical node occurrence. After any virtual workflow node has committed, every later initial dispatch must name another node from that same selected virtual workflow; direct is valid only before the Task has selected a virtual workflow.",
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
      "A Task has one immutable workflow binding: after the first virtual-workflow initial dispatch commits, every later initial dispatch must use a node from that same workflow; never switch to direct. Direct initial dispatches are only for a Task that has not selected a virtual workflow. " +
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
        const executeDetached = async () => {
          if (useWorktree && projectedAgent.identity.dispatchAdapterID !== "build") {
            const worktreeSessionID = dispatch.existingSessionID ?? preparedSessionID
            if (!worktreeSessionID) {
              throw new Error(`dispatch_agent ${target} did not allocate its managed-worktree Session identity`)
            }
            return await input.runInWorktree({
              taskID: input.taskID,
              sessionID: worktreeSessionID,
              existingSessionID: dispatch.existingSessionID,
              targetAgentID: target,
              dispatchID: dispatch.dispatchID,
              run,
            })
          }
          return await run()
        }
        return await detachDispatchExecution({
          execute: executeDetached,
          runDetached: input.runDetached,
          runDetachedRecovery: input.runDetachedRecovery,
          committedLineage,
          deliver: async ({ sessionID: completedSessionID, outcome, executionError }) => {
            const { dispatchTaskLoop, reconcileTerminalAgentLifecycleDelivery } = await import("@/engine/queue")
            const completedOutcome =
              outcome ??
              (executionError instanceof WorkerTurnSettlementError
                ? workerTurnSettlementFailureOutcome({
                    taskID: input.taskID,
                    dispatchID: dispatch.dispatchID,
                    error: executionError,
                  })
                : undefined)
            if (completedOutcome?.kind === "infrastructure_failure") {
              const infrastructureFactID = completedOutcome.infrastructure_error?.artifact_id
              if (!infrastructureFactID) {
                throw new Error(
                  `dispatch_agent ${target} infrastructure outcome has no durable Artifact for Session ${completedSessionID}`,
                )
              }
              await dispatchTaskLoop({
                taskID: input.taskID,
                event: {
                  note: `Accepted worker Session ${completedSessionID} failed ${completedOutcome.operation}`,
                  dispatchInfrastructureFailure: { infrastructureFactID, outcome: completedOutcome },
                },
              })
              return
            }
            if (executionError) throw executionError
            const result = await reconcileTerminalAgentLifecycleDelivery({
              taskID: input.taskID,
              sessionID: completedSessionID,
              dispatchID: dispatch.dispatchID,
            })
            if (result !== "delivered" && result !== "already_delivered") {
              throw new Error(
                `dispatch_agent ${target} completion delivery is ${result} for Session ${completedSessionID}`,
              )
            }
          },
          onDeliveryFailure: async ({ sessionID: completedSessionID, outcome, executionError, error }) => {
            log.error("detached dispatch completion delivery failed", {
              taskID: input.taskID,
              target,
              dispatchID: dispatch.dispatchID,
              sessionID: completedSessionID,
              error: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : undefined,
            })
            let infrastructureOutcome: Extract<DispatchOutcomeResult, { kind: "infrastructure_failure" }> | undefined
            if (outcome?.kind === "infrastructure_failure") infrastructureOutcome = outcome
            if (!infrastructureOutcome && executionError instanceof WorkerTurnSettlementError) {
              infrastructureOutcome = workerTurnSettlementFailureOutcome({
                taskID: input.taskID,
                dispatchID: dispatch.dispatchID,
                error: executionError,
              })
            }
            if (executionError && !infrastructureOutcome) {
              const { recordTaskInfrastructureError } = await import("@/engine/persist")
              const infrastructureArtifactID = recordTaskInfrastructureError({
                taskID: input.taskID,
                component: "dispatch-agent",
                operation: "execute-detached-worker",
                reason:
                  executionError instanceof Error
                    ? `${executionError.name}: ${executionError.message}`
                    : String(executionError),
                errorName: executionError instanceof Error ? executionError.name : undefined,
                sessionID: completedSessionID,
                context: { target, dispatchID: dispatch.dispatchID },
              })
              const failedOutcome = DispatchOutcome.infrastructureFailure({
                operation: "execute-detached-worker",
                message: executionError instanceof Error ? executionError.message : String(executionError),
                errorName: executionError instanceof Error ? executionError.name : undefined,
                sessionID: completedSessionID,
                recoveryAuthority: resolveDispatchOccurrenceAuthority({
                  taskID: input.taskID,
                  dispatchID: dispatch.dispatchID,
                }),
                infrastructureError: exactEngineArtifactLocator({
                  taskID: input.taskID,
                  artifactID: infrastructureArtifactID,
                }),
              })
              if (failedOutcome.kind !== "infrastructure_failure") {
                throw new Error("Detached worker failure constructor returned a non-infrastructure outcome")
              }
              infrastructureOutcome = failedOutcome
            }
            if (infrastructureOutcome) {
              const infrastructureFactID = infrastructureOutcome.infrastructure_error?.artifact_id
              if (!infrastructureFactID) {
                throw new Error(
                  `Detached dispatch infrastructure recovery has no durable fact for ${completedSessionID}`,
                )
              }
              const { dispatchTaskLoop } = await import("@/engine/queue")
              const result = await dispatchTaskLoop({
                taskID: input.taskID,
                event: {
                  note: `Accepted worker Session ${completedSessionID} failed ${infrastructureOutcome.operation}`,
                  dispatchInfrastructureFailure: { infrastructureFactID, outcome: infrastructureOutcome },
                },
              })
              if (result === "started" || result === "queued") return
              throw new Error(`Detached dispatch infrastructure ingress is ${result} for ${completedSessionID}`)
            }
            const { reconcileTerminalAgentLifecycleDelivery } = await import("@/engine/queue")
            const result = await reconcileTerminalAgentLifecycleDelivery({
              taskID: input.taskID,
              sessionID: completedSessionID,
              dispatchID: dispatch.dispatchID,
            })
            if (result === "delivered" || result === "already_delivered") return
            throw new Error(`Detached worker lifecycle recovery is ${result} for Session ${completedSessionID}`)
          },
          onPipelineOwnerCleanupFailure: async ({ sessionID: completedSessionID, error }) => {
            const { recordTaskInfrastructureError } = await import("@/engine/persist")
            const infrastructureArtifactID = recordTaskInfrastructureError({
              taskID: input.taskID,
              component: "dispatch-agent",
              operation: "settle-detached-pipeline-owner",
              reason: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
              errorName: error instanceof Error ? error.name : undefined,
              sessionID: completedSessionID,
              context: { target, dispatchID: dispatch.dispatchID },
            })
            const outcome = DispatchOutcome.infrastructureFailure({
              operation: "settle-detached-pipeline-owner",
              message: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : undefined,
              sessionID: completedSessionID,
              recoveryAuthority: resolveDispatchOccurrenceAuthority({
                taskID: input.taskID,
                dispatchID: dispatch.dispatchID,
              }),
              infrastructureError: exactEngineArtifactLocator({
                taskID: input.taskID,
                artifactID: infrastructureArtifactID,
              }),
              failureIssues: [
                {
                  code: error instanceof Error ? error.name : "PipelineOwnerCleanupError",
                  path: ["detached_pipeline", "owner_cleanup"],
                  message: error instanceof Error ? error.message : String(error),
                },
              ],
            })
            if (outcome.kind !== "infrastructure_failure") {
              throw new Error("Detached pipeline owner failure constructor returned a non-infrastructure outcome")
            }
            const { dispatchTaskLoop } = await import("@/engine/queue")
            await dispatchTaskLoop({
              taskID: input.taskID,
              event: {
                note: `Accepted worker Session ${completedSessionID} pipeline owner cleanup failed`,
                dispatchInfrastructureFailure: {
                  infrastructureFactID: infrastructureArtifactID,
                  outcome,
                },
              },
            })
          },
        })
      } catch (error) {
        if (error instanceof TaskWorkflowBindingConflictError) {
          return DispatchOutcome.infrastructureFailure({
            operation: "workflow_binding_initial_claim",
            message: error.message,
            errorName: error.name,
            recoveryAuthority: { occurrence_status: "occurrence_not_committed" },
            failureIssues: [
              {
                code: error.code,
                path: ["dispatch", "turn", "workflow_subject"],
                message: error.message,
              },
            ],
          })
        }
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
          return workerTurnSettlementFailureOutcome({ taskID: input.taskID, dispatchID, error })
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
