import z from "zod"
import Ajv2020 from "ajv/dist/2020"
import type { AnySchema, ErrorObject } from "ajv"
import { Identifier } from "../id/id"
import { Message } from "./message"
import { MessageStore } from "./message-store"
import { NotFoundError } from "@/storage/db"
import { Session } from "."
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { Provider } from "../provider/provider"
import {
  type Tool as AITool,
  tool,
  jsonSchema,
  type ToolExecutionOptions,
  asSchema,
  type ModelMessage,
  InvalidToolInputError,
} from "ai"
import { SessionCompaction } from "./compaction"
import { CompactionOverflow } from "./compaction-overflow"
import { CompactionHandoff } from "./compaction-handoff"
import { SessionControl } from "./control"
import { controlPromptProjection, controlToolContext } from "@/control/prompt"
import { resolveSessionExecutionAuthority, taskIDForSession } from "@/engine/task-session-lineage"
import { findDispatchLineageByToolExecution } from "@/engine/dispatch-lineage"
import { ContextBudget } from "./context-budget"
import { Instance } from "../project/instance"
import { InstanceLifecycleContext } from "../project/instance-lifecycle-context"
import { AttachmentStore } from "@/storage/attachment-store"
import { materializeMcpToolResult, materializedMcpAttachmentsToFileParts } from "@/mcp/materialize"
import { Bus } from "../bus"
import { ProviderTransform } from "../provider/transform"
import { ProviderSchema } from "../provider/schema"
import { requiresOpenAIStrictToolSchema } from "../provider/strict-tool-schema"
import { materializeToolExecutionInput } from "../provider/tool-execution-input"
import { SystemPrompt } from "./system"
import { EffectiveConfig } from "@/config/effective"
import { resolveAgentModel, resolveProjectedWorkerModel } from "@/agent/model"
import { InstructionPrompt } from "./instruction"
import { Plugin } from "../plugin"
import MAX_STEPS from "../session/prompt/max-steps.txt"
import { defer } from "../util/defer"
import { ToolRegistry } from "../tool/registry"
import { Env } from "../env"
import { MCP } from "../mcp"
import {
  browserMcpPermissionKeyOf,
  browserMcpToolKeyFromRuntimeName,
  executeBrowserMcpToolWithPermission,
  mcpPermissionPlan,
} from "@/mcp/browser/permission-plan"
import {
  computerMcpPermissionKeyOf,
  computerMcpToolKeyFromRuntimeName,
  executeComputerMcpToolWithPermission,
} from "@/mcp/computer/permission-plan"
import { NamedError } from "@opencorvus-ai/util/error"
import { fn } from "@/util/fn"
import { SessionProcessor } from "./processor"
import { MissionSkillTool, SkillTool } from "@/tool/skill"
import { Tool } from "@/tool/tool"
import { withTaskToolInvocation } from "@/tool/task-tool-invocation"
import type { ResolvedSkillSurface } from "@/skill/surface"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { PermissionNext } from "@/permission/next"
import { SessionStatus, sessionLifecycleOrderKey } from "./status"
import { ensureTitle } from "./prompt/title"
import { Truncate } from "@/tool/truncation"
import {
  createToolExecutionSurface,
  applyToolExecutionPolicy,
  toolSwitchAllows as executionToolSwitchAllows,
  type ToolExecutionSurface,
} from "@/tool/execution-surface"
import { TASK_ARTIFACT_DISCOVERY_TOOL_IDS, TASK_ARTIFACT_TOOL_IDS } from "@/tool/tool-id-catalog"
import { MemoryInjection } from "@/memory/injection"
import { resolveSessionMessageIdentity } from "./message-identity"
import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"
import { RuntimeTemplateID } from "@/agent/runtime-template-id"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { TaskPlan } from "@/memory/task-plan"
import { SessionSummary } from "./summary"
import { SessionPromptState } from "./prompt/state"
import { isExecutionCancellationError } from "./prompt/cancellation"
import { toolFailureCauseFromUnknown } from "./tool-failure-cause"
import {
  cloneToolInputForPersistence,
  materializeToolResultInlineAttachments,
  redactToolDiagnosticValue,
} from "@/tool/result-attachment-materialization"
import { ToolLiveMetadataSink } from "@/tool/live-metadata-sink"
import { runSessionPrompt } from "./prompt/run"
import { muteAISdkWarnings } from "@/runtime/shims"
import { Config } from "@/config/config"
import { Token } from "@/util/token"
import { decodeDataUrlBase64Bytes } from "./text-mime"
import { normalizeToolInput } from "./tool-input-norm"
import { configureSessionShellResume } from "./shell-exec"
import {
  assertSessionLoopRuntimeContract,
  isProjectedSchedulerRuntimeContract,
  sessionRuntimeToolRecords,
  SessionRuntimeContractStore,
  type SessionRuntimeContract as RuntimeContract,
  type SessionRuntimeContractIdentity as RuntimeContractIdentity,
  type SessionRuntimeContractKind as RuntimeContractKind,
} from "./runtime-contract"
import {
  sessionKindRequiresRuntimeContract as sessionKindRequiresRuntimeContractImpl,
  validateSessionRuntimeContractForContinuation as validateSessionRuntimeContractForContinuationImpl,
} from "./runtime-contract-validation"
import { createMcpAppToolLifecycle, mcpAppAuthorityForRuntimeTool } from "@/interactive-artifact/mcp-app-lifecycle"
import { visibleMentionDirectiveRanges } from "@opencorvus-ai/transport-protocol"
import type { HarnessProjection } from "@/capability/harness-projection"

muteAISdkWarnings()

const STRUCTURED_OUTPUT_DESCRIPTION =
  "Record structured data matching the requested schema when it is useful; also summarize the turn in the visible assistant message."

function visibleChatSkillNames(messages: readonly Message.WithParts[]): string[] {
  const currentUserMessage = messages.findLast((message) => message.info.role === "user")
  if (!currentUserMessage) return []
  const names = new Set<string>()
  for (const part of currentUserMessage.parts) {
    if (part.type !== "text" || (part.source !== undefined && part.source !== "user")) continue
    for (const directive of visibleMentionDirectiveRanges(part.text)) {
      if (directive.kind === "skill") names.add(directive.value)
    }
  }
  return [...names]
}

export namespace SessionLoop {
  async function resolveToolExecutionAuthority(input: {
    sessionID: string
    projectID: string
    runtimeIdentity?: { taskID: string }
  }) {
    return resolveSessionExecutionAuthority({
      sessionID: input.sessionID,
      projectID: input.projectID,
      expected: input.runtimeIdentity
        ? { kind: "task", taskID: input.runtimeIdentity.taskID }
        : { kind: "conversation" },
    })
  }

  export function toolExecutionExtra(input: { messageExtra?: Record<string, unknown>; model: Provider.Model }) {
    const { taskID: _untrustedTaskID, ...messageExtra } = input.messageExtra ?? {}
    return {
      ...messageExtra,
      model: input.model,
    }
  }

  const { log, state, cancel, finish, flushCallbacks, enterLoop, touch } = SessionPromptState

  type StrictAITool = AITool & { strict?: boolean }
  const resolvedToolSkillSurfaces = new WeakMap<Record<string, AITool>, ResolvedSkillSurface>()
  const resolvedToolSkillFinalizers = new WeakMap<
    Record<string, AITool>,
    (availableToolNames: Iterable<string>) => Promise<ResolvedSkillSurface | undefined>
  >()

  function strictTool(input: AITool): AITool {
    return { ...(input as StrictAITool), strict: true } as AITool
  }

  export async function finalizeResolvedToolSkillSurface(
    tools: Record<string, AITool>,
    availableToolNames: Iterable<string>,
  ) {
    const finalize = resolvedToolSkillFinalizers.get(tools)
    if (!finalize) return resolvedToolSkillSurfaces.get(tools)
    return await finalize(availableToolNames)
  }

  export function skillSurfaceForResolvedTools(tools: Record<string, AITool>) {
    return resolvedToolSkillSurfaces.get(tools)
  }

  export type SessionRuntimeContractKind = RuntimeContractKind
  export type SessionRuntimeContractIdentity = RuntimeContractIdentity
  export type SessionRuntimeContract = RuntimeContract

  // ---------------------------------------------------------------------------
  // Session-scoped runtime contract
  //
  // A runtime contract contains only process-local execution resources for one
  // model turn: instantiated tools, stream hooks, cancellation ownership, and
  // scoped MCP (Model Context Protocol) connections. It is disposable cache,
  // not proof that the durable Session is alive or eligible for coordination.
  //
  // A fresh Turn reconstructs this cache from the persisted
  // WorkerTurnDescriptor. Losing the cache on process restart therefore changes
  // only how the next Turn is executed; it never invalidates the Session or
  // prevents a durable operator coordination request from being accepted.
  // ---------------------------------------------------------------------------
  export function setSessionRuntimeContract(
    sessionID: string,
    contract: SessionRuntimeContract | undefined,
    options: { armWake?: boolean; notifyWake?: boolean } = {},
  ): SessionRuntimeContract | undefined {
    if (!contract) {
      SessionRuntimeContractStore.clear(sessionID)
      return
    }
    return SessionRuntimeContractStore.set(sessionID, contract, options)
  }

  export function armSessionRuntimeContractWake(sessionID: string, expected: SessionRuntimeContract): void {
    SessionRuntimeContractStore.armPendingWake(sessionID, expected)
  }

  export function waitForSessionRuntimeContractWakeSettlement(
    sessionID: string,
    expected: SessionRuntimeContract,
  ): Promise<void> {
    return SessionRuntimeContractStore.waitForWakeConsumed(sessionID, expected)
  }

  export function getSessionRuntimeContract(sessionID: string): SessionRuntimeContract | undefined {
    return SessionRuntimeContractStore.get(sessionID)
  }

  export function clearSessionRuntimeContract(sessionID: string): SessionRuntimeContract["resources"] | undefined {
    return SessionRuntimeContractStore.clear(sessionID)
  }

  export async function disposeSessionRuntimeContract(sessionID: string): Promise<void> {
    await SessionRuntimeContractStore.dispose(sessionID)
  }

  function shouldRunRuntimeContractTurn(sessionID: string): boolean {
    return SessionRuntimeContractStore.hasPendingWake(sessionID)
  }

  function consumeRuntimeContractTurn(sessionID: string): void {
    SessionRuntimeContractStore.consumeWake(sessionID)
  }

  function isActionableSessionControl(control: SessionControl.Record): boolean {
    return control.kind === "compaction_request" || control.kind === "manual_summarize"
  }

  function hasPendingAutomaticCompactionControl(sessionID: string): boolean {
    return SessionControl.pending(sessionID).some((control) => control.kind === "compaction_request")
  }

  function compactionControlErrorText(error: unknown): string {
    if (error && typeof error === "object") {
      const value = error as { name?: unknown; data?: { message?: unknown } }
      if (typeof value.name === "string" && typeof value.data?.message === "string") {
        return `${value.name}: ${value.data.message}`
      }
    }
    if (error instanceof Error) return `${error.name}: ${error.message}`
    return String(error)
  }

  function compactionControlThrowable(error: unknown): Error {
    if (error instanceof Error) return error
    const value = error as { name?: unknown; data?: { message?: unknown } } | undefined
    const result = new Error(
      typeof value?.data?.message === "string" ? value.data.message : compactionControlErrorText(error),
      { cause: error },
    )
    if (typeof value?.name === "string") result.name = value.name
    return result
  }

  function compactionControlSettlementConflict(input: {
    control: SessionControl.Record
    intendedStatus: "consumed" | "failed"
    cause?: unknown
  }): Error {
    return new Error(
      `Compaction control ${input.control.id} was no longer pending while settling ${input.intendedStatus}.`,
      input.cause === undefined ? undefined : { cause: input.cause },
    )
  }

  async function executeCompactionControl(input: {
    control: SessionControl.Record
    sessionID: string
    run: () => Promise<Awaited<ReturnType<typeof SessionCompaction.process>>>
  }): Promise<"continue" | "stop"> {
    let result: Awaited<ReturnType<typeof SessionCompaction.process>>
    try {
      result = await input.run()
    } catch (error) {
      const settled = SessionControl.fail({
        id: input.control.id,
        sessionID: input.sessionID,
        error: compactionControlErrorText(error),
      })
      if (!settled) {
        throw compactionControlSettlementConflict({ control: input.control, intendedStatus: "failed", cause: error })
      }
      throw error
    }
    if (typeof result === "object") {
      const throwable = compactionControlThrowable(result.error)
      const settled = SessionControl.fail({
        id: input.control.id,
        sessionID: input.sessionID,
        error: compactionControlErrorText(result.error),
      })
      if (!settled) {
        throw compactionControlSettlementConflict({
          control: input.control,
          intendedStatus: "failed",
          cause: throwable,
        })
      }
      throw throwable
    }
    const settled = SessionControl.consume({ id: input.control.id, sessionID: input.sessionID })
    if (!settled) {
      throw compactionControlSettlementConflict({ control: input.control, intendedStatus: "consumed" })
    }
    return result
  }

  export const sessionKindRequiresRuntimeContract = sessionKindRequiresRuntimeContractImpl
  export const validateSessionRuntimeContractForContinuation = validateSessionRuntimeContractForContinuationImpl

  function workerTurnDescriptorPayloadForRuntimeContract(
    contract: SessionRuntimeContract | undefined,
    sessionID: string,
  ): WorkerTurnDescriptor.Payload | undefined {
    const descriptorID = contract?.identity.workerTurnDescriptorID
    if (!descriptorID) return undefined
    return WorkerTurnDescriptor.get({ id: descriptorID, sessionID })?.payload
  }

  function toolSwitchesFromWorkerTurnDescriptor(
    descriptor: WorkerTurnDescriptor.Payload | undefined,
  ): Record<string, boolean> | undefined {
    if (!descriptor) return undefined
    if (descriptor.tools.switches) return descriptor.tools.switches
    return Object.fromEntries(descriptor.tools.enabled.map((name) => [name, true]))
  }

