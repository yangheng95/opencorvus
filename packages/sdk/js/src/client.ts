export * from "./gen/types.gen.js"

import { createClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { OpenCorvusClient as GeneratedOpenCorvusClient } from "./gen/sdk.gen.js"
import { routeRequiresProjectDirectory } from "./route-policy.js"

export class OpenCorvusClient extends GeneratedOpenCorvusClient {
  /** Resolve a resource through this client's actual transport, including its service prefix. */
  resourceUrl(path: string): string {
    const url = new URL(this.client.buildUrl({ url: path }))
    url.username = ""
    url.password = ""
    return url.href
  }
}

export type OpenCorvusClientConfig = Config & {
  /** Project path on the server, transmitted exactly regardless of the client's operating system. */
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

function withDirectoryQuery(request: Request, directory: string, route: string) {
  const url = new URL(request.url)
  if (!routeRequiresProjectDirectory(route, request.method)) return request
  if (url.searchParams.has("directory")) return request
  url.searchParams.set("directory", directory)
  return new Request(url, request)
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
    fetch: fetcher,
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
  if (directory) {
    client.interceptors.request.use((request, options) => withDirectoryQuery(request, directory, options.url))
  }
  return new OpenCorvusClient({ client })
}
