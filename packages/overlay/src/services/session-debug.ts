import { apiJson } from "./api"
import { directoryScopedPath } from "./task-path"
import { boundedDebugText, normalizeDebugDirectory } from "../utils/debug-text"

const RECENT_MESSAGE_LIMIT = 24
const RECENT_TOOL_LIMIT = 40
const VISIBLE_DEBUG_PART_TYPES = new Set([
  "text",
  "part-error",
  "reasoning",
  "source-url",
  "source-document",
  "source-file",
  "file",
  "interactive-artifact",
  "tool",
  "step-start",
  "step-finish",
  "snapshot",
  "patch",
  "retry",
  "compaction",
])

export type PersistedChatDebugStats = {
  messages: {
    total: number
    user: number
    assistant: number
    other: number
    assistantIncomplete: number
    assistantCompleted: number
    assistantError: number
  }
  tools: { total: number; pending: number; running: number; completed: number; error: number; other: number }
}

export type PersistedChatMessageFact = {
  sessionID: string
  messageID: string
  role: string
  userTextPreview: string | null
  created: number | null
  completed: number | null
  finish: string | null
  errorName: string | null
  partCount: number
  toolCount: number
}

export type PersistedChatToolFact = {
  sessionID: string
  messageID: string
  messageCreated: number | null
  partID: string
  callID: string | null
  tool: string
  status: string
  started: number | null
  completed: number | null
  failureKind: string | null
  failure: string | null
}

export type PersistedChatDebugSummary = {
  stats: PersistedChatDebugStats
  sessionIDs: string[]
  recentMessages: PersistedChatMessageFact[]
  recentTools: PersistedChatToolFact[]
  omittedMessages: number
  omittedTools: number
}

export type PersistedChatDebugPlane =
  | {
      status: "available"
      endpoint: string
      collectedAt: number
      summary: PersistedChatDebugSummary
      board?: { sessionID: string; title: string | null; status: string | null; directory: string | null }
    }
  | { status: "unavailable"; endpoint: string; collectedAt: number; error: string }

