// ── Tool utilities ──
// toolNameKey, toolInputCommand, shortRelativePath, relativePathFrom, shortPath

import type { IconName } from "../components/ui/Icon"
import { localeTag, t, tc } from "./i18n"
import { isWindowsPath, normalizeServerPath } from "./server-path"
import {
  ReadToolResultFacts,
  ToolFailureCause,
  renderToolFailureCause,
  conversationDeferredToolState,
  conversationToolFileChanges,
} from "@opencorvus-ai/transport-protocol"

// ── ANSI stripping ──

/** Strip ANSI escape sequences (colors, cursor, etc.) from terminal output. */
export function stripAnsi(str: string): string {
  if (!str) return ""
  // Based on the strip-ansi npm package regex — covers CSI, OSC, and other escape sequences
  // eslint-disable-next-line no-control-regex
  return str.replace(
    /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g,
    "",
  )
}

// ── Helpers ──

function record(value: any): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function toolPayloadText(value: unknown): string {
  if (typeof value === "string") return value
  if (value === undefined) return ""
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

/** The summary and expanded body read the same canonical failure. */
export function toolFailurePresentation(value: unknown): {
  message: string
  headline?: string
  diagnostic?: string
  cancelled: boolean
} {
  if (value === undefined) return { message: "", cancelled: false }
  const parsed = ToolFailureCause.safeParse(value)
  if (parsed.success) return {
    message: parsed.data.message,
    ...(parsed.data.kind === "tool-execution" && parsed.data.name === "FileWriteConflictError"
      ? { headline: t("tool.file_write_conflict") }
      : {}),
    diagnostic: renderToolFailureCause(parsed.data),
    cancelled: parsed.data.kind === "MessageAbortedError" && parsed.data.name === "MessageAbortedError",
  }
  return { message: toolPayloadText(value), cancelled: false }
}

function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stableClone(item))
  if (!record(value)) return value
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = stableClone((value as Record<string, unknown>)[key])
      return acc
    }, {})
}

function singleLine(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function parseDisplayRecord(value: unknown): Record<string, unknown> | undefined {
  if (record(value)) return value as Record<string, unknown>
  if (typeof value !== "string") return undefined
  const text = value.trim()
  if (!text.startsWith("{") || !text.endsWith("}")) return undefined
  try {
    const parsed = JSON.parse(text)
    return record(parsed) ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function shortValue(value: unknown): string {
  const text = singleLine(value)
  return text
}

function shortSha(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : ""
  return text
}

function displayToolResultDetail(name: string, state: Record<string, unknown>): string {
  const output = parseDisplayRecord(state.output)
  if (!output) return ""
  const status = firstNonEmptyString(output.status)
  if (!status) return ""

  const n = toolNameKey(name)
  if (n === "mergeback") {
    const primaryBranch = firstNonEmptyString(output.primary_branch, output.primaryBranch)
    if (status === "merged") {
      const head = shortSha(output.primary_head ?? output.primaryHead)
      return `merged ${primaryBranch || "primary"}${head ? `@${head}` : ""}`
    }
    if (status === "conflict") {
      const paths = Array.isArray(output.conflict_paths)
        ? output.conflict_paths.filter((item) => typeof item === "string")
        : []
      const count = paths.length
      const suffix = count > 0 ? ` (${count} file${count === 1 ? "" : "s"})` : ""
      return `conflict ${primaryBranch || "primary"}${suffix}`
    }
    if (status === "error") {
      return `error: ${shortValue(output.reason ?? output.error ?? output.message)}`
    }
  }

  const reason = firstNonEmptyString(output.reason, output.error, output.message, output.summary)
  return reason ? `${status}: ${shortValue(reason)}` : `status=${shortValue(status)}`
}

export function toolNameKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
}

export function isAgentDispatchTool(name: string): boolean {
  return name === "dispatch_agent"
}

function normalizeToolPartKind(type: unknown): "tool" | "tool_call" | "tool_result" | null {
  const key = toolNameKey(typeof type === "string" ? type : "")
  if (key === "tool" || key === "toolinvocation") return "tool"
  if (key === "toolcall" || key === "tooluse") return "tool_call"
  if (key === "toolresult") return "tool_result"
  return null
}

function parseToolInputValue(value: unknown): unknown {
  if (Array.isArray(value)) return stableClone(value)
  if (record(value)) return stableClone(value)
  if (typeof value !== "string") return value

  const text = value.trim()
  if (!text) return {}
  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      return stableClone(JSON.parse(text))
    } catch {
      // fall through to raw command text
    }
  }
  return { raw: value }
}

