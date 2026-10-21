import { apiJson, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { directoryScopedPath } from "./task-path"

const DEFERRED_TOOL_PART_CACHE_LIMIT = 128
const deferredToolPartCache = new Map<string, Promise<any>>()

export type DeferredToolPartSource = {
  authority: ApiAuthority
  sessionID: string
  messageID: string
  partID: string
  directory: string
  outputBytes: number
  stateBytes: number
  stateSha256: string
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function deferredToolPartCacheKey(source: DeferredToolPartSource): string {
  return [
    source.authority.revision,
    source.directory,
    source.sessionID,
    source.messageID,
    source.partID,
    source.stateSha256,
  ].join("\u0000")
}

/** Read the exact immutable Tool outcome shared by disclosures and historical comparisons. */
export function readDeferredToolPart(source: DeferredToolPartSource): Promise<any> {
  assertApiAuthorityCurrent(source.authority)
  const key = deferredToolPartCacheKey(source)
  const cached = deferredToolPartCache.get(key)
  if (cached) return cached
  const request = apiJson(
    directoryScopedPath(
      `session/${encodeURIComponent(source.sessionID)}/message/${encodeURIComponent(source.messageID)}/part/${encodeURIComponent(source.partID)}`,
      source.directory,
      "deferred conversation Tool Part",
    ),
    { authority: source.authority },
  )
    .then(async (loaded) => {
      if (
        !loaded ||
        loaded.type !== "tool" ||
        String(loaded.id || "") !== source.partID ||
        String(loaded.sessionID || "") !== source.sessionID ||
        String(loaded.messageID || "") !== source.messageID
      ) {
        throw new Error(`Deferred Tool Part ${source.partID} returned drifted persisted identity`)
      }
      const serializedState = JSON.stringify(loaded.state)
      const stateBytes = new TextEncoder().encode(serializedState).byteLength
      if (stateBytes !== source.stateBytes || (await sha256Text(serializedState)) !== source.stateSha256) {
        throw new Error(`Deferred Tool Part ${source.partID} state changed during read`)
      }
      const output = loaded.state?.status === "completed" ? String(loaded.state.output || "") : ""
      if (new TextEncoder().encode(output).byteLength !== source.outputBytes) {
        throw new Error(`Deferred Tool Part ${source.partID} output changed during read`)
      }
      assertApiAuthorityCurrent(source.authority)
      return loaded
    })
    .catch((error) => {
      if (deferredToolPartCache.get(key) === request) deferredToolPartCache.delete(key)
      throw error
    })
  deferredToolPartCache.set(key, request)
  while (deferredToolPartCache.size > DEFERRED_TOOL_PART_CACHE_LIMIT) {
    const oldest = deferredToolPartCache.keys().next().value
    if (typeof oldest !== "string") break
    deferredToolPartCache.delete(oldest)
  }
  return request
}
