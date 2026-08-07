import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"

export interface StaticRenderServer {
  url: string
  root: string
  server: http.Server
  close(): Promise<void>
}

export async function serveRenderedDir(projectDir: string): Promise<StaticRenderServer> {
  const root = await resolveStaticRoot(projectDir)
  const port = await getFreePort()
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1")
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html"
      const requested = path.resolve(root, relative)
      if (!requested.startsWith(root)) {
        res.writeHead(403)
        res.end("Forbidden")
        return
      }
      const stat = await fs.stat(requested).catch(() => undefined)
      const filePath = stat?.isDirectory() ? path.join(requested, "index.html") : requested
      const body = await fs.readFile(filePath)
      res.writeHead(200, { "content-type": contentType(filePath) })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end("Not found")
    }
  })
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve))
  return {
    url: `http://127.0.0.1:${port}/index.html`,
    root,
    server,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

export async function resolveStaticRoot(projectDir: string): Promise<string> {
  const candidates = [
    path.join(projectDir, "dist"),
    path.join(projectDir, "build"),
    path.join(projectDir, "out"),
    projectDir,
  ]
  for (const candidate of candidates) {
    const indexPath = path.join(candidate, "index.html")
    const stat = await fs.stat(indexPath).catch(() => undefined)
    if (stat?.isFile()) return candidate
  }
  throw new Error(
    `[static-render-server] directory does not contain dist/index.html, build/index.html, out/index.html, or index.html: ${projectDir}`,
  )
}

async function getFreePort(): Promise<number> {
  const server = http.createServer()
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  await new Promise((resolve) => server.close(resolve))
  return port
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === ".html") return "text/html; charset=utf-8"
  if (ext === ".js") return "text/javascript; charset=utf-8"
  if (ext === ".css") return "text/css; charset=utf-8"
  if (ext === ".json") return "application/json"
  if (ext === ".png") return "image/png"
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".svg") return "image/svg+xml"
  if (ext === ".woff") return "font/woff"
  if (ext === ".woff2") return "font/woff2"
  return "application/octet-stream"
}
