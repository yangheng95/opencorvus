import { Message } from "./message"
import { Log } from "@/util/log"
import { MessageStore } from "./message-store"
import { Identifier } from "@/id/id"
import { Session } from "."
import { Snapshot } from "@/snapshot"
import { SessionSummary } from "./summary"
import { Bus } from "@/bus"
import { SessionStatus, sessionLifecycleOrderKey } from "./status"
import { Plugin } from "@/plugin"
import type { Provider } from "@/provider/provider"
import { LLM } from "./llm"
import { EffectiveConfig } from "@/config/effective"
import { EngineConfig } from "@/engine/config"
import { CompactionOverflow } from "./compaction-overflow"
import { PermissionAuthority } from "@/permission/authority"
import { abortableIterable } from "@/util/stream-activity"
import {
  withLLMActivity,
  chunkHeartbeatKind,
  DefaultLLMActivityPolicy,
  LLMActivityError,
  type LLMActivityEvent,
  type LLMActivityPolicy,
} from "@/llm/activity"
import {
  ToolPersistenceConvergenceFailure,
  failureOccurrenceAnchor,
  sameFailureOccurrence,
  toolFailureCauseFromMessageError,
  toolFailureCauseFromUnknown,
  type FailureOccurrenceAnchor,
  type ProcessorObservationFailure,
  type ToolFailureCause,
} from "./tool-failure-cause"
import { shouldParkAfterToolResult, toolResultControl, type ToolResultControl } from "./tool-result-control"
import { parsePartialJson } from "ai"
import type { McpAppToolLifecycleController } from "@/interactive-artifact/mcp-app-lifecycle"
import {
  cloneToolInputForPersistence,
  materializeToolResultInlineAttachments,
} from "@/tool/result-attachment-materialization"
import { Instance } from "@/project/instance"
import { persistMessageSources } from "./source-persistence"

export namespace SessionProcessor {
  const DOOM_LOOP_THRESHOLD = 3
  const log = Log.create({ service: "session.processor" })

  export class ProcessorLostPartsError extends Error {
    constructor(public readonly partIDs: string[]) {
      super(`SessionProcessor lost open tool parts: ${partIDs.join(", ")}`)
      this.name = "ProcessorLostPartsError"
    }
  }

