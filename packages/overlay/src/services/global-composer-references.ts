import type { GlobalComposerReferencesResponse } from "@opencorvus-ai/sdk"
import { apiJson } from "./api"

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
