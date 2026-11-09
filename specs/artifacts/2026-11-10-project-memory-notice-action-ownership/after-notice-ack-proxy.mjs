import assert from "node:assert/strict"
import fs from "node:fs"
import http from "node:http"
import net from "node:net"
const [listenPort, upstreamPort] = process.argv.slice(2, 4).map(Number)
const [policyFile, directoryA, directoryB] = process.argv.slice(4)
const ackPath = "/experimental/project-memory/notice/acknowledge"
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
  const directory = url.searchParams.get("directory")
  const owned = request.method === "POST" && url.pathname === ackPath && [directoryA, directoryB].includes(directory)
  const receipt = owned ? ++ordinal : undefined
  const policy = owned ? JSON.parse(fs.readFileSync(policyFile, "utf8"))[directory === directoryA ? "a" : "b"] : {}
  const delay = policy.delayMs ?? 0
  assert.ok(Number.isInteger(delay) && delay >= 0 && delay <= 25000)
  if (owned) record({ receipt, stage: "arrival", path: url.pathname, directory, delay, cut: policy.cut === true })
  if (owned && policy.dropBeforeOrigin === true) {
    request.resume()
    record({ receipt, stage: "before-origin-cut", directory })
    response.destroy()
    return
  }
  const forwarded = http.request({
    hostname: host, port: upstreamPort, path: url.pathname + url.search, method: request.method,
    headers: { ...request.headers, host: host + ":" + upstreamPort },
  }, original => {
    if (!owned || original.statusCode !== 200) {
      if (owned) record({ receipt, stage: "origin", status: original.statusCode, requestID: original.headers["x-opencorvus-request-id"] })
      response.writeHead(original.statusCode, original.headers)
      original.pipe(response)
      return
    }
    const chunks = []
    original.on("data", chunk => chunks.push(chunk))
    original.on("end", () => {
      const body = Buffer.concat(chunks)
      const payload = JSON.parse(body)
      const result = { acknowledged: payload.acknowledged }
      assert.equal(typeof result.acknowledged, "boolean")
      record({ receipt, stage: "origin", status: original.statusCode, requestID: original.headers["x-opencorvus-request-id"], result })
      const release = () => {
        if (response.destroyed) { record({ receipt, stage: "client-closed" }); return }
        response.writeHead(original.statusCode, original.headers)
        if (policy.cut === true) {
          assert.ok(body.length > 8)
          response.write(body.subarray(0, 8), () => {
            record({ receipt, stage: "cut", forwardedBytes: 8, result })
            setTimeout(() => response.destroy(), 150)
          })
        } else response.end(body, () => record({ receipt, stage: "released", result }))
      }
      if (delay) setTimeout(release, delay); else release()
    })
  })
  forwarded.on("error", () => { if (response.headersSent) response.destroy(); else response.writeHead(502).end() })
  response.on("close", () => forwarded.destroy())
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
