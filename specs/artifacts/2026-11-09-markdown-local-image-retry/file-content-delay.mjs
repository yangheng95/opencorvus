import assert from "node:assert/strict"
import fs from "node:fs"
import http from "node:http"
import net from "node:net"

const [listenPort, upstreamPort] = process.argv.slice(2, 4).map(Number)
const [delayFile, directory] = process.argv.slice(4)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort)
const host = "127.0.0.1"
const tunnels = new Set()
let ordinal = 0
const record = data => console.log(JSON.stringify({ time: new Date().toISOString(), ...data }))
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
  const file = url.searchParams.get("path"); const attachment = request.method === "GET" && url.pathname === "/file/content" && url.searchParams.get("directory") === directory && ["guide.md", "other.md", "media/retry-diagram.svg", "media/sibling.svg"].includes(file)
  const receipt = attachment ? ++ordinal : undefined
  const delay = attachment ? (JSON.parse(fs.readFileSync(delayFile, "utf8"))[file] ?? 0) : 0
  assert.ok(Number.isInteger(delay) && delay >= 0 && delay <= 15000)
  if (attachment) record({ receipt, stage: "arrival", path: file, delay })
  const forwarded = http.request({
    hostname: host, port: upstreamPort, path: url.pathname + url.search, method: request.method,
    headers: { ...request.headers, host: host + ":" + upstreamPort },
  }, original => {
    if (attachment) record({ receipt, stage: "origin", path: file, status: original.statusCode, requestID: original.headers["x-opencorvus-request-id"] })
    if (!delay || original.statusCode !== 200) {
      response.writeHead(original.statusCode, original.headers)
      original.pipe(response)
      return
    }
    const chunks = []
    original.on("data", chunk => chunks.push(chunk))
    original.on("end", () => {
      const body = Buffer.concat(chunks)
      setTimeout(() => {
        if (response.destroyed) { record({ receipt, stage: "client-closed" }); return }
        response.writeHead(original.statusCode, original.headers)
        response.end(body, () => record({ receipt, stage: "released", bytes: body.length }))
      }, delay)
    })
  })
  forwarded.on("error", () => { if (response.headersSent) response.destroy(); else response.writeHead(502).end() })
  response.on("close", () => { if (attachment && !response.writableFinished) record({ receipt, stage: "client-cancelled", path: file }); forwarded.destroy() })
  request.pipe(forwarded)
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
server.listen(listenPort, host, () => console.log(JSON.stringify({ listenPort, upstreamPort, pid: process.pid })))