function serializeToolField(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (value == null) return undefined
  if (Array.isArray(value)) {
    const textItems = value.flatMap((item) => {
      if (typeof item === "string") return item ? [item] : []
      if (!record(item)) return []
      const text = firstNonEmptyString((item as any).text, (item as any).content)
      return text ? [text] : []
    })
    if (textItems.length === value.length && textItems.length > 0) {
      return textItems.join("\n\n").trim()
    }
    return JSON.stringify(stableClone(value), null, 2)
  }
  if (record(value)) {
    const text = firstNonEmptyString((value as any).text, (value as any).content)
    if (text) return text
    return JSON.stringify(stableClone(value), null, 2)
  }
  return String(value)
}

export function normalizeToolPartRecord(part: unknown, previous?: unknown): unknown {
  if (!record(part)) return part

  const kind = normalizeToolPartKind((part as any).type)
  if (!kind) return part

  const next = part as Record<string, any>
  const prev = record(previous) ? (previous as Record<string, any>) : {}
  const nextState = record(next.state) ? { ...next.state } : {}
  const prevState = record(prev.state) ? { ...prev.state } : {}
  const nextMeta = record(next.meta)
    ? (next.meta as Record<string, any>)
    : record(next.metadata)
      ? (next.metadata as Record<string, any>)
      : {}
  const prevMeta = record(prev.meta)
    ? (prev.meta as Record<string, any>)
    : record(prev.metadata)
      ? (prev.metadata as Record<string, any>)
      : {}

  const label =
    firstNonEmptyString(
      next.tool,
      next.toolName,
      next.name,
      nextMeta.tool_name,
      nextMeta.name,
      prev.tool,
      prev.toolName,
      prev.name,
      prevMeta.tool_name,
    ) || "tool"
  const callID = firstNonEmptyString(
    next.callID,
    next.toolUseID,
    next.tool_use_id,
    nextMeta.call_id,
    nextMeta.tool_use_id,
    prev.callID,
    prev.toolUseID,
    prev.tool_use_id,
    typeof next.id === "string" ? next.id : "",
  )

  const inputCandidate = nextState.input ?? next.input ?? next.arguments ?? next.args ?? prevState.input
  const outputCandidate = nextState.output ?? next.output ?? next.content ?? next.result ?? prevState.output
  const errorCandidate = nextState.error ?? next.error ?? next.stderr ?? prevState.error

  const input = inputCandidate === undefined ? undefined : parseToolInputValue(inputCandidate)
  const output = outputCandidate === undefined ? undefined : serializeToolField(outputCandidate)
  const error = errorCandidate === undefined ? undefined : serializeToolField(errorCandidate)

  let status =
    normalizeToolStatus(nextState.status) || normalizeToolStatus(next.status) || normalizeToolStatus(prevState.status)
  if (!status && kind === "tool_result") status = error ? "error" : "completed"
  if (!status && kind === "tool" && (output || error)) {
    status = error ? "error" : "completed"
  }

  const state: Record<string, unknown> = { ...prevState, ...nextState }
  if (input !== undefined) state.input = input
  if (output !== undefined) state.output = output
  if (error !== undefined) state.error = error
  if (status) state.status = status

  return {
    ...prev,
    ...next,
    type: "tool",
    tool: label,
    ...(callID ? { callID } : {}),
    state,
  }
}

