import fs from "node:fs/promises"
import assert from "node:assert/strict"
import { isDeepStrictEqual } from "node:util"
import { parse } from "../../packages/overlay/node_modules/jsonc-parser"
import { configure } from "../../packages/overlay/src/services/api"
import { patchGlobalConfig } from "../../packages/overlay/src/services/config"
import { loadConfigInfo } from "../../packages/overlay/src/services/config-load"
import { getHostTransport } from "../../packages/overlay/src/services/host-transport-runtime"
import { appStore, setAppStore } from "../../packages/overlay/src/store/app"
import { setSettingsStore } from "../../packages/overlay/src/store/settings"
import { setBoardStore } from "../../packages/overlay/src/store/board"

const root = import.meta.dir
const phase = process.argv[2]
assert(phase === "candidate")
const port = 18727
const evidence = `C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-20/config-read-write-ownership-457-verified/evidence`
const ready = JSON.parse(await fs.readFile(evidence + "/native-host-ready.json", "utf8"))
assert(ready.occurrence.startsWith(`config-read-write-ownership-457-verified-`))
const canonical = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/runtime/config/opencorvus.jsonc"
const original = parse(await fs.readFile(canonical, "utf8"))
await fs.writeFile(evidence + "/qa-canonical-before-check.json", JSON.stringify(original, null, 2), { flag: "wx" })
assert.equal(original.permission_mode, "ask")
configure({ serverUrl: `http://127.0.0.1:${port}`, directory: "" })
setSettingsStore("directory", "")
setBoardStore({ board: null, selectedSource: null })
setAppStore("connected", true)
assert.equal(getHostTransport().kind, "browser")
await fs.writeFile(root + "/candidate-verified-checker-ready.json", JSON.stringify({occurrence:ready.occurrence}), {flag:"wx"})
while (true) {
  const gate = await fs.readFile(root + "/candidate-verified-write-start.json", "utf8").then(text => JSON.parse(text)).catch(error => { if (error.code === "ENOENT") return undefined; throw error })
  if (gate) { assert.equal(gate.occurrence,ready.occurrence); break }
  await Bun.sleep(20)
}
const at = new Date().toISOString(), start = performance.now()
let accepted = false, restored = false, writeMs = 0, restoreMs = 0
const failures: { phase: string; name: string }[] = []
try {
  const saved = await patchGlobalConfig({ username: "qa-read-owner-457" })
  writeMs = performance.now() - start
  assert.equal(saved.username, "qa-read-owner-457")
  assert.equal(saved.permission_mode, "ask")
  assert.deepEqual(await loadConfigInfo(), [])
  assert.equal(appStore.config?.username, "qa-read-owner-457")
  accepted = true
} catch (error) {
  failures.push({ phase: "write", name: error instanceof Error ? error.name : "UnknownError" })
} finally {
  const restoreStart = performance.now()
  try {
  const saved = await patchGlobalConfig({ username: Object.hasOwn(original, "username") ? original.username : null })
  restoreMs = performance.now() - restoreStart
  assert.equal(saved.permission_mode, "ask")
  assert(isDeepStrictEqual(parse(await fs.readFile(canonical, "utf8")), original), "Complete canonical restoration")
  restored = true
  } catch (error) {
    failures.push({ phase: "restore", name: error instanceof Error ? error.name : "UnknownError" })
  }
  const result = { at, endedAt: new Date().toISOString(), phase, port, occurrence: ready.occurrence,
    transport: getHostTransport().kind, boundary: "Production config service -> production browser HostTransport -> original HTTP server -> canonical file; no mocked request, provider body, or UI automation",
    accepted, restored, writeMs, restoreMs, failures, permissionMode: "ask", changedField: "username", dataRestoration: restored ? "Complete parsed canonical source equals the pre-check source" : "Restoration requires investigation" }
  await fs.writeFile(`${root}/canonical-write-verified.json`, JSON.stringify(result, null, 2), { flag: "wx" })
  console.log(JSON.stringify(result))
  if (!accepted || !restored) process.exitCode = 1
}
