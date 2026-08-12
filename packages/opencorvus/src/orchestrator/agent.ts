/**
 * Orchestrator — master agent in the Agent Team architecture.
 *
 * Per specs/current/architecture/16-unified-teardown.md §3, the orchestrator is woken by an
 * event envelope containing typed lifecycle, root-message, operator-intent, or coordination
 * evidence. The envelope is not persisted workflow state. On every wake it reads its full state
 * from the describe layer and artifact stream, then decides what to do next. Optional diagnostic
 * notes are never user-authored content or a substitute for typed wake identity.
 *
 * The orchestrator is the only task-level decision maker. It reads the
 * describe/artifact snapshot on every wake and chooses which specialist tool
 * to invoke next from exact projected capabilities and durable task evidence.
 * Specialist agents own their structured artifacts, but task lifecycle stays
 * here.
 *
 * ── Why this file does NOT use `runAgentSession` ───────────────────────────
 *
 * The orchestrator is the HOST of the worker-session pattern that
 * `src/agent/runner.ts` abstracts — not a user of that pattern. Worker
 * agents (build, visual QA, integrity, requirements, architect,
 * frontend-design, intent-analysis) collapse into the runner's shape because
 * they all share a single composed system prompt, physical streamed Turn
 * termination, thrown AgentRunError on stream / abort failure, and no
 * step-level coordination.
 *
 * The orchestrator deliberately diverges on every one of those axes:
 *   - Two-part system prompt (static + per-model-turn describe / iteration / verdict)
 *   - Orchestrator tools return evidence to the same reasoning turn; they do
 *     not end scheduling through host-side deferred-stop gates.
 *   - Stream errors are persisted as `engine_artifact kind="orchestrator-
 *     stream-error"`. After the canonical LLM Activity retries are exhausted,
 *     the physical Session and Task execution window are terminalized. A
 *     later operator Retry/Replan creates a fresh execution window.
 *   - Concurrency state (`running.set(taskID, ctrl)`) and SerialQueue-driven
 *     wake scheduling sit OUTSIDE any single processTask invocation; the
 *     runner has no analog because workers do not own their own dispatch.
 *
 * See the matching NON-GOAL section in `src/agent/runner.ts` for the full
 * rationale. Anyone tempted to "consolidate orchestrator onto the runner"
 * is looking at the abstraction upside-down — the orchestrator IS the host
 * the runner is a building block of.
 * ───────────────────────────────────────────────────────────────────────────
 */
import ORCHESTRATOR_CORE from "@/prompt/core/orchestrator-core.txt"
import { withObservableWorkNarrative } from "@/prompt/fragments/observable-work-narrative"
import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import { EffectiveConfig } from "@/config/effective"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { MCP } from "@/mcp"
import { computerRuntimeScopeIdentity } from "@/mcp/computer/runtime-scope"
import { resolveAgentModel } from "@/agent/model"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { EngineConfig } from "@/engine"
import { appendSchedulerProjectSourceBoundary } from "@/prompt/scoped-project-source-boundary"
import { AgentRunError, buildHardErrorFromFinalMessage, recordToolExecuteErrorsForFinalMessage } from "@/agent/runner"
import { Session } from "@/session"
import { SessionContext } from "@/session/context"
import { SessionPrompt } from "@/session/prompt"
import { SessionPromptLoopFinishedError } from "@/session/prompt/state"
import { SessionStatus } from "@/session/status"
import { publishSessionStatus, publishSettledSessionTerminalStatus } from "@/session/status-publication"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import { provideInitializedProjectExecution } from "@/project/independent-project-owner"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { createExecutionCancellationOrigin, isExecutionCancellationError } from "@/session/prompt/cancellation"
import { toolGuard } from "@/util/tool-guard"
import { createOrchestratorTools } from "./tools"
import { attachmentPromptSection } from "@/agent/prompt-projection"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { readIterationHistory as readHistForPrompt } from "@/metrics/store"
import { requireTask, terminalTask } from "@/engine"
import { Database, NotFoundError } from "@/storage/db"
import { recordTaskInfrastructureError } from "@/engine/persist"
import { queuedTaskIngressSourceKind } from "@/engine/queued-task-ingress"
import { describeProcessRecoveryFact, describeTask, renderTaskDescription, type TaskDesc } from "@/engine/describe"
import { deriveTaskStatus, isTaskTerminal } from "@/engine/task-status"
import { resolvePinnedTaskSchedulerTurnProjection } from "@/engine/task-package-projection"
import type { TaskRow } from "@/engine"
import { TaskCreatorMetadata } from "@/task-api/task-creator"
import {
  TaskRootMessageProvenance,
  deliverTaskRootMessageToOrchestratorSession,
  getTaskRootMessage,
} from "@/task-api/task-root-message"
import { AgentTrace } from "@/trace"
import { ProtocolStore } from "@/protocol/store"
import { SchedulerMessagePayload } from "@/protocol/schema"
import { NamedError } from "@opencorvus-ai/util/error"
import type { OrchestratorEvent } from "./event"
import type { TerminalConversationAuthority } from "./terminal-conversation-authority"
import { ORCHESTRATOR_TASK_ERROR_ENVELOPE_MARKER, type OrchestratorTaskErrorEnvelope } from "./error-envelope"
import { assertTaskRootSessionLineage, taskOrchestratorSession } from "./task-session"

const log = Log.create({ service: "orchestrator" })
// The scheduler step budget lives on HostAgentRegistry's orchestrator record;
// SessionLoop consumes that exact host runtime through the composed native surface.

function serializeOrchestratorTaskError(error: unknown): {
  envelope: OrchestratorTaskErrorEnvelope
  message: string
  taskError: string
} {
  const envelope = error instanceof AgentRunError ? hardErrorEnvelope(error) : orchestratorErrorEnvelope(error)
  const message = envelope.message
  return {
    envelope,
    message,
    taskError:
      `Orchestrator error: ${message}` + `${ORCHESTRATOR_TASK_ERROR_ENVELOPE_MARKER}${JSON.stringify(envelope)}`,
  }
}

function orchestratorErrorEnvelope(error: unknown): OrchestratorTaskErrorEnvelope {
  const candidate = error as { name?: unknown; message?: unknown; data?: unknown; constructor?: { name?: string } }
  const data = candidate && typeof candidate === "object" ? candidate.data : undefined
  const dataMessage =
    data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string"
      ? (data as { message: string }).message
      : undefined
  const message = dataMessage ?? (typeof candidate?.message === "string" ? candidate.message : String(error))
  const errorName =
    typeof candidate?.name === "string" && candidate.name.length > 0
      ? candidate.name
      : error instanceof Error && error.constructor.name
        ? error.constructor.name
        : "UnknownError"
  return {
    errorName,
    message,
    ...(error instanceof NamedError ? { data: (error as NamedError & { data: unknown }).data } : {}),
  }
}

function hardErrorEnvelope(error: AgentRunError): OrchestratorTaskErrorEnvelope {
  return error.cause === undefined ? orchestratorErrorEnvelope(error) : orchestratorErrorEnvelope(error.cause)
}

export function recordOrchestratorTurnTraceForSession(
  session: Session.Info,
  input: Parameters<typeof AgentTrace.recordAgentTurn>[0],
): void {
  SessionContext.provide(session, () => {
    AgentTrace.recordAgentTurn(input)
  })
}