export function toolInputCommand(input: any): string {
  if (!record(input)) return ""
  const value = (input as any).command ?? (input as any).argv ?? (input as any).cmd
  if (typeof value === "string") return value.trim()
  if (!Array.isArray(value)) return ""
  return (value as any[])
    .flatMap((item: any) => (typeof item === "string" && item.trim() ? [item.trim()] : []))
    .join(" ")
    .trim()
}

function flattenToolArgumentValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return singleLine(value)
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenToolArgumentValue(item))
      .filter(Boolean)
      .join(" ")
      .trim()
  }
  if (!record(value)) return singleLine(value)

  const stable = stableClone(value) as Record<string, unknown>
  const preferredKeys = [
    "command",
    "cmd",
    "argv",
    "args",
    "query",
    "pattern",
    "prompt",
    "description",
    "text",
    "title",
    "reason",
    "url",
    "filePath",
    "file_path",
    "path",
    "dirPath",
    "directory",
    "value",
  ]
  for (const key of preferredKeys) {
    const next = flattenToolArgumentValue(stable[key])
    if (next) return next
  }

  return Object.entries(stable)
    .flatMap(([key, item]) => {
      const next = flattenToolArgumentValue(item)
      return next ? [`${key}=${next}`] : []
    })
    .join(" ")
    .trim()
}

// ── Path helpers ──
// activeDirectory is provided externally (from board store) to avoid
// coupling this pure utility to the reactive store.

export function relativePathFrom(base: string, target: string): string {
  if (typeof base !== "string" || typeof target !== "string" || !base || !target) return ""
  // The server's path syntax, rather than the browser's platform, owns this comparison.
  const windows = isWindowsPath(base)
  const basePath = normalizeServerPath(base, windows)
  const baseText = basePath.replace(/\/+$/, "") || (basePath.startsWith("/") ? "/" : "")
  const targetText = normalizeServerPath(target, windows).replace(/\/+$/, "")
  const prefix = baseText === "/" ? "/" : baseText + "/"
  const comparablePrefix = windows ? prefix.toLowerCase() : prefix
  const comparableTarget = windows ? targetText.toLowerCase() : targetText
  return comparableTarget.startsWith(comparablePrefix) ? targetText.slice(prefix.length) : ""
}

export function shortPath(p: string): string {
  return p || ""
}

/** Shorten a path relative to a base directory.
 * Pass activeDirectory (e.g. boardStore.board?.task?.directory) as `base`. */
export function shortRelativePath(p: string, base = ""): string {
  if (!p) return ""
  const rel = relativePathFrom(base, p)
  return rel || shortPath(p)
}

