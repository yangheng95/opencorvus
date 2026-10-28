/** The scroll reader and explicit navigation join the same source-owned page request. */
export class ConversationHistoryPageReader {
  private active: { scope: string; promise: Promise<boolean> } | undefined

  read(scope: string, load: () => Promise<boolean>): Promise<boolean> {
    if (this.active?.scope === scope) return this.active.promise
    const request = { scope, promise: Promise.resolve().then(load) }
    request.promise = request.promise.finally(() => {
      if (this.active === request) this.active = undefined
    })
    this.active = request
    return request.promise
  }
}
