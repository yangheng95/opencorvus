import { readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"

const [executable, bundle, mode, outcome, ledger, resultFile, cwd] = process.argv.slice(2)
if (!executable || !bundle || !mode || !outcome || !ledger || !resultFile || !cwd) {
  throw new Error("usage: browser-signal-console-driver.ts <node> <bundle> <mode> <outcome> <ledger> <result> <cwd>")
}

const nodePty = createRequire(path.join(cwd, "package.json"))("@lydell/node-pty") as typeof import("@lydell/node-pty")
const child = nodePty.spawn(executable, [bundle, mode, outcome, ledger], {
  cols: 120,
  rows: 40,
  cwd,
  env: process.env as Record<string, string>,
})
let output = ""
child.onData((data) => {
  output += data
})
const exited = new Promise<{ exitCode: number; signal?: number }>((resolve) => child.onExit(resolve))

async function waitForReady(): Promise<void> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const ready = (await readFile(ledger, "utf8").catch(() => ""))
      .split("\n")
      .filter(Boolean)
      .some((line) => (JSON.parse(line) as { phase?: unknown }).phase === "ready")
    if (ready) return
    await delay(25)
  }
  throw new Error("Browser MCP child did not publish its active-session ready receipt")
}

async function waitForExit(): Promise<{ exitCode: number; signal?: number }> {
  return Promise.race([
    exited,
    delay(15_000).then(() => {
      throw new Error("Browser MCP child did not settle after its signal")
    }),
  ])
}

try {
  await waitForReady()
  child.write("\x03")
  const terminal = await waitForExit()
  await writeFile(resultFile, JSON.stringify({ ...terminal, output }), "utf8")
  process.exit(0)
} catch (error) {
  child.kill()
  await Promise.race([exited, delay(5_000)]).catch(() => undefined)
  await writeFile(
    resultFile,
    JSON.stringify({ error: error instanceof Error ? error.message : String(error), output }),
    "utf8",
  )
  process.exit(1)
}
