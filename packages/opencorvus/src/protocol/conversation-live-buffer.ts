/** Rebuildable conversation state keeps the latest complete value for each
 * identity, followed by the latest field value published after it. Live subscribers
 * still receive every original event; only replay/bootstrap buffers compact. */
type ConversationEvent = {
  type: string
  taskID?: string
  sessionID?: string
  payload?: Record<string, unknown>
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function identity(event: ConversationEvent) {
  const payload = event.payload ?? {}
  const part = record(payload.part)
  const info = record(payload.info)
  return {
    taskID: event.taskID,
    sessionID: part?.sessionID ?? info?.sessionID ?? payload.sessionID ?? event.sessionID,
    messageID: part?.messageID ?? info?.id ?? payload.messageID,
    partID: part?.id ?? payload.partID,
  }
}

/** Complete snapshots supersede prior values, including an intentional final
 * rewrite to shorter text. No text-length heuristic or invented event is used. */
export function appendConversationLiveEvent<T extends ConversationEvent>(events: T[], event: T): T[] {
  const next = identity(event)
  if (typeof next.sessionID !== "string" || typeof next.messageID !== "string") {
    events.push(event)
    return events
  }
  const sameMessage = (candidate: T) => {
    const previous = identity(candidate)
    return (
      previous.taskID === next.taskID && previous.sessionID === next.sessionID && previous.messageID === next.messageID
    )
  }
  const samePart = (candidate: T) => sameMessage(candidate) && identity(candidate).partID === next.partID
  let supersedes: ((candidate: T) => boolean) | undefined
  if (
    (event.type === "message.part.updated" || event.type === "message.part.removed") &&
    typeof next.partID === "string"
  ) {
    supersedes = samePart
  } else if (event.type === "message.part.delta" && typeof next.partID === "string") {
    supersedes = (candidate) =>
      samePart(candidate) && candidate.type === "message.part.delta" && candidate.payload?.field === event.payload?.field
  } else if (event.type === "message.updated") {
    supersedes = (candidate) =>
      sameMessage(candidate) && (candidate.type === "message.updated" || candidate.type === "message.removed")
  } else if (event.type === "message.removed") {
    supersedes = sameMessage
  } else if (event.type === "message.moved") {
    const sourceSessionID = event.payload?.sourceSessionID
    supersedes = (candidate) => {
      const previous = identity(candidate)
      return (
        previous.taskID === next.taskID &&
        previous.messageID === next.messageID &&
        (previous.sessionID === sourceSessionID || previous.sessionID === next.sessionID)
      )
    }
  }
  if (supersedes) {
    let retained = 0
    for (const candidate of events) {
      if (!supersedes(candidate)) events[retained++] = candidate
    }
    events.length = retained
  }
  // Retain actual events, including their original sequence and raw fragment.
  events.push(event)
  return events
}
