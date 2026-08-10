import type { GlobalComposerReferencesResponse } from "@opencorvus-ai/sdk"
import { apiJson } from "./api"
import type { ExpertSquadSearchResponse } from "@opencorvus-ai/sdk"

export type { GlobalComposerReferencesResponse }

let pendingGlobalComposerReferences: Promise<GlobalComposerReferencesResponse> | null = null

export async function loadGlobalComposerReferences(): Promise<GlobalComposerReferencesResponse> {
  if (pendingGlobalComposerReferences) return await pendingGlobalComposerReferences
  const pending = apiJson<GlobalComposerReferencesResponse>("global/composer-references")
  pendingGlobalComposerReferences = pending
  try {
    return await pending
  } finally {
    if (pendingGlobalComposerReferences === pending) pendingGlobalComposerReferences = null
  }
}

export async function searchGlobalComposerExpertSquads(input: {
  query?: string
  productPillar?: "code" | "work"
  cursor?: string
  limit?: number
}): Promise<ExpertSquadSearchResponse> {
  const params = new URLSearchParams({ query: input.query?.trim() ?? "", limit: String(input.limit ?? 20) })
  if (input.productPillar) params.set("productPillar", input.productPillar)
  if (input.cursor) params.set("cursor", input.cursor)
  return await apiJson<ExpertSquadSearchResponse>(`global/composer-expert-squads?${params.toString()}`)
}
