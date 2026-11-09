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
const server = http.createServer((request, response) => {
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
  const owned = request.method === "PATCH" && url.pathname === "/config" && url.searchParams.get("directory") === directory
  const receipt = owned ? ++sequence : undefined
  const chunks = []
  const mediaTypes = []
  if (owned) {
    for (let index=0; index<request.rawHeaders.length; index+=2) {
      if (request.rawHeaders[index].toLowerCase()==="content-type") mediaTypes.push(request.rawHeaders[index+1])
    }
    request.on("data", chunk => chunks.push(chunk))
  }
  const forwarded = http.request({
    hostname:host, port:upstreamPort, path:url.pathname+url.search, method:request.method,
    headers:{...request.headers,host:host+":"+upstreamPort},
  }, original => {
    if (owned) {
      try {
        const env=JSON.parse(Buffer.concat(chunks).toString("utf8")).local_environment
        if (env && typeof env === "object") {
          const variables=Object.fromEntries(Object.entries(env.variables ?? {}).filter(([key])=>key.startsWith("OPENCORVUS_REVIEW_")))
          record({receipt, method:request.method, route:url.pathname, mediaTypes, body:{name:env.name,variables,setup_script:env.setup_script}, status:original.statusCode, requestID:original.headers["x-opencorvus-request-id"]})
        }
      } catch {}
    }
    response.writeHead(original.statusCode, original.headers)
    original.pipe(response)
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
