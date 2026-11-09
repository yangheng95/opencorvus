import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { isCompiledBinaryRuntime } from "opencorvus-smoke:compiled-binary.ts"
import { resolveProjectIndexRuntime } from "opencorvus-smoke:project-index.ts"
assert.equal(isCompiledBinaryRuntime(), true)
const executable = await resolveProjectIndexRuntime()
const run = spawnSync(executable, [], { cwd: process.cwd(), windowsHide: true })
assert.equal(run.status, 0, run.stderr.toString())
const records = new TextDecoder("utf-8", { fatal: true }).decode(run.stdout).split("\0")
assert.equal(records.pop(), "")
const directories = records.filter(record => record.startsWith("dopal-")).map(record => record.slice(1)).sort()
const files = records.filter(record => record.startsWith("fopal-")).map(record => record.slice(1)).sort()
console.log(JSON.stringify({ executable, directories, files }))