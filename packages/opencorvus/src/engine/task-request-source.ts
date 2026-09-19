import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Identifier } from "@/id/id"
import { PanelCreationFact } from "./panel-creation-fact"

export const MissionTaskRequestSourceError = NamedError.create(
  "MissionTaskRequestSourceError",
  z.object({
    message: z.string(),
    missionSessionID: Identifier.schema("session"),
    creatorMessageID: Identifier.schema("message"),
    acceptedUserMessageIDs: z.array(Identifier.schema("message")),
  }),
)

export type TaskRequestSourceMessage = {
  messageID: string
  sessionID: string
  timeCreated: number
  info?: { role?: unknown; author?: unknown; parentID?: unknown; acceptedInputMessageIDs?: unknown; extra?: unknown }
  parts: ReadonlyArray<{ id: string; timeCreated: number; data: unknown }>
}

export type TaskRequestSourceSession = {
  sessionID: string
  projectID: string
  kind: string
  metadata: unknown
}

export type TaskRequestSourceStore = {
  session(sessionID: string): TaskRequestSourceSession | undefined
  message(messageID: string): TaskRequestSourceMessage | undefined
  /** Canonical database order: time_created, then binary identifier order. */
  messages(sessionID: string): ReadonlyArray<TaskRequestSourceMessage>
}

/** Resolve only user authority accepted before the exact Mission creator reply. */
export function missionTaskRequestAuthoritySources(input: {
  missionSessionID: string
  creatorMessageID: string
  store: TaskRequestSourceStore
}): TaskRequestSourceMessage[] {
  const mission = input.store.session(input.missionSessionID)
  if (!mission || mission.kind !== "mission") return []
  const missionProjectID = mission.projectID
  const history = input.store.messages(input.missionSessionID)
  const creatorIndex = history.findIndex((message) => message.messageID === input.creatorMessageID)
  if (creatorIndex < 0) return []
  const creator = history[creatorIndex]!
  if (creator.info?.role !== "assistant" || creator.info.author !== "mission") return []

  const resolved: TaskRequestSourceMessage[] = []
  const seenAuthority = new Set<string>()
  function acceptedInputIDs(message: TaskRequestSourceMessage): string[] {
    return Array.isArray(message.info?.acceptedInputMessageIDs)
      ? message.info.acceptedInputMessageIDs.filter((value): value is string => typeof value === "string")
      : typeof message.info?.parentID === "string"
        ? [message.info.parentID]
        : []
  }
  function resolveAcceptedHistory(sessionID: string, throughAssistantID: string, visited: Set<string>): void {
    const session = input.store.session(sessionID)
    if (!session || session.projectID !== missionProjectID) return
    const messages = input.store.messages(sessionID)
    const throughIndex = messages.findIndex((message) => message.messageID === throughAssistantID)
    if (
      throughIndex < 0 ||
      messages[throughIndex]?.sessionID !== sessionID ||
      messages[throughIndex]?.info?.role !== "assistant"
    ) {
      return
    }
    const messageIndex = new Map(messages.map((message, index) => [message.messageID, index]))
    for (const assistant of messages.slice(0, throughIndex + 1)) {
      if (assistant.sessionID !== sessionID || assistant.info?.role !== "assistant") continue
      const assistantIndex = messageIndex.get(assistant.messageID)!
      for (const messageID of acceptedInputIDs(assistant)) {
        const acceptedIndex = messageIndex.get(messageID)
        if (acceptedIndex === undefined || acceptedIndex >= assistantIndex) continue
        resolveInput(messageID, sessionID, assistant.timeCreated, visited)
      }
    }
  }
  function resolveInput(messageID: string, expectedSessionID: string, acceptedAt: number, visited: Set<string>): void {
    const message = input.store.message(messageID)
    if (
      !message ||
      message.sessionID !== expectedSessionID ||
      message.timeCreated > acceptedAt ||
      message.info?.role !== "user"
    ) {
      return
    }
    if (message.info.author === "user") {
      if (seenAuthority.has(message.messageID)) return
      seenAuthority.add(message.messageID)
      resolved.push({
        ...message,
        parts: message.parts.filter((part) => part.timeCreated <= acceptedAt),
      })
      return
    }
    const visitKey = `${message.sessionID}\0${message.messageID}`
    if (visited.has(visitKey)) return
    visited.add(visitKey)
    const session = input.store.session(message.sessionID)
    if (!session || session.projectID !== missionProjectID) return
    const creation = PanelCreationFact.safeParse(
      session.metadata && typeof session.metadata === "object"
        ? (session.metadata as Record<string, unknown>).panelCreation
        : undefined,
    )
    if (!creation.success) return
    const missionID =
      session.metadata && typeof session.metadata === "object"
        ? (session.metadata as { mission?: { id?: unknown } }).mission?.id
        : undefined
    if (
      (creation.data.operation === "wake_mission" && creation.data.target_id !== missionID) ||
      (creation.data.operation === "wake_work" && creation.data.target_id !== session.sessionID)
    ) {
      return
    }
    const reason =
      message.info.extra && typeof message.info.extra === "object"
        ? (message.info.extra as Record<string, unknown>).wake_reason
        : undefined
    if (!reason || typeof reason !== "object") return
    const wakeReason = reason as Record<string, unknown>
    if (
      (creation.data.operation === "wake_mission" &&
        (session.kind !== "mission" ||
          wakeReason.source !== "mission.operator" ||
          wakeReason.requestID !== creation.data.tool_part_id)) ||
      (creation.data.operation === "wake_work" &&
        (wakeReason.source !== "conversation.handoff" ||
          wakeReason.callerMessageID !== creation.data.caller_user_message_id))
    ) {
      return
    }
    const creatorToolMessage = input.store.message(creation.data.message_id)
    if (!creatorToolMessage || creatorToolMessage.info?.role !== "assistant") return
    if (!acceptedInputIDs(creatorToolMessage).includes(creation.data.caller_user_message_id)) return
    if (
      creation.data.operation === "wake_work" &&
      wakeReason.callerSessionID !== creatorToolMessage.sessionID
    ) {
      return
    }
    resolveAcceptedHistory(creatorToolMessage.sessionID, creatorToolMessage.messageID, visited)
  }

  resolveAcceptedHistory(input.missionSessionID, input.creatorMessageID, new Set())
  return resolved
}