  // ---------------------------------------------------------------------------
  // Ephemeral per-session step-finish hook (phase 3-a-4 of specs/current/architecture/16-unified-teardown.md)
  //
  // Agents that dispatch work via a tool and then want to stop the LLM
  // generation once the tool has acknowledged the dispatch (the orchestrator
  // pattern: `dispatch_agent` fires, the signal aborts the active turn) need
  // a hook that runs after every LLM turn inside the session loop. AI SDK's
  // `onStepFinish` gives this at the stream level; SessionLoop does not
  // expose it natively, so callers register a process-local callback the
  // loop fires after each `processTurn` returns.
  //
  // Scope rules mirror the runtime contract: in-memory only, one entry per
  // sessionID, replaced wholesale on repeat calls, cleared on sentinel/
  // callback completion, and NOT persisted across process restart.
  // ---------------------------------------------------------------------------
  export interface StepHookEvent {
    /** 1-indexed turn number within this session's current prompt cycle. */
    step: number
    /** Outcome of the turn processTurn just completed. */
    turn: "stop" | "continue"
  }
  export type StepHook = (event: StepHookEvent) => void | Promise<void>

  const ephemeralStepHooks = new Map<string, StepHook>()

  /** Register a step-finish hook for a session. Passing `undefined` clears. */
  export function setStepHook(sessionID: string, hook: StepHook | undefined): void {
    if (!hook) {
      ephemeralStepHooks.delete(sessionID)
      return
    }
    ephemeralStepHooks.set(sessionID, hook)
  }

