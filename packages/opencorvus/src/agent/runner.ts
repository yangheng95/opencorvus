/**
 * runAgentSession — the single entry point every OpenCorvus WORKER agent runs through.
 *
 * Position in the architecture: agents have one shape. Each agent module
 * (architect / requirements / build / integrity / intent-analysis /
 * frontend-design / orchestrator-children…) contributes only what is
 * genuinely agent-specific:
 *
 *   - `kind`: session.kind for routing/persistence/overlay attribution.
 *   - `core`: the agent's `prompt/core/<kind>-core.txt` contents (loaded by
 *     the caller via `import CORE from "@/prompt/core/<kind>-core.txt"`).
 *   - `buildUserPrompt`: stage-specific user message constructor.
 *   - `tools`: an `AgentToolKit` returning Zod-validated `ai.tool()` extras
 *     plus a getCollector() function. Pure stage-specific output surface.
 *
 * Everything else — model resolution, child session creation, resumable
 * session-runtime wiring, SessionPrompt invocation, abort propagation,
 * stream-error capture, `config.agent.<kind>.prompt_append` user-append
 * — is centralised here.
 *
 * Per CLAUDE.md rule 24, this is the deliberate abstraction of a repeating
 * pattern. Per rule 22, no worker agent owns its own copy of this loop. Per
 * rule 1 there is no alternate default path: a missing model, an aborted
 * signal, or a real provider/runtime failure throws. Domain collectors expose
 * whatever facts their tools actually recorded; they are not completion
 * gates.
 *
 * ── NON-GOAL: the orchestrator agent does NOT use this entry point ─────────
 *
 * `src/orchestrator/agent.ts::Orchestrator.processTask` is the HOST of the
 * worker-session pattern this runner abstracts, not one of its users. It
 * deliberately bypasses runAgentSession because three of its concerns
 * cannot collapse into the worker shape without forcing `if (kind ===
 * "orchestrator")` branches into the runner body — which would violate
 * rule 22 (no double source) and rule 26 (no over-engineering):
 *
 *   1. Two-part system prompt (cacheable static + dynamic per-wake context
 *      from describe / iteration history / latest verdict). The runner takes
 *      a single composed string; the orchestrator's static / dynamic split
 *      is a 1h-cache optimisation that has no analog for worker agents.
 *
 *   2. Orchestrator tools return facts to the same reasoning turn. Worker
 *      agents expose bounded tool surfaces and return the facts collected
 *      during their turn, while the orchestrator owns the next decision.
 *
 *   3. Orchestrator stream errors are persisted as `engine_artifact
 *      kind="orchestrator-stream-error"` and consumed by the next wake's LLM
 *      via describe. Worker turns instead return their final message and
 *      observed stream errors to the caller; only actual provider/runtime
 *      failures throw.
 *
 * The orchestrator additionally owns concurrency state (`running.set(taskID,
 * ctrl)`) and SerialQueue-driven wake scheduling — neither of which the runner
 * models, by design.
 *
 * Anyone considering "consolidating orchestrator onto runAgentSession":
 * stop. The orchestrator is the worker abstraction's HOST, not a worker.
 * If the runner ever needs to gain features for the orchestrator, you are
 * almost certainly looking at a missing capability that should be added to
 * the orchestrator's own shape (orchestrator/agent.ts), not pushed through
 * this entry point.
 * ───────────────────────────────────────────────────────────────────────────
 */
import type { LanguageModel } from "ai"
import { isDeepStrictEqual } from "node:util"
import type { TextHooks } from "@/llm/api"
import { resolveProjectedWorkerModel } from "@/agent/model"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import {
  ProjectedAgentWorkScope,
  ProjectedAgentWorkScopeSchema,
  type ProjectedAgentWorkScope as ProjectedAgentWorkScopeValue,
} from "@/agent/projected-agent-work-scope"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import {
  assertProjectedWorkerContinuationCompatible,
  ProjectedWorkerContinuationIncompatibleError,
} from "@/agent/projected-worker-identity"
import { sessionRuntimeWithResolvedModel } from "@/agent/session-agent-runtime"
import type { RuntimeTemplateID } from "@/agent/runtime-template-id"
import { textSHA256 } from "@/expert-squad/projection-hash"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { sameExpertSquadPackageRevision } from "@/expert-squad/package-revision"
import { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import { EffectiveConfig } from "@/config/effective"
import { appendScopedProjectSourceBoundary } from "@/prompt/scoped-project-source-boundary"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import type { PromptInput as SessionPromptInput } from "@/session/prompt/schema"
import {
  materializeUserMessage,
  persistMaterializedUserMessage,
  persistMaterializedUserMessageInTransaction,
  preparedUserMessageFromPreflight,
  installAndClaimPreparedUserMessageRuntime,
  bindMaterializedUserMessagePersistenceAuthority,
  rebindPreparedUserMessageInput,
} from "@/session/prompt/parts"
import { WorkerTurnDescriptor } from "./worker-turn-descriptor"
import { SessionStatus } from "@/session/status"
import { publishSessionStatus } from "@/session/status-publication"
import {
  ExecutionCancellationError,
  createExecutionCancellationOrigin,
  isExecutionCancellationError,
} from "@/session/prompt/cancellation"
import { Bus } from "@/bus"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { Message } from "@/session/message"
import type { SessionKind } from "@/session/session.sql"
import type { ToolSet } from "ai"
import { AgentTrace } from "@/trace"
import { SessionContext } from "@/session/context"
import { recordTaskInfrastructureError, recordToolExecuteError } from "@/engine/persist"
import { cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { MCP } from "@/mcp"
import { computerRuntimeScopeIdentity } from "@/mcp/computer/runtime-scope"
import { toolResultControl } from "@/session/tool-result-control"
import { ProtocolStore } from "@/protocol/store"
import { Database } from "@/storage/db"
import { findAgentCoordinationRequest } from "@/engine/agent-coordination"
import { coordinationHandoffPrompt } from "@/prompt/fragments/coordination-handoff"
import { requireTask } from "@/engine/store"
import {
  DispatchTurnSchema,
  controlTextSHA256,
  taskRequestSHA256,
  type DispatchTurn,
} from "@/orchestrator/dispatch-turn-projection"
import { resolvedPackageRevisionFromBinding } from "@/engine/workflow-binding"

const log = Log.create({ service: "agent-runner" })

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Stage-specific tool kit. `tools` is the tool surface registered on the
 * child session's runtime contract. `getCollector()` returns whatever the
 * agent collected during the run; the runner does not interpret it.
 */
export interface AgentToolKit<C> {
  tools: ToolSet
  stageOwnedToolIDs: readonly string[]
  getCollector: () => C
}

export interface AgentSessionObserverDisposable {
  dispose(): void
}

export type AgentDispatchAuthorityCommit = (sessionID: string, descriptor: WorkerTurnDescriptor.Info) => void

export interface RunAgentSessionInput<C> {
  /** Exact dynamic identity declared by capability_projection.agents. */
  agentID: string
  /** Immutable expert-squad package revision selected by dispatch. */
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
  /** Display title for the child session (overlay shows this). */
  sessionTitle: string
  /** Override `directory` on the child session. Defaults to
   *  `Instance.directory`. Used by agents that run inside a worktree
   *  (currently just the build agent) so the session + its tools root
   *  at the worktree path, not the primary. */
  sessionDirectory?: string
  /** Preallocated identity for a fresh child session. Managed Task worktrees
   *  use the same Task + Session identity before either resource is created. */
  newSessionID?: string
  /** Existing session to continue. Used by build retries, which must append
   *  one incremental user message to the original build conversation instead
   *  of creating a replacement child session. When set, the runner validates
   *  the row's kind, projected identity, and directory against this invocation
   *  before prompting. */
  existingSessionID?: string
  /** Exact incremental visible user Turn for an existing Session. Dispatch
   * adapters derive this from immutable lineage and Task-authority anchors. */
  continuationPrompt?: string
  /** Structured scheduler authority from which the visible user Turn was projected. */
  dispatchTurn?: DispatchTurn
  /** Parent session id for explicit session lineage. */
  parentSessionID?: string
  /** Explicit Task execution ownership scope. */
  workScope: ProjectedAgentWorkScopeValue
  /** Task id for cache stickiness + per-agent model resolution. */
  taskID: string
  /** Explicit model override; bypasses projected-worker model resolution. */
  model?: { providerID: string; modelID: string }
  /** Cancellation. The runner cancels the in-flight prompt + rethrows. */
  signal?: AbortSignal
  /** Optional progress observer. */
  onStatus?: (summary: string) => void | Promise<void>
  /** Fires immediately after a fresh child Session and its initial dispatch
   *  authority bundle commit atomically. Return value is a disposer that runs
   *  after initialization or prompting completes, including failure. Use this
   *  boundary only to observe the now-durable physical Session identity. */
  onSessionCreated?: (
    session: Awaited<ReturnType<typeof Session.createNext>>,
  ) => Promise<AgentSessionObserverDisposable | void> | AgentSessionObserverDisposable | void
  /** Synchronous callback executed in the same database transaction that
   * persists the final post-Plugin user message/Parts and Turn descriptor. It
   * publishes descriptor-backed dispatch lineage and must not perform
   * asynchronous work. */
  onDispatchAuthorityCommit?: (
    session: Awaited<ReturnType<typeof Session.createNext>>,
    descriptor: WorkerTurnDescriptor.Info,
  ) => void
  /** Fires for every runner turn after that turn's exact descriptor and
   * runtime contract are installed and before SessionPrompt begins. This is
   * the logical dispatch-authority commit boundary. Unlike
   * onSessionCreated, this includes fresh, existing, and continuation runs. */
  onRuntimeReady?: (
    session: Awaited<ReturnType<typeof Session.createNext>>,
  ) => Promise<AgentSessionObserverDisposable | void> | AgentSessionObserverDisposable | void
  /** Attempt identity installed on SessionRuntimeContract and mirrored into
   *  the user message envelope so SessionLoop can reject stale retry
   *  collectors before model contact. */
  runtimeContract?: {
    attemptID?: string
    /** Controls Model Context Protocol tool loading for this worker session. */
    includeMcpTools?: boolean
    /** Uses only runtime contract tools, skipping registry and Model Context Protocol tools. */
    exactTools?: boolean
  }
  /** Attachment byte writes performed while creating the user message must
   *  target this storage namespace. Build passes task.project_id explicitly;
   *  ordinary agent sessions use the created session's projectID. */
  byteMaterializationProjectID?: string
  /** Additional per-run registry/runtime tool switches merged after defaults. */
  toolSwitches?: Record<string, boolean>
  /** Stage-specific extra tool surface + collector. */
  toolKit: AgentToolKit<C>
  /** Stage-specific user-message text. */
  buildUserPrompt: () => string | Promise<string>
  /** Optional ai-sdk Message.Part array assembled by the caller — used by
   *  agents that emit multimodal parts (image attachments etc.). When
   *  provided, the runner sends these instead of synthesising a single
   *  text part from `buildUserPrompt`. The text from `buildUserPrompt`
   *  is still built and prepended as the first part so the prompt
   *  user-text is never silently dropped. */
  buildUserParts?: () => Promise<SessionPromptInput["parts"]>
  /** Streaming hooks forwarded through the SessionPrompt runtime contract. */
  stream?: TextHooks
}

export interface RunAgentSessionOutput<C> {
  /** Child session created for this run. */
  session: Awaited<ReturnType<typeof Session.createNext>>
  /** Final assistant message returned by SessionPrompt. */
  finalMessage: Message.WithParts
  /** Stage-specific collector after the run completes. */
  collector: C
  /** Stream errors captured during the run. */
  streamErrors: Array<{ reason: string; name?: string }>
  /** Resolved model the run used. */
  model: { providerID: string; modelID: string }
  /** Host-observed physical end of this streamed model turn. */
  turn: Readonly<{ kind: "stream_ended" }>
  /** Durable coordination request discovered in the final tool-call trace. */
  coordinationHandoff?: Readonly<{
    requestID: string
    dispatchLineageID: string
  }>
}

export interface AgentCoordinationHandoffResult {
  outcome: "coordination_handoff"
  requestID: string
  dispatchLineageID: string
  sessionID: string
}

export function isAgentCoordinationHandoffResult(value: unknown): value is AgentCoordinationHandoffResult {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { outcome?: unknown }).outcome === "coordination_handoff" &&
    typeof (value as { requestID?: unknown }).requestID === "string" &&
    typeof (value as { dispatchLineageID?: unknown }).dispatchLineageID === "string" &&
    typeof (value as { sessionID?: unknown }).sessionID === "string"
  )
}

