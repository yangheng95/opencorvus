import { createSignal } from "solid-js"
import type { ComposerProjectOperation } from "./workspace"

export interface ComposerUploadToken {
  readonly operation: ComposerProjectOperation
}

/** File and folder inputs share this component-owned set of live operations. */
export function createComposerUploadLifetime() {
  const [tokens, setTokens] = createSignal<ReadonlySet<ComposerUploadToken>>(new Set())
  let disposed = false
  const isCurrent = (token: ComposerUploadToken): boolean => tokens().has(token) && token.operation.isCurrent()
  return {
    count: () => [...tokens()].filter((token) => token.operation.isCurrent()).length,
    register(operation: ComposerProjectOperation): ComposerUploadToken {
      if (disposed) throw new Error("Composer upload lifetime is disposed")
      const token = { operation }
      setTokens((current) => new Set([...current, token]))
      return token
    },
    isCurrent,
    has: (token: ComposerUploadToken): boolean => tokens().has(token),
    finish(token: ComposerUploadToken): void {
      setTokens((current) => {
        const next = new Set(current)
        next.delete(token)
        return next
      })
    },
    dispose(): void {
      disposed = true
      setTokens(new Set<ComposerUploadToken>())
    },
  }
}
