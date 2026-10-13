import { createServer } from "node:http"
import { connect } from "node:net"
import { createRequire } from "node:module"
import { NetworkProxyTransportOwner, proxiedNodeFetchInit } from "../../src/util/network-proxy-transport.ts"

const { fetch } = createRequire(import.meta.url)("undici")
let encodedInput = ""
for await (const chunk of process.stdin) encodedInput += chunk
// The parent supplies only the public, invented identities in its test table.
const input = JSON.parse(encodedInput)
const expectedAuthentication = `Basic ${Buffer.from(`${input.username}:${input.password}`).toString("base64")}`
const expectedBody = "proxy credential contract: first:second"
let authenticationMatches = false
let targetMatches = false
const origin = createServer((_request, response) => {
  response.writeHead(201, { "content-type": "text/plain" })
  response.write("proxy credential contract: first:")
  response.end("second")
})
const proxy = createServer()
proxy.on("connect", (request, client, head) => {
  authenticationMatches = request.headers["proxy-authorization"] === expectedAuthentication
  targetMatches = request.url === `127.0.0.1:${origin.address().port}`
  if (!authenticationMatches) {
    client.end("HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\n\r\n")
    return
  }
  const upstream = connect(origin.address().port, "127.0.0.1", () => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n")
    if (head.length) upstream.write(head)
    client.pipe(upstream)
    upstream.pipe(client)
  })
  upstream.on("error", () => client.destroy())
  client.on("error", () => upstream.destroy())
  client.on("close", () => upstream.destroy())
})
await new Promise((resolve) => origin.listen(0, "127.0.0.1", resolve))
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve))
const owner = new NetworkProxyTransportOwner()
let result
try {
  // Only bind the product-generated URL to this owned ephemeral port. Its
  // username and password representation passes unchanged into real Undici.
  const proxyUrl = new URL(input.proxyUrl)
  proxyUrl.port = String(proxy.address().port)
  const response = await fetch(
    `http://127.0.0.1:${origin.address().port}/credential-contract`,
    proxiedNodeFetchInit({ signal: AbortSignal.timeout(5_000) }, proxyUrl.href, "webResearch", owner),
  )
  result = {
    status: response.status,
    bodyMatches: (await response.text()) === expectedBody,
    authenticationMatches,
    targetMatches,
  }
} catch (error) {
  result = { status: "transport-error", errorType: error.name, authenticationMatches, targetMatches }
} finally {
  await owner.dispose()
  await new Promise((resolve, reject) => proxy.close((error) => (error ? reject(error) : resolve())))
  await new Promise((resolve, reject) => origin.close((error) => (error ? reject(error) : resolve())))
}
console.log(JSON.stringify({ ...result, disposed: true }))
