interface OAuthCallbackWaitOptions {
  timeoutMs: number
  supersededError: () => Error
  timeoutError: () => Error
  onTimeout?: () => void
}

export interface OAuthCallbackOwner<Context, Result> {
  readonly context: Context
  resolve(result: Result): void
  reject(error: Error): void
}

export interface OAuthCallbackLease<Result> {
  readonly promise: Promise<Result>
  reject(error: Error): void
}

export class ManagedOAuthCallbackOwner<Context, Result> {
  private pending: (OAuthCallbackOwner<Context, Result> & { claimed: boolean }) | undefined

  get current(): OAuthCallbackOwner<Context, Result> | undefined {
    return this.pending
  }

  wait(context: Context, options: OAuthCallbackWaitOptions): Promise<Result> {
    return this.begin(context, options).promise
  }

  begin(context: Context, options: OAuthCallbackWaitOptions): OAuthCallbackLease<Result> {
    this.pending?.reject(options.supersededError())

    let owner!: OAuthCallbackOwner<Context, Result> & { claimed: boolean }
    const promise = new Promise<Result>((resolve, reject) => {
      let settled = false
      let timeout: ReturnType<typeof setTimeout>
      owner = {
        context,
        claimed: false,
        resolve: (result) => settle(() => resolve(result)),
        reject: (error) => settle(() => reject(error)),
      }
      const settle = (complete: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (this.pending === owner) this.pending = undefined
        complete()
      }

      timeout = setTimeout(() => {
        if (this.pending !== owner) return
        options.onTimeout?.()
        owner.reject(options.timeoutError())
      }, options.timeoutMs)
      this.pending = owner
    })
    return {
      promise,
      reject: (error) => owner.reject(error),
    }
  }

  claim(): OAuthCallbackOwner<Context, Result> | undefined {
    if (!this.pending || this.pending.claimed) return
    this.pending.claimed = true
    return this.pending
  }

  reject(error: Error): boolean {
    if (!this.pending) return false
    this.pending.reject(error)
    return true
  }
}

interface ManagedListener {
  listening?: boolean
  once(event: "error", listener: (error: Error) => void): unknown
  removeListener(event: "error", listener: (error: Error) => void): unknown
  close(callback?: (error?: Error) => void): unknown
}

export class ManagedOAuthListenerOwner<Server extends ManagedListener> {
  private server: Server | undefined
  private starting: Promise<Server> | undefined
  private stopping: Promise<void> | undefined
  private lease: object | undefined

  get current(): Server | undefined {
    return this.server
  }

  acquire(): object {
    const lease = {}
    this.lease = lease
    return lease
  }

  start(create: () => Server, listen: (server: Server, ready: () => void) => void): Promise<Server> {
    if (this.server) return Promise.resolve(this.server)
    if (this.starting) return this.starting

    const stopping = this.stopping
    const starting = (async () => {
      if (stopping) await stopping
      const server = create()
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.removeListener("error", onError)
          if (server.listening) server.close()
          reject(error)
        }
        const onReady = () => {
          server.removeListener("error", onError)
          resolve()
        }
        server.once("error", onError)
        try {
          listen(server, onReady)
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)))
        }
      })
      this.server = server
      return server
    })()
    this.starting = starting
    const clearStarting = () => {
      if (this.starting === starting) this.starting = undefined
    }
    void starting.then(clearStarting, clearStarting)
    return starting
  }

  async stop(lease?: object): Promise<void> {
    if (lease && this.lease !== lease) return
    this.lease = undefined
    const server = this.server
    this.server = undefined
    if (!server) return this.stopping
    const stopping = new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
    this.stopping = stopping
    const clearStopping = () => {
      if (this.stopping === stopping) this.stopping = undefined
    }
    void stopping.then(clearStopping, clearStopping)
    return stopping
  }
}