export function agentCoordinationHandoffResult<C>(output: {
  session: { id: string }
  coordinationHandoff?: RunAgentSessionOutput<C>["coordinationHandoff"]
}): AgentCoordinationHandoffResult | undefined {
  if (!output.coordinationHandoff) return undefined
  return {
    outcome: "coordination_handoff",
    requestID: output.coordinationHandoff.requestID,
    dispatchLineageID: output.coordinationHandoff.dispatchLineageID,
    sessionID: output.session.id,
  }
}

function coordinationHandoffFromMessage(input: {
  taskID: string
  sessionID: string
  finalMessage: Message.WithParts
  declaredToolID?: string
}): RunAgentSessionOutput<unknown>["coordinationHandoff"] {
  let handoff: RunAgentSessionOutput<unknown>["coordinationHandoff"]
  for (const part of input.finalMessage.parts) {
    if (part.type !== "tool" || part.state.status !== "completed") continue
    const control = toolResultControl(part.state.metadata)
    if (control?.kind !== "handoff_drain") continue
    if (!input.declaredToolID || part.tool !== input.declaredToolID) {
      throw new Error(`Undeclared coordination handoff tool result ${part.tool}/${part.callID}`)
    }
    const request = findAgentCoordinationRequest({ taskID: input.taskID, requestID: control.request_id })
    if (
      !request ||
      request.payload.status !== "pending" ||
      request.payload.origin !== "worker_handoff" ||
      request.payload.session_id !== input.sessionID ||
      request.payload.tool_call_id !== part.callID ||
      request.payload.dispatch_lineage_id !== control.dispatch_lineage_id
    ) {
      throw new Error(`Coordination handoff ${control.request_id} does not match its durable pending request`)
    }
    const current = {
      requestID: control.request_id,
      dispatchLineageID: control.dispatch_lineage_id,
    }
    if (
      handoff &&
      (handoff.requestID !== current.requestID || handoff.dispatchLineageID !== current.dispatchLineageID)
    ) {
      throw new Error("Worker turn produced conflicting coordination handoff completions")
    }
    handoff = current
  }
  return handoff
}

function recordAgentTurnTraceForSession(
  session: Awaited<ReturnType<typeof Session.createNext>>,
  input: Parameters<typeof AgentTrace.recordAgentTurn>[0],
): void {
  SessionContext.provide(session, () => {
    AgentTrace.recordAgentTurn(input)
  })
}

function promptGenerationOwnerForMessage(input: {
  sessionID: string
  message: Message.WithParts | undefined
}): AbortSignal | undefined {
  if (!input.message) return undefined
  const owner = SessionPromptState.messageOwner(input.sessionID, input.message.info.id)
  if (!owner && SessionPromptState.hasGeneration(input.sessionID)) {
    throw new Error(
      `Session ${input.sessionID} final message ${input.message.info.id} has no prompt generation receipt`,
    )
  }
  return owner
}