  export class ProcessorUnsafeRetryError extends Error {
    constructor(
      public readonly attempt: number,
      public readonly partIDs: string[],
      public override readonly cause: unknown,
    ) {
      const retryCause = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause)
      super(
        `SessionProcessor cannot retry activity attempt ${attempt} inside the same assistant message after tool execution started. Created parts: ${partIDs.join(", ") || "(none)"}. Retry cause: ${retryCause}`,
      )
      this.name = "ProcessorUnsafeRetryError"
    }
  }

  export class ProcessorConvergenceError extends Error {
    constructor(public readonly evidence: ToolPersistenceConvergenceFailure) {
      super(
        `SessionProcessor could not persist the canonical failure on Tool parts: ${evidence.unconverged_part_ids.join(", ")}`,
      )
      this.name = "ProcessorConvergenceError"
    }
  }

  type AssistantMessageSnapshot = {
    cost: number
    tokens: Message.Assistant["tokens"]
    billing?: Message.Assistant["billing"]
    finish?: Message.Assistant["finish"]
    error?: Message.Assistant["error"]
  }

  type AttemptWriteScope = {
    createdPartIDs: Set<string>
    toolCallIDs: Set<string>
    toolExecutionStarted: boolean
    messageSnapshot: AssistantMessageSnapshot
  }

  export type Info = Awaited<ReturnType<typeof create>>
  export type Result = Awaited<ReturnType<Info["process"]>>

  export function create(input: {
    assistantMessage: Message.Assistant
    sessionID: string
    model: Provider.Model
    abort: AbortSignal
  }) {
    const toolcalls: Record<string, Message.ToolPart> = {}
    const mcpAppToolLifecycles = new Map<string, McpAppToolLifecycleController>()
    const mcpAppCalls = new Map<string, McpAppToolLifecycleController>()
    const toolPartLocks = new Map<string, Promise<void>>()
    const toolPauseOwner = (toolCallID: string) => `tool-call:${toolCallID}`

    const withToolPartLock = async <T>(toolCallID: string, fn: () => Promise<T>): Promise<T> => {
      const previous = toolPartLocks.get(toolCallID)
      let release!: () => void
      const current = new Promise<void>((resolve) => {
        release = resolve
      })
      toolPartLocks.set(toolCallID, current)
      try {
        if (previous) await previous.catch(() => {})
        return await fn()
      } finally {
        release()
        if (toolPartLocks.get(toolCallID) === current) toolPartLocks.delete(toolCallID)
      }
    }

    // Resolve the part that already represents `toolCallID` on this assistant
    // message. `toolcalls` only tracks IN-FLIGHT calls â€” the tool-result /
    // tool-error cases delete the entry once a call finishes â€” so a
    // re-delivered tool-call (a provider re-emit, or a retried stream
    // replaying the same response with identical `call_*` ids) finds nothing
    // there, and the handlers below would mint a SECOND part for the same
    // callID. Two parts sharing one callID make `toModelMessages` emit a
    // duplicate provider `tool_call_id`, which the provider rejects with
    // HTTP 400 (`Duplicate value for 'tool_call_id'`). Falling back to the
    // message's persisted parts keeps (messageID, callID) -> exactly one part
    // however many times the call is delivered.
    const priorToolPart = async (toolCallID: string): Promise<Message.ToolPart | undefined> => {
      const warm = toolcalls[toolCallID]
      if (warm) return warm
      const parts = await MessageStore.parts(input.assistantMessage.id)
      return parts.find((p): p is Message.ToolPart => p.type === "tool" && p.callID === toolCallID)
    }

    const openToolParts = async (): Promise<Message.ToolPart[]> => {
      const parts = await MessageStore.parts(input.assistantMessage.id)
      return parts.filter(
        (part): part is Message.ToolPart =>
          part.type === "tool" && (part.state.status === "pending" || part.state.status === "running"),
      )
    }

    const toolStartTime = (part: Message.ToolPart): number => part.state.time.start
    const completedToolTime = (start: number) => ({
      start,
      end: Math.max(Date.now(), start + 1),
    })

    const failToolPart = async (part: Message.ToolPart, failure: ToolFailureCause): Promise<void> => {
      const start = toolStartTime(part)
      await Session.updatePart({
        ...part,
        state: {
          status: "error",
          input: part.state.input,
          failure,
          time: completedToolTime(start),
        },
      })
      delete toolcalls[part.callID]
    }

    const failOpenToolParts = async (failure: ToolFailureCause): Promise<void> => {
      for (const part of await openToolParts()) {
        await failToolPart(part, failure)
      }
    }

    const convergeOpenToolParts = async (
      failure: ToolFailureCause,
      occurrence: FailureOccurrenceAnchor,
    ): Promise<ProcessorConvergenceError | undefined> => {
      let parts: Message.ToolPart[]
      try {
        parts = await openToolParts()
      } catch (error) {
        return new ProcessorConvergenceError(
          ToolPersistenceConvergenceFailure.parse({
            failure_occurrence: occurrence,
            unconverged_part_ids: [],
            write_errors: [],
            inspection_error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          }),
        )
      }
      const writeErrors: Array<{ part_id: string; message: string }> = []
      for (const part of parts) {
        try {
          await failToolPart(part, failure)
        } catch (error) {
          writeErrors.push({
            part_id: part.id,
            message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          })
        }
      }
      let persisted: Message.Part[]
      try {
        persisted = await MessageStore.parts(input.assistantMessage.id)
      } catch (error) {
        return new ProcessorConvergenceError(
          ToolPersistenceConvergenceFailure.parse({
            failure_occurrence: occurrence,
            unconverged_part_ids: [],
            write_errors: writeErrors,
            inspection_error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          }),
        )
      }
      const byID = new Map(persisted.map((part) => [part.id, part]))
      const unconverged = parts.filter((part) => {
        const stored = byID.get(part.id)
        if (stored?.type !== "tool" || stored.state.status !== "error") return true
        const storedOccurrence = stored.state.failure.data?.failure_occurrence as FailureOccurrenceAnchor | undefined
        return !storedOccurrence || !sameFailureOccurrence(storedOccurrence, occurrence)
      })
      for (const part of parts) {
        if (!unconverged.some((candidate) => candidate.id === part.id)) delete toolcalls[part.callID]
      }
      if (writeErrors.length === 0 && unconverged.length === 0) return
      return new ProcessorConvergenceError(
        ToolPersistenceConvergenceFailure.parse({
          failure_occurrence: occurrence,
          unconverged_part_ids: unconverged.map((part) => part.id),
          write_errors: writeErrors,
        }),
      )
    }

    const discardToolInputDraft = async (part: Message.ToolPart, reason: string): Promise<void> => {
      if (part.state.status !== "pending") {
        throw new Error(`Tool input draft ${part.id} is ${part.state.status}, not pending`)
      }
      const lifecycle = mcpAppCalls.get(part.callID)
      if (lifecycle) {
        await lifecycle.cancel(part.callID, part.state.input as Record<string, unknown>, reason)
        mcpAppCalls.delete(part.callID)
      }
      await Session.removePart({
        sessionID: part.sessionID,
        messageID: part.messageID,
        partID: part.id,
      })
      delete toolcalls[part.callID]
    }

    const discardPendingToolInputDrafts = async (reason: string): Promise<void> => {
      const drafts = (await openToolParts()).filter((part) => part.state.status === "pending")
      for (const draft of drafts) await discardToolInputDraft(draft, reason)
    }

    const completeToolPart = async (
      value: {
        toolCallId: string
        input?: unknown
        output: {
          output: string
          title: string
          metadata: Record<string, unknown>
          attachments?: Message.FilePart[]
          display?: unknown
          sources?: unknown
        }
      },
      onPartCreated: (partID: string) => void = () => {},
    ): Promise<void> => {
      const metadata = value.output.metadata
      const displayParts = Array.isArray(value.output.display) ? value.output.display : []
      const sourcePayloads = Array.isArray(value.output.sources)
        ? value.output.sources.map((source) => Message.SourcePayload.parse(source))
        : []
      await withToolPartLock(value.toolCallId, async () => {
        const match = toolcalls[value.toolCallId] ?? (await priorToolPart(value.toolCallId))
        if (!match || (match.state.status !== "running" && match.state.status !== "pending")) {
          throw new Error(`Open ToolPart not found for Tool call ${value.toolCallId}`)
        }
        const resolvedInput =
          value.input === undefined ? match.state.input : cloneToolInputForPersistence(value.input)
        await Session.updatePart({
          ...match,
          state: {
            status: "completed",
            input: resolvedInput,
            output: value.output.output,
            metadata,
            title: value.output.title,
            time: completedToolTime(toolStartTime(match)),
            attachments: value.output.attachments,
          },
        })
        delete toolcalls[value.toolCallId]
        if (displayParts.length > 0) {
          const existingPartIDs = new Set((await MessageStore.parts(input.assistantMessage.id)).map((part) => part.id))
          for (const candidate of displayParts) {
            const displayPart = Message.InteractiveArtifactPart.parse(candidate)
            if (displayPart.sessionID !== input.assistantMessage.sessionID) {
              throw new Error(`tool result display part ${displayPart.id} belongs to a different session`)
            }
            if (displayPart.messageID !== input.assistantMessage.id) {
              throw new Error(`tool result display part ${displayPart.id} belongs to a different message`)
            }
            if (existingPartIDs.has(displayPart.id)) continue
            await Session.updatePart(displayPart)
            existingPartIDs.add(displayPart.id)
            onPartCreated(displayPart.id)
          }
        }
        if (sourcePayloads.length > 0) {
          const persisted = await persistMessageSources({
            sessionID: input.assistantMessage.sessionID,
            messageID: input.assistantMessage.id,
            sources: sourcePayloads,
          })
          for (const part of persisted) onPartCreated(part.id)
        }
      })
      mcpAppCalls.delete(value.toolCallId)
    }

    let snapshot: string | undefined
    let blocked = false
    let needsCompaction = false
    let failureOccurrence: FailureOccurrenceAnchor | undefined
    let convergenceFailure: ToolPersistenceConvergenceFailure | undefined
    const observationFailures: ProcessorObservationFailure[] = []
    let parkAfterToolResult = false
    let coordinationHandoff: Extract<ToolResultControl, { kind: "handoff_drain" }> | undefined
    // Reasoning delta buffer: aggregate per-token deltas into batched SSE updates
    const reasoningDeltaBuf = new Map<string, string>()
    let reasoningFlushTimer: ReturnType<typeof setTimeout> | null = null
    let reasoningFlushOperation: Promise<void> | undefined

    const result = {
      get message() {
        return input.assistantMessage
      },
      partFromToolCall(toolCallID: string) {
        return toolcalls[toolCallID]
      },
      registerMcpAppToolLifecycle(toolName: string, lifecycle: McpAppToolLifecycleController) {
        if (mcpAppToolLifecycles.has(toolName)) {
          throw new Error(`MCP App lifecycle is already registered for tool ${toolName}`)
        }
        mcpAppToolLifecycles.set(toolName, lifecycle)
      },
      async ensureToolPart(toolCallID: string, toolName: string, toolInput: Record<string, unknown>) {
        return withToolPartLock(toolCallID, async () => {
          const existing = await priorToolPart(toolCallID)
          const start = existing ? toolStartTime(existing) : Date.now()
          const part = await Session.updatePart({
            ...(existing ?? {
              id: Identifier.ascending("part"),
              messageID: input.assistantMessage.id,
              sessionID: input.assistantMessage.sessionID,
              type: "tool" as const,
              callID: toolCallID,
              tool: toolName,
            }),
            tool: toolName,
            callID: toolCallID,
            state: {
              status: "running",
              input: toolInput,
              time: { start },
            },
          })
          toolcalls[toolCallID] = part as Message.ToolPart
          return part as Message.ToolPart
        })
      },
      async completeRecoveredToolPart(input: {
        toolCallID: string
        toolInput: unknown
        output: {
          output: string
          title: string
          metadata: Record<string, unknown>
          attachments?: Message.FilePart[]
          display?: unknown
          sources?: unknown
        }
      }) {
        await completeToolPart({
          toolCallId: input.toolCallID,
          input: input.toolInput,
          output: input.output,
        })
      },
      async failRecoveredToolPart(toolCallID: string, failure: ToolFailureCause) {
        await withToolPartLock(toolCallID, async () => {
          const match = toolcalls[toolCallID] ?? (await priorToolPart(toolCallID))
          if (!match || (match.state.status !== "running" && match.state.status !== "pending")) return
          await failToolPart(match, failure)
        })
      },
      async process(streamInput: LLM.StreamInput) {
        log.info("process")
        needsCompaction = false
        const shouldBreak =
          (await EffectiveConfig.effective({ sessionID: input.assistantMessage.sessionID })).experimental
            ?.continue_loop_on_deny !== true
        const idleMs = (await EngineConfig.get()).activity.session_llm_idle_ms
        const canonicalActivityErrors = new Map<unknown, NonNullable<Message.Assistant["error"]>>()
        // Activity owns retries (rule 8 â€” single source). The runner's
        // classifier + per-class maxRetries + totalMs deadline replace the
        // session/retry.ts SessionRetry namespace and the outer while-true
        // loop that used to wrap this block. Retries are now invisible to
        // the processor â€” withLLMActivity rethrows LLMActivityError only
        // after exhausting its retry budget OR hitting a non-retryable class
        // (client_4xx, request_timeout, payload_too_large, context_overflow).
        // Aborts from the external signal raise LLMActivityAbortedError,
        // also a single-attempt terminal.
        const activityPolicy: LLMActivityPolicy = {
          ...DefaultLLMActivityPolicy,
          idleMs,
          classify(error, context) {
            let canonical = canonicalActivityErrors.get(error)
            if (!canonical) {
              canonical = Message.fromError(error, { providerID: input.model.providerID })
              canonicalActivityErrors.set(error, canonical)
            }
            if (Message.ContextOverflowError.isInstance(canonical)) return "context_overflow"
            return DefaultLLMActivityPolicy.classify(error, context)
          },
        }
        {
          let currentText: Message.TextPart | undefined
          let reasoningMap: Record<string, Message.ReasoningPart> = {}
          const flushReasoningDeltas = async () => {
            const buffered = [...reasoningDeltaBuf]
            reasoningDeltaBuf.clear()
            for (const [partID, delta] of buffered) {
              if (!delta.replace(/[\[\]\s]/g, "")) continue
              const part = Object.values(reasoningMap).find((candidate) => candidate.id === partID)
              if (!part) continue
              await Session.updatePartDelta({
                sessionID: part.sessionID,
                messageID: part.messageID,
                partID: part.id,
                field: "text",
                delta,
              })
            }
          }
          const reportReasoningFlushFailure = (error: unknown) => {
            log.warn("reasoning delta flush failed", {
              sessionID: input.assistantMessage.sessionID,
              messageID: input.assistantMessage.id,
              error: error instanceof Error ? error.message : String(error),
            })
          }
          const scheduleReasoningFlush = () => {
            if (reasoningFlushTimer || reasoningFlushOperation) return
            reasoningFlushTimer = setTimeout(() => {
              reasoningFlushTimer = null
              const operation = flushReasoningDeltas().catch(reportReasoningFlushFailure)
              reasoningFlushOperation = operation
              void operation.finally(() => {
                if (reasoningFlushOperation === operation) reasoningFlushOperation = undefined
              })
            }, 200)
          }
          const settleReasoningFlush = async (flush: boolean) => {
            if (reasoningFlushTimer) {
              clearTimeout(reasoningFlushTimer)
              reasoningFlushTimer = null
            }
            const operation = reasoningFlushOperation
            if (operation) await operation
            if (flush) await flushReasoningDeltas()
            else reasoningDeltaBuf.clear()
          }
          const closeOpenReasoningParts = async () => {
            await settleReasoningFlush(true)
            for (const [reasoningID, part] of Object.entries(reasoningMap)) {
              part.text = part.text.trimEnd()
              part.time = { ...part.time, end: Date.now() }
              await Session.updatePart(part)
              delete reasoningMap[reasoningID]
            }
          }
          try {
            const attemptScopes = new Map<number, AttemptWriteScope>()
            const cloneTokens = (): Message.Assistant["tokens"] => ({
              ...input.assistantMessage.tokens,
              cache: { ...input.assistantMessage.tokens.cache },
            })
            const scopeForAttempt = (attempt: number): AttemptWriteScope => {
              let scope = attemptScopes.get(attempt)
              if (scope) return scope
              scope = {
                createdPartIDs: new Set(),
                toolCallIDs: new Set(),
                toolExecutionStarted: false,
                messageSnapshot: {
                  cost: input.assistantMessage.cost,
                  tokens: cloneTokens(),
                  billing: input.assistantMessage.billing,
                  finish: input.assistantMessage.finish,
                  error: input.assistantMessage.error,
                },
              }
              attemptScopes.set(attempt, scope)
              return scope
            }
            const trackCreatedPart = (attempt: number, partID: string) => {
              scopeForAttempt(attempt).createdPartIDs.add(partID)
            }
            const trackToolCall = (attempt: number, toolCallID: string) => {
              scopeForAttempt(attempt).toolCallIDs.add(toolCallID)
            }
            const markToolExecutionStarted = (attempt: number) => {
              scopeForAttempt(attempt).toolExecutionStarted = true
            }
            const restoreAssistantMessage = async (snapshot: AssistantMessageSnapshot) => {
              input.assistantMessage.cost = snapshot.cost
              input.assistantMessage.tokens = {
                ...snapshot.tokens,
                cache: { ...snapshot.tokens.cache },
              }
              input.assistantMessage.billing = snapshot.billing
              input.assistantMessage.finish = snapshot.finish
              input.assistantMessage.error = snapshot.error
              await Session.updateMessage(input.assistantMessage)
            }
            const cleanupAttemptBeforeRetry = async (
              event: Extract<LLMActivityEvent, { type: "retry" }>,
              cause: unknown,
            ) => {
              const failedAttempt = event.attempt - 1
              const scope = attemptScopes.get(failedAttempt)
              if (!scope) return
              await settleReasoningFlush(false)
              const createdPartIDs = [...scope.createdPartIDs]
              if (scope.toolExecutionStarted) {
                throw new ProcessorUnsafeRetryError(failedAttempt, createdPartIDs, cause)
              }
              const createdParts = new Map(
                (await MessageStore.parts(input.assistantMessage.id))
                  .filter((part) => scope.createdPartIDs.has(part.id))
                  .map((part) => [part.id, part]),
              )
              for (const partID of createdPartIDs.reverse()) {
                const part = createdParts.get(partID)
                if (part?.type === "tool" && part.state.status === "pending") {
                  await discardToolInputDraft(part, "Provider activity retried before validated tool input")
                  continue
                }
                await Session.removePart({
                  sessionID: input.assistantMessage.sessionID,
                  messageID: input.assistantMessage.id,
                  partID,
                })
                reasoningDeltaBuf.delete(partID)
              }
              for (const toolCallID of scope.toolCallIDs) {
                delete toolcalls[toolCallID]
              }
              if (currentText && scope.createdPartIDs.has(currentText.id)) currentText = undefined
              for (const [reasoningID, part] of Object.entries(reasoningMap)) {
                if (scope.createdPartIDs.has(part.id)) delete reasoningMap[reasoningID]
              }
              await restoreAssistantMessage(scope.messageSnapshot)
              attemptScopes.delete(failedAttempt)
            }
            await withLLMActivity(
              {
                sessionID: input.sessionID,
                provider: input.model.providerID,
                model: input.model.id,
              },
              activityPolicy,
              input.abort,
              async (run) => {
                const stream = await LLM.stream({ ...streamInput, abort: run.signal })

                for await (const value of abortableIterable(stream.fullStream, run.signal)) {
                  run.bump("first-byte")
                  await streamInput.stream?.onChunk?.({ chunk: value } as never)
                  const heartbeatKind = chunkHeartbeatKind(value as unknown as Record<string, unknown>)
                  if (heartbeatKind) run.bump(heartbeatKind)
                  run.signal.throwIfAborted()
                  switch (value.type) {
                    case "start":
                      SessionStatus.set(input.sessionID, { type: "streaming" }, { promptGenerationOwner: input.abort })
                      break

                    case "reasoning-start":
                      if (value.id in reasoningMap) {
                        continue
                      }
                      const reasoningPart = {
                        id: Identifier.ascending("part"),
                        messageID: input.assistantMessage.id,
                        sessionID: input.assistantMessage.sessionID,
                        type: "reasoning" as const,
                        text: "",
                        time: {
                          start: Date.now(),
                        },
                        metadata: value.providerMetadata,
                      }
                      reasoningMap[value.id] = reasoningPart
                      await Session.updatePart(reasoningPart)
                      trackCreatedPart(run.attempt, reasoningPart.id)
                      break

                    case "reasoning-delta":
                      if (value.id in reasoningMap) {
                        const part = reasoningMap[value.id]
                        part.text += value.text
                        if (value.providerMetadata) part.metadata = value.providerMetadata
                        // Buffer reasoning deltas and flush periodically to avoid
                        // flooding the SSE stream with per-token events.
                        const bufKey = part.id
                        const prev = reasoningDeltaBuf.get(bufKey) || ""
                        reasoningDeltaBuf.set(bufKey, prev + value.text)
                        scheduleReasoningFlush()
                      }
                      break

                    case "reasoning-end":
                      if (value.id in reasoningMap) {
                        // Flush any buffered reasoning delta before closing the part
                        await settleReasoningFlush(true)

                        const part = reasoningMap[value.id]
                        part.text = part.text.trimEnd()

                        part.time = {
                          ...part.time,
                          end: Date.now(),
                        }
                        if (value.providerMetadata) part.metadata = value.providerMetadata
                        await Session.updatePart(part)
                        delete reasoningMap[value.id]
                      }
                      break

                    case "tool-input-start": {
                      const toolCallID =
                        typeof (value as any).toolCallId === "string"
                          ? (value as any).toolCallId
                          : typeof (value as any).id === "string"
                            ? (value as any).id
                            : ""
                      if (!toolCallID) break
                      const mcpAppLifecycle = mcpAppToolLifecycles.get(value.toolName)
                      if (mcpAppLifecycle) {
                        await mcpAppLifecycle.start(toolCallID)
                        mcpAppCalls.set(toolCallID, mcpAppLifecycle)
                      }
                      const part = await withToolPartLock(toolCallID, async () => {
                        const existing = await priorToolPart(toolCallID)
                        const start = existing ? toolStartTime(existing) : Date.now()
                        const part = await Session.updatePart({
                          id: existing?.id ?? Identifier.ascending("part"),
                          messageID: input.assistantMessage.id,
                          sessionID: input.assistantMessage.sessionID,
                          type: "tool",
                          tool: value.toolName,
                          callID: toolCallID,
                          state: {
                            status: "pending",
                            input: {},
                            raw: "",
                            time: { start },
                          },
                        })
                        if (!existing) trackCreatedPart(run.attempt, (part as Message.ToolPart).id)
                        trackToolCall(run.attempt, toolCallID)
                        return part
                      })
                      toolcalls[toolCallID] = part as Message.ToolPart
                      break
                    }

                    case "tool-input-delta": {
                      const toolCallID =
                        typeof (value as any).toolCallId === "string"
                          ? (value as any).toolCallId
                          : typeof (value as any).id === "string"
                            ? (value as any).id
                            : ""
                      const delta =
                        typeof (value as any).inputTextDelta === "string"
                          ? (value as any).inputTextDelta
                          : typeof (value as any).delta === "string"
                            ? (value as any).delta
                            : ""
                      if (!toolCallID || !delta) break
                      const match = toolcalls[toolCallID]
                      if (match && match.state.status === "pending") {
                        ;(match.state as any).raw += delta
                        await Session.updatePartDelta({
                          sessionID: match.sessionID,
                          messageID: match.messageID,
                          partID: match.id,
                          field: "raw",
                          delta,
                        })
                        const lifecycle = mcpAppCalls.get(toolCallID)
                        if (lifecycle) {
                          const partial = await parsePartialJson((match.state as { raw: string }).raw)
                          if (partial.value && typeof partial.value === "object" && !Array.isArray(partial.value)) {
                            await lifecycle.partial(toolCallID, partial.value as Record<string, unknown>)
                          }
                        }
                      }
                      break
                    }

                    case "tool-input-end":
                      break

                    case "tool-call": {
                      if (coordinationHandoff) {
                        throw new Error(
                          `Unexpected tool call ${value.toolCallId} started after coordination handoff ${coordinationHandoff.request_id}`,
                        )
                      }
                      markToolExecutionStarted(run.attempt)
                      // Pause the chunk-driven idle monitor while the SDK runs the
                      // tool's `execute`. Long-running tools (build agent ~100-300s,
                      // acceptance, architect) hold the LLM stream open without
                      // emitting chunks; the monitor's 180s default would false-positive
                      // trip otherwise. Resume on tool-result. Per rule 23 the
                      // pause is scoped to known stream-pause semantics (tool-call
                      // boundary), not a generic disable switch.
                      run.pause(toolPauseOwner(value.toolCallId))
                      const persistedToolInput = cloneToolInputForPersistence(value.input)
                      const part = await withToolPartLock(value.toolCallId, async () => {
                        const match = await priorToolPart(value.toolCallId)
                        const part = await Session.updatePart({
                          ...(match ?? {
                            id: Identifier.ascending("part"),
                            messageID: input.assistantMessage.id,
                            sessionID: input.assistantMessage.sessionID,
                            type: "tool" as const,
                            callID: value.toolCallId,
                            tool: value.toolName,
                          }),
                          tool: value.toolName,
                          state: {
                            status: "running",
                            input: persistedToolInput,
                            time: {
                              start: match ? toolStartTime(match) : Date.now(),
                            },
                          },
                          metadata: value.providerMetadata,
                        })
                        if (!match) trackCreatedPart(run.attempt, (part as Message.ToolPart).id)
                        trackToolCall(run.attempt, value.toolCallId)
                        return part
                      })
                      toolcalls[value.toolCallId] = part as Message.ToolPart
                      const mcpAppLifecycle = mcpAppToolLifecycles.get(value.toolName)
                      if (mcpAppLifecycle) {
                        await mcpAppLifecycle.input(value.toolCallId, value.input as Record<string, unknown>)
                        mcpAppCalls.set(value.toolCallId, mcpAppLifecycle)
                      }

                      const parts = await MessageStore.parts(input.assistantMessage.id)
                      const lastThree = parts.slice(-DOOM_LOOP_THRESHOLD)

                      const exactMatch =
                        lastThree.length === DOOM_LOOP_THRESHOLD &&
                        lastThree.every(
                          (p) =>
                            p.type === "tool" &&
                            p.tool === value.toolName &&
                            p.state.status !== "pending" &&
                            JSON.stringify(p.state.input) === JSON.stringify(persistedToolInput),
                        )

                      if (exactMatch) {
                        throw new Error(
                          `Repeated identical Tool call detected for ${value.toolName}; execution stopped before a duplicate effect.`,
                        )
                      }
                      break
                    }
                    case "tool-result": {
                      markToolExecutionStarted(run.attempt)
                      // Pair with the exact call-owned pause from tool-call. resume() is a
                      // no-op if the monitor isn't paused (e.g. tool-result without
                      // matching tool-call after a recovery), so this is safe to
                      // run unconditionally before the match check.
                      run.resume(toolPauseOwner(value.toolCallId))
                      const output = value.output as {
                        output: string
                        title: string
                        metadata: Record<string, unknown>
                        attachments?: Message.FilePart[]
                        display?: unknown
                        sources?: unknown
                      }
                      const metadata = output.metadata
                      await completeToolPart(
                        { toolCallId: value.toolCallId, input: value.input, output },
                        (partID) => trackCreatedPart(run.attempt, partID),
                      )
                      const control = toolResultControl(metadata)
                      if (control?.kind === "handoff_drain") {
                        if (
                          coordinationHandoff &&
                          (coordinationHandoff.request_id !== control.request_id ||
                            coordinationHandoff.dispatch_lineage_id !== control.dispatch_lineage_id)
                        ) {
                          throw new Error("Conflicting coordination handoff tool results in one assistant turn")
                        }
                        coordinationHandoff = control
                        input.assistantMessage.finish = "tool-calls"
                      } else if (shouldParkAfterToolResult(metadata)) {
                        input.assistantMessage.finish = "tool-calls"
                        parkAfterToolResult = true
                      }
                      break
                    }

                    case "tool-error": {
                      markToolExecutionStarted(run.attempt)
                      // Pair with the exact call-owned pause from tool-call (errors close the
                      // tool-call window just like results).
                      run.resume(toolPauseOwner(value.toolCallId))
                      await withToolPartLock(value.toolCallId, async () => {
                        const match = toolcalls[value.toolCallId] ?? (await priorToolPart(value.toolCallId))
                        if (match && (match.state.status === "running" || match.state.status === "pending")) {
                          const resolvedInput =
                            value.input === undefined ? match.state.input : cloneToolInputForPersistence(value.input)
                          const classification =
                            (value as { dynamic?: boolean }).dynamic === true ? "tool-input-invalid" : "tool-execution"
                          const failure = toolFailureCauseFromUnknown({
                            error: value.error,
                            originSite: "session.processor.tool-error",
                            classification,
                            kind: classification,
                            data: {
                              toolCallId: value.toolCallId,
                              toolName: value.toolName,
                            },
                          })
                          await Session.updatePart({
                            ...match,
                            state: {
                              status: "error",
                              input: resolvedInput,
                              failure,
                              time: completedToolTime(toolStartTime(match)),
                            },
                          })

                          if (value.error instanceof PermissionAuthority.RejectedError) {
                            blocked = shouldBreak
                          }
                          delete toolcalls[value.toolCallId]
                        }
                      })
                      mcpAppCalls.delete(value.toolCallId)
                      break
                    }
                    case "error":
                      throw value.error

                    case "start-step":
                      snapshot = await Snapshot.track()
                      {
                        const part = await Session.updatePart({
                          id: Identifier.ascending("part"),
                          messageID: input.assistantMessage.id,
                          sessionID: input.sessionID,
                          snapshot,
                          type: "step-start",
                        })
                        trackCreatedPart(run.attempt, part.id)
                      }
                      break

                    case "finish-step":
                      const usage = Session.getUsage({
                        model: input.model,
                        usage: value.usage,
                        metadata: value.providerMetadata,
                      })
                      input.assistantMessage.finish = value.finishReason
                      input.assistantMessage.cost += usage.cost
                      input.assistantMessage.billing = usage.billing
                      // Accumulate across steps so multi-step messages keep all
                      // tokens (overwrite-only would silently drop earlier steps;
                      // `cost +=` is already cumulative — match it).
                      input.assistantMessage.tokens = {
                        input: input.assistantMessage.tokens.input + usage.tokens.input,
                        output: input.assistantMessage.tokens.output + usage.tokens.output,
                        reasoning: input.assistantMessage.tokens.reasoning + usage.tokens.reasoning,
                        total: (input.assistantMessage.tokens.total ?? 0) + (usage.tokens.total ?? 0),
                        cache: {
                          read: input.assistantMessage.tokens.cache.read + usage.tokens.cache.read,
                          write: input.assistantMessage.tokens.cache.write + usage.tokens.cache.write,
                        },
                      }
                      {
                        const part = await Session.updatePart({
                          id: Identifier.ascending("part"),
                          reason: value.finishReason,
                          snapshot: await Snapshot.track(),
                          messageID: input.assistantMessage.id,
                          sessionID: input.assistantMessage.sessionID,
                          type: "step-finish",
                          tokens: usage.tokens,
                          cost: usage.cost,
                          billing: usage.billing,
                        })
                        trackCreatedPart(run.attempt, part.id)
                      }
                      await Session.updateMessage(input.assistantMessage)
                      if (snapshot) {
                        const patch = await Snapshot.patch(snapshot)
                        Snapshot.assertPatchEvidenceIntegrity(patch)
                        if (patch.files.length) {
                          const part = await Session.updatePart({
                            id: Identifier.ascending("part"),
                            messageID: input.assistantMessage.id,
                            sessionID: input.sessionID,
                            type: "patch",
                            hash: patch.hash,
                            files: patch.files,
                          })
                          trackCreatedPart(run.attempt, part.id)
                        }
                        snapshot = undefined
                      }
                      await SessionSummary.summarize({
                        sessionID: input.sessionID,
                        messageID: input.assistantMessage.parentID,
                      })
                      if (
                        await CompactionOverflow.isOverflow({
                          tokens: usage.tokens,
                          model: input.model,
                          sessionID: input.assistantMessage.sessionID,
                        })
                      ) {
                        needsCompaction = true
                      }
                      break

                    case "text-start":
                      currentText = {
                        id: Identifier.ascending("part"),
                        messageID: input.assistantMessage.id,
                        sessionID: input.assistantMessage.sessionID,
                        type: "text",
                        text: "",
                        time: {
                          start: Date.now(),
                        },
                        metadata: value.providerMetadata,
                      }
                      await Session.updatePart(currentText)
                      trackCreatedPart(run.attempt, currentText.id)
                      break

                    case "text-delta":
                      if (currentText) {
                        currentText.text += value.text
                        if (value.providerMetadata) currentText.metadata = value.providerMetadata
                        await Session.updatePartDelta({
                          sessionID: currentText.sessionID,
                          messageID: currentText.messageID,
                          partID: currentText.id,
                          field: "text",
                          delta: value.text,
                        })
                      }
                      break

                    case "text-end":
                      if (currentText) {
                        currentText.text = currentText.text.trimEnd()
                        const textOutput = await Plugin.trigger(
                          "experimental.text.complete",
                          {
                            sessionID: input.sessionID,
                            messageID: input.assistantMessage.id,
                            partID: currentText.id,
                          },
                          { text: currentText.text },
                        )
                        currentText.text = textOutput.text
                        currentText.time = {
                          start: Date.now(),
                          end: Date.now(),
                        }
                        if (value.providerMetadata) currentText.metadata = value.providerMetadata

                        await Session.updatePart(currentText)
                      }
                      currentText = undefined
                      break

                    case "source": {
                      const source =
                        value.sourceType === "url"
                          ? Message.SourceUrlPayload.parse({
                              type: "source-url",
                              sourceId: value.id,
                              url: value.url,
                              title: value.title,
                              provider: input.assistantMessage.providerID,
                              providerMetadata: value.providerMetadata,
                            })
                          : Message.SourceDocumentPayload.parse({
                              type: "source-document",
                              sourceId: value.id,
                              mediaType: value.mediaType,
                              title: value.title,
                              filename: value.filename,
                              provider: input.assistantMessage.providerID,
                              providerMetadata: value.providerMetadata,
                            })
                      const persisted = await persistMessageSources({
                        sessionID: input.assistantMessage.sessionID,
                        messageID: input.assistantMessage.id,
                        sources: [source],
                      })
                      for (const part of persisted) trackCreatedPart(run.attempt, part.id)
                      break
                    }

                    case "finish":
                      await streamInput.stream?.onFinish?.(value as never)
                      break

                    default:
                      log.info("unhandled", {
                        ...value,
                      })
                      continue
                  }
                  if (needsCompaction) break
                  if (parkAfterToolResult) break
                }
              },
              (event: LLMActivityEvent) => {
                // Translate retry events directly into SessionStatus retry
                // updates. The activity runner is the single source of
                // truth for "I tried, hit a transient class, will retry
                // after backoffMs"; the overlay's spinner reads exactly
                // these SessionStatus retry events.
                if (event.type === "retry") {
                  const lastHeartbeat = event.lastHeartbeat
                    ? `${event.lastHeartbeat.kind}@${new Date(event.lastHeartbeat.ts).toISOString()}`
                    : "none"
                  log.warn("activity retry", {
                    activityID: event.id,
                    attempt: event.attempt,
                    cls: event.cls,
                    backoffMs: event.backoffMs,
                    lastHeartbeat,
                  })
                  SessionStatus.set(
                    input.sessionID,
                    {
                      type: "retry",
                      attempt: event.attempt,
                      message: `${event.cls}: backoff ${event.backoffMs}ms; last heartbeat ${lastHeartbeat}`,
                      next: event.ts + event.backoffMs,
                    },
                    { promptGenerationOwner: input.abort },
                  )
                  return
                }
                if (event.type === "terminal") {
                  log.debug("activity terminal", {
                    activityID: event.id,
                    outcome: event.outcome,
                    cls: event.cls,
                  })
                }
              },
              {
                beforeRetry: async ({ event, error }) => cleanupAttemptBeforeRetry(event, error),
              },
            )
          } catch (e: any) {
            // withLLMActivity rethrows LLMActivityError only after exhausting
            // its retry budget or hitting a non-retryable class (or as
            // LLMActivityAbortedError on external_abort). The processor sees
            // the underlying cause shape; map to Message.fromError / handle
            // ContextOverflowError as a special-case compaction trigger;
            // anything else terminates the processor turn with the error
            // attached to the assistant message.
            const original = e instanceof LLMActivityError ? (e.cause ?? e) : e
            await Promise.allSettled(
              [...mcpAppCalls].map(([toolCallID, lifecycle]) =>
                lifecycle.cancel(
                  toolCallID,
                  (toolcalls[toolCallID]?.state.input ?? {}) as Record<string, unknown>,
                  input.abort.aborted ? "Session cancelled" : "Tool stream terminated",
                ),
              ),
            )
            mcpAppCalls.clear()
            log.error("process", {
              error: original,
              stack: JSON.stringify((original as { stack?: unknown })?.stack),
            })
            const error =
              canonicalActivityErrors.get(original) ??
              Message.fromError(original, { providerID: input.model.providerID })
            failureOccurrence = failureOccurrenceAnchor({
              sessionID: input.sessionID,
              assistantMessageID: input.assistantMessage.id,
              error,
            })
            input.assistantMessage.error = error
            input.assistantMessage.failureOccurrence = failureOccurrence
            input.assistantMessage.finish = "error"
            const convergenceError = await convergeOpenToolParts(
              toolFailureCauseFromMessageError({
                error,
                occurrence: failureOccurrence,
                originSite: "session.processor.catch",
                classification: "llm-activity",
                data: {
                  sessionID: input.sessionID,
                },
              }),
              failureOccurrence,
            )
            if (convergenceError) {
              convergenceFailure = convergenceError.evidence
              input.assistantMessage.convergenceFailure = convergenceFailure
              SessionStatus.set(input.sessionID, { type: "idle" }, { promptGenerationOwner: input.abort })
            } else if (Message.ContextOverflowError.isInstance(error)) {
              needsCompaction = true
            } else {
              SessionStatus.set(input.sessionID, { type: "idle" }, { promptGenerationOwner: input.abort })
            }
          }
          await closeOpenReasoningParts()
          if (snapshot) {
            try {
              const patch = await Snapshot.patch(snapshot)
              Snapshot.assertPatchEvidenceIntegrity(patch)
              if (patch.files.length) {
                await Session.updatePart({
                  id: Identifier.ascending("part"),
                  messageID: input.assistantMessage.id,
                  sessionID: input.sessionID,
                  type: "patch",
                  hash: patch.hash,
                  files: patch.files,
                })
              }
            } catch (e) {
              const patchError = Message.fromError(e, { providerID: input.model.providerID })
              if (input.assistantMessage.error) {
                log.error("snapshot patch observation failed after the primary assistant failure", {
                  sessionID: input.sessionID,
                  assistantMessageID: input.assistantMessage.id,
                  primaryError: input.assistantMessage.error.name,
                  patchError: patchError.name,
                })
                observationFailures.push({
                  phase: "snapshot_patch",
                  message: typeof patchError.data.message === "string" ? patchError.data.message : patchError.name,
                })
                input.assistantMessage.observationFailures = observationFailures
              } else {
                input.assistantMessage.error = patchError
                failureOccurrence = failureOccurrenceAnchor({
                  sessionID: input.sessionID,
                  assistantMessageID: input.assistantMessage.id,
                  error: patchError,
                })
                input.assistantMessage.failureOccurrence = failureOccurrence
                input.assistantMessage.finish = "error"
              }
            }
            snapshot = undefined
          }
          // `tool-input-start` / `tool-input-delta` are draft stream material.
          // Only `tool-call` crosses validation and execution. A provider may
          // abandon one draft call id and later complete another inside the
          // same stream, so converge never-executed drafts before enforcing
          // the strict running-tool invariant below.
          if (!convergenceFailure) {
            await discardPendingToolInputDrafts("Provider stream ended before validated tool input")
            const lostParts = await openToolParts()
            if (lostParts.length > 0) {
              const error = new ProcessorLostPartsError(lostParts.map((part) => part.id))
              await failOpenToolParts(
                toolFailureCauseFromUnknown({
                  error,
                  originSite: "session.processor.lost-open-tool-parts",
                  classification: "processor-contract",
                  kind: "lost-open-tool-parts",
                  data: {
                    partIDs: lostParts.map((part) => part.id),
                  },
                }),
              )
              throw error
            }
          }
          input.assistantMessage.time.completed = Date.now()
          await Session.updateMessage(input.assistantMessage)
          if (failureOccurrence && input.assistantMessage.error) {
            await Bus.publish(Session.Event.Error, {
              sessionID: input.assistantMessage.sessionID,
              orderKey: sessionLifecycleOrderKey(input.assistantMessage.sessionID),
              error: input.assistantMessage.error,
              failureOccurrence,
              ...(convergenceFailure ? { convergenceFailure } : {}),
              ...(observationFailures.length > 0 ? { observationFailures } : {}),
            })
          }
          if (needsCompaction) return "compact"
          if (blocked) return "stop"
          if (parkAfterToolResult) return "stop"
          if (coordinationHandoff) return "stop"
          if (input.assistantMessage.error) return "stop"
          return "continue"
        }
      },
    }
    return result
  }
}
