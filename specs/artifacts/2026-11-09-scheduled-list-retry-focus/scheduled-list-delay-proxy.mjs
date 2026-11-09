import assert from "node:assert/strict"
import http from "node:http"
import net from "node:net"


const [listenPort, upstreamPort] = process.argv.slice(2, 4).map(Number)
const [delay = "11000", cutOrdinals = "1,2", holdOrdinals = "2"] = process.argv.slice(4)
const holdMs = Number(delay)
const holdReceipts = new Set(holdOrdinals.split(",").map(Number))
const cutReceipts = new Set(cutOrdinals.split(",").map(Number))
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort)
assert.ok(Number.isInteger(holdMs) && holdMs > 0 && holdMs < 15_000)
assert.ok([...cutReceipts].every(value => Number.isInteger(value) && value >= 0))
const host = "127.0.0.1"
const record = data => console.log(JSON.stringify({ time: new Date().toISOString(), ...data }))
const tunnels = new Set()
let serial = 0
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
  const list = request.method === "GET" && url.pathname === "/global/automations"
  const receipt = list ? ++serial : 0
  const hold = holdReceipts.has(receipt)
  const cut = cutReceipts.has(receipt)
  if (receipt) record({ receipt, stage: "arrival", route: url.pathname, query: Object.fromEntries(url.searchParams), hold, cut })
  const originalRequest = http.request({
    hostname: host, port: upstreamPort, path: url.pathname + url.search, method: request.method,
    headers: { ...request.headers, host: host + ":" + upstreamPort },
  }, original => {
    if (receipt) record({ receipt, stage: "origin", route: url.pathname, status: original.statusCode, requestID: original.headers["x-opencorvus-request-id"] })
    if (!receipt || original.statusCode !== 200) {
      response.writeHead(original.statusCode, original.headers)
      original.pipe(response)
      return
    }
    const chunks = []
    original.on("data", chunk => chunks.push(chunk))
    original.on("end", () => {
      const body = Buffer.concat(chunks)
      const decoded = JSON.parse(body)
      assert.ok(Array.isArray(decoded))
      record({ receipt, stage: "original-complete", bytes: body.length, itemCount: decoded.length

      })
      const release = () => {
        if (response.destroyed) {
          record({ receipt, stage: "client-closed" })
          return
        }
        response.writeHead(original.statusCode, original.headers)
        if (cut) {
          assert.ok(body.length > 1)
          response.write(body.subarray(0, 1), () => {
            record({ receipt, stage: "partial-body", bytes: 1 })
            response.destroy()
          })
          return
        }
        response.end(body, () => record({ receipt, stage: "released", bytes: body.length }))
      }
      if (hold) setTimeout(release, holdMs); else release()
    })
  })
  originalRequest.on("error", () => { if (response.headersSent) response.destroy(); else response.writeHead(502).end() })
  response.on("close", () => originalRequest.destroy())
  request.pipe(originalRequest)
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
server.listen(listenPort, host, () => console.log(JSON.stringify({ listenPort, upstreamPort, pid: process.pid, holdMs, holdReceipts: [...holdReceipts], cutReceipts: [...cutReceipts] })))
