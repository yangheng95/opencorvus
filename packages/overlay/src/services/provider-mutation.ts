import type { ApiAuthority } from "./api"

export type ProviderMutationScope = { kind: "global" } | { kind: "project"; directory: string }

/** An accepted API outcome, independent of the initiating form's lifetime. */
export interface ProviderMutation {
  authority: ApiAuthority
  scope: ProviderMutationScope
  providerIDs: readonly string[] | "all"
}

const listeners = new Set<(mutation: ProviderMutation) => void>()

export function providerMutationScope(directory: string): ProviderMutationScope {
  const value = directory.trim()
  return value ? { kind: "project", directory: value } : { kind: "global" }
}

export function onProviderMutation(listener: (mutation: ProviderMutation) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function publishProviderMutation(mutation: ProviderMutation): void {
  for (const listener of [...listeners]) {
    try {
      listener(mutation)
    } catch (error) {
      console.error("[provider] accepted mutation listener threw", error)
    }
  }
}
