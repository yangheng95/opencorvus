import { createRequire } from "node:module"
import { createServer, request } from "node:http"
import { gzipSync } from "node:zlib"

const parent = createRequire(process.argv[2])
const express = parent("express")
const parser = createRequire(parent.resolve("express"))("body-parser")
const app = express()
app.use(parser.raw({ type: "application/octet-stream" }))
app.post("/echo", (req, res) => res.end(req.body.toString()))
app.get("/health", (_req, res) => res.end("healthy"))
app.use((error, _req, res, _next) => res.status(error.status ?? 500).end(error.code ?? error.type ?? "parser_error"))
const server = createServer(app)
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const port = server.address().port

function send(path, body) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: body ? "POST" : "GET",
        headers: body
          ? {
              "content-type": "application/octet-stream",
              "content-encoding": "gzip",
              "content-length": body.length,
            }
          : {},
      },
      (response) => {
        const chunks = []
        response.on("data", (chunk) => chunks.push(chunk))
        response.on("end", () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString() }))
        response.on("error", reject)
      },
    )
    req.on("error", reject)
    req.end(body)
  })
}

try {
  const valid = await send("/echo", gzipSync(Buffer.from("local-compressed-body")))
  const trailing = await send(
    "/echo",
    Buffer.concat([gzipSync(Buffer.from("local-body")), Buffer.from("invalid-trailer")]),
  )
  const health = await send("/health")
  console.log(JSON.stringify({ valid, trailing, health }))
} finally {
  server.closeAllConnections()
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}
