export type ServeOpts = {
  hostname?: string
  port?: number
  fetch: (req: Request) => Response | Promise<Response>
}

export type Server = {
  hostname: string
  port: number
  stop: (force?: boolean) => void
}

export type Serve = (opts: ServeOpts) => Server

export function adapt(serve?: Serve) {
  if (serve) return serve
  return (opts: ServeOpts) => Bun.serve(opts) as unknown as Server
}

export function path(raw: string | undefined, defaultPath: string) {
  if (!raw) return defaultPath
  if (raw.startsWith("/")) return raw
  return `/${raw}`
}

export function base(raw: string) {
  return raw.endsWith("/") ? raw.slice(0, -1) : raw
}