export function recordOrchestratorTurnTraceBestEffort(
  session: Session.Info,
  input: Parameters<typeof AgentTrace.recordAgentTurn>[0],
  write: typeof recordOrchestratorTurnTraceForSession = recordOrchestratorTurnTraceForSession,
): void {
  try {
    write(session, input)
  } catch (error) {
    log.error("post-terminal orchestrator trace persistence failed", {
      sessionID: session.id,
      taskID: input.taskID,
      kind: input.kind,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function latestSessionMessageID(sessionID: string): Promise<string | undefined> {
  for await (const message of MessageStore.stream(sessionID)) {
    return message.info.id
  }
  return undefined
}

async function latestSessionUserMessageID(sessionID: string): Promise<string | undefined> {
  for await (const message of MessageStore.stream(sessionID)) {
    if (message.info.role === "user") return message.info.id
  }
  return undefined
}

async function recordOrchestratorSessionHardError(input: { taskID: string; sessionID: string; error: AgentRunError }) {
  return recordOrchestratorSessionErrorEnvelope({
    taskID: input.taskID,
    sessionID: input.sessionID,
    envelope: hardErrorEnvelope(input.error),
    summaryPrefix: "Orchestrator session hard error",
  })
}

async function recordOrchestratorSessionErrorEnvelope(input: {
  taskID: string
  sessionID: string
  envelope: OrchestratorTaskErrorEnvelope
  summaryPrefix: string
}): Promise<void> {
  const now = Date.now()
  const reason = `${input.envelope.errorName}: ${input.envelope.message}`
  const { recordOrchestratorStreamError } = await import("@/engine/persist")
  recordOrchestratorStreamError({
    taskID: input.taskID,
    reason,
    errorName: input.envelope.errorName,
    sessionID: input.sessionID,
    now,
  })
}

async function settleOrchestratorStartupFailure(input: {
  taskID: string
  session?: Session.Info
  envelope: OrchestratorTaskErrorEnvelope
  taskError: string
}): Promise<void> {
  const now = Date.now()
  const reason = `${input.envelope.errorName}: ${input.envelope.message}`
  recordTaskInfrastructureError({
    taskID: input.taskID,
    component: "orchestrator-runtime",
    operation: "prepare-first-message",
    reason,
    errorName: input.envelope.errorName,
    sessionID: input.session?.id,
    now,
  })
  const task = requireTask(input.taskID)
  if (!isTaskTerminal(task)) {
    await terminalTask(
      task,
      {
        status: "failed",
        error: input.taskError,
        time_started: task.time_started ?? Math.min(task.time_created, now - 1),
        time_completed: now,
      },
      `Orchestrator startup failed: ${input.envelope.message}`,
    )
  }
}

async function settleOrchestratorExecutionFailure(input: {
  taskID: string
  session?: Session.Info
  inputMessageID?: string
  envelope: OrchestratorTaskErrorEnvelope
  taskError: string
}): Promise<void> {
  const now = Date.now()
  const reason = `${input.envelope.errorName}: ${input.envelope.message}`
  if (input.session) {
    if (!input.inputMessageID) {
      throw new Error(`Orchestrator execution failure for ${input.session.id} has no input message identity`)
    }
    await publishSettledSessionTerminalStatus({
      session: input.session,
      taskID: input.taskID,
      inputMessageID: input.inputMessageID,
      status: {
        type: "terminal",
        reason: "error",
        error: reason,
      },
    })
  }
  const task = requireTask(input.taskID)
  if (!isTaskTerminal(task)) {
    await terminalTask(
      task,
      {
        status: "failed",
        error: input.taskError,
        time_started: task.time_started ?? Math.min(task.time_created, now - 1),
        time_completed: now,
      },
      `Orchestrator execution interrupted: ${input.envelope.message}`,
      { terminalReason: "interrupted" },
    )
  }
}

class OrchestratorPromptInactiveError extends Error {
  constructor(input: { taskID: string; sessionID: string; inactivityMs: number }) {
    super(
      `Orchestrator prompt ${input.sessionID} for task ${input.taskID} produced no activity for ${input.inactivityMs}ms`,
    )
    this.name = "OrchestratorPromptInactiveError"
  }
}

async function runOrchestratorPromptWithInactivity<T>(input: {
  taskID: string
  session: Session.Info
  run: () => Promise<T>
}): Promise<T> {
  const timeout = (await EngineConfig.get()).activity.task_queue_run_timeout_ms
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error(`Invalid assistant.activity.task_queue_run_timeout_ms: ${timeout}`)
  }

  const pollMs = Math.min(1_000, Math.max(50, Math.floor(timeout / 20)))
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false
  let lastSignature = ""
  let idleDeadline = Date.now() + timeout

  const activitySignature = async () => {
    const sessionIDs = [...new Set([input.session.id, ...(await Session.tree(input.session.id))])]
    let pausedTool = false
    const signature = sessionIDs
      .map((sessionID) => {
        const promptActivity = SessionPrompt.ownerActivity(sessionID)
        const streamActivity = SessionStatus.getActivity(sessionID)
        const status = SessionStatus.get(sessionID)
        if (streamActivity?.paused) {
          pausedTool = true
        }
        return [
          sessionID,
          JSON.stringify(status),
          promptActivity?.timeUpdated ?? 0,
          promptActivity?.timeCancelled ?? 0,
          streamActivity?.last_activity_at ?? 0,
          streamActivity?.paused ?? false,
        ].join(":")
      })
      .join("|")
    return { signature, pausedTool }
  }

  const inactive = new Promise<never>((_, reject) => {
    const tick = async () => {
      if (settled) return
      const activity = await activitySignature()
      if (activity.signature !== lastSignature || activity.pausedTool) {
        lastSignature = activity.signature
        idleDeadline = Date.now() + timeout
      }
      if (Date.now() > idleDeadline) {
        try {
          SessionPrompt.cancel(
            input.session.id,
            input.session.directory,
            createExecutionCancellationOrigin({
              actor: "scheduler",
              source: "orchestrator.inactivity",
              surface: "orchestrator",
              reason: `Orchestrator Session ${input.session.id} inactive`,
              targetSessionID: input.session.id,
              taskID: input.taskID,
            }),
          )
        } catch (error) {
          log.warn("orchestrator prompt inactivity cancellation failed", {
            taskID: input.taskID,
            sessionID: input.session.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
        reject(
          new OrchestratorPromptInactiveError({
            taskID: input.taskID,
            sessionID: input.session.id,
            inactivityMs: timeout,
          }),
        )
        return
      }
      timer = setTimeout(() => void tick(), pollMs)
    }
    timer = setTimeout(() => void tick(), pollMs)
  })

  try {
    return await Promise.race([input.run(), inactive])
  } finally {
    settled = true
    if (timer) clearTimeout(timer)
  }
}

async function waitForOrchestratorCycleBoundary(session: Session.Info): Promise<void> {
  const sessionID = session.id
  const current = SessionStatus.get(sessionID)
  if (current.type === "idle") return
  if (current.type === "terminal") {
    throw new Error(
      `Orchestrator Session ${sessionID} became terminal before its creator wake reached standby: ${current.reason}`,
    )
  }
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      unsubscribe()
      if (error) reject(error)
      else resolve()
    }
    const observe = (status: SessionStatus.Info) => {
      if (status.type === "idle") finish()
      else if (status.type === "terminal") {
        finish(
          new Error(
            `Orchestrator Session ${sessionID} became terminal before its creator wake reached standby: ${status.reason}`,
          ),
        )
      }
    }
    const unsubscribe = Bus.subscribe(SessionStatus.Event.Status, (event) => {
      if (event.properties.sessionID === sessionID) observe(event.properties.status)
    })
    void SessionPrompt.waitForFinish(sessionID, session.directory).then(
      () => finish(),
      (error) => finish(error instanceof Error ? error : new Error(String(error))),
    )
    observe(SessionStatus.get(sessionID))
  })
}

export const OrchestratorTestHooks = {
  runPromptWithInactivity: runOrchestratorPromptWithInactivity,
  renderTaskAttachmentInventory,
}

type TaskAttachmentInventoryRef = {
  sha?: string
  url?: string
  mime?: string
  size?: number
  filename?: string
}

function renderTaskAttachmentInventory(
  attachments: readonly TaskAttachmentInventoryRef[] | undefined,
  appendUserMessage: boolean,
  schedulerCanRead: boolean,
): string {
  const attachmentRefs = (attachments ?? []).flatMap((attachment) =>
    attachment.url && attachment.mime ? [{ ...attachment, url: attachment.url, mime: attachment.mime }] : [],
  )
  const attachmentList = attachmentPromptSection(attachmentRefs)
  if (!attachmentList) return ""
  const inlinedNote = !appendUserMessage
    ? "This is an internal engine wake, so no new user message is created. Use this inventory to cite task attachments; do not claim pixel-level inspection unless visible tool/evidence output proves it."
    : "Multimodal items are refs, not hidden prompt bytes. Do not claim pixel-level inspection unless a visible tool/evidence output proves it."
  const schedulerReadNote = schedulerCanRead
    ? "The active expert squad explicitly projects `read`; use it only for concrete project files required by the package contract."
    : "You do NOT have a `read` tool yourself — do not attempt to fetch reference content."
  return [
    "# Task Attachments (explicit dispatch bindings required)",
    "",
    "The user attached the files below to this task. " +
      inlinedNote +
      " " +
      "Text/json refs can be read by sub-agents that expose attachment-reading tools. " +
      schedulerReadNote +
      " " +
      "A sub-agent receives an attachment only through the exact typed attachment fields exposed by its selected dispatch contract. Durable Artifact evidence is never forwarded in dispatch: each consumer searches the same-Task Artifact catalog and completely reads the exact versions it uses. Bind only relevant listed attachment refs, cite each by EXACT filename in the dispatch reason, and explain its relevance. NEVER imply hidden or automatic forwarding. NEVER reference an attachment that is not listed below — if this section is empty, the user attached nothing in this wake and any phrase implying you saw a file is a hallucination.",
    "",
    attachmentList,
  ].join("\n")
}

export namespace Orchestrator {
  export async function processTask(
    taskID: string,
    event?: OrchestratorEvent,
    wakeSignal?: AbortSignal,
    wakeID?: string,
  ): Promise<string | undefined> {
    return processInvocation(taskID, event, wakeSignal, undefined, wakeID)
  }

  export async function processTerminalConversation(input: {
    taskID: string
    event: OrchestratorEvent
    authority: TerminalConversationAuthority
    signal?: AbortSignal
  }): Promise<string> {
    const messageID = await processInvocation(input.taskID, input.event, input.signal, input.authority)
    if (!messageID) {
      throw new Error(`Terminal conversation ${input.authority.ingressID} completed without an assistant message`)
    }
    return messageID
  }

  async function processInvocation(
    taskID: string,
    event?: OrchestratorEvent,
    wakeSignal?: AbortSignal,
    terminalConversationAuthority?: TerminalConversationAuthority,
    wakeID?: string,
  ): Promise<string | undefined> {
    const task = requireTask(taskID)
    const terminalConversation = terminalConversationAuthority !== undefined
    if (terminalConversation && !isTaskTerminal(task)) {
      throw new Error(
        `Terminal conversation ingress ${terminalConversationAuthority.ingressID} requires a terminal Task`,
      )
    }
    if (!terminalConversation && isTaskTerminal(task)) {
      log.info("terminal task process ignored", { taskID, status: deriveTaskStatus(task), note: event?.note })
      return
    }

    const executionSignal = wakeSignal ?? new AbortController().signal

    let agentSessionID: string | undefined
    let agentSessionInfo: Session.Info | undefined
    let wakeStartMessageID: string | undefined
    let promptInFlight = false
    let schedulerMcpOwner: MCP.ScopedConnectionOwner | undefined
    let schedulerMcpOwnerTransferred = false
    try {
      if (!task.session_id) {
        log.error("orchestrator: no session_id on task", { taskID })
        return
      }
      await assertTaskRootSessionLineage(task)

      // Own one durable participant before any scheduler preparation that can
      // fail. This Session is the real lifecycle/audit identity even when no
      // LLM message is ever materialized.
      const agentSession = await taskOrchestratorSession(task)
      agentSessionID = agentSession.id
      agentSessionInfo = agentSession
      if (event?.rootMessage?.schedulerDelivery) {
        await deliverTaskRootMessageToOrchestratorSession({
          task,
          messageID: event.rootMessage.messageID,
          orchestratorSessionID: agentSession.id,
        })
      }
      wakeStartMessageID = await latestSessionMessageID(agentSession.id)

      const profileScope = task.session_id ? { sessionID: task.session_id } : { taskID: task.id }
      const [schedulerConfig, schedulerProjectDirectory, schedulerCapabilityDirectory] = await Promise.all([
        EffectiveConfig.effective(profileScope),
        EffectiveConfig.directory(profileScope),
        EffectiveConfig.capabilityProjectDirectory(profileScope),
      ])
      const {
        packageRevision: frozenPackageRevision,
        schedulerCapability,
        skillProjection,
      } = await resolvePinnedTaskSchedulerTurnProjection({
        taskID,
        projectDirectory: schedulerCapabilityDirectory,
        config: schedulerConfig,
      })
      // 1. Resolve model — strict config only: agent.orchestrator.model first,
      //    then top-level model. Missing config is a task-visible startup
      //    failure, never a silent return or implicit provider fallback.
      const host = await HostAgentRegistry.get("orchestrator", { config: schedulerConfig })
      const model = await resolveAgentModel(host.name, { sessionID: task.session_id })

      // 2. LLM context is reconstructed from DB state (Delivery Slice
      //    revisions, Sessions, dispatch lineage, Artifacts, and decision log)
      //    via buildSystemParts on each invocation;
      //    the durable task-level Orchestrator Session is reused on every wake.
      const schedulerDispatchAgents = [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents]

      // 3. Project the exact active expert-squad scheduler tool table before
      //    guard/enable/runtime setup.
      const { tools: rawTools } = createOrchestratorTools({
        taskID,
        agentSessionID: agentSession.id,
        signal: executionSignal,
        dispatchAgents: schedulerDispatchAgents,
        rootMessage: event?.rootMessage,
        taskIntent: event?.taskIntent,
        missionAcceptanceResume: event?.missionAcceptanceResume,
        terminalConversationAuthority,
      })
      schedulerMcpOwner = MCP.createScopedConnectionOwner(
        computerRuntimeScopeIdentity({ ownerKind: "orchestrator", taskID, sessionID: agentSession.id }),
      )
      const tools = await PromptProfileResolver.projectOrchestratorTools(rawTools, schedulerCapability, {
        taskID,
        projectDirectory: schedulerProjectDirectory,
        connectionOwner: schedulerMcpOwner,
      })
      const guard = toolGuard(tools)

      // 4. Build prompt. Each newly constructed Orchestrator child receives
      //    the original task brief once, authored by the durable task creator.
      //    Follow-up operator text remains in its real root message. The wake
      //    projects its exact identity without prescribing a retrieval tool. Typed Retry/Replan and
      //    Mission resume occurrences stay in the system control projection. Exact terminal
      //    occurrences additionally materialize one durable, visible Orchestrator-authored control
      //    Message so the provider and transcript share the same current input.
      //    A wake can span multiple model turns while dispatch_agent waits for
      //    a child, so the contract resolves DB-backed task context per turn.
      let systemContext = await buildSystemParts(
        task,
        event,
        schedulerCapability,
        schedulerDispatchAgents,
        schedulerProjectDirectory,
      )
      const appendUserMessage = !(await sessionHasCreatorMessage(agentSession.id))
      const hasTypedControlOccurrence = Boolean(
        event?.taskIntent ||
          event?.missionAcceptanceResume ||
          event?.agentLifecycleDelivery ||
          event?.dispatchInfrastructureFailure,
      )
      const materializeCreatorBeforeTypedControl = appendUserMessage && hasTypedControlOccurrence
      const appendCreatorMessage = appendUserMessage && !hasTypedControlOccurrence
      const taskCreator = TaskCreatorMetadata.parse(task.metadata)
      const userText = appendCreatorMessage ? orchestratorUserText(task) : ""
      // Build attachment inventory when the task has file attachments. Wakes
      // carry link/index refs only; no hidden model-only file parts are added.
      // Project packages may explicitly project `read` to the Orchestrator.
      // The inventory tells it which task-owned refs are available for an
      // explicit, typed dispatch binding; no hidden forwarding occurs.
      const allAttachments = Array.isArray(task.attachments)
        ? (task.attachments as Array<{ sha?: string; url?: string; mime?: string; size?: number; filename?: string }>)
        : undefined
      const inventoryText = renderTaskAttachmentInventory(
        allAttachments,
        appendCreatorMessage,
        schedulerCapability.builtInToolIDs.includes("read"),
      )
      const creatorInventoryText = materializeCreatorBeforeTypedControl
        ? renderTaskAttachmentInventory(allAttachments, true, schedulerCapability.builtInToolIDs.includes("read"))
        : ""
      const enrichedUserText = appendCreatorMessage ? userText + inventoryText : ""
      const wakeProvenanceNotice = renderWakeProvenanceNotice(event, taskID, wakeID)
      const hasCurrentWakeIngress = isCurrentWakeIngress(event)
      const currentControlMessage = currentOrchestratorControlMessage(event, taskID, wakeID)
      const currentSchedulerInputMessageID = event?.rootMessage?.schedulerDelivery
        ? event.rootMessage.messageID
        : undefined
      const currentVisibleInputMessageID = currentControlMessage?.messageID ?? currentSchedulerInputMessageID
      const resolveRuntimeSystem = async () => {
        systemContext = await buildSystemParts(
          requireTask(taskID),
          event,
          schedulerCapability,
          schedulerDispatchAgents,
          schedulerProjectDirectory,
        )
        const currentIngressSystemNotice = currentControlMessage
          ? "The last visible input Message is the exact current Orchestrator-authored control occurrence. Resolve that Message before using older conversation history; its durable identities and facts are authoritative for this decision pass."
          : currentSchedulerInputMessageID
            ? "The last visible input Message is the exact current Mission/Orchestrator scheduler message. Respond to that real participant Message before using older conversation history."
            : wakeProvenanceNotice
        const runtimeParts =
          appendCreatorMessage && !hasCurrentWakeIngress
            ? systemContext.parts
            : [...systemContext.parts, currentIngressSystemNotice, ...(inventoryText.trim() ? [inventoryText] : [])]
        return terminalConversation
          ? [
              ...runtimeParts,
              `This is a terminal conversation-only Turn for ingress ${terminalConversationAuthority.ingressID}. Answer the visible request or acknowledge the exact coordination request. Keep Task lifecycle unchanged. Do not dispatch product work, create a wait/question, or call Task lifecycle tools. Recoverable follow-up requires the operator's explicit same-Task Retry/Replan control.`,
            ]
          : runtimeParts
      }
      // Build PromptInput.parts. Text only; attachment media is referenced by
      // URL/index in the prompt inventory.
      const parts: Array<{ type: "text"; text: string }> = appendCreatorMessage
        ? [{ type: "text", text: enrichedUserText }]
        : []
      const partsWithIds = parts.map((p) => ({ ...p, id: Identifier.ascending("part") }))
      const creatorPartsWithIds = [
        { type: "text" as const, text: orchestratorUserText(task) + creatorInventoryText },
      ].map((part) => ({ ...part, id: Identifier.ascending("part") }))

      log.info("orchestrator starting", {
        taskID,
        note: event?.note,
        sessionID: agentSession.id,
        model: `${model.providerID}/${model.id}`,
        toolCount: Object.keys(tools).length,
        rawToolCount: Object.keys(rawTools).length,
        expertSquadID: schedulerCapability.expertSquadID,
        projectionHash: schedulerCapability.projectionHash,
      })

      // Abort hooks translate external interrupts to SessionPrompt.cancel on
      // the child session so the loop releases its processor cleanly. We
      // ALSO cascade the cancel to every descendant session: projected
      // dispatch_agent targets spawn their own SessionPrompt loops, and the
      // Orchestrator wake signal is not threaded into them — without
      // cascading here, an aborted physical wake returns from the Orchestrator
      // while every in-flight subagent
      // keeps burning tokens producing results no one is awaiting. The
      // task-api cancelTask path ALREADY walks the session tree
      // (task-api/index.ts cancelTask), so this brings the in-process
      // interrupt path in line with the explicit-cancel API path.
      // Cancel order is descendants-first so a parent's processor sees its
      // tool's child session already terminal when it unwinds.
      const abortProjectID = Instance.project.id
      const abortPrompt = () => {
        void (async () => {
          const origin = isExecutionCancellationError(executionSignal.reason)
            ? executionSignal.reason.origin
            : createExecutionCancellationOrigin({
                actor: "orchestrator",
                source: "orchestrator.abort_cascade",
                surface: "orchestrator",
                reason: "Orchestrator execution signal aborted",
                targetSessionID: agentSession.id,
                taskID,
              })
          try {
            const ids = await Session.treeInProject({
              sessionID: agentSession.id,
              projectID: abortProjectID,
            })
            for (const descendantID of ids.slice().reverse()) {
              const descendant = descendantID === agentSession.id ? agentSession : await Session.get(descendantID)
              cancelSessionPromptInScope({
                session: descendant,
                taskID,
                handle: "orchestrator.abort-cascade",
                origin: { ...origin, targetSessionID: descendant.id },
                settleBeforeReuse: false,
              })
            }
          } catch (err) {
            log.warn("orchestrator abort cascade failed", {
              taskID,
              sessionID: agentSession.id,
              error: err instanceof Error ? err.message : String(err),
            })
            cancelSessionPromptInScope({
              session: agentSession,
              taskID,
              handle: "orchestrator.abort-cascade",
              origin: { ...origin, targetSessionID: agentSession.id },
              settleBeforeReuse: false,
            })
            throw err
          }
        })()
      }
      executionSignal.addEventListener("abort", abortPrompt, { once: true })

      // Subscribe to session-level errors so critical stream failures still
      // flip the task to failed. SessionLoop publishes Session.Event.Error on
      // provider / processor faults; collecting them here reproduces the
      // the pre-migration runtime.failures snapshot at a coarser granularity.
      const streamErrors: Array<{ reason: string; errorName?: string }> = []
      const errorUnsub = Bus.subscribe(Session.Event.Error, (evt) => {
        // The published payload is a NamedError-shaped object produced by
        // Message.fromError(...).toObject(): { name, data: { message, ... } }.
        // Reading `props.error.message` directly comes back undefined and
        // surfaced as the generic "unknown session error" — hiding the
        // actual provider error (e.g. HTTP 429 quota) from the orchestrator
        // wake context. Unwrap data.message first so the real reason flows
        // into the artifact and the next decision turn.
        const props = evt.properties as {
          sessionID: string
          error: { name?: string; message?: string; data?: { message?: string } }
        }
        if (props.sessionID !== agentSession.id) return
        const msg = props.error?.data?.message ?? props.error?.message ?? "unknown session error"
        streamErrors.push({ reason: msg, errorName: props.error?.name })
      })

      // 5. Run the orchestrator session — tools via SessionRuntimeContract.
      //    Step limit lives on agent.orchestrator.steps.
      let finalMessage: Message.WithParts | undefined
      const finalMessagePromptOwner = () => {
        if (!finalMessage) return undefined
        const owner = SessionPrompt.messageOwner(agentSession.id, finalMessage.info.id)
        if (!owner && SessionPrompt.hasGeneration(agentSession.id)) {
          throw new Error(
            `Session ${agentSession.id} final message ${finalMessage.info.id} has no prompt generation receipt`,
          )
        }
        return owner
      }
      const promptBoundaryMessageID = await latestSessionMessageID(agentSession.id)
      let installedRuntimeContract: SessionPrompt.SessionRuntimeContract | undefined
      let runtimeWakeArmed = false
      let promptInvocationStarted = false
      try {
        if (materializeCreatorBeforeTypedControl) {
          if (SessionPrompt.hasGeneration(agentSession.id)) {
            throw new Error(
              `Fresh Orchestrator creator Message cannot be materialized while Session ${agentSession.id} has a prompt owner`,
            )
          }
          await SessionPrompt.prompt({
            sessionID: agentSession.id,
            author: taskCreator.actor,
            model: { providerID: model.providerID, modelID: model.api.id },
            agent: "orchestrator",
            byteMaterializationProjectID: agentSession.projectID,
            noReply: true,
            parts: creatorPartsWithIds,
          })
        }
        installedRuntimeContract = SessionPrompt.setSessionRuntimeContract(
          agentSession.id,
          {
            identity: {
              identityKind: "projected-scheduler",
              sessionID: agentSession.id,
              ...schedulerCapability.identity,
              expertSquadID: schedulerCapability.expertSquadID,
              packageRevision: schedulerCapability.packageRevision,
              taskID,
              contractKind: "orchestrator-wake",
              ...(terminalConversation
                ? {
                    taskIngressID: terminalConversationAuthority.ingressID,
                    taskIngressKind: terminalConversationAuthority.ingressKind,
                  }
                : wakeID && event
                  ? { taskIngressID: wakeID, taskIngressKind: queuedTaskIngressSourceKind(event) }
                  : {}),
              ...(currentVisibleInputMessageID ? { inputMessageID: currentVisibleInputMessageID } : {}),
              installedAt: Date.now(),
            },
            projectedTools: guard.tools as any,
            projectedRegistryToolIDs: schedulerCapability.builtInToolIDs,
            skillProjection,
            harnessProjection: PromptProfileResolver.schedulerHarnessProjection({
              taskID,
              capability: schedulerCapability,
            }),
            projectDirectory: schedulerProjectDirectory,
            includeMcpTools: false,
            system: resolveRuntimeSystem,
            systemMode: "complete",
            // A follow-up durable ingress is an explicit runtime wake. The
            // creator occurrence is carried by its real user Message, so it
            // reaches the same boundary through Session standby instead of
            // arming a second wake during that Message's commit.
            runOnce: terminalConversation || !appendCreatorMessage,
            resources: { mcp: schedulerMcpOwner },
          },
          { armWake: !currentVisibleInputMessageID, notifyWake: !currentVisibleInputMessageID },
        )
        if (!installedRuntimeContract) {
          throw new Error(`Orchestrator Session ${agentSession.id} runtime contract was not installed`)
        }
        const runtimeContract = installedRuntimeContract
        schedulerMcpOwnerTransferred = true
        promptInFlight = true
        if (currentControlMessage) {
          const materialized = await materializeOrReuseCurrentOrchestratorControlMessage({
            session: agentSession,
            model: { providerID: model.providerID, modelID: model.api.id },
            control: currentControlMessage,
            beforeVisibilityEffects: () =>
              Database.effect(() => {
                SessionPrompt.armSessionRuntimeContractWake(agentSession.id, runtimeContract)
                runtimeWakeArmed = true
              }),
          })
          if (materialized === "reused") {
            const latestUserMessageID = await latestSessionUserMessageID(agentSession.id)
            if (latestUserMessageID !== currentControlMessage.messageID) {
              throw new Error(
                `Orchestrator control Message ${currentControlMessage.messageID} is not the current visible input for ` +
                  `${agentSession.id}; latest user Message is ${latestUserMessageID ?? "<none>"}`,
              )
            }
            SessionPrompt.armSessionRuntimeContractWake(agentSession.id, runtimeContract)
            runtimeWakeArmed = true
          }
        } else if (currentSchedulerInputMessageID) {
          const currentMessage = await MessageStore.get({
            sessionID: agentSession.id,
            messageID: currentSchedulerInputMessageID,
          })
          if (currentMessage.info.role !== "user") {
            throw new Error(`Scheduler input Message ${currentSchedulerInputMessageID} must have role=user.`)
          }
          const latestUserMessageID = await latestSessionUserMessageID(agentSession.id)
          if (latestUserMessageID !== currentSchedulerInputMessageID) {
            throw new Error(
              `Scheduler input Message ${currentSchedulerInputMessageID} is not the current visible input for ` +
                `${agentSession.id}; latest user Message is ${latestUserMessageID ?? "<none>"}`,
            )
          }
          SessionPrompt.armSessionRuntimeContractWake(agentSession.id, runtimeContract)
          runtimeWakeArmed = true
        }
        finalMessage = await SessionContext.provide(agentSession, () =>
          provideInitializedProjectExecution({
            directory: agentSession.directory,
            fn: () =>
              runOrchestratorPromptWithInactivity({
                taskID,
                session: agentSession,
                run: async () => {
                  promptInvocationStarted = true
                  const result = appendCreatorMessage
                    ? ((await SessionPrompt.prompt({
                        sessionID: agentSession.id,
                        author: taskCreator.actor,
                        model: { providerID: model.providerID, modelID: model.api.id },
                        agent: "orchestrator",
                        byteMaterializationProjectID: agentSession.projectID,
                        parts: partsWithIds,
                      })) as Message.WithParts)
                    : ((await SessionPrompt.loop({
                        sessionID: agentSession.id,
                        ...(currentVisibleInputMessageID ? { reply_to_message_id: currentVisibleInputMessageID } : {}),
                      })) as Message.WithParts)
                  // SessionPrompt.prompt/loop resolves the attached caller at
                  // the first assistant reply, while one logical Orchestrator
                  // wake may continue through tool-result turns. Do not
                  // release the durable root-wake queue until the creator
                  // cycle reaches standby or the explicit follow-up runtime
                  // wake is consumed. Otherwise a later Mission/scheduler
                  // ingress can relabel the previous continuation and be
                  // falsely settled without ever reaching the model.
                  if (runtimeContract.runOnce) {
                    await SessionPrompt.waitForSessionRuntimeContractWakeSettlement(agentSession.id, runtimeContract)
                  } else {
                    await waitForOrchestratorCycleBoundary(agentSession)
                  }
                  return result
                },
              }),
          }),
        )
        promptInFlight = false
      } finally {
        // SessionPrompt cancellation rejects attached callers before its
        // background loop finishes unwinding the active model-turn owner.
        // Exceptional exits therefore have to settle that exact run-once
        // Turn, or join a failed prompt owner, before the runtime contract can
        // be cleared. A persistent owner that successfully returned to
        // standby deliberately remains alive and must not be awaited as a
        // finished Session.
        if (promptInFlight) {
          if (installedRuntimeContract?.runOnce && runtimeWakeArmed && SessionPrompt.hasGeneration(agentSession.id)) {
            try {
              await SessionPrompt.waitForSessionRuntimeContractWakeSettlement(agentSession.id, installedRuntimeContract)
            } catch {
              await SessionPrompt.waitForFinish(agentSession.id, agentSession.directory)
            }
          } else if (promptInvocationStarted) {
            await SessionPrompt.waitForFinish(agentSession.id, agentSession.directory)
          }
        }
        const resources = SessionPrompt.clearSessionRuntimeContract(agentSession.id)
        await resources?.mcp.close()
        errorUnsub()
        executionSignal.removeEventListener("abort", abortPrompt)
      }

      const assistantInfo = finalMessage?.info as Message.Assistant | undefined
      log.info("orchestrator finished", {
        taskID,
        note: event?.note,
        sessionID: agentSession.id,
        finishReason: assistantInfo?.finish,
        streamErrors: streamErrors.length,
      })

      if (finalMessage) {
        const hardError = buildHardErrorFromFinalMessage({
          kind: "orchestrator",
          agentName: "orchestrator",
          finalMessage,
          effectiveOutputLimit: ProviderTransform.maxOutputTokens(model),
        })
        if (hardError) throw hardError
      }

      const taskTerminal = !executionSignal.aborted && streamErrors.length === 0 && isTaskTerminal(requireTask(taskID))
      if (taskTerminal) {
        await publishSessionStatus(
          agentSession,
          { type: "terminal", reason: "completed" },
          { promptGenerationOwner: finalMessagePromptOwner() },
        )
      }

      if (finalMessage) {
        await recordToolExecuteErrorsForFinalMessage({
          taskID,
          finalMessage,
        })
      }
      if (AgentTrace.isEnabled()) {
        recordOrchestratorTurnTraceBestEffort(agentSession, {
          sessionID: agentSession.id,
          parentSessionID: task.session_id ?? undefined,
          taskID,
          agentName: "orchestrator",
          kind: "orchestrator_wake",
          finishReason: assistantInfo?.finish,
          finalMessageID: finalMessage?.info.id,
          streamErrors: streamErrors.map((e) => ({ reason: e.reason, name: e.errorName })),
        })
      }

      // Stream failures (mid-stream protocol violations, provider onError,
      // session-llm idle abort) are recorded as an append-only artifact.
      // Per rule 23 we do NOT transition the task to `failed` here AND we
      // do NOT auto-rewake — both are state-machine reactions. The next
      // external wake re-enters processTask; the LLM reads the abort fact
      // via describe and decides itself (retry, re-dispatch, manage_task
      // action=fail_task, or ask the operator).
      if (streamErrors.length > 0) {
        const first = streamErrors[0]
        const reason = `${first?.errorName ?? "stream-error"}: ${first?.reason ?? "unknown"}`
        log.warn("orchestrator stream failure surfaced as artifact", {
          taskID,
          streamErrors: streamErrors.length,
          firstFailureName: first?.errorName,
        })
        const { recordOrchestratorStreamError } = await import("@/engine/persist")
        const now = Date.now()
        recordOrchestratorStreamError({
          taskID,
          reason,
          errorName: first?.errorName,
          sessionID: agentSession.id,
          now,
        })
      }
      return finalMessage?.info.id
    } catch (error) {
      // SessionLoop persists its own assistant parts; no explicit flush
      // equivalent for the post-phase-3 the pre-migration runtime hooks path.
      //
      // Three distinct catch paths share this handler:
      //  (1) Scheduler startup failure before this wake materializes a
      //      message. Settled below through durable infrastructure, Session,
      //      and Task terminal facts.
      //  (2) Hard failure after a message exists — provider 4xx, stream
      //      protocol violation, tool exec error. Recorded as an
      //      orchestrator-stream-error artifact AND stamped on task.error
      //      so the UI surfaces "task is broken" and orphan-recovery can
      //      see the cause.
      //  (3) Physical wake cancellation mid-prompt — an exact root/child
      //      prompt controller or `cancelTask` requested cancellation.
      //      SessionPromptState.cancel rejected the prompt with the structured
      //      ExecutionCancellationError contract, which lands here.
      //      Previously the handler returned silently on executionSignal.aborted,
      //      so the next wake's describe block had no record of the in-flight
      //      turn being killed — the LLM saw a half-conversation with
      //      dangling tool_use blocks and no signal it had been pre-empted.
      //      Per rule 23 the artifact is the single source of truth for
      //      stream failures; the next wake reads it via describe and
      //      decides whether to retry / restart / fail. We do NOT stamp
      //      task.error on an abort: aborts are control-flow signals,
      //      not task-broken states.
      const wasCtrlAborted = executionSignal.aborted
      // A second wake may attach to the Session while the current prompt owner
      // is still unwinding. Its natural closure rejects that attached caller
      // with this exact disposition; the occurrence is not a provider,
      // scheduler, or Task failure. The queued wake remains authoritative and
      // will reconstruct current facts on its own turn.
      if (error instanceof SessionPromptLoopFinishedError && !wasCtrlAborted) {
        log.info("orchestrator prompt owner closed before attached wake produced a result", {
          taskID,
          note: event?.note,
          promptSessionID: error.sessionID,
        })
        throw error
      }
      const structured = serializeOrchestratorTaskError(error)
      const latestMessageID = agentSessionID ? await latestSessionMessageID(agentSessionID) : undefined
      const failedBeforeMessageMaterialized =
        !wasCtrlAborted && (!agentSessionID || latestMessageID === wakeStartMessageID)
      const abortReasonText = (() => {
        if (!wasCtrlAborted) return undefined
        const reason = executionSignal.reason
        if (typeof reason === "string" && reason.length > 0) return reason
        if (reason instanceof Error && reason.message) return reason.message
        return "orchestrator aborted"
      })()
      const logLevel = wasCtrlAborted ? log.info : log.error
      logLevel(wasCtrlAborted ? "orchestrator aborted mid-prompt" : "orchestrator failed", {
        taskID,
        note: event?.note,
        errorName: wasCtrlAborted ? "OrchestratorAborted" : structured.envelope.errorName,
        error: wasCtrlAborted ? abortReasonText : structured.message,
        data: wasCtrlAborted ? undefined : structured.envelope.data,
      })
      if (AgentTrace.isEnabled() && agentSessionInfo) {
        recordOrchestratorTurnTraceBestEffort(agentSessionInfo, {
          sessionID: agentSessionInfo.id,
          taskID,
          agentName: "orchestrator",
          kind: "orchestrator_wake_failure",
          error: wasCtrlAborted ? abortReasonText : structured.message,
        })
      }
      if (terminalConversation) throw error
      if (failedBeforeMessageMaterialized) {
        await settleOrchestratorStartupFailure({
          taskID,
          session: agentSessionInfo,
          envelope: structured.envelope,
          taskError: structured.taskError,
        })
        return
      }
      if (agentSessionID) {
        if (error instanceof AgentRunError) {
          await recordOrchestratorSessionHardError({
            taskID,
            sessionID: agentSessionID,
            error,
          })
        } else if (wasCtrlAborted) {
          // Abort path: synthesize an envelope from the ctrl reason so the
          // artifact records the explicit cancellation reason — the next wake's
          // describe needs to know WHY the prior turn was interrupted, not just
          // that it threw an opaque "session cancelled" Error from
          // SessionPromptState.cancel.
          await recordOrchestratorSessionErrorEnvelope({
            taskID,
            sessionID: agentSessionID,
            envelope: {
              errorName: "OrchestratorAborted",
              message: abortReasonText ?? "orchestrator aborted",
            },
            summaryPrefix: "Orchestrator aborted mid-prompt",
          })
        } else if (promptInFlight) {
          await recordOrchestratorSessionErrorEnvelope({
            taskID,
            sessionID: agentSessionID,
            envelope: structured.envelope,
            summaryPrefix: "Orchestrator prompt error",
          })
        }
      }
      // A non-abort provider/runtime failure has ended this physical
      // Orchestrator execution window. Internal LLM Activity retries are
      // already exhausted here; there is no remaining prompt owner and no
      // automatic wake. Persist terminal Session/Task truth and require an
      // explicit Retry/Replan to open another execution window.
      if (!wasCtrlAborted) {
        try {
          await settleOrchestratorExecutionFailure({
            taskID,
            session: agentSessionInfo,
            inputMessageID: agentSessionID
              ? SessionStatus.executionOccurrence(agentSessionID)?.inputMessageID
              : undefined,
            envelope: structured.envelope,
            taskError: structured.taskError,
          })
        } catch (settlementError) {
          if (!(settlementError instanceof NotFoundError)) throw settlementError
        }
      }
    } finally {
      if (schedulerMcpOwner && !schedulerMcpOwnerTransferred) await schedulerMcpOwner.close()
    }
  }
}

async function sessionHasCreatorMessage(sessionID: string): Promise<boolean> {
  for await (const item of MessageStore.stream(sessionID)) {
    if (item.info.role !== "user") continue
    const extra = item.info.extra as
      | {
          task_root_message?: unknown
          orchestrator_control_ingress?: unknown
        }
      | undefined
    if (!extra?.task_root_message && !extra?.orchestrator_control_ingress) return true
  }
  return false
}

export function orchestratorUserText(task: Pick<TaskRow, "request"> & Partial<Pick<TaskRow, "id">>): string {
  return renderUserRequestSection({ heading: "# User Request", request: task.request, taskID: task.id })
}

export function renderTaskRuntimeDirectory(projectDirectory: string): string {
  return [
    "## Task Runtime Directory",
    `- Exact current Task directory: ${projectDirectory}`,
    "- Resolve repository reads, writes, commands, and audit copies from this exact operating-system-native directory or from paths relative to it.",
  ].join("\n")
}

export function renderWakeProvenanceNotice(event?: OrchestratorEvent, taskID?: string, wakeID?: string): string {
  const lines = [
    "## Wake Provenance",
    "这是一条 wake 消息，不是用户发送的新消息。",
    "This is a wake message, not a user-authored message.",
  ]
  if (wakeID) lines.push(`Current durable wake occurrence=${wakeID}.`)
  let currentIngressCount = 0

  if (event?.taskWaitActivity) {
    currentIngressCount += 1
    lines.push(
      `Current taskWaitActivity: source=${event.taskWaitActivity.source}; ` +
        `detail=${event.taskWaitActivity.detail}; job_ids=${event.taskWaitActivity.jobIDs.join(",")}. ` +
        "This accepted activity occurrence ended the named scheduled Task wait and triggered the current wake. Decide only from the current Task snapshot; the occurrence itself is not a scheduler outcome or fresh operator authorization.",
    )
  }

  if (event?.taskWaitWake) {
    currentIngressCount += 1
    lines.push(
      `Current taskWaitWake: job_id=${event.taskWaitWake.jobID}; ` +
        `fire_id=${event.taskWaitWake.fireID}; due_at=${new Date(event.taskWaitWake.dueAt).toISOString()}. ` +
        "This exact one-shot wait occurrence triggered the current wake. Decide from the current durable Task snapshot; retry delivery of this occurrence is not a new scheduling occurrence or fresh operator authorization.",
    )
  }

  if (event?.rootMessage) {
    currentIngressCount += 1
    lines.push(
      `Current rootMessage=${event.rootMessage.messageID}; kind=${event.rootMessage.kind}. This exact real-participant message is the current input for this wake. ${event.rootMessage.schedulerDelivery ? "It is the visible current input in the Orchestrator conversation; act on it directly." : "Read it through read_task_message before any wait or lifecycle decision."} Do not infer its contents from older conversation history.`,
    )
    if (event.rootMessage.schedulerDelivery) {
      lines.push(
        `Current scheduler delivery event_id=${event.rootMessage.schedulerDelivery.eventID}; inbox_id=${event.rootMessage.schedulerDelivery.inboxID}; thread_id=${event.rootMessage.schedulerDelivery.threadID}. Use that exact event_id as reply_to when the real Message is a scheduler request.`,
      )
    }
  }

  if (event?.taskIntent) {
    currentIngressCount += 1
    const { kind, actor, supersededOperatorMessageIDs } = event.taskIntent
    lines.push(
      `Current taskIntent=${kind}; actor=${actor}. This is a ${actor}-issued current wake intent, not user-authored text.`,
    )
    if (supersededOperatorMessageIDs.length > 0) {
      lines.push(
        `Ordered superseded operator messages=${supersededOperatorMessageIDs.join(",")}. These exact identities preserve real participant ingress that the Retry/Replan transaction retired from delivery; use them in this order without any Host-prescribed tool workflow.`,
      )
    }
    if (kind === "retry") {
      lines.push(
        `The ${actor} requested a fresh scheduling decision for the same Task from the latest durable snapshot. This Retry opened a new non-terminal execution occurrence and superseded the prior terminal lifecycle outcome as the current Task state. Historical failure and completion decisions remain evidence, but they are not a lifecycle action in this wake. Retry does not prescribe success or worker dispatch: choose the current evidence-backed outcome. ${renderCurrentOccurrenceDecisionObligation()}`,
      )
    } else if (kind === "replan") {
      lines.push(
        `The ${actor} requested a fresh planning decision from the latest durable snapshot. This Replan opened a new non-terminal execution occurrence and superseded the prior terminal lifecycle outcome as the current Task state. Re-evaluate the current Goal graph and evidence; change the graph only when that evidence supports it. ${renderCurrentOccurrenceDecisionObligation()}`,
      )
    }
  }

  if (event?.missionAcceptanceResume) {
    currentIngressCount += 1
    const resume = event.missionAcceptanceResume
    lines.push(
      `Current missionAcceptanceResume: mission_id=${resume.missionID}; mission_session_id=${resume.missionSessionID}; ` +
        `message_id=${resume.messageID}; reviewed_terminal_event=${resume.reviewedTerminalLifecycleReference.terminalEventID}; ` +
        `evidence_locators=${JSON.stringify(resume.evidenceLocators)}. ` +
        `This exact Mission-authored acceptance gap opened a new non-terminal execution occurrence for the same Task. Use the real Message identified above when deciding, without a Host-prescribed retrieval tool. If a successor needs a session_message evidence locator, pair this Message with its actual Task-root Session authority; mission_session_id is origin provenance, not the producing Session. Preserve the Task's fixed Expert Squad and existing workflow binding, then use current Task and Artifact evidence to choose the responsible existing lineage for repair and fresh review. The Host does not prescribe a worker, verdict, or completion outcome.`,
      renderCurrentOccurrenceDecisionObligation(),
    )
  }

  if (event?.coordinationRequest) {
    currentIngressCount += 1
    lines.push(
      `Current coordinationRequest=${event.coordinationRequest.requestID}. This exact pending request is current ingress for this wake; decide it from the bound coordination and Task evidence rather than from historical requests.`,
    )
  }

  if (event?.processRecovery) {
    currentIngressCount += 1
    if (!taskID) throw new Error("Process recovery wake provenance requires Task identity")
    const recovery = describeProcessRecoveryFact(taskID, event.processRecovery.recoveryFactID)
    lines.push(
      `Current processRecovery=${event.processRecovery.recoveryFactID}; physical_evidence=${JSON.stringify(recovery.physical_evidence)}; ` +
        `affected_subjects=${JSON.stringify(recovery.affected_subjects)}. This exact infrastructure occurrence triggered the current wake. ` +
        `Continue or repair only the referenced input-message/descriptor/dispatch authorities; created-only subjects have no fabricated execution lifecycle.`,
    )
  }

  if (event?.dispatchInfrastructureFailure) {
    currentIngressCount += 1
    const failure = event.dispatchInfrastructureFailure
    lines.push(
      `Current dispatchInfrastructureFailure=${failure.infrastructureFactID}; typed_outcome=${JSON.stringify(failure.outcome)}. ` +
        "This exact accepted worker dispatch failed during physical settlement. Use its Artifact locator, Worker Turn descriptor, and recovery authority as the current infrastructure ingress; do not infer a terminal worker lifecycle or create a second failure fact.",
    )
  }

  if (event?.agentLifecycleDelivery) {
    currentIngressCount += 1
    const delivery = event.agentLifecycleDelivery
    const lifecycle = requireCurrentAgentLifecycleFact(delivery, taskID)
    lines.push(
      `CURRENT LIFECYCLE CONTROL FACT: event_id=${delivery.eventID}; session_id=${delivery.sessionID}; ` +
        `dispatch_id=${delivery.dispatchID}; input_message_id=${lifecycle.inputMessageID}; ` +
        `authoritative_status=${lifecycle.status.type}/${lifecycle.status.reason}; ` +
        "physical_turn_state=settled; " +
        `emitted_at=${new Date(lifecycle.emittedAt).toISOString()}; ` +
        `summary=${JSON.stringify(lifecycle.summary)}; error=${JSON.stringify(lifecycle.status.error ?? null)}. ` +
        "This exact terminal lifecycle fact triggered the current wake. The referenced worker is not streaming, running, or awaiting completion. " +
        "Any earlier assistant text or wait reason that described this dispatch as nonterminal is expired historical context; this terminal fact satisfies that wait, so never repeat, extend, or reschedule it for this dispatch. " +
        "The current visible control Turn is authored by the orchestrator and does not quote or impersonate the worker. Use this canonical fact with the current workflow, dispatch lineage, and Artifact snapshot without replacing those authorities, then record the next scheduling or lifecycle decision with its matching real tool call before this decision pass ends.",
    )
  }

  if (currentIngressCount === 0) {
    lines.push(
      "This wake contains no typed current ingress. Historical user messages, retry requests, Task intents, lifecycle occurrences, and coordination requests remain audit history only; do not describe them as what the user currently asks or reuse them as fresh authorization.",
    )
    lines.push(
      "On the initial Task wake, the creator request is already the normal `# User Request` in this Turn. It has no task-root message identity. Read that real participant message directly.",
    )
  } else {
    lines.push(
      "Only the current ingress facts listed above authorize this wake. Other historical messages, retry/replan intents, and coordination requests remain audit evidence, not additional current requests.",
    )
  }

  return lines.join("\n")
}

export type CurrentOrchestratorControlMessage = {
  messageID: string
  partID: string
  text: string
  extra: {
    orchestrator_control_ingress: {
      wake_id: string
      source_kind: "agent_lifecycle_delivery" | "dispatch_infrastructure_failure"
      fact_id: string
    }
  }
  partMetadata: {
    wake_id: string
    source_kind: "agent_lifecycle_delivery" | "dispatch_infrastructure_failure"
    fact_id: string
  }
}

/**
 * Exact terminal control occurrences have no participant-authored source
 * Message of their own. Persist one visible Orchestrator-authored input so
 * the provider's current conversation tail and the product transcript carry
 * the same ingress. The durable queued wake and referenced fact remain the
 * only scheduler authorities; this Message is their delivery projection.
 */
export function currentOrchestratorControlMessage(
  event?: OrchestratorEvent,
  taskID?: string,
  wakeID?: string,
): CurrentOrchestratorControlMessage | undefined {
  const sourceKind = event?.agentLifecycleDelivery
    ? ("agent_lifecycle_delivery" as const)
    : event?.dispatchInfrastructureFailure
      ? ("dispatch_infrastructure_failure" as const)
      : undefined
  if (!sourceKind) return undefined
  const exactWakeID = wakeID?.trim()
  if (!exactWakeID) throw new Error(`${sourceKind} requires exact durable wake identity`)
  const factID =
    sourceKind === "agent_lifecycle_delivery"
      ? event!.agentLifecycleDelivery!.eventID
      : event!.dispatchInfrastructureFailure!.infrastructureFactID
  const identity = {
    wake_id: exactWakeID,
    source_kind: sourceKind,
    fact_id: factID,
  }
  return {
    messageID: `msg_orchestrator_control_${exactWakeID}`,
    partID: `prt_orchestrator_control_${exactWakeID}`,
    text: ["## Orchestrator Control Occurrence", renderWakeProvenanceNotice(event, taskID, exactWakeID)].join("\n\n"),
    extra: { orchestrator_control_ingress: identity },
    partMetadata: identity,
  }
}

export async function materializeOrReuseCurrentOrchestratorControlMessage(input: {
  session: Session.Info
  model: { providerID: string; modelID: string }
  control: CurrentOrchestratorControlMessage
  beforeVisibilityEffects?: () => void
}): Promise<"created" | "reused"> {
  let existing: Message.WithParts | undefined
  let disposition: "created" | "reused" = "reused"
  try {
    existing = await MessageStore.get({ sessionID: input.session.id, messageID: input.control.messageID })
  } catch (error) {
    if (!NotFoundError.isInstance(error as Error)) throw error
  }
  if (!existing) {
    disposition = "created"
    await SessionPrompt.prompt(
      {
        sessionID: input.session.id,
        messageID: input.control.messageID,
        author: "orchestrator",
        model: input.model,
        agent: "orchestrator",
        byteMaterializationProjectID: input.session.projectID,
        noReply: true,
        extra: input.control.extra,
        parts: [
          {
            id: input.control.partID,
            type: "text",
            text: input.control.text,
            kind: "control",
            source: "system",
            metadata: input.control.partMetadata,
          },
        ],
      },
      { beforeVisibilityEffects: input.beforeVisibilityEffects },
    )
    existing = await MessageStore.get({ sessionID: input.session.id, messageID: input.control.messageID })
  }
  const part = existing.parts[0]
  const valid =
    existing.info.role === "user" &&
    existing.info.author === "orchestrator" &&
    existing.info.agent === "orchestrator" &&
    JSON.stringify(existing.info.extra) === JSON.stringify(input.control.extra) &&
    existing.parts.length === 1 &&
    part?.id === input.control.partID &&
    part.type === "text" &&
    part.text === input.control.text &&
    part.kind === "control" &&
    part.source === "system" &&
    JSON.stringify(part.metadata) === JSON.stringify(input.control.partMetadata)
  if (!valid) {
    throw new Error(
      `Orchestrator control Message ${input.control.messageID} does not match exact wake ${input.control.partMetadata.wake_id}`,
    )
  }
  return disposition
}

export function isCurrentWakeIngress(event?: OrchestratorEvent): boolean {
  return Boolean(
    event?.rootMessage ||
      event?.taskIntent ||
      event?.missionAcceptanceResume ||
      event?.coordinationRequest ||
      event?.taskWaitActivity ||
      event?.taskWaitWake ||
      event?.processRecovery ||
      event?.agentLifecycleDelivery ||
      event?.dispatchInfrastructureFailure,
  )
}

function requireCurrentAgentLifecycleFact(
  delivery: NonNullable<OrchestratorEvent["agentLifecycleDelivery"]>,
  taskID?: string,
) {
  const exact = ProtocolStore.requireEvent(delivery.eventID)
  if (exact.type !== SessionStatus.Event.Status.type) {
    throw new Error(`Agent lifecycle delivery ${delivery.eventID} references ${exact.type}`)
  }
  if (taskID && exact.taskID !== taskID) {
    throw new Error(`Agent lifecycle delivery ${delivery.eventID} belongs to Task ${exact.taskID ?? "<none>"}`)
  }
  const payloadSessionID = typeof exact.payload?.sessionID === "string" ? exact.payload.sessionID : undefined
  if (exact.sessionID !== delivery.sessionID || payloadSessionID !== delivery.sessionID) {
    throw new Error(`Agent lifecycle delivery ${delivery.eventID} Session identity drifted`)
  }
  const inputMessageID = typeof exact.payload?.inputMessageID === "string" ? exact.payload.inputMessageID.trim() : ""
  if (!inputMessageID) throw new Error(`Agent lifecycle delivery ${delivery.eventID} has no input Message identity`)
  const status = SessionStatus.Info.parse(exact.payload?.status)
  if (status.type !== "terminal") {
    throw new Error(`Agent lifecycle delivery ${delivery.eventID} is not terminal`)
  }
  return {
    inputMessageID,
    status,
    emittedAt: exact.time.emitted,
    summary: exact.summary,
  }
}

function renderCurrentOccurrenceDecisionObligation(): string {
  return "Before this decision pass ends, record at least one current scheduling or lifecycle decision with its matching real tool call; a prose-only response, a copied historical terminal summary, or a claim that the Task is still completed/cancelled does not settle this active occurrence."
}

// ---------------------------------------------------------------------------
// System prompt — split into stable instructions (cacheable) and dynamic context
// ---------------------------------------------------------------------------

/** Static instructions that never change between invocations. */
const ORCHESTRATOR_INSTRUCTIONS = withObservableWorkNarrative(ORCHESTRATOR_CORE)

/**
 * Build the orchestrator system prompt as a two-part array:
 *   [0] = static instructions (stable, benefits from 1h cache TTL)
 *   [1] = dynamic context — Task, Delivery Slice, budget, metric, review,
 *         Session, and Artifact facts. All are derived from durable storage. A scheduler
 *         wake projects its exact source Message body directly from the canonical
 *         Message/Part rows; no second transport body is persisted.
 */
async function buildSystemParts(
  task: TaskRow,
  event: OrchestratorEvent | undefined,
  schedulerCapability: PromptProfileResolver.ResolvedSchedulerCapability,
  projectedAgents: readonly PromptProfileResolver.ResolvedProjectedAgent[],
  projectDirectory: string,
): Promise<{ parts: string[]; snapshot: TaskDesc }> {
  await assertTaskRootSessionLineage(task)
  const instructions = appendSchedulerProjectSourceBoundary(
    await PromptProfileResolver.composeResolvedAgentPrompt({
      taskID: task.id,
      projectDirectory,
      base: ORCHESTRATOR_INSTRUCTIONS,
      capability: schedulerCapability,
    }),
  )
  const ctx: string[] = []
  ctx.push(renderTaskRuntimeDirectory(projectDirectory))
  ctx.push("")
  if (event?.rootMessage) {
    ctx.push("## Current Wake Root Message")
    ctx.push(`- message_id=${event.rootMessage.messageID}; kind=${event.rootMessage.kind}`)
    ctx.push(
      event.rootMessage.schedulerDelivery
        ? "- This exact real-participant Message is the visible current input in the Orchestrator conversation. Its body remains in this one Message/Part authority."
        : "- This exact real-participant Message is the current ingress. Its body remains in the original Message/Part authority; read it through read_task_message before acting on this wake.",
    )
    if (event.rootMessage.schedulerDelivery) {
      if (!task.session_id) throw new Error(`Task ${task.id} scheduler wake has no root Session.`)
      const currentMessage = await getTaskRootMessage(task, event.rootMessage.messageID)
      if (currentMessage.info.role !== "user") {
        throw new Error(`Task ${task.id} current scheduler Message is not a user-role participant ingress.`)
      }
      const expectedAuthor = event.rootMessage.kind === "mission" ? "mission" : "orchestrator"
      const provenance = TaskRootMessageProvenance.parse(currentMessage.info.extra?.task_root_message)
      const schedulerEvent = ProtocolStore.requireEvent(event.rootMessage.schedulerDelivery.eventID)
      const schedulerPayload = SchedulerMessagePayload.parse(schedulerEvent.payload)
      if (
        currentMessage.info.author !== expectedAuthor ||
        schedulerEvent.type !== "scheduler.message" ||
        provenance.taskID !== task.id ||
        provenance.kind !== event.rootMessage.kind ||
        provenance.schedulerDelivery?.eventID !== event.rootMessage.schedulerDelivery.eventID ||
        provenance.schedulerDelivery.inboxID !== event.rootMessage.schedulerDelivery.inboxID ||
        schedulerPayload.thread_id !== event.rootMessage.schedulerDelivery.threadID ||
        schedulerEvent.replyTo !== event.rootMessage.schedulerDelivery.replyTo
      ) {
        throw new Error(`Task ${task.id} current scheduler Message provenance does not match its wake occurrence.`)
      }
      const body = currentMessage.parts
        .filter((part): part is Message.TextPart => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim()
      if (!body) throw new Error(`Task ${task.id} current scheduler Message has no visible text body.`)
      ctx.push(
        `- scheduler_event_id=${event.rootMessage.schedulerDelivery.eventID}; scheduler_inbox_id=${event.rootMessage.schedulerDelivery.inboxID}; thread_id=${event.rootMessage.schedulerDelivery.threadID}`,
      )
      ctx.push(
        `- message_kind=${schedulerPayload.message_kind}; subject=${JSON.stringify(schedulerPayload.subject)}; source_endpoint=${schedulerEvent.source}; reply_to=${schedulerEvent.replyTo ?? "<none>"}`,
      )
      ctx.push(
        `- The canonical Message is the visible current user input in the Orchestrator Session (body length ${body.length}). Act on this exact envelope and body now.${schedulerPayload.message_kind === "request" ? ` Reply through scheduler_message with kind=reply and reply_to=${event.rootMessage.schedulerDelivery.eventID}.` : ""}`,
      )
    }
    ctx.push("")
  }
  if (event?.missionAcceptanceResume) {
    ctx.push("## Current Mission Acceptance Resume")
    ctx.push(
      `- message_id=${event.missionAcceptanceResume.messageID}; mission_id=${event.missionAcceptanceResume.missionID}`,
    )
    ctx.push(
      "- Read the exact visible Mission message before deciding. This is a current same-Task repair authority tied to the reviewed terminal occurrence and evidence locators shown in Wake Provenance.",
    )
    ctx.push("")
  }
  ctx.push("## Active Projected Worker Identities")
  ctx.push(
    "`dispatch_agent.dispatch.target` accepts only the exact agent IDs below. Choose responsibility from each projection's label, description, target schema, and the active package collaboration contract. `base_role` and `dispatch_adapter_id` are template metadata, never aliases or scheduler order.",
  )
  for (const projectedAgent of projectedAgents.toSorted((left, right) =>
    left.identity.agentID.localeCompare(right.identity.agentID),
  )) {
    const adapterFields = DispatchAdapterContractRegistry.inputFieldNames(projectedAgent.identity.dispatchAdapterID)
    ctx.push(
      `- target=${projectedAgent.identity.agentID}; label=${JSON.stringify(projectedAgent.label)}; description=${JSON.stringify(projectedAgent.description ?? "")}; base_role=${projectedAgent.identity.baseRole}; dispatch_adapter_id=${projectedAgent.identity.dispatchAdapterID}; target_fields=${adapterFields.join(",")}`,
    )
  }
  ctx.push(
    "- Call `dispatch_agent` with one target-discriminated `dispatch` object. For a first node occurrence, set `turn.kind=initial`, put the exact workflow subject in `turn.workflow_subject`, and put only the selected row's `target_fields` in `turn.input`; `target`, `work_scope`, and `use_worktree` remain dispatch-level fields. Put the complete bounded worker instruction in `turn.input.reason` when that row lists `reason`; never copy fields from another target. For a successor Turn, set `turn.kind=continuation`, choose exactly one typed `turn.authority` (`coordination_action` or `prior_dispatch`), and provide only incremental `turn.guidance` plus exact `turn.evidence_locators`; never invent placeholder guidance or a lineage identity.",
  )
  ctx.push("")
  // ── Recovery discipline ──
  // Rendered as one invariant instead of a configuration mode: the orchestrator
  // reads facts and routes one Build repair attempt without a Host retry gate.
  ctx.push("## Recovery Discipline")
  ctx.push(
    "- One fixed-Squad Task owns one complete Phase. Inspect immutable dispatch lineage after a failed or interrupted mandatory node. A dependency-ready node with occurrence_not_committed uses its one initial dispatch; a node with occurrence_committed continues only through its exact dispatch ID. Build never replaces another node's terminal-success evidence or Artifact. After all mandatory predecessors and the Build owner's initial occurrence succeed, route a downstream blocking product or final-deliverable finding to the exact package-owned Build or final-delivery owner.",
  )
  ctx.push(
    "- An Integrity concerns verdict whose findings are all advisory is acceptable improvement evidence. Preserve those findings as residual risk; do not dispatch Build or fail the current Task for them.",
  )
  ctx.push(
    "- Inspect immutable dispatch lineage before phase closure. Dispatch the closure owner only when no closure occurrence exists; otherwise continue or judge that exact lineage. Require implementation, repair, and affected verification until the deliverable exists or the blocker is proven irreducible. If the initial canonical package Artifact exists, read and select it but do not publish a parallel copy; use the terminal Build result plus Host-observed diffs, commands, and checks as closure evidence.",
  )
  ctx.push(
    "- Resolve dismissed or unanswered questions through reversible evidence-backed assumptions when possible. Inspect extra commits and moving HEAD against task-owned paths and current behavior, preserve unrelated changes, and route real overlap to Build; commit count or provenance uncertainty alone is not failure evidence.",
  )
  ctx.push(
    "- A local runtime, process, provider, projected-worker, repository, or Tool failure is infrastructure recovery evidence, not operator authority. Never turn it into a continue-or-stop Question and never fail the business Task merely because one repair attempt failed. After repair, use initial for a dependency-ready occurrence_not_committed node or the exact dispatch ID for an occurrence_committed continuation; otherwise expose the concrete active infrastructure blocker through the named recovery and lifecycle surfaces.",
  )
  ctx.push("")

  // ── Scheduler child task context ──
  // Scheduler-child metadata carries lineage and optional scope hints only.
  // It is not an evidence channel. Evidence-dependent stages are owned by a
  // Mission and consume exact Artifact imports on their target Task.
  const meta = (task.metadata as Record<string, unknown> | null) ?? {}
  const parentTask = typeof meta.parent_task === "string" ? meta.parent_task : undefined
  if (parentTask) {
    const scope = Array.isArray(meta.next_task_scope_files) ? (meta.next_task_scope_files as string[]) : []
    const depth = typeof meta.task_chain_depth === "number" ? meta.task_chain_depth : undefined
    ctx.push("## Scheduler Child Context")
    ctx.push(`- Parent task lineage: ${parentTask}`)
    if (depth !== undefined) ctx.push(`- Task chain depth: ${depth}`)
    if (scope.length > 0) ctx.push(`- Suggested scope (focus area): ${scope.join(", ")}`)
    ctx.push("")
  }

  // ── Metric observations ──
  // engine_iteration stores measurement snapshots. They remain context beside
  // review findings and never encode a dispatch, retry, or completion verdict.
  const iterationHistory = readHistForPrompt(task.id)
  if (iterationHistory.length > 0) {
    const RENDER_RECENT = 3
    const tail = iterationHistory.slice(-RENDER_RECENT)
    ctx.push("## Metric Observations")
    ctx.push(`${iterationHistory.length} prior iteration(s). Last ${tail.length}:`)
    for (const it of tail) {
      const aggregate = it.aggregate_score === null ? "unmeasured" : it.aggregate_score.toFixed(3)
      const delta = it.delta_vs_prev === null ? "unmeasured" : it.delta_vs_prev.toFixed(3)
      ctx.push(
        `  - iter ${it.iteration}: aggregate=${aggregate} (Δ=${delta}), unmet_targets=${it.unmet_target_count}, unmeasured_targets=${it.unmeasured_target_count}, regressed_targets=${it.regressed_target_count}, open_counterexamples=${it.open_counterexamples}, novelty=${it.novelty_score}`,
      )
    }
    ctx.push("")
    ctx.push(
      "These measurements, including unavailable observations, are advisory facts. Interpret them with the Task's " +
        "expert reports, artifacts, tool results, and operator request; they do not prescribe a workflow outcome.",
    )
    ctx.push("")
  }

  // ── Durable Task fact projection ──
  // The describe layer composes the task snapshot from the append-only event
  // stream (Delivery Slice revisions, engine_iteration, domain artifacts,
  // decision_log and answered clarifications). It does NOT read
  // persisted presentation progress — terminal facts come from Task/Session
  // evidence directly. This keeps the LLM's
  // world-view event-sourced: if the cache diverges, the description still
  // reflects reality.
  const snapshot = await describeTask(task.id)
  ctx.push(renderTaskDescription(snapshot))

  return { parts: [instructions, ctx.join("\n")], snapshot }
}