export type PersistedChatDebugProjection = {
  schema: "opencorvus.chat-debug.v2"
  sessionID: string
  directory: string
  startedAt: number
  completedAt: number
  root: PersistedChatDebugPlane
  tree: PersistedChatDebugPlane
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function requiredTime(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite timestamp`)
  }
  return value
}

function optionalTime(value: unknown, label: string): number | null {
  return value === undefined || value === null ? null : requiredTime(value, label)
}

function boundedDiagnosticText(value: unknown): string | null {
  const text = boundedDebugText(value)
  return text || null
}

function userAuthoredTextPreview(info: Record<string, unknown>, messageID: string, role: string): string | null {
  if (role !== "user" || info.extra === undefined) return null
  const extra = object(info.extra, `Session message ${messageID}.info.extra`)
  const rawMarker = extra.project_memory_user_input
  if (rawMarker === undefined) return null
  const marker = object(rawMarker, `Session message ${messageID}.info.extra.project_memory_user_input`)
  if (marker.version !== 1) {
    throw new Error(`Session message ${messageID}.info.extra.project_memory_user_input.version must be 1`)
  }
  requiredString(marker.surface, `Session message ${messageID}.info.extra.project_memory_user_input.surface`)
  if (typeof marker.literalText !== "string") {
    throw new Error(`Session message ${messageID}.info.extra.project_memory_user_input.literalText must be a string`)
  }
  return boundedDiagnosticText(marker.literalText)
}

function failureFact(
  state: Record<string, unknown>,
  label: string,
  required: boolean,
): { kind: string | null; text: string | null } {
  if (!required && state.failure === undefined && state.error === undefined) return { kind: null, text: null }
  const failure = object(state.failure, `${label}.failure`)
  return {
    kind: requiredString(failure.kind, `${label}.failure.kind`),
    text: boundedDiagnosticText(requiredString(failure.message, `${label}.failure.message`)),
  }
}

export function summarizePersistedChatMessages(
  value: unknown,
  options: { expectedSessionID?: string } = {},
): PersistedChatDebugSummary {
  const stats: PersistedChatDebugStats = {
    messages: {
      total: 0,
      user: 0,
      assistant: 0,
      other: 0,
      assistantIncomplete: 0,
      assistantCompleted: 0,
      assistantError: 0,
    },
    tools: { total: 0, pending: 0, running: 0, completed: 0, error: 0, other: 0 },
  }
  const messages = array(value, "Session message response")
  const messageIDs = new Set<string>()
  const partIDs = new Set<string>()
  const sessionIDs = new Set<string>()
  const messageFacts: PersistedChatMessageFact[] = []
  const toolFacts: PersistedChatToolFact[] = []

  for (const [messageIndex, rawMessage] of messages.entries()) {
    const message = object(rawMessage, `Session message response[${messageIndex}]`)
    const info = object(message.info, `Session message response[${messageIndex}].info`)
    const messageID = requiredString(info.id, `Session message response[${messageIndex}].info.id`)
    const sessionID = requiredString(info.sessionID, `Session message response[${messageIndex}].info.sessionID`)
    const role = requiredString(info.role, `Session message response[${messageIndex}].info.role`)
    if (role !== "user" && role !== "assistant") {
      throw new Error(`Session message ${messageID} has unsupported role ${role}`)
    }
    const parts = array(message.parts, `Session message response[${messageIndex}].parts`)
    if (messageIDs.has(messageID)) throw new Error(`Session message response contains duplicate message ${messageID}`)
    if (options.expectedSessionID && sessionID !== options.expectedSessionID) {
      throw new Error(`Session message ${messageID} belongs to ${sessionID}, expected ${options.expectedSessionID}`)
    }
    messageIDs.add(messageID)
    sessionIDs.add(sessionID)

    stats.messages.total += 1
    if (role === "user" || role === "assistant") stats.messages[role] += 1
    else stats.messages.other += 1

    const time = object(info.time, `Session message ${messageID}.info.time`)
    const created = requiredTime(time.created, `Session message ${messageID}.info.time.created`)
    const completed = optionalTime(time.completed, `Session message ${messageID}.info.time.completed`)
    if (completed !== null && completed < created) {
      throw new Error(`Session message ${messageID}.info.time.completed must not precede created`)
    }
    const finish = info.finish === undefined ? null : requiredString(info.finish, `Session message ${messageID}.finish`)
    const error = info.error === undefined ? undefined : object(info.error, `Session message ${messageID}.error`)
    const errorName = error ? requiredString(error.name, `Session message ${messageID}.error.name`) : null
    if (role === "assistant") {
      if (completed) stats.messages.assistantCompleted += 1
      else stats.messages.assistantIncomplete += 1
      if (finish === "error" || errorName) stats.messages.assistantError += 1
    }

    let toolCount = 0
    for (const [partIndex, rawPart] of parts.entries()) {
      const part = object(rawPart, `Session message ${messageID} part[${partIndex}]`)
      const partID = requiredString(part.id, `Session message ${messageID} part[${partIndex}].id`)
      const partSessionID = requiredString(part.sessionID, `Session message ${messageID} part ${partID}.sessionID`)
      const partMessageID = requiredString(part.messageID, `Session message ${messageID} part ${partID}.messageID`)
      const partType = requiredString(part.type, `Session message ${messageID} part ${partID}.type`)
      if (!VISIBLE_DEBUG_PART_TYPES.has(partType)) {
        throw new Error(`Session message ${messageID} part ${partID} has unsupported type ${partType}`)
      }
      if (partIDs.has(partID)) throw new Error(`Session message response contains duplicate part ${partID}`)
      partIDs.add(partID)
      if (partSessionID !== sessionID || partMessageID !== messageID) {
        throw new Error(`Session message ${messageID} part ${partID} identity mismatch`)
      }
      if (partType !== "tool") continue
      toolCount += 1
      stats.tools.total += 1
      const state = object(part.state, `Session message ${messageID} tool part ${partID}.state`)
      const status = requiredString(state.status, `Session message ${messageID} tool part ${partID}.state.status`)
      if (status !== "pending" && status !== "running" && status !== "completed" && status !== "error") {
        throw new Error(`Session message ${messageID} tool part ${partID} has unsupported status ${status}`)
      }
      stats.tools[status] += 1
      const toolTime = object(state.time, `Session message ${messageID} tool part ${partID}.state.time`)
      const started = requiredTime(toolTime.start, `Session message ${messageID} tool part ${partID}.state.time.start`)
      const ended = optionalTime(toolTime.end, `Session message ${messageID} tool part ${partID}.state.time.end`)
      if ((status === "completed" || status === "error") && (ended === null || ended <= started)) {
        throw new Error(`Session message ${messageID} tool part ${partID} terminal time must end after start`)
      }
      const failure = failureFact(state, `Session message ${messageID} tool part ${partID}.state`, status === "error")
      toolFacts.push({
        sessionID,
        messageID,
        messageCreated: created,
        partID,
        callID: requiredString(part.callID, `Session message ${messageID} tool part ${partID}.callID`),
        tool: requiredString(part.tool, `Session message ${messageID} tool part ${partID}.tool`),
        status,
        started,
        completed: status === "completed" || status === "error" ? ended : null,
        failureKind: failure.kind,
        failure: failure.text,
      })
    }

    messageFacts.push({
      sessionID,
      messageID,
      role,
      userTextPreview: userAuthoredTextPreview(info, messageID, role),
      created,
      completed,
      finish,
      errorName,
      partCount: parts.length,
      toolCount,
    })
  }

  const byTimeline = <
    T extends { created?: number | null; messageCreated?: number | null; started?: number | null; messageID: string },
  >(
    left: T,
    right: T,
  ) =>
    (left.created ?? left.messageCreated ?? left.started ?? 0) -
      (right.created ?? right.messageCreated ?? right.started ?? 0) || left.messageID.localeCompare(right.messageID)
  messageFacts.sort(byTimeline)
  toolFacts.sort(byTimeline)
  return {
    stats,
    sessionIDs: [...sessionIDs].sort(),
    recentMessages: messageFacts.slice(-RECENT_MESSAGE_LIMIT),
    recentTools: toolFacts.slice(-RECENT_TOOL_LIMIT),
    omittedMessages: Math.max(0, messageFacts.length - RECENT_MESSAGE_LIMIT),
    omittedTools: Math.max(0, toolFacts.length - RECENT_TOOL_LIMIT),
  }
}

function boundedError(error: unknown): string {
  return (
    boundedDebugText(error instanceof Error ? error.message : error, 500) || "unknown persisted Session read failure"
  )
}

async function readPlane(
  endpoint: string,
  read: () => Promise<{
    summary: PersistedChatDebugSummary
    board?: { sessionID: string; title: string | null; status: string | null; directory: string | null }
  }>,
): Promise<PersistedChatDebugPlane> {
  try {
    const result = await read()
    return { status: "available", endpoint, collectedAt: Date.now(), ...result }
  } catch (error) {
    return { status: "unavailable", endpoint, collectedAt: Date.now(), error: boundedError(error) }
  }
}

export async function loadPersistedChatDebugProjection(input: {
  sessionID: string
  directory: string
}): Promise<PersistedChatDebugProjection> {
  const sessionID = requiredString(input.sessionID, "debug Session ID")
  const directory = requiredString(input.directory, "debug Session directory")
  const rootEndpoint = `session/${encodeURIComponent(sessionID)}/message`
  const treeEndpoint = `session/${encodeURIComponent(sessionID)}/conversation`
  const startedAt = Date.now()
  const [root, tree] = await Promise.all([
    readPlane(rootEndpoint, async () => ({
      summary: summarizePersistedChatMessages(
        await apiJson(directoryScopedPath(rootEndpoint, directory, "loadPersistedChatDebugProjection.root")),
        { expectedSessionID: sessionID },
      ),
    })),
    readPlane(treeEndpoint, async () => {
      const response = object(
        await apiJson(directoryScopedPath(treeEndpoint, directory, "loadPersistedChatDebugProjection.tree")),
        "Session conversation response",
      )
      const board = object(response.board, "Session conversation response.board")
      const boardSessionID = requiredString(board.sessionID, "Session conversation response.board.sessionID")
      if (board.kind !== "session" || boardSessionID !== sessionID) {
        throw new Error(
          `Session conversation board belongs to ${String(board.sessionID ?? "-")}, expected ${sessionID}`,
        )
      }
      const boardDirectory = optionalString(board.directory)
      if (boardDirectory && normalizeDebugDirectory(boardDirectory) !== normalizeDebugDirectory(directory)) {
        throw new Error(`Session conversation board directory ${boardDirectory} does not match requested ${directory}`)
      }
      return {
        summary: summarizePersistedChatMessages(response.transcript),
        board: {
          sessionID: boardSessionID,
          title: optionalString(board.title),
          status: optionalString(board.status),
          directory: boardDirectory,
        },
      }
    }),
  ])
  return {
    schema: "opencorvus.chat-debug.v2",
    sessionID,
    directory,
    startedAt,
    completedAt: Date.now(),
    root,
    tree,
  }
}
