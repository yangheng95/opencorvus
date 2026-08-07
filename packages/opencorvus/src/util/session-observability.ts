// Low-level read bridge for observability code that cannot import
// session/context directly without creating an import cycle. SessionContext is
// still the only owner of the ambient session; it binds ctx.tryUse() here.
export namespace SessionObservability {
  type Snapshot = { id: string }

  let readSession: (() => Snapshot | undefined) | undefined

  export function bindSessionContext(reader: () => Snapshot | undefined) {
    readSession = reader
  }

  export function current(): Snapshot | undefined {
    return readSession?.()
  }

  export function logTags(): Record<string, string> {
    const session = current()
    if (!session) return { logDomain: "non-session" }
    return { logDomain: "session", sessionID: session.id }
  }

  export function traceTags(): Record<string, string> {
    const session = current()
    if (!session) return { domain: "non-session" }
    return { domain: "session", sessionID: session.id }
  }
}
