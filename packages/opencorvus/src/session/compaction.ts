import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Session } from "."
import { Identifier } from "../id/id"
import { Instance } from "../project/instance"
import { Provider } from "../provider/provider"
import { Message } from "./message"
import { MessageStore } from "./message-store"
import z from "zod"
import { Token } from "../util/token"
import { Log } from "../util/log"
import { SessionProcessor } from "./processor"
import { fn } from "@/util/fn"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { Plugin } from "@/plugin"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { resolveAgentModel } from "@/agent/model"
import { ContextBudget } from "./context-budget"
import { CompactionHandoff } from "./compaction-handoff"
import { renderToolFailureCause } from "./tool-failure-cause"
import { InstructionPrompt } from "./instruction"
import { TaskPlan } from "@/memory/task-plan"
import { SessionMemory } from "@/memory/session-memory"
import { Snapshot } from "@/snapshot"
import type { ModelMessage } from "ai"
import { TodoStore } from "./todo-store"
import { SessionControl } from "./control"
import { createHash } from "node:crypto"
import type { Tool as AITool } from "ai"
import { CompactionToolResultReader } from "./compaction-tool-result-reader"
import { ServeRuntimeMemoryMetrics } from "@/runtime/memory-metrics"

type CompactionProcessRuntime = {
  prepareProviderTool(input: {
    name: string
    source: "extra" | "structured"
    model: Provider.Model
    tool: AITool
  }): AITool
  [name: string]: unknown
}

const pruneMetrics = {
  neverCompacted: 0,
  noCoveredHistory: 0,
  invalidBoundary: 0,
  prunedParts: 0,
}

ServeRuntimeMemoryMetrics.register({
  id: "session-compaction",
  snapshot: () => ({ ...pruneMetrics }),
})

export namespace SessionCompaction {
  const log = Log.create({ service: "session.compaction" })

  export const Event = {
    Compacted: BusEvent.define(
      "session.compacted",
      z.object({
        sessionID: z.string(),
      }),
    ),
  }

  const TRANSCRIPT_FIELD_MAX_CHARS = 30_000
  const DISPATCH_ANCHOR_REFERENCE_MAX_CHARS = 4_000
  const TOOL_INPUT_STRING_MAX_CHARS = 1_000
  const TOOL_INPUT_STRING_HEAD_CHARS = 240
  const TOOL_INPUT_STRING_TAIL_CHARS = 160
  const TOOL_INPUT_COLLECTION_MAX_ITEMS = 32
  const TOOL_INPUT_OBJECT_MAX_KEYS = 80
  const TOOL_INPUT_OBJECT_OMITTED_KEY_SAMPLE_MAX = 16
  const TOOL_INPUT_OBJECT_KEY_MAX_CHARS = 160
  const TOOL_INPUT_DEPTH_MAX = 8

  const TOOL_INPUT_JSON_MAX_CHARS = 8_000
  type Turn = {
    start: number
    end: number
    id: string
  }

  type Tail = {
    start: number
    id: string
  }

  type SelectedCompactionInput = {
    anchor_id?: string
    head: Message.WithParts[]
    tail_start_id?: string
  }

  type ToolStateForTranscript = z.infer<typeof Message.ToolState>

  type CompletedCompaction = {
    userIndex: number
    assistantIndex: number
  }

  export type DispatchAnchorReference = {
    id: string
    text: string
  }

  export const PRUNE_MINIMUM = 20_000
  export const PRUNE_PROTECT = 40_000

  const PRUNE_PROTECTED_TOOLS = ["skill"]

  function userText(message: Message.WithParts) {
    return message.parts
      .filter((part): part is Message.TextPart => part.type === "text")
      .map((part) => part.text)
      .join("\n\n")
  }

  function compactTranscriptField(text: string, maxChars = TRANSCRIPT_FIELD_MAX_CHARS) {
    if (text.length <= maxChars) return text
    const head = Math.max(0, Math.floor(maxChars * 0.7))
    const tail = Math.max(0, maxChars - head)
    return [
      text.slice(0, head).trimEnd(),
      `[omitted ${text.length - maxChars} chars from compaction transcript]`,
      text.slice(text.length - tail).trimStart(),
    ].join("\n")
  }

