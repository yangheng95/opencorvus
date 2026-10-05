import { createServer } from "node:http"
import { connect } from "node:net"
import { createRequire } from "node:module"
import { NetworkProxyTransportOwner, proxiedNodeFetchInit } from "../../src/util/network-proxy-transport.ts"
const { fetch } = createRequire(import.meta.url)("undici")
const upstream = createServer((_request, response) => {
  response.writeHead(201, { "content-type": "text/plain", "x-contract": "dependency-transport" })
  response.write("first:")
  response.end("second")
})
const proxy = createServer()
let tunnels = 0
proxy.on("connect", (_request, client, head) => {
  tunnels += 1
  const socket = connect(upstream.address().port, "127.0.0.1", () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
    if (head.length) socket.write(head)
    client.pipe(socket); socket.pipe(client)
  })
  socket.on("error", () => client.destroy())
  client.on("error", () => socket.destroy())
  client.on("close", () => socket.destroy())
})
await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve))
await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve))
const owner = new NetworkProxyTransportOwner()
let result
try {
  const response = await fetch(`http://127.0.0.1:${upstream.address().port}/stream`,
    proxiedNodeFetchInit({ method: "GET" }, `http://127.0.0.1:${proxy.address().port}`, "connectivityTest", owner))
  result = { status: response.status, contract: response.headers.get("x-contract"), body: await response.text(), tunnels }
} finally {
  await owner.dispose()
  await new Promise((resolve, reject) => proxy.close(error => error ? reject(error) : resolve()))
  await new Promise((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()))
}
console.log(JSON.stringify({ ...result, disposed: true }))
