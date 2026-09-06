import { readFile } from "node:fs/promises"
import { Global } from "../../src/global"
import { McpOAuthCallback } from "../../src/mcp/oauth-callback"
import { publishJSONBarrier } from "./json-barrier"

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
await publishJSONBarrier(output, binding)

let stalled = false
setInterval(async () => {
  if (stalled) return
  try {
    await readFile(stallTrigger, "utf8")
  } catch {
    return
  }
  stalled = true
  await publishJSONBarrier(stallStarted, { started: true })
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, stallDurationMs)
  await publishJSONBarrier(stallRecovered, { recovered: true })
}, 25)

setInterval(() => {}, 1_000)
