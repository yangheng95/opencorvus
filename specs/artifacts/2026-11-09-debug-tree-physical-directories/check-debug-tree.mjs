import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
const [root, phase] = process.argv.slice(2)
const directory = path.join(root, "project-" + phase)
const home = path.join(root, "profile-cli-" + phase)
const env = {
  ...process.env,
  OPENCORVUS_HOME: home,
  OPENCORVUS_TEST_HOME: home,
  OPENCORVUS_TEST_PROCESS_ROOT: root,
  OPENCORVUS_DISABLE_AUTOUPDATE: "1",
  OPENCORVUS_DISABLE_PROJECT_CONFIG: "1",
  OPENCORVUS_DISABLE_CLAUDE_CODE: "1",
  GIT_CONFIG_GLOBAL: path.join(root, "fixture.gitconfig"),
  GIT_CONFIG_NOSYSTEM: "1",
}
delete env.OPENAI_ADMIN_KEY
delete env.ANTHROPIC_ADMIN_KEY
delete env.OPENROUTER_MANAGEMENT_KEY
const cli = "D:/myhexin-local/opencorvus/packages/opencorvus/src/index.ts"
function invoke(args, expectedStatus = 0) {
  const run = spawnSync("bun", ["run", "--no-env-file", cli, "--log-level", "ERROR", "debug", ...args], {
    cwd: directory, env, windowsHide: true, encoding: "utf8", timeout: 30000,
  })
  assert.equal(run.error, undefined)
  assert.equal(run.status, expectedStatus, run.stderr)
  return { args, status: run.status, stdout: run.stdout.trimEnd(), ...(expectedStatus === 0 ? {} : { stderr: run.stderr.trim() }) }
}
const rg = invoke(["rg","tree"])
const file = invoke(["file","tree",directory])
const limited = invoke(["rg","tree","--limit","3"])
const missingDirectory = path.join(root, "missing-owned-directory")
const missing = invoke(["file","tree",missingDirectory], 1)
assert.ok(missing.stderr.includes("No such file or directory: '" + missingDirectory + "'"))
const primary = rg.stdout.split(/\r?\n/)
const structured = JSON.parse(file.stdout).split(/\r?\n/)
assert.deepEqual(structured, primary)
assert.ok(primary.includes("filled/nested"))
if (phase === "after") {
  const expected = [".opencorvus-handbook","branch","empty","filled","branch/empty-child","filled/nested"]
  assert.deepEqual(primary, expected)
  assert.deepEqual(limited.stdout.split(/\r?\n/), [...expected.slice(0, 3), "[3 truncated]"])
}
const evidence = { phase, directory, primary, structured, limited: limited.stdout.split(/\r?\n/), commands: [rg,file,limited,missing] }
await fs.writeFile(path.join(root, phase + "-tree-cli.json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify(evidence))