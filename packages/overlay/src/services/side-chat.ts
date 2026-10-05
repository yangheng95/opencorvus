import { apiJson, captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { getHostTransport } from "./host-transport-runtime"
import { STREAM_RECONNECT_DELAY_MS, type StreamHandle } from "./host-transport"
import { prepareStandaloneQuestionInteractions } from "./tree-writer"
import type { InteractionData } from "../components/InteractionCard"
import {
  createSubagentConversationLiveProjection,
  observeSubagentConversationLiveEvent,
  parseSubagentConversation,
  projectSubagentConversationLive,
  type SubagentConversationTranscript,
} from "./subagent-conversation"

export interface SideChatSource {
  authority?: ApiAuthority
  sessionID: string
  directory: string
}
export interface SideChatSession {
  id: string
  title: string
  metadata: { sideChat: { sourceSessionID: string; inheritedMessageIDs: string[] } }
}
export function sideChatPath(target: SideChatSource, suffix: string): string {
  return `session/${encodeURIComponent(target.sessionID)}${suffix}?${new URLSearchParams({ directory: target.directory })}`
}
export function listSideChats(source: SideChatSource): Promise<SideChatSession[]> {
  return apiJson(sideChatPath(source, "/side-chat"), { authority: source.authority })
}
export function createSideChat(source: SideChatSource): Promise<SideChatSession> {
  return apiJson(sideChatPath(source, "/side-chat"), { method: "POST", authority: source.authority })
}

/** Owns only this Session's stream. Its ordered connection snapshot repairs reconnect gaps. */
export function connectSideChat(
  target: SideChatSource,
  handlers: {
    transcript: (value: SubagentConversationTranscript) => void
    connection: (connected: boolean) => void
    error: (error: unknown) => void
    activity: (active: boolean) => void
    interactions: (pending: InteractionData[]) => void
  },
) {
  const authority = target.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  let disposed = false
  let handle: StreamHandle | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let base: SubagentConversationTranscript | undefined
  let live = createSubagentConversationLiveProjection(target.sessionID)
  let lifecycleVersion = 0
  let connectionGeneration = 0
  const pending = new Map<string, InteractionData>()
  const lifetime = new AbortController()
  const owns = () => !disposed && isApiAuthorityCurrent(authority)
  async function refreshActivity() {
    const version = lifecycleVersion
    try {
      const statuses = (await apiJson(`session/status?${new URLSearchParams({ directory: target.directory })}`, {
        authority,
        signal: lifetime.signal,
      })) as Record<string, { type: string }>
      if (owns() && version === lifecycleVersion)
        handlers.activity(["streaming", "retry"].includes(statuses[target.sessionID]?.type))
    } catch (error) {
      if (owns()) handlers.error(error)
    }
  }
  function connect() {
    if (!owns()) return
    const generation = ++connectionGeneration
    lifecycleVersion++
    handle = getHostTransport().openStream(
      { path: `session/${encodeURIComponent(target.sessionID)}/events`, query: { directory: target.directory }, authority },
      {
        onEvent(data) {
          if (!owns() || generation !== connectionGeneration) return
          try {
            const event = JSON.parse(data)
            if (event.type === "session.connected") {
              base = parseSubagentConversation(
                { ...target, authority, source: { kind: "session", id: target.sessionID } },
                event.payload.conversationSnapshot,
              )
              live = createSubagentConversationLiveProjection(target.sessionID)
              pending.clear()
              handlers.interactions([])
              handlers.connection(true)
              void refreshActivity()
            } else if (base) {
              live = observeSubagentConversationLiveEvent(live, event, base)
            }
            if (base && event.type !== "session.heartbeat")
              handlers.transcript(projectSubagentConversationLive(base, live))
            if (event.type === "agent.execution.lifecycle" && event.session_id === target.sessionID) {
              const latestInput =
                base &&
                projectSubagentConversationLive(base, live).messages.findLast((message) => message.info.role === "user")
              if (event.payload.inputMessageID === latestInput?.messageID) {
                lifecycleVersion++
                handlers.activity(["streaming", "retry"].includes(event.payload.status?.type))
              }
            }
            if (event.type === "session.error") handlers.error(event.payload.error ?? event.payload)
            if (event.session_id === target.sessionID) {
              const payload = event.payload
              const id = payload?.id ?? payload?.requestID
              if (event.type === "question.asked") {
                const [question] = prepareStandaloneQuestionInteractions([{ ...payload, orderKey: event.orderKey }])
                pending.set(id, { ...question, directory: target.directory })
                handlers.interactions([...pending.values()])
              } else if (event.type === "permission.asked") {
                pending.set(id, {
                  id,
                  type: "permission",
                  title: payload.toolName,
                  body: `${payload.summary}\n\n\`\`\`json\n${JSON.stringify(payload.scope, null, 2)}\n\`\`\``,
                  status: "pending",
                  payload: { choices: payload.choices },
                  replyEndpoint: "permission",
                  directory: target.directory,
                })
                handlers.interactions([...pending.values()])
              } else if (["question.replied", "question.rejected", "permission.replied"].includes(event.type)) {
                pending.delete(id)
                handlers.interactions([...pending.values()])
              }
            }
          } catch (error) {
            handlers.error(error)
          }
        },
        onError(error) {
          if (!owns() || generation !== connectionGeneration) return
          handlers.error(error)
          handle?.close("transport-error")
        },
        onClose(_reason, info) {
          if (generation !== connectionGeneration) return
          if (info?.current === false || !owns()) {
            if (retry) clearTimeout(retry)
            lifetime.abort()
            disposed = true
            return
          }
          handlers.connection(false)
          if (retry) clearTimeout(retry)
          retry = setTimeout(connect, STREAM_RECONNECT_DELAY_MS)
        },
      },
    )
  }
  connect()
  return () => {
    disposed = true
    lifetime.abort()
    if (retry) clearTimeout(retry)
    handle?.close("consumer-dispose")
  }
}
