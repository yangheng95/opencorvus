import assert from "node:assert/strict"
import http from "node:http"
import net from "node:net"

const [listenPort, upstreamPort, delayMs = 0] = process.argv.slice(2).map(Number)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort)
const host = "127.0.0.1"
const record = (data) => console.log(JSON.stringify({ time: new Date().toISOString(), ...data }))
const delayedRoutes = new Set(["GET /global/projects/check-directory", "PATCH /project/current"])
let serial = 0
const tunnels = new Set()
const server = http.createServer((request, response) => {
  if (request.method === "POST" && request.url === "/__opencorvus_review_shutdown") {
    response.writeHead(200, { "content-type": "text/plain", connection: "close" })
    response.on("finish", () => {
      server.close()
      server.closeAllConnections()
      for (const socket of tunnels) socket.destroy()
    })
    response.end("stopping")
    return
  }
  const url = new URL(request.url, "http://" + host)
  const ledger = request.method === "GET" && url.pathname === "/work-ledger"
  const projectPath = delayedRoutes.has(request.method + " " + url.pathname)
  const receipt = ledger || projectPath ? ++serial : 0
  if (receipt) record({ receipt, stage: "arrival", route: url.pathname, method: request.method })
  const forward = () => {
    if (response.destroyed) return
    if (receipt) record({ receipt, stage: "forward", route: url.pathname })
    const originalRequest = http.request({
      hostname: host, port: upstreamPort, path: url.pathname + url.search, method: request.method,
      headers: { ...request.headers, host: host + ":" + upstreamPort },
    }, original => {
      if (receipt) record({ receipt, stage: "origin", route: url.pathname, status: original.statusCode, requestID: original.headers["x-opencorvus-request-id"] })
      if (ledger && original.statusCode === 200) {
        const chunks = []
        original.on("data", chunk => chunks.push(chunk))
        original.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks))
            record({ receipt, stage: "payload", rows: body.rows.map(row => ({ kind: row.kind, id: row.id, directory: row.directory })), nextCursor: body.nextCursor })
          } catch (error) { record({ receipt, stage: "payload-unparsed", kind: error.name }) }
        })
      }
      response.writeHead(original.statusCode, original.headers)
      original.pipe(response)
    })
    originalRequest.on("error", () => { if (response.headersSent) response.destroy(); else response.writeHead(502).end() })
    response.on("close", () => originalRequest.destroy())
    request.pipe(originalRequest)
  }
  if (projectPath && delayMs > 0) {
    const timer = setTimeout(forward, delayMs)
    response.once("close", () => clearTimeout(timer))
  } else forward()
})
server.on("upgrade", (request, downstream, head) => {
  const route = new URL(request.url, "http://" + host).pathname
  const upstream = net.connect({ host, port: upstreamPort })
  tunnels.add(downstream)
  const settle = () => { tunnels.delete(downstream); downstream.destroy(); upstream.destroy() }
  downstream.on("close", settle).on("error", settle)
  upstream.on("close", settle).on("error", settle)
  upstream.on("connect", () => {
    const headerLines = []
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      const key = request.rawHeaders[i]
      const value = key.toLowerCase() === "host" ? host + ":" + upstreamPort : request.rawHeaders[i + 1]
      headerLines.push(key + ": " + value)
    }
    upstream.write(request.method + " " + request.url + " HTTP/" + request.httpVersion + "\r\n" + headerLines.join("\r\n") + "\r\n\r\n")
    if (head.length) upstream.write(head)
    upstream.once("data", chunk => record({ stage: "upgrade", route, status: Number(chunk.toString("ascii", 0, 80).match(/^HTTP\/1\.[01] (\d{3})/)?.[1] ?? 0) }))
    downstream.pipe(upstream)
    upstream.pipe(downstream)
  })
})
server.listen(listenPort, host, () => console.log(JSON.stringify({ listenPort, upstreamPort, pid: process.pid, delayMs })))
