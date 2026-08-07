let serverUrl: URL | undefined

export function requireServerUrl(): URL {
  if (!serverUrl) throw new Error("Server.url() called before serve() — server not started")
  return serverUrl
}

export function setServerUrl(url: URL): void {
  serverUrl = url
}
