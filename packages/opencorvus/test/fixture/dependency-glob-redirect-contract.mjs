import { createRequire } from "node:module"
import { createServer } from "node:http"
import { once } from "node:events"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
const require = createRequire(import.meta.url)
const { default: archiver } = await import("archiver")
const channel = createRequire(new URL("../../../channel-runtime/package.json", import.meta.url))
const bolt = createRequire(channel.resolve("@slack/bolt"))
const { http } = createRequire(bolt.resolve("axios"))("follow-redirects")
const { rimraf } = createRequire(new URL("../../../util/package.json", import.meta.url))("rimraf")
const root = await fs.mkdtemp(path.join(os.tmpdir(), "release-dependency-consumers-"))
const server = createServer((request, response) => {
  if (request.url === "/start") { response.writeHead(307, { Location: "/final" }); response.end(); return }
  response.writeHead(201, { "X-Contract": request.headers["x-contract"] })
  response.write("first:")
  response.end("second")
})
try {
  await fs.mkdir(path.join(root, "nested"))
  await fs.writeFile(path.join(root, "nested", "note.txt"), "archive:中文\n")
  const archive = archiver("zip")
  const chunks = []
  archive.on("data", (chunk) => chunks.push(chunk))
  const finished = once(archive, "end")
  archive.glob("**/*.txt", { cwd: root })
  await archive.finalize()
  await finished
  const { BlobReader, TextWriter, ZipReader } = require("@zip.js/zip.js")
  const reader = new ZipReader(new BlobReader(new Blob([Buffer.concat(chunks)])))
  let entries, text
  try { entries = await reader.getEntries(); text = await entries[0].getData(new TextWriter()) } finally { await reader.close() }
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const redirect = await new Promise((resolve, reject) => {
    const request = http.get(`http://127.0.0.1:${server.address().port}/start`, { headers: { "X-Contract": "owned" } }, (response) => {
      const received = []
      response.on("data", (chunk) => received.push(chunk))
      response.on("end", () => resolve({ status: response.statusCode, header: response.headers["x-contract"], body: Buffer.concat(received).toString() }))
      response.on("error", reject)
    })
    request.on("error", reject)
    request.setTimeout(5000, () => request.destroy(new Error("Owned redirect timeout")))
  })
  const retired = await rimraf(path.join(root, "nested"))
  console.log(JSON.stringify({ archive: { files: entries.map((entry) => entry.filename), text }, redirect, retired }))
} finally {
  await new Promise((resolve) => server.close(resolve))
  await fs.rm(root, { recursive: true, force: true })
}
