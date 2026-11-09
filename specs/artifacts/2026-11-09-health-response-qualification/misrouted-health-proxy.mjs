import assert from "node:assert/strict"
import http from "node:http"

const [listenPort, upstreamPort] = process.argv.slice(2).map(Number)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort)
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
  const misrouted = request.method === "GET" && source.pathname === "/global/health"
  const target = (misrouted ? "/global/automations" : source.pathname) + source.search
  const forward = http.request({
    hostname: upstream,
    port: upstreamPort,
    path: target,
    method: request.method,
    headers: { ...request.headers, host: upstream + ":" + upstreamPort },
  }, original => {
    if (misrouted) console.log(JSON.stringify({
      source: source.pathname, target, status: original.statusCode,
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