  function renderDispatchAnchorReference(input: DispatchAnchorReference) {
    return [
      "The dispatch anchor user message below is preserved outside the compacted range and remains visible after compaction by anchor_id.",
      "Do not duplicate it in the continuation summary unless the next turn needs the exact reference.",
      "<dispatch-anchor-reference>",
      `message_id: ${input.id}`,
      `characters: ${input.text.length}`,
      "<dispatch-anchor-excerpt>",
      compactTranscriptField(input.text, DISPATCH_ANCHOR_REFERENCE_MAX_CHARS),
      "</dispatch-anchor-excerpt>",
      "</dispatch-anchor-reference>",
    ].join("\n")
  }

  function escapeTranscriptText(text: string) {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
  }

  function transcriptText(text: string) {
    return escapeTranscriptText(compactTranscriptField(text))
  }

  function jsonForTranscript(value: unknown) {
    try {
      return transcriptText(JSON.stringify(value))
    } catch {
      return transcriptText(String(value))
    }
  }

  function assistantErrorText(error: unknown) {
    try {
      return transcriptText(JSON.stringify(error))
    } catch {
      return transcriptText(String(error))
    }
  }

  function sha256(text: string) {
    return createHash("sha256").update(text).digest("hex")
  }

  function largeTextProjection(text: string) {
    return {
      kind: "compaction_large_text",
      chars: text.length,
      sha256: sha256(text),
      head: text.slice(0, TOOL_INPUT_STRING_HEAD_CHARS),
      tail: text.slice(text.length - TOOL_INPUT_STRING_TAIL_CHARS),
    }
  }

  function compactObjectKeyForTranscript(key: string) {
    if (key.length <= TOOL_INPUT_OBJECT_KEY_MAX_CHARS) return key
    const head = key.slice(0, 96)
    const tail = key.slice(key.length - 32)
    return `${head}...[${key.length} chars sha256:${sha256(key).slice(0, 12)}]...${tail}`
  }

  function projectToolInputValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (typeof value === "string") {
      if (value.length <= TOOL_INPUT_STRING_MAX_CHARS) return value
      return largeTextProjection(value)
    }
    if (value === null || typeof value !== "object") return value
    if (seen.has(value)) return { kind: "compaction_circular_reference" }
    if (depth >= TOOL_INPUT_DEPTH_MAX) {
      return {
        kind: "compaction_depth_limit",
        objectType: Object.prototype.toString.call(value),
      }
    }

    seen.add(value)
    if (Array.isArray(value)) {
      const items = value
        .slice(0, TOOL_INPUT_COLLECTION_MAX_ITEMS)
        .map((item) => projectToolInputValue(item, depth + 1, seen))
      if (value.length > TOOL_INPUT_COLLECTION_MAX_ITEMS) {
        items.push({
          kind: "compaction_omitted_array_items",
          omitted: value.length - TOOL_INPUT_COLLECTION_MAX_ITEMS,
        })
      }
      seen.delete(value)
      return items
    }

