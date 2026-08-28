/**
 * Orchestrator tools — AI SDK tool() definitions wrapping existing services.
 *
 * Created per-task via createOrchestratorTools({ taskID }).
 * The taskID is captured in the closure — no global registry needed.
 */
import type { AgentDispatchAuthorityCommit } from "@/agent/runner"
import { parseAcceptanceSpecs } from "@/acceptance/types"
import { isDeepStrictEqual } from "node:util"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import {
  ProjectedWorkerBindingSchema,
  materializeProjectedWorkerBinding,
  sameProjectedWorkerBinding,
  type ProjectedWorkerBinding,
} from "@/agent/projected-worker-binding"
import {
  assertProjectedWorkerContinuationCompatible,
  sameProjectedWorkerIdentity,
} from "@/agent/projected-worker-identity"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { Tool } from "@/tool/tool"
import { createCapabilitySearchAiTool } from "@/tool/capability-search"
import { createPublishInteractiveArtifactAiTool } from "@/tool/publish-interactive-artifact"
import {
  createArtifactReadAiTool,
  createArtifactSearchAiTool,
  createArtifactSelectAiTool,
  createArtifactSnapshotAiTool,
} from "@/tool/artifact-catalog"
import type { DecisionEntry } from "@/decision-log"
import { assertTaskEvidenceLocators } from "@/engine/evidence-locator"
import { AGENT_COORDINATION_ACTIVE_DECISIONS, AGENT_COORDINATION_DECISIONS } from "@/engine/agent-coordination-decision"
import { DecisionLogTable } from "@/decision-log/schema"
import {
  bindAgentCoordinationRedispatchSuccessor,
  agentCoordinationQuestionID,
  completeAgentCoordinationAction,
  createAgentCoordinationResponse,
  failAgentCoordinationAction,
  findAgentCoordinationAction,
  findAgentCoordinationRequest,
  findAgentCoordinationResponse,
  listAgentCoordinationActions,
  recordAgentCoordinationActionProgress,
  resolveAgentCoordinationSessionLineage,
  AgentCoordinationRedispatchBindingSchema,
  type AgentCoordinationRedispatchBinding,
  type AgentCoordinationDecision,
  type AgentCoordinationRequestRow,
  type AgentCoordinationSessionLineageSource,
} from "@/engine/agent-coordination"
import {
  createDispatchLineageOrigin,
  resolveDispatchContinuationSourceID,
  findDispatchLineageByArtifactID,
  findDispatchLineageByDispatchID,
  findDispatchLineageBySession,
  findDispatchLineageByToolExecution,
  listDispatchLineage,
  recordDispatchLineage,
} from "@/engine/dispatch-lineage"
import { findDispatchSettlementByDispatchID } from "@/engine/dispatch-settlement"
import { abortChildExecutionForSession } from "@/engine/execution-abort"
import { clarificationTranscriptSection } from "@/engine/helpers"
import { Event as EngineEvent } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { findGoal, findInteractionByExternal, listGoals, requireTask, type TaskRow } from "@/engine/store"
import { resolveSessionExecutionAuthority, sessionRole, taskIDForSession } from "@/engine/task-session-lineage"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { sameTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference-schema"
import type { DesignResourceManifest } from "@/frontend-design/design-resource-manifest"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { publishFailedAgentCoordinationTurnStatus } from "@/orchestrator/agent-coordination-session-lifecycle"
import { ensureTaskMessageProtocolBridge } from "@/orchestrator/protocol/message-bridge"
import { Instance } from "@/project/instance"
import { owningMissionSchedulerEndpoint, taskSchedulerEndpoint } from "@/protocol/delivery"
import { sendSchedulerMessage } from "@/protocol/scheduler-message"
import {
  runWithIndependentProjectIdentity,
  runWithInitializedIndependentProject,
} from "@/project/independent-project-owner"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import type { TaskRootMessageKind } from "@/protocol/task-root-message-schema"
import {
  isProjectedWorkerRuntimeContract,
  SessionRuntimeContractStore,
  type ProjectedWorkerRuntimeContract,
} from "@/session/runtime-contract"
import { validateSessionRuntimeContractForContinuation } from "@/session/runtime-contract-validation"
import { sessionLifecycleOrderKey, SessionStatus } from "@/session/status"
import { withImmediateParkToolResultControl } from "@/session/tool-result-control"
import { bindToolDecisionDeclaration, bindToolExecutionMode } from "@/tool/execution-mode"
import { and, Database, eq, NotFoundError } from "@/storage/db"
import { MessageTable, PartTable } from "@/session/session.sql"
import { timelineOrderKey } from "@/timeline/order"
import { READ_TOOL_DESCRIPTION, ReadTool, ReadToolParameters } from "@/tool/read"
import { BrowserPreviewCaptureTool, BrowserPreviewCaptureToolStaticDefinition } from "@/tool/browser-preview-capture"
import { Log } from "@/util/log"
import { tool } from "ai"
import fs from "node:fs/promises"
import z from "zod"
import { ArtifactReadLocatorSchema, type EvidenceLocator } from "@opencorvus-ai/plugin/artifact-catalog"

import { Question } from "@/question"
import { isHttpWebpageUrl } from "@/util/web-url"
import { createAnalyzeIntentTool } from "./analyze-intent-tool"
import { createArchitectStageDispatcher } from "./architect-stage"
import { createBuildTool } from "./build-tool"
import { createDeepResearchStageDispatcher } from "./deep-research-stage"
import {
  createDispatchAdapterExecutionContext,
  dispatchAdapterContinuationPrompt,
  requireDispatchAdapterExecutionContext,
  type DispatchAdapterExecutionContext,
} from "./dispatch-adapter-execution-context"
import {
  bindDispatchAdapterExecutors,
  createDispatchAgentTool,
  DispatchAgentToolTestHooks,
  type DispatchAgentExecute,
  type OpenDispatchAgentLineage,
} from "./dispatch-agent-tool"

import { DispatchOutcome, DispatchOutcomeSchema } from "@/agent/dispatch-outcome"
import { createExploreTool } from "./explore-tool"
import { createDelegatedWorkerTool } from "./delegated-worker-tool"
import { createFactCheckTool } from "./fact-check-tool"
import { createFrontendDesignTool } from "./frontend-design-tool"
import { createFrontendResearchStageDispatcher } from "./frontend-research-stage"
import { createMulticaImportTools } from "./multica-import-tools"
import { createNoActionTool } from "./no-action-tool"
import { createExpertSquadAuthorAiTool } from "@/tool/expert-squad-author"
import { createExpertSquadFeedbackRevisionAiTool } from "@/tool/expert-squad-feedback-revision-tool"
import {
  AddGoalInputSchema,
  createDeliverySliceContractTools,
  DeleteGoalInputSchema,
  ModifyGoalInputSchema,
} from "./delivery-slice-contract-tools"
import { createIntegrityReviewStage } from "./integrity-review-stage"
import { createIntegrityReviewRunner, createIntegrityTool } from "./integrity-tool"
import { authorizedTaskRootMessagesForWake, createOrchestratorInteractionTools } from "./interaction-tools"
import { type TerminalConversationAuthority } from "./terminal-conversation-authority"
import { createReadContextTool } from "./read-context-tool"
import { createReadAgentMessageTool } from "./read-agent-message-tool"
import { createRequirementsStageDispatcher } from "./requirements-stage"
import { createRuntimeRepairTools } from "./runtime-repair-tools"
import { cancelDispatchedSession } from "./subagent-cancellation-runtime"
import { createSubagentCancellationTool } from "./subagent-cancellation-tool"
import { CancelTaskInputSchema, CompleteTaskInputSchema, FailTaskInputSchema } from "./task-lifecycle-input"
import { createTaskLifecycleTools, failTaskLifecycle } from "./task-lifecycle-tools"
import {
  assertTaskRootSessionLineageForConfig,
  optionsWithVisibleOrchestratorToolName,
  requireOrchestratorToolExecutionContext,
  requireTaskOrchestratorToolExecutionContext,
  type TaskWithRootSession,
} from "./tool-execution-context"
import { createVisualQaStageDispatcher } from "./visual-qa-stage"
import { createWorkloadAnalysisTool } from "./workload-analysis-tool"
import { ORCHESTRATOR_DECISION_TOOL_NAMES, orchestratorDecisionToolCompletionEffect } from "./decision-tool-names"
import { sameSelectedWorkflowBinding, workflowProjectionFromProjectedAgents } from "@/engine/workflow-binding"
import { currentTaskAcceptanceRepair, workflowNodeConsumesAcceptanceCriterion } from "@/mission/acceptance-ledger"
import type { MissionAcceptanceGap } from "@/mission/acceptance-gap"
import {
  acceptanceRepairEvidenceLocators,
  DispatchTurnSchema,
  controlTextSHA256,
  taskRequestSHA256,
  type AcceptanceRepairDispatch,
  type TaskAuthorityAnchor,
} from "./dispatch-turn-projection"

const orchestratorToolLineageHooks = new WeakMap<object, OpenDispatchAgentLineage>()

export const OrchestratorToolsTestHooks = Object.freeze({
  openDispatchLineage(surface: object): OpenDispatchAgentLineage {
    const openLineage = orchestratorToolLineageHooks.get(surface)
    if (!openLineage) throw new Error("Orchestrator Tools lineage hook is unavailable")
    return openLineage
  },
})

const log = Log.create({ service: "task-tools" })

const RequirementsInputSchema = DispatchAdapterContractRegistry.inputSchema("requirements")
const ArchitectInputSchema = DispatchAdapterContractRegistry.inputSchema("architect")
const WorkloadAnalysisInputSchema = DispatchAdapterContractRegistry.inputSchema("workload_analysis")
const AnalyzeIntentInputSchema = DispatchAdapterContractRegistry.inputSchema("analyze_intent")
const FrontendDesignInputSchema = DispatchAdapterContractRegistry.inputSchema("frontend_design")
const FrontendResearchInputSchema = DispatchAdapterContractRegistry.inputSchema("frontend_research")
const DeepResearchInputSchema = DispatchAdapterContractRegistry.inputSchema("deep_research")
const VisualQaInputSchema = DispatchAdapterContractRegistry.inputSchema("visual_qa")
const FactCheckInputSchema = DispatchAdapterContractRegistry.inputSchema("fact_check")
const IntegrityInputSchema = DispatchAdapterContractRegistry.inputSchema("integrity")
const BuildInputSchema = DispatchAdapterContractRegistry.inputSchema("build")

type ArchitectToolInput = z.infer<typeof ArchitectInputSchema>

function architectDispatchReason(input: ArchitectToolInput): string {
  return [
    input.reason,
    "Independently search and completely read the Task Artifacts you need, bind your own exact input selection, and record architecture facts with their evidence.",
  ].join("\n")
}

async function taskAuthorityAnchor(input: {
  task: TaskWithRootSession
  existingSessionID?: string
}): Promise<TaskAuthorityAnchor> {
  const base = {
    task_id: input.task.id,
    root_session_id: input.task.session_id,
    request_sha256: taskRequestSHA256(input.task.request),
  }
  if (!input.existingSessionID) {
    return {
      ...base,
      initial_control_text_parts: [],
    }
  }
  const descriptor = WorkerTurnDescriptor.latestForSession(input.existingSessionID)
  const authority = descriptor?.payload.dispatchTurn?.task_authority
  if (!descriptor || !authority) {
    throw new Error(`Continuation Session ${input.existingSessionID} has no persisted Task authority descriptor`)
  }
  if (
    authority.task_id !== base.task_id ||
    authority.root_session_id !== base.root_session_id ||
    authority.request_sha256 !== base.request_sha256
  ) {
    throw new Error(`Continuation Session ${input.existingSessionID} Task authority does not match the durable Task`)
  }
  if (!authority.initial_user_message_id || authority.initial_control_text_parts.length === 0) {
    throw new Error(`Continuation Session ${input.existingSessionID} has incomplete initial control-text authority`)
  }
  const messages = await Session.messages({ sessionID: input.existingSessionID })
  const initial = messages.find((message) => message.info.id === authority.initial_user_message_id)
  if (!initial) {
    throw new Error(`Continuation Session ${input.existingSessionID} is missing its authoritative initial user message`)
  }
  const actualTextParts = initial.parts.filter((part) => part.type === "text")
  const expectedPartIDs = new Set(authority.initial_control_text_parts.map((part) => part.part_id))
  if (
    actualTextParts.length !== authority.initial_control_text_parts.length ||
    actualTextParts.some((part) => !expectedPartIDs.has(part.id))
  ) {
    throw new Error(
      `Continuation Session ${input.existingSessionID} initial control-text Part set does not match persisted authority`,
    )
  }
  for (const control of authority.initial_control_text_parts) {
    const part = initial.parts.find((candidate) => candidate.id === control.part_id)
    if (!part || part.type !== "text" || controlTextSHA256(part.text) !== control.text_sha256) {
      throw new Error(
        `Continuation Session ${input.existingSessionID} control-text authority ${control.part_id} does not match persisted content`,
      )
    }
  }
  return authority
}

function buildAgentContextSections(
  entries: Array<{
    title: string
    body: string | undefined
  }>,
): string[] {
  return entries.flatMap((entry) => {
    const body = entry.body?.trim()
    return body ? [`## ${entry.title}\n\n${body}`] : []
  })
}

function projectedCoordinationActor(binding: ProjectedWorkerBinding): string {
  return `Projected agent "${binding.identity.agentID}" via the "${binding.identity.dispatchAdapterID}" typed adapter`
}

function projectedCoordinationActionSummary(binding: ProjectedWorkerBinding, event: string): string {
  return `${projectedCoordinationActor(binding)} ${event}`
}

function projectedCoordinationActionIdentity(binding: ProjectedWorkerBinding) {
  return {
    redispatch_agent_id: binding.identity.agentID,
    redispatch_adapter_id: binding.identity.dispatchAdapterID,
  }
}

const FactCheckStageInputSchema = z
  .object({
    target_session_id: z.string().min(1),
    target_agent: z.string().min(1),
    reason: z.string().min(10),
    target_message_id: z.string().min(1),
    target_message_content_hash: z.string().min(1),
  })
  .strict()

type FactCheckStageInput = z.infer<typeof FactCheckStageInputSchema>

async function resolveFactCheckTargetScope(input: {
  taskID: string
  targetSessionID: string
  targetMessageID: string
  assertedTargetAgent?: string
}): Promise<{ targetAgent: string; targetMessageID: string; targetMessageContentHash: string } | { error: string }> {
  const owningTaskID = taskIDForSession(input.targetSessionID)
  if (owningTaskID !== input.taskID) {
    return {
      error:
        owningTaskID === undefined
          ? `target_session_id ${input.targetSessionID} is not owned by any task.`
          : `target_session_id ${input.targetSessionID} belongs to task ${owningTaskID}, not current task ${input.taskID}.`,
    }
  }
  const session = await Session.get(input.targetSessionID)
  const snapshot = await Session.snapshotAssistantMessage({
    sessionID: input.targetSessionID,
    messageID: input.targetMessageID,
  })
  if (!snapshot.finished) {
    return {
      error:
        `target_message_id ${input.targetMessageID} is not a completed assistant message in ` +
        `${input.targetSessionID} (reason=${snapshot.reason ?? "unknown"}).`,
    }
  }
  if (!snapshot.messageID || !snapshot.contentHash || !snapshot.agentID) {
    return {
      error: "target session has no completed assistant message with an exact agent identity.",
    }
  }
  const descriptorRef = snapshot.workerTurnDescriptor
  if (!descriptorRef) {
    return { error: `target_session_id ${input.targetSessionID} has no message-bound worker descriptor reference.` }
  }
  const descriptor = WorkerTurnDescriptor.get({ id: descriptorRef.id, sessionID: input.targetSessionID })
  if (!descriptor) {
    return {
      error: `target_session_id ${input.targetSessionID} has no message-bound projected worker descriptor ${descriptorRef.id}.`,
    }
  }
  if (descriptor.hash !== descriptorRef.hash) {
    return {
      error:
        `target message descriptor hash mismatch for ${input.targetSessionID}: message ${descriptorRef.hash}, ` +
        `descriptor ${descriptor.hash}.`,
    }
  }
  const targetAgent = snapshot.agentID
  if (descriptor.payload.identity.agentID !== targetAgent) {
    return {
      error:
        `target assistant identity mismatch for ${input.targetSessionID}: message agent ${targetAgent}, ` +
        `descriptor agent ${descriptor.payload.identity.agentID}.`,
    }
  }
  if (descriptor.payload.identity.sessionKind !== session.kind) {
    return {
      error:
        `target session template mismatch for ${input.targetSessionID}: session kind ${session.kind}, ` +
        `descriptor session kind ${descriptor.payload.identity.sessionKind}.`,
    }
  }
  // Fact-check binds immutable terminal output through durable descriptor evidence;
  // process-local runtime contracts belong to live continuation and disappear on restart.
  const asserted = input.assertedTargetAgent?.trim()
  if (asserted && asserted !== targetAgent) {
    return {
      error:
        `target_agent mismatch for ${input.targetSessionID}: caller asserted ${asserted}, ` +
        `but the terminal assistant identity is ${targetAgent}.`,
    }
  }
  return {
    targetAgent,
    targetMessageID: snapshot.messageID,
    targetMessageContentHash: snapshot.contentHash,
  }
}

type IntegrityToolInput = z.infer<typeof IntegrityInputSchema>

const ManageTaskActionInputSchemas = {
  complete_task: CompleteTaskInputSchema,
  fail_task: FailTaskInputSchema,
  cancel_task: CancelTaskInputSchema,
  add_goal: AddGoalInputSchema,
  modify_goal: ModifyGoalInputSchema,
  delete_goal: DeleteGoalInputSchema,
} satisfies Record<string, z.ZodObject<any>>

const MANAGE_TASK_ACTION_NAMES = Object.keys(ManageTaskActionInputSchemas) as [
  keyof typeof ManageTaskActionInputSchemas,
  ...(keyof typeof ManageTaskActionInputSchemas)[],
]

const MANAGE_TASK_ACTION_FIELDS = Object.fromEntries(
  MANAGE_TASK_ACTION_NAMES.map((action) => [
    action,
    Object.keys(ManageTaskActionInputSchemas[action].shape).sort((left, right) => left.localeCompare(right)),
  ]),
) as Record<keyof typeof ManageTaskActionInputSchemas, string[]>

const ManageTaskInputSchema = z.discriminatedUnion(
  "action",
  MANAGE_TASK_ACTION_NAMES.map((action) =>
    ManageTaskActionInputSchemas[action].safeExtend({
      action: z
        .literal(action)
        .describe(
          `Task lifecycle or Delivery Slice contract action to execute through the single scheduler task-management tool. ` +
            `When action=${action}, provide exactly these non-action fields: ${MANAGE_TASK_ACTION_FIELDS[action].join(", ") || "(none)"}.`,
        ),
    }),
  ) as any,
)

function assertDirectReplySessionKind(input: { taskID: string; sessionID: string }): {
  kind: string
  baseRole: string
  runtimeContract: ProjectedWorkerRuntimeContract
} {
  const kind = sessionRole(input.sessionID)
  if (!kind) {
    throw new Error(`Session ${input.sessionID} has no task agent kind`)
  }
  const installed = SessionRuntimeContractStore.get(input.sessionID)
  if (!installed || installed.identity.identityKind !== "projected-worker") {
    throw new Error(`Session ${input.sessionID} has no projected worker runtime identity for agent control`)
  }
  const runtimeContract = validateSessionRuntimeContractForContinuation({
    sessionID: input.sessionID,
    expectedSessionKind: kind,
    expectedTaskID: input.taskID,
    expectedAgentID: installed.identity.agentID,
    expectedWorkerTurnDescriptor: {
      id: installed.identity.workerTurnDescriptorID,
      hash: installed.identity.workerTurnDescriptorHash,
    },
    requireWorkerTurnDescriptor: true,
    requireRuntimeContract: true,
  })
  if (!runtimeContract || !isProjectedWorkerRuntimeContract(runtimeContract)) {
    throw new Error(`Session ${input.sessionID} projected worker runtime identity disappeared during agent control`)
  }
  RuntimeTemplateRegistry.get(runtimeContract.identity.baseRole)
  return { kind, baseRole: runtimeContract.identity.baseRole, runtimeContract }
}

function assertDirectReplySessionLineage(input: { taskID: string; sessionID: string }): {
  kind: string
  baseRole: string
  runtimeContract: ProjectedWorkerRuntimeContract
  lineageSource: AgentCoordinationSessionLineageSource
} {
  const lineage = resolveAgentCoordinationSessionLineage(input)
  const { kind, baseRole, runtimeContract } = assertDirectReplySessionKind(input)
  return { kind, baseRole, runtimeContract, lineageSource: lineage.source }
}

async function assertAgentCoordinationRequestSessionLineage(input: {
  taskID: string
  sessionID: string
}): Promise<{ task: TaskWithRootSession; session: Session.Info }> {
  const task = await assertTaskRootSessionLineageForConfig(requireTask(input.taskID))
  const session = await Session.assertLineageInProject({
    sessionID: input.sessionID,
    projectID: task.project_id,
  })
  return { task, session }
}

function requireAgentCoordinationRequestForResponse(input: {
  taskID: string
  requestID: string
}): AgentCoordinationRequestRow {
  const request = findAgentCoordinationRequest({
    taskID: input.taskID,
    requestID: input.requestID,
  })
  if (!request) {
    throw new Error(`agent coordination request ${input.requestID} does not belong to task ${input.taskID}`)
  }
  if (request.payload.status !== "pending" && request.payload.status !== "responded") {
    throw new Error(`agent coordination request ${input.requestID} is ${request.payload.status}`)
  }
  return request
}

function persistedRedispatchBindingForRespondedRequest(input: {
  taskID: string
  request: AgentCoordinationRequestRow
}): AgentCoordinationRedispatchBinding | undefined {
  const response = input.request.payload.response_id
    ? findAgentCoordinationResponse({
        taskID: input.taskID,
        responseID: input.request.payload.response_id,
      })
    : undefined
  const responseAction = response
    ? findAgentCoordinationAction({
        taskID: input.taskID,
        actionID: response.payload.action_id,
      })
    : undefined
  const action =
    responseAction?.payload.action === "redispatch_worker"
      ? responseAction
      : listAgentCoordinationActions(input.taskID).find(
          (candidate) =>
            candidate.payload.request_id === input.request.payload.request_id &&
            candidate.payload.action === "redispatch_worker" &&
            (candidate.payload.status === "pending" || candidate.payload.status === "completed"),
        )
  if (!action) return undefined
  const binding = redispatchBindingFromActionResult({
    actionID: action.payload.action_id,
    result: action.payload.result ?? {},
  })
  if (!sameProjectedWorkerBinding(binding, input.request.payload.worker_binding)) {
    throw new Error(
      `agent coordination redispatch action ${action.payload.action_id} binding does not match the frozen request worker binding`,
    )
  }
  return binding
}

function redispatchBindingFromActionResult(input: {
  actionID: string
  result: Record<string, unknown>
}): AgentCoordinationRedispatchBinding {
  const rawBinding = input.result.redispatch_binding
  const parsed = AgentCoordinationRedispatchBindingSchema.safeParse(rawBinding)
  if (!parsed.success) {
    throw new Error(`agent coordination redispatch action ${input.actionID} has malformed redispatch_binding`)
  }
  return parsed.data
}

function requireAgentCoordinationRedispatchBindingForRequest(input: {
  taskID: string
  request: AgentCoordinationRequestRow
}): AgentCoordinationRedispatchBinding {
  if (input.request.payload.status !== "responded") {
    throw new Error(
      `agent coordination request ${input.request.payload.request_id} has no persisted redispatch decision`,
    )
  }
  const persisted = persistedRedispatchBindingForRespondedRequest(input)
  if (!persisted) {
    throw new Error(
      `responded agent coordination request ${input.request.payload.request_id} has no persisted redispatch binding`,
    )
  }
  return persisted
}

function requireAgentCoordinationWorkerWorkScope(input: {
  request: AgentCoordinationRequestRow
  binding: ProjectedWorkerBinding
}) {
  const descriptor = WorkerTurnDescriptor.get({
    id: input.binding.workerTurnDescriptorID,
    sessionID: input.request.payload.session_id,
  })
  if (!descriptor || descriptor.hash !== input.binding.workerTurnDescriptorHash) {
    throw new Error(
      `agent coordination redispatch worker descriptor ${input.binding.workerTurnDescriptorID} does not match the frozen request binding`,
    )
  }
  if (
    !sameProjectedWorkerIdentity(descriptor.payload.identity, input.binding.identity) ||
    descriptor.payload.expertSquadID !== input.binding.expertSquadID
  ) {
    throw new Error(
      `agent coordination redispatch worker descriptor ${input.binding.workerTurnDescriptorID} identity does not match the frozen request binding`,
    )
  }
  return descriptor.payload.lifecycle.workScope
}

function requireInstalledAgentCoordinationWorkerBinding(input: {
  sessionID: string
  binding: ProjectedWorkerBinding
}): { binding: ProjectedWorkerBinding; runtimeContract: ProjectedWorkerRuntimeContract } {
  const runtimeContract = SessionRuntimeContractStore.get(input.sessionID)
  if (!runtimeContract || !isProjectedWorkerRuntimeContract(runtimeContract)) {
    throw new Error(`agent coordination session ${input.sessionID} has no projected worker runtime binding`)
  }
  const installed = materializeProjectedWorkerBinding({
    identity: runtimeContract.identity,
    expertSquadID: runtimeContract.identity.expertSquadID,
    workerTurnDescriptorID: runtimeContract.identity.workerTurnDescriptorID,
    workerTurnDescriptorHash: runtimeContract.identity.workerTurnDescriptorHash,
  })
  if (!sameProjectedWorkerBinding(input.binding, installed)) {
    throw new Error(
      `agent coordination session ${input.sessionID} installed worker binding does not match the frozen request worker binding`,
    )
  }
  return { binding: installed, runtimeContract }
}

function replayedAgentCoordinationActionResult(input: {
  taskID: string
  response: Awaited<ReturnType<typeof createAgentCoordinationResponse>>
}): string | undefined {
  if (input.response.createdNow !== false) return undefined
  const action = findAgentCoordinationAction({
    taskID: input.taskID,
    actionID: input.response.payload.action_id,
  })
  if (!action) {
    throw new Error(
      `agent coordination replay response ${input.response.payload.response_id} points to missing action ${input.response.payload.action_id}`,
    )
  }
  const request = findAgentCoordinationRequest({
    taskID: input.taskID,
    requestID: input.response.payload.request_id,
  })
  if (!request) {
    throw new Error(
      `agent coordination replay response ${input.response.payload.response_id} points to missing request ${input.response.payload.request_id}`,
    )
  }
  const actor = projectedCoordinationActor(request.payload.worker_binding)
  if (action.payload.status === "completed") {
    return (
      `${actor} replayed coordination response ${input.response.payload.response_id}; ` +
      `action=${action.payload.action_id} already completed as ${action.payload.action}.`
    )
  }
  if (action.payload.status === "failed") {
    return (
      `${actor} replayed coordination response ${input.response.payload.response_id}; ` +
      `action=${action.payload.action_id} already failed and the request remains pending for a new response.`
    )
  }
  return undefined
}

function agentCoordinationWorkerMessageID(actionID: string): string {
  return Identifier.ascending("message", `msg_agent_coordination_${actionID}`)
}

function agentCoordinationWorkerMessagePartID(actionID: string): string {
  return Identifier.ascending("part", `prt_agent_coordination_${actionID}`)
}

function recordedAgentCoordinationWorkerMessageID(
  action: NonNullable<ReturnType<typeof findAgentCoordinationAction>>,
): string | undefined {
  const value = action.payload.result?.worker_message_id
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function recordedAgentCoordinationQuestionID(
  action: NonNullable<ReturnType<typeof findAgentCoordinationAction>>,
): string | undefined {
  const value = action.payload.result?.question_id
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function recordedAgentCoordinationInteractionID(
  action: NonNullable<ReturnType<typeof findAgentCoordinationAction>>,
): string | undefined {
  const value = action.payload.result?.interaction_id
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function requireAgentCoordinationQuestionInteraction(input: {
  action: NonNullable<ReturnType<typeof findAgentCoordinationAction>>
  actionID: string
  taskID: string
  sessionID: string
  questions: Question.Info[]
  tool: { messageID: string; callID: string }
  interaction: NonNullable<ReturnType<typeof findInteractionByExternal>>
}) {
  const questionID = agentCoordinationQuestionID(input.actionID)
  const recordedQuestionID = recordedAgentCoordinationQuestionID(input.action)
  const recordedInteractionID = recordedAgentCoordinationInteractionID(input.action)
  if ((recordedQuestionID === undefined) !== (recordedInteractionID === undefined)) {
    throw new Error(`A2A ask_user action ${input.actionID} has incomplete question interaction binding`)
  }
  if (recordedQuestionID && recordedQuestionID !== questionID) {
    throw new Error(
      `A2A ask_user action ${input.actionID} records question ${recordedQuestionID}, expected ${questionID}`,
    )
  }
  if (recordedInteractionID && recordedInteractionID !== input.interaction.id) {
    throw new Error(
      `A2A ask_user action ${input.actionID} records interaction ${recordedInteractionID}, found ${input.interaction.id}`,
    )
  }
  if (input.interaction.external_id !== questionID) {
    throw new Error(
      `A2A ask_user interaction ${input.interaction.id} has question ${input.interaction.external_id}, expected ${questionID}`,
    )
  }
  if (input.interaction.task_id !== input.taskID) {
    throw new Error(
      `A2A ask_user interaction ${input.interaction.id} belongs to task ${input.interaction.task_id}, not ${input.taskID}`,
    )
  }
  if (input.interaction.session_id !== input.sessionID) {
    throw new Error(
      `A2A ask_user interaction ${input.interaction.id} belongs to session ${input.interaction.session_id}, not ${input.sessionID}`,
    )
  }
  if (input.interaction.request_type !== "question") {
    throw new Error(
      `A2A ask_user interaction ${input.interaction.id} has type ${input.interaction.request_type}, expected question`,
    )
  }
  const payload = z
    .object({
      questions: z.array(Question.Info),
      tool: z.object({ messageID: z.string(), callID: z.string() }),
      expiry: Question.Expiry.optional(),
    })
    .parse(input.interaction.payload)
  if (JSON.stringify(payload.questions) !== JSON.stringify(input.questions)) {
    throw new Error(`A2A ask_user interaction ${input.interaction.id} changed the question payload`)
  }
  if (payload.tool.messageID !== input.tool.messageID || payload.tool.callID !== input.tool.callID) {
    throw new Error(`A2A ask_user interaction ${input.interaction.id} changed the persisted Tool binding`)
  }
  return { interaction: input.interaction, payload, questionID }
}

function answersFromInteraction(
  interaction: NonNullable<ReturnType<typeof findInteractionByExternal>>,
): Question.Answer[] {
  return z.array(Question.Answer).parse(interaction.response?.answers)
}

function expiryFromInteraction(interaction: NonNullable<ReturnType<typeof findInteractionByExternal>>) {
  const response = z
    .object({
      origin: z.literal("deadline"),
      time_expires: z.number().int().positive(),
    })
    .parse(interaction.response)
  const requestExpiry = z.object({ expiry: Question.Expiry }).parse(interaction.payload).expiry
  if (requestExpiry.timeExpires !== response.time_expires) {
    throw new Error(`A2A ask_user interaction ${interaction.id} resolved against a different deadline`)
  }
  const timeResolved = z.number().int().positive().parse(interaction.time_resolved)
  return { timeExpires: response.time_expires, timeResolved, timeoutMs: requestExpiry.timeoutMs }
}

function operatorRejectionFromInteraction(interaction: NonNullable<ReturnType<typeof findInteractionByExternal>>) {
  return z.object({ origin: z.literal("operator") }).parse(interaction.response)
}

async function findAgentCoordinationWorkerMessage(input: {
  sessionID: string
  messageID: string
}): Promise<Awaited<ReturnType<typeof MessageStore.get>> | undefined> {
  try {
    return await MessageStore.get({ sessionID: input.sessionID, messageID: input.messageID })
  } catch (error) {
    if (!NotFoundError.isInstance(error as Error)) throw error
    return undefined
  }
}

async function requireAgentCoordinationWorkerMessage(input: {
  sessionID: string
  messageID: string
  actionID: string
}): Promise<Awaited<ReturnType<typeof MessageStore.get>>> {
  const message = await findAgentCoordinationWorkerMessage({
    sessionID: input.sessionID,
    messageID: input.messageID,
  })
  if (!message) {
    throw new Error(
      `A2A continue action ${input.actionID} records worker message ${input.messageID}, but the message is missing`,
    )
  }
  return message
}

async function waitForQuestionInteraction(input: { questionID: string; taskID: string; resolved?: boolean }) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const interaction = findInteractionByExternal(input.questionID)
    if (interaction) {
      if (interaction.task_id !== input.taskID) {
        throw new Error(
          `A2A ask_user question ${input.questionID} projected to task ${interaction.task_id}, not ${input.taskID}`,
        )
      }
      if (input.resolved !== true || interaction.status !== "pending") return interaction
    }
    await Bun.sleep(25)
  }
  throw new Error(
    input.resolved === true
      ? `A2A ask_user question ${input.questionID} interaction did not resolve`
      : `A2A ask_user question ${input.questionID} did not project to an engine interaction`,
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

/**
 * The part of a stage dispatch that is the same for every stage.
 *
 * Five call sites each unpacked the very same nine fields out of the typed
 * `DispatchAdapterExecutionContext` they already held — including two closures
 * over `execution.dispatch` written out identically each time. Adding a stage
 * meant copying them again, and changing one meant finding all five.
 */
function stageDispatchBinding(execution: DispatchAdapterExecutionContext) {
  return {
    agentID: execution.agentID,
    packageRevision: execution.projectedAgent.packageRevision,
    workScope: execution.workScope,
    newSessionID: execution.newSessionID,
    existingSessionID: execution.existingSessionID,
    continuationPrompt: dispatchAdapterContinuationPrompt(execution),
    dispatchTurn: execution.dispatch.turn,
    onSessionCreated: async (sessionID: string) => {
      execution.dispatch.observeSession(sessionID)
    },
    onDispatchAuthorityCommit: ((sessionID, descriptor) =>
      execution.dispatch.commitSession(sessionID, descriptor)) as AgentDispatchAuthorityCommit,
  }
}

export function createOrchestratorTools(input: {
  taskID: string
  agentSessionID: string
  signal?: AbortSignal
  dispatchAgents: readonly PromptProfileResolver.ResolvedProjectedAgent[]
  rootMessage?: {
    messageID: string
    kind: TaskRootMessageKind
  }
  missionAcceptanceResume?: {
    messageID: string
  }
  terminalConversationAuthority?: TerminalConversationAuthority
}) {
  if (!Array.isArray(input.dispatchAgents)) {
    throw new Error("createOrchestratorTools requires the exact turn-owned dynamic-agent projection.")
  }
  const { taskID } = input
  const activeAcceptanceRepair = currentTaskAcceptanceRepair(taskID)
  const taskProjectDirectory = taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id })

  async function requireCurrentTaskRootSessionLineage(): Promise<TaskWithRootSession> {
    const task = requireTask(taskID)
    return assertTaskRootSessionLineageForConfig(task)
  }

  async function requireCurrentTaskAndAgentSessionLineage(): Promise<TaskWithRootSession> {
    const task = await requireCurrentTaskRootSessionLineage()
    await Session.assertLineageInProject({
      sessionID: input.agentSessionID,
      projectID: task.project_id,
    })
    return task
  }

  const runIntegrityReviewOnce = createIntegrityReviewStage({
    taskID,
    parentSessionID: input.agentSessionID,
    signal: input.signal,
  })

  const runIntegrityReview = createIntegrityReviewRunner({
    taskID,
    requireTask: () => requireTask(taskID),
    runReviewOnce: runIntegrityReviewOnce,
  })

  // Agents that need to ask the user a question do so directly via
  // `Question.ask`. Workflow steps never pause for input here.

  const dispatchArchitectStage = createArchitectStageDispatcher({
    taskID,
    parentSessionID: input.agentSessionID,
    signal: input.signal,
  })

  const dispatchVisualQaStage = createVisualQaStageDispatcher({
    taskID,
    parentSessionID: input.agentSessionID,
    signal: input.signal,
  })

  const dispatchRequirementsStage = createRequirementsStageDispatcher({
    taskID,
    parentSessionID: input.agentSessionID,
    signal: input.signal,
  })
  const dispatchDeepResearchStage = createDeepResearchStageDispatcher({
    taskID,
    parentSessionID: input.agentSessionID,
    signal: input.signal,
  })
  const dispatchFrontendResearchStage = createFrontendResearchStageDispatcher({
    taskID,
    parentSessionID: input.agentSessionID,
    signal: input.signal,
  })

  const tools = {
    scheduler_message: tool({
      description:
        "Send one durable scheduler message. Use request for a question/directive, reply with the exact request event_id, and notification for a one-way update. The target may be this Task's owning Mission or a sibling Task owned by the same Mission. Replies preserve the original route and thread automatically.",
      inputSchema: z
        .object({
          kind: z.enum(["request", "reply", "notification"]),
          target: z
            .discriminatedUnion("kind", [
              z.object({ kind: z.literal("mission") }).strict(),
              z.object({ kind: z.literal("task"), task_id: z.string().min(1) }).strict(),
            ])
            .optional(),
          reply_to: z.string().startsWith("pev").optional(),
          subject: z.string().min(1).max(500),
          message: z.string().min(1),
        })
        .strict()
        .superRefine((value, context) => {
          if (value.kind === "reply") {
            if (!value.reply_to) context.addIssue({ code: "custom", message: "reply requires reply_to" })
            if (value.target) context.addIssue({ code: "custom", message: "reply target is derived from reply_to" })
          } else {
            if (!value.target) context.addIssue({ code: "custom", message: `${value.kind} requires target` })
            if (value.reply_to) context.addIssue({ code: "custom", message: "only reply may set reply_to" })
          }
        }),
      execute: async (messageInput, options) => {
        const execution = await requireTaskOrchestratorToolExecutionContext(options, "scheduler_message", {
          taskID,
          agentSessionID: input.agentSessionID,
        })
        const source = taskSchedulerEndpoint(taskID)
        const target =
          messageInput.target?.kind === "mission"
            ? owningMissionSchedulerEndpoint(taskID)
            : messageInput.target?.kind === "task"
              ? taskSchedulerEndpoint(messageInput.target.task_id)
              : undefined
        return sendSchedulerMessage({
          invocationID: `scheduler-message:${execution.orchestratorSessionID}:${execution.orchestratorMessageID}:${execution.toolCallID}`,
          kind: messageInput.kind,
          source,
          target,
          replyTo: messageInput.reply_to,
          subject: messageInput.subject,
          sourceMessageID: execution.orchestratorMessageID,
          sourcePartID: execution.toolPartID,
        })
      },
    }),
    skill: tool({
      description:
        "Search/load surface for production skills granted to the Task's immutable Orchestrator scheduler projection. The session loop replaces this placeholder with the exact turn-scoped scheduler SkillTool before the model can call it.",
      inputSchema: z
        .object({
          query: z
            .string()
            .optional()
            .describe("Fuzzy search terms for mounted Orchestrator expert-squad skill titles and SKILL.md content."),
          name: z
            .string()
            .optional()
            .describe("Exact mounted Orchestrator expert-squad skill name to load after search identifies it."),
        })
        .strict(),
      execute: async (_input): Promise<string> => {
        throw new Error("Orchestrator production SkillTool was not rebound for this projected scheduler turn.")
      },
    }),
    read: tool({
      description: READ_TOOL_DESCRIPTION,
      inputSchema: ReadToolParameters,
      execute: async (args, options) => {
        const execution = await requireTaskOrchestratorToolExecutionContext(options, "read", {
          taskID,
          agentSessionID: input.agentSessionID,
        })
        const abort = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal
        if (!abort) throw new Error("read: missing the current streamed tool-call abort signal")
        const initialized = await ReadTool.init()
        const executionAuthority = await resolveSessionExecutionAuthority({
          sessionID: execution.orchestratorSessionID,
          projectID: Instance.project.id,
          expected: { kind: "task", taskID },
        })
        return await initialized.execute(args, {
          sessionID: execution.orchestratorSessionID,
          messageID: execution.orchestratorMessageID,
          callID: execution.toolCallID,
          agent: "orchestrator",
          abort,
          messages: await Session.messages({ sessionID: execution.orchestratorSessionID }),
          executionAuthority,
          executionSurface: Tool.executionSurface(["read"], []),
          extra: { taskID },
          metadata() {},
        })
      },
    }),
    // Independent scheduler visual review: a package may project this so the
    // Orchestrator itself captures and inspects fresh PNG evidence from a
    // preview target a worker already persisted, before accepting the Task.
    // The full Tool result is returned so its image attachments survive into
    // the model output; returning only `output` would strip the evidence.
    browser_preview_capture: tool({
      description: BrowserPreviewCaptureToolStaticDefinition.description,
      inputSchema: BrowserPreviewCaptureToolStaticDefinition.parameters,
      execute: async (args, options) => {
        const execution = await requireTaskOrchestratorToolExecutionContext(options, "browser_preview_capture", {
          taskID,
          agentSessionID: input.agentSessionID,
        })
        const abort = (options as { abortSignal?: AbortSignal } | undefined)?.abortSignal ?? input.signal
        if (!abort) throw new Error("browser_preview_capture: missing the current streamed tool-call abort signal")
        const initialized = await BrowserPreviewCaptureTool.init()
        const executionAuthority = await resolveSessionExecutionAuthority({
          sessionID: execution.orchestratorSessionID,
          projectID: Instance.project.id,
          expected: { kind: "task", taskID },
        })
        return await initialized.execute(args, {
          sessionID: execution.orchestratorSessionID,
          messageID: execution.orchestratorMessageID,
          callID: execution.toolCallID,
          agent: "orchestrator",
          abort,
          messages: [],
          executionAuthority,
          executionSurface: Tool.executionSurface(["browser_preview_capture"], []),
          extra: { taskID },
          metadata() {},
        })
      },
    }),
    requirements: tool({
      description:
        "Requirements typed-adapter executor for one exact projected agent. It parses the user's task into REQ-N requirements plus " +
        "foundational technical decisions (runtime, framework, test strategy, " +
        "package_manager, communication_protocol). Delivery Slice decomposition, acceptance_specs, " +
        "requirement-derived Slice acceptance coverage, source/reference coverage, and cross-Slice contracts are outside " +
        "this adapter output. A successful run persists its exact spec facts for projected consumers. " +
        "The active expert-squad scheduler decides whether and when to invoke or reinvoke this adapter; " +
        "the adapter does not choose a successor, infer team membership, or define a workflow order.",
      inputSchema: RequirementsInputSchema,
      execute: async ({ reason, attachment_refs }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const task = requireTask(taskID)
        const dispatch = await dispatchRequirementsStage({
          task,
          reason,
          attachmentRefs: attachment_refs,
          ...stageDispatchBinding(execution),
        })
        return dispatch
      },
    }),

    // -----------------------------------------------------------------------
    // Frontend Design typed-adapter executor.
    // -----------------------------------------------------------------------

    ...createFrontendDesignTool({
      inputSchema: FrontendDesignInputSchema,
      taskID,
      parentSessionID: input.agentSessionID,
      signal: input.signal,
      requireCurrentTaskAndAgentSessionLineage,
    }),

    // -----------------------------------------------------------------------
    // Architect typed-adapter executor.
    // -----------------------------------------------------------------------

    architect: tool({
      description:
        "Architect typed-adapter executor for one exact projected agent. The consumer searches the same-Task Artifact catalog, completely reads the exact RequirementSet and evidence versions it uses, " +
        "then registers a ContractGraph and Goals with verified RequirementSet references, source/reference coverage, and cross-goal contracts. " +
        "No scheduler-selected Artifact locator or semantic body crosses the dispatch boundary. Missing optional evidence remains visible specialist input rather than a Host admission failure. " +
        "The single Task-scoped Architect occurrence keeps missing and contradictory facts visible to the specialist. " +
        "The adapter does not choose its predecessor, implementation consumer, reviewer, or next dispatch; those decisions belong to the active expert-squad scheduler.",
      inputSchema: ArchitectInputSchema,
      execute: async (input, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const task = requireTask(taskID)
        const dispatch = await dispatchArchitectStage({
          task,
          reason: architectDispatchReason(input),
          ...stageDispatchBinding(execution),
          attachmentRefs: input.attachment_refs,
        })
        return dispatch
      },
    }),

    // -----------------------------------------------------------------------
    // Goal Workload Analyst typed-adapter executor.
    //
    // It receives exact Delivery Slice revision refs as evidence subjects,
    // discovers and selects its own Artifact
    // sources through the Task catalog, and produces a
    // compact per-Slice brief: countable work
    // surface + why_not_smaller + underestimation_traps + verification_inventory
    // + a decomposition_concern when a Slice is too broad or under-specified
    // as a delivery contract. It only references existing surfaces/contracts by
    // id and never changes the graph. The brief is
    // persisted as one immutable `goal_workload` artifact bound to the exact
    // consumer-selected source Artifact refs. The active package decides
    // which projected consumers use concern findings and the resulting brief.
    // -----------------------------------------------------------------------

    ...createWorkloadAnalysisTool({
      inputSchema: WorkloadAnalysisInputSchema,
      taskID,
      agentSessionID: input.agentSessionID,
      signal: input.signal,
    }),

    // -----------------------------------------------------------------------
    // Visual QA — frontend GUI product review evidence
    // -----------------------------------------------------------------------

    visual_qa: tool({
      description:
        "Dedicated frontend visual GUI and functional product review agent. GUI means Graphical User Interface. " +
        "It can perform screenshot comparison, screen-by-screen desktop screenshots, explicitly requested non-desktop screenshots, " +
        "interaction-state checks, console/network review, and evidence-backed localization of visual or functional defects. " +
        "It consumes scheduler-provided task facts and references and reviews coarse-to-fine: component truth and visible functionality first, layout/composition second, micro-style polish last. " +
        "It reviews from a picky professional design QA perspective, lists production_blockers when the product cannot generate or ship, and does not use visual scores, one-shot whole-page screenshots, or judge verdicts as the verdict. " +
        "Its blocking product findings are same-Task repair evidence only after every required workflow node and the initial package Build occurrence have terminal-success evidence; advisory-only findings remain residual-risk evidence and do not dispatch Build or fail the Task. The scheduler inspects immutable dispatch lineage and dispatches the exact package-owned Build or final-delivery owner only when no Phase-closure occurrence exists. A closure reads the existing canonical Build Artifact and does not publish a parallel copy. Moving HEAD, extra commits, and commit count mismatch require repository/runtime inspection and are not product failures by themselves. " +
        "It may use skills and task-scoped browser_preview evidence, but it is review-only and does not edit files or run shell repair commands. " +
        "It does NOT acquire new source evidence and is NOT the final acceptance authority. " +
        "The active expert-squad scheduler decides when to invoke this adapter and which projected consumers use its evidence.",
      inputSchema: VisualQaInputSchema,
      execute: async ({ reason, focus, app_url, preview_command, goal_ids }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const task = requireTask(taskID)
        const dispatch = await dispatchVisualQaStage({
          task,
          reason,
          focus,
          appUrl: app_url,
          previewCommand: preview_command,
          ...stageDispatchBinding(execution),
          goalIDs: goal_ids,
        })
        return dispatch
      },
    }),

    // -----------------------------------------------------------------------
    // Integrity review adapter. It reads persisted task evidence, records
    // incremental IntegrityReview facts, and never rewrites requirements or goals.
    // -----------------------------------------------------------------------

    integrity: createIntegrityTool({
      inputSchema: IntegrityInputSchema,
      requireExecutionContext: (executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        return {
          ...requireOrchestratorToolExecutionContext(execution.toolOptions, "integrity"),
          agentID: execution.agentID,
          packageRevision: execution.projectedAgent.packageRevision,
          workScope: execution.workScope,
          dispatch: execution.dispatch,
          newSessionID: execution.newSessionID,
          existingSessionID: execution.existingSessionID,
          continuationPrompt: dispatchAdapterContinuationPrompt(execution),
          dispatchTurn: execution.dispatch.turn,
        }
      },
      runReview: runIntegrityReview,
    }),

    // -----------------------------------------------------------------------
    // Fact-check — verifies factual claims registered by a worker agent's
    // visible final message or domain artifact. Specs: fact-check agent contract §4.3.
    //
    // Trigger rule (rule 13 — you, the orchestrator LLM, decide):
    //   You MAY call fact_check after the current task evidence is otherwise
    //   ready for completion when
    //   the upstream worker registered fact_check_items.length > 0
    //   OR the worker's narrative makes load-bearing factual claims about
    //   external systems.  The tool dedupes automatically across repeats;
    //   if the target session is still streaming, the tool will reject —
    //   retry after it finishes.
    // -----------------------------------------------------------------------

    fact_check: createFactCheckTool({
      inputSchema: FactCheckInputSchema,
      stageInputSchema: FactCheckStageInputSchema,
      taskID,
      orchestratorSessionID: input.agentSessionID,
      signal: input.signal,
      requireTask: () => requireTask(taskID),
      resolveTargetScope: resolveFactCheckTargetScope,
    }),

    // -----------------------------------------------------------------------
    // Analyze intent adapter — request disambiguation when the active package
    // projects a worker for this capability. Scheduling order remains owned by
    // the active package and the Orchestrator's current evidence.
    // -----------------------------------------------------------------------

    ...createAnalyzeIntentTool({
      inputSchema: AnalyzeIntentInputSchema,
      taskID,
      agentSessionID: input.agentSessionID,
      signal: input.signal,
      requireTask: () => requireTask(taskID),
    }),

    frontend_research: tool({
      description:
        "OPTIONAL interface investigation publisher. Pass the complete authorized HTTP(S) source set for the single Task workflow occurrence; the active expert-squad projection decides how its dynamic worker acquires and partitions evidence through visible tools. Persist one structured brief Artifact built from small update_* result tools, not a giant terminal payload. Additional independent URLs, focus, viewport, interaction state, component, region, fidelity risk, or missing-detail questions do not authorize another occurrence of an already-dispatched frontend_research node. Consume existing frontend_research and frontend_design Artifacts through exact catalog locators. It does not own the frontend implementation template, route selection, implementation, or final acceptance; projected consumers use its Artifact only when their declared contracts require it.",
      inputSchema: FrontendResearchInputSchema,
      execute: async ({ reason, source_urls, focus, goal_ids }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const task = requireTask(taskID)
        const dispatch = await dispatchFrontendResearchStage({
          task,
          reason,
          sourceUrls: source_urls,
          focus,
          deliverySliceRevisionIDs: goal_ids,
          ...stageDispatchBinding(execution),
        })
        return dispatch
      },
    }),

    deep_research: tool({
      description:
        "OPTIONAL deep evidence agent. Use when the task depends on multi-source external facts, current documentation, competitor/industry/API research, source maps, or PRD/SPEC/report source material that should become a durable citation bundle. For supplied URLs that need functional/visual frontend analysis, `frontend_research` is a separate capability; for implementation-template/source evidence, `frontend_design` is a separate capability. The result is a compact research_brief Artifact plus bundle paths and may include subpage_research_tasks for independent follow-up deep research. It does not select routes or replace requirements, architecture, implementation, or acceptance evidence.",
      inputSchema: DeepResearchInputSchema,
      execute: async ({ reason, target_deliverable, source_urls, focus }, executionInput) => {
        const execution = requireDispatchAdapterExecutionContext(executionInput)
        const task = requireTask(taskID)
        const dispatch = await dispatchDeepResearchStage({
          task,
          reason,
          targetDeliverable: target_deliverable,
          sourceUrls: source_urls,
          focus,
          ...stageDispatchBinding(execution),
        })
        return dispatch
      },
    }),

    ...createExploreTool({
      taskID,
      agentSessionID: input.agentSessionID,
      signal: input.signal,
      requireCurrentTaskAndAgentSessionLineage,
    }),

    ...createDelegatedWorkerTool({
      taskID,
      agentSessionID: input.agentSessionID,
      signal: input.signal,
      requireCurrentTaskAndAgentSessionLineage,
    }),

    // -----------------------------------------------------------------------
    // Delivery Slice contract tools — Orchestrator decides when to call each
    // -----------------------------------------------------------------------

    ...createTaskLifecycleTools({
      taskID,
      workflowProjection: workflowProjectionFromProjectedAgents(input.dispatchAgents),
      requireExecutionContext: (options, toolName) =>
        requireTaskOrchestratorToolExecutionContext(options, toolName, {
          taskID,
          agentSessionID: input.agentSessionID,
        }),
    }),

    ...createOrchestratorInteractionTools({
      taskID,
      agentSessionID: input.agentSessionID,
      allowedRootMessages: authorizedTaskRootMessagesForWake(input),
    }),

    ...createDeliverySliceContractTools({
      taskID,
      agentSessionID: input.agentSessionID,
    }),

    ...createSubagentCancellationTool({
      taskID,
      assertDirectReplySessionLineage,
    }),

    ...createReadContextTool({ taskID }),
    ...createReadAgentMessageTool({ taskID }),
    ...createNoActionTool({ activeAcceptanceGapID: activeAcceptanceRepair?.revision.gap.gap_id }),

    respond_agent_coordination: bindToolExecutionMode(
      tool({
        description:
          "Answer one pending worker/operator-to-orchestrator coordination request. This is the only orchestrator path for scheduler guidance that continues/cancels a worker, asks the user through a real interaction, fails the task through a terminal lifecycle event, or acknowledges an exact terminal occurrence during a host-authorized terminal conversation; it requires request_id and writes visible request/response/action artifacts before executing the bound side effect.",
        inputSchema: z
          .object({
            request_id: z.string().min(1).describe("Pending agent_coordination_request artifact id."),
            decision: (input.terminalConversationAuthority
              ? z.enum(AGENT_COORDINATION_DECISIONS)
              : z.enum(AGENT_COORDINATION_ACTIVE_DECISIONS)
            ).describe(
              input.terminalConversationAuthority
                ? "redispatch records the only continuation authority and must be followed by dispatch_agent using turn.kind=continuation and the returned coordination action authority; cancel_worker aborts a real requesting worker Runtime; ask_user opens a real task interaction; fail_task is an exceptional force-majeure stop that makes the Task inactive and is never a normal business outcome. acknowledge_terminal is valid only for the exact host-authorized terminal conversation."
                : "redispatch records the only continuation authority and must be followed by dispatch_agent using turn.kind=continuation and the returned coordination action authority; cancel_worker aborts a real requesting worker Runtime; ask_user opens a real task interaction; fail_task is an exceptional force-majeure stop that makes the Task inactive and is never a normal business outcome.",
            ) as z.ZodType<AgentCoordinationDecision>,
            message: z
              .string()
              .optional()
              .describe(
                "Visible incremental guidance for redispatch, question text for ask_user when questions is omitted, or failure detail for fail_task.",
              ),
            questions: z
              .array(
                z.object({
                  question: z.string().min(1).describe("The complete question text to show the user."),
                  header: z.string().min(1).describe("Short label used as a chip/title."),
                  options: z
                    .array(
                      z.object({
                        value: z.string().min(1).describe("Stable machine-facing value returned when selected."),
                        label: z.string().min(1).describe("Display text."),
                        description: z.string().min(1).describe("Explanation of this choice."),
                      }),
                    )
                    .default([]),
                  multiple: z.boolean().optional(),
                  custom: z.boolean().optional(),
                }),
              )
              .min(1)
              .max(4)
              .optional()
              .describe(
                "Concrete user questions for decision=ask_user. Omit to ask one free-text question from message or reason.",
              ),
            reason: z.string().min(1).describe("Why this is the correct scheduling decision."),
          })
          .strict(),
        execute: async ({ request_id, decision, message, questions, reason }, options) => {
          const toolExecution = await requireTaskOrchestratorToolExecutionContext(
            options,
            "respond_agent_coordination",
            {
              taskID,
              agentSessionID: input.agentSessionID,
            },
          )
          const responseAudit = {
            orchestratorSessionID: toolExecution.orchestratorSessionID,
            orchestratorMessageID: toolExecution.orchestratorMessageID,
            orchestratorToolCallID: toolExecution.toolCallID,
            orchestratorToolPartID: toolExecution.toolPartID,
          }
          const request = requireAgentCoordinationRequestForResponse({ taskID, requestID: request_id })
          await assertAgentCoordinationRequestSessionLineage({
            taskID,
            sessionID: request.payload.session_id,
          })
          const guidance = message?.trim()
          if (decision === "acknowledge_terminal") {
            const authority = input.terminalConversationAuthority
            if (
              !authority ||
              authority.ingressKind !== "coordination_request" ||
              authority.coordinationRequestID !== request.payload.request_id
            ) {
              throw new Error(
                `Agent coordination request ${request.payload.request_id} has no matching terminal conversation authority`,
              )
            }
            const currentReference = requireCurrentTerminalLifecycleReference(taskID)
            if (!sameTerminalLifecycleReference(currentReference, authority.terminalLifecycleReference)) {
              throw new Error(
                `Agent coordination request ${request.payload.request_id} terminal occurrence changed before acknowledgement`,
              )
            }
            const response = await createAgentCoordinationResponse({
              taskID,
              requestID: request.payload.request_id,
              ...responseAudit,
              decision,
              reason,
              ...(guidance ? { message: guidance } : {}),
            })
            const replayResult = replayedAgentCoordinationActionResult({ taskID, response })
            if (replayResult) return replayResult
            await completeAgentCoordinationAction({
              taskID,
              actionID: response.payload.action_id,
              result: {
                terminal_lifecycle_reference: currentReference,
                terminal_ingress_id: authority.ingressID,
                ...(authority.completionDecisionArtifactID
                  ? { completion_decision_artifact_id: authority.completionDecisionArtifactID }
                  : {}),
              },
              summary: `acknowledged terminal event ${currentReference.terminalEventID}`,
            })
            return (
              `Acknowledged coordination request ${request.payload.request_id} against terminal event ` +
              `${currentReference.terminalEventID}; response=${response.payload.response_id}; ` +
              `action=${response.payload.action_id}.`
            )
          }
          if (request.payload.status === "responded") {
            const response = await createAgentCoordinationResponse({
              taskID,
              requestID: request.payload.request_id,
              ...responseAudit,
              decision,
              reason,
              ...(guidance ? { message: guidance } : {}),
            })
            const replayResult = replayedAgentCoordinationActionResult({ taskID, response })
            if (replayResult) {
              if (decision !== "fail_task") return replayResult
              return {
                title: "Task Failure Replayed",
                output: replayResult,
                metadata: withImmediateParkToolResultControl({}),
              }
            }
          }

          if (decision === "redispatch") {
            const workScope = requireAgentCoordinationWorkerWorkScope({
              request,
              binding: request.payload.worker_binding,
            })
            const activeAgent = input.dispatchAgents.find(
              (candidate) => candidate.identity.agentID === request.payload.worker_binding.identity.agentID,
            )
            if (!activeAgent) {
              throw new Error(
                `respond_agent_coordination redispatch agent ${request.payload.worker_binding.identity.agentID} is absent from the current projection`,
              )
            }
            assertProjectedWorkerContinuationCompatible({
              previous: request.payload.worker_binding.identity,
              current: activeAgent.identity,
              subject: `respond_agent_coordination redispatch agent ${activeAgent.identity.agentID}`,
            })
            const response = await createAgentCoordinationResponse({
              taskID,
              requestID: request.payload.request_id,
              ...responseAudit,
              decision,
              reason,
              ...(guidance ? { message: guidance } : {}),
            })
            const replayResult = replayedAgentCoordinationActionResult({ taskID, response })
            if (replayResult) return replayResult
            const action = findAgentCoordinationAction({ taskID, actionID: response.payload.action_id })
            if (!action || action.payload.status !== "pending") {
              throw new Error(
                `agent coordination redispatch action ${response.payload.action_id} is ${action?.payload.status ?? "missing"}`,
              )
            }
            const binding = redispatchBindingFromActionResult({
              actionID: action.payload.action_id,
              result: action.payload.result ?? {},
            })
            await recordAgentCoordinationActionProgress({
              taskID,
              actionID: response.payload.action_id,
              result: {
                ...projectedCoordinationActionIdentity(binding),
                redispatch_binding: binding,
                source_session_id: request.payload.session_id,
                work_scope: workScope,
                awaiting_explicit_dispatch: true,
              },
              summary: projectedCoordinationActionSummary(binding, "recorded pending explicit dispatch"),
            })
            return (
              `Responded to coordination request ${request.payload.request_id} with a pending redispatch action. ` +
              `response=${response.payload.response_id}; action=${response.payload.action_id}; ` +
              `call dispatch_agent with dispatch.target=${binding.identity.agentID}, dispatch.turn.kind=continuation, and dispatch.turn.authority.coordination_action_id=${response.payload.action_id} explicitly.`
            )
          }
          if (decision === "cancel_worker") {
            const { session } = await assertAgentCoordinationRequestSessionLineage({
              taskID,
              sessionID: request.payload.session_id,
            })
            const kind = session.kind
            if (request.payload.worker_binding.identity.sessionKind !== kind) {
              throw new Error(
                `agent coordination cancellation session kind mismatch: session=${kind}, binding=${request.payload.worker_binding.identity.sessionKind}`,
              )
            }
            requireAgentCoordinationWorkerWorkScope({
              request,
              binding: request.payload.worker_binding,
            })
            const installedRuntimeContract = SessionRuntimeContractStore.get(request.payload.session_id)
            const runtimeContract = installedRuntimeContract
              ? requireInstalledAgentCoordinationWorkerBinding({
                  sessionID: request.payload.session_id,
                  binding: request.payload.worker_binding,
                }).runtimeContract
              : undefined
            using _cancelWorkerRuntimeOwnership = runtimeContract
              ? SessionRuntimeContractStore.claimOperation(
                  request.payload.session_id,
                  runtimeContract,
                  "agent coordination worker cancellation",
                )
              : undefined
            const response = await createAgentCoordinationResponse({
              taskID,
              requestID: request.payload.request_id,
              ...responseAudit,
              decision,
              reason,
              ...(guidance ? { message: guidance } : {}),
            })
            const replayResult = replayedAgentCoordinationActionResult({ taskID, response })
            if (replayResult) return replayResult
            const action = findAgentCoordinationAction({
              taskID,
              actionID: response.payload.action_id,
            })
            if (!action) {
              throw new Error(`agent coordination response ${response.payload.response_id} has no action row`)
            }
            if (action.payload.status !== "pending") {
              throw new Error(`agent coordination action ${response.payload.action_id} is ${action.payload.status}`)
            }
            let cancellation: Awaited<ReturnType<typeof cancelDispatchedSession>> | undefined
            try {
              cancellation = await cancelDispatchedSession({
                taskID,
                sessionID: request.payload.session_id,
                reason,
                reasonPrefix: "respond_agent_coordination",
                requestID: response.payload.action_id,
              })
              await recordAgentCoordinationActionProgress({
                taskID,
                actionID: response.payload.action_id,
                result: {
                  session_id: request.payload.session_id,
                  kind,
                  physical_cancelled: cancellation.cancelled,
                  prompt_cancelled: cancellation.promptCancelled,
                },
                summary: cancellation.promptCancelled
                  ? "cancel_worker physical prompt cancelled and settled"
                  : "cancel_worker found no current physical prompt resource",
              })
            } catch (error) {
              await failAgentCoordinationAction({
                taskID,
                actionID: response.payload.action_id,
                error,
                result: { session_id: request.payload.session_id, kind },
                summary: "cancel_worker failed",
              })
              throw error
            }
            await completeAgentCoordinationAction({
              taskID,
              actionID: response.payload.action_id,
              result: {
                session_id: request.payload.session_id,
                kind,
                physical_cancelled: cancellation.cancelled,
                prompt_cancelled: cancellation.promptCancelled,
                summary: cancellation.summary,
              },
              summary: "cancel_worker completed",
            })
            return (
              `Responded to coordination request ${request.payload.request_id} with cancel_worker. ` +
              `response=${response.payload.response_id}; action=${response.payload.action_id}; session=${request.payload.session_id}; kind=${kind}.` +
              cancellation.summary
            )
          }

          if (decision === "ask_user") {
            const response = await createAgentCoordinationResponse({
              taskID,
              requestID: request.payload.request_id,
              ...responseAudit,
              decision,
              reason,
              ...(guidance ? { message: guidance } : {}),
            })
            const replayResult = replayedAgentCoordinationActionResult({ taskID, response })
            if (replayResult) return replayResult
            const action = findAgentCoordinationAction({
              taskID,
              actionID: response.payload.action_id,
            })
            if (!action) {
              throw new Error(`agent coordination response ${response.payload.response_id} has no action row`)
            }
            if (action.payload.status !== "pending") {
              throw new Error(`agent coordination action ${response.payload.action_id} is ${action.payload.status}`)
            }
            const questionItems = questions?.length
              ? questions.map((question) => ({
                  question: question.question,
                  header: question.header,
                  options: question.options ?? [],
                  multiple: question.multiple,
                  custom: question.custom,
                }))
              : [
                  {
                    question:
                      guidance && guidance.length > 0
                        ? guidance
                        : `${reason.trim()}\n\nWorker request: ${request.payload.summary}\n${request.payload.details}`,
                    header: "A2A question",
                    options: [],
                    custom: true,
                  },
                ]
            const questionID = agentCoordinationQuestionID(response.payload.action_id)
            const questionToolBinding = {
              messageID: toolExecution.orchestratorMessageID,
              callID: toolExecution.toolCallID,
            }
            let interaction = findInteractionByExternal(questionID)
            let interactionContract = interaction
              ? requireAgentCoordinationQuestionInteraction({
                  action,
                  actionID: response.payload.action_id,
                  taskID,
                  sessionID: input.agentSessionID,
                  questions: questionItems,
                  tool: questionToolBinding,
                  interaction,
                })
              : undefined
            if (interaction && interaction.status !== "pending") {
              if (interaction.status === "answered") {
                const answers = answersFromInteraction(interaction)
                await completeAgentCoordinationAction({
                  taskID,
                  actionID: response.payload.action_id,
                  result: {
                    question_id: questionID,
                    interaction_id: interaction.id,
                    interaction_status: interaction.status,
                    answers,
                    recovered: true,
                  },
                  summary: "ask_user interaction recovered answered",
                })
                const renderedAnswers = questionItems
                  .map(
                    (question, index) =>
                      `"${question.question}" -> ${(answers[index] ?? []).join(", ") || "(no answer)"}`,
                  )
                  .join("\n")
                return (
                  `Responded to coordination request ${request.payload.request_id} with ask_user. ` +
                  `response=${response.payload.response_id}; action=${response.payload.action_id}; ` +
                  `interaction=${interaction.id}; question=${questionID} recovered as answered.\nUser answered:\n${renderedAnswers}`
                )
              }
              if (interaction.status === "expired") {
                const expiry = expiryFromInteraction(interaction)
                await completeAgentCoordinationAction({
                  taskID,
                  actionID: response.payload.action_id,
                  result: {
                    question_id: questionID,
                    interaction_id: interaction.id,
                    interaction_status: "expired",
                    time_expires: expiry.timeExpires,
                    time_resolved: expiry.timeResolved,
                    recovered: true,
                  },
                  summary: "ask_user interaction recovered expired",
                })
                return (
                  `Responded to coordination request ${request.payload.request_id} with ask_user. ` +
                  `response=${response.payload.response_id}; action=${response.payload.action_id}; ` +
                  `interaction=${interaction.id}; question=${questionID} recovered as expired; ` +
                  "the automatic deadline elapsed without an operator decision."
                )
              }
              operatorRejectionFromInteraction(interaction)
              await completeAgentCoordinationAction({
                taskID,
                actionID: response.payload.action_id,
                result: {
                  question_id: questionID,
                  interaction_id: interaction.id,
                  interaction_status: interaction.status,
                  rejected: true,
                  recovered: true,
                },
                summary: "ask_user interaction recovered rejected",
              })
              return (
                `Responded to coordination request ${request.payload.request_id} with ask_user. ` +
                `response=${response.payload.response_id}; action=${response.payload.action_id}; ` +
                `interaction=${interaction.id}; question=${questionID} recovered as ${interaction.status}.`
              )
            }
            let questionPromise: Promise<Question.Answer[]> | undefined
            let setupCompleted = false
            try {
              questionPromise = Question.ask({
                sessionID: input.agentSessionID,
                requestID: questionID,
                questions: questionItems,
                tool: questionToolBinding,
                ...(interactionContract
                  ? {
                      expiry: interactionContract.payload.expiry ?? null,
                      timeCreated: interactionContract.interaction.time_created,
                    }
                  : { expireOnDeadline: (await Config.get()).experimental?.auto_question === true }),
              })
              interaction = interaction ?? (await waitForQuestionInteraction({ questionID, taskID }))
              interactionContract = requireAgentCoordinationQuestionInteraction({
                action,
                actionID: response.payload.action_id,
                taskID,
                sessionID: input.agentSessionID,
                questions: questionItems,
                tool: questionToolBinding,
                interaction,
              })
              if (recordedAgentCoordinationQuestionID(action) !== questionID) {
                await recordAgentCoordinationActionProgress({
                  taskID,
                  actionID: response.payload.action_id,
                  result: {
                    question_id: questionID,
                    interaction_id: interaction.id,
                    interaction_status: interaction.status,
                  },
                  summary: "ask_user interaction opened",
                })
              }
              setupCompleted = true
              try {
                const answers = await questionPromise
                const resolvedInteraction = await waitForQuestionInteraction({ questionID, taskID, resolved: true })
                requireAgentCoordinationQuestionInteraction({
                  action,
                  actionID: response.payload.action_id,
                  taskID,
                  sessionID: input.agentSessionID,
                  questions: questionItems,
                  tool: questionToolBinding,
                  interaction: resolvedInteraction,
                })
                if (resolvedInteraction.status !== "answered") {
                  throw new Error(
                    `A2A ask_user interaction ${resolvedInteraction.id} resolved as ${resolvedInteraction.status}, expected answered`,
                  )
                }
                const durableAnswers = answersFromInteraction(resolvedInteraction)
                if (JSON.stringify(durableAnswers) !== JSON.stringify(answers)) {
                  throw new Error(`A2A ask_user interaction ${resolvedInteraction.id} changed the answered payload`)
                }
                await completeAgentCoordinationAction({
                  taskID,
                  actionID: response.payload.action_id,
                  result: {
                    question_id: questionID,
                    interaction_id: interaction!.id,
                    interaction_status: resolvedInteraction.status,
                    answers,
                  },
                  summary: "ask_user interaction answered",
                })
                const renderedAnswers = questionItems
                  .map(
                    (question, index) =>
                      `"${question.question}" -> ${(answers[index] ?? []).join(", ") || "(no answer)"}`,
                  )
                  .join("\n")
                return (
                  `Responded to coordination request ${request.payload.request_id} with ask_user. ` +
                  `response=${response.payload.response_id}; action=${response.payload.action_id}; ` +
                  `interaction=${interaction!.id}; question=${questionID}.\nUser answered:\n${renderedAnswers}`
                )
              } catch (error) {
                if (error instanceof Question.ExpiredError) {
                  const resolvedInteraction = await waitForQuestionInteraction({ questionID, taskID, resolved: true })
                  requireAgentCoordinationQuestionInteraction({
                    action,
                    actionID: response.payload.action_id,
                    taskID,
                    sessionID: input.agentSessionID,
                    questions: questionItems,
                    tool: questionToolBinding,
                    interaction: resolvedInteraction,
                  })
                  if (resolvedInteraction.status !== "expired") {
                    throw new Error(
                      `A2A ask_user interaction ${resolvedInteraction.id} resolved as ${resolvedInteraction.status}, expected expired`,
                    )
                  }
                  const durableExpiry = expiryFromInteraction(resolvedInteraction)
                  if (
                    durableExpiry.timeExpires !== error.timeExpires ||
                    durableExpiry.timeResolved !== error.timeResolved
                  ) {
                    throw new Error(`A2A ask_user interaction ${resolvedInteraction.id} changed the expiry occurrence`)
                  }
                  await completeAgentCoordinationAction({
                    taskID,
                    actionID: response.payload.action_id,
                    result: {
                      question_id: questionID,
                      interaction_id: interaction!.id,
                      interaction_status: resolvedInteraction.status,
                      time_expires: error.timeExpires,
                      time_resolved: error.timeResolved,
                    },
                    summary: "ask_user interaction expired at its automatic deadline",
                  })
                  return (
                    `Responded to coordination request ${request.payload.request_id} with ask_user. ` +
                    `response=${response.payload.response_id}; action=${response.payload.action_id}; ` +
                    `interaction=${interaction!.id}; question=${questionID}; automatic deadline elapsed without an operator decision. ` +
                    "Choose a concrete same-Task repair action or an explicitly named wait from the available evidence."
                  )
                }
                if (error instanceof Question.RejectedError) {
                  const resolvedInteraction = await waitForQuestionInteraction({ questionID, taskID, resolved: true })
                  requireAgentCoordinationQuestionInteraction({
                    action,
                    actionID: response.payload.action_id,
                    taskID,
                    sessionID: input.agentSessionID,
                    questions: questionItems,
                    tool: questionToolBinding,
                    interaction: resolvedInteraction,
                  })
                  if (resolvedInteraction.status !== "rejected") {
                    throw new Error(
                      `A2A ask_user interaction ${resolvedInteraction.id} resolved as ${resolvedInteraction.status}, expected rejected`,
                    )
                  }
                  operatorRejectionFromInteraction(resolvedInteraction)
                  const durableTimeResolved = z.number().int().positive().parse(resolvedInteraction.time_resolved)
                  if (error.timeResolved !== durableTimeResolved) {
                    throw new Error(
                      `A2A ask_user interaction ${resolvedInteraction.id} changed the rejection occurrence`,
                    )
                  }
                  await completeAgentCoordinationAction({
                    taskID,
                    actionID: response.payload.action_id,
                    result: {
                      question_id: questionID,
                      interaction_id: interaction!.id,
                      interaction_status: resolvedInteraction.status,
                      rejected: true,
                    },
                    summary: "ask_user interaction rejected",
                  })
                  return (
                    `Responded to coordination request ${request.payload.request_id} with ask_user. ` +
                    `response=${response.payload.response_id}; action=${response.payload.action_id}; ` +
                    `interaction=${interaction!.id}; question=${questionID}; user rejected the question.`
                  )
                }
                await failAgentCoordinationAction({
                  taskID,
                  actionID: response.payload.action_id,
                  error,
                  result: { question_id: questionID, ...(interaction ? { interaction_id: interaction.id } : {}) },
                  summary: "ask_user interaction failed",
                })
                throw error
              }
            } catch (error) {
              if (setupCompleted) throw error
              await Question.abandon({ requestID: questionID, error }).catch((abandoned) => {
                if (NotFoundError.isInstance(abandoned as Error)) return
                throw abandoned
              })
              if (questionPromise) {
                await questionPromise.catch((abandoned) => {
                  if (abandoned === error) return
                  throw abandoned
                })
              }
              await failAgentCoordinationAction({
                taskID,
                actionID: response.payload.action_id,
                error,
                result: { question_id: questionID },
                summary: "ask_user setup failed",
              })
              throw error
            }
          }

          if (decision === "fail_task") {
            const response = await createAgentCoordinationResponse({
              taskID,
              requestID: request.payload.request_id,
              ...responseAudit,
              decision,
              reason,
              ...(guidance ? { message: guidance } : {}),
            })
            const replayResult = replayedAgentCoordinationActionResult({ taskID, response })
            if (replayResult) {
              return {
                title: "Task Failure Replayed",
                output: replayResult,
                metadata: withImmediateParkToolResultControl({}),
              }
            }
            const errorText = guidance && guidance.length > 0 ? guidance : reason
            const errorMessage = `A2A request ${request.payload.request_id}: ${errorText}`
            try {
              const requestDescriptor = WorkerTurnDescriptor.get({
                id: request.payload.worker_binding.workerTurnDescriptorID,
                sessionID: request.payload.session_id,
              })
              if (
                !requestDescriptor ||
                requestDescriptor.hash !== request.payload.worker_binding.workerTurnDescriptorHash
              ) {
                throw new Error(
                  `A2A request ${request.payload.request_id} has no exact Worker Turn descriptor authority`,
                )
              }
              await publishFailedAgentCoordinationTurnStatus({
                taskID,
                sessionID: request.payload.session_id,
                inputMessageID: requestDescriptor.payload.messageAuthority.user_message_id,
                status: { type: "terminal", reason: "error", error: errorMessage },
              })
              const { recoveredTerminalFailure } = await failTaskLifecycle({
                taskID,
                error: errorMessage,
                a2aRequestID: request.payload.request_id,
              })
              await completeAgentCoordinationAction({
                taskID,
                actionID: response.payload.action_id,
                result: {
                  task_id: taskID,
                  task_status: "failed",
                  recovered_terminal_failure: recoveredTerminalFailure,
                },
                summary: "fail_task completed",
              })
              return {
                title: "Task Failed",
                output:
                  `Responded to coordination request ${request.payload.request_id} with fail_task. ` +
                  `response=${response.payload.response_id}; action=${response.payload.action_id}; task=${taskID} failed.` +
                  `${recoveredTerminalFailure ? " Recovered existing terminal task failure." : ""}`,
                metadata: withImmediateParkToolResultControl({}),
              }
            } catch (error) {
              await failAgentCoordinationAction({
                taskID,
                actionID: response.payload.action_id,
                error,
                result: { task_id: taskID },
                summary: "fail_task failed",
              })
              throw error
            }
          }
        },
      }),
      "turn_control_exclusive",
    ),

    ...createBuildTool({
      inputSchema: BuildInputSchema,
      taskID,
      parentSessionID: input.agentSessionID,
      signal: input.signal,
      buildAgentContextSections,
    }),

    ...createRuntimeRepairTools({
      taskID,
      agentSessionID: input.agentSessionID,
      signal: input.signal,
      requireExecutionContext: requireOrchestratorToolExecutionContext,
    }),
  }

  const dispatchAdapterExecutor = (
    adapterID: AgentDispatchAdapterID,
    definition: { execute?: (...args: any[]) => unknown },
  ): DispatchAgentExecute => {
    const execute = definition.execute
    if (typeof execute !== "function") {
      throw new Error(`Dispatch adapter ${adapterID} has no internal executor`)
    }
    return async (args, context) => DispatchOutcomeSchema.parse(await execute(args, context))
  }
  const dispatchAdapterExecutors = bindDispatchAdapterExecutors({
    delegated_worker: dispatchAdapterExecutor("delegated_worker", tools.delegated_worker),
    requirements: dispatchAdapterExecutor("requirements", tools.requirements),
    architect: dispatchAdapterExecutor("architect", tools.architect),
    frontend_design: dispatchAdapterExecutor("frontend_design", tools.frontend_design),
    frontend_research: dispatchAdapterExecutor("frontend_research", tools.frontend_research),
    deep_research: dispatchAdapterExecutor("deep_research", tools.deep_research),
    visual_qa: dispatchAdapterExecutor("visual_qa", tools.visual_qa),
    workload_analysis: dispatchAdapterExecutor("workload_analysis", tools.workload_analysis),
    analyze_intent: dispatchAdapterExecutor("analyze_intent", tools.analyze_intent),
    fact_check: dispatchAdapterExecutor("fact_check", tools.fact_check),
    build: dispatchAdapterExecutor("build", tools.build),
    explore: dispatchAdapterExecutor("explore", tools.explore),
    integrity: dispatchAdapterExecutor("integrity", tools.integrity),
  })
  const dispatchAgentTool = createDispatchAgentTool({
    taskID,
    projectedAgents: input.dispatchAgents,
    executors: dispatchAdapterExecutors,
    signal: input.signal,
    ...(activeAcceptanceRepair ? { acceptanceRepair: activeAcceptanceRepair } : {}),
    runDetached: (run) =>
      runWithInitializedIndependentProject({
        directory: taskProjectDirectory,
        fn: run,
      }),
    runDetachedRecovery: (run) =>
      runWithIndependentProjectIdentity({
        directory: taskProjectDirectory,
        fn: run,
      }),
    runInWorktree: async ({ taskID: worktreeTaskID, sessionID, existingSessionID, targetAgentID, dispatchID, run }) => {
      const { Worktree } = await import("@/worktree")
      const { Instance } = await import("@/project/instance")
      if (existingSessionID) {
        const session = await Session.get(existingSessionID)
        log.info("dispatch_agent reused isolated worktree", {
          taskID: worktreeTaskID,
          targetAgentID,
          dispatchID,
          sessionID: existingSessionID,
          directory: session.directory,
        })
        return await Instance.provide({ directory: session.directory, fn: run })
      }
      const workspace = await Worktree.create({
        name: `dispatch-${dispatchID.slice(-12)}`,
        taskID: worktreeTaskID,
        sessionID,
      })
      log.info("dispatch_agent created isolated worktree", {
        taskID: worktreeTaskID,
        targetAgentID,
        dispatchID,
        directory: workspace.directory,
        branch: workspace.branch,
      })
      return await Instance.provide({ directory: workspace.directory, fn: run })
    },
    openLineage: (async ({
      taskID: ownershipTaskID,
      targetAgentID,
      projectedAgent,
      workScope,
      deliverySliceRevisionIDs,
      workflowBinding,
      workflowNodeID,
      coordinationActionID,
      continuationDispatchID,
      signal,
      toolOptions,
      adapterInput,
      continuationGuidance,
      evidenceLocators,
      acceptanceRepair,
    }) => {
      const toolExecution = await requireTaskOrchestratorToolExecutionContext(toolOptions, "dispatch_agent", {
        taskID: ownershipTaskID,
        agentSessionID: input.agentSessionID,
      })
      const replayLineage = findDispatchLineageByToolExecution({
        taskID: ownershipTaskID,
        toolPartID: toolExecution.toolPartID,
        toolCallID: toolExecution.toolCallID,
      })
      if (replayLineage) {
        if (
          replayLineage.payload.target_agent_id !== targetAgentID ||
          !isDeepStrictEqual(replayLineage.payload.work_scope, workScope)
        ) {
          throw new Error(
            `dispatch_agent exact tool occurrence ${toolExecution.toolPartID}/${toolExecution.toolCallID} input drift`,
          )
        }
        const descriptor = WorkerTurnDescriptor.findForDispatch({
          sessionID: replayLineage.payload.child_session_id,
          dispatchID: replayLineage.dispatchID,
        })
        const turn = descriptor?.payload.dispatchTurn
        if (!descriptor || !turn) {
          throw new Error(`dispatch_agent exact tool occurrence ${replayLineage.dispatchID} has no durable Turn`)
        }
        const settlement = findDispatchSettlementByDispatchID({
          taskID: ownershipTaskID,
          dispatchID: replayLineage.dispatchID,
        })
        const replayOutcome =
          settlement?.payload.outcome ??
          DispatchOutcome.accepted({
            sessionID: replayLineage.payload.child_session_id,
            dispatchLineageID: replayLineage.artifactID,
          })
        return {
          dispatchID: replayLineage.dispatchID,
          deliverySliceRevisionIDs: [...replayLineage.payload.delivery_slice_revision_ids],
          existingSessionID: replayLineage.payload.child_session_id,
          turn,
          adapterInput: Object.freeze({ ...replayLineage.payload.adapter_input }),
          replayOutcome,
          observeSession(sessionID: string) {
            if (sessionID !== replayLineage.payload.child_session_id) {
              throw new Error(`dispatch_agent replay Session identity drift for ${replayLineage.dispatchID}`)
            }
          },
          commitSession(sessionID: string) {
            if (sessionID !== replayLineage.payload.child_session_id) {
              throw new Error(`dispatch_agent replay Session identity drift for ${replayLineage.dispatchID}`)
            }
            return { artifactID: replayLineage.artifactID }
          },
        }
      }
      if (signal?.aborted) {
        throw new Error(`dispatch_agent ${targetAgentID} aborted before lineage preparation`)
      }
      let coordinationBinding: ReturnType<typeof requireAgentCoordinationRedispatchBindingForRequest> | undefined
      let coordinationSourceSessionID: string | undefined
      let exactWorkflowBinding = workflowBinding
      let exactWorkflowNodeID = workflowNodeID
      let exactWorkflowOccurrenceID: string | undefined
      let exactDeliverySliceRevisionIDs = deliverySliceRevisionIDs
      let existingSessionID: string | undefined
      let exactAdapterInput = { ...adapterInput }
      if (coordinationActionID) {
        const action = findAgentCoordinationAction({ taskID: ownershipTaskID, actionID: coordinationActionID })
        if (!action) throw new Error(`dispatch_agent coordination action ${coordinationActionID} does not exist`)
        if (action.payload.action !== "redispatch_worker" || action.payload.status !== "pending") {
          throw new Error(
            `dispatch_agent coordination action ${coordinationActionID} is ${action.payload.action}/${action.payload.status}, not pending redispatch_worker`,
          )
        }
        const request = findAgentCoordinationRequest({
          taskID: ownershipTaskID,
          requestID: action.payload.request_id,
        })
        if (!request) throw new Error(`dispatch_agent coordination action ${coordinationActionID} has no request`)
        coordinationSourceSessionID = request.payload.session_id
        coordinationBinding = requireAgentCoordinationRedispatchBindingForRequest({
          taskID: ownershipTaskID,
          request,
        })
        const expectedScope = requireAgentCoordinationWorkerWorkScope({ request, binding: coordinationBinding })
        assertProjectedWorkerContinuationCompatible({
          previous: coordinationBinding.identity,
          current: projectedAgent.identity,
          subject: `dispatch_agent coordination action ${coordinationActionID}`,
        })
        if (expectedScope.kind !== workScope.kind) {
          throw new Error(`dispatch_agent coordination action ${coordinationActionID} work scope does not match`)
        }
        const sourceLineage = findDispatchLineageByArtifactID({
          taskID: ownershipTaskID,
          artifactID: coordinationBinding.sourceDispatchLineageID,
        })
        if (
          !sourceLineage ||
          sourceLineage.dispatchID !== coordinationBinding.sourceDispatchID ||
          sourceLineage.payload.child_session_id !== request.payload.session_id ||
          sourceLineage.payload.workflow_node_id !== coordinationBinding.workflowNodeID ||
          sourceLineage.payload.workflow_occurrence_id !== coordinationBinding.workflowOccurrenceID ||
          !sameSelectedWorkflowBinding(sourceLineage.payload.workflow_binding, coordinationBinding.workflowBinding) ||
          JSON.stringify(sourceLineage.payload.delivery_slice_revision_ids) !==
            JSON.stringify(coordinationBinding.deliverySliceRevisionIDs)
        ) {
          throw new Error(
            `dispatch_agent coordination action ${coordinationActionID} source workflow occurrence does not match its immutable lineage binding`,
          )
        }
        exactWorkflowBinding = coordinationBinding.workflowBinding
        exactWorkflowNodeID = coordinationBinding.workflowNodeID
        exactWorkflowOccurrenceID = coordinationBinding.workflowOccurrenceID
        exactDeliverySliceRevisionIDs = coordinationBinding.deliverySliceRevisionIDs
        exactAdapterInput = { ...sourceLineage.payload.adapter_input }
        existingSessionID = coordinationSourceSessionID
      } else if (continuationDispatchID) {
        const sourceLineage = findDispatchLineageByDispatchID({
          taskID: ownershipTaskID,
          dispatchID: continuationDispatchID,
        })
        if (!sourceLineage) {
          // Name the exact continuable dispatches. Without them the caller can
          // only guess at an opaque identity it has already mistranscribed
          // once, and every retry repeats the same failure.
          const continuable = listDispatchLineage(ownershipTaskID)
            .filter((row) => row.payload.target_agent_id === targetAgentID)
            .map((row) => row.dispatchID)
          throw new Error(
            `dispatch_agent continuation source ${continuationDispatchID} does not exist in Task ${ownershipTaskID}. ` +
              (continuable.length
                ? `Exact continuable dispatch identities for ${targetAgentID}: ${continuable.join(", ")}.`
                : `Task ${ownershipTaskID} has no prior dispatch of ${targetAgentID} to continue; dispatch an initial Turn instead.`),
          )
        }
        assertProjectedWorkerContinuationCompatible({
          previous: sourceLineage.payload.projected_worker_identity,
          current: projectedAgent.identity,
          subject: `dispatch_agent continuation source ${continuationDispatchID}`,
        })
        if (JSON.stringify(sourceLineage.payload.work_scope) !== JSON.stringify(workScope)) {
          throw new Error(`dispatch_agent continuation source ${continuationDispatchID} work scope does not match`)
        }
        exactWorkflowBinding = sourceLineage.payload.workflow_binding
        exactWorkflowNodeID = sourceLineage.payload.workflow_node_id
        exactWorkflowOccurrenceID = sourceLineage.payload.workflow_occurrence_id
        exactDeliverySliceRevisionIDs = sourceLineage.payload.delivery_slice_revision_ids
        existingSessionID = sourceLineage.payload.child_session_id
        exactAdapterInput = { ...sourceLineage.payload.adapter_input }
      } else if (!exactWorkflowBinding || exactWorkflowNodeID === undefined) {
        throw new Error(`dispatch_agent ${targetAgentID} initial dispatch has no workflow binding`)
      }
      const sourceDispatchID = resolveDispatchContinuationSourceID({
        continuationDispatchID,
        coordinationSourceDispatchID: coordinationBinding?.sourceDispatchID,
      })
      let canonicalAcceptanceRepair: AcceptanceRepairDispatch | undefined
      let acceptanceEvidenceLocators: EvidenceLocator[] = []
      if (activeAcceptanceRepair) {
        if (!existingSessionID || !exactWorkflowNodeID || !acceptanceRepair) {
          throw new Error(
            `Acceptance gap ${activeAcceptanceRepair.revision.gap.gap_id} requires an existing workflow-node continuation.`,
          )
        }
        if (
          acceptanceRepair.gap_id !== activeAcceptanceRepair.revision.gap.gap_id ||
          acceptanceRepair.ledger_revision_artifact_id !== activeAcceptanceRepair.artifactID ||
          acceptanceRepair.execution_epoch !== activeAcceptanceRepair.executionEpoch
        ) {
          throw new Error(`dispatch_agent acceptance-repair authority does not match the current Task ledger revision.`)
        }
        const criteria = new Map(
          activeAcceptanceRepair.revision.gap.criteria.map((criterion) => [criterion.criterion_id, criterion]),
        )
        const selectedCriteria: MissionAcceptanceGap["criteria"] = []
        for (const criterionID of acceptanceRepair.criterion_ids) {
          const criterion = criteria.get(criterionID)
          if (!criterion) {
            throw new Error(`Acceptance gap ${acceptanceRepair.gap_id} has no open criterion ${criterionID}.`)
          }
          if (
            !workflowNodeConsumesAcceptanceCriterion(
              activeAcceptanceRepair.workflowBinding,
              criterion.responsible_workflow_node_id,
              exactWorkflowNodeID,
            )
          ) {
            throw new Error(
              `Workflow node ${exactWorkflowNodeID} does not own or verify acceptance criterion ${criterionID}.`,
            )
          }
          selectedCriteria.push(criterion)
        }
        canonicalAcceptanceRepair = {
          gap_id: acceptanceRepair.gap_id,
          ledger_revision_artifact_id: acceptanceRepair.ledger_revision_artifact_id,
          execution_epoch: acceptanceRepair.execution_epoch,
          criteria: selectedCriteria,
          checkpoint_required: true,
        }
        acceptanceEvidenceLocators = acceptanceRepairEvidenceLocators(canonicalAcceptanceRepair)
      } else if (acceptanceRepair) {
        throw new Error(`dispatch_agent supplied acceptance-repair authority without an active Task acceptance gap.`)
      }
      const origin = createDispatchLineageOrigin({
        taskID: ownershipTaskID,
        orchestratorSessionID: toolExecution.orchestratorSessionID,
        orchestratorMessageID: toolExecution.orchestratorMessageID,
        toolCallID: toolExecution.toolCallID,
        toolPartID: toolExecution.toolPartID,
        targetAgentID,
        projectedWorkerIdentity: projectedAgent.identity,
        workScope,
        deliverySliceRevisionIDs: exactDeliverySliceRevisionIDs,
        workflowBinding: exactWorkflowBinding,
        workflowNodeID: exactWorkflowNodeID,
        ...(exactWorkflowOccurrenceID ? { workflowOccurrenceID: exactWorkflowOccurrenceID } : {}),
        ...(coordinationActionID ? { coordinationActionID } : {}),
        ...(sourceDispatchID ? { continuationOfDispatchID: sourceDispatchID } : {}),
        adapterInput: exactAdapterInput,
      })
      const task = await assertTaskRootSessionLineageForConfig(requireTask(ownershipTaskID))
      const authority = await taskAuthorityAnchor({ task, existingSessionID })
      const selectedEvidence = [
        ...new Map(
          [...acceptanceEvidenceLocators, ...(evidenceLocators ?? [])].map((locator) => [
            JSON.stringify(locator),
            locator,
          ]),
        ).values(),
      ]
      const exactEvidenceLocators = await assertTaskEvidenceLocators({
        taskID: ownershipTaskID,
        evidenceLocators: selectedEvidence,
      })
      const turn = DispatchTurnSchema.parse(
        existingSessionID
          ? {
              kind: "continuation",
              current_dispatch_id: origin.dispatchID,
              source_dispatch_id: sourceDispatchID,
              child_session_id: existingSessionID,
              workflow_binding: origin.workflowBinding,
              workflow_node_id: origin.workflowNodeID,
              workflow_occurrence_id: origin.workflowOccurrenceID,
              delivery_slice_revision_ids: origin.deliverySliceRevisionIDs ?? [],
              evidence_locators: exactEvidenceLocators,
              task_authority: authority,
              ...(canonicalAcceptanceRepair ? { acceptance_repair: canonicalAcceptanceRepair } : {}),
            }
          : {
              kind: "initial",
              current_dispatch_id: origin.dispatchID,
              workflow_binding: origin.workflowBinding,
              workflow_node_id: origin.workflowNodeID,
              workflow_occurrence_id: origin.workflowOccurrenceID,
              delivery_slice_revision_ids: origin.deliverySliceRevisionIDs ?? [],
              evidence_locators: [],
              task_authority: authority,
            },
      )
      if (signal?.aborted) throw new Error(`dispatch_agent ${targetAgentID} aborted before lineage preparation`)
      let recordedLineage: ReturnType<typeof recordDispatchLineage> | undefined
      const observeSession = (sessionID: string) => {
        if (recordedLineage && recordedLineage.payload.child_session_id !== sessionID) {
          throw new Error(
            `dispatch_agent ${targetAgentID} already recorded session ${recordedLineage.payload.child_session_id}, not ${sessionID}`,
          )
        }
      }
      return {
        dispatchID: origin.dispatchID,
        deliverySliceRevisionIDs: [...(origin.deliverySliceRevisionIDs ?? [])],
        existingSessionID,
        turn,
        adapterInput: Object.freeze({ ...exactAdapterInput }),
        ...(existingSessionID ? { continuationGuidance } : {}),
        observeSession,
        commitSession(sessionID: string, descriptor: WorkerTurnDescriptor.Info) {
          observeSession(sessionID)
          const persistedDescriptor = WorkerTurnDescriptor.get({ id: descriptor.id, sessionID })
          if (!persistedDescriptor) {
            throw new Error(
              `dispatch_agent ${targetAgentID} cannot commit Session ${sessionID} without its exact durable Turn descriptor`,
            )
          }
          if (
            persistedDescriptor.id !== descriptor.id ||
            persistedDescriptor.sessionID !== descriptor.sessionID ||
            persistedDescriptor.hash !== descriptor.hash
          ) {
            throw new Error(
              `dispatch_agent ${targetAgentID} Session ${sessionID} durable Turn descriptor identity does not match ${descriptor.id}`,
            )
          }
          const descriptorTurn = descriptor.payload.dispatchTurn
          if (!descriptorTurn) {
            throw new Error(`dispatch_agent ${targetAgentID} Session ${sessionID} descriptor has no dispatch Turn`)
          }
          const descriptorMatchesDispatch = (() => {
            if (descriptorTurn.kind !== turn.kind) return false
            if (turn.kind === "continuation") {
              return isDeepStrictEqual(descriptorTurn, turn)
            }
            if (descriptorTurn.kind !== "initial") return false
            const {
              initial_user_message_id: _messageID,
              initial_control_text_parts: _parts,
              ...descriptorBase
            } = descriptorTurn.task_authority
            const {
              initial_user_message_id: _baseMessageID,
              initial_control_text_parts: _baseParts,
              ...turnBase
            } = turn.task_authority
            return (
              turn.task_authority.initial_user_message_id === undefined &&
              turn.task_authority.initial_control_text_parts.length === 0 &&
              descriptorTurn.task_authority.initial_user_message_id !== undefined &&
              descriptorTurn.task_authority.initial_control_text_parts.length > 0 &&
              isDeepStrictEqual(
                { ...descriptorTurn, task_authority: descriptorBase },
                { ...turn, task_authority: turnBase },
              )
            )
          })()
          if (!descriptorMatchesDispatch) {
            throw new Error(
              `dispatch_agent ${targetAgentID} Session ${sessionID} descriptor does not match dispatch ${origin.dispatchID}`,
            )
          }
          const currentMessageAuthority = descriptor.payload.messageAuthority
          if (
            descriptorTurn.kind === "initial" &&
            (currentMessageAuthority.user_message_id !== descriptorTurn.task_authority.initial_user_message_id ||
              !isDeepStrictEqual(
                currentMessageAuthority.control_text_parts,
                descriptorTurn.task_authority.initial_control_text_parts,
              ))
          ) {
            throw new Error(
              `dispatch_agent ${targetAgentID} Session ${sessionID} initial and current message authority differ`,
            )
          }
          {
            const messageID = currentMessageAuthority.user_message_id
            const message = Database.use((db) =>
              db
                .select({ id: MessageTable.id })
                .from(MessageTable)
                .where(and(eq(MessageTable.id, messageID), eq(MessageTable.session_id, sessionID)))
                .get(),
            )
            const textParts = Database.use((db) =>
              db
                .select({ id: PartTable.id, data: PartTable.data })
                .from(PartTable)
                .where(eq(PartTable.message_id, messageID))
                .all()
                .filter((part) => part.data.type === "text"),
            )
            const expected = new Map(
              currentMessageAuthority.control_text_parts.map((part) => [part.part_id, part.text_sha256]),
            )
            if (
              !message ||
              textParts.length !== expected.size ||
              textParts.some((part) => {
                const data = part.data
                const text = (data as { text?: unknown }).text
                return (
                  data.type !== "text" || typeof text !== "string" || expected.get(part.id) !== controlTextSHA256(text)
                )
              })
            ) {
              throw new Error(
                `dispatch_agent ${targetAgentID} Session ${sessionID} initial message bundle does not match its descriptor`,
              )
            }
          }
          if (!coordinationActionID) {
            const lineage =
              recordedLineage ??
              (recordedLineage = recordDispatchLineage({
                origin,
                childSessionID: sessionID,
              }))
            return { artifactID: lineage.artifactID }
          }
          if (!coordinationSourceSessionID) {
            throw new Error(`dispatch_agent coordination action ${coordinationActionID} has no source session`)
          }

          let createdLineage: ReturnType<typeof recordDispatchLineage> | undefined
          const bound = bindAgentCoordinationRedispatchSuccessor({
            taskID: ownershipTaskID,
            actionID: coordinationActionID,
            dispatchID: origin.dispatchID,
            childSessionID: sessionID,
            targetAgentID,
            bindSuccessor: () => {
              createdLineage = recordDispatchLineage({
                origin,
                childSessionID: sessionID,
              })
              return {
                dispatch_lineage_id: createdLineage.artifactID,
                dispatch_id: createdLineage.dispatchID,
                dispatch_agent_id: targetAgentID,
                dispatch_session_id: sessionID,
                work_scope: workScope,
                dispatch_bound: true,
                awaiting_explicit_dispatch: false,
              }
            },
            summary: `Completed explicit redispatch with immutable lineage for session ${sessionID}`,
          })
          if (createdLineage) recordedLineage = createdLineage
          if (!recordedLineage) {
            const lineageArtifactID = bound.action.payload.result?.dispatch_lineage_id
            if (typeof lineageArtifactID !== "string") {
              throw new Error(`dispatch_agent coordination action ${coordinationActionID} has no bound lineage`)
            }
            recordedLineage = findDispatchLineageByArtifactID({
              taskID: ownershipTaskID,
              artifactID: lineageArtifactID,
            })
            if (!recordedLineage) {
              throw new Error(
                `dispatch_agent coordination action ${coordinationActionID} bound lineage ${lineageArtifactID} is missing`,
              )
            }
          }
          return { artifactID: recordedLineage.artifactID }
        },
      }
    }) satisfies OpenDispatchAgentLineage,
  })

  const manageTaskTool = bindToolExecutionMode(
    tool({
      description:
        "Single scheduler task-management tool. Use action to select Task lifecycle or Delivery Slice contract behavior, then provide action-specific fields. Slice mutations never create, retry, cancel, or complete workers, worktrees, workflow nodes, or lifecycle. " +
        `Exact action fields: ${MANAGE_TASK_ACTION_NAMES.map(
          (action) => `${action}(${MANAGE_TASK_ACTION_FIELDS[action].join(", ")})`,
        ).join("; ")}. Do not copy non-null fields from another action. ` +
        "Task completion is decided only through complete_task from current Task-level acceptance evidence. " +
        "This replaces separate visible Task-lifecycle and Delivery Slice contract tools such as complete_task, fail_task, cancel_task, add_goal, modify_goal, and delete_goal.",
      inputSchema: ManageTaskInputSchema,
      execute: async (toolInput, options) => {
        const { action, ...actionInput } = ManageTaskInputSchema.parse(toolInput)
        const actionTool = (
          tools as Record<string, { execute?: (args: unknown, options: unknown) => Promise<unknown> }>
        )[action]
        if (typeof actionTool?.execute !== "function") {
          throw new Error(`manage_task action ${action} is not backed by an internal scheduler tool`)
        }
        const result = await actionTool.execute(
          actionInput,
          optionsWithVisibleOrchestratorToolName(options, "manage_task"),
        )
        return result
      },
    }),
    "turn_control_exclusive",
  )

  const publicTools: Record<string, unknown> = {
    ...tools,
    ...createMulticaImportTools({ taskID: input.taskID, sessionID: input.agentSessionID }),
    capability_search: createCapabilitySearchAiTool({
      taskID: input.taskID,
      signal: input.signal,
    }),
    expert_squad_author: createExpertSquadAuthorAiTool({
      taskID: input.taskID,
      sessionID: input.agentSessionID,
    }),
    evolve_expert_squad_from_feedback: createExpertSquadFeedbackRevisionAiTool({
      taskID: input.taskID,
      sessionID: input.agentSessionID,
    }),
    artifact_search: createArtifactSearchAiTool(input.taskID),
    artifact_read: createArtifactReadAiTool(input.taskID),
    artifact_select: createArtifactSelectAiTool(input.taskID),
    artifact_snapshot: createArtifactSnapshotAiTool(input.taskID),
    publish_interactive_artifact: createPublishInteractiveArtifactAiTool(),
    dispatch_agent: dispatchAgentTool,
    manage_task: manageTaskTool,
  }
  for (const decisionToolName of ORCHESTRATOR_DECISION_TOOL_NAMES) {
    const decisionTool = publicTools[decisionToolName]
    if (!decisionTool) {
      throw new Error(`Orchestrator decision Tool ${decisionToolName} is absent from the public Tool surface`)
    }
    // The reduction accepts a `dispatch_agent` fan-out or exactly one other
    // decision per assistant turn; a mixed set is an absorbing integrity
    // conflict. Declaring the contract here lets the turn coordinator refuse
    // the combination while it is still only a call.
    bindToolDecisionDeclaration(decisionTool as object, {
      command: decisionToolName,
      commits: (args) => {
        try {
          return (
            orchestratorDecisionToolCompletionEffect({ tool: decisionToolName, stateInput: args }) !==
            "requires_followup_decision"
          )
        } catch {
          return false
        }
      },
    })
  }
  for (const hidden of [...DispatchAdapterContractRegistry.ids, ...MANAGE_TASK_ACTION_NAMES]) {
    delete publicTools[hidden]
  }

  // A terminal conversation (a cancelled Task, or a coordination request that
  // reached a Task after it settled) gets a projected Tool table, not a
  // wrapped one: the read-only surface plus the one decision Tool its ingress
  // kind authorizes. An absent Tool cannot be called, so there is no refusal
  // path for the model to loop on — and no re-wrap, so WeakMap-bound
  // coordination state never needs copying. Everywhere else the Task's status
  // is a projection, never a per-call gate: a stray lifecycle call lands on
  // the engine's own existing_terminal invariant and returns a model-visible
  // rejection with the actual status.
  const surface = { tools: publicTools }
  orchestratorToolLineageHooks.set(surface, DispatchAgentToolTestHooks.openLineage(dispatchAgentTool))
  return surface
}