async function completeProjectedWorkerTurn<C>(input: {
  run: RunAgentSessionInput<C>
  session: Awaited<ReturnType<typeof Session.createNext>>
  finalMessage: Message.WithParts
  streamErrors: Array<{ reason: string; name?: string }>
  model: { providerID: string; modelID: string }
  effectiveOutputLimit: number
  agentID: string
  kind: SessionKind
  coordinationHandoffToolID?: string
  inputMessageID: string
  promptGenerationOwner: AbortSignal
  signal?: AbortSignal
}): Promise<RunAgentSessionOutput<C>> {
  if (input.signal?.aborted) {
    throw new AgentRunError(input.kind, "aborted during prompt")
  }
  const hardError = buildHardErrorFromFinalMessage({
    kind: input.kind,
    agentName: input.agentID,
    finalMessage: input.finalMessage,
    effectiveOutputLimit: input.effectiveOutputLimit,
  })
  if (hardError) {
    throw hardError
  }

  const coordinationHandoff = coordinationHandoffFromMessage({
    taskID: input.run.taskID,
    sessionID: input.session.id,
    finalMessage: input.finalMessage,
    declaredToolID: input.coordinationHandoffToolID,
  })
  const collector = input.run.toolKit.getCollector()

  const messageOwner = promptGenerationOwnerForMessage({
    sessionID: input.session.id,
    message: input.finalMessage,
  })
  if (messageOwner && messageOwner !== input.promptGenerationOwner) {
    throw new Error(`Session ${input.session.id} final message belongs to a different prompt generation owner`)
  }
  const promptGenerationOwner = input.promptGenerationOwner
  if (coordinationHandoff) {
    await publishPhysicallySettledWorkerTerminal({
      session: input.session,
      agentID: input.agentID,
      taskID: input.run.taskID,
      outcome: "coordinated",
      finalMessageID: input.finalMessage.info.id,
      promptGenerationOwner,
      status: { type: "terminal", reason: "coordinated" },
      inputMessageID: input.inputMessageID,
    })
    await recordToolExecuteErrorsForFinalMessage({
      taskID: input.run.taskID,
      finalMessage: input.finalMessage,
    })
    log.info(`${input.agentID} agent handed control to orchestrator`, {
      kind: input.kind,
      sessionID: input.session.id,
      requestID: coordinationHandoff.requestID,
      dispatchLineageID: coordinationHandoff.dispatchLineageID,
    })
    return {
      session: input.session,
      finalMessage: input.finalMessage,
      collector,
      streamErrors: input.streamErrors,
      model: input.model,
      turn: { kind: "stream_ended" },
      coordinationHandoff,
    }
  }

  await publishPhysicallySettledWorkerTerminal({
    session: input.session,
    agentID: input.agentID,
    taskID: input.run.taskID,
    outcome: "completed",
    finalMessageID: input.finalMessage.info.id,
    promptGenerationOwner,
    status: { type: "terminal", reason: "completed" },
    inputMessageID: input.inputMessageID,
  })
  await recordToolExecuteErrorsForFinalMessage({
    taskID: input.run.taskID,
    finalMessage: input.finalMessage,
  })
  log.info(`${input.agentID} agent finished`, {
    kind: input.kind,
    sessionID: input.session.id,
    streamErrors: input.streamErrors.length,
  })
  if (AgentTrace.isEnabled() && input.run.taskID) {
    try {
      recordAgentTurnTraceForSession(input.session, {
        sessionID: input.session.id,
        parentSessionID: input.run.parentSessionID,
        taskID: input.run.taskID,
        agentName: input.agentID,
        kind: "agent_turn",
        streamErrors: input.streamErrors,
        finalMessageID: input.finalMessage.info.id,
      })
    } catch (error) {
      log.error("post-terminal agent trace persistence failed", {
        sessionID: input.session.id,
        agentID: input.agentID,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return {
    session: input.session,
    finalMessage: input.finalMessage,
    collector,
    streamErrors: input.streamErrors,
    model: input.model,
    turn: { kind: "stream_ended" },
  }
}

async function failProjectedWorkerTurn<C>(input: {
  run: RunAgentSessionInput<C>
  session: Awaited<ReturnType<typeof Session.createNext>>
  finalMessage?: Message.WithParts
  streamErrors: Array<{ reason: string; name?: string }>
  agentID: string
  kind: SessionKind
  signal?: AbortSignal
  error: unknown
  inputMessageID?: string
  promptGenerationOwner?: AbortSignal
}): Promise<never> {
  const cancellationCause = isExecutionCancellationError(input.error)
    ? input.error
    : isExecutionCancellationError(input.signal?.reason)
      ? input.signal.reason
      : undefined
  const cancellation = cancellationCause
    ? new ExecutionCancellationError({
        source: cancellationCause.source,
        message: cancellationCause.message,
        sessionID: input.session.id,
        origin: { ...cancellationCause.origin, targetSessionID: input.session.id },
        cause: cancellationCause,
      })
    : undefined
  if (cancellation) {
    const messageOwner = input.finalMessage
      ? promptGenerationOwnerForMessage({ sessionID: input.session.id, message: input.finalMessage })
      : undefined
    if (messageOwner && input.promptGenerationOwner && messageOwner !== input.promptGenerationOwner) {
      throw new Error(`Session ${input.session.id} failed message belongs to a different prompt generation owner`)
    }
    const promptGenerationOwner = input.promptGenerationOwner ?? messageOwner
    await publishPhysicallySettledWorkerTerminal({
      session: input.session,
      agentID: input.agentID,
      taskID: input.run.taskID,
      outcome: "cancelled",
      finalMessageID: input.finalMessage?.info.id,
      promptGenerationOwner,
      status: { type: "terminal", reason: "aborted", error: cancellation.message },
      inputMessageID: input.inputMessageID,
    })
    throw cancellation
  }
  const errorMessage = input.error instanceof Error ? input.error.message : String(input.error)
  const messageOwner = promptGenerationOwnerForMessage({ sessionID: input.session.id, message: input.finalMessage })
  if (messageOwner && input.promptGenerationOwner && messageOwner !== input.promptGenerationOwner) {
    throw new Error(`Session ${input.session.id} failed message belongs to a different prompt generation owner`)
  }
  const promptGenerationOwner = input.promptGenerationOwner ?? messageOwner
  await publishPhysicallySettledWorkerTerminal({
    session: input.session,
    agentID: input.agentID,
    taskID: input.run.taskID,
    outcome: input.signal?.aborted ? "aborted" : "failed",
    finalMessageID: input.finalMessage?.info.id,
    promptGenerationOwner,
    status: {
      type: "terminal",
      reason: input.signal?.aborted ? "aborted" : "error",
      error: errorMessage,
    },
    inputMessageID: input.inputMessageID,
  })
  if (input.finalMessage) {
    await recordToolExecuteErrorsForFinalMessage({
      taskID: input.run.taskID,
      finalMessage: input.finalMessage,
    })
  }
  try {
    await recordAgentErrorForOrchestrator({
      taskID: input.run.taskID,
      sessionID: input.session.id,
      agentName: input.agentID,
      kind: input.kind,
      error: input.error,
      streamErrors: input.streamErrors,
    })
  } catch (observationError) {
    log.error("post-terminal agent failure observation persistence failed", {
      sessionID: input.session.id,
      agentID: input.agentID,
      error: observationError instanceof Error ? observationError.message : String(observationError),
    })
  }
  if (AgentTrace.isEnabled() && input.run.taskID) {
    try {
      recordAgentTurnTraceForSession(input.session, {
        sessionID: input.session.id,
        parentSessionID: input.run.parentSessionID,
        taskID: input.run.taskID,
        agentName: input.agentID,
        kind: "agent_turn_failure",
        streamErrors: input.streamErrors,
        error: errorMessage,
        finalMessageID: input.finalMessage?.info.id,
      })
    } catch (traceError) {
      log.error("post-terminal agent failure trace persistence failed", {
        sessionID: input.session.id,
        agentID: input.agentID,
        error: traceError instanceof Error ? traceError.message : String(traceError),
      })
    }
  }
  throw input.error
}

type PhysicalWorkerTurnSettlementInput = {
  agentID: string
  taskID?: string
  finalMessageID?: string
  promptGenerationOwner?: AbortSignal
  outcome: "completed" | "coordinated" | "failed" | "aborted" | "cancelled"
}

export type WorkerTurnSettlementEvidence = {
  descriptorID: string
  descriptorHash: string
  inputMessageID: string
  currentDispatchID?: string
}

export class WorkerTurnSettlementError extends Error {
  override readonly name = "WorkerTurnSettlementError"

  constructor(
    readonly sessionID: string,
    readonly operation:
      | "settle-prompt-owner"
      | "detach-runtime-identity"
      | "close-runtime-resources"
      | "publish-terminal-lifecycle",
    readonly infrastructureArtifactID: string | undefined,
    readonly evidence: WorkerTurnSettlementEvidence | undefined,
    readonly finalMessageID: string | undefined,
    readonly causeErrorName: string,
    readonly causeMessage: string,
    cause: unknown,
  ) {
    super(`Worker Turn ${sessionID} failed to settle ${operation}`, { cause })
  }
}

function workerTurnSettlementEvidence(sessionID: string): WorkerTurnSettlementEvidence | undefined {
  const descriptor = WorkerTurnDescriptor.latestForSession(sessionID)
  if (!descriptor) return undefined
  return {
    descriptorID: descriptor.id,
    descriptorHash: descriptor.hash,
    inputMessageID: descriptor.payload.messageAuthority.user_message_id,
    ...(descriptor.payload.dispatchTurn
      ? { currentDispatchID: descriptor.payload.dispatchTurn.current_dispatch_id }
      : {}),
  }
}

function recordWorkerTurnSettlementFailure(
  input: PhysicalWorkerTurnSettlementInput & {
    sessionID: string
    operation:
      | "settle-prompt-owner"
      | "detach-runtime-identity"
      | "close-runtime-resources"
      | "publish-terminal-lifecycle"
    error: unknown
    evidence?: WorkerTurnSettlementEvidence
  },
): string | undefined {
  log.error(`physical worker Turn ${input.operation} failed`, {
    ...input,
    error: input.error instanceof Error ? input.error.message : String(input.error),
  })
  if (!input.taskID) return undefined
  try {
    return recordTaskInfrastructureError({
      taskID: input.taskID,
      component: "worker-runtime",
      operation: input.operation,
      reason: input.error instanceof Error ? `${input.error.name}: ${input.error.message}` : String(input.error),
      errorName: input.error instanceof Error ? input.error.name : undefined,
      sessionID: input.sessionID,
      context: {
        outcome: input.outcome,
        ...(input.evidence
          ? {
              worker_turn_descriptor_id: input.evidence.descriptorID,
              worker_turn_descriptor_hash: input.evidence.descriptorHash,
              input_message_id: input.evidence.inputMessageID,
              ...(input.evidence.currentDispatchID ? { current_dispatch_id: input.evidence.currentDispatchID } : {}),
            }
          : {}),
      },
      now: Date.now(),
    })
  } catch (observationError) {
    log.error(`physical worker Turn ${input.operation} observation persistence failed`, {
      ...input,
      error: observationError instanceof Error ? observationError.message : String(observationError),
    })
    return undefined
  }
}

async function settlePhysicalWorkerTurn(
  input: PhysicalWorkerTurnSettlementInput & {
    session: Pick<Awaited<ReturnType<typeof Session.get>>, "id" | "directory">
  },
): Promise<Disposable> {
  const owner = input.promptGenerationOwner
  const evidence = workerTurnSettlementEvidence(input.session.id)
  let generationReservation: Disposable | undefined
  try {
    generationReservation = SessionPromptState.claimPromptSettlementReservation(
      input.session.id,
      input.session.directory,
      owner,
    )
    const priorReceipt = owner
      ? SessionPromptState.cancellationReceipt(input.session.id, input.session.directory, owner)
      : undefined
    const origin = createExecutionCancellationOrigin({
      actor: "runtime",
      source: "runtime.prompt_owner",
      surface: "agent",
      requestID: input.session.id,
      reason: `${input.agentID} physical worker Turn settled after ${input.outcome}`,
      targetSessionID: input.session.id,
      taskID: input.taskID,
    })
    const settlement = owner
      ? (SessionPromptState.cancelOwned(input.session.id, input.session.directory, owner, { origin }) ?? priorReceipt)
      : undefined
    if (!settlement && SessionPromptState.hasOwnedPrompt(input.session.id, input.session.directory)) {
      throw new Error(
        `Session ${input.session.id} physical worker Turn cannot settle a replacement prompt generation without its exact owner`,
      )
    }
    if (settlement) {
      await settlement.finished
      SessionPromptState.clearCancellationReceipt(input.session.id, settlement.owner)
    }
  } catch (error) {
    generationReservation?.[Symbol.dispose]()
    const artifactID = recordWorkerTurnSettlementFailure({
      ...input,
      sessionID: input.session.id,
      operation: "settle-prompt-owner",
      error,
      evidence,
    })
    throw new WorkerTurnSettlementError(
      input.session.id,
      "settle-prompt-owner",
      artifactID,
      evidence,
      input.finalMessageID,
      error instanceof Error ? error.name : "UnknownError",
      error instanceof Error ? error.message : String(error),
      error,
    )
  }
  if (!generationReservation) throw new Error(`Session ${input.session.id} settlement reservation was not acquired`)
  try {
    await SessionRuntimeContractStore.dispose(input.session.id)
  } catch (error) {
    generationReservation[Symbol.dispose]()
    const artifactID = recordWorkerTurnSettlementFailure({
      ...input,
      sessionID: input.session.id,
      operation: "close-runtime-resources",
      error,
      evidence,
    })
    throw new WorkerTurnSettlementError(
      input.session.id,
      "close-runtime-resources",
      artifactID,
      evidence,
      input.finalMessageID,
      error instanceof Error ? error.name : "UnknownError",
      error instanceof Error ? error.message : String(error),
      error,
    )
  }
  return generationReservation
}

async function publishPhysicallySettledWorkerTerminal(
  input: PhysicalWorkerTurnSettlementInput & {
    session: Pick<Awaited<ReturnType<typeof Session.get>>, "id" | "directory">
    status: Extract<SessionStatus.Info, { type: "terminal" }>
    inputMessageID?: string
  },
): Promise<void> {
  using _generationReservation = await settlePhysicalWorkerTurn(input)
  try {
    await publishSessionStatus(input.session, input.status, {
      promptGenerationOwner: input.promptGenerationOwner,
      inputMessageID: input.inputMessageID,
      taskID: input.taskID,
    })
  } catch (error) {
    const evidence = workerTurnSettlementEvidence(input.session.id)
    const artifactID = recordWorkerTurnSettlementFailure({
      ...input,
      sessionID: input.session.id,
      operation: "publish-terminal-lifecycle",
      error,
      evidence,
    })
    throw new WorkerTurnSettlementError(
      input.session.id,
      "publish-terminal-lifecycle",
      artifactID,
      evidence,
      input.finalMessageID,
      error instanceof Error ? error.name : "UnknownError",
      error instanceof Error ? error.message : String(error),
      error,
    )
  }
}

export function promptToolSwitchesForAgentRun(input: {
  extraToolNames: string[]
  explicitProjectedToolNames?: readonly string[]
  role: RuntimeTemplateID
}): Record<string, boolean> {
  const switches: Record<string, boolean> = Object.fromEntries(input.extraToolNames.map((name) => [name, true]))
  Object.assign(switches, AgentToolPool.defaultRuntimeToolSwitchesForRuntimeTemplate(input.role))
  // A package declaration is more specific than its runtime-template default.
  // The caller's per-run switches are merged after this helper and remain final.
  for (const toolID of input.explicitProjectedToolNames ?? []) {
    if (Object.hasOwn(switches, toolID)) switches[toolID] = true
  }
  return switches
}

// ---------------------------------------------------------------------------
// Error types — every failure surfaces as AgentRunError so callers do not
// need to know about kind-specific exception classes.
// ---------------------------------------------------------------------------

export class AgentRunError extends Error {
  constructor(
    public readonly kind: SessionKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`[${kind}] ${message}`, options)
    this.name = "AgentRunError"
  }
}

/**
 * Pure assertion that converts a finished assistant message's stamped error
 * or real output-limit finish into a thrown AgentRunError when the error must
 * abort the agent run. Returns `null` when no failure should be raised — i.e.
 * no error or output-limit finish is present, or the error is
 * `Message.AbortedError` (soft cancellation already represented by
 * SessionStatus terminal "aborted").
 *
 * Extracted from runAgentSession so the conversion logic (provider error
 * shape → AgentRunError) can be exercised by unit
 * tests without standing up SessionPrompt / Provider mocks.
 *
 * Spec: surface hard LLM failures so the orchestrator's catch path runs.
 * Root cause of the intent-analysis "秒退" incident on tsk_ddf383614
 * (2026-04-30) — see runAgentSession callsite below.
 */
export function buildHardErrorFromFinalMessage(input: {
  kind: SessionKind
  agentName: string
  finalMessage: { info: { role: string; error?: unknown; finish?: string } }
  effectiveOutputLimit?: number
}): AgentRunError | null {
  const { kind, agentName, finalMessage } = input
  if (finalMessage.info.role !== "assistant") return null
  const err = finalMessage.info.error
  if (err) {
    if (Message.AbortedError.isInstance(err as Error)) return null
    const errName = (err as { name?: string }).name ?? "UnknownError"
    const errMessage = (err as { data?: { message?: string } }).data?.message ?? errName
    return new AgentRunError(kind, `LLM error during ${agentName}: ${errName}: ${errMessage}`, {
      cause: err as Error,
    })
  }
  if (finalMessage.info.finish === "length") {
    const outputLengthMessage =
      input.effectiveOutputLimit === undefined
        ? "The model response exceeded its output limit."
        : `The model response exceeded the effective runtime output cap of ${input.effectiveOutputLimit} tokens.`
    const outputLengthError = new Message.OutputLengthError({
      message: outputLengthMessage,
      ...(input.effectiveOutputLimit === undefined ? {} : { effectiveOutputLimit: input.effectiveOutputLimit }),
    })
    const limitDetail =
      input.effectiveOutputLimit === undefined
        ? ""
        : ` The effective runtime output cap for this request was ${input.effectiveOutputLimit} tokens.`
    return new AgentRunError(
      kind,
      `LLM error during ${agentName}: ${outputLengthError.name}: The model response exceeded its output limit.${limitDetail}`,
      { cause: outputLengthError },
    )
  }
  return null
}

export function toolErrorPartsFromFinalMessage(finalMessage: {
  info: { role: string }
  parts?: ReadonlyArray<Message.Part>
}): Message.ToolPart[] {
  if (finalMessage.info.role !== "assistant") return []
  return (finalMessage.parts ?? []).filter(
    (part): part is Message.ToolPart => part.type === "tool" && part.state.status === "error",
  )
}

export async function recordToolExecuteErrorsForFinalMessage(input: {
  taskID?: string
  finalMessage: Message.WithParts
  write?: typeof recordToolExecuteError
}) {
  if (!input.taskID) return
  const now = Date.now()
  for (const part of toolErrorPartsFromFinalMessage(input.finalMessage)) {
    try {
      await (input.write ?? recordToolExecuteError)({
        taskID: input.taskID,
        sessionID: part.sessionID,
        messageID: part.messageID,
        partID: part.id,
        toolName: part.tool,
        callID: part.callID,
        input: part.state.input,
        failure: (part.state as Message.ToolStateError).failure,
        now,
      })
    } catch (error) {
      log.error("post-turn tool observation persistence failed", {
        sessionID: part.sessionID,
        messageID: part.messageID,
        partID: part.id,
        toolName: part.tool,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

async function recordAgentErrorForOrchestrator(input: {
  taskID?: string
  sessionID: string
  agentName: string
  kind: SessionKind
  error: unknown
  streamErrors: Array<{ reason: string; name?: string }>
}) {
  if (!input.taskID) return
  const message = input.error instanceof Error ? input.error.message : String(input.error)
  const cause =
    input.error instanceof Error && input.error.cause instanceof Error ? input.error.cause.message : undefined
  const streamLines = input.streamErrors.slice(-3).map((e) => `- ${e.name ? `[${e.name}] ` : ""}${e.reason}`)
  const lines = [
    `Agent session failed before producing a successful result.`,
    `agent=${input.agentName}`,
    `kind=${input.kind}`,
    `session_id=${input.sessionID}`,
    `error=${message}`,
  ]
  if (cause) lines.push(`cause=${cause}`)
  if (streamLines.length > 0) {
    lines.push("stream_errors:")
    lines.push(...streamLines)
  }
  const { createDecisionLog } = await import("@/decision-log")
  createDecisionLog(input.taskID).append({
    phase: "agent_error",
    key: `${input.agentName}_session_error`,
    value: lines.join("\n"),
    reason: `model-visible agent failure; session=${input.sessionID}; ` + `kind=${input.kind}`,
  })
}

function recordDispatchPreparationError(input: {
  taskID?: string
  attemptedSessionID: string
  agentName: string
  kind: SessionKind
  error: unknown
}) {
  if (!input.taskID) return
  try {
    recordTaskInfrastructureError({
      taskID: input.taskID,
      component: "agent-dispatch",
      operation: "prepare-worker-turn",
      reason: input.error instanceof Error ? `${input.error.name}: ${input.error.message}` : String(input.error),
      errorName: input.error instanceof Error ? input.error.name : undefined,
      context: {
        attempted_session_id: input.attemptedSessionID,
        agent: input.agentName,
        session_kind: input.kind,
      },
      now: Date.now(),
    })
  } catch (observationError) {
    log.error("dispatch preparation failure observation persistence failed", {
      taskID: input.taskID,
      attemptedSessionID: input.attemptedSessionID,
      agentID: input.agentName,
      error: observationError instanceof Error ? observationError.message : String(observationError),
    })
  }
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

async function runAgentSessionInner<C>(input: RunAgentSessionInput<C>): Promise<RunAgentSessionOutput<C>> {
  const agentID = input.agentID
  const workScope = ProjectedAgentWorkScopeSchema.parse(input.workScope)
  const existingSessionID = input.existingSessionID
  const dispatchTurn = input.dispatchTurn ? DispatchTurnSchema.parse(input.dispatchTurn) : undefined
  const configScope = { taskID: input.taskID }

  const [effectiveConfig, projectDirectory, capabilityProjectDirectory] = await Promise.all([
    EffectiveConfig.effective(configScope),
    EffectiveConfig.directory(configScope),
    EffectiveConfig.capabilityProjectDirectory(configScope),
  ])

  // Resolve the exact projected worker before model selection. The dynamic
  // agent ID is the runtime identity; its base role selects only the core
  // runtime, session-kind, tool-pool, and dispatch-adapter template.
  const { workerCapability, skillProjection } = await PromptProfileResolver.resolveWorkerTurnProjection({
    config: effectiveConfig,
    projectDirectory: capabilityProjectDirectory,
    agentID,
    packageRevision: input.packageRevision,
  })
  const capabilityIdentity = workerCapability.identity
  const role = capabilityIdentity.baseRole
  const kind = capabilityIdentity.sessionKind
  if (dispatchTurn) {
    const task = requireTask(input.taskID)
    if (
      dispatchTurn.task_authority.task_id !== task.id ||
      dispatchTurn.task_authority.root_session_id !== task.session_id ||
      dispatchTurn.task_authority.request_sha256 !== taskRequestSHA256(task.request)
    ) {
      throw new AgentRunError(kind, `dispatch Turn Task authority does not match durable Task ${input.taskID}`)
    }
    if (
      !sameExpertSquadPackageRevision(
        resolvedPackageRevisionFromBinding(dispatchTurn.workflow_binding),
        input.packageRevision,
      )
    ) {
      throw new AgentRunError(kind, `dispatch Turn workflow package does not match ${input.packageRevision.id}`)
    }
    if (dispatchTurn.workflow_binding.kind === "virtual_workflow") {
      const node = dispatchTurn.workflow_binding.nodes.find(
        (candidate) => candidate.node_id === dispatchTurn.workflow_node_id,
      )
      if (!node || node.agent_id !== agentID) {
        throw new AgentRunError(kind, `dispatch Turn workflow node does not target projected worker ${agentID}`)
      }
    } else if (dispatchTurn.workflow_node_id !== null) {
      throw new AgentRunError(kind, "direct dispatch Turn cannot claim a workflow node")
    }
  }
  const runtimeTemplate = RuntimeTemplateRegistry.get(role)
  const coordinationHandoffToolID = DispatchAdapterContractRegistry.coordinationHandoffToolID(
    runtimeTemplate.dispatchAdapterID,
  )
  if (input.signal?.aborted) {
    throw new AgentRunError(kind, "aborted before model resolution")
  }

  // ── 1. Resolve model ─────────────────────────────────────────────────
  let model: Awaited<ReturnType<typeof resolveProjectedWorkerModel>> | undefined
  let modelResolutionError: unknown
  if (input.model) {
    model = await Provider.getModel(input.model.providerID, input.model.modelID, { config: effectiveConfig }).catch(
      (err) => {
        modelResolutionError = err
        return undefined
      },
    )
  } else {
    model = await resolveProjectedWorkerModel(
      {
        expertSquadID: workerCapability.expertSquadID,
        agentID: capabilityIdentity.agentID,
        baseRole: capabilityIdentity.baseRole,
        capabilityOwner: workerCapability.capabilityOwner,
      },
      configScope,
    ).catch((err) => {
      modelResolutionError = err
      return undefined
    })
  }
  if (!model) {
    const detail =
      modelResolutionError instanceof Error
        ? modelResolutionError.message
        : modelResolutionError !== undefined
          ? String(modelResolutionError)
          : input.model
            ? `${input.model.providerID}/${input.model.modelID} did not resolve`
            : `projected agent "${capabilityIdentity.agentID}" did not resolve a default model from runtime template "${capabilityIdentity.baseRole}"`
    throw new AgentRunError(
      kind,
      `no LLM model available: ${detail}`,
      modelResolutionError instanceof Error ? { cause: modelResolutionError } : undefined,
    )
  }
  const resolvedModelRef = { providerID: model.providerID, modelID: model.id }
  const executionRuntime = sessionRuntimeWithResolvedModel(workerCapability.runtime, resolvedModelRef)

  if (input.signal?.aborted) {
    throw new AgentRunError(kind, "aborted after model resolution")
  }
  // ── 2. Compose the stable system prompt ───────────────────────────────
  // Task and continuation context belongs to visible user messages. Keeping
  // mutable task state out of the system prompt makes its descriptor hash a
  // stable execution-contract digest rather than a snapshot of workflow data.
  const composed = await composeSystemPrompt({
    taskID: input.taskID,
    baseRole: role,
    core: coordinationHandoffToolID
      ? `${runtimeTemplate.corePromptSeed}\n\n${coordinationHandoffPrompt(coordinationHandoffToolID)}`
      : runtimeTemplate.corePromptSeed,
    projectDirectory,
    capability: workerCapability,
  })
  const systemPrompt = composed.prompt
  const systemPromptHash = textSHA256(systemPrompt)

  // ── 3. Build user prompt parts ───────────────────────────────────────
  const continuationText = input.continuationPrompt?.trim()
  if (existingSessionID && !continuationText) {
    throw new AgentRunError(kind, `existing session ${existingSessionID} requires an incremental continuation prompt`)
  }
  if (!existingSessionID && continuationText) {
    throw new AgentRunError(kind, "a fresh Session cannot receive a continuation prompt")
  }
  if (!existingSessionID && dispatchTurn?.kind === "continuation") {
    throw new AgentRunError(kind, "a fresh Session cannot receive continuation dispatch authority")
  }
  const userText = continuationText ?? (await input.buildUserPrompt())
  let parts: SessionPromptInput["parts"]
  if (continuationText) {
    parts = [{ type: "text", text: continuationText }]
  } else if (input.buildUserParts) {
    parts = await input.buildUserParts()
  } else {
    parts = [{ type: "text", text: userText }]
  }
  // Capability gate for low-level provider-bound callers that still pass
  // explicit file parts. Task-worker agent context should normally use
  // link/index refs, but the runner must still refuse media parts that the
  // resolved model cannot accept when direct SessionPrompt callers or
  // continuation prompts supply them.
  const fileParts = parts.filter((p): p is typeof p & { type: "file" } => p.type === "file")
  if (fileParts.length > 0) {
    const before = fileParts.length
    parts = parts.filter((p) => {
      if (p.type !== "file") return true
      const mime = (p.mime || "").toLowerCase()
      let modality: "image" | "audio" | "video" | "pdf" | undefined
      if (mime.startsWith("image/")) modality = "image"
      else if (mime === "application/pdf") modality = "pdf"
      else if (mime.startsWith("audio/")) modality = "audio"
      else if (mime.startsWith("video/")) modality = "video"
      if (!modality) return true
      const accepted = model.capabilities.input[modality]
      if (!accepted) {
        log.warn("dropping multimodal part — model lacks input capability", {
          agent: agentID,
          kind,
          mime,
          filename: p.filename,
          modality,
          providerID: model.providerID,
          modelID: model.id,
        })
      }
      return accepted
    })
    const dropped = before - parts.filter((p) => p.type === "file").length
    if (dropped > 0) {
      // Append an explicit text marker so the model is aware it was sent
      // attachments it can't see. Prevents silent confabulation: the
      // prompt's textual inventory may still list filenames, and without
      // this marker the model would not know those files weren't actually
      // delivered as bytes.
      parts.push({
        type: "text",
        text:
          `\n\n[runner] ${dropped} multimodal attachment(s) were filtered out because this model ` +
          `(${model.providerID}/${model.id}) does not accept the corresponding input modality. ` +
          `You can see filenames in the textual inventory above but NOT the file contents — do not pretend you have.`,
      })
    }
  }
  parts = parts.map((p) => ({ ...p, id: Identifier.ascending("part") }))
  const userMessageID = Identifier.ascending("message")
  let descriptorDispatchTurn = dispatchTurn

  // ── 4. Create or reopen child session ────────────────────────────────
  await input.onStatus?.(`${kind} starting`)
  const lifecycleDisposables: AgentSessionObserverDisposable[] = []
  let lifecycleDisposed = false
  const registerLifecycle = (disposable: AgentSessionObserverDisposable | void) => {
    if (!disposable) return
    if (typeof disposable !== "object" || typeof disposable.dispose !== "function") {
      throw new Error(`Agent ${agentID} observer returned an invalid lifecycle disposer`)
    }
    lifecycleDisposables.push(disposable)
  }
  if (existingSessionID && input.newSessionID) {
    throw new AgentRunError(kind, "existingSessionID and newSessionID are mutually exclusive")
  }
  const session = existingSessionID
    ? await Session.get(existingSessionID)
    : await Session.prepareNext({
        id: input.newSessionID,
        kind,
        parentID: input.parentSessionID,
        title: input.sessionTitle,
        directory: input.sessionDirectory ?? Instance.directory,
      })
  const disposeLifecycle = () => {
    if (lifecycleDisposed) return
    lifecycleDisposed = true
    for (const disposable of lifecycleDisposables.reverse()) {
      try {
        disposable.dispose()
      } catch (err) {
        log.error("agent observer lifecycle cleanup failed", { agentID, sessionID: session.id, err })
      }
    }
  }
  const streamErrors: Array<{ reason: string; name?: string }> = []
  let finalMessage: Message.WithParts | undefined
  let promptGenerationOwner: AbortSignal | undefined
  let committedInputMessageID: string | undefined
  let untransferredMcpOwner: MCP.ScopedConnectionOwner | undefined
  try {
    if (existingSessionID) {
      if (session.kind !== kind) {
        throw new AgentRunError(kind, `existing session ${session.id} has kind=${session.kind}, expected ${kind}`)
      }
      const expectedDirectory = input.sessionDirectory ?? Instance.directory
      if (session.directory !== expectedDirectory) {
        throw new AgentRunError(
          kind,
          `existing session ${session.id} has directory=${session.directory}, expected ${expectedDirectory}`,
        )
      }
      const priorDescriptor = WorkerTurnDescriptor.latestForSession(session.id)
      if (priorDescriptor) {
        try {
          assertProjectedWorkerContinuationCompatible({
            previous: priorDescriptor.payload.identity,
            current: capabilityIdentity,
            subject: `existing session ${session.id}`,
          })
        } catch (error) {
          if (error instanceof ProjectedWorkerContinuationIncompatibleError) {
            throw new AgentRunError(kind, error.message, { cause: error })
          }
          throw error
        }
      }
      if (
        priorDescriptor &&
        (priorDescriptor.payload.expertSquadID !== workerCapability.expertSquadID ||
          !sameExpertSquadPackageRevision(priorDescriptor.payload.packageRevision, workerCapability.packageRevision) ||
          priorDescriptor.payload.lifecycle.taskID !== input.taskID ||
          !ProjectedAgentWorkScope.equals(priorDescriptor.payload.lifecycle.workScope, workScope))
      ) {
        throw new AgentRunError(
          kind,
          `existing session ${session.id} continuation authority is stale: ` +
            `expected ${workerCapability.expertSquadID}/${capabilityIdentity.agentID}/${input.taskID}, ` +
            `found ${priorDescriptor.payload.expertSquadID}/${priorDescriptor.payload.identity.agentID}/${priorDescriptor.payload.lifecycle.taskID}`,
        )
      }
      if (dispatchTurn?.kind !== "continuation") {
        throw new AgentRunError(kind, `existing session ${session.id} requires continuation dispatch authority`)
      }
      const priorTurn = priorDescriptor?.payload.dispatchTurn
      if (!priorTurn || priorTurn.workflow_occurrence_id !== dispatchTurn.workflow_occurrence_id) {
        throw new AgentRunError(
          kind,
          `existing session ${session.id} continuation occurrence does not match its descriptor`,
        )
      }
      if (dispatchTurn.child_session_id !== session.id) {
        throw new AgentRunError(kind, `existing session ${session.id} continuation child authority does not match`)
      }
      if (dispatchTurn.source_dispatch_id !== priorTurn.current_dispatch_id) {
        throw new AgentRunError(kind, `existing session ${session.id} continuation source dispatch does not match`)
      }
      if (JSON.stringify(priorTurn.workflow_binding) !== JSON.stringify(dispatchTurn.workflow_binding)) {
        throw new AgentRunError(kind, `existing session ${session.id} continuation workflow binding does not match`)
      }
      if (priorTurn.workflow_node_id !== dispatchTurn.workflow_node_id) {
        throw new AgentRunError(kind, `existing session ${session.id} continuation workflow node does not match`)
      }
      if (JSON.stringify(priorTurn.task_authority) !== JSON.stringify(dispatchTurn.task_authority)) {
        throw new AgentRunError(
          kind,
          `existing session ${session.id} continuation Task authority does not match its descriptor`,
        )
      }
      if (
        JSON.stringify(priorTurn.delivery_slice_revision_ids) !==
        JSON.stringify(dispatchTurn.delivery_slice_revision_ids)
      ) {
        throw new AgentRunError(
          kind,
          `existing session ${session.id} continuation Delivery Slice subjects do not match`,
        )
      }
    }

    // ── 5. Stream-error capture + abort propagation ──────────────────────
    // Bus payload is the NamedError shape from Message.fromError().toObject():
    // `{ name, data: { message, ... } }`. Reading `error.message` directly came
    // back undefined and lost the actual provider/stream cause (e.g. 429 body,
    // ECONNRESET, context-overflow detail). Unwrap data.message first so sub-
    // agent (build/architect/...) failure reasons are honest, matching the
    // orchestrator/agent.ts unwrap.
    let rawParentSignalOrigin: ReturnType<typeof createExecutionCancellationOrigin> | undefined
    const parentSignalOrigin = () => {
      if (isExecutionCancellationError(input.signal?.reason)) {
        return { ...input.signal.reason.origin, targetSessionID: session.id }
      }
      rawParentSignalOrigin ??= createExecutionCancellationOrigin({
        actor: "runtime",
        source: "agent.parent_signal",
        surface: "agent",
        requestID: dispatchTurn?.current_dispatch_id ?? session.id,
        reason: "parent Agent signal aborted",
        targetSessionID: session.id,
        taskID: input.taskID,
      })
      return rawParentSignalOrigin
    }
    const abortPrompt = () => {
      cancelSessionPromptInScope({
        session,
        taskID: input.taskID,
        handle: `${kind}.agent.signal`,
        origin: parentSignalOrigin(),
      })
    }
    let errorUnsub: (() => void) | undefined
    let abortListenerInstalled = false

    const installedMcpOwner = SessionRuntimeContractStore.get(session.id)?.resources?.mcp
    const mcpOwner =
      installedMcpOwner ??
      MCP.createScopedConnectionOwner(
        computerRuntimeScopeIdentity({ ownerKind: "worker", taskID: input.taskID, sessionID: session.id }),
      )
    if (!installedMcpOwner) untransferredMcpOwner = mcpOwner
    // ── 6. Invoke SessionPrompt with the agent's extra tools ─────────────
    const runtimeToolProjection = await PromptProfileResolver.projectWorkerTools(
      input.toolKit.tools,
      workerCapability,
      {
        taskID: input.taskID,
        projectDirectory,
        toolDirectory: session.directory,
        stageOwnedToolIDs: input.toolKit.stageOwnedToolIDs,
        connectionOwner: mcpOwner,
      },
    )
    const runtimeTools = {
      ...runtimeToolProjection.projectedTools,
      ...runtimeToolProjection.stageTools,
    }
    const enableMap = {
      ...promptToolSwitchesForAgentRun({
        extraToolNames: Object.keys(runtimeTools),
        explicitProjectedToolNames: workerCapability.projection.built_in_tool_ids,
        role,
      }),
      ...(input.toolSwitches ?? {}),
    }
    let byteMaterializationProjectID = session.projectID
    if (input.byteMaterializationProjectID) {
      if (input.byteMaterializationProjectID !== session.projectID) {
        throw new Error(
          `runAgentSession byteMaterializationProjectID ${input.byteMaterializationProjectID} does not match session project ${session.projectID}`,
        )
      }
      byteMaterializationProjectID = input.byteMaterializationProjectID
    }
    const { SessionPrompt } = await import("@/session/prompt")
    try {
      errorUnsub = Bus.subscribe(Session.Event.Error, (evt) => {
        const props = evt.properties as {
          sessionID: string
          error: { name?: string; message?: string; data?: { message?: string } }
        }
        if (props.sessionID !== session.id) return
        const reason = props.error?.data?.message ?? props.error?.message ?? "unknown error"
        streamErrors.push({ reason, name: props.error?.name })
      })
      log.info(`${agentID} agent starting`, {
        kind,
        sessionID: session.id,
        parentSessionID: input.parentSessionID,
        taskID: input.taskID,
        modelID: model.id,
        toolNames: Object.keys(runtimeTools),
        projectedRegistryToolIDs: workerCapability.builtInToolIDs,
        expertSquadID: workerCapability.expertSquadID,
        projectionHash: capabilityIdentity.projectionHash,
      })

      const promptArgs: Parameters<typeof SessionPrompt.prompt>[0] = {
        sessionID: session.id,
        messageID: userMessageID,
        author: "orchestrator",
        model: resolvedModelRef,
        agent: capabilityIdentity.agentID,
        byteMaterializationProjectID,
        extra: {
          // Projected workers expose Panel's task-scoped status surface. The
          // exact durable descriptor reference is attached after canonical
          // message materialization and before the atomic bundle commit.
          surface: "panel",
        },
        parts: parts as Parameters<typeof SessionPrompt.prompt>[0]["parts"],
      }
      const materializationIdentity = {
        agentID: capabilityIdentity.agentID,
        baseRole: capabilityIdentity.baseRole,
        runtime: executionRuntime,
      }
      const modelPreflight = {
        model: resolvedModelRef,
        variant:
          executionRuntime.variant && model.variants?.[executionRuntime.variant] ? executionRuntime.variant : undefined,
      }
      const materializationPrepared = preparedUserMessageFromPreflight({
        prompt: promptArgs,
        config: effectiveConfig,
        session,
        identity: materializationIdentity,
        modelPreflight,
      })
      const messageWriteClaim = SessionRuntimeContractStore.claimMessageWrite(session.id, undefined)
      let authorityBundle: {
        descriptor: WorkerTurnDescriptor.Info
        persistedUserMessageCompletion: ReturnType<typeof persistMaterializedUserMessageInTransaction>
        continuationPrepared: ReturnType<typeof rebindPreparedUserMessageInput>
        continuationPromptArgs: Parameters<typeof SessionPrompt.prompt>[0]
      }
      try {
        authorityBundle = await (async () => {
          const materialized = await materializeUserMessage(promptArgs, {
            prepared: materializationPrepared,
            executionAuthorityResolution: {
              expected: { kind: "task", taskID: input.taskID },
              ...(!existingSessionID ? { pendingSession: session } : {}),
            },
          })
          const expectedVariant = modelPreflight.variant
          if (
            materialized.info.role !== "user" ||
            materialized.info.id !== userMessageID ||
            materialized.info.sessionID !== session.id ||
            materialized.info.author !== "orchestrator" ||
            materialized.info.agent !== capabilityIdentity.agentID ||
            !isDeepStrictEqual(materialized.info.model, resolvedModelRef) ||
            materialized.info.variant !== expectedVariant ||
            materialized.info.extra?.surface !== "panel" ||
            new Set(materialized.parts.map((part) => part.id)).size !== materialized.parts.length ||
            materialized.parts.some((part) => part.messageID !== userMessageID || part.sessionID !== session.id)
          ) {
            throw new AgentRunError(kind, "projected worker message ownership changed during canonical materialization")
          }
          const materializedTextParts = materialized.parts.filter(
            (part): part is Message.TextPart => part.type === "text",
          )
          if (dispatchTurn?.kind === "continuation") {
            if (
              materialized.parts.length !== 1 ||
              materializedTextParts.length !== 1 ||
              materializedTextParts[0]?.text !== continuationText
            ) {
              throw new AgentRunError(kind, "projected worker continuation must remain one exact visible text Part")
            }
          }
          const messageAuthority = {
            user_message_id: materialized.info.id,
            control_text_parts: materializedTextParts.map((part) => ({
              part_id: part.id,
              text_sha256: controlTextSHA256(part.text),
            })),
          }
          descriptorDispatchTurn = dispatchTurn
            ? DispatchTurnSchema.parse(
                dispatchTurn.kind === "initial"
                  ? {
                      ...dispatchTurn,
                      task_authority: {
                        ...dispatchTurn.task_authority,
                        initial_user_message_id: materialized.info.id,
                        initial_control_text_parts: messageAuthority.control_text_parts,
                      },
                    }
                  : dispatchTurn,
              )
            : undefined
          let descriptor!: WorkerTurnDescriptor.Info
          let persistedUserMessageCompletion!: ReturnType<typeof persistMaterializedUserMessageInTransaction>
          let continuationPrepared!: ReturnType<typeof rebindPreparedUserMessageInput>
          let continuationPromptArgs!: Parameters<typeof SessionPrompt.prompt>[0]
          Database.transaction(() => {
            if (input.signal?.aborted) {
              throw new AgentRunError(kind, "aborted before initial dispatch authority commit")
            }
            if (!existingSessionID) Session.persistPreparedNext(session)
            const priorLifecycleEventID = ProtocolStore.latestSessionEvent(
              session.id,
              SessionStatus.Event.Status.type,
            )?.id
            descriptor = WorkerTurnDescriptor.prepare({
              sessionID: session.id,
              payload: {
                identity: capabilityIdentity,
                expertSquadID: workerCapability.expertSquadID,
                packageRevision: workerCapability.packageRevision,
                model: { selection: "explicit", ...resolvedModelRef },
                prompt: {
                  systemMode: "complete",
                  systemSha256: systemPromptHash,
                },
                tools: {
                  enabled: Object.keys(runtimeTools).sort(),
                  switches: enableMap,
                  ...(coordinationHandoffToolID ? { coordinationHandoff: coordinationHandoffToolID } : {}),
                },
                output: {
                  format: "text",
                  resultMode: "reply",
                },
                lifecycle: {
                  taskID: input.taskID,
                  workScope,
                  attemptID: input.runtimeContract?.attemptID,
                  priorLifecycleEventID,
                },
                messageAuthority,
                dispatchTurn: descriptorDispatchTurn,
              },
            })
            const descriptorMessageExtra = {
              ...materialized.info.extra,
              workerTurnDescriptor: { id: descriptor.id, hash: descriptor.hash },
            }
            continuationPromptArgs = SessionPrompt.PromptInput.parse({
              ...promptArgs,
              extra: descriptorMessageExtra,
            })
            continuationPrepared = rebindPreparedUserMessageInput(materializationPrepared, continuationPromptArgs)
            const authorityBoundMaterialized = bindMaterializedUserMessagePersistenceAuthority(materialized, {
              extra: descriptorMessageExtra,
              inputFingerprint: JSON.stringify(continuationPromptArgs),
            })
            persistedUserMessageCompletion = persistMaterializedUserMessageInTransaction(authorityBoundMaterialized, {
              commitBundle: () => {
                WorkerTurnDescriptor.persistPrepared({
                  descriptor,
                  onPersisted: input.onDispatchAuthorityCommit
                    ? (persistedDescriptor) => input.onDispatchAuthorityCommit!(session, persistedDescriptor)
                    : undefined,
                })
              },
            })
            if (input.signal?.aborted) {
              throw new AgentRunError(kind, "aborted during initial dispatch authority commit")
            }
          })
          return { descriptor, persistedUserMessageCompletion, continuationPrepared, continuationPromptArgs }
        })()
      } catch (error) {
        messageWriteClaim[Symbol.dispose]()
        throw error
      }
      const { descriptor, persistedUserMessageCompletion, continuationPrepared, continuationPromptArgs } =
        authorityBundle
      committedInputMessageID = descriptor.payload.messageAuthority.user_message_id
      messageWriteClaim[Symbol.dispose]()
      using promptRuntimeClaim = installAndClaimPreparedUserMessageRuntime(continuationPrepared, {
        identity: {
          identityKind: "projected-worker",
          sessionID: session.id,
          ...capabilityIdentity,
          expertSquadID: workerCapability.expertSquadID,
          packageRevision: workerCapability.packageRevision,
          workerTurnDescriptorID: descriptor.id,
          workerTurnDescriptorHash: descriptor.hash,
          taskID: input.taskID,
          workScope,
          attemptID: input.runtimeContract?.attemptID,
          contractKind: "stage-attempt",
          installedAt: Date.now(),
        },
        runtime: executionRuntime,
        projectedTools: runtimeToolProjection.projectedTools,
        stageTools: runtimeToolProjection.stageTools,
        system: [systemPrompt],
        systemMode: "complete",
        stream: input.stream,
        includeMcpTools: workerCapability.includeMcpTools,
        exactTools: input.runtimeContract?.exactTools,
        projectedRegistryToolIDs: workerCapability.builtInToolIDs,
        skillProjection,
        harnessProjection: PromptProfileResolver.workerHarnessProjection({
          taskID: input.taskID,
          capability: workerCapability,
        }),
        projectDirectory,
        resources: { mcp: mcpOwner },
      })
      untransferredMcpOwner = undefined
      if (input.signal) {
        input.signal.addEventListener("abort", abortPrompt, { once: true })
        abortListenerInstalled = true
        if (input.signal.aborted) {
          abortPrompt()
          throw new ExecutionCancellationError({
            source: "session_prompt",
            message: "aborted after initial dispatch authority commit",
            sessionID: session.id,
            origin: parentSignalOrigin(),
          })
        }
      }
      if (!existingSessionID && input.onSessionCreated) {
        registerLifecycle(await input.onSessionCreated(session))
      }
      const persistedUserMessage = await persistedUserMessageCompletion.complete()
      if (input.signal?.aborted) {
        throw new AgentRunError(kind, "aborted before runtime-ready notification")
      }
      if (input.onRuntimeReady) {
        registerLifecycle(await input.onRuntimeReady(session))
      }
      if (input.signal?.aborted) {
        throw new AgentRunError(kind, "aborted before prompt")
      }
      finalMessage = (await SessionPrompt.withPromptOwnerCapture(
        (owner) => {
          if (promptGenerationOwner && promptGenerationOwner !== owner) {
            throw new Error(`Session ${session.id} worker Turn captured multiple prompt generation owners`)
          }
          promptGenerationOwner = owner
        },
        () => {
          SessionPrompt.capturePromptOwner(session.id, session.directory)
          return SessionPrompt.continuePersistedPrompt(continuationPromptArgs, persistedUserMessage, {
            prepared: continuationPrepared,
            runtimeClaim: promptRuntimeClaim,
          })
        },
      )) as Message.WithParts
    } finally {
      try {
        errorUnsub?.()
      } catch (err) {
        log.warn("agent runner error subscription cleanup failed", { agentID, sessionID: session.id, err })
      }
      if (abortListenerInstalled) {
        input.signal?.removeEventListener("abort", abortPrompt)
        abortListenerInstalled = false
      }
      disposeLifecycle()
    }

    if (input.signal?.aborted) {
      throw new AgentRunError(kind, "aborted during prompt")
    }
    if (!finalMessage) {
      throw new AgentRunError(kind, "SessionPrompt.prompt returned no message")
    }
    if (!promptGenerationOwner) {
      throw new AgentRunError(kind, `Session ${session.id} worker Turn has no prompt generation owner`)
    }
    return await completeProjectedWorkerTurn({
      run: input,
      session,
      finalMessage,
      streamErrors,
      model: resolvedModelRef,
      effectiveOutputLimit: ProviderTransform.maxOutputTokens(model),
      agentID,
      kind,
      coordinationHandoffToolID,
      inputMessageID: committedInputMessageID!,
      promptGenerationOwner,
      signal: input.signal,
    })
  } catch (err) {
    await untransferredMcpOwner?.close()
    disposeLifecycle()
    if (err instanceof WorkerTurnSettlementError) throw err
    if (!committedInputMessageID) {
      recordDispatchPreparationError({
        taskID: input.taskID,
        attemptedSessionID: session.id,
        agentName: agentID,
        kind,
        error: err,
      })
      throw err
    }
    return await failProjectedWorkerTurn({
      run: input,
      session,
      finalMessage,
      streamErrors,
      agentID,
      kind,
      signal: input.signal,
      error: err,
      inputMessageID: committedInputMessageID,
      promptGenerationOwner,
    })
  }
}

export async function runAgentSession<C>(input: RunAgentSessionInput<C>): Promise<RunAgentSessionOutput<C>> {
  return await runAgentSessionInner(input)
}

// ---------------------------------------------------------------------------
// System-prompt composition — single source of truth.
//
// Order:
//   1. runtime-template core prompt
//   2. runtime-template operator append
//   3. active package prompt overlay
//   4. exact projected-agent operator append
//
// Per rule 22 / rule 25 this is the only path. Agents do not roll their
// own composition.
// ---------------------------------------------------------------------------

async function composeSystemPrompt(input: {
  taskID: string
  baseRole: RuntimeTemplateID
  core: string
  projectDirectory: string
  capability: PromptProfileResolver.ResolvedWorkerCapability
}): Promise<{ prompt: string }> {
  const base = [input.core, input.capability.promptLayers.templateAppend]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join("\n\n")
  const prompt = appendScopedProjectSourceBoundary({
    baseRole: input.baseRole,
    prompt: await PromptProfileResolver.composeResolvedAgentPrompt({
      taskID: input.taskID,
      projectDirectory: input.projectDirectory,
      base,
      userAppend: input.capability.promptLayers.projectedAgentAppend,
      capability: input.capability,
    }),
  })
  return { prompt }
}

// ---------------------------------------------------------------------------
// Re-export — agents may need the LanguageModel type when accepting an
// optional model override at the call site. Keeping this here so agent
// modules import a single place for runner+model types.
// ---------------------------------------------------------------------------

export type { LanguageModel }
