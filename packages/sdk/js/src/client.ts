export * from "./gen/types.gen.js"

import { createClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { OpenCorvusClient } from "./gen/sdk.gen.js"
import { routeRequiresProjectDirectory } from "./route-policy.js"
export { OpenCorvusClient }

export type OpenCorvusClientConfig = Config & {
  directory?: string
  username?: string
  password?: string
}

function basicAuthorization(username: string, password: string) {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `Basic ${btoa(binary)}`
}

function headerBag(headers: Config["headers"]) {
  return new Headers(headers as HeadersInit | undefined)
}

function normalizeDirectory(directory: string) {
  let dir = directory
  // Normalize MINGW/MSYS-style paths (/c/foo/bar -> C:\foo\bar) on Windows.
  // These paths cause path.resolve to produce incorrect results (e.g. C:\c\foo\bar).
  if (typeof process !== "undefined" && process.platform === "win32") {
    const m = dir.match(/^\/([a-zA-Z])(\/.*)?$/)
    if (m?.[1]) dir = `${m[1].toUpperCase()}:${(m[2] || "\\").replace(/\//g, "\\")}`
  }
  return dir
}

function withDirectoryQuery(request: Request, directory: string) {
  const url = new URL(request.url)
  if (!routeRequiresProjectDirectory(url.pathname, request.method)) return request
  if (url.searchParams.has("directory")) return request
  url.searchParams.set("directory", directory)
  return new Request(url, request)
}

function directoryScopedFetch(fetcher: typeof fetch, directory: string): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    return fetcher(withDirectoryQuery(request, directory))
  }) as typeof fetch
}

export function createOpenCorvusClient(input?: OpenCorvusClientConfig) {
  const { directory, username, password, ...rest } = input ?? {}
  let config: Config = rest

  const fetcher =
    config.fetch ??
    ((async (req: any) => {
      // @ts-ignore
      req.timeout = false
      return fetch(req)
    }) as typeof fetch)
  config = {
    ...config,
    fetch: directory ? directoryScopedFetch(fetcher, normalizeDirectory(directory)) : fetcher,
  }

  if (password) {
    const headers = headerBag(config.headers)
    if (!headers.has("authorization")) {
      headers.set("Authorization", basicAuthorization(username ?? "opencorvus", password))
    }
    config = {
      ...config,
      headers,
    }
  }

  const client = createClient(config)
  return new OpenCorvusClient({ client })
}
