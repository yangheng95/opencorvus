import type { ExpertSquadMarketIndexItem, ExpertSquadMarketItem } from "./expert-squad"

export interface ExpertSquadMarketCatalogProjection {
  index: ExpertSquadMarketIndexItem[]
  items: ExpertSquadMarketItem[]
  selectedID: string
}

export function expertSquadMarketIndexFromDetail(detail: ExpertSquadMarketItem): ExpertSquadMarketIndexItem {
  return {
    namespace: detail.namespace,
    id: detail.id,
    name: detail.name,
    label: detail.label,
    description: detail.description,
    version: detail.version,
    installation_scopes: detail.installations.map((installation) => installation.installation_scope),
  }
}

export function reconcileExpertSquadMarketCatalog(input: {
  page: readonly ExpertSquadMarketIndexItem[]
  current: readonly ExpertSquadMarketItem[]
  exact: readonly ExpertSquadMarketItem[]
  preservedIDs: readonly string[]
  requestedSelectedID?: string
}): ExpertSquadMarketCatalogProjection {
  const preserved = new Set(input.preservedIDs.map((id) => id.trim()).filter(Boolean))
  const exactByID = new Map(input.exact.map((item) => [item.id, item]))
  const currentByID = new Map(input.current.map((item) => [item.id, item]))
  const index = new Map(input.page.map((item) => [item.id, item]))
  const items = new Map<string, ExpertSquadMarketItem>()

  for (const entry of input.page) {
    const detail = exactByID.get(entry.id) ?? currentByID.get(entry.id)
    if (detail) items.set(entry.id, detail)
  }
  for (const id of preserved) {
    const detail = exactByID.get(id) ?? currentByID.get(id)
    if (!detail) continue
    if (!index.has(id)) index.set(id, expertSquadMarketIndexFromDetail(detail))
    items.set(id, detail)
  }

  const requested = input.requestedSelectedID?.trim() ?? ""
  const selectedID =
    (requested && index.has(requested) ? requested : "") ||
    [...index.values()].find((item) => item.installation_scopes.length === 0)?.id ||
    index.values().next().value?.id ||
    ""

  return { index: [...index.values()], items: [...items.values()], selectedID }
}
