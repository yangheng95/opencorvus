export class SessionCoordinator<TSession extends { sessionId: string }> {
  private sessions = new Map<string, TSession>()
  private sessionIndex = new Map<string, Set<string>>()

  get(threadKey: string) {
    return this.sessions.get(threadKey)
  }

  bind(threadKey: string, session: TSession) {
    this.sessions.set(threadKey, session)
    const keys = this.sessionIndex.get(session.sessionId) ?? new Set<string>()
    keys.add(threadKey)
    this.sessionIndex.set(session.sessionId, keys)
  }

  findSession(sessionId: string) {
    const keys = this.sessionIndex.get(sessionId)
    if (!keys || keys.size === 0) return undefined
    for (const key of keys) {
      const session = this.sessions.get(key)
      if (session) return session
    }
    return undefined
  }

  findSessions(sessionId: string) {
    const keys = this.sessionIndex.get(sessionId)
    if (!keys || keys.size === 0) return []
    const out: TSession[] = []
    for (const key of keys) {
      const session = this.sessions.get(key)
      if (session) out.push(session)
    }
    return out
  }

  release(sessionId: string) {
    const keys = this.sessionIndex.get(sessionId)
    if (keys) {
      for (const key of keys) {
        this.sessions.delete(key)
      }
      this.sessionIndex.delete(sessionId)
    }
  }

  clear() {
    this.sessions.clear()
    this.sessionIndex.clear()
  }
}