// Display names and icons share one exact-ID registry. Protocol names remain
// available in disclosures and continue to drive argument/result parsing.
const TOOL_PRESENTATIONS: { names: string[]; icon: IconName; label: string }[] = [
  { names: ["read", "read_file"], icon: "file-document", label: "tool.action.read" },
  { names: ["edit", "edit_file", "apply_patch"], icon: "edit", label: "tool.action.edit" },
  { names: ["write", "write_file"], icon: "file-document", label: "tool.action.write" },
  { names: ["work_artifact_author"], icon: "file-document", label: "tool.action.work_artifact_author" },
  { names: ["work_artifact_inspect"], icon: "file-document", label: "tool.action.work_artifact_inspect" },
  { names: ["work_artifact_validate"], icon: "file-document", label: "tool.action.work_artifact_validate" },
  { names: ["work_artifact_deliver"], icon: "file-document", label: "tool.action.work_artifact_deliver" },
  { names: ["bash", "shell_command", "run_command"], icon: "terminal", label: "tool.action.command" },
  { names: ["grep", "search_code"], icon: "search", label: "tool.action.search_code" },
  { names: ["glob", "find_files"], icon: "folder-open", label: "tool.action.find_files" },
  { names: ["list"], icon: "folder-open", label: "tool.action.list" },
  { names: ["webfetch"], icon: "file-document", label: "tool.action.webfetch" },
  { names: ["websearch"], icon: "search", label: "tool.action.websearch" },
  { names: ["external_code_search"], icon: "search", label: "tool.action.external_code_search" },
  { names: ["agent", "spawn_agent", "delegate_agent", "dispatch_agent"], icon: "avatar-assistant", label: "tool.action.delegate" },
  { names: ["dispatch_agents"], icon: "avatar-assistant", label: "tool.action.delegate_many" },
  { names: ["read_agent_message"], icon: "avatar-assistant", label: "tool.action.read_agent_message" },
  { names: ["read_task_message"], icon: "file-document", label: "tool.action.read_task_message" },
  { names: ["read_context"], icon: "file-document", label: "tool.action.read_context" },
  { names: ["cancel_subagent"], icon: "avatar-assistant", label: "tool.action.cancel_agent" },
  { names: ["respond_agent_coordination"], icon: "avatar-assistant", label: "tool.action.respond_coordination" },
  { names: ["request_orchestrator_decision"], icon: "avatar-assistant", label: "tool.action.request_decision" },
  { names: ["send_mailbox_message"], icon: "avatar-assistant", label: "tool.action.send_notification" },
  { names: ["scheduler_message"], icon: "avatar-assistant", label: "tool.action.scheduler_message" },
  { names: ["manage_task"], icon: "tasks", label: "tool.action.manage_task" },
  { names: ["no_action"], icon: "tasks", label: "tool.action.no_action" },
  { names: ["mission_state"], icon: "tasks", label: "tool.action.mission_state" },
  { names: ["artifact_search"], icon: "search", label: "tool.action.artifact_search" },
  { names: ["artifact_read"], icon: "file-document", label: "tool.action.artifact_read" },
  { names: ["artifact_select"], icon: "file-document", label: "tool.action.artifact_select" },
  { names: ["artifact_snapshot"], icon: "folder-open", label: "tool.action.artifact_snapshot" },
  { names: ["artifact_publish"], icon: "file-document", label: "tool.action.artifact_publish" },
  { names: ["publish_interactive_artifact"], icon: "file-document", label: "tool.action.interactive_artifact" },
  { names: ["panel_query_task"], icon: "tasks", label: "tool.action.query_task" },
  { names: ["panel_query_task_artifacts"], icon: "search", label: "tool.action.query_task_artifacts" },
  { names: ["panel_read_task_artifact"], icon: "file-document", label: "tool.action.read_task_artifact" },
  { names: ["panel_read_task_message"], icon: "file-document", label: "tool.action.read_task_evidence" },
  { names: ["panel_read_task_dispatch_evidence"], icon: "file-document", label: "tool.action.read_dispatch_evidence" },
  { names: ["panel_create_task"], icon: "tasks", label: "tool.action.create_task" },
  { names: ["panel_resume_task"], icon: "tasks", label: "tool.action.resume_task" },
  { names: ["panel_expert_squad_inspect"], icon: "avatar-assistant", label: "tool.action.inspect_squad" },
  { names: ["panel_complete_mission"], icon: "tasks", label: "tool.action.complete_mission" },
  { names: ["panel_block_mission"], icon: "tasks", label: "tool.action.block_mission" },
  { names: ["capability_search"], icon: "search", label: "tool.action.capability_search" },
  { names: ["todo", "todo_update", "update_plan"], icon: "tasks", label: "tool.action.todo" },
  { names: ["question"], icon: "config-tool", label: "tool.action.question" },
  { names: ["skill", "mission_skill"], icon: "config-tool", label: "tool.action.skill" },
  { names: ["memory"], icon: "file-document", label: "tool.action.memory" },
  { names: ["schedule"], icon: "tasks", label: "tool.action.schedule" },
  { names: ["planner"], icon: "tasks", label: "tool.action.planner" },
  { names: ["wait"], icon: "config-tool", label: "tool.action.wait" },
  { names: ["create_continuous_goal"], icon: "tasks", label: "tool.action.goal_create" },
  { names: ["get_continuous_goal"], icon: "tasks", label: "tool.action.goal_get" },
  { names: ["update_continuous_goal"], icon: "tasks", label: "tool.action.goal_update" },
]
const toolPresentations = new Map(
  TOOL_PRESENTATIONS.flatMap((entry) => entry.names.map((name) => [toolNameKey(name), entry] as const)),
)

