import { readFile, writeFile } from "node:fs/promises"
import { Global } from "../../src/global"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"

const root = process.argv[2]
const output = process.argv[3]
const stallTrigger = process.argv[4]
const stallStarted = process.argv[5]
const stallRecovered = process.argv[6]
const stallDurationMs = Number(process.argv[7])
if (!root || !output || !stallTrigger || !stallStarted || !stallRecovered || !Number.isFinite(stallDurationMs)) {
  throw new Error("Expected callback broker root, output, stall paths and duration")
}

const binding = await Global.provideRoot(root, () => McpOAuthCallback.ensureRunning())
await writeFile(output, JSON.stringify(binding), "utf8")

let stalled = false
setInterval(async () => {
  if (stalled) return
  try {
    await readFile(stallTrigger, "utf8")
  } catch {
    return
  }
  stalled = true
  await writeFile(stallStarted, JSON.stringify({ started: true }), "utf8")
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, stallDurationMs)
  await writeFile(stallRecovered, JSON.stringify({ recovered: true }), "utf8")
}, 25)

setInterval(() => {}, 1_000)
