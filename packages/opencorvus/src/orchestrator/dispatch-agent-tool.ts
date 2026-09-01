import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { tool } from "ai"
import z from "zod"
import { ProjectedAgentWorkScopeSchema } from "@/agent/projected-agent-work-scope"
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
import type { DispatchTurn } from "./dispatch-turn-projection"
import type { ActiveTaskAcceptanceRepair } from "@/mission/acceptance-ledger"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import path from "node:path"
import { EvidenceLocatorInputListSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { resolveTaskEvidenceLocators } from "@/engine/evidence-locator"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { Session } from "@/session"
import type { EvidenceLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { WorkerTurnSettlementError } from "@/agent/runner"
import { taskCancellationAuthorityExecutionError } from "@/engine/cancellation-projection"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import { WorkflowNodeOccurrenceConflictError } from "@/engine/dispatch-lineage"
import { TaskWorkflowBindingConflictError } from "@/engine/workflow-binding-facts"
import { resolveDispatchOccurrenceAuthority } from "@/engine/dispatch-lineage"
import { Log } from "@/util/log"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { settleDispatchOrReturnExisting } from "@/engine/dispatch-settlement"

const log = Log.create({ service: "dispatch-agent-tool" })

export type DispatchAgentExecute = (
  args: unknown,
  context: DispatchAdapterExecutionContext,
) => Promise<DispatchOutcomeResult>
export type DispatchAdapterExecutors = Readonly<Record<AgentDispatchAdapterID, DispatchAgentExecute>>

export type AcceptanceRepairSelection = Readonly<{
  gap_id: string
  ledger_revision_artifact_id: string
  execution_epoch: number
  criterion_ids: string[]
}>

type DispatchAgentLineageHandleBase = {
  readonly dispatchID: string
  readonly deliverySliceRevisionIDs: readonly string[]
  /** Exact existing worker Session reused by continuation or coordination redispatch. */
  readonly existingSessionID?: string
  /** Preallocated identity for a new worker Session, claimed before any physical effect. */
  readonly newSessionID?: string
  readonly adapterInput: Readonly<Record<string, unknown>>
  /** Combined caller and fenced admission cancellation for the physical effect. */
  readonly signal: AbortSignal
  readonly continuationGuidance?: string
  /** Observe the physical Session identity without publishing logical dispatch lineage. */
  observeSession(sessionID: string): void
  /** Commit logical dispatch authority only after the exact Turn descriptor is durable. */
  commitSession(sessionID: string, descriptor: WorkerTurnDescriptor.Info): { artifactID: string }
  /** Release pre-effect physical ownership after preparation fails. */
  releaseAdmission(): void
}

export type LiveDispatchAgentLineageHandle = DispatchAgentLineageHandleBase & {
  readonly replayOutcome?: never
  /** Exact visible user-Turn authority and immutable workflow occurrence for this dispatch. */
  readonly turn: DispatchTurn
}

export type DispatchAgentLineageHandle =
  | LiveDispatchAgentLineageHandle
  | (DispatchAgentLineageHandleBase & {
      /** Durable result for an exact replay of an already committed parent tool occurrence. */
      readonly replayOutcome: DispatchOutcomeResult
      readonly turn?: DispatchTurn
    })

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
  acceptanceRepair?: AcceptanceRepairSelection
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
/** Lineages whose delivery pipeline is still running in this process. */
const detachedDispatchPipelinesInFlight = new Set<string>()
let detachedDispatchPipelineGeneration = 0
let detachedDispatchSettlementGate: symbol | undefined

function reserveDetachedDispatchPipeline(): (input: { pipeline: Promise<void>; dispatchLineageID?: string }) => void {
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
    if (dispatchLineageID) {
      detachedDispatchPipelineGenerations.set(dispatchLineageID, generation)
      detachedDispatchPipelinesInFlight.add(dispatchLineageID)
    }
    void reservation
      .then(
        () => {
          if (dispatchLineageID && detachedDispatchPipelineGenerations.get(dispatchLineageID) === generation) {
            detachedDispatchPipelineFailures.delete(dispatchLineageID)
            detachedDispatchPipelineGenerations.delete(dispatchLineageID)
          }
        },
        (error) => {
          if (dispatchLineageID && detachedDispatchPipelineGenerations.get(dispatchLineageID) === generation) {
            detachedDispatchPipelineFailures.set(dispatchLineageID, { generation, error })
          }
        },
      )
      .finally(() => {
        detachedDispatchPipelines.delete(reservation)
        if (dispatchLineageID) detachedDispatchPipelinesInFlight.delete(dispatchLineageID)
      })
    settle(pipeline)
  }
}

/**
 * Whether this process still owns a detached delivery pipeline for the exact
 * dispatch lineage. Abandonment recovery consults it before settling a
 * dispatch on the owner's behalf: a committed lineage whose pipeline is still
 * registered here is live work, not an orphan.
 */
export function hasLiveDetachedDispatchPipeline(dispatchLineageID: string): boolean {
  return detachedDispatchPipelinesInFlight.has(dispatchLineageID)
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
        throw new AggregateError(failures, `Failed to settle ${failures.length} detached dispatch pipeline(s)`)
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

const dispatchAgentToolLineageHooks = new WeakMap<object, OpenDispatchAgentLineage>()

export const DispatchAgentToolTestHooks = Object.freeze({
  openLineage(tool: object): OpenDispatchAgentLineage {
    const openLineage = dispatchAgentToolLineageHooks.get(tool)
    if (!openLineage) throw new Error("Dispatch Agent Tool lineage hook is unavailable")
    return openLineage
  },
})

export function createDispatchAgentTool(input: {
  taskID: string
  projectedAgents: readonly PromptProfileResolver.ResolvedProjectedAgent[]
  executors: Record<AgentDispatchAdapterID, DispatchAgentExecute>
  signal?: AbortSignal
  openLineage: OpenDispatchAgentLineage
  runInWorktree: RunDispatchAgentInWorktree
  runDetached: RunDetachedDispatch
  runDetachedRecovery: RunDetachedDispatch
  acceptanceRepair?: ActiveTaskAcceptanceRepair
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
    const publicAdapterInputSchema = DispatchAdapterContractRegistry.modelFacingInputSchema(
      projectedAgent.identity.dispatchAdapterID,
    )
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
            DispatchAdapterContractRegistry.modelGuidance(dispatchAdapterID) +
            "Put those adapter-specific fields only in turn.input when turn.kind is initial. Every projected workflow node has one logical occurrence per Task. A continuation uses turn.kind=continuation, names one exact lineage authority, reopens its existing Session for another Turn, and reuses that occurrence. When this adapter accepts exact Delivery Slice revision identifiers, they select contract subjects and never create additional logical occurrences.",
        ),
      work_scope: ProjectedAgentWorkScopeSchema,
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
          use_worktree: z
            .boolean()
            .describe(
              "Whether this Task-scoped dispatched agent runs in an isolated managed Git worktree. Use true for concurrent write-capable dispatches whose repository ownership requires isolation; read-only or proven-disjoint dispatches may use false. This choice belongs to the initial Turn alone: it fixes the worker Session's directory, which every continuation of that Session then inherits.",
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
          evidence_locators: EvidenceLocatorInputListSchema.default([]).describe(
            "Exact new durable evidence identities selected for this successor Turn. Name each Artifact by its exact revision or snapshot path only; the Host reads the digest, byte count, and media type itself, so never restate a content digest here. A session_message locator must be Task-owned and pair the Message with its actual producing Session; for a Mission acceptance-repair Task-root message, use the Task root Session authority and never missionSessionID.",
          ),
          ...(input.acceptanceRepair
            ? {
                acceptance_gap_id: z
                  .literal(input.acceptanceRepair.revision.gap.gap_id)
                  .describe("Exact current Mission acceptance gap consumed by this continuation."),
                criterion_ids: z
                  .array(
                    z
                      .string()
                      .refine(
                        (criterionID) =>
                          input.acceptanceRepair!.revision.gap.criteria.some(
                            (criterion) => criterion.criterion_id === criterionID,
                          ),
                        "Criterion is not open in the current Mission acceptance gap.",
                      ),
                  )
                  .min(1)
                  .max(64)
                  .describe("Only current gap criteria this worker continuation must consume."),
              }
            : {}),
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

  const dispatchTool = tool({
    description:
      "Single scheduler agent dispatch tool. In dispatch, use target to select an exact projected worker identity. Use turn.kind=initial with workflow_subject and target-specific turn.input for a first node occurrence. Use turn.kind=continuation with one explicit lineage authority, guidance, and evidence_locators only for a successor Turn. " +
      "A Task has one immutable workflow binding: after the first virtual-workflow initial dispatch commits, every later initial dispatch must use a node from that same workflow; never switch to direct. Direct initial dispatches are only for a Task that has not selected a virtual workflow. " +
      "Every call must declare use_worktree. Concurrent write-capable Task dispatches use managed worktrees when repository ownership requires isolation; read-only or proven-disjoint dispatches may use false. " +
      "A newly started worker returns accepted as soon as its durable lineage and Session exist; continue the root control Turn without waiting for that worker. A fast worker may instead return terminal_success, domain_incomplete, domain_blocked, partial, infrastructure_failure, or a coordination request. domain_incomplete carries the exact durable but incomplete domain Artifact and never opens workflow successors. domain_blocked carries the exact domain Artifact and unanswered blocker Question occurrence and also keeps successors closed. terminal_success is already terminal: never call wait for it; discover persisted domain facts through artifact_search, read each artifact_locator_ref completely, and select semantic sources with artifact_read_ref. " +
      "This replaces separate visible worker-stage tools such as requirements, architect, build, visual_qa, integrity, fact_check, research, workload, intent analysis, and explore.",
    inputSchema,
    outputSchema: DispatchOutcomeSchema,
    execute: async (toolInput, options) => {
      const parsed = inputSchema.parse(toolInput) as {
        dispatch: {
          target: string
          work_scope: unknown
          turn:
            | {
                kind: "initial"
                workflow_subject: unknown
                use_worktree: boolean
                input: Record<string, unknown>
              }
            | {
                kind: "continuation"
                authority:
                  | { kind: "coordination_action"; coordination_action_id: string }
                  | { kind: "prior_dispatch"; continuation_dispatch_id: string }
                guidance: string
                evidence_locators: unknown
                acceptance_gap_id?: string
                criterion_ids?: string[]
              }
        }
      }
      const { target, work_scope: workScope, turn } = parsed.dispatch
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
      const acceptanceRepair = input.acceptanceRepair
        ? continuationTurn?.acceptance_gap_id && continuationTurn.criterion_ids
          ? {
              gap_id: continuationTurn.acceptance_gap_id,
              ledger_revision_artifact_id: input.acceptanceRepair.artifactID,
              execution_epoch: input.acceptanceRepair.executionEpoch,
              criterion_ids: continuationTurn.criterion_ids,
            }
          : undefined
        : undefined
      if (input.acceptanceRepair && !acceptanceRepair) {
        throw new Error(`dispatch_agent acceptance-repair continuation is missing its current gap or criteria.`)
      }
      if (input.acceptanceRepair && initialTurn) {
        throw new Error(
          `dispatch_agent must continue an existing workflow occurrence while acceptance gap ${input.acceptanceRepair.revision.gap.gap_id} is active.`,
        )
      }
      const workflowSubject = initialTurn?.workflow_subject
      const targetInput = initialTurn?.input ?? {}
      const projectedAgent = agentsByID.get(target)
      const execute = handlersByAgentID.get(target)
      if (!projectedAgent || !execute) {
        throw new Error(`dispatch_agent target ${target} lost its construction-validated runtime binding`)
      }
      const cancellation = taskCancellationAuthorityExecutionError(input.taskID, `dispatch_agent ${target} preparation`)
      if (cancellation) throw cancellation
      const exactWorkScope = ProjectedAgentWorkScopeSchema.parse(workScope)
      const exactWorkflow =
        coordinationActionID || continuationDispatchID
          ? undefined
          : dispatchWorkflowBinding({
              projection: workflowProjection,
              subject: DispatchWorkflowSubjectSchema.parse(workflowSubject),
              targetAgentID: target,
            })
      const deliverySliceRevisionIDs = DispatchAdapterContractRegistry.deliverySliceRevisionIDs(
        projectedAgent.identity.dispatchAdapterID,
        targetInput,
      )
      let childSessionID: string | undefined
      let dispatchID: string | undefined
      let openedDispatch: DispatchAgentLineageHandle | undefined
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
          ...(acceptanceRepair ? { acceptanceRepair } : {}),
          evidenceLocators: await resolveTaskEvidenceLocators({
            taskID: input.taskID,
            evidenceLocators: continuationEvidenceLocators ?? [],
          }),
        })
        openedDispatch = dispatch
        if (dispatch.replayOutcome) return dispatch.replayOutcome
        if (!dispatch.turn) throw new Error(`dispatch_agent ${target} live dispatch has no exact Turn authority`)
        const dispatchTurn = dispatch.turn
        const executionSignal = input.signal ? AbortSignal.any([input.signal, dispatch.signal]) : dispatch.signal
        executionSignal.throwIfAborted()
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
        // Worktree placement belongs to the Session, not to this call. The
        // initial Turn fixed the worker Session's directory; a continuation
        // reopens that exact Session and inherits it. luna11 showed what
        // restating it costs: the caller flipped the flag between Turns and
        // BuildAgent refused with a directory mismatch it could not act on,
        // after which the caller issued a second initial dispatch and hit the
        // one-occurrence fence.
        const useWorktree = dispatch.existingSessionID
          ? path.resolve((await Session.get(dispatch.existingSessionID)).directory) !==
            path.resolve(taskPrimaryProjectRoot(input.taskID))
          : (initialTurn?.use_worktree ?? false)
        const executorTargetInput = structuredClone(dispatch.adapterInput)
        const frozenTargetInput = DispatchAdapterContractRegistry.withDeliverySliceRevisionIDs(
          projectedAgent.identity.dispatchAdapterID,
          executorTargetInput,
          dispatch.deliverySliceRevisionIDs,
        )
        const adapterInput = DispatchAdapterContractRegistry.ownsWorktreeUsage(
          projectedAgent.identity.dispatchAdapterID,
        )
          ? {
              ...frozenTargetInput,
              worktreeUsage: useWorktree ? "managed_worktree" : "current_project",
            }
          : frozenTargetInput
        const preparedSessionID = dispatch.newSessionID
        if (!dispatch.existingSessionID && !preparedSessionID) {
          throw new Error(`dispatch_agent ${target} has no preclaimed worker Session identity`)
        }
        let resolveCommittedLineage!: (lineage: { sessionID: string; artifactID: string }) => void
        const committedLineage = new Promise<{ sessionID: string; artifactID: string }>((resolve) => {
          resolveCommittedLineage = resolve
        })
        const trackedDispatch: LiveDispatchAgentLineageHandle = {
          dispatchID: dispatch.dispatchID,
          deliverySliceRevisionIDs: dispatch.deliverySliceRevisionIDs,
          existingSessionID: dispatch.existingSessionID,
          newSessionID: dispatch.newSessionID,
          turn: dispatchTurn,
          adapterInput: dispatch.adapterInput,
          signal: executionSignal,
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
          releaseAdmission: () => dispatch.releaseAdmission(),
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
              toolOptions: options,
            }),
          )
          const parsed = DispatchAdapterContractRegistry.outputSchema(projectedAgent.identity.dispatchAdapterID).parse(
            outcome,
          )
          if (parsed.kind !== "accepted" && (parsed.kind !== "infrastructure_failure" || parsed.session_id)) {
            return settleDispatchOrReturnExisting({
              taskID: input.taskID,
              dispatchID: dispatch.dispatchID,
              outcome: parsed,
            }).payload.outcome
          }
          return parsed
        }
        const executeDetached = async () => {
          if (
            useWorktree &&
            !DispatchAdapterContractRegistry.ownsWorktreeUsage(projectedAgent.identity.dispatchAdapterID)
          ) {
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
            const { dispatchTaskLoop, reconcileTerminalAgentLifecycleDelivery } = await import(
              "@/engine/task-root-ingress-delivery"
            )
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
            if (
              result !== "delivered" &&
              result !== "already_delivered" &&
              result !== "suppressed_budget_exhausted"
            ) {
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
              const { dispatchTaskLoop } = await import("@/engine/task-root-ingress-delivery")
              const result = await dispatchTaskLoop({
                taskID: input.taskID,
                event: {
                  note: `Accepted worker Session ${completedSessionID} failed ${infrastructureOutcome.operation}`,
                  dispatchInfrastructureFailure: { infrastructureFactID, outcome: infrastructureOutcome },
                },
              })
              if (result === "accepted") return
              // A suppressed wake is a deliberate, surfaced stop: this epoch
              // has spent its infrastructure-failure retry budget. Escalating
              // it would only re-enter the loop the budget exists to end.
              if (result === "suppressed_budget_exhausted") return
              throw new Error(`Detached dispatch infrastructure ingress was not accepted for ${completedSessionID}`)
            }
            const { reconcileTerminalAgentLifecycleDelivery } = await import("@/engine/task-root-ingress-delivery")
            const result = await reconcileTerminalAgentLifecycleDelivery({
              taskID: input.taskID,
              sessionID: completedSessionID,
              dispatchID: dispatch.dispatchID,
            })
            if (
              result === "delivered" ||
              result === "already_delivered" ||
              result === "suppressed_budget_exhausted"
            ) return
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
            const { dispatchTaskLoop } = await import("@/engine/task-root-ingress-delivery")
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
        openedDispatch?.releaseAdmission()
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
  dispatchAgentToolLineageHooks.set(dispatchTool, input.openLineage)
  return dispatchTool
}
