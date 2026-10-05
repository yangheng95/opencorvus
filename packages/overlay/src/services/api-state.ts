import { joinServerBaseUrl, routeRequiresProjectDirectory } from "@opencorvus-ai/transport-protocol"
import { DEFAULT_SERVER } from "./default-server"
import type { StreamCloseInfo, TransportResponse } from "./host-transport"
import { batch, createSignal, untrack } from "solid-js"

let serverUrl = DEFAULT_SERVER
let authCredentials = { username: "opencorvus", password: "" }
let directoryContext = ""
const [authorityRevision, setAuthorityRevision] = createSignal(0)

export interface ApiAuthority {
  readonly revision: number
}

export type ApiAuthorityOutcome =
  | { phase: "before_dispatch" }
  | { phase: "response"; response: TransportResponse<unknown> }
  | { phase: "transport_failure"; cause: unknown }
  | { phase: "stream_closed"; reason: string; info: StreamCloseInfo }

/** A retired client authority, never a fabricated server rejection. */
export class ApiAuthorityChangedError extends Error {
  override readonly name = "ApiAuthorityChangedError"
  readonly phase: ApiAuthorityOutcome["phase"]
  readonly expectedRevision: number
  readonly currentRevision: number
  #outcome: ApiAuthorityOutcome

  constructor(authority: ApiAuthority, outcome: ApiAuthorityOutcome) {
    super("The API connection changed during this operation.")
    this.phase = outcome.phase
    this.expectedRevision = authority.revision
    this.currentRevision = authorityRevision()
    this.#outcome = outcome
  }

  get outcome(): ApiAuthorityOutcome {
    return this.#outcome
  }
}

export function captureApiAuthority(): ApiAuthority {
  return Object.freeze({ revision: authorityRevision() })
}

export function isApiAuthorityCurrent(authority: ApiAuthority): boolean {
  return authority.revision === authorityRevision()
}

export function assertApiAuthorityCurrent(
  authority: ApiAuthority,
  outcome: ApiAuthorityOutcome = { phase: "before_dispatch" },
): void {
  if (!isApiAuthorityCurrent(authority)) throw new ApiAuthorityChangedError(authority, outcome)
}

/** Call only on an explicit confirmed native rotation, including a reused URL. */
export function renewApiAuthority(): void {
  batch(() => {
    setAuthorityRevision((current) => current + 1)
    untrack(fireAuthChange)
  })
}

const authChangeListeners = new Set<() => void>()

export function onAuthChange(listener: () => void): () => void {
  authChangeListeners.add(listener)
  return () => {
    authChangeListeners.delete(listener)
  }
}

function fireAuthChange(): void {
  for (const listener of [...authChangeListeners]) {
    try {
      listener()
    } catch (error) {
      console.error("[api] auth change listener threw", error)
    }
  }
}

export function configure(opts: { serverUrl?: string; username?: string; password?: string; directory?: string }) {
  batch(() => {
    let credentialChanged = false
    if (opts.serverUrl && opts.serverUrl !== serverUrl) {
      serverUrl = opts.serverUrl
      credentialChanged = true
    }
    if (opts.username !== undefined && opts.username !== authCredentials.username) {
      authCredentials.username = opts.username
      credentialChanged = true
    }
    if (opts.password !== undefined && opts.password !== authCredentials.password) {
      authCredentials.password = opts.password
      credentialChanged = true
    }
    if (opts.directory !== undefined) directoryContext = String(opts.directory || "").trim()
    if (credentialChanged) renewApiAuthority()
  })
}

export function getServerUrl(): string {
  return serverUrl
}

type QueryMap = Record<string, string | number | boolean | undefined | null>

export class ProjectDirectoryRequiredError extends Error {
  override readonly name = "ProjectDirectoryRequiredError"
  constructor(
    readonly path: string,
    readonly method: string,
  ) {
    super(`Project-scoped route ${method} /${path.replace(/^\/+/, "")} requires a configured directory`)
  }
}

export function splitPathQuery(path: string): { pathOnly: string; query: Record<string, string> | undefined } {
  const queryIndex = path.indexOf("?")
  if (queryIndex < 0) return { pathOnly: path, query: undefined }
  const pathOnly = path.slice(0, queryIndex)
  const params = new URLSearchParams(path.slice(queryIndex + 1))
  const query: Record<string, string> = {}
  params.forEach((value, key) => {
    query[key] = value
  })
  return { pathOnly, query }
}

export function queryWithDirectory(
  path: string,
  query?: QueryMap,
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
): Record<string, string | number | boolean> | undefined {
  const pathOnly = path.replace(/^\/+/, "")
  const next: Record<string, string | number | boolean> = {}
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      next[key] = value
    }
  }
  if (routeRequiresProjectDirectory(pathOnly, method) && directoryContext && next.directory === undefined) {
    next.directory = directoryContext
  }
  return Object.keys(next).length > 0 ? next : undefined
}

function hasDirectoryQuery(query: Record<string, string | number | boolean> | undefined): boolean {
  if (!query || query.directory === undefined) return false
  return String(query.directory).trim().length > 0
}

function requireProjectDirectoryQuery(
  pathOnly: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  query: Record<string, string | number | boolean> | undefined,
): void {
  if (!routeRequiresProjectDirectory(pathOnly, method)) return
  if (hasDirectoryQuery(query)) return
  throw new ProjectDirectoryRequiredError(pathOnly, method)
}

function relativePath(path: string): string {
  if (/^https?:/i.test(path)) {
    const url = new URL(path)
    return url.pathname.replace(/^\/+/, "") + (url.search || "")
  }
  return path.replace(/^\/+/, "")
}

export function requestTarget(
  path: string,
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
): {
  pathOnly: string
  query: Record<string, string | number | boolean> | undefined
} {
  const url = relativePath(path)
  const { pathOnly, query } = splitPathQuery(url)
  const requestMethod = method ?? "GET"
  const nextQuery = queryWithDirectory(pathOnly, query, requestMethod)
  requireProjectDirectoryQuery(pathOnly, requestMethod, nextQuery)
  return { pathOnly, query: nextQuery }
}

export function apiUrl(path: string): string {
  const next = path.replace(/^\/+/, "")
  const { pathOnly, query } = splitPathQuery(next)
  const url = joinServerBaseUrl(serverUrl, pathOnly)
  const nextQuery = queryWithDirectory(pathOnly, query, "GET")
  if (nextQuery) {
    for (const [key, value] of Object.entries(nextQuery)) {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

export function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (authCredentials.password) {
    headers.Authorization = `Basic ${btoa(`${authCredentials.username}:${authCredentials.password}`)}`
  }
  return headers
}
