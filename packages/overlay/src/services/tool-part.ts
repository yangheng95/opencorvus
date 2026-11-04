import { apiJson, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { directoryScopedPath } from "./task-path"
import type { ConversationDeferredToolState } from "@opencorvus-ai/transport-protocol"
import { createSignal } from "solid-js"

const TOOL_PART_CACHE_LIMIT = 128
type ToolPartCacheEntry = { request: Promise<any>; value?: any }
const toolPartCache = new Map<string, ToolPartCacheEntry>()
const [toolPartCacheVersion, setToolPartCacheVersion] = createSignal(0)

export type ToolPartSource = {
  authority: ApiAuthority
  sessionID: string
  messageID: string
  partID: string
  directory: string
  integrity?: ConversationDeferredToolState
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function toolPartCacheKey(source: ToolPartSource): string {
  return [
    source.authority.revision,
    source.directory,
    source.sessionID,
    source.messageID,
    source.partID,
    source.integrity?.stateSha256 ?? "completed",
  ].join("\u0000")
}

/** Observe the same verified cache entry without starting a request. */
export function retainedToolPart(source: ToolPartSource): any | undefined {
  toolPartCacheVersion()
  assertApiAuthorityCurrent(source.authority)
  return toolPartCache.get(toolPartCacheKey(source))?.value
}

/** Read the exact immutable Tool outcome shared by disclosures and historical comparisons. */
export function readToolPart(source: ToolPartSource): Promise<any> {
  assertApiAuthorityCurrent(source.authority)
  const key = toolPartCacheKey(source)
  const cached = toolPartCache.get(key)
  if (cached) return cached.request
  let entry: ToolPartCacheEntry
  const request = apiJson(
    directoryScopedPath(
      `session/${encodeURIComponent(source.sessionID)}/message/${encodeURIComponent(source.messageID)}/part/${encodeURIComponent(source.partID)}`,
      source.directory,
      "recorded conversation Tool Part",
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
        throw new Error(`Recorded Tool Part ${source.partID} returned drifted persisted identity`)
      }
      if (loaded.state?.status !== "completed") {
        throw new Error(`Recorded Tool Part ${source.partID} has no completed outcome`)
      }
      if (source.integrity) {
        const serializedState = JSON.stringify(loaded.state)
        const stateBytes = new TextEncoder().encode(serializedState).byteLength
        if (
          stateBytes !== source.integrity.stateBytes ||
          (await sha256Text(serializedState)) !== source.integrity.stateSha256
        ) {
          throw new Error(`Deferred Tool Part ${source.partID} state changed during read`)
        }
        const output = String(loaded.state.output || "")
        if (new TextEncoder().encode(output).byteLength !== source.integrity.outputBytes) {
          throw new Error(`Deferred Tool Part ${source.partID} output changed during read`)
        }
      }
      assertApiAuthorityCurrent(source.authority)
      if (toolPartCache.get(key) === entry) {
        entry.value = loaded
        setToolPartCacheVersion((value) => value + 1)
      }
      return loaded
    })
    .catch((error) => {
      if (toolPartCache.get(key)?.request === request) toolPartCache.delete(key)
      throw error
    })
  entry = { request }
  toolPartCache.set(key, entry)
  while (toolPartCache.size > TOOL_PART_CACHE_LIMIT) {
    const oldest = toolPartCache.keys().next().value
    if (typeof oldest !== "string") break
    const retired = toolPartCache.get(oldest)
    toolPartCache.delete(oldest)
    if (retired?.value) setToolPartCacheVersion((value) => value + 1)
  }
  return request
}
