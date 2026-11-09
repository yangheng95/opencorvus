import assert from "node:assert/strict"
import http from "node:http"
import net from "node:net"

const [listenPort, upstreamPort] = process.argv.slice(2, 4).map(Number)
const [directory] = process.argv.slice(4)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort && directory)
const host = "127.0.0.1"
const tunnels = new Set()
let sequence = 0
const record = data => console.log(JSON.stringify({ time: new Date().toISOString(), ...data }))
const server = http.createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/__opencorvus_review_shutdown") {
    response.writeHead(200, {"content-type":"text/plain",connection:"close"})
    response.on("finish", () => {
      server.close()
      server.closeAllConnections()
      for (const socket of tunnels) socket.destroy()
    })
    response.end("stopping")
    return
  }
  const url = new URL(request.url, "http://" + host)
  const owned = request.method === "POST" && url.pathname === "/mission/wake" && url.searchParams.get("directory") === directory
  const receipt = owned ? ++sequence : undefined
  const chunks = []
  const mediaTypes = []
  if (owned) {
    for (let index=0; index<request.rawHeaders.length; index+=2) {
      if (request.rawHeaders[index].toLowerCase()==="content-type") mediaTypes.push(request.rawHeaders[index+1])
    }

    for await (const chunk of request) chunks.push(chunk)
    if (receipt === 2) {
      const base = "http://" + host + ":" + upstreamPort
      const query = "?directory=" + encodeURIComponent(directory)
      const change = await fetch(base + "/config" + query, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "b159-current/offline", provider: {"b159-retired": null}, enabled_providers: ["b159-current"] }),
      })
      const changed = await change.json()
      const inventory = await fetch(base + "/config/providers" + query)
      const projection = (await inventory.json()).providers.map(p => p.id).filter(id => id.startsWith("b159-"))
      record({kind:"catalog-changed-between-attempts", changeStatus:change.status, model:changed.model, projection})
      if (change.status !== 200 || changed.model !== "b159-current/offline" || projection.join() !== "b159-current") {
        response.writeHead(502).end("isolation catalog change failed")
        return
      }
    }
  }
  const forwarded = http.request({
    hostname:host, port:upstreamPort, path:url.pathname+url.search, method:request.method,
    headers:{...request.headers,host:host+":"+upstreamPort},
  }, original => {
    if (owned && original.statusCode === 200) {
      const completed = []
      original.on("data", chunk => completed.push(chunk))
      original.on("end", () => {
        const body = Buffer.concat(completed)
        const draft = JSON.parse(body.toString("utf8"))
        const sent = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        const cut = receipt === 1
        record({ receipt, method: request.method, route: url.pathname, upstreamStatus: original.statusCode,
          upstreamRequestID: original.headers["x-opencorvus-request-id"],
          sent: {requestID: sent.requestID, text: sent.text, model: sent.model,
            productPillar: sent.productPillar, expertSquadIDs: sent.expertSquadIDs},
          accepted: {missionID: draft.missionID, sessionID: draft.sessionID, created: draft.created, productPillar: draft.productPillar},
          responseBytes: body.length, browserResponse: cut ? "truncated after 16 bytes" : "complete" })
        if (!cut) {
          response.writeHead(original.statusCode, original.headers)
          response.end(body)
          return
        }
        response.writeHead(original.statusCode, {
          "content-type": original.headers["content-type"],
          "x-opencorvus-request-id": original.headers["x-opencorvus-request-id"],
          "content-length": String(body.length),
          connection: "close",
        })
        response.end(body.subarray(0, 16))
      })
      original.on("error", () => response.destroy())
      return
    }
    response.writeHead(original.statusCode, original.headers)
    original.pipe(response)
  })
  forwarded.on("error", () => { if (response.headersSent) response.destroy(); else response.writeHead(502).end() })
  response.on("close", () => forwarded.destroy())
  if (owned) forwarded.end(Buffer.concat(chunks)); else request.pipe(forwarded)
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
