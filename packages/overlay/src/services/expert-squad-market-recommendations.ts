import { createMemo, createResource, onCleanup, type Accessor } from "solid-js"
import { isApiAuthorityCurrent, type ApiAuthority } from "./api"
import type { ExpertSquadMarketIndexItem } from "./expert-squad"

export interface MarketRecommendationRequest {
  authority: ApiAuthority
  load: () => Promise<readonly ExpertSquadMarketIndexItem[]>
}

type MarketRecommendationResult =
  | { request: MarketRecommendationRequest; kind: "ready"; items: readonly ExpertSquadMarketIndexItem[] }
  | { request: MarketRecommendationRequest; kind: "failed"; cause: unknown }

export function createExpertSquadMarketRecommendations(
  source: Accessor<MarketRecommendationRequest | undefined>,
  searchInput: Accessor<HTMLInputElement | undefined>,
) {
  let disposed = false
  onCleanup(() => { disposed = true })
  const [read, { refetch }] = createResource<
    MarketRecommendationResult | undefined,
    MarketRecommendationRequest,
    { retryTrigger?: HTMLButtonElement }
  >(source, async (request, { refetching }) => {
    const owns = () => !disposed && source() === request && isApiAuthorityCurrent(request.authority)
    if (!refetching) await new Promise<void>((resolve) => window.setTimeout(resolve, 280))
    if (!owns()) return undefined
    try {
      const items = await request.load()
      if (!owns()) return undefined
      const trigger = typeof refetching === "object" ? refetching.retryTrigger : undefined
      const input = searchInput()
      if (trigger && input?.isConnected && input.ownerDocument.activeElement === trigger) input.focus()
      return { request, kind: "ready", items }
    } catch (cause) {
      if (owns()) return { request, kind: "failed", cause }
      return undefined
    }
  })

  const currentRead = createMemo(() => {
    const request = source()
    if (!request || read.state === "unresolved" || read.state === "pending") return undefined
    const result = read.latest
    return result?.request === request ? result : undefined
  })
  const loading = () => Boolean(source()) && read.loading
  const failure = () => {
    const result = currentRead()
    return result?.kind === "failed" ? result : undefined
  }
  const items = () => {
    const result = currentRead()
    return !loading() && result?.kind === "ready" ? result.items : []
  }
  const retry = (trigger: HTMLButtonElement) => {
    if (!loading() && failure()) void refetch({ retryTrigger: trigger })
  }
  return { loading, failure, items, retry, refresh: () => refetch({}) }
}