    const result: Record<string, unknown> = {}
    let ownKeyCount = 0
    let omittedKeyCount = 0
    const omittedKeySample: string[] = []
    const objectValue = value as Record<string, unknown>
    for (const key in objectValue) {
      if (!Object.prototype.hasOwnProperty.call(objectValue, key)) continue
      ownKeyCount++
      const compactKey = compactObjectKeyForTranscript(key)
      if (ownKeyCount <= TOOL_INPUT_OBJECT_MAX_KEYS) {
        result[compactKey] = projectToolInputValue(objectValue[key], depth + 1, seen)
        continue
      }
      omittedKeyCount++
      if (omittedKeySample.length < TOOL_INPUT_OBJECT_OMITTED_KEY_SAMPLE_MAX) {
        omittedKeySample.push(compactKey)
      }
    }
    if (omittedKeyCount > 0) {
      result.__compaction_omitted_key_count = omittedKeyCount
      result.__compaction_omitted_key_sample = omittedKeySample
    }
    seen.delete(value)
    return result
  }

  function sampleTopLevelObjectKeys(value: Record<string, unknown>) {
    const keys: string[] = []
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue
      keys.push(compactObjectKeyForTranscript(key))
      if (keys.length >= TOOL_INPUT_OBJECT_OMITTED_KEY_SAMPLE_MAX) break
    }
    return keys
  }

  function compactJsonProjection(value: unknown): unknown {
    const projected = projectToolInputValue(value, 0, new WeakSet())
    const serialized = JSON.stringify(projected)
    if (serialized.length <= TOOL_INPUT_JSON_MAX_CHARS) return projected

    const topLevel =
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? { keys: sampleTopLevelObjectKeys(value as Record<string, unknown>) }
        : Array.isArray(value)
          ? { arrayLength: value.length }
          : {}
    return {
      kind: "compaction_tool_input_summary",
      chars: serialized.length,
      sha256: sha256(serialized),
      ...topLevel,
      excerpt: compactTranscriptField(
        serialized,
        Math.min(TOOL_INPUT_JSON_MAX_CHARS, DISPATCH_ANCHOR_REFERENCE_MAX_CHARS),
      ),
    }
  }

  function compactToolInputProjection(value: unknown): unknown {
    return compactJsonProjection(Message.ToolInput.parse(value))
  }

  function jsonForToolInputTranscript(value: unknown) {
    return jsonForTranscript(compactToolInputProjection(value))
  }

  function compactToolStateProjection(state: ToolStateForTranscript): unknown {
    const projectedState = compactJsonProjection(state)
    if (projectedState === null || typeof projectedState !== "object" || Array.isArray(projectedState))
      return projectedState
    if ("kind" in projectedState) return projectedState

    return {
      ...projectedState,
      input: {
        kind: "compaction_repeated_tool_input",
        location: "sibling_input_element",
      },
    }
  }

  function jsonForToolStateTranscript(state: ToolStateForTranscript) {
    return jsonForTranscript(compactToolStateProjection(state))
  }

  function outputForToolTranscript(part: Message.ToolPart) {
    if (part.state.status !== "completed") {
      throw new Error(`Compaction output projection requires a completed tool part: ${part.id}`)
    }
    if (part.state.output.length <= TOOL_INPUT_STRING_MAX_CHARS && part.state.metadata.truncated !== true) {
      return transcriptText(part.state.output)
    }
    return jsonForTranscript({
      ...CompactionToolResultReader.reference(part),
      preview: largeTextProjection(part.state.output),
    })
  }

  function renderTranscriptPart(part: Message.Part) {
    switch (part.type) {
      case "text":
        return `<text>\n${transcriptText(part.text)}\n</text>`
      case "file":
        return [
          `<file mime="${escapeTranscriptText(part.mime)}" filename="${escapeTranscriptText(part.filename ?? "")}">`,
          part.source?.type ?? "attachment",
          "</file>",
        ].join("")
      case "patch":
        return `<patch>${transcriptText(Snapshot.formatPatchEvidence(part))}</patch>`
      case "tool": {
        const lines = [
          `<tool name="${escapeTranscriptText(part.tool)}" status="${part.state.status}">`,
          `<input>${jsonForToolInputTranscript(part.state.input)}</input>`,
        ]
        if (part.state.status === "completed") {
          lines.push(`<output>${outputForToolTranscript(part)}</output>`)
          if (part.state.attachments?.length) {
            const attachments = part.state.attachments
              .map((item) => item.filename ?? item.mime)
              .map(escapeTranscriptText)
              .join(", ")
            lines.push(`<attachments>${attachments}</attachments>`)
          }
        } else if (part.state.status === "error") {
          lines.push(`<error>${transcriptText(renderToolFailureCause(part.state.failure))}</error>`)
        } else {
          lines.push(`<state>${jsonForToolStateTranscript(part.state)}</state>`)
        }
        lines.push("</tool>")
        return lines.join("\n")
      }
      case "compaction":
        return "<compaction-checkpoint />"
      case "snapshot":
        return `<snapshot>${transcriptText(part.snapshot)}</snapshot>`
      case "interactive-artifact":
        return `<interactive-artifact id="${escapeTranscriptText(part.artifactID)}" />`
      case "reasoning":
      case "step-start":
      case "step-finish":
      case "retry":
        return undefined
    }
  }

  function compactionTranscriptMessages(messages: Message.WithParts[]): ModelMessage[] {
    return messages.flatMap((msg): ModelMessage[] => {
      const info = msg.info
      const lines = [
        `<message id="${escapeTranscriptText(info.id)}" role="${info.role}" agent="${escapeTranscriptText(info.agent)}">`,
      ]
      if (info.role === "assistant" && info.error) {
        lines.push(`<assistant-error>${assistantErrorText(info.error)}</assistant-error>`)
        if (info.failureOccurrence) {
          lines.push(
            `<failure-occurrence>${transcriptText(JSON.stringify(info.failureOccurrence))}</failure-occurrence>`,
          )
        }
        if (info.convergenceFailure) {
          lines.push(
            `<processor-convergence-error>${transcriptText(JSON.stringify(info.convergenceFailure))}</processor-convergence-error>`,
          )
        }
        if (info.observationFailures?.length) {
          lines.push(
            `<processor-observation-errors>${transcriptText(JSON.stringify(info.observationFailures))}</processor-observation-errors>`,
          )
        }
      }
      for (const part of msg.parts) {
        const rendered = renderTranscriptPart(part)
        if (rendered) lines.push(rendered)
      }
      lines.push("</message>")
      const content = [{ type: "text" as const, text: lines.join("\n") }]
      return info.role === "user" ? [{ role: "user", content }] : [{ role: "assistant", content }]
    })
  }

  function completedCompactions(messages: Message.WithParts[]) {
    const users = new Map<string, number>()
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.info.role !== "user") continue
      if (!msg.parts.some((part) => part.type === "compaction")) continue
      users.set(msg.info.id, i)
    }

    return messages.flatMap((msg, assistantIndex): CompletedCompaction[] => {
      if (msg.info.role !== "assistant") return []
      if (!CompactionHandoff.isValidSummaryMessage(msg.info)) return []
      const userIndex = users.get(msg.info.parentID)
      if (userIndex === undefined) return []
      return [{ userIndex, assistantIndex }]
    })
  }

  function patchEvidence(messages: Message.WithParts[]) {
    const lines: string[] = []
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.type !== "patch") continue
        lines.push(`- ${Snapshot.formatPatchEvidence(part)}`)
      }
    }
    return lines.length ? ["<patch-evidence>", ...lines, "</patch-evidence>"].join("\n") : undefined
  }

  async function runtimeContext(input: { sessionID: string; selectedHead: Message.WithParts[]; focus?: string }) {
    const instructionPaths = Array.from(await InstructionPrompt.systemPaths())
    const taskPlan = TaskPlan.toMarkdown(input.sessionID)
    const todos = TodoStore.get(input.sessionID)
    const sessionMemory = await SessionMemory.read(input.sessionID)
    const patches = patchEvidence(input.selectedHead)
    const text = [
      "<compaction-projection>",
      "Authoritative instruction-file references:",
      ...instructionPaths.map((p) => `- ${p}`),
      "",
      "Current todos:",
      JSON.stringify(todos, null, 2),
      input.focus ? ["", "Manual compaction focus:", input.focus].join("\n") : "",
      taskPlan ? ["", "Current task plan:", taskPlan].join("\n") : "",
      sessionMemory
        ? ["", `Current Session ${SessionMemory.filename}:`, sessionMemory.content].join("\n")
        : "",
      patches ? ["", patches].join("\n") : "",
      "</compaction-projection>",
    ]
      .filter((item) => item.trim().length > 0)
      .join("\n")
    return text
  }

  export function buildPrompt(input: { context: string[]; runtime: string; dispatchAnchor?: DispatchAnchorReference }) {
    const dispatchAnchorBlock = input.dispatchAnchor ? renderDispatchAnchorReference(input.dispatchAnchor) : undefined
    return [
      dispatchAnchorBlock,
      "Write a concise natural-language continuation summary as an ordinary assistant message.",
      "Preserve concrete requirements, stable identifiers and references, completed work, unresolved blockers, and useful next actions.",
      "Consolidate the current Session MEMORY.MD with the durable conversation evidence into one self-contained continuation summary. Exclude credentials, application programming interface (API) keys, tokens, passwords, private keys, and other secrets.",
      "For unfinished paginated tool work, retrieve the exact persisted result through ReadCompactionToolResult and preserve its authoritative nextOffset or next_offset verbatim with the exact tool-part and Artifact locator references. Never estimate a cursor, convert between character and byte offsets, or restart an already completed prefix.",
      "Do not invent an active/current state object, domain handoff payload, terminal report, or JSON envelope.",
      "The original durable conversation and facts remain authoritative; this summary is only a bounded continuation projection.",
      input.runtime,
      ...input.context,
    ]
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .join("\n\n")
  }

  export function requestBudget(input: { messages: ModelMessage[]; config: Config.Info; model: Provider.Model }) {
    const estimatedTokens = Token.estimate(JSON.stringify(input.messages))
    const usableBudget = ContextBudget.usable({ config: input.config, model: input.model })
    return {
      estimatedTokens,
      usableBudget,
      exceeds: input.model.limit.context > 0 && estimatedTokens > usableBudget,
    }
  }

  function turns(messages: Message.WithParts[]) {
    const result: Turn[] = []
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      // Turn boundaries follow real conversation starts and assistant step starts,
      // which keeps long dispatcher-owned build sessions compactable without a kind branch.
      const isUserBoundary = msg.info.role === "user" && !msg.parts.some((part) => part.type === "compaction")
      const isAssistantStepBoundary =
        msg.info.role === "assistant" && msg.parts.some((part) => part.type === "step-start")
      if (!isUserBoundary && !isAssistantStepBoundary) continue
      result.push({
        start: i,
        end: messages.length,
        id: msg.info.id,
      })
    }
    for (let i = 0; i < result.length - 1; i++) {
      result[i].end = result[i + 1].start
    }
    return result
  }

  async function estimate(input: { messages: Message.WithParts[]; model: Provider.Model }) {
    const msgs = compactionTranscriptMessages(input.messages)
    return Token.estimate(JSON.stringify(msgs))
  }

  async function selectCompactionInput(input: {
    messages: Message.WithParts[]
    config: Config.Info
    model: Provider.Model
    overflow: boolean
  }): Promise<SelectedCompactionInput> {
    const limit = input.config.compaction?.tail_turns ?? ContextBudget.DEFAULT_TAIL_TURNS
    const firstUserIdx = input.messages.findIndex(
      (msg) => msg.info.role === "user" && !msg.parts.some((part) => part.type === "compaction"),
    )
    if (firstUserIdx < 0) return { head: [] }
    const anchor_id = input.messages[firstUserIdx].info.id
    if (input.overflow) {
      const head = input.messages.slice(firstUserIdx + 1)
      return head.length ? { anchor_id, head } : { head: [] }
    }
    if (limit <= 0) {
      const head = input.messages.slice(firstUserIdx + 1)
      return head.length ? { anchor_id, head } : { head: [] }
    }
    const budget = ContextBudget.preserveRecent({ config: input.config, model: input.model })
    const all = turns(input.messages)
    if (!all.length) return { head: [] }
    const recent = all.slice(-limit)
    const sizes = [] as number[]
    for (const turn of recent) {
      sizes.push(
        await estimate({
          messages: input.messages.slice(turn.start, turn.end),
          model: input.model,
        }),
      )
    }

    let total = 0
    let keep: Tail | undefined
    for (let i = recent.length - 1; i >= 0; i--) {
      const turn = recent[i]!
      const size = sizes[i]!
      if (total + size <= budget) {
        total += size
        const boundary = input.messages[turn.start]
        if (boundary?.info.role === "user") {
          keep = { start: turn.start, id: turn.id }
        }
        continue
      }
      if (!keep) log.info("tail boundary unavailable", { budget, size, total })
      break
    }

    if (!keep) {
      if (recent[0] && recent[0].start <= firstUserIdx + 1) return { head: [] }
      const head = input.messages.slice(firstUserIdx + 1)
      return head.length ? { anchor_id, head } : { head: [] }
    }
    if (keep.start <= firstUserIdx + 1) return { head: [] }
    return {
      anchor_id,
      head: input.messages.slice(firstUserIdx + 1, keep.start),
      tail_start_id: keep.id,
    }
  }

  function repeatedCompactionInput(
    messages: Message.WithParts[],
    sourceUserMessageID: string,
  ): SelectedCompactionInput | undefined {
    const prior = completedCompactions(messages).filter(
      (item) => messages[item.userIndex]?.info.id === sourceUserMessageID,
    )
    const latest = prior.at(-1)
    if (!latest) return undefined
    const head = messages.slice(latest.assistantIndex)
    return head.length
      ? {
          anchor_id: sourceUserMessageID,
          head,
        }
      : { head: [] }
  }

  function analyzeLatestCompactionPruneRange(messages: Message.WithParts[]):
    | { status: "never_compacted" }
    | { status: "no_covered_history" }
    | { status: "invalid_boundary"; reason: string }
    | {
        status: "valid"
        range: {
          startIndex: number
          endIndex: number
          summaryID: string | undefined
          markerID: string
          tailID: string | undefined
          anchorID: string | undefined
        }
      } {
    const latest = completedCompactions(messages).at(-1)
    if (!latest) return { status: "never_compacted" }
    const marker = messages[latest.userIndex]
    const markerPart = marker?.parts.find((part): part is Message.CompactionPart => part.type === "compaction")
    if (!marker || !markerPart) {
      return { status: "invalid_boundary", reason: "completed compaction is missing its marker" }
    }
    const anchorIndex = markerPart.anchor_id
      ? messages.findIndex((message) => message.info.id === markerPart.anchor_id)
      : messages.findIndex(
          (message) => message.info.role === "user" && !message.parts.some((part) => part.type === "compaction"),
        )
    if (anchorIndex < 0) {
      return { status: "invalid_boundary", reason: "compaction anchor message is missing" }
    }
    const tailIndex = markerPart.tail_start_id
      ? messages.findIndex((message) => message.info.id === markerPart.tail_start_id)
      : -1
    if (markerPart.tail_start_id) {
      const tailMessage = tailIndex >= 0 ? messages[tailIndex] : undefined
      if (!tailMessage || tailMessage.info.role !== "user") {
        return { status: "invalid_boundary", reason: "compaction tail boundary is missing or is not a user message" }
      }
    }
    const markerOnAnchor = markerPart.anchor_id === marker.info.id
    const endIndex = tailIndex >= 0 ? tailIndex : markerOnAnchor ? latest.assistantIndex : latest.userIndex
    if (endIndex <= anchorIndex + 1) return { status: "no_covered_history" }
    return {
      status: "valid",
      range: {
        startIndex: anchorIndex + 1,
        endIndex,
        summaryID: messages[latest.assistantIndex]?.info.id,
        markerID: marker.info.id,
        tailID: markerPart.tail_start_id,
        anchorID: markerPart.anchor_id,
      },
    }
  }

  function latestCompactionPruneRange(messages: Message.WithParts[]) {
    const analysis = analyzeLatestCompactionPruneRange(messages)
    return analysis.status === "valid" ? analysis.range : undefined
  }

  function prunableToolParts(messages: Message.WithParts[]): Message.ToolPart[] {
    const range = latestCompactionPruneRange(messages)
    if (!range) return []
    let total = 0
    let pruned = 0
    const toPrune: Message.ToolPart[] = []
    for (let msgIndex = range.endIndex - 1; msgIndex >= range.startIndex; msgIndex--) {
      const msg = messages[msgIndex]
      for (let partIndex = msg.parts.length - 1; partIndex >= 0; partIndex--) {
        const part = msg.parts[partIndex]
        if (part.type !== "tool") continue
        if (part.state.status !== "completed") continue
        if (PRUNE_PROTECTED_TOOLS.includes(part.tool)) continue
        if (part.state.time.compacted) continue
        const estimate = Token.estimate(part.state.output)
        total += estimate
        if (total > PRUNE_PROTECT) {
          pruned += estimate
          toPrune.push(part)
        }
      }
    }
    return pruned > PRUNE_MINIMUM ? toPrune : []
  }

  // goes backwards through parts until there are 40_000 tokens worth of tool
  // calls. then erases output of previous tool calls. idea is to throw away old
  // tool calls that are no longer relevant.
  export async function prune(input: { sessionID: string }) {
    const config = await EffectiveConfig.effective({ sessionID: input.sessionID })
    if (config.compaction?.prune === false) return
    log.info("pruning")
    const msgs = await Session.messages({ sessionID: input.sessionID })
    const analysis = analyzeLatestCompactionPruneRange(msgs)
    if (analysis.status === "never_compacted") {
      pruneMetrics.neverCompacted++
      return
    }
    if (analysis.status === "no_covered_history") {
      pruneMetrics.noCoveredHistory++
      return
    }
    if (analysis.status === "invalid_boundary") {
      pruneMetrics.invalidBoundary++
      log.warn("compaction prune boundary is invalid", {
        sessionID: input.sessionID,
        reason: analysis.reason,
      })
      return
    }
    const range = analysis.range
    const toPrune = prunableToolParts(msgs)
    log.info("found prunable compacted-history tool outputs", {
      count: toPrune.length,
      summaryID: range.summaryID,
      markerID: range.markerID,
      anchorID: range.anchorID,
      tailID: range.tailID,
    })
    for (const part of toPrune) {
      if (part.state.status === "completed") {
        part.state.time.compacted = Date.now()
        await Session.updatePart(part)
      }
    }
    if (toPrune.length > 0) {
      pruneMetrics.prunedParts += toPrune.length
      log.info("pruned", { count: toPrune.length })
    }
  }

  export async function process(
    input: {
      parentID: string
      messages: Message.WithParts[]
      sessionID: string
      abort: AbortSignal
      auto: boolean
      overflow?: boolean
      focus?: string
      model?: {
        providerID: string
        modelID: string
      }
    },
    processRuntime: CompactionProcessRuntime,
  ) {
    const parent = input.messages.findLast((m) => m.info.id === input.parentID)
    if (!parent || parent.info.role !== "user") {
      throw new Error(`Compaction parent must be a user message: ${input.parentID}`)
    }
    const userMessage = parent.info as Message.User
    const compactionPart = parent.parts.find((part): part is Message.CompactionPart => part.type === "compaction")
    const config = await EffectiveConfig.effective({ sessionID: input.sessionID })
    const agent = await HelperAgentRegistry.get("compaction", { config })
    const model = input.model
      ? await Provider.getModel(input.model.providerID, input.model.modelID, { config })
      : await resolveAgentModel(agent.name, { sessionID: input.sessionID })
    const history =
      compactionPart && input.messages.at(-1)?.info.id === input.parentID ? input.messages.slice(0, -1) : input.messages
    const selected =
      repeatedCompactionInput(history, input.parentID) ??
      (await selectCompactionInput({
        messages: history,
        config,
        model,
        overflow: input.overflow === true,
      }))
    if (selected.head.length === 0) {
      log.info("skipping compaction because no post-anchor head is compactable", {
        sessionID: input.sessionID,
        parentID: input.parentID,
      })
      return "stop"
    }
    const dispatchAnchorMessage = selected.anchor_id
      ? history.find((msg) => msg.info.id === selected.anchor_id)
      : undefined
    const dispatchAnchor = dispatchAnchorMessage
      ? {
          id: dispatchAnchorMessage.info.id,
          text: userText(dispatchAnchorMessage),
        }
      : undefined

    const msg = (await Session.updateMessage({
      id: Identifier.ascending("message"),
      role: "assistant",
      author: "compaction",
      parentID: input.parentID,
      sessionID: input.sessionID,
      agent: "compaction",
      variant: userMessage.variant,
      summary: true,
      path: {
        cwd: Instance.directory,
        root: Instance.worktree,
      },
      cost: 0,
      tokens: {
        total: 0,
        output: 0,
        input: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      modelID: model.id,
      providerID: model.providerID,
      time: {
        created: Date.now(),
      },
    })) as Message.Assistant
    const processor = SessionProcessor.create({
      assistantMessage: msg,
      sessionID: input.sessionID,
      model,
      abort: input.abort,
    })
    // Plugins may contribute visible evidence to the temporary projection.
    const compacting = await Plugin.trigger(
      "experimental.session.compacting",
      { sessionID: input.sessionID },
      { context: [] as string[] },
    )
    const runtime = await runtimeContext({
      sessionID: input.sessionID,
      selectedHead: selected.head,
      focus: input.focus ?? compactionPart?.focus,
    })
    const promptText = buildPrompt({
      context: compacting.context,
      runtime,
      dispatchAnchor,
    })
    await CompactionToolResultReader.assertSources(selected.head)
    const providerMessages: ModelMessage[] = [
      ...compactionTranscriptMessages(selected.head),
      {
        role: "user",
        content: [
          {
            type: "text",
            text: promptText,
          },
        ],
      },
    ]
    const budget = requestBudget({ messages: providerMessages, config, model })
    if (budget.exceeds) {
      processor.message.error = new Message.ContextOverflowError({
        message: `Compaction request exceeds model context budget before provider call: estimated ${budget.estimatedTokens} tokens, usable budget ${budget.usableBudget}.`,
      }).toObject()
      processor.message.finish = "error"
      await Session.updateMessage(processor.message)
      return "stop"
    }
    const tools = {
      [CompactionToolResultReader.TOOL_NAME]: processRuntime.prepareProviderTool({
        name: CompactionToolResultReader.TOOL_NAME,
        source: "extra",
        model,
        tool: CompactionToolResultReader.create(selected.head),
      }),
    }
    const result = await processor.process({
      user: userMessage,
      agentID: agent.name,
      agent: sessionRuntimeFromNativeAgent(agent),
      abort: input.abort,
      sessionID: input.sessionID,
      tools,
      system: [],
      messages: providerMessages,
      model,
    })

    if (result === "compact") {
      log.warn("compaction provider rejected the reduced request", {
        sessionID: input.sessionID,
        assistantMessageID: processor.message.id,
        error: processor.message.error?.name,
      })
      return "stop"
    }

    if (processor.message.error) return "stop"
    processor.message.finish = processor.message.finish ?? "stop"
    await Session.updateMessage(processor.message)

    const continuationSummary = (await MessageStore.parts(processor.message.id))
      .filter((part): part is Message.TextPart => part.type === "text")
      .map((part) => part.text)
      .join("\n\n")
    if (!continuationSummary.trim()) {
      throw new Error("Successful compaction produced no visible continuation text for Session MEMORY.MD")
    }
    if (compactionPart) {
      await Session.updatePart({
        ...compactionPart,
        auto: input.auto,
        overflow: input.overflow ?? compactionPart.overflow,
        focus: input.focus ?? compactionPart.focus,
        tail_start_id: selected.tail_start_id,
        anchor_id: selected.anchor_id,
      })
    } else {
      await Session.updatePart({
        id: Identifier.ascending("part"),
        messageID: userMessage.id,
        sessionID: input.sessionID,
        type: "compaction",
        auto: input.auto,
        overflow: input.overflow,
        focus: input.focus,
        tail_start_id: selected.tail_start_id,
        anchor_id: selected.anchor_id,
      } satisfies Message.CompactionPart)
    }

    Bus.publish(Event.Compacted, { sessionID: input.sessionID })

    return input.auto ? "continue" : "stop"
  }

  const CreateInput = z.object({
    sessionID: Identifier.schema("session"),
    source: Message.User,
    model: z
      .object({
        providerID: z.string(),
        modelID: z.string(),
      })
      .optional(),
    auto: z.boolean(),
    overflow: z.boolean().optional(),
    focus: z.string().optional(),
  })

  async function createCompaction(input: z.infer<typeof CreateInput>) {
    if (input.source.sessionID !== input.sessionID) {
      throw new Error(
        `Compaction source message ${input.source.id} belongs to session ${input.source.sessionID}, not ${input.sessionID}`,
      )
    }
    await Session.get(input.sessionID)
    SessionControl.create({
      sessionID: input.sessionID,
      kind: input.auto ? "compaction_request" : "manual_summarize",
      payload: {
        source_user_message_id: input.source.id,
        model: input.model,
        overflow: input.overflow === true,
        focus: input.focus,
      },
    })
  }

  export const create = Object.assign(
    (input: z.input<typeof CreateInput>) => createCompaction(CreateInput.parse(input)),
    {
      schema: CreateInput,
      force: createCompaction,
    },
  )

  export const TestHooks = {
    compactToolInputProjection,
    selectCompactionInput,
    runtimeContext,
    compactionTranscriptMessages,
    analyzeLatestCompactionPruneRange,
    latestCompactionPruneRange,
    prunableToolParts,
    repeatedCompactionInput,
  }
}
