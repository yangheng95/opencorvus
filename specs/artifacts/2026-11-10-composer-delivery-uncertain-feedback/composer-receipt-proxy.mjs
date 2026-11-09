import assert from "node:assert/strict"
import http from "node:http"
import net from "node:net"

const [listenPort, upstreamPort] = process.argv.slice(2, 4).map(Number)
const [directory] = process.argv.slice(4)
assert.ok(listenPort > 1024 && upstreamPort > 1024 && listenPort !== upstreamPort && directory)
const host = "127.0.0.1"
const tunnels = new Set()
const attempts = new Map()
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

  const inProject = url.searchParams.get("directory") === directory
  const target = request.method === "POST" && inProject &&
    (url.pathname === "/mission/wake" || /^\/session\/[^/]+\/message$/.test(url.pathname))
  const chunks = []
  let sent
  let observedText
  let key
  let attempt
  if (target) {
    for await (const chunk of request) chunks.push(chunk)
    sent = JSON.parse(Buffer.concat(chunks).toString("utf8"))
    observedText = sent.text ?? sent.parts?.find(part => part.type === "text")?.text
    if (typeof observedText === "string" && /^(English receipt review:|中文回执复核：|Accepted response review:)/.test(observedText)) {
      key = sent.requestID ?? sent.messageID
      assert.equal(typeof key, "string")
      attempt = (attempts.get(key) ?? 0) + 1
      attempts.set(key, attempt)
    }
  }

  const forwarded = http.request({
    hostname:host, port:upstreamPort, path:url.pathname+url.search, method:request.method,
    headers:{...request.headers,host:host+":"+upstreamPort},
  }, original => {

    if (attempt !== undefined && original.statusCode === 200) {
      const completed = []
      original.on("data", chunk => completed.push(chunk))
      original.on("end", async () => {
        const body = Buffer.concat(completed)
        const returned = JSON.parse(body.toString("utf8"))
        const cut = attempt === 1
        record({ attempt, method: request.method, route: url.pathname, upstreamStatus: original.statusCode,
          upstreamRequestID: original.headers["x-opencorvus-request-id"],
          sent: {key, text: observedText, model: sent.model, productPillar: sent.productPillar},
          accepted: url.pathname === "/mission/wake" ?
            {missionID: returned.missionID,sessionID:returned.sessionID,created:returned.created} :
            {sessionID: returned.info?.sessionID,assistantMessageID:returned.info?.id,parentID:returned.info?.parentID},
          responseBytes: body.length, browserResponse: cut ? "truncated after 16 bytes" : "complete" })
        if (!cut) {
          response.writeHead(original.statusCode, original.headers)
          response.end(body)
          return
        }
        // Leave the actual Session event stream untouched and time to deliver
        // before the independent synchronous HTTP reply is interrupted.
        if (url.pathname !== "/mission/wake") await new Promise(resolve => setTimeout(resolve, 900))
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
  if (target) forwarded.end(Buffer.concat(chunks)); else request.pipe(forwarded)
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