export function displayToolIconName(name: string): IconName {
  return toolPresentations.get(toolNameKey(name))?.icon ?? "config-tool"
}

export function displayToolLabel(name: string): string {
  const presentation = toolPresentations.get(toolNameKey(name))
  return presentation ? t(presentation.label) : name
}

export type ToolDisplayStatus = "pending" | "running" | "completed" | "error"

export interface ToolDisplayModel {
  name: string
  icon: IconName
  label: string
  detail: string
  status?: ToolDisplayStatus
  cancelled: boolean
  statusLabel: string
  commandExitCode?: number
  command?: string
}

function completedCommandExitCode(name: string, state: any): number | undefined {
  if (toolNameKey(name) !== "bash" || state?.status !== "completed") return undefined
  const exit = state.metadata?.exit
  return typeof exit === "number" && Number.isInteger(exit) ? exit : undefined
}

function commandExitLabel(code: number): string {
  return t("tool.command_exit_code", { code: code.toLocaleString(localeTag()) })
}

export function normalizeToolStatus(status: unknown): ToolDisplayStatus | undefined {
  const value = typeof status === "string" ? status.trim().toLowerCase() : ""
  if (value === "pending") return "pending"
  if (value === "running") return "running"
  if (value === "completed") return "completed"
  if (value === "error" || value === "failed") return "error"
  return undefined
}

// ── Tool detail ──

/** Returns a human-readable detail string for a tool invocation.
 * @param name Tool name
 * @param input Tool input object (from part.state.input)
 * @param state Tool state object (from part.state)
 * @param base Active working directory (for path shortening)
 */
