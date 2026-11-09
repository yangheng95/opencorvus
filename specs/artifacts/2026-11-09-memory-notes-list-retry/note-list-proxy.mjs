import assert from "node:assert/strict"
import http from "node:http"
import net from "node:net"

const [listenPort, upstreamPort] = process.argv.slice(2, 4).map(Number)
const [targetDirectory, limit = "1", retryDelay = "0"] = process.argv.slice(4)
const cutLimit = Number(limit)
const retryDelayMs = Number(retryDelay)
assert.ok(Number.isInteger(cutLimit) && cutLimit > 0 && Number.isInteger(retryDelayMs) && retryDelayMs >= 0)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort && targetDirectory)
const host = "127.0.0.1"
const record = data => console.log(JSON.stringify({ time: new Date().toISOString(), ...data }))
const tunnels = new Set()
let serial = 0
let cuts = 0
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
  const memoryRoute = request.method === "GET" && /^\/panel\/knowledge\/memory(?:\/[^/]+)?$/.test(url.pathname)
  const searchRoute = request.method === "POST" && url.pathname === "/panel/knowledge/memory/search"
  const exactTarget = memoryRoute && url.pathname === "/panel/knowledge/memory" && url.searchParams.get("directory") === targetDirectory
  const cut = exactTarget && cuts < cutLimit
  if (cut) cuts += 1
  const delay = cut && cuts > 1 ? retryDelayMs : 0
  const receipt = memoryRoute || searchRoute ? ++serial : 0
  if (receipt) record({ receipt, stage: "arrival", route: url.pathname, method: request.method, directory: url.searchParams.get("directory"), cut })
  const originalRequest = http.request({
    hostname: host, port: upstreamPort, path: url.pathname + url.search, method: request.method,
    headers: { ...request.headers, host: host + ":" + upstreamPort },
  }, original => {
    if (receipt) record({ receipt, stage: "origin", route: url.pathname, status: original.statusCode, requestID: original.headers["x-opencorvus-request-id"] })
    response.writeHead(original.statusCode, original.headers)
    if (cut && original.statusCode === 200) {
      original.once("data", chunk => {
        const bytes = Math.min(32, chunk.length - 1)
        assert.ok(bytes > 0)
        const truncate = () => response.write(chunk.subarray(0, bytes), () => {
          record({ receipt, stage: "partial-body", route: url.pathname, bytes })
          response.destroy()
        })
        if (delay) setTimeout(truncate, delay); else truncate()
      })
      original.resume()
      return
    }
    if (receipt && original.statusCode === 200) {
      const chunks = []
      original.on("data", chunk => chunks.push(chunk))
      original.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks))
          record({ receipt, stage: "memory", items: Array.isArray(body) ? body.map(item => ({ id: item.id ?? item.fileId, title: item.title ?? item.fileTitle })) : [{ id: body.file.id, title: body.file.title, content: body.content }] })
        } catch (cause) { record({ receipt, stage: "payload-unparsed", kind: cause.name }) }
      })
    }
    original.pipe(response)
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
server.listen(listenPort, host, () => console.log(JSON.stringify({ listenPort, upstreamPort, pid: process.pid, targetDirectory, cutLimit, retryDelayMs })))
