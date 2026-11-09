import assert from "node:assert/strict"
import http from "node:http"
import net from "node:net"
import path from "node:path"

const [listenPort, upstreamPort] = process.argv.slice(2, 4).map(Number)
const [profileDirectory, delay = "6000", cutOrdinal = "0"] = process.argv.slice(4)
const holdMs = Number(delay)
const cutReceipt = Number(cutOrdinal)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort && profileDirectory)
assert.ok(Number.isInteger(holdMs) && holdMs > 0 && holdMs < 15_000)
assert.ok(Number.isInteger(cutReceipt) && cutReceipt >= 0)
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
  const tail = request.method === "GET" && url.pathname === "/log/tail" && url.searchParams.get("n") === "500"
  const receipt = tail ? ++serial : 0
  const hold = receipt === 2 || receipt === 3 || receipt === 6
  const cut = receipt > 0 && receipt === cutReceipt
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
      const ownedFile = path.relative(profileDirectory, decoded.path)
      assert.ok(ownedFile && !ownedFile.startsWith("..") && !path.isAbsolute(ownedFile))
      const markers = decoded.lines.flatMap(line => line.match(/opencorvus-b122-(?:before|after)-[a-z-]+/g) ?? [])
      record({ receipt, stage: "original-complete", bytes: body.length, lineCount: decoded.lines.length, ownedFile, markers: [...new Set(markers)] })
      const release = () => {
        if (response.destroyed) {
          record({ receipt, stage: "client-closed" })
          return
        }
        response.writeHead(original.statusCode, original.headers)
        if (cut) {
          assert.ok(body.length > 32)
          response.write(body.subarray(0, 32), () => {
            record({ receipt, stage: "partial-body", bytes: 32 })
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
server.listen(listenPort, host, () => console.log(JSON.stringify({ listenPort, upstreamPort, pid: process.pid, profileDirectory, holdMs, cutReceipt })))