export function displayToolDetail(name: string, input: any, state: any, base = ""): string {
  const safeInput = record(input) ? input : {}
  const safeState = record(state) ? state : {}
  const path =
    (safeInput as any).file_path ||
    (safeInput as any).filePath ||
    (safeInput as any).path ||
    (safeInput as any).filename ||
    ""
  const failure = toolFailurePresentation((safeState as any).failure)
  if (failure.headline) {
    return typeof path === "string" && path.trim()
      ? `${failure.headline} · ${shortRelativePath(path, base)}`
      : failure.headline
  }
  const message = failure.message || shortValue((safeState as any).error)
  if (message) return singleLine(message)
  const n = toolNameKey(name)
  if (n === "question") {
    const count = Array.isArray(safeInput.questions) ? safeInput.questions.length : 0
    const expired = safeState.status === "completed" && safeState.metadata?.status === "expired"
    const detail = [count > 0 ? tc("tool.question_count", count) : "", expired ? t("interaction.expired") : ""]
      .filter(Boolean)
      .join(t("card.meta_separator"))
    const status = normalizeToolStatus(safeState.status)
    return detail || (status ? toolStatusLabel(status) : "")
  }
  if (n === "applypatch" && safeState.status === "completed") {
    const metadata = record(safeState.metadata) ? safeState.metadata : {}
    const files = conversationDeferredToolState(metadata)
      ? conversationToolFileChanges(metadata)
      : Array.isArray(metadata.files)
        ? metadata.files
        : undefined
    const paths = [...new Set<string>((files ?? []).flatMap((file: any) => {
      if (!record(file)) return []
      const target = firstNonEmptyString(file.movePath, file.filePath)
      return target ? [target] : []
    }))]
    if (paths.length === 1) return shortRelativePath(paths[0], base)
    return paths.length > 1 ? tc("tool.changed_file_count", paths.length) : toolStatusLabel("completed")
  }
  if (n === "workartifactdeliver") return firstNonEmptyString(safeInput.title)
  if (n === "workartifactinspect" || n === "workartifactvalidate") {
    const formatLabels: Record<string, string> = {
      "office.spreadsheet@1": "tool.office.spreadsheet",
      "office.document@1": "tool.office.document",
      "office.presentation@1": "tool.office.presentation",
    }
    const label = formatLabels[firstNonEmptyString(safeInput.profile)]
    if (label) return t(label)
  }
  // The request URL identifies this fetch. Response media/encoding belongs to
  // the result disclosure rather than the compact transcript identity.
  if (n === "webfetch") return typeof safeInput.url === "string" ? safeInput.url : ""
  if (n === "dispatchagent") {
    const dispatch = record((safeInput as any).dispatch) ? (safeInput as any).dispatch : {}
    const target = firstNonEmptyString((dispatch as any).target)
    return target ? `target=${target}` : ""
  }
  if (n === "managetask") {
    const action = firstNonEmptyString((safeInput as any).action)
    if (action) return `action=${action}`
  }
  if (path) {
    // A completed read owns its resolved resource name. Keep the exact request
    // path in the disclosure, and use it here until a result supplies a title.
    const readTitle =
      (n === "read" || n === "readfile") &&
      (safeState as any).status === "completed" &&
      typeof (safeState as any).title === "string" &&
      (safeState as any).title.trim()
        ? (safeState as any).title
        : ""
    const shortPath = readTitle || shortRelativePath(path, base)
    // Completed windows come from the producer's actual result, including
    // byte-capped reads. In-flight arguments remain explicitly requested bounds.
    if (n === "read" || n === "readfile") {
      if ((safeState as any).status === "completed") {
        const parsed = ReadToolResultFacts.safeParse((safeState as any).metadata)
        if (!parsed.success || parsed.data.readType === "binary") return shortPath
        const facts = parsed.data
        const unit = facts.readType === "text" ? "lines" : "entries"
        if (facts.lines === 0 || (facts.offset === 1 && facts.lines === facts.totalLines)) {
          return `${shortPath} · ${tc(`tool.read_${unit}_count`, facts.lines)}`
        }
        const end = facts.offset + facts.lines - 1
        const range = facts.lines === 1 ? String(facts.offset) : `${facts.offset}–${end}`
        return `${shortPath} · ${tc(`tool.read_${unit}_range`, facts.lines, { range, total: facts.totalLines })}`
      }
      const startLine = (safeInput as any).startLine
      const endLine = (safeInput as any).endLine
      const hasStartLine = typeof startLine === "number" && Number.isFinite(startLine)
      const hasEndLine = typeof endLine === "number" && Number.isFinite(endLine)
      const offset = (safeInput as any).offset
      const limit = (safeInput as any).limit
      const hasOffset = typeof offset === "number" && Number.isFinite(offset)
      const hasLimit = typeof limit === "number" && Number.isFinite(limit)
      if (hasStartLine && hasEndLine) {
        return `${shortPath} · ${t("tool.read_requested_range", { range: `${startLine}–${endLine}` })}`
      }
      if (hasLimit) {
        return `${shortPath} · ${t("tool.read_requested_window", { offset: hasOffset ? offset : 1, limit })}`
      }
      if (hasOffset) return `${shortPath} · ${t("tool.read_requested_offset", { offset })}`
      return shortPath
    }
    return shortPath
  }
  if (n === "bash" || n === "shellcommand" || n === "runcommand") {
    const command = toolInputCommand(safeInput)
    const exit = completedCommandExitCode(name, safeState)
    return exit === undefined ? command : [commandExitLabel(exit), command].filter(Boolean).join(t("card.meta_separator"))
  }
  if (n === "grep" || n === "searchcode")
    return (safeInput as any).pattern || (safeInput as any).query || (safeInput as any).q || ""
  if (n === "glob" || n === "findfiles") return (safeInput as any).pattern || (safeInput as any).glob || ""
  if (n === "agent" || n === "spawnagent") return (safeInput as any).description || (safeInput as any).prompt || ""
  if (typeof (safeInput as any).raw === "string" && (safeInput as any).raw.trim()) return (safeInput as any).raw.trim()
  if (typeof (safeState as any).raw === "string" && (safeState as any).raw.trim())
    return shortValue((safeState as any).raw)
  const resultDetail = displayToolResultDetail(name, safeState as Record<string, unknown>)
  if (resultDetail) return resultDetail
  if (
    ((safeState as any).status === "completed" || (safeState as any).status === "running") &&
    typeof (safeState as any).title === "string" &&
    (safeState as any).title.trim()
  )
    return (safeState as any).title
  // Generic detail extraction for tools outside the named handlers.
  // Failures have already supplied their canonical message above; successful
  // result text takes precedence over generic input fields.
  const outputText = shortValue((safeState as any).output)
  if (outputText) return outputText
  for (const value of Object.values(safeInput)) {
    if (typeof value === "string" && value.trim()) return shortValue(value)
  }
  return ""
}

export function describeToolCall(name: string, input: unknown, state: unknown, base = ""): ToolDisplayModel {
  const toolName = typeof name === "string" && name.trim() ? name.trim() : "tool"
  const status = normalizeToolStatus(record(state) ? (state as any).status : undefined)
  const cancelled = status === "error" && toolFailurePresentation(record(state) ? (state as any).failure : undefined).cancelled
  const commandExitCode = completedCommandExitCode(toolName, state)
  const key = toolNameKey(toolName)
  const readFacts = status === "completed" && (key === "read" || key === "readfile")
    ? ReadToolResultFacts.safeParse(record(state) ? (state as any).metadata : undefined)
    : undefined
  const readsDirectory = readFacts?.success && readFacts.data.readType === "directory"
  return {
    name: toolName,
    icon: readsDirectory ? "folder-open" : displayToolIconName(toolName),
    label: readsDirectory ? t("tool.action.read_directory") : displayToolLabel(toolName),
    detail: displayToolDetail(toolName, input, state, base),
    status,
    cancelled,
    statusLabel: commandExitCode !== undefined
      ? commandExitLabel(commandExitCode)
      : cancelled ? t("task.status.cancelled") : status ? toolStatusLabel(status) : "",
    commandExitCode,
    command: commandExitCode === undefined ? undefined : toolInputCommand(input),
  }
}

export function describeToolPart(part: unknown, base = ""): ToolDisplayModel | null {
  const normalized = normalizeToolPartRecord(part)
  if (!record(normalized)) return null
  const type = typeof (normalized as any).type === "string" ? (normalized as any).type : ""
  if (type !== "tool") {
    return null
  }

  const state = record((normalized as any).state) ? (normalized as any).state : {}
  const name =
    typeof (normalized as any).tool === "string" && (normalized as any).tool.trim()
      ? (normalized as any).tool.trim()
      : typeof (normalized as any).toolName === "string" && (normalized as any).toolName.trim()
        ? (normalized as any).toolName.trim()
        : "tool"
  const input =
    record(state) && "input" in state
      ? (state as any).input
      : "input" in (normalized as any)
        ? (normalized as any).input
        : "arguments" in (normalized as any)
          ? (normalized as any).arguments
          : "args" in (normalized as any)
            ? (normalized as any).args
            : {}

  return describeToolCall(name, input, state, base)
}

/** Project one execution run onto the actual Tool that currently owns visible
 * activity. A running or pending Tool wins over terminal history; once no Tool
 * is active, the latest real Tool remains as the historical disclosure label. */
export function describeCurrentToolPart(parts: readonly unknown[], base = ""): ToolDisplayModel | null {
  let latest: ToolDisplayModel | null = null
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const display = describeToolPart(parts[index], base)
    if (!display) continue
    if (!latest) latest = display
    if (display.status === "running" || display.status === "pending") return display
  }
  return latest
}

export function displayToolArguments(name: string, input: unknown, state?: unknown, base = ""): string {
  const detail = singleLine(displayToolDetail(name, input, state, base))
  if (detail) return detail
  return flattenToolArgumentValue(input)
}

// ── Tool status label ──

export function toolStatusLabel(status: string): string {
  const normalized = normalizeToolStatus(status)
  if (normalized === "completed") return t("task.status.completed")
  if (normalized === "running") return t("common.active")
  if (normalized === "error") return t("common.error")
  if (normalized === "pending") return t("tool.receiving_input")
  return t("checks.pending")
}