  /** Internal: fire the registered step hook, swallowing errors. */
  async function fireStepHook(sessionID: string, event: StepHookEvent): Promise<void> {
    const hook = ephemeralStepHooks.get(sessionID)
    if (!hook) return
    try {
      await hook(event)
    } catch (err) {
      log.warn("step-hook threw; loop continues", {
        sessionID,
        step: event.step,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  /** Convenience wrapper: set the hook, run `fn`, always clear afterwards
   *  regardless of whether `fn` resolved or threw. */
  export async function withStepHook<T>(sessionID: string, hook: StepHook, fn: () => Promise<T>): Promise<T> {
    setStepHook(sessionID, hook)
    try {
      return await fn()
    } finally {
      setStepHook(sessionID, undefined)
    }
  }

  // ---------------------------------------------------------------------------
  // Structured-output validation
  //
  // Some typed output facts need semantic validation that JSON Schema cannot
  // express. The validator belongs to the disposable Turn runtime because it
  // may close over Turn-local facts; it validates output shape and meaning but
  // does not decide scheduling, acceptance, or Session liveness.
  // ---------------------------------------------------------------------------

  const structuredOutputAjv = new Ajv2020({ allErrors: true, strict: false })

  type StructuredOutputPayloadValidator = (
    value: Record<string, unknown>,
  ) => { success: true } | { success: false; error: string }

  function isStructuredOutputPayload(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value)
  }

  function structuredOutputPayloadType(value: unknown): string {
    if (value === undefined) return "undefined"
    if (value === null) return "null"
    if (Array.isArray(value)) return "array"
    return typeof value
  }

  function formatJsonSchemaErrors(errors: ErrorObject[] | null | undefined): string {
    if (!errors?.length) return "schema validator rejected the payload"
    return errors.map((error) => `${error.instancePath || "<root>"} ${error.message ?? "is invalid"}`).join("; ")
  }

  function compileStructuredOutputPayloadValidator(schema: unknown): StructuredOutputPayloadValidator {
    const validate = structuredOutputAjv.compile(schema as AnySchema)
    return (value) => {
      if (validate(value)) return { success: true }
      return { success: false, error: formatJsonSchemaErrors(validate.errors) }
    }
  }

  export function validateStructuredOutputPayload(
    payload: unknown,
    validator: StructuredOutputPayloadValidator,
  ): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
    if (!isStructuredOutputPayload(payload)) {
      return {
        ok: false,
        reason: `StructuredOutput payload must be a JSON object; received ${structuredOutputPayloadType(payload)}`,
      }
    }

    const validation = validator(payload)
    if (!validation.success) {
      return {
        ok: false,
        reason: `StructuredOutput payload did not match the registered JSON schema: ${validation.error}`,
      }
    }

    return { ok: true, value: payload }
  }

  /**
   * Predictive-compaction decision constants (Phase C).
   *
   * `TOOL_SCHEMA_BUDGET_RATIO_DEFAULT` — fraction of usable budget that
   * tool schemas alone must NOT exceed. Compaction never touches tool
   * definitions, so this is a structural guard: when an agent's tool
   * surface alone overruns the model, we fail fast rather than retry an
   * impossible turn. Override via env `OPENCORVUS_TOOL_SCHEMA_BUDGET_RATIO`.
   *
   * `COMPACTION_MIN_RESIDUE_CHARS` — even after a perfect compaction the
   * request still carries the active user message + a minimum-viable
   * summary in the message body. We use ~6 KB as a conservative residue
   * estimate (≈ 1.5 K tokens) for the post-compaction sizing check.
   */
  const TOOL_SCHEMA_BUDGET_RATIO_DEFAULT = 0.5
  const COMPACTION_MIN_RESIDUE_CHARS = 6_000

  function toolSchemaBudgetRatio(): number {
    const raw = Number(Env.get("OPENCORVUS_TOOL_SCHEMA_BUDGET_RATIO") ?? "")
    return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : TOOL_SCHEMA_BUDGET_RATIO_DEFAULT
  }

  export type PredictiveCompactionDecision =
    | { kind: "skip" }
    | { kind: "compact" }
    | { kind: "fail-tool-schema" }
    | { kind: "fail-prompt-budget"; reason: "post-compaction-still-over" | "nothing-to-compress" }

  /**
   * Pure decision: given the budget metrics for the next turn, should we
   * predictively compact, fail fast, or just send the request?
   *
   * Per structured-output systemic fix record §C the
   * old behaviour ("totalTokens > limit → always compact") spun forever on
   * context-cold sessions whose overflow came entirely from the
   * non-compressible prompt face (system + tool schemas). The new logic:
   *
   *   1. tool schemas alone over `toolSchemaBudgetRatio` of budget →
   *      `fail-tool-schema` (rule 22 — there is no recovery, raise).
   *   2. estimate the residue after a perfect compaction: system + tool
   *      schemas + a minimum-viable summary + last user message. If that
   *      already exceeds the budget, compaction cannot rescue this call;
   *      fail with `post-compaction-still-over`.
   *   3. compute overflow vs the compressible message body. If the
   *      compressible content is smaller than the overflow we need to
   *      eject, compaction has nothing meaningful to fold up; fail with
   *      `nothing-to-compress`.
   *   4. otherwise → `compact`.
   *
   * `assistantMsgCount === 0` is NOT a hard fail-fast trigger on its own;
   * a jumbo first user message can still be compactable. The decision is
   * driven purely by whether compaction can reach the budget.
   */
  export function predictiveCompactionDecision(input: {
    totalTokensEst: number
    limit: number
    usableBudget: number
    systemChars: number
    toolSchemaChars: number
    messagePayloadChars: number
    mediaTokensEst: number
    toolSchemaBudgetRatio: number
    minResidueChars?: number
    lastFinishedSummary: boolean
  }): PredictiveCompactionDecision {
    if (input.usableBudget === 0) return { kind: "skip" }
    if (input.lastFinishedSummary) return { kind: "skip" }
    if (input.totalTokensEst <= input.limit) return { kind: "skip" }

    const toolSchemaTokensEst = Token.estimateCharacters(input.toolSchemaChars)
    if (toolSchemaTokensEst > input.usableBudget * input.toolSchemaBudgetRatio) {
      return { kind: "fail-tool-schema" }
    }

    const minResidueChars = input.minResidueChars ?? COMPACTION_MIN_RESIDUE_CHARS
    const nonCompressibleChars = input.systemChars + input.toolSchemaChars
    const postCompactionMinTokens =
      Token.estimateCharacters(nonCompressibleChars + minResidueChars) + input.mediaTokensEst
    if (postCompactionMinTokens > input.limit) {
      return { kind: "fail-prompt-budget", reason: "post-compaction-still-over" }
    }

    const overflowTokens = input.totalTokensEst - input.limit
    const compressibleTokens = Token.estimateCharacters(input.messagePayloadChars)
    const minResidueTokens = Token.estimateCharacters(minResidueChars)
    if (compressibleTokens < overflowTokens + minResidueTokens) {
      return { kind: "fail-prompt-budget", reason: "nothing-to-compress" }
    }

    return { kind: "compact" }
  }

  async function stopTurnWithPredictiveBudgetError(input: {
    processor: SessionProcessor.Info
    sessionID: string
    error: NonNullable<Message.Assistant["error"]>
  }) {
    const message = typeof input.error?.data?.message === "string" ? input.error.data.message : input.error?.name
    input.processor.message.error = input.error
    input.processor.message.finish = "error"
    input.processor.message.time.completed = Date.now()
    await Session.updatePart({
      id: Identifier.ascending("part"),
      sessionID: input.sessionID,
      messageID: input.processor.message.id,
      type: "text",
      text: `Predictive compaction budget error: ${input.error?.name}${message ? `: ${message}` : ""}`,
      time: {
        start: Date.now(),
        end: Date.now(),
      },
    } satisfies Message.TextPart)
    await Session.updateMessage(input.processor.message)
    await Bus.publish(Session.Event.Error, {
      sessionID: input.sessionID,
      orderKey: sessionLifecycleOrderKey(input.sessionID),
      error: input.error,
    })
    return "stop" as const
  }

  function alreadyCompactedPromptBudgetError(input: {
    sourceUserID: string
    reason: string
    systemTokensEst: number
    messagePayloadChars: number
    toolSchemaChars: number
    systemChars: number
    usableBudget: number
    limit: number
    toolNames: string
  }) {
    return new Message.PromptBudgetOverflowError({
      message:
        `${input.reason} after source user ${input.sourceUserID} already had ` +
        `a valid structured compaction summary. Queueing another same-source ` +
        `compaction cannot reduce the remaining filtered prompt.`,
      systemTokensEst: input.systemTokensEst,
      messagePayloadChars: input.messagePayloadChars,
      toolSchemaChars: input.toolSchemaChars,
      compressibleMessageChars: input.messagePayloadChars,
      nonCompressiblePromptChars: input.systemChars + input.toolSchemaChars,
      usableBudget: input.usableBudget,
      limit: input.limit,
      toolNames: input.toolNames,
    }).toObject()
  }

  /**
   * Compatibility wrapper for tests and estimator contracts that need the
   * provider-bound JSON Schema shape. The implementation lives in
   * ProviderSchema so tool inputs and structured outputs cannot drift.
   */
  export function normalizeToolSchemaForProvider<T>(
    model: Provider.Model,
    rawJsonSchema: T,
  ): ReturnType<typeof ProviderTransform.schema> {
    return ProviderSchema.normalize(model, rawJsonSchema as never)
  }

  /**
   * Provider-normalized estimate of the bytes a tool definition contributes
   * to the streamText request payload. AI SDK serialises each tool as
   * `{name, description, parameters: <jsonSchema>}` where the JSON Schema is
   * obtained via `asSchema(tool.inputSchema).jsonSchema`. Earlier versions
   * `JSON.stringify`'d the raw `tool.inputSchema` wrapper which, for Zod-
   * backed tools, walks the Zod object's internal `_def` graph and produces
   * char counts that bear no relation to the actual outgoing payload — that
   * inflated count was triggering predictive compaction on context-cold
   * sessions (see structured-output systemic fix record
   * §A). Counting `name + description + jsonSchema` keeps the estimate tied
   * to what the provider really receives. ProviderSchema is the single
   * schema-normalisation entry point; the estimator never re-runs the
   * transform and only unwraps the already-normalised schema via
   * `asSchema(...)`.
   */
  export function estimateToolPayloadChars(tools: Record<string, AITool>): number {
    let total = 0
    for (const [name, item] of Object.entries(tools)) {
      const description =
        typeof (item as { description?: unknown }).description === "string"
          ? (item as { description: string }).description.length
          : 0
      let schemaChars = 0
      const inputSchema = (item as { inputSchema?: unknown }).inputSchema
      if (inputSchema !== undefined && inputSchema !== null) {
        try {
          const jsonSchemaPayload = asSchema(inputSchema as never).jsonSchema
          schemaChars = JSON.stringify(jsonSchemaPayload ?? {}).length
        } catch {
          schemaChars = 0
        }
      }
      total += name.length + description + schemaChars
    }
    return total
  }

  export type ProviderToolSource = "registry" | "mcp" | "extra" | "structured"

  export class ToolInputSchemaError extends Error {
    constructor(message: string, options?: ErrorOptions) {
      super(message, options)
      this.name = "ToolInputSchemaError"
    }
  }

  export function providerBoundInputSchema(input: {
    name: string
    source: ProviderToolSource
    model: Provider.Model
    inputSchema: unknown
  }) {
    if (input.inputSchema === undefined || input.inputSchema === null) {
      throw new ToolInputSchemaError(`tool ${input.name} from ${input.source} is missing inputSchema`)
    }
    try {
      return ProviderSchema.input(input.model, input.inputSchema)
    } catch (err) {
      throw new ToolInputSchemaError(
        `tool ${input.name} from ${input.source} has invalid inputSchema: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { cause: err instanceof Error ? err : undefined },
      )
    }
  }

  export function prepareProviderTool(input: {
    name: string
    source: ProviderToolSource
    model: Provider.Model
    tool: AITool
  }): AITool {
    type ToolWithExecution = AITool & {
      inputSchema?: unknown
      toModelOutput?: unknown
      execute?: (...args: any[]) => any
    }
    const raw = input.tool as ToolWithExecution
    const execute = raw.execute
    const prepared = {
      ...(input.tool as any),
      inputSchema: providerBoundInputSchema({
        name: input.name,
        source: input.source,
        model: input.model,
        inputSchema: raw.inputSchema,
      }),
      ...(typeof execute === "function"
        ? {
            async execute(args: unknown, options: ToolExecutionOptions) {
              const materializedArgs = await materializeProviderToolExecutionInput({
                name: input.name,
                model: input.model,
                inputSchema: raw.inputSchema,
                args,
              })
              return execute(materializedArgs, options)
            },
          }
        : {}),
      ...(typeof raw.toModelOutput === "function"
        ? {}
        : {
            toModelOutput: (args: unknown) => Message.toolResultToModelOutput(args, input.model),
          }),
    } as AITool
    if (log.enabled("DEBUG")) {
      const schemaPayload = asSchema((prepared as { inputSchema?: unknown }).inputSchema as never).jsonSchema
      const rootType =
        schemaPayload && typeof schemaPayload === "object" && "type" in schemaPayload
          ? (schemaPayload as { type?: unknown }).type
          : undefined
      log.debug("prepared provider tool schema", {
        source: input.source,
        tool: input.name,
        rootType,
        schemaChars: JSON.stringify(schemaPayload ?? {}).length,
      })
    }
    return prepared
  }

  async function materializeProviderToolExecutionInput(input: {
    name: string
    model: Provider.Model
    inputSchema: unknown
    args: unknown
  }): Promise<unknown> {
    type ValidationResult = { success: true; value: unknown } | { success: false; error: unknown }
    const schema = asSchema(input.inputSchema as never) as {
      validate?: (args: unknown) => Promise<ValidationResult>
    }
    const args = requiresOpenAIStrictToolSchema(input.model)
      ? materializeOpenAIStrictToolInput(input.name, input.inputSchema, input.args)
      : input.args
    if (typeof schema.validate !== "function") return args

    let result: ValidationResult
    try {
      result = await schema.validate(args)
    } catch (err) {
      throw invalidProviderToolInput(input.name, args, err)
    }
    if (result.success) return result.value
    throw invalidProviderToolInput(input.name, args, result.error)
  }

  function materializeOpenAIStrictToolInput(toolName: string, inputSchema: unknown, args: unknown): unknown {
    try {
      return materializeToolExecutionInput(inputSchema, args)
    } catch (err) {
      throw invalidProviderToolInput(toolName, args, err)
    }
  }

  function invalidProviderToolInput(toolName: string, args: unknown, cause: unknown): InvalidToolInputError {
    return new InvalidToolInputError({
      toolName,
      toolInput: stringifyToolInput(args),
      cause,
    })
  }

  function stringifyToolInput(args: unknown): string {
    try {
      return JSON.stringify(args) ?? String(args)
    } catch {
      return String(args)
    }
  }

  export function providerToolResultToModelOutput(args: unknown) {
    const output = unwrapAIToolModelOutputArgs(args)
    if (typeof output === "string") return { type: "text", value: output }
    if (isProjectToolResult(output)) return { type: "text", value: output.output }
    return { type: "json", value: output as never }
  }

  function unwrapAIToolModelOutputArgs(args: unknown): unknown {
    if (!args || typeof args !== "object") return args
    const record = args as Record<string, unknown>
    if ("toolCallId" in record && "output" in record) return record.output
    return args
  }

  function isProjectToolResult(output: unknown): output is { output: string } {
    return !!output && typeof output === "object" && typeof (output as Record<string, unknown>).output === "string"
  }

  export function summarizeModelMessagePayloads(messages: ModelMessage[], limit = 8) {
    const rows: Array<{
      messageIndex: number
      partIndex: number
      role: string
      type: string
      chars: number
      toolName?: string
      toolCallId?: string
      mediaType?: string
    }> = []
    messages.forEach((message, messageIndex) => {
      const content = Array.isArray(message.content) ? message.content : [{ type: "text", text: message.content }]
      content.forEach((part, partIndex) => {
        const p = part as Record<string, unknown>
        rows.push({
          messageIndex,
          partIndex,
          role: message.role,
          type: typeof p.type === "string" ? p.type : "unknown",
          chars: JSON.stringify(part).length,
          toolName: typeof p.toolName === "string" ? p.toolName : undefined,
          toolCallId: typeof p.toolCallId === "string" ? p.toolCallId : undefined,
          mediaType: typeof p.mediaType === "string" ? p.mediaType : undefined,
        })
      })
    })
    return rows.sort((a, b) => b.chars - a.chars).slice(0, limit)
  }

  type MediaKind = "image" | "pdf" | "audio" | "video"

  export type ModelMessagePayloadEstimate = {
    messagePayloadChars: number
    mediaCounts: Record<MediaKind, number>
    mediaTokensEst: number
  }

  const MEDIA_TOKENS_PER_PART: Record<MediaKind, number> = {
    image: 1_600,
    pdf: 3_200,
    audio: 1_600,
    video: 1_600,
  }

  function mediaKindFromMime(mime: unknown): MediaKind | undefined {
    if (typeof mime !== "string") return undefined
    const normalized = mime.toLowerCase()
    if (normalized.startsWith("image/")) return "image"
    if (normalized === "application/pdf") return "pdf"
    if (normalized.startsWith("audio/")) return "audio"
    if (normalized.startsWith("video/")) return "video"
    return undefined
  }

  function mediaKindFromDataUrl(value: unknown): MediaKind | undefined {
    if (typeof value !== "string" || !value.startsWith("data:")) return undefined
    const match = /^data:([^;,]+)/i.exec(value)
    return mediaKindFromMime(match?.[1])
  }

  function mediaKindFromPart(part: Record<string, unknown>): MediaKind | undefined {
    const byMime = mediaKindFromMime(part.mediaType ?? part.mime)
    if (byMime) return byMime

    const type = typeof part.type === "string" ? part.type.toLowerCase() : ""
    if (type === "image" || type === "image-data") return "image"
    if (type === "pdf") return "pdf"

    return (
      mediaKindFromDataUrl(part.url) ??
      mediaKindFromDataUrl(part.data) ??
      mediaKindFromDataUrl(part.image) ??
      mediaKindFromDataUrl(part.media)
    )
  }

  function isMediaPayloadField(key: string): boolean {
    return key === "url" || key === "data" || key === "image" || key === "media"
  }

  /**
   * Estimate text-token pressure without treating inline media bytes as text.
   * AI SDK model messages carry image/PDF/audio/video parts as data URLs, but
   * provider tokenization charges those as media inputs, not as base64 prose.
   * Predictive compaction must therefore sanitize media payload fields before
   * `JSON.stringify(...).length / 4`, then add a bounded per-media budget.
   */
  export function estimateModelMessagePayload(messages: ModelMessage[]): ModelMessagePayloadEstimate {
    const mediaCounts: Record<MediaKind, number> = {
      image: 0,
      pdf: 0,
      audio: 0,
      video: 0,
    }

    const sanitize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(sanitize)

      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>
        const mediaKind = mediaKindFromPart(record)
        if (mediaKind) mediaCounts[mediaKind]++

        const out: Record<string, unknown> = {}
        for (const [key, child] of Object.entries(record)) {
          if (mediaKind && isMediaPayloadField(key) && typeof child === "string") {
            out[key] = `[${mediaKind} bytes omitted from text-token estimate]`
            continue
          }
          out[key] = sanitize(child)
        }
        return out
      }

      const dataUrlKind = mediaKindFromDataUrl(value)
      if (dataUrlKind) {
        mediaCounts[dataUrlKind]++
        return `[${dataUrlKind} data URL omitted from text-token estimate]`
      }

      return value
    }

    let messagePayloadChars = 0
    try {
      messagePayloadChars = JSON.stringify(sanitize(messages)).length
    } catch {
      messagePayloadChars = 0
    }

    const mediaTokensEst = Object.entries(mediaCounts).reduce(
      (sum, [kind, count]) => sum + MEDIA_TOKENS_PER_PART[kind as MediaKind] * count,
      0,
    )

    return { messagePayloadChars, mediaCounts, mediaTokensEst }
  }

  export function normalizeExtraToolResult(input: unknown): {
    output: string
    title: string
    metadata: object
    attachments?: unknown
    display?: unknown
  } {
    if (typeof input === "string") return { output: input, title: "", metadata: {} }

    if (input && typeof input === "object") {
      const r = input as Record<string, unknown>
      const output = (() => {
        if (typeof r.output === "string") return r.output
        if (typeof r.text === "string") return r.text
        if (r.output !== undefined) return JSON.stringify(r.output)
        if (r.attachments !== undefined) {
          throw new Error("Extra tool returned attachments without string output/text")
        }
        return JSON.stringify(r)
      })()
      return {
        ...r,
        output,
        title: typeof r.title === "string" ? r.title : "",
        metadata: r.metadata && typeof r.metadata === "object" ? r.metadata : {},
        ...(r.attachments !== undefined ? { attachments: r.attachments } : {}),
        ...(r.display !== undefined ? { display: r.display } : {}),
      }
    }

    return { output: String(input ?? ""), title: "", metadata: {} }
  }

  export async function materializeToolResultAttachments(attachments: unknown): Promise<unknown> {
    if (!Array.isArray(attachments)) return attachments
    return Promise.all(
      attachments.map(async (attachment: unknown) => {
        if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) return attachment
        const file = attachment as Record<string, unknown>
        if (typeof file.url !== "string" || typeof file.mime !== "string") return attachment
        if (!file.url.startsWith("data:")) return attachment
        const bytes = decodeDataUrlBase64Bytes(
          file.url,
          `SessionLoop.materializeToolResultAttachments ${typeof file.filename === "string" ? file.filename : file.mime}`,
        )
        const ref = await AttachmentStore.write(
          Instance.project.id,
          bytes,
          file.mime,
          typeof file.filename === "string" ? file.filename : undefined,
        )
        return {
          ...file,
          url: ref.url,
          mime: ref.mime,
        }
      }),
    )
  }

  function collectLoopState(msgs: Message.WithParts[]) {
    let lastUser: Message.User | undefined
    let lastAssistant: Message.Assistant | undefined
    let lastFinished: Message.Assistant | undefined
    const compactions: Message.CompactionPart[] = []
    const completedCompactionSourceIDs = new Set(
      msgs.flatMap((msg) =>
        msg.info.role === "assistant" && CompactionHandoff.isValidSummaryMessage(msg.info) ? [msg.info.parentID] : [],
      ),
    )
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (!lastUser && msg.info.role === "user") lastUser = msg.info as Message.User
      if (!lastAssistant && msg.info.role === "assistant") lastAssistant = msg.info as Message.Assistant
      if (!lastFinished && msg.info.role === "assistant" && msg.info.finish)
        lastFinished = msg.info as Message.Assistant
      if (lastUser && lastFinished) break
      if (!lastFinished) {
        compactions.push(
          ...msg.parts.filter(
            (part): part is Message.CompactionPart =>
              part.type === "compaction" && !completedCompactionSourceIDs.has(msg.info.id),
          ),
        )
      }
    }
    if (!lastUser) throw new Error("No user message found in stream. This should never happen.")
    return { lastUser, lastAssistant, lastFinished, compactions }
  }

  function isCompletedReplyToUserMessage(
    message: Message.WithParts,
    userMessageID: string,
  ): message is Message.WithParts & { info: Message.Assistant } {
    return (
      isSettledReplyToUserMessage(message, userMessageID) &&
      message.info.finish !== "error" &&
      message.info.error === undefined
    )
  }

  function isSettledReplyToUserMessage(
    message: Message.WithParts,
    userMessageID: string,
  ): message is Message.WithParts & { info: Message.Assistant } {
    return (
      message.info.role === "assistant" &&
      message.info.parentID === userMessageID &&
      message.info.time.completed !== undefined &&
      Boolean(message.info.finish) &&
      message.info.finish !== "tool-calls" &&
      message.info.summary !== true
    )
  }

  function shouldEnterStandby(input: { lastUser: Message.User; lastAssistant: Message.Assistant | undefined }) {
    return !!(
      input.lastAssistant && isCompletedReplyToUserMessage({ info: input.lastAssistant, parts: [] }, input.lastUser.id)
    )
  }

  async function completedReplyToUserMessage(
    sessionID: string,
    userMessageID: string,
    includeFailedReply: boolean,
  ): Promise<Message.WithParts | undefined> {
    for await (const message of MessageStore.stream(sessionID)) {
      if (
        isCompletedReplyToUserMessage(message, userMessageID) ||
        (includeFailedReply && isSettledReplyToUserMessage(message, userMessageID))
      ) {
        return message
      }
      if (message.info.id === userMessageID) return undefined
    }
    return undefined
  }

  export function completedCompactionForSource(
    messages: Message.WithParts[],
    sourceUserMessageID: string,
  ): Message.WithParts | undefined {
    const source = messages.find(
      (msg) =>
        msg.info.id === sourceUserMessageID &&
        msg.info.role === "user" &&
        msg.parts.some((part) => part.type === "compaction"),
    )
    if (!source) return
    return messages.findLast(
      (msg) =>
        msg.info.role === "assistant" &&
        msg.info.parentID === sourceUserMessageID &&
        CompactionHandoff.isValidSummaryMessage(msg.info),
    )
  }

  export function hasCompletedCompactionForSource(messages: Message.WithParts[], sourceUserMessageID: string): boolean {
    return completedCompactionForSource(messages, sourceUserMessageID) !== undefined
  }

  function consumeCompletedCompactionControl(input: {
    control: SessionControl.Record
    summary: Message.WithParts
    sessionID: string
    directory: string
  }): "stop" | "continue" {
    SessionControl.consume({ id: input.control.id, sessionID: input.sessionID })
    if (input.control.kind !== "manual_summarize") return "continue"
    flushCallbacks(input.sessionID, input.summary, input.directory, "summary")
    return "stop"
  }

  export function hasPostCompactionMaterialForSource(
    messages: Message.WithParts[],
    sourceUserMessageID: string,
  ): boolean {
    const latestSummaryIndex = messages.findLastIndex(
      (msg) =>
        msg.info.role === "assistant" &&
        msg.info.parentID === sourceUserMessageID &&
        CompactionHandoff.isValidSummaryMessage(msg.info),
    )
    if (latestSummaryIndex < 0) return false
    return messages.slice(latestSummaryIndex + 1).some((msg) => {
      if (msg.info.role === "assistant" && CompactionHandoff.isValidSummaryMessage(msg.info)) return false
      return msg.parts.some(
        (part) =>
          part.type === "text" ||
          part.type === "reasoning" ||
          part.type === "tool" ||
          part.type === "patch" ||
          part.type === "file" ||
          part.type === "snapshot",
      )
    })
  }

  async function beginStandby(input: { sessionID: string; abort: AbortSignal; afterID: string }) {
    await SessionCompaction.prune({ sessionID: input.sessionID })
    log.info("entering standby", { sessionID: input.sessionID })
    touch(input.sessionID)
    const waitForWake = waitForUserMessage(input.sessionID, input.abort, input.afterID)
    await SessionStatus.set(input.sessionID, { type: "idle" }, { promptGenerationOwner: input.abort })
    SessionRuntimeContractStore.settleConsumedWake(input.sessionID)
    return { waitForWake }
  }

  async function sessionStateContext(input: {
    projectID: string
    sessionID: string
    query: string
    memoryToolAvailable: boolean
  }) {
    const projectMemory = await MemoryInjection.systemPromptSection({
      projectID: input.projectID,
      sessionID: input.sessionID,
      query: input.query,
      memoryToolAvailable: input.memoryToolAvailable,
    })
    const taskPlan = TaskPlan.toMarkdown(input.sessionID)
    const blocks = [projectMemory, taskPlan].filter(
      (section): section is string => typeof section === "string" && section.trim().length > 0,
    )
    if (blocks.length === 0) return ""
    return [
      "<session-state>",
      "These blocks are runtime-injected views of long-lived session state",
      "(retrieved project memory and current task plan). They are",
      "not new user instructions — treat them as background context.",
      "",
      blocks.join("\n\n"),
      "</session-state>",
    ].join("\n")
  }

  async function processTurn(input: {
    step: number
    sessionID: string
    session: Session.Info
    msgs: Message.WithParts[]
    lastUser: Message.User
    lastFinished: Message.Assistant | undefined
    model: Provider.Model
    abort: AbortSignal
  }) {
    let structured: unknown | undefined
    const config = await EffectiveConfig.effective({ sessionID: input.sessionID })
    const installedRuntimeContract = SessionRuntimeContractStore.get(input.sessionID)
    const installedRuntimeIdentity = installedRuntimeContract?.identity
    const requiresRuntimeContract = sessionKindRequiresRuntimeContract(input.session.kind)
    const requiresWorkerTurnDescriptor = installedRuntimeIdentity?.identityKind === "projected-worker"
    const runtimeContract = validateSessionRuntimeContractForContinuation({
      sessionID: input.sessionID,
      expectedSessionKind: input.session.kind,
      expectedAgentID: input.lastUser.agent,
      expectedModel: {
        providerID: input.model.providerID,
        modelID: input.model.id,
      },
      expectedResultMode: "reply",
      requireWorkerTurnDescriptor: requiresWorkerTurnDescriptor,
      requireRuntimeContract: requiresRuntimeContract,
    })
    assertSessionLoopRuntimeContract(runtimeContract, `SessionLoop turn ${input.sessionID}`)
    const runtimeIdentity = runtimeContract?.identity
    const messageIdentity = await resolveSessionMessageIdentity({
      session: input.session,
      requestedAgentID: input.lastUser.agent,
      config,
    })
    const agentID = messageIdentity.agentID
    const agent = messageIdentity.runtime
    const maxSteps = agent.steps ?? Infinity
    const isLastStep = input.step >= maxSteps
    const workerTurnDescriptor = workerTurnDescriptorPayloadForRuntimeContract(runtimeContract, input.sessionID)
    const assistantMessage = (await Session.updateMessage({
      id: Identifier.ascending("message"),
      parentID: input.lastUser.id,
      role: "assistant",
      author: input.lastUser.agent,
      agent: input.lastUser.agent,
      variant: input.lastUser.variant,
      path: {
        cwd: Instance.directory,
        root: Instance.worktree,
      },
      cost: 0,
      tokens: {
        total: 0,
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      modelID: input.model.id,
      providerID: input.model.providerID,
      ...(runtimeIdentity?.identityKind === "projected-scheduler" && runtimeIdentity.taskIngressID
        ? {
            taskIngress: {
              id: runtimeIdentity.taskIngressID,
              kind: runtimeIdentity.taskIngressKind!,
            },
          }
        : {}),
      time: {
        created: Date.now(),
      },
      sessionID: input.sessionID,
    })) as Message.Assistant
    SessionPromptState.bindMessageOwner(input.sessionID, assistantMessage.id, input.abort)
    const processor = SessionProcessor.create({
      assistantMessage,
      sessionID: input.sessionID,
      model: input.model,
      abort: input.abort,
    })
    using _ = defer(() => InstructionPrompt.clear(processor.message.id))

    const format = input.lastUser.format ?? { type: "text" }
    const messagePromptProjection = controlPromptProjection(agentID, input.sessionID)
    const controlRuntimeContext = controlToolContext(input.sessionID)
    let tools = await resolveTools({
      agent,
      agentID,
      session: input.session,
      model: input.model,
      tools:
        runtimeIdentity?.identityKind === "projected-worker"
          ? toolSwitchesFromWorkerTurnDescriptor(workerTurnDescriptor)
          : (messagePromptProjection?.tools ?? input.lastUser.tools),
      includeMcpTools: messagePromptProjection?.includeMcpTools ?? input.lastUser.includeMcpTools,
      processor,
      extra: controlRuntimeContext ? { controlPromptContext: controlRuntimeContext } : input.lastUser.extra,
      messages: input.msgs,
      config,
    })
    if (input.lastUser.format?.type === "json_schema") {
      tools["StructuredOutput"] = prepareProviderTool({
        name: "StructuredOutput",
        source: "structured",
        model: input.model,
        tool: createStructuredOutputTool({
          schema: input.lastUser.format.schema,
          onSuccess(output) {
            structured = output
          },
        }),
      })
    }
    const skillSurface = await finalizeResolvedToolSkillSurface(tools, Object.keys(tools))
    if (input.step === 1) {
      await SessionSummary.summarize({
        sessionID: input.sessionID,
        messageID: input.lastUser.id,
      })
    }

    if (input.step > 1 && input.lastFinished) {
      for (const msg of input.msgs) {
        if (msg.info.role !== "user" || msg.info.id <= input.lastFinished.id) continue
        for (const part of msg.parts) {
          if (part.type !== "text") continue
          if (!part.text.trim()) continue
          part.text = [
            "<system-reminder>",
            "The user sent the following message:",
            part.text,
            "",
            "Please address this message and continue with your tasks.",
            "</system-reminder>",
          ].join("\n")
        }
      }
    }

    await Plugin.trigger("experimental.chat.messages.transform", {}, { messages: input.msgs })

    const skillsSection = skillSurface ? await SystemPrompt.skills(agent, { surface: skillSurface }) : undefined
    const runtimeSystem =
      typeof runtimeContract?.system === "function" ? await runtimeContract.system() : runtimeContract?.system
    const system = [
      ...(await SystemPrompt.environment(input.model)),
      ...(skillsSection ? [skillsSection] : []),
      ...(await InstructionPrompt.system()),
      ...(runtimeSystem ?? []),
      ...(messagePromptProjection?.system ?? []),
    ]
    if (isLastStep) {
      system.push(MAX_STEPS)
    }

    const memoryQuery = (input.msgs.find((message) => message.info.id === input.lastUser.id)?.parts ?? [])
      .filter((part): part is Message.TextPart => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim()
    // Live session-state blocks. These change between turns (project-memory hits
    // depend on the query and taskplan tracks progress). Until 2026-04
    // they were pushed onto `system` after the cached entries (env, runtime context), but
    // applyCaching only puts cache_control on the first 2 system messages —
    // anything after lives inside the second cache breakpoint, which spans
    // the rest of system + all messages. These blocks stay as runtime context
    // for the current model turn; they are not persisted as conversation
    // messages.
    const dynamicContextText = await sessionStateContext({
      projectID: Instance.project.id,
      sessionID: input.sessionID,
      query: memoryQuery || input.session.title || input.lastUser.id,
      memoryToolAvailable: Object.prototype.hasOwnProperty.call(tools, "memory"),
    })

    const baseModelMessages = await Message.toModelMessages(input.msgs, input.model)
    if (dynamicContextText) {
      // Prepend to the LAST user message's text content so the live state sits
      // adjacent to the request the model is responding to. This keeps the
      // earlier conversation history (and its system prefix) byte-stable for
      // the prefix cache; only the last user message — which is part of the
      // 5m tail breakpoint anyway — absorbs the per-turn delta.
      for (let i = baseModelMessages.length - 1; i >= 0; i--) {
        const msg = baseModelMessages[i]
        if (msg.role !== "user") continue
        if (typeof msg.content === "string") {
          msg.content = `${dynamicContextText}\n\n${msg.content}`
        } else if (Array.isArray(msg.content)) {
          const firstTextIdx = msg.content.findIndex(
            (p): p is { type: "text"; text: string } =>
              typeof p === "object" && p !== null && (p as any).type === "text",
          )
          if (firstTextIdx >= 0) {
            const part = msg.content[firstTextIdx] as { type: "text"; text: string }
            msg.content[firstTextIdx] = { ...part, text: `${dynamicContextText}\n\n${part.text}` }
          } else {
            msg.content = [{ type: "text", text: dynamicContextText }, ...msg.content]
          }
        }
        break
      }
    }

    const modelMessages = baseModelMessages

    const systemChars = system.reduce((sum, s) => sum + s.length, 0)
    const systemTokensEst = Token.estimateCharacters(systemChars)
    const toolCount = Object.keys(tools).length
    let userMsgCount = 0
    let assistantMsgCount = 0
    let toolCallCount = 0

    for (const msg of modelMessages) {
      if (msg.role === "user") userMsgCount++
      if (msg.role === "assistant") assistantMsgCount++
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if ("type" in part && (part.type === "tool-call" || part.type === "tool-result")) toolCallCount++
        }
      }
    }

    // Estimate the size of the actual outgoing request. Tool-heavy agents
    // can spend most of their input budget on tool descriptions and JSON
    // schemas, so counting only messages makes autocompaction blind until
    // the provider rejects the request. Keep this estimate aligned with the
    // streamText payload shape: model messages and tool definitions are
    // prompt input; system is estimated separately above.
    const payloadEstimate = estimateModelMessagePayload(modelMessages)
    const messagePayloadChars = payloadEstimate.messagePayloadChars
    const toolSchemaChars = estimateToolPayloadChars(tools)
    const totalContentChars = messagePayloadChars + toolSchemaChars
    const contentTokensEst = Token.estimateCharacters(totalContentChars)
    const mediaTokensEst = payloadEstimate.mediaTokensEst
    const mediaCount = Object.values(payloadEstimate.mediaCounts).reduce((sum, count) => sum + count, 0)
    const totalTokensEst = systemTokensEst + contentTokensEst + mediaTokensEst
    const effectiveOutputLimit = ProviderTransform.maxOutputTokens(input.model)
    log.info("context-diagnostics", {
      step: input.step,
      providerID: input.model.providerID,
      modelID: input.model.id,
      contextLimit: input.model.limit.context,
      catalogInputLimit: input.model.limit.input,
      catalogOutputLimit: input.model.limit.output,
      effectiveOutputLimit,
      systemPromptParts: system.length,
      systemChars,
      systemTokensEst,
      toolCount,
      toolNames: Object.keys(tools).join(","),
      messageCount: modelMessages.length,
      userMsgCount,
      assistantMsgCount,
      messagePayloadChars,
      toolSchemaChars,
      totalContentChars,
      contentTokensEst,
      mediaCount,
      mediaCounts: payloadEstimate.mediaCounts,
      mediaTokensEst,
      toolCallCount,
      totalTokensEst,
    })

    // ── Predictive compaction ────────────────────────────────────────────────
    // Decide whether the *next* LLM call would exceed the model's input budget
    // BEFORE we issue it. The historical compaction trigger only inspected
    // `lastFinished.tokens` *after* a turn returned, which means the offending
    // call had already burned the context window. We instead skip this turn
    // and queue a compaction message; the outer loop will pick it up on the
    // next iteration and the post-compaction continuation re-enters with a
    // shrunk history.
    //
    // Predictive and reactive compaction share ContextBudget so config flags
    // (`auto`, `reserved`, `threshold`) cannot diverge between the preflight
    // and post-turn gates. Reuse the `config` resolved at the top of
    // processTurn — a turn is the unit of config snapshotting, so a second
    // EffectiveConfig.effective() call here would be redundant work + a
    // TS2451 redeclaration in the same function scope.
    const predictiveBudget = ContextBudget.predictiveLimit({ config, model: input.model })
    if (!predictiveBudget) {
      log.warn("predictive-compaction-skipped-no-budget", {
        step: input.step,
        providerID: input.model.providerID,
        modelID: input.model.id,
      })
    } else {
      const ratio = toolSchemaBudgetRatio()
      const decision = predictiveCompactionDecision({
        totalTokensEst,
        limit: predictiveBudget.limit,
        usableBudget: predictiveBudget.usableBudget,
        systemChars,
        toolSchemaChars,
        messagePayloadChars,
        mediaTokensEst,
        toolSchemaBudgetRatio: ratio,
        lastFinishedSummary: input.lastFinished?.summary === true,
      })
      const toolNames = Object.keys(tools).join(",")
      if (decision.kind === "fail-tool-schema") {
        const toolSchemaTokensEst = Token.estimateCharacters(toolSchemaChars)
        log.error("predictive-compaction-fail-tool-schema", {
          step: input.step,
          toolSchemaChars,
          toolSchemaTokensEst,
          usableBudget: predictiveBudget.usableBudget,
          ratio,
          toolNames,
        })
        return stopTurnWithPredictiveBudgetError({
          processor,
          sessionID: input.sessionID,
          error: new Message.ToolSchemaBudgetError({
            message:
              `Tool schema payload (${toolSchemaChars} chars, estimated ${toolSchemaTokensEst} tokens) exceeds ` +
              `${Math.round(ratio * 100)}% of model input ` +
              `budget (${predictiveBudget.usableBudget}). Compaction does not shrink tool ` +
              `definitions; reduce the agent's tool surface or pick a model ` +
              `with a larger context window.`,
            toolSchemaChars,
            usableBudget: predictiveBudget.usableBudget,
            ratio,
            toolNames,
          }).toObject(),
        })
      }
      if (decision.kind === "fail-prompt-budget") {
        const nonCompressiblePromptChars = systemChars + toolSchemaChars
        const topPayloadParts = summarizeModelMessagePayloads(modelMessages)
        log.error("predictive-compaction-fail-prompt-budget", {
          step: input.step,
          reason: decision.reason,
          totalTokensEst,
          limit: predictiveBudget.limit,
          usableBudget: predictiveBudget.usableBudget,
          systemTokensEst,
          toolSchemaChars,
          messagePayloadChars,
          topPayloadParts,
          nonCompressiblePromptChars,
          toolNames,
        })
        return stopTurnWithPredictiveBudgetError({
          processor,
          sessionID: input.sessionID,
          error: new Message.PromptBudgetOverflowError({
            message:
              `Predictive compaction cannot recover this turn ` +
              `(reason=${decision.reason}). totalTokensEst=${totalTokensEst} ` +
              `> limit=${predictiveBudget.limit}; system+tool schemas alone ` +
              `=${nonCompressiblePromptChars} chars. Either drop tools or ` +
              `pick a larger-context model.`,
            systemTokensEst,
            messagePayloadChars,
            toolSchemaChars,
            compressibleMessageChars: messagePayloadChars,
            nonCompressiblePromptChars,
            usableBudget: predictiveBudget.usableBudget,
            limit: predictiveBudget.limit,
            toolNames,
          }).toObject(),
        })
      }
      if (decision.kind === "compact") {
        const topPayloadParts = summarizeModelMessagePayloads(modelMessages)
        log.warn("predictive-compaction-triggered", {
          step: input.step,
          totalTokensEst,
          limit: predictiveBudget.limit,
          threshold: predictiveBudget.threshold,
          usableBudget: predictiveBudget.usableBudget,
          messagePayloadChars,
          topPayloadParts,
        })
        if (
          hasCompletedCompactionForSource(input.msgs, input.lastUser.id) &&
          !hasPostCompactionMaterialForSource(input.msgs, input.lastUser.id)
        ) {
          return stopTurnWithPredictiveBudgetError({
            processor,
            sessionID: input.sessionID,
            error: alreadyCompactedPromptBudgetError({
              sourceUserID: input.lastUser.id,
              reason:
                `Predictive compaction cannot recover this turn because the filtered ` +
                `prompt is still estimated at ${totalTokensEst} tokens over ` +
                `limit=${predictiveBudget.limit}`,
              systemTokensEst,
              messagePayloadChars,
              toolSchemaChars,
              systemChars,
              usableBudget: predictiveBudget.usableBudget,
              limit: predictiveBudget.limit,
              toolNames,
            }),
          })
        }
        await Session.removeMessage({
          sessionID: input.sessionID,
          messageID: processor.message.id,
        })
        await SessionCompaction.create({
          sessionID: input.sessionID,
          source: input.lastUser,
          auto: true,
          overflow: false,
        })
        return "continue" as const
      }
    }

    const result = await processor.process({
      user: input.lastUser,
      agentID,
      agent,
      abort: input.abort,
      sessionID: input.sessionID,
      system,
      messages: modelMessages,
      tools,
      model: input.model,
      toolChoice: undefined,
      stream: runtimeContract?.stream,
      runtimeSystemMode: messagePromptProjection?.systemMode ?? runtimeContract?.systemMode,
    })

    if (structured !== undefined) {
      processor.message.structured = structured
      processor.message.finish = processor.message.finish ?? "stop"
      await Session.updateMessage(processor.message)
      return "stop" as const
    }

    if (result === "stop") return "stop" as const
    if (result === "compact") {
      if (
        hasCompletedCompactionForSource(input.msgs, input.lastUser.id) &&
        !hasPostCompactionMaterialForSource(input.msgs, input.lastUser.id)
      ) {
        const usableBudget = ContextBudget.usable({ config, model: input.model })
        const decision = alreadyCompactedPromptBudgetError({
          sourceUserID: input.lastUser.id,
          reason: "Provider reported context overflow",
          systemTokensEst,
          messagePayloadChars,
          toolSchemaChars,
          systemChars,
          usableBudget,
          limit: Math.floor(usableBudget * ContextBudget.threshold({ config })),
          toolNames: Object.keys(tools).join(","),
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: input.sessionID,
          messageID: processor.message.id,
          type: "text",
          text: decision.data.message,
          time: { start: Date.now(), end: Date.now() },
        } satisfies Message.TextPart)
        return "stop" as const
      }
      await SessionCompaction.create({
        sessionID: input.sessionID,
        source: input.lastUser,
        auto: true,
        overflow: true,
      })
    }
    return "continue" as const
  }

  export const LoopInput = z.object({
    sessionID: Identifier.schema("session"),
    resume_existing: z.boolean().optional(),
    result_mode: z.enum(["reply", "summary"]).optional(),
    reply_to_message_id: Identifier.schema("message").optional(),
  })

  export function structuredOutputToolChoice(
    _format: z.infer<typeof Message.Format>,
    _model?: { capabilities?: { reasoning?: boolean } },
  ): undefined {
    return undefined
  }

  export type PromptFinalMessageSelection =
    | { type: "message"; message: Message.WithParts }
    | { type: "maintenance-summary"; message: Message.WithParts }
    | { type: "none" }

  export function selectPromptFinalMessageFromNewest(
    messages: Iterable<Message.WithParts>,
  ): PromptFinalMessageSelection {
    for (const item of messages) {
      if (item.info.role === "user") return { type: "none" }
      if (item.info.role !== "assistant") continue
      if (item.info.summary === true) return { type: "maintenance-summary", message: item }
      return { type: "message", message: item }
    }
    return { type: "none" }
  }

  export function maintenanceSummaryFailureMessage(message: Message.WithParts) {
    const agent = message.info.role === "assistant" ? message.info.agent : "unknown"
    const error = message.info.role === "assistant" ? message.info.error : undefined
    if (error && typeof error === "object") {
      const record = error as { name?: unknown; message?: unknown; data?: { message?: unknown } }
      const name = typeof record.name === "string" ? record.name : "MaintenanceError"
      const detail =
        typeof record.data?.message === "string"
          ? record.data.message
          : typeof record.message === "string"
            ? record.message
            : JSON.stringify(error)
      return `Session prompt loop ended after internal ${agent} summary checkpoint with ${name}${detail ? `: ${detail}` : ""}`
    }
    return `Session prompt loop ended after internal ${agent} summary checkpoint before continuation`
  }

  async function flushPromptFinalMessage(input: {
    sessionID: string
    abort: AbortSignal
    resultMode: "reply" | "summary"
    directory?: string
  }) {
    const candidates: Message.WithParts[] = []
    for await (const item of MessageStore.stream(input.sessionID)) {
      candidates.push(item)
      if (item.info.role === "user" || item.info.role === "assistant") break
    }

    const selected = selectPromptFinalMessageFromNewest(candidates)
    if (selected.type === "message") {
      flushCallbacks(input.sessionID, selected.message, input.directory, "reply")
      return
    }

    if (
      selected.type === "maintenance-summary" &&
      (flushCallbacks(input.sessionID, selected.message, input.directory, "summary") > 0 ||
        input.resultMode === "summary")
    ) {
      return
    }

    if (selected.type === "maintenance-summary" && !input.abort.aborted) {
      throw new Error(maintenanceSummaryFailureMessage(selected.message))
    }
  }

  async function terminalizeIncompleteAssistant(input: {
    sessionID: string
    owner: AbortSignal
    error: unknown
  }): Promise<void> {
    const messageID = SessionPromptState.latestMessageID(input.sessionID, input.owner)
    if (!messageID) return
    let candidate: Message.WithParts
    try {
      candidate = await MessageStore.get({ sessionID: input.sessionID, messageID })
    } catch (readError) {
      if (NotFoundError.isInstance(readError as Error)) return
      throw new AggregateError(
        [input.error, readError],
        `Session ${input.sessionID} failed and its assistant message could not be read for terminalization`,
      )
    }
    if (candidate.info.role !== "assistant" || candidate.info.time.completed !== undefined) return
    candidate.info.error = Message.fromError(input.error, { providerID: candidate.info.providerID })
    candidate.info.finish = "error"
    candidate.info.time.completed = Date.now()
    try {
      await Session.updateMessage(candidate.info)
    } catch (persistenceError) {
      throw new AggregateError(
        [input.error, persistenceError],
        `Session ${input.sessionID} failed before provider completion and its assistant error could not be persisted`,
      )
    }
  }

  /**
   * Close the exact assistant/tool execution abandoned by a previous process.
   *
   * Prompt ownership is intentionally process-local. A durable Session can
   * therefore contain an incomplete assistant message after an ungraceful
   * process exit even though the new process has no physical owner capable of
   * completing its running tools. Leaving those records open makes a recovered
   * scheduler turn appear concurrent with the dead turn and can duplicate a
   * synchronous dispatch. Persist the real interruption before continuing so
   * every Agent and Expert Squad family observes one truthful message stream.
   */
  export async function terminalizeRecoveredIncompleteAssistant(
    sessionID: string,
    signal?: AbortSignal,
  ): Promise<boolean> {
    signal?.throwIfAborted()
    const candidates: Message.WithParts[] = []
    for await (const message of MessageStore.stream(sessionID)) {
      signal?.throwIfAborted()
      if (message.info.role === "user") break
      if (message.info.role !== "assistant") continue
      if (message.info.time.completed === undefined) candidates.push(message)
    }
    if (candidates.length === 0) return false

    const now = Date.now()
    for (const candidate of candidates) {
      signal?.throwIfAborted()
      if (candidate.info.role !== "assistant") continue
      const interruption = new Error(
        `Previous process ended before Session ${sessionID} completed assistant message ${candidate.info.id}`,
      )
      interruption.name = "ProcessExecutionInterruptedError"
      for (const part of candidate.parts) {
        signal?.throwIfAborted()
        if (part.type !== "tool" || (part.state.status !== "pending" && part.state.status !== "running")) continue
        const taskID = taskIDForSession(sessionID)
        const lineage =
          part.tool === "dispatch_agent" && taskID
            ? findDispatchLineageByToolExecution({
                taskID,
                toolPartID: part.id,
                toolCallID: part.callID,
              })
            : undefined
        const failure = toolFailureCauseFromUnknown({
          error: interruption,
          originSite: "SessionLoop.terminalizeRecoveredIncompleteAssistant",
          classification: "llm-activity",
          kind: "process-execution-interrupted",
          data: {
            sessionID,
            messageID: candidate.info.id,
            ...(lineage
              ? {
                  taskID: lineage.taskID,
                  dispatchLineageID: lineage.artifactID,
                  dispatchID: lineage.dispatchID,
                  childSessionID: lineage.payload.child_session_id,
                  workflowNodeID: lineage.payload.workflow_node_id,
                  workflowOccurrenceID: lineage.payload.workflow_occurrence_id,
                  occurrenceFact:
                    "This logical dispatch occurrence already exists; do not issue another initial dispatch for it.",
                }
              : {}),
          },
        })
        await Session.updatePart({
          ...part,
          state: {
            status: "error",
            input: part.state.input,
            failure,
            time: {
              start: part.state.time.start,
              end: Math.max(now, part.state.time.start + 1),
            },
          },
        })
        signal?.throwIfAborted()
      }
      candidate.info.error = Message.fromError(interruption, { providerID: candidate.info.providerID })
      candidate.info.finish = "error"
      candidate.info.time.completed = now
      await Session.updateMessage(candidate.info)
      signal?.throwIfAborted()
    }
    return true
  }

  export const loop = fn(LoopInput, async (input) => {
    const { sessionID, resume_existing } = input
    const resultMode = input.result_mode ?? "reply"
    const session = await Session.get(sessionID)
    const directory = session.directory
    assertSessionLoopRuntimeContract(SessionRuntimeContractStore.get(sessionID), `SessionLoop session ${sessionID}`)

    const { abort, startedOwner, firstResult } = await enterLoop({
      sessionID,
      directory,
      resumeExisting: resume_existing === true,
      resultMode,
      replyToMessageID: input.reply_to_message_id,
    })
    try {
      if (input.reply_to_message_id) {
        const persistedReply = await completedReplyToUserMessage(sessionID, input.reply_to_message_id, startedOwner)
        if (persistedReply) {
          flushCallbacks(sessionID, persistedReply, directory, "reply", input.reply_to_message_id)
          consumeRuntimeContractTurn(sessionID)
          if (startedOwner) {
            await finish(sessionID, abort, directory)
            SessionRuntimeContractStore.settleConsumedWake(sessionID)
            return firstResult
          }
        }
      }
      if (!abort) return firstResult
      if (!resume_existing) await terminalizeRecoveredIncompleteAssistant(sessionID)
    } catch (error) {
      SessionRuntimeContractStore.failConsumedWake(sessionID, error)
      if (abort && !resume_existing) {
        await finish(sessionID, abort, directory, error)
      } else {
        SessionPromptState.rejectAttachedCallbacks(sessionID, error, directory, resultMode, input.reply_to_message_id)
      }
      await firstResult.catch(() => undefined)
      throw error
    }

    const lifecycle = InstanceLifecycleContext.use()

    const runInActiveInstance = async <Result>(fn: () => Promise<Result>): Promise<Result> => {
      const active = await lifecycle.reenter({
        directory,
        fn: async () => ({ value: await fn() }),
      })
      if (!active) {
        throw new Error(`Session ${sessionID} prompt turn cannot re-enter released instance ${directory}`)
      }
      return active.value
    }

    const finalizePrompt = async () => {
      await SessionCompaction.prune({ sessionID })
      await flushPromptFinalMessage({ sessionID, abort, resultMode, directory })
    }

    const rejectCallbacks = (error: unknown) => {
      const current = state(directory)[sessionID]
      if (!current) return
      for (const callback of current.callbacks) callback.reject(error)
      current.callbacks = []
    }

    const publishTerminal = async (error: unknown) => {
      if (isExecutionCancellationError(error) || isExecutionCancellationError(abort.reason)) return true
      if (!abort.aborted) {
        SessionStatus.set(
          sessionID,
          {
            type: "terminal",
            reason: "error",
            error: error instanceof Error ? error.message : String(error),
          },
          { promptGenerationOwner: abort },
        )
      } else if (SessionStatus.get(sessionID).type !== "terminal") {
        SessionStatus.set(
          sessionID,
          {
            type: "terminal",
            reason: "aborted",
            error: error instanceof Error ? error.message : String(error),
          },
          { promptGenerationOwner: abort },
        )
      }
      return true
    }

    void (async () => {
      let needsReentry = false
      try {
        let step = 0
        while (true) {
          const runActiveTurn = async () => {
            while (true) {
              touch(sessionID, directory)
              log.info("loop", { step, sessionID })
              if (abort.aborted) break
              const msgs = await Message.filterCompacted(MessageStore.stream(sessionID))
              const { lastUser, lastAssistant, lastFinished, compactions } = collectLoopState(msgs)
              const pendingControls = SessionControl.pending(sessionID)
              for (const control of pendingControls) {
                if (isActionableSessionControl(control) || control.kind === "mission_process_recovery") continue
                SessionControl.fail({
                  id: control.id,
                  sessionID,
                  error: `Unsupported pending session control kind: ${control.kind}`,
                })
              }
              const controls = pendingControls.filter(isActionableSessionControl)
              const runRuntimeContractTurn = shouldRunRuntimeContractTurn(sessionID)
              const currentRuntimeContract = SessionRuntimeContractStore.get(sessionID)
              if (
                runRuntimeContractTurn &&
                currentRuntimeContract?.identity.identityKind === "projected-scheduler" &&
                currentRuntimeContract.identity.inputMessageID &&
                lastUser.id !== currentRuntimeContract.identity.inputMessageID
              ) {
                throw new Error(
                  `Orchestrator wake ${currentRuntimeContract.identity.taskIngressID ?? "<unknown>"} is bound to input ` +
                    `${currentRuntimeContract.identity.inputMessageID}, but Session ${sessionID} current input is ${lastUser.id}`,
                )
              }
              if (!runRuntimeContractTurn && controls.length === 0 && shouldEnterStandby({ lastUser, lastAssistant })) {
                if (!lastAssistant) break
                const lastResult = msgs.find((m) => m.info.id === lastAssistant.id)
                if (lastResult) flushCallbacks(sessionID, lastResult, directory, "reply")
                const { waitForWake } = await beginStandby({ sessionID, abort, afterID: lastAssistant.id })
                return { type: "standby" as const, waitForWake }
              }

              SessionStatus.beginExecutionOccurrence(sessionID, lastUser.id, abort)
              await SessionStatus.set(sessionID, { type: "streaming" }, { promptGenerationOwner: abort })

              step++
              if (step === 1) {
                await ensureTitle({
                  session,
                  history: msgs,
                }).catch((err) => log.error("failed to ensure session title", { error: String(err) }))
              }

              const compactionControl = controls.find(
                (item) => item.kind === "compaction_request" || item.kind === "manual_summarize",
              )
              const compaction = compactions.pop()

              if (compactionControl) {
                const sourceUserMessageID = compactionControl.payload.source_user_message_id
                if (typeof sourceUserMessageID !== "string") {
                  SessionControl.fail({
                    id: compactionControl.id,
                    sessionID,
                    error: "compaction control missing source_user_message_id",
                  })
                  continue
                }
                const sourceUserMessage = msgs.find((message) => message.info.id === sourceUserMessageID)?.info
                if (!sourceUserMessage || sourceUserMessage.role !== "user") {
                  SessionControl.fail({
                    id: compactionControl.id,
                    sessionID,
                    error: `compaction control source_user_message_id ${sourceUserMessageID} is not a user message`,
                  })
                  continue
                }
                const completedSummary = completedCompactionForSource(msgs, sourceUserMessageID)
                if (completedSummary && !hasPostCompactionMaterialForSource(msgs, sourceUserMessageID)) {
                  const disposition = consumeCompletedCompactionControl({
                    control: compactionControl,
                    summary: completedSummary,
                    sessionID,
                    directory,
                  })
                  if (disposition === "stop") break
                  continue
                }
                const result = await executeCompactionControl({
                  control: compactionControl,
                  sessionID,
                  run: () =>
                    SessionCompaction.process(
                      {
                        messages: msgs,
                        parentID: sourceUserMessageID,
                        abort,
                        sessionID,
                        auto: compactionControl.kind === "compaction_request",
                        overflow: compactionControl.payload.overflow === true,
                        focus:
                          typeof compactionControl.payload.focus === "string"
                            ? compactionControl.payload.focus
                            : undefined,
                        model:
                          compactionControl.payload.model &&
                          typeof compactionControl.payload.model === "object" &&
                          !Array.isArray(compactionControl.payload.model) &&
                          typeof (compactionControl.payload.model as { providerID?: unknown }).providerID ===
                            "string" &&
                          typeof (compactionControl.payload.model as { modelID?: unknown }).modelID === "string"
                            ? {
                                providerID: (compactionControl.payload.model as { providerID: string }).providerID,
                                modelID: (compactionControl.payload.model as { modelID: string }).modelID,
                              }
                            : undefined,
                      },
                      { prepareProviderTool, createStructuredOutputTool, structuredOutputToolChoice },
                    ),
                })
                if (result === "stop") break
                continue
              }

              if (compaction) {
                const taskSourceUser = msgs.find((message) => message.info.id === compaction.messageID)?.info
                if (!taskSourceUser || taskSourceUser.role !== "user") {
                  await Session.removePart({
                    sessionID,
                    messageID: compaction.messageID,
                    partID: compaction.id,
                  })
                  continue
                }
                const result = await SessionCompaction.process(
                  {
                    messages: msgs,
                    parentID: taskSourceUser.id,
                    abort,
                    sessionID,
                    auto: compaction.auto,
                    overflow: compaction.overflow,
                    focus: compaction.focus,
                  },
                  { prepareProviderTool, createStructuredOutputTool, structuredOutputToolChoice },
                )
                if (typeof result === "object") throw result.error
                if (result === "stop") break
                continue
              }

              const installedRuntimeContract = SessionRuntimeContractStore.get(sessionID)
              const validatedRuntimeContract = validateSessionRuntimeContractForContinuation({
                sessionID,
                expectedSessionKind: session.kind,
                expectedAgentID: lastUser.agent,
                requireWorkerTurnDescriptor: installedRuntimeContract?.identity.identityKind === "projected-worker",
                requireRuntimeContract: sessionKindRequiresRuntimeContract(session.kind),
              })
              assertSessionLoopRuntimeContract(validatedRuntimeContract, `SessionLoop session ${sessionID}`)
              let turn: "continue" | "stop"
              {
                using _runtimeTurnOwnership = SessionRuntimeContractStore.claimOperation(
                  sessionID,
                  validatedRuntimeContract,
                  "session model turn",
                )
                const model = await (
                  validatedRuntimeContract?.identity.identityKind === "projected-worker"
                    ? resolveProjectedWorkerModel(
                        {
                          expertSquadID: validatedRuntimeContract.identity.expertSquadID,
                          agentID: validatedRuntimeContract.identity.agentID,
                          baseRole: validatedRuntimeContract.identity.baseRole,
                        },
                        { sessionID, explicitModel: lastUser.model },
                      )
                    : validatedRuntimeContract && isProjectedSchedulerRuntimeContract(validatedRuntimeContract)
                      ? resolveAgentModel(validatedRuntimeContract.identity.baseRole, { sessionID })
                      : resolveAgentModel(validatedRuntimeContract?.identity.baseRole ?? lastUser.agent, {
                          sessionID,
                          explicitModel: lastUser.model,
                        })
                ).catch(async (e) => {
                  if (Provider.ModelNotFoundError.isInstance(e)) {
                    const hint = e.data.suggestions?.length ? ` Did you mean: ${e.data.suggestions.join(", ")}?` : ""
                    await Bus.publish(Session.Event.Error, {
                      sessionID,
                      orderKey: sessionLifecycleOrderKey(sessionID),
                      error: new NamedError.Unknown({
                        message: `Model not found: ${e.data.providerID}/${e.data.modelID}.${hint}`,
                      }).toObject(),
                    })
                  }
                  throw e
                })

                if (
                  lastFinished &&
                  lastFinished.summary !== true &&
                  (await CompactionOverflow.isOverflow({ tokens: lastFinished.tokens, model, sessionID }))
                ) {
                  // A same-source summary covers only history through its own
                  // checkpoint. New tool/reasoning material after that checkpoint
                  // is a fresh compactable epoch and must not be mistaken for a
                  // duplicate control record.
                  if (
                    !hasCompletedCompactionForSource(msgs, lastUser.id) ||
                    hasPostCompactionMaterialForSource(msgs, lastUser.id)
                  ) {
                    await SessionCompaction.create({
                      sessionID,
                      source: lastUser,
                      auto: true,
                      overflow: false,
                    })
                    continue
                  }
                }

                turn = await processTurn({
                  step,
                  sessionID,
                  session,
                  msgs,
                  lastUser,
                  lastFinished,
                  model,
                  abort,
                })
              }
              const queuedCompaction = turn === "continue" && hasPendingAutomaticCompactionControl(sessionID)
              if (runRuntimeContractTurn && !queuedCompaction) consumeRuntimeContractTurn(sessionID)
              // Fire the registered step hook (phase 3-a-4) — agents that
              // dispatch via a tool and want to abort the active generation
              // once the tool landed use this hook to fire their deferred-stop
              // signal.
              await fireStepHook(sessionID, { step, turn })
              if (turn === "stop") break
              continue
            }
            return { type: "stop" as const }
          }
          const runAcceptedTurn = async () => {
            try {
              const outcome = await runActiveTurn()
              if (outcome.type === "stop") await finalizePrompt()
              return outcome
            } catch (error) {
              try {
                await terminalizeIncompleteAssistant({
                  sessionID,
                  owner: abort,
                  error,
                })
                await publishTerminal(error)
              } finally {
                rejectCallbacks(error)
              }
              throw error
            }
          }
          const outcome = needsReentry
            ? await runInActiveInstance(runAcceptedTurn)
            : await lifecycle.runAsActivity(runAcceptedTurn)

          if (outcome.type === "stop") break
          needsReentry = true
          await lifecycle.runOutside(async () => outcome.waitForWake)
          if (abort.aborted) {
            await runInActiveInstance(finalizePrompt)
            break
          }
          step = 0
        }
      } catch (e) {
        SessionRuntimeContractStore.failConsumedWake(sessionID, e)
        const terminalPublished =
          SessionStatus.get(sessionID).type === "terminal"
            ? true
            : await lifecycle.reenter({ directory, fn: () => publishTerminal(e) })
        rejectCallbacks(e)
        if (terminalPublished !== true) {
          log.error("session prompt terminal status could not re-enter released instance", {
            sessionID,
            directory,
            error: e instanceof Error ? e.message : String(e),
          })
        }
      } finally {
        const s = state(directory)[sessionID]
        try {
          if (s?.abort.signal === abort) await finish(sessionID, abort, directory)
          SessionRuntimeContractStore.settleConsumedWake(sessionID)
        } catch (error) {
          SessionRuntimeContractStore.failConsumedWake(sessionID, error)
          log.error("session prompt resources failed to settle", {
            sessionID,
            directory,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    })()

    return firstResult
  })

  function waitForUserMessage(sessionID: string, abort: AbortSignal, afterID: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (abort.aborted) {
        resolve()
        return
      }

      let settled = false
      let unsubscribeMessage = () => {}
      let unsubscribeRuntimeWake = () => {}
      let unsubscribeControlWake = () => {}
      const onAbort = () => settle()
      const settle = () => {
        if (settled) return
        settled = true
        unsubscribeMessage()
        unsubscribeRuntimeWake()
        unsubscribeControlWake()
        abort.removeEventListener("abort", onAbort)
        resolve()
      }

      unsubscribeMessage = Bus.subscribe(Message.Event.Updated, (event) => {
        if (
          event.properties.info.role === "user" &&
          event.properties.info.sessionID === sessionID &&
          event.properties.info.id > afterID
        ) {
          settle()
        }
      })
      unsubscribeRuntimeWake = SessionRuntimeContractStore.subscribeWake(sessionID, settle)
      unsubscribeControlWake = SessionControl.subscribeWake(sessionID, settle)
      abort.addEventListener("abort", onAbort, { once: true })

      // Re-read both durable wake sources after subscribing so a control
      // committed between the loop's standby decision and this subscription
      // cannot leave the prompt owner asleep.
      if (
        shouldRunRuntimeContractTurn(sessionID) ||
        SessionControl.pending(sessionID).some(isActionableSessionControl)
      ) {
        settle()
        return
      }

      void (async () => {
        for await (const item of MessageStore.stream(sessionID)) {
          if (item.info.id <= afterID) break
          if (item.info.role === "user") {
            settle()
            return
          }
        }
      })()
    })
  }

  export async function resolveTools(input: {
    agent: SessionAgentRuntime
    agentID: string
    model: Provider.Model
    session: Session.Info
    tools?: Record<string, boolean>
    includeMcpTools?: boolean
    processor: SessionProcessor.Info
    extra?: Record<string, unknown>
    messages: Message.WithParts[]
    config: Config.Info
  }) {
    using _ = log.time("resolveTools")
    const tools: Record<string, AITool> = {}
    const toolSources = new Map<string, ProviderToolSource>()
    const executionPermission = PermissionNext.merge(input.agent.permission, input.session.permission)
    const runtimeContract = getSessionRuntimeContract(input.session.id)
    assertSessionLoopRuntimeContract(runtimeContract, `SessionLoop tool resolver ${input.session.id}`)
    const executionAuthority = await resolveToolExecutionAuthority({
      sessionID: input.session.id,
      projectID: Instance.project.id,
      runtimeIdentity: runtimeContract?.identity,
    })
    let executionHarnessProjection: HarnessProjection | undefined
    const context = (
      args: any,
      options: ToolExecutionOptions,
      invocation?: {
        projectID: string
        toolPartID: string
        invocationAuthority: import("@/tool/task-tool-invocation").TaskToolInvocationAuthority
        executionSurface: ToolExecutionSurface
        persistedInput: unknown
      },
    ): Tool.Context => {
      const metadataSink = new ToolLiveMetadataSink<{
        title?: string
        metadata?: Record<string, any>
      }>(async (value) => {
        const match = input.processor.partFromToolCall(options.toolCallId)
        if (!match || match.state.status !== "running") return
        await Session.updatePart({
          ...match,
          state: {
            title: value.title,
            metadata: value.metadata,
            status: "running",
            input: invocation?.persistedInput ?? args,
            time: {
              start: match.state.time.start,
            },
          },
        })
      })
      return {
        sessionID: input.session.id,
        abort: options.abortSignal!,
        messageID: input.processor.message.id,
        callID: options.toolCallId,
        extra: {
          ...toolExecutionExtra({
            messageExtra: input.extra,
            model: input.model,
          }),
          liveMetadataSink: metadataSink,
          ...(invocation
            ? {
                projectID: invocation.projectID,
                toolPartID: invocation.toolPartID,
                invocationAuthority: invocation.invocationAuthority,
              }
            : {}),
        },
        agent: input.agentID,
        messages: input.messages,
        executionAuthority,
        executionSurface:
          invocation?.executionSurface ??
          createToolExecutionSurface({
            toolIDs: Object.keys(tools),
            permission: executionPermission,
            harnessProjection: executionHarnessProjection,
            permissionLayers: {
              agent: input.agent.permission,
              session: input.session.permission,
            },
          }),
        prompt: (promptInput) => runSessionPrompt(promptInput, { loop }),
        metadata(value) {
          metadataSink.update(redactToolDiagnosticValue(value))
        },
        async ask(req) {
          await PermissionNext.ask({
            ...req,
            sessionID: input.session.id,
            tool: { messageID: input.processor.message.id, callID: options.toolCallId },
            ruleset: PermissionNext.merge(input.agent.permission, input.session.permission ?? []),
          })
        },
      }
    }

    const bindRegistryTool = (item: {
      id: string
      description: string
      parameters: z.ZodType
      execute: Tool.Info["init"] extends (...args: any[]) => Promise<infer Result>
        ? Result extends { execute: infer Execute }
          ? Execute
          : never
        : never
    }) => {
      const registryTool = tool({
        id: item.id as any,
        description: item.description,
        inputSchema: item.parameters as any,
        async execute(args, options) {
          const toolCallID = options.toolCallId
          if (!toolCallID) throw new Error(`${item.id}: SessionLoop registry execution requires a tool call ID.`)
          const normalizedInput = normalizeToolInput(args)
          const projectID = Instance.project.id
          const persistedInput = cloneToolInputForPersistence(normalizedInput.ok ? normalizedInput.value : {})
          const toolPart = await input.processor.ensureToolPart(toolCallID, item.id, persistedInput)
          const executionSurface = createToolExecutionSurface({
            toolIDs: Object.keys(tools),
            permission: executionPermission,
            harnessProjection: executionHarnessProjection,
            permissionLayers: {
              agent: input.agent.permission,
              session: input.session.permission,
            },
          })
          const invocationIdentity = {
            projectID,
            sessionID: input.session.id,
            messageID: input.processor.message.id,
            toolCallID,
            toolPartID: toolPart.id,
            providerName: item.id,
          }
          return withTaskToolInvocation(invocationIdentity, executionSurface, async (invocationAuthority) => {
            const ctx = context(args, options, {
              projectID: invocationIdentity.projectID,
              toolPartID: invocationIdentity.toolPartID,
              invocationAuthority,
              executionSurface,
              persistedInput,
            })
            await Plugin.trigger(
              "tool.execute.before",
              {
                tool: item.id,
                sessionID: ctx.sessionID,
                callID: ctx.callID,
              },
              {
                args,
              },
            )
            const liveMetadataSink = ctx.extra?.liveMetadataSink as
              | ToolLiveMetadataSink<{ title?: string; metadata?: Record<string, any> }>
              | undefined
            let rawResult: Awaited<ReturnType<typeof item.execute>>
            try {
              rawResult = await item.execute(args, ctx)
              await liveMetadataSink?.close()
            } catch (primaryError) {
              try {
                await liveMetadataSink?.close()
              } catch (metadataError) {
                throw new AggregateError(
                  [primaryError, metadataError],
                  `${item.id}: tool execution and live metadata persistence both failed`,
                )
              }
              throw primaryError
            }
            const result = await materializeToolResultInlineAttachments({
              projectID: invocationIdentity.projectID,
              value: rawResult,
            })
            const materializedAttachments = await materializeToolResultAttachments(result.attachments)
            const output = {
              ...result,
              attachments: Array.isArray(materializedAttachments)
                ? materializedAttachments.map((attachment) => ({
                    ...attachment,
                    id: Identifier.ascending("part"),
                    sessionID: ctx.sessionID,
                    messageID: input.processor.message.id,
                  }))
                : undefined,
              display: Array.isArray(result.display)
                ? result.display.map((part) => ({
                    ...part,
                    id: Identifier.ascending("part"),
                    sessionID: ctx.sessionID,
                    messageID: input.processor.message.id,
                  }))
                : undefined,
            }
            await Plugin.trigger(
              "tool.execute.after",
              {
                tool: item.id,
                sessionID: ctx.sessionID,
                callID: ctx.callID,
                args,
              },
              output,
            )
            return materializeToolResultInlineAttachments({
              projectID: invocationIdentity.projectID,
              value: output,
            })
          })
        },
      })
      tools[item.id] = prepareProviderTool({
        name: item.id,
        source: "registry",
        model: input.model,
        tool: registryTool,
      })
      toolSources.set(item.id, "registry")
    }

    executionHarnessProjection = runtimeContract?.harnessProjection
    const runtimeToolRecords = sessionRuntimeToolRecords(runtimeContract)
    const extras = {
      ...runtimeToolRecords.projectedTools,
      ...runtimeToolRecords.stageTools,
    }
    const exactRuntimeContractTools = usesExactRuntimeContractTools(runtimeContract)
    if (requiresProjectedRuntimeSurface(runtimeContract) && !runtimeContract?.projectedRegistryToolIDs) {
      throw new Error(`Projected skill owner session ${input.session.id} is missing projectedRegistryToolIDs.`)
    }
    const projectedRegistryToolIDs = runtimeContract?.projectedRegistryToolIDs
      ? new Set(runtimeContract.projectedRegistryToolIDs)
      : undefined

    const projectedWorkerRuntime = runtimeContract?.identity.identityKind === "projected-worker"
    let projectedWorkerVisibleRegistryToolIDs: ReadonlySet<string> | undefined
    if (!exactRuntimeContractTools || projectedWorkerRuntime) {
      const projectedRegistry = projectedWorkerRuntime
        ? await ToolRegistry.projectedWorkerTools(
            { modelID: input.model.api.id, providerID: input.model.providerID },
            input.agent,
            input.agentID,
            RuntimeTemplateID.get(runtimeContract.identity.baseRole),
            input.config,
            runtimeContract.projectedRegistryToolIDs!,
            {
              sessionPermission: input.session.permission,
              toolSwitches: input.tools,
              batchTargetExclusions: Object.keys(extras),
            },
          )
        : undefined
      const registryTools = projectedRegistry
        ? projectedRegistry.tools
        : await ToolRegistry.runtimeTools(
            { modelID: input.model.api.id, providerID: input.model.providerID },
            input.agent,
            input.agentID,
            input.config,
          )
      if (projectedRegistry) {
        projectedWorkerVisibleRegistryToolIDs = new Set(projectedRegistry.visibleToolIDs)
      }
      for (const item of registryTools) {
        if (projectedRegistryToolIDs && !projectedRegistryToolIDs.has(item.id)) continue
        // Session-level deny rules take precedence over the runtime template.
        if (!projectedWorkerRuntime && input.session.permission?.length) {
          const rule = PermissionNext.evaluate(item.id, "*", input.session.permission)
          if (rule.action === "deny") continue
        }
        bindRegistryTool(item)
      }
    }

    const includeMcpTools = runtimeContract?.includeMcpTools !== false && input.includeMcpTools !== false
    const { ConversationCapability } = await import("@/conversation/capability")
    const nativeConversationMcpTools =
      includeMcpTools &&
      !exactRuntimeContractTools &&
      !runtimeContract?.identity &&
      ConversationCapability.isAgentID(input.agentID)
        ? await ConversationCapability.runtimeMcpTools(input.config, input.agentID, input.session.id)
        : undefined
    const defaultMcpProcessAuthority =
      executionAuthority.kind === "task"
        ? MCP.taskProcessAuthority(executionAuthority.taskID, executionAuthority.directory)
        : MCP.hostProcessAuthority(executionAuthority.directory)
    const resolvedMcpTools =
      exactRuntimeContractTools || !includeMcpTools
        ? {}
        : (nativeConversationMcpTools ?? (await MCP.tools(defaultMcpProcessAuthority)))
    for (const [key, item] of Object.entries(resolvedMcpTools)) {
      const execute = item.execute
      if (!execute) continue
      const mcpAppBinding = MCP.appToolBinding(item)
      const mcpAppLifecycle = mcpAppBinding
        ? createMcpAppToolLifecycle({
            sessionID: input.session.id,
            messageID: input.processor.message.id,
            binding: mcpAppBinding,
            authority: mcpAppAuthorityForRuntimeTool(item),
          })
        : undefined
      if (mcpAppLifecycle) input.processor.registerMcpAppToolLifecycle(key, mcpAppLifecycle)

      const mcpTool = {
        ...(item as any),
        async execute(args: any, opts: ToolExecutionOptions) {
          const ctx = context(args, opts)
          try {
            await mcpAppLifecycle?.input(opts.toolCallId, args)
            await Plugin.trigger(
              "tool.execute.before",
              {
                tool: key,
                sessionID: ctx.sessionID,
                callID: opts.toolCallId,
              },
              {
                args,
              },
            )

            const permissionKey = browserMcpToolKeyFromRuntimeName(key)
            const computerPermissionKey = computerMcpToolKeyFromRuntimeName(key)
            const result = permissionKey
              ? await executeBrowserMcpToolWithPermission({
                  key: permissionKey,
                  args,
                  sessionID: input.session.id,
                  messageID: input.processor.message.id,
                  callID: opts.toolCallId,
                  rulesets: [input.agent.permission, input.session.permission],
                  execute: () => execute(args, opts),
                })
              : computerPermissionKey
                ? await executeComputerMcpToolWithPermission({
                    key: computerPermissionKey,
                    args,
                    sessionID: input.session.id,
                    messageID: input.processor.message.id,
                    callID: opts.toolCallId,
                    rulesets: [input.agent.permission, input.session.permission],
                    execute: () => execute(args, opts),
                  })
                : await (async () => {
                    await ctx.ask(mcpPermissionPlan(key, args))
                    return execute(args, opts)
                  })()

            await Plugin.trigger(
              "tool.execute.after",
              {
                tool: key,
                sessionID: ctx.sessionID,
                callID: opts.toolCallId,
                args,
              },
              result,
            )
            await mcpAppLifecycle?.complete(opts.toolCallId, args, result)

            // MCP tool image / resource content used to inline as
            // `data:<mime>;base64,...` directly into `attachment.url`,
            // which (a) blew up `part.data` (see attachment-store DB
            // forensics) and
            // (b) now trips Session.updatePart's inline-base64 guard.
            // Funnel both branches through AttachmentStore so the
            // persisted url is the canonical `/attachment/<id>/<sha>.<ext>`
            // ref; bytes only re-inline transiently in toModelOutput when
            // the AI SDK actually feeds the tool result back to the model.
            const materialized = await materializeMcpToolResult({
              projectID: Instance.project.id,
              result,
            })

            const truncated = await Truncate.output(
              materialized.text,
              { sessionID: ctx.sessionID, executionAuthority },
              ctx.executionSurface,
            )
            const metadata = {
              ...materialized.metadata,
              truncated: truncated.truncated,
              ...(truncated.truncated && { outputPath: truncated.outputPath }),
            }

            return {
              title: "",
              metadata,
              output: truncated.content,
              attachments: materializedMcpAttachmentsToFileParts({
                attachments: materialized.attachments,
                sessionID: ctx.sessionID,
                messageID: input.processor.message.id,
              }),
              content: result.content,
            }
          } catch (error) {
            if (mcpAppLifecycle) {
              if (opts.abortSignal?.aborted) {
                await mcpAppLifecycle.cancel(opts.toolCallId, args, "Tool execution cancelled")
              } else {
                await mcpAppLifecycle.fail(opts.toolCallId, args, error)
              }
            }
            throw error
          }
        },
      } as AITool
      tools[key] = prepareProviderTool({
        name: key,
        source: "mcp",
        model: input.model,
        tool: mcpTool,
      })
      toolSources.set(key, "mcp")
    }

    // Merge per-session runtime-contract tools last so stage agents can
    // deliberately shadow a built-in name with the attempt-scoped executable
    // closure (for example a sandboxed read or a report/submit tool).
    //
    // Extras must return `{ output: string, title?: string, metadata?: object }`
    // — SessionLoop's Message.ToolPart persistence layer validates that shape
    // when the tool call finalises. Plain-string returns are auto-wrapped here
    // so stage-agent callers can keep the simple `return "OK: ..."` idiom
    // without silently landing a ZodError at tool-completion time.
    const sessionIDForExtras = input.session.id
    const messageIDForExtras = input.processor.message.id
    for (const [name, extraTool] of Object.entries(extras)) {
      const mcpAppBinding = MCP.appToolBinding(extraTool as object)
      const mcpAppLifecycle = mcpAppBinding
        ? createMcpAppToolLifecycle({
            sessionID: sessionIDForExtras,
            messageID: messageIDForExtras,
            binding: mcpAppBinding,
            authority: mcpAppAuthorityForRuntimeTool(extraTool as object),
          })
        : undefined
      if (mcpAppLifecycle) input.processor.registerMcpAppToolLifecycle(name, mcpAppLifecycle)
      const wrapped = wrapExtraTool(name, extraTool, {
        sessionID: sessionIDForExtras,
        messageID: messageIDForExtras,
        browserPermissionRulesets: [input.agent.permission, input.session.permission],
        executionSurface: () =>
          createToolExecutionSurface({
            toolIDs: Object.keys(tools),
            permission: executionPermission,
            harnessProjection: executionHarnessProjection,
            permissionLayers: {
              agent: input.agent.permission,
              session: input.session.permission,
            },
          }),
        ensureToolPart: (toolCallID, toolName, toolInput) =>
          input.processor.ensureToolPart(toolCallID, toolName, toolInput),
        mcpAppLifecycle,
      })
      tools[name] = prepareProviderTool({
        name,
        source: "extra",
        model: input.model,
        tool: wrapped,
      })
      toolSources.set(name, "extra")
    }

    applyToolExecutionPolicy({
      tools,
      permission: executionPermission,
      switches: input.tools,
      requiredToolIDs:
        runtimeContract?.identity.identityKind === "projected-scheduler"
          ? TASK_ARTIFACT_DISCOVERY_TOOL_IDS
          : runtimeContract?.identity.identityKind === "projected-worker"
            ? TASK_ARTIFACT_TOOL_IDS
            : undefined,
    })
    const finalizeSkillSurface = async (availableToolNames: Iterable<string>) => {
      const { SkillMount } = await import("@/skill/mounts")
      const runtimeIdentity = runtimeContract?.identity
      if (!runtimeIdentity) {
        const nativeMissionSurface = input.agentID === "mission" && input.session.kind === "mission"
        if (nativeMissionSurface) {
          const { MissionSkillRuntime } = await import("@/mission-skill/runtime")
          const availableToolNameSet = new Set(availableToolNames)
          const surface = await MissionSkillRuntime.resolve({
            agentID: input.agentID,
            sessionKind: input.session.kind,
            runtime: input.agent,
            scope: "session",
            availableToolNames: availableToolNameSet,
          })
          resolvedToolSkillSurfaces.set(tools, surface)
          const exposeMissionSkillTool = surface.tool_available && availableToolNameSet.has(MissionSkillTool.id)
          if (!exposeMissionSkillTool) {
            delete tools[MissionSkillTool.id]
            return surface
          }
          const missionSkillTool = await MissionSkillTool.init({
            config: input.config,
            skillSurface: surface,
          })
          const output = {
            description: missionSkillTool.description,
            parameters: missionSkillTool.parameters,
          }
          await Plugin.trigger("tool.definition", { toolID: MissionSkillTool.id }, output)
          bindRegistryTool({
            id: MissionSkillTool.id,
            ...missionSkillTool,
            description: output.description,
            parameters: output.parameters,
          })
          return surface
        }
        delete tools[MissionSkillTool.id]
        if (ConversationCapability.isAgentID(input.agentID)) {
          const availableToolNameSet = new Set(availableToolNames)
          const surface = await ConversationCapability.resolveSkillSurface({
            agentID: input.agentID,
            config: input.config,
            runtime: input.agent,
            scope: "session",
            availableToolNames: availableToolNameSet,
            explicitSkillNames: visibleChatSkillNames(input.messages),
          })
          resolvedToolSkillSurfaces.set(tools, surface)
          const exposeSkillTool = surface.tool_available && availableToolNameSet.has(SkillTool.id)
          if (!exposeSkillTool) {
            delete tools[SkillTool.id]
            return surface
          }
          const skillTool = await SkillTool.init({ config: input.config, skillSurface: surface })
          const output = {
            description: skillTool.description,
            parameters: skillTool.parameters,
          }
          await Plugin.trigger("tool.definition", { toolID: SkillTool.id }, output)
          bindRegistryTool({
            id: SkillTool.id,
            ...skillTool,
            description: output.description,
            parameters: output.parameters,
          })
          return surface
        }
        delete tools[SkillTool.id]
        resolvedToolSkillSurfaces.delete(tools)
        return undefined
      }
      delete tools[MissionSkillTool.id]
      if (!projectedRegistryToolIDs) {
        throw new Error(
          `Projected skill owner ${runtimeIdentity.agentID} session ${input.session.id} is missing projectedRegistryToolIDs.`,
        )
      }
      const availableToolNameSet = new Set(availableToolNames)
      const effectiveRegistryToolIDs = projectedWorkerVisibleRegistryToolIDs ?? projectedRegistryToolIDs
      const exposeSkillTool = effectiveRegistryToolIDs.has(SkillTool.id) && availableToolNameSet.has(SkillTool.id)
      if (!exposeSkillTool) delete tools[SkillTool.id]
      const skillProjection = runtimeContract.skillProjection
      if (!skillProjection) {
        throw new Error(
          `Projected skill owner ${runtimeIdentity.agentID} session ${input.session.id} is missing its turn-owned skill projection.`,
        )
      }
      const projectDirectory = runtimeContract.projectDirectory
      if (!projectDirectory) {
        throw new Error(
          `Projected skill owner ${runtimeIdentity.agentID} session ${input.session.id} is missing its project directory.`,
        )
      }
      const surface = await SkillMount.resolve({
        identity: runtimeIdentity,
        runtime: input.agent,
        scope: "session",
        projectDirectory,
        skillProjection,
        availableToolNames: availableToolNameSet,
      })
      resolvedToolSkillSurfaces.set(tools, surface)
      if (exposeSkillTool) {
        const skillTool = await SkillTool.init({ config: input.config, skillSurface: surface })
        const output = {
          description: skillTool.description,
          parameters: skillTool.parameters,
        }
        await Plugin.trigger("tool.definition", { toolID: SkillTool.id }, output)
        bindRegistryTool({
          id: SkillTool.id,
          ...skillTool,
          description: output.description,
          parameters: output.parameters,
        })
      }
      return surface
    }
    resolvedToolSkillFinalizers.set(tools, finalizeSkillSurface)
    const initialToolNames = new Set(Object.keys(tools))
    const projectedWorkerAllowsSkill = projectedWorkerVisibleRegistryToolIDs?.has(SkillTool.id)
    const nonWorkerAllowsSkill =
      projectedWorkerVisibleRegistryToolIDs === undefined &&
      projectedRegistryToolIDs?.has(SkillTool.id) &&
      (!input.session.permission?.length ||
        PermissionNext.evaluate(SkillTool.id, "*", input.session.permission).action !== "deny") &&
      toolSwitchAllows(SkillTool.id, input.tools)
    if (projectedWorkerAllowsSkill || nonWorkerAllowsSkill) {
      initialToolNames.add(SkillTool.id)
    }
    const missionRoleAllowsSkill =
      runtimeContract === undefined &&
      input.agentID === "mission" &&
      input.session.kind === "mission" &&
      AgentToolPool.visibleToolIDs(input.agent.tools).has(MissionSkillTool.id) &&
      (!input.session.permission?.length ||
        PermissionNext.evaluate(MissionSkillTool.id, "*", input.session.permission).action !== "deny") &&
      toolSwitchAllows(MissionSkillTool.id, input.tools)
    if (missionRoleAllowsSkill) initialToolNames.add(MissionSkillTool.id)
    const nativeConversationAllowsSkill =
      runtimeContract === undefined &&
      (input.agentID === "chat" || input.agentID === "work") &&
      AgentToolPool.visibleToolIDs(input.agent.tools).has(SkillTool.id) &&
      (!input.session.permission?.length ||
        PermissionNext.evaluate(SkillTool.id, "*", input.session.permission).action !== "deny") &&
      toolSwitchAllows(SkillTool.id, input.tools)
    if (nativeConversationAllowsSkill) initialToolNames.add(SkillTool.id)
    await finalizeSkillSurface(initialToolNames)
    if (!runtimeContract && ConversationCapability.isAgentID(input.agentID)) {
      const mcpToolIDs = [...toolSources.entries()].filter(([, source]) => source === "mcp").map(([toolID]) => toolID)
      executionHarnessProjection = await ConversationCapability.harnessProjection(input.agentID, {
        config: input.config,
        executionToolIDs: Object.keys(tools),
        executionMcpToolIDs: mcpToolIDs,
        skillRefs:
          resolvedToolSkillSurfaces.get(tools)?.family === "production"
            ? resolvedToolSkillSurfaces.get(tools)?.skills.map((skill) => skill.name)
            : undefined,
      })
    } else if (!runtimeContract && input.agentID === "mission" && input.session.kind === "mission") {
      const { MissionSkillRuntime } = await import("@/mission-skill/runtime")
      executionHarnessProjection = await MissionSkillRuntime.harnessProjection({
        agentID: input.agentID,
        sessionKind: input.session.kind,
        runtime: input.agent,
        availableToolNames: Object.keys(tools),
        executionToolIDs: Object.keys(tools),
      })
    }

    return tools
  }

  export function usesExactRuntimeContractTools(contract: SessionRuntimeContract | undefined): boolean {
    if (!contract) return false
    if (contract.identity.agentID === "orchestrator" && contract.identity.contractKind === "orchestrator-wake") {
      return true
    }
    const runtimeTemplate = RuntimeTemplateRegistry.get(contract.identity.baseRole)
    return contract.exactTools === true || runtimeTemplate.exactRuntimeContract
  }

  export function requiresProjectedRuntimeSurface(contract: SessionRuntimeContract | undefined): boolean {
    return contract !== undefined
  }

  export function applyToolSwitches(
    tools: Record<string, AITool>,
    switches: Record<string, boolean> | undefined,
  ): void {
    applyToolExecutionPolicy({ tools, permission: [], switches })
  }

  export function toolSwitchAllows(name: string, switches: Record<string, boolean> | undefined): boolean {
    return executionToolSwitchAllows(name, switches)
  }

  /**
   * Normalise an extra tool's `execute` return so it conforms to the
   * `{ output: string, title: string, metadata: object }` shape
   * SessionLoop's tool-part persistence requires.
   *
   *   - Plain string  →  `{ output: string, title: "", metadata: {} }`
   *   - Object result →  coerce missing fields to their minimal valid form
   *
   * Idempotent: already-conforming results round-trip unchanged.
   */
  function wrapExtraTool(
    name: string,
    raw: AITool,
    ctx: {
      sessionID: string
      messageID: string
      browserPermissionRulesets: readonly (PermissionNext.Ruleset | undefined)[]
      executionSurface: () => ToolExecutionSurface
      ensureToolPart: (
        toolCallID: string,
        toolName: string,
        toolInput: Record<string, unknown>,
      ) => Promise<Message.ToolPart>
      mcpAppLifecycle?: ReturnType<typeof createMcpAppToolLifecycle>
    },
  ): AITool {
    const original = raw as AITool & { execute?: (...args: any[]) => any }
    if (!original.execute) return raw
    const execute = original.execute
    const browserPermissionKey = browserMcpPermissionKeyOf(raw)
    const computerPermissionKey = computerMcpPermissionKeyOf(raw)
    // Mirror the attachment stamping the registry-tools wrapper applies
    // (loop.ts:967-987). Extras (e.g. build/runtime visual
    // tools) build attachments via buildMultimodalToolResult
    // which returns `{ type, mime, url, filename }` — missing the
    // PartBase fields (id/sessionID/messageID) that ToolStateCompleted's
    // FilePart schema requires. Without stamping here those attachments
    // land in part.state.attachments unstamped and the next session
    // processor tick rejects the message state with ZodError on
    // `state.attachments[0].{id,sessionID,messageID}`.
    const stampAttachments = (input: unknown): unknown => {
      if (!input || !Array.isArray(input)) return input
      return input.map((attachment: any) => ({
        ...attachment,
        id:
          typeof attachment?.id === "string" && attachment.id.length > 0 ? attachment.id : Identifier.ascending("part"),
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
      }))
    }
    const stampDisplayParts = (input: unknown): unknown => {
      if (!input || !Array.isArray(input)) return input
      return input.map((part: any) => ({
        ...part,
        id: typeof part?.id === "string" && part.id.length > 0 ? part.id : Identifier.ascending("part"),
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
      }))
    }
    return {
      ...(raw as any),
      async execute(args: unknown, options: unknown) {
        const toolCallID = typeof (options as any)?.toolCallId === "string" ? (options as any).toolCallId : undefined
        if (!toolCallID) throw new Error(`${name}: SessionLoop tool execution requires a tool call ID.`)
        const normalizedInput = normalizeToolInput(args)
        const toolInput = normalizedInput.ok ? normalizedInput.value : {}
        const toolPart = await ctx.ensureToolPart(toolCallID, name, toolInput)
        const invocationIdentity = {
          projectID: Instance.project.id,
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          toolCallID,
          toolPartID: toolPart.id,
          providerName: name,
        }
        const executeProjectedTool = () =>
          withTaskToolInvocation(invocationIdentity, ctx.executionSurface(), (invocationAuthority) =>
            execute(args, {
              ...(options && typeof options === "object" ? (options as Record<string, unknown>) : {}),
              opencorvus: {
                ...invocationIdentity,
                invocationAuthority,
              },
            }),
          )
        try {
          await ctx.mcpAppLifecycle?.input(toolCallID, toolInput)
          const result = browserPermissionKey
            ? await executeBrowserMcpToolWithPermission({
                key: browserPermissionKey,
                args,
                sessionID: ctx.sessionID,
                messageID: ctx.messageID,
                callID: toolCallID,
                rulesets: ctx.browserPermissionRulesets,
                execute: executeProjectedTool,
              })
            : computerPermissionKey
              ? await executeComputerMcpToolWithPermission({
                  key: computerPermissionKey,
                  args,
                  sessionID: ctx.sessionID,
                  messageID: ctx.messageID,
                  callID: toolCallID,
                  rulesets: ctx.browserPermissionRulesets,
                  execute: executeProjectedTool,
                })
              : await executeProjectedTool()
          const rawMcpResult = result && typeof result === "object" ? MCP.appToolResult(result as object) : undefined
          if (ctx.mcpAppLifecycle) {
            if (!rawMcpResult) throw new Error(`${name}: scoped MCP App tool did not retain its protocol result`)
            await ctx.mcpAppLifecycle.complete(toolCallID, toolInput, rawMcpResult)
          }
          const normalized = await materializeToolResultInlineAttachments({
            projectID: invocationIdentity.projectID,
            value: normalizeExtraToolResult(result),
          })
          const materializedAttachments = await materializeToolResultAttachments(normalized.attachments)
          return {
            ...normalized,
            ...(materializedAttachments !== undefined
              ? { attachments: stampAttachments(materializedAttachments) }
              : {}),
            ...(normalized.display !== undefined ? { display: stampDisplayParts(normalized.display) } : {}),
          }
        } catch (error) {
          if (ctx.mcpAppLifecycle) {
            const signal = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal
            if (signal?.aborted) {
              await ctx.mcpAppLifecycle.cancel(toolCallID, toolInput, "Tool execution cancelled")
            } else {
              await ctx.mcpAppLifecycle.fail(toolCallID, toolInput, error)
            }
          }
          throw error
        }
      },
    } as AITool
  }

  export function createStructuredOutputTool(input: {
    schema: Record<string, any>
    onSuccess: (output: unknown) => void
  }): AITool {
    const { $schema, ...toolSchema } = input.schema
    const inputSchema = jsonSchema(toolSchema as any)
    const payloadValidator = compileStructuredOutputPayloadValidator(toolSchema)
    return strictTool(
      tool({
        id: "StructuredOutput" as any,
        description: STRUCTURED_OUTPUT_DESCRIPTION,
        inputSchema,
        async execute(args) {
          const payload = validateStructuredOutputPayload(args, payloadValidator)
          if (!payload.ok) {
            throw new Message.StructuredOutputPayloadError({
              message: payload.reason,
              reason: payload.reason,
            })
          }
          input.onSuccess(payload.value)
          return {
            output: "Structured output captured successfully.",
            title: "Structured Output",
            metadata: { valid: true },
          }
        },
        toModelOutput(result) {
          return {
            type: "text",
            value: providerToolResultToModelOutput(result).value,
          }
        },
      }),
    )
  }

  export const TestHooks = {
    collectLoopState,
    consumeCompletedCompactionControl,
    executeCompactionControl,
    sessionStateContext,
    waitForUserMessage,
    resolveToolExecutionAuthority,
  }
}

configureSessionShellResume((input) => SessionLoop.loop(input))
