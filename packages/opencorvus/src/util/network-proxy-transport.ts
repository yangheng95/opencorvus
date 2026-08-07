import { ProxyAgent, type Dispatcher } from "undici"

export type NetworkProxyTransportScope = "llmProvider" | "webResearch" | "connectivityTest"

type ManagedProxyAgent = {
  proxyUrl: string
  dispatcher: ProxyAgent
}

export class NetworkProxyTransportOwner {
  private readonly agents = new Map<NetworkProxyTransportScope, ManagedProxyAgent>()
  private readonly retiring = new Set<ProxyAgent>()
  private readonly retirementAttempts = new Map<ProxyAgent, Promise<void>>()

  constructor(
    private readonly createDispatcher: (proxyUrl: string) => ProxyAgent = (proxyUrl) => new ProxyAgent(proxyUrl),
  ) {}

  dispatcher(scope: NetworkProxyTransportScope, proxyUrl: string): Dispatcher {
    this.retryRetiringAgents()
    const current = this.agents.get(scope)
    if (current?.proxyUrl === proxyUrl) return current.dispatcher
    if (current) this.retire(current.dispatcher)
    const dispatcher = this.createDispatcher(proxyUrl)
    this.agents.set(scope, { proxyUrl, dispatcher })
    return dispatcher
  }

  async dispose(): Promise<void> {
    for (const { dispatcher } of this.agents.values()) this.retiring.add(dispatcher)
    this.agents.clear()
    await Promise.allSettled(this.retirementAttempts.values())
    const retrying = [...this.retiring].map(async (dispatcher) => {
      await dispatcher.close()
      this.retiring.delete(dispatcher)
    })
    const results = await Promise.allSettled(retrying)
    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason)
    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} network proxy transport(s) failed to close`)
    }
  }

  private retire(dispatcher: ProxyAgent): void {
    this.retiring.add(dispatcher)
    this.startRetirement(dispatcher)
  }

  private retryRetiringAgents(): void {
    for (const dispatcher of this.retiring) this.startRetirement(dispatcher)
  }

  private startRetirement(dispatcher: ProxyAgent): void {
    if (this.retirementAttempts.has(dispatcher)) return
    const attempt = dispatcher.close()
    this.retirementAttempts.set(dispatcher, attempt)
    void attempt
      .then(
        () => this.retiring.delete(dispatcher),
        () => undefined,
      )
      .finally(() => this.retirementAttempts.delete(dispatcher))
  }
}

export function proxiedNodeFetchInit<T extends RequestInit & { dispatcher?: Dispatcher }>(
  init: T,
  proxyUrl: string,
  scope: NetworkProxyTransportScope,
  owner: NetworkProxyTransportOwner,
): T & { dispatcher: Dispatcher } {
  return {
    ...init,
    dispatcher: owner.dispatcher(scope, proxyUrl),
  }
}
