import type { GlobalComposerReferencesResponse } from "@opencorvus-ai/sdk"
import { apiJson, captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import type { ExpertSquadSearchResponse } from "@opencorvus-ai/sdk"

export type { GlobalComposerReferencesResponse }

let pendingGlobalComposerReferences: { promise: Promise<GlobalComposerReferencesResponse>; authority: ApiAuthority } | null = null

export function retireGlobalComposerReferences(): void {
  pendingGlobalComposerReferences = null
}

export async function loadGlobalComposerReferences(authority = captureApiAuthority()): Promise<GlobalComposerReferencesResponse> {
  assertApiAuthorityCurrent(authority)
  if (pendingGlobalComposerReferences && isApiAuthorityCurrent(pendingGlobalComposerReferences.authority)) return await pendingGlobalComposerReferences.promise
  const pending = { authority, promise: apiJson<GlobalComposerReferencesResponse>("global/composer-references", { authority }) }
  pendingGlobalComposerReferences = pending
  try {
    return await pending.promise
  } finally {
    if (pendingGlobalComposerReferences === pending) pendingGlobalComposerReferences = null
  }
}

export async function searchGlobalComposerExpertSquads(input: {
  authority?: ApiAuthority
  query?: string
  productPillar?: "code" | "work"
  cursor?: string
  limit?: number
}): Promise<ExpertSquadSearchResponse> {
  const params = new URLSearchParams({ query: input.query?.trim() ?? "", limit: String(input.limit ?? 20) })
  if (input.productPillar) params.set("productPillar", input.productPillar)
  if (input.cursor) params.set("cursor", input.cursor)
  return await apiJson<ExpertSquadSearchResponse>(`global/composer-expert-squads?${params.toString()}`, { authority: input.authority })
}
