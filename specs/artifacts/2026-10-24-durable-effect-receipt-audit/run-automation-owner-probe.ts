import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const root = path.resolve(import.meta.dir, "../../..")
const probe = path.join(import.meta.dir, "automation-owner-probe.ts")
async function run(action: string, evidence: string) {
  const child = Bun.spawn([process.execPath, probe, action, evidence], {
    cwd: root,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  await fs.writeFile(`${evidence}-${action}.json`, JSON.stringify({ action, exit, stdout, stderr }, null, 2))
  console.log(JSON.stringify({ action, evidence: path.basename(evidence), exit }))
  return { exit, stdout, stderr }
}
const prefix = process.argv[2] ?? `deleted-${Date.now()}`
const scopes = process.argv.slice(3)
const results = await Promise.allSettled(
  (scopes.length ? scopes : ["project", "session", "global"]).map(async (scope) => {
    const evidence = path.join(
      root,
      ".tmp-product-iteration/durable-effect-receipt-audit/automation",
      `${prefix}-${scope}`,
    )
    const alive = prefix.startsWith("alive")
    assert.equal((await run(`prepare-${scope}${alive ? "-alive" : ""}`, evidence)).exit, 23)
    if (!alive) assert.equal((await run("delete-recreate", evidence)).exit, 0)
    assert.equal((await run(alive ? "resume-alive" : "resume", evidence)).exit, 0)
    return { scope, disposition: alive ? "succeeded" : "target_deleted", sourceRetained: true }
  }),
)
await fs.writeFile(
  path.join(root, ".tmp-product-iteration/durable-effect-receipt-audit/automation", `${prefix}-owner-acceptance.json`),
  JSON.stringify(results, null, 2),
)
assert(
  results.every((result) => result.status === "fulfilled"),
  JSON.stringify(results),
)
