import { createSignal } from "solid-js"
import type { ComposerProjectOperation } from "./workspace"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "./api"

export interface ComposerUploadToken {
  readonly operation: ComposerProjectOperation
  readonly authority: ApiAuthority
}

/** File and folder inputs share this component-owned set of live operations. */
export function createComposerUploadLifetime() {
  const [tokens, setTokens] = createSignal<ReadonlySet<ComposerUploadToken>>(new Set())
  let disposed = false
  const isCurrent = (token: ComposerUploadToken): boolean =>
    tokens().has(token) && token.operation.isCurrent() && isApiAuthorityCurrent(token.authority)
  return {
    count: () => [...tokens()].filter(isCurrent).length,
    register(operation: ComposerProjectOperation, authority = captureApiAuthority()): ComposerUploadToken {
      if (disposed) throw new Error("Composer upload lifetime is disposed")
      const token = { operation, authority }
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