/** Byte-level provenance check shared by creation and restart/transfer audit. */
export function missionTaskRequestHasAuthenticatedSource(input: {
  creatorRole: unknown
  creatorAuthor: unknown
  request: string
  sourceMessages: ReadonlyArray<{
    messageID: string
    sessionID?: string
    timeCreated?: number
    info?: { role?: unknown; author?: unknown }
    parts: ReadonlyArray<{ id: string; timeCreated?: number; data: unknown }>
  }>
}): boolean {
  if (input.creatorRole !== "assistant" || input.creatorAuthor !== "mission" || input.request.trim().length === 0) {
    return false
  }
  const sources = missionTaskRequestSourceTexts(input.sourceMessages)
  return missionTaskRequestMatchesSourceTexts(input.request, sources)
}

function missionTaskRequestSourceTexts(
  sourceMessages: ReadonlyArray<{
    info?: { role?: unknown; author?: unknown }
    parts: ReadonlyArray<{ data: unknown }>
  }>,
): string[] {
  return sourceMessages.flatMap((source) => {
    if (source.info?.role !== "user" || source.info.author !== "user") return []
    return source.parts.flatMap((part) => {
      const data = part.data as { type?: unknown; text?: unknown }
      return data.type === "text" && typeof data.text === "string" ? [data.text] : []
    })
  })
}

function missionTaskRequestMatchesSourceTexts(request: string, sources: readonly string[]): boolean {
  if (request.trim().length === 0) return false
  if (sources.some((source) => source.includes(request))) return true

  const fragments = request.split("\n\n")
  if (fragments.length < 2 || fragments.some((fragment) => fragment.trim().length === 0)) return false
  let cursor = { source: 0, offset: 0 }
  for (const fragment of fragments) {
    let matched: { source: number; offset: number } | undefined
    for (let source = cursor.source; source < sources.length; source++) {
      const offset = sources[source]!.indexOf(fragment, source === cursor.source ? cursor.offset : 0)
      if (offset >= 0) {
        matched = { source, offset: offset + fragment.length }
        break
      }
    }
    if (!matched) return false
    cursor = matched
  }
  return true
}

/** Classify a source mismatch without accepting, exposing, or rewriting request content. */
export function missionTaskRequestSourceDiagnostic(input: {
  request: string
  sourceMessages: ReadonlyArray<{
    info?: { role?: unknown; author?: unknown }
    parts: ReadonlyArray<{ data: unknown }>
  }>
}): {
  matchingPrefixBytes: number
  authenticatedOrderedPrefixBytes: number
  laterAuthenticatedFragmentBytes: number
} {
  const sources = missionTaskRequestSourceTexts(input.sourceMessages)
  let acceptedPrefixCharacters = 0
  let separator = input.request.indexOf("\n\n")
  while (separator >= 0) {
    const candidate = input.request.slice(0, separator)
    if (missionTaskRequestMatchesSourceTexts(candidate, sources)) {
      acceptedPrefixCharacters = separator
    }
    separator = input.request.indexOf("\n\n", separator + 2)
  }

  const requestPoints = Array.from(input.request)
  let matchingPrefixPointCount = 0
  let upper = requestPoints.length
  while (matchingPrefixPointCount < upper) {
    const candidatePointCount = Math.ceil((matchingPrefixPointCount + upper) / 2)
    const candidate = requestPoints.slice(0, candidatePointCount).join("")
    if (sources.some((source) => source.includes(candidate))) {
      matchingPrefixPointCount = candidatePointCount
    } else {
      upper = candidatePointCount - 1
    }
  }
  const matchingPrefixCharacters = requestPoints.slice(0, matchingPrefixPointCount).join("").length

  const laterFragments = input.request
    .slice(Math.max(matchingPrefixCharacters, acceptedPrefixCharacters))
    .split("\n\n")
    .filter((fragment) => fragment.length > 0 && sources.some((source) => source.includes(fragment)))
  const laterAuthenticatedFragmentBytes = laterFragments.reduce(
    (total, fragment) => total + Buffer.byteLength(fragment),
    0,
  )
  return {
    matchingPrefixBytes: Buffer.byteLength(input.request.slice(0, matchingPrefixCharacters)),
    authenticatedOrderedPrefixBytes: Buffer.byteLength(input.request.slice(0, acceptedPrefixCharacters)),
    laterAuthenticatedFragmentBytes,
  }
}
