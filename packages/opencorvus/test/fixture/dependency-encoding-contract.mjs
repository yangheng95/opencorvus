import { createServer as createWireServer, connect } from "node:net"
import { createServer as createProxyServer } from "node:http"
import { createRequire } from "node:module"
import { NetworkProxyTransportOwner, proxiedNodeFetchInit } from "../../src/util/network-proxy-transport.ts"

const { fetch } = createRequire(import.meta.url)("undici")
const progress = (phase) => process.stderr.write(`${phase}\n`)
let resolveEarlyClose
const earlyClose = new Promise((resolve) => {
  resolveEarlyClose = resolve
})
const upstream = createWireServer((socket) => {
  socket.once("data", (data) => {
    const request = data.toString("ascii").split("\r\n", 1)[0]
    progress(request)
    if (request === "GET /encoded HTTP/1.1") {
      socket.once("close", resolveEarlyClose)
      socket.end(
        "HTTP/1.1 200 OK\r\nContent-Encoding: gzip, gzip, gzip, gzip, gzip, gzip\r\nContent-Length: 1\r\nConnection: close\r\n\r\n",
      )
      return
    }
    socket.write(
      "HTTP/1.1 201 Created\r\nContent-Type: text/plain\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n6\r\nfirst:\r\n",
    )
    setImmediate(() => socket.end("6\r\nsecond\r\n0\r\n\r\n"))
  })
  socket.on("error", () => socket.destroy())
})
const proxy = createProxyServer()
proxy.on("connect", (_request, client, head) => {
  progress("proxy-connect")
  const socket = connect(upstream.address().port, "127.0.0.1", () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
    if (head.length) socket.write(head)
    client.pipe(socket)
    socket.pipe(client)
  })
  socket.on("error", () => client.destroy())
  client.on("error", () => socket.destroy())
  client.on("close", () => socket.destroy())
})
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve))
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve))
const owner = new NetworkProxyTransportOwner()
const init = () =>
  proxiedNodeFetchInit({ method: "GET" }, `http://127.0.0.1:${proxy.address().port}`, "connectivityTest", owner)
const origin = `http://127.0.0.1:${upstream.address().port}`
let result
try {
  let rejected
  try {
    const response = await fetch(`${origin}/encoded`, init())
    await response.text()
    throw new Error("Expected the excessive encoding response to return its error contract")
  } catch (error) {
    rejected = { name: error.name, message: error.message, cause: error.cause?.message }
  }
  await earlyClose
  progress("excessive-encoding-settled")
  const response = await fetch(`${origin}/healthy`, init())
  result = { rejected, subsequent: { status: response.status, body: await response.text() } }
  progress("subsequent-stream-settled")
} finally {
  await owner.dispose()
  await new Promise((resolve, reject) => proxy.close((error) => (error ? reject(error) : resolve())))
  await new Promise((resolve, reject) => upstream.close((error) => (error ? reject(error) : resolve())))
}
console.log(JSON.stringify({ ...result, dispatcher: "disposed", servers: "closed" }))
