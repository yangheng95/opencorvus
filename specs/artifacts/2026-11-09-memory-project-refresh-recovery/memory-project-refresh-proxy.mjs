import assert from "node:assert/strict"
import http from "node:http"
import net from "node:net"

const [listenPort, upstreamPort] = process.argv.slice(2, 4).map(Number)
const targetDirectory = process.argv[4]
const initialCut = process.argv[5] === "initial-cut"
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort && targetDirectory)
const host = "127.0.0.1"
const projectListPath = "/work-ledger"
const projectUpdatePath = "/project/current"
const record = (data) => console.log(JSON.stringify({ time: new Date().toISOString(), ...data }))
const tunnels = new Set()
let serial = 0
let nextProjectListCut = initialCut
let cutUsed = false
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
  const projectList = request.method === "GET" && url.pathname === projectListPath && !url.searchParams.has("limit") && !url.searchParams.has("search")
  const projectUpdate = request.method === "PATCH" && url.pathname === projectUpdatePath && url.searchParams.get("directory") === targetDirectory
  if (projectUpdate && !cutUsed) nextProjectListCut = true
  const cut = projectList && nextProjectListCut
  if (cut) {
    nextProjectListCut = false
    cutUsed = true
  }
  const scopedMemory = request.method === "GET" && ["/experimental/project-memory", "/panel/knowledge/memory"].includes(url.pathname)
  const receipt = projectList || projectUpdate || scopedMemory ? ++serial : 0
  if (receipt) record({ receipt, stage: "arrival", route: url.pathname, method: request.method, query: Object.fromEntries(url.searchParams), cut })
  const originalRequest = http.request({
    hostname: host, port: upstreamPort, path: url.pathname + url.search, method: request.method,
    headers: { ...request.headers, host: host + ":" + upstreamPort },
  }, original => {
    if (receipt) record({ receipt, stage: "origin", route: url.pathname, status: original.statusCode, requestID: original.headers["x-opencorvus-request-id"] })
    response.writeHead(original.statusCode, original.headers)
    if (cut && original.statusCode === 200) {
      original.once("data", chunk => {
        assert.ok(chunk.length > 32)
        response.write(chunk.subarray(0, 32), () => {
          record({ receipt, stage: "partial-body", route: url.pathname, bytes: 32 })
          response.destroy()
        })
      })
      original.resume()
      return
    }
    if (projectList && original.statusCode === 200) {
      const chunks = []
      original.on("data", chunk => chunks.push(chunk))
      original.on("end", () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks))
          record({ receipt, stage: "project-page", count: body.rows.length, projects: body.rows.map(({ id, title, directory }) => ({ id, title, directory })), nextCursor: body.nextCursor })
        } catch (error) { record({ receipt, stage: "payload-unparsed", kind: error.name }) }
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
server.listen(listenPort, host, () => console.log(JSON.stringify({ listenPort, upstreamPort, pid: process.pid, targetDirectory, initialCut })))
