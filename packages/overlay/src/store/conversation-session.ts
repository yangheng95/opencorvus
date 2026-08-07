import { createStore } from "solid-js/store"

export type ConversationExperience = "chat" | "work"

export type ConversationSessionInfo = {
  id: string
  kind: string
  title?: string | null
  directory?: string | null
  metadata?: Record<string, unknown> | null
  time?: {
    created?: number
    updated?: number
    archived?: number
  }
}

export type ConversationSessionCursor = {
  updated: number
  sessionID: string
}

export const [conversationSessionStore, setConversationStore] = createStore({
  sessions: [] as ConversationSessionInfo[],
  loading: false,
  loadingMore: false,
  error: "",
  searchQuery: "",
  nextCursor: null as ConversationSessionCursor | null,
  actionBusyID: "",
})
