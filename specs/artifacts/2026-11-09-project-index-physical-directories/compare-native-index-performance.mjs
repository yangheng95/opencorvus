import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { performance } from "node:perf_hooks"
const [root, binary] = process.argv.slice(2)
const cwd = path.join(root, "performance-project")
mkdirSync(cwd, { recursive: true })
const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(root, "fixture.gitconfig"), GIT_CONFIG_NOSYSTEM: "1" }
assert.equal(spawnSync("git", ["init", "-q"], { cwd, env, windowsHide: true }).status, 0)
writeFileSync(path.join(cwd, ".gitignore"), "ignored/\n")
mkdirSync(path.join(cwd, "ignored"), { recursive: true })
writeFileSync(path.join(cwd, "ignored", "excluded.txt"), "ignored")
for (let index = 0; index < 256; index++) {
  const group = path.join(cwd, "group-" + String(index).padStart(3, "0"))
  mkdirSync(path.join(group, "empty"), { recursive: true })
  for (let child = 0; child < 8; child++) writeFileSync(path.join(group, "file-" + child + ".txt"), "owned test\n")
}
function run(exe, args) {
  const start = performance.now()
  const result = spawnSync(exe, args, { cwd, env, windowsHide: true })
  const elapsedMS = Math.round((performance.now() - start) * 10) / 10
  assert.equal(result.status, 0, result.stderr?.toString())
  return { elapsedMS, records: new TextDecoder("utf-8", { fatal: true }).decode(result.stdout).split("\0").filter(Boolean) }
}
const samples = []
for (let round = 0; round < 5; round++) {
  const prior = run("rg", ["--files","--null","--glob=!.git/*","--hidden"])
  const next = run(binary, [])
  const files = next.records.filter(row => row[0] === "f").map(row => row.slice(1)).sort()
  const directories = next.records.filter(row => row[0] === "d").map(row => row.slice(1))
  assert.deepEqual(files, prior.records.sort())
  assert.deepEqual([files.length, directories.length, directories.filter(dir => path.basename(dir) === "empty").length], [2049, 512, 256])
  samples.push({ ripgrepMS: prior.elapsedMS, indexMS: next.elapsedMS })
}
const result = { platform: process.platform, files: 2049, directories: 512, emptyDirectories: 256, samples,
  medianMS: { ripgrep: samples.map(x => x.ripgrepMS).sort((a,b) => a-b)[2], index: samples.map(x => x.indexMS).sort((a,b) => a-b)[2] } }
writeFileSync(path.join(root, "native-index-performance.json"), JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify(result))