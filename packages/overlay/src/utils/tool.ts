// ── Tool utilities ──
// toolNameKey, toolInputCommand, shortRelativePath, relativePathFrom, shortPath

import type { IconName } from "../components/ui/Icon"
import { t } from "./i18n"

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

function toolInputCommand(input: any): string {
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
  const baseText = typeof base === "string" ? base.replace(/[\\/]+$/, "") : ""
  const targetText = typeof target === "string" ? target.replace(/[\\/]+$/, "") : ""
  if (!baseText || !targetText) return ""
  const lBase = baseText.toLowerCase()
  const lTarget = targetText.toLowerCase()
  if (lTarget.startsWith(lBase + "/") || lTarget.startsWith(lBase + "\\")) {
    return targetText.slice(baseText.length + 1)
  }
  return ""
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

// ── Tool icon ──

export function displayToolIconName(name: string): IconName {
  const n = toolNameKey(name)
  if (n === "read" || n === "readfile") return "file-document"
  if (n === "edit" || n === "editfile" || n === "applypatch") return "edit"
  if (n === "write" || n === "writefile") return "file-document"
  if (n === "bash" || n === "shellcommand" || n === "runcommand") return "terminal"
  if (n === "grep" || n === "searchcode") return "search"
  if (n === "glob" || n === "findfiles") return "folder-open"
  if (n === "agent" || n === "spawnagent") return "avatar-assistant"
  if (n === "todowrite" || n === "todoupdate" || n === "updateplan") return "tasks"
  return "config-tool"
}

export type ToolDisplayStatus = "pending" | "running" | "completed" | "error"

export interface ToolDisplayModel {
  icon: IconName
  label: string
  detail: string
  status?: ToolDisplayStatus
  statusLabel: string
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
  const n = toolNameKey(name)
  if (n === "dispatchagent") {
    const dispatch = record((safeInput as any).dispatch) ? (safeInput as any).dispatch : {}
    const target = firstNonEmptyString((dispatch as any).target)
    return target ? `target=${target}` : ""
  }
  if (n === "managetask") {
    const action = firstNonEmptyString((safeInput as any).action)
    if (action) return `action=${action}`
  }
  const path =
    (safeInput as any).file_path ||
    (safeInput as any).filePath ||
    (safeInput as any).path ||
    (safeInput as any).filename ||
    ""
  if (path) {
    const shortPath = shortRelativePath(path, base)
    // Read calls on the same file can fire multiple times when the file
    // exceeds the per-call byte cap (50KB) — without slice info every
    // entry looks identical and the operator cannot tell which range was
    // fetched. Surface offset/limit when present so the user sees
    // "@1+2000", "@2001+2000" etc on the inline pill.
    if (n === "read" || n === "readfile") {
      const startLine = (safeInput as any).startLine
      const endLine = (safeInput as any).endLine
      const hasStartLine = typeof startLine === "number" && Number.isFinite(startLine)
      const hasEndLine = typeof endLine === "number" && Number.isFinite(endLine)
      const offset = (safeInput as any).offset
      const limit = (safeInput as any).limit
      const hasOffset = typeof offset === "number" && Number.isFinite(offset)
      const hasLimit = typeof limit === "number" && Number.isFinite(limit)
      const meta = record((safeState as any).metadata) ? (safeState as any).metadata : {}
      const readLines = (meta as any).lines
      const totalLines = (meta as any).totalLines
      const hasReadLines = typeof readLines === "number" && Number.isFinite(readLines) && readLines > 0
      const hasTotal = typeof totalLines === "number" && Number.isFinite(totalLines)
      const linesSuffix = hasReadLines
        ? hasTotal && totalLines !== readLines
          ? ` (${readLines}/${totalLines} lines)`
          : ` (${readLines} lines)`
        : ""
      const start = hasOffset ? offset : 1
      const spanSize = hasLimit ? limit : hasReadLines ? readLines : undefined
      const hasSpan = typeof spanSize === "number" && Number.isFinite(spanSize) && spanSize > 0
      if (hasStartLine && hasEndLine) {
        return `${shortPath}:${startLine}-${endLine}${linesSuffix}`
      }
      if (hasOffset || hasSpan) {
        const span = hasSpan ? `+${spanSize}` : ""
        return `${shortPath} @${start}${span}${linesSuffix}`
      }
      return `${shortPath}${linesSuffix}`
    }
    return shortPath
  }
  if (n === "bash" || n === "shellcommand" || n === "runcommand") return toolInputCommand(safeInput)
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
  // Error text wins over raw output because failures must be visible at a
  // glance; string input fields are used only when no result text exists.
  const errorText = shortValue((safeState as any).error)
  if (errorText) return errorText
  const outputText = shortValue((safeState as any).output)
  if (outputText) return outputText
  for (const value of Object.values(safeInput)) {
    if (typeof value === "string" && value.trim()) return shortValue(value)
  }
  return ""
}

export function describeToolCall(name: string, input: unknown, state: unknown, base = ""): ToolDisplayModel {
  const label = typeof name === "string" && name.trim() ? name.trim() : "tool"
  const status = normalizeToolStatus(record(state) ? (state as any).status : undefined)
  return {
    icon: displayToolIconName(label),
    label,
    detail: displayToolDetail(label, input, state, base),
    status,
    statusLabel: status ? toolStatusLabel(status) : "",
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
  return t("checks.pending")
}
