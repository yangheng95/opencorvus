import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { BrowserMCPNodeLauncher } from "../../src/mcp/browser/node-launcher"

const [cacheRoot, barrierRoot, workerID] = process.argv.slice(2)
if (!cacheRoot || !barrierRoot || !workerID) {
  throw new Error("Browser MCP bundle worker requires cache root, barrier root, and worker ID")
}

await fs.writeFile(path.join(barrierRoot, `ready-${workerID}`), workerID, { flag: "wx" })
const release = path.join(barrierRoot, "release")
while (true) {
  try {
    await fs.access(release)
    break
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    await Bun.sleep(10)
  }
}

const runtime = await BrowserMCPNodeLauncher.resolveRuntime({
  transport: "stdio",
  sourceCacheDirectory: cacheRoot,
})
const bytes = await fs.readFile(runtime.bundle)
console.log(
  JSON.stringify({
    bundle: runtime.bundle,
    digest: createHash("sha256").update(bytes).digest("hex"),
  }),
)
