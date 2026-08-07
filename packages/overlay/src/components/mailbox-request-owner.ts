export type MailboxRequestScope = {
  directory: string
  view: string
}

export type OwnedMailboxRequest = {
  signal: AbortSignal
  owns(scope: MailboxRequestScope): boolean
  commit(scope: MailboxRequestScope, callback: () => void): boolean
  complete(): void
}

export type MailboxRequestOwner = {
  beginBase(
    scope: MailboxRequestScope,
    resetProjection: () => void,
  ): { request: OwnedMailboxRequest; scopeChanged: boolean }
  join(scope: MailboxRequestScope): OwnedMailboxRequest
  abortAll(): void
}

function scopeKey(scope: MailboxRequestScope): string {
  return `${scope.directory}\u0000${scope.view}`
}

export function createMailboxRequestOwner(): MailboxRequestOwner {
  const active = new Set<AbortController>()
  let currentScopeKey = ""

  function abortAll(): void {
    currentScopeKey = ""
    for (const controller of active) controller.abort()
    active.clear()
  }

  function createRequest(requestScopeKey: string): OwnedMailboxRequest {
    const controller = new AbortController()
    active.add(controller)
    let complete = false
    const owns = (candidateScope: MailboxRequestScope): boolean =>
      !complete &&
      !controller.signal.aborted &&
      active.has(controller) &&
      requestScopeKey === currentScopeKey &&
      requestScopeKey === scopeKey(candidateScope)

    return {
      signal: controller.signal,
      owns,
      commit(candidateScope, callback) {
        if (!owns(candidateScope)) return false
        callback()
        return true
      },
      complete() {
        complete = true
        active.delete(controller)
      },
    }
  }

  return {
    beginBase(scope, resetProjection) {
      const requestScopeKey = scopeKey(scope)
      const scopeChanged = currentScopeKey !== requestScopeKey
      abortAll()
      currentScopeKey = requestScopeKey
      if (scopeChanged) resetProjection()
      return { request: createRequest(requestScopeKey), scopeChanged }
    },
    join(scope) {
      const requestScopeKey = scopeKey(scope)
      if (currentScopeKey !== requestScopeKey) {
        abortAll()
        throw new Error("Mailbox request does not belong to the active directory and view scope")
      }
      return createRequest(requestScopeKey)
    },
    abortAll,
  }
}

export function mailboxStreamOwnsCurrent<T>(
  handle: T,
  generation: number,
  currentHandle: T | undefined,
  currentGeneration: number,
): boolean {
  return generation === currentGeneration && handle === currentHandle
}
