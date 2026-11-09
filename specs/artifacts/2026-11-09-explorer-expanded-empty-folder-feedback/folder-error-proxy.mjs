import assert from "node:assert/strict"
import http from "node:http"
import { readFileSync } from "node:fs"

const [listenPort, upstreamPort] = process.argv.slice(2).map(Number)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort)
const modeFile = process.argv[4]
const upstream = "127.0.0.1"
const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/__opencorvus_review_shutdown") {
    response.writeHead(200, { "content-type": "text/plain", connection: "close" }).end("stopping")
    response.on("finish", () => {
      server.close()
      server.closeAllConnections()
    })
    return
  }
  const source = new URL(request.url, "http://127.0.0.1")
  const initial = source.pathname + source.search
  const archive = request.method === "GET" && source.pathname === "/file" && source.searchParams.get("path") === "archive"
  const misrouted = archive && (!modeFile || readFileSync(modeFile, "utf8").trim() === "misroute")
  if (misrouted) source.searchParams.set("path", "missing-owned-archive")
  const target = source.pathname + source.search
  const forward = http.request({
    hostname: upstream,
    port: upstreamPort,
    path: target,
    method: request.method,
    headers: { ...request.headers, host: upstream + ":" + upstreamPort },
  }, original => {
    if (archive) console.log(JSON.stringify({
      source: initial, target, status: original.statusCode,
      requestID: original.headers["x-opencorvus-request-id"],
    }))
    response.writeHead(original.statusCode, original.headers)
    original.pipe(response)
  })
  forward.on("error", () => {
    if (response.headersSent) response.destroy()
    else response.writeHead(502).end()
  })
  response.on("close", () => forward.destroy())
  request.pipe(forward)
})
server.listen(listenPort, upstream, () => console.log(JSON.stringify({ listenPort, upstreamPort })))
