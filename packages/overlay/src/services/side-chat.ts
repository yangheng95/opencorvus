import { apiJson, captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { getHostTransport } from "./host-transport-runtime"
import { STREAM_RECONNECT_DELAY_MS, type StreamHandle } from "./host-transport"
import { AppLog } from "../utils/log"
import { formatErrorDetails } from "../utils/error-details"
import { observeContinuousGoalRefresh } from "./continuous-goal"
import type { InteractionData } from "../components/InteractionCard"
import { permissionInteraction, preparePermissionInteractions } from "../utils/permission-interaction"
import { prepareQuestionInteractions, questionInteraction, resolveQuestionInteraction, reuseQuestionInteraction } from "../utils/question-interaction"
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
      if (owns() && version === lifecycleVersion) handlers.error(error)
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
            observeContinuousGoalRefresh({ kind: "chat", id: target.sessionID, directory: target.directory }, authority, event)
            if (event.type === "session.connected") {
              if (event.payload.sessionID !== target.sessionID) throw new Error("Side chat connection snapshot Session identity conflict")
              const snapshot = event.payload.conversationSnapshot
              const preparedConversation = parseSubagentConversation(
                { ...target, authority, source: { kind: "session", id: target.sessionID } },
                snapshot,
              )
              const preparedPermissions = preparePermissionInteractions(snapshot.pendingPermissions, target.directory)
                .filter((interaction) => interaction.sessionID === target.sessionID)
              const preparedQuestions = prepareQuestionInteractions(snapshot.pendingQuestions, target.directory)
                .filter((interaction) => interaction.sessionID === target.sessionID)
                .map((question) => reuseQuestionInteraction(pending.get(question.id), question))
              const next = new Map<string, InteractionData>(preparedQuestions.map((question) => [question.id, question]))
              for (const permission of preparedPermissions) {
                if (next.has(permission.id)) throw new Error(`permission ${permission.id} conflicts with a Question interaction`)
                next.set(permission.id, permission)
              }
              base = preparedConversation
              live = createSubagentConversationLiveProjection(target.sessionID)
              pending.clear()
              for (const [id, interaction] of next) pending.set(id, interaction)
              handlers.interactions([...pending.values()])
              handlers.connection(true)
              void refreshActivity()
            } else if (base) {
              live = observeSubagentConversationLiveEvent(live, event)
            }
            const transcript = base && event.type !== "session.heartbeat" ? projectSubagentConversationLive(base, live) : undefined
            if (transcript) handlers.transcript(transcript)
            if (event.type === "agent.execution.lifecycle" && event.session_id === target.sessionID) {
              const latestInput = transcript?.messages.findLast((message) => message.info.role === "user")
              if (event.payload.inputMessageID === latestInput?.messageID) {
                lifecycleVersion++
                handlers.activity(["streaming", "retry"].includes(event.payload.status?.type))
              }
            }
            if (event.type === "session.error") {
              const payload = event.payload
              const occurrence = payload?.failureOccurrence
              const original = transcript?.messages.find((message) =>
                message.messageID === occurrence?.assistant_message_id && message.sessionID === occurrence?.session_id)
              const latest = original && transcript?.messages.findLast((message) => message.sessionID === original.sessionID)
              const request = payload?.streamRequest
              const input = request && transcript?.messages.find((message) =>
                message.info.role === "user" && message.messageID === request.requestID)
              // Helpers share this Session's transport. A known input's actor,
              // rather than its Session alone, owns a raw request failure.
              const belongsToInput = !!occurrence || !input || input.info.agent === request.agentID
              // Reconnection replays historical diagnostics. Their original
              // Message keeps the reason; only the current occurrence owns a
              // conversation-wide notice. Unsettled persistence faults still
              // require attention even after a subsequent Message arrives.
              if ((belongsToInput && (!original || latest?.messageID === original.messageID)) ||
                payload.convergenceFailure || payload.observationFailures?.length) handlers.error(payload)
            }
            if (event.session_id === target.sessionID) {
              const payload = event.payload
              const id = payload?.id ?? payload?.requestID
              if (event.type === "question.asked") {
                const question = questionInteraction({ ...payload, orderKey: event.orderKey }, target.directory)
                if (question.sessionID !== target.sessionID) throw new Error(`question ${question.id} session identity conflict`)
                pending.set(question.id, reuseQuestionInteraction(pending.get(question.id), question))
                handlers.interactions([...pending.values()])
              } else if (event.type === "permission.asked") {
                const interaction = permissionInteraction({ ...payload, orderKey: event.orderKey }, target.directory)
                if (interaction.sessionID !== target.sessionID) {
                  throw new Error(`permission ${interaction.id} session identity conflict`)
                }
                pending.set(interaction.id, interaction)
                handlers.interactions([...pending.values()])
              } else if (["question.replied", "question.rejected", "question.expired", "question.abandoned"].includes(event.type)) {
                if (payload.sessionID !== target.sessionID) throw new Error(`${event.type} ${id} session identity conflict`)
                resolveQuestionInteraction(pending.get(id), event.type, payload, event.orderKey)
                pending.delete(id)
                handlers.interactions([...pending.values()])
              } else if (event.type === "permission.replied" || event.type === "permission.terminated") {
                if (pending.get(id)?.type === "permission") {
                  pending.delete(id)
                  handlers.interactions([...pending.values()])
                }
              }
            }
          } catch (error) {
            handlers.error(error)
          }
        },
        onError(error) {
          if (!owns() || generation !== connectionGeneration) return
          AppLog.warn("side-chat", "Conversation stream interrupted", {
            sessionID: target.sessionID,
            directory: target.directory,
            connectionGeneration: generation,
            error: formatErrorDetails(error),
          })
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
