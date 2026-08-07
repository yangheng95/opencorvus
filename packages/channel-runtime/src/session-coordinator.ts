export class SessionCoordinator<TSession extends { sessionId: string }, TMessage> {
  private sessions = new Map<string, TSession>()
  private sessionIndex = new Map<string, Set<string>>()
  private sessionQueues = new Map<string, Array<{ msg: TMessage; text: string }>>()
  private sessionProcessing = new Set<string>()

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

  processing(sessionId: string) {
    return this.sessionProcessing.has(sessionId)
  }

  start(sessionId: string) {
    this.sessionProcessing.add(sessionId)
  }

  stop(sessionId: string) {
    this.sessionProcessing.delete(sessionId)
  }

  enqueue(sessionId: string, item: { msg: TMessage; text: string }, limit: number) {
    const queue = this.sessionQueues.get(sessionId) ?? []
    if (queue.length >= limit) {
      return {
        ok: false as const,
        size: queue.length,
        limit,
      }
    }
    queue.push(item)
    this.sessionQueues.set(sessionId, queue)
    return {
      ok: true as const,
      size: queue.length,
    }
  }

  dequeue(sessionId: string) {
    const queue = this.sessionQueues.get(sessionId)
    if (!queue || queue.length === 0) {
      return {
        item: undefined,
        remaining: 0,
      }
    }
    const item = queue.shift()
    if (queue.length === 0) this.sessionQueues.delete(sessionId)
    return {
      item,
      remaining: queue.length,
    }
  }

  release(sessionId: string) {
    this.sessionProcessing.delete(sessionId)
    this.sessionQueues.delete(sessionId)
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
    this.sessionQueues.clear()
    this.sessionProcessing.clear()
  }
}
