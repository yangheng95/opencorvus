import assert from "node:assert/strict"
import http from "node:http"
import { readFileSync } from "node:fs"

const [listenPort, upstreamPort] = process.argv.slice(2).map(Number)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort)
const [modeFile, directory] = process.argv.slice(4)
const host = "127.0.0.1"
const tested = new Set(["", "plans", "plans/drafts", "plans/reference"])
const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/__opencorvus_review_shutdown") {
    response.writeHead(200, { "content-type": "text/plain", connection: "close" }).end("stopping")
    response.on("finish", () => {
      server.close()
      server.closeAllConnections()
    })
    return
  }
  const target = new URL(request.url, "http://" + host)
  const source = target.pathname + target.search
  const folder = target.searchParams.get("path")
  const relevant = request.method === "GET" && target.pathname === "/file" &&
    target.searchParams.get("directory") === directory && tested.has(folder)
  const mode = relevant ? readFileSync(modeFile, "utf8").trim() : "direct"
  if (relevant && (mode === "both" || (mode === "child" && folder === "plans/drafts"))) {
    target.searchParams.set("path", "missing-owned-" + (folder ? folder.replaceAll("/", "-") : "root"))
  }
  const routed = target.pathname + target.search
  const forward = http.request({
    hostname: host, port: upstreamPort, path: routed, method: request.method,
    headers: { ...request.headers, host: host + ":" + upstreamPort },
  }, original => {
    if (relevant) console.log(JSON.stringify({
      time: new Date().toISOString(), mode, folder, source, target: routed,
      status: original.statusCode, requestID: original.headers["x-opencorvus-request-id"],
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
server.listen(listenPort, host, () => console.log(JSON.stringify({ listenPort, upstreamPort, pid: process.pid })))