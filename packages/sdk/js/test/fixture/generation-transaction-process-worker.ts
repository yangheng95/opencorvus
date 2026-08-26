import fs from "node:fs/promises"
import path from "node:path"
import { replaceGeneratedArtifactsAfterSuccessfulBuild } from "../../script/generation-transaction"

const [packageRoot, barrier, label] = process.argv.slice(2)
if (!packageRoot || !barrier || (label !== "first" && label !== "second")) {
  throw new Error("usage: generation-transaction-process-worker <package-root> <barrier> <first|second>")
}

async function exists(target: string) {
  return fs.stat(target).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false
      throw error
    },
  )
}

async function waitFor(target: string) {
  const deadline = Date.now() + 30_000
  while (!(await exists(target))) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${target}`)
    await Bun.sleep(10)
  }
}

let previousGenerationAtEntry: { first?: string; second?: string } | undefined
await fs.writeFile(path.join(barrier, `${label}-attempted`), label)
await replaceGeneratedArtifactsAfterSuccessfulBuild({
  packageRoot,
  stagingRelative: `.staging-${label}`,
  artifacts: [
    { stagingRelative: "first.txt", targetRelative: "first.txt", kind: "file" },
    { stagingRelative: "second.txt", targetRelative: "second.txt", kind: "file" },
  ],
  build: async (stagingRoot) => {
    await fs.writeFile(path.join(barrier, `${label}-entered`), label)
    if (label === "first") {
      await waitFor(path.join(barrier, "second-attempted"))
      // Give a wrongly keyed second publisher a deterministic admission window
      // while this publisher still owns the canonical publication cut.
      await Bun.sleep(1_000)
    } else {
      previousGenerationAtEntry = {
        first: await fs.readFile(path.join(packageRoot, "first.txt"), "utf8").catch(() => undefined),
        second: await fs.readFile(path.join(packageRoot, "second.txt"), "utf8").catch(() => undefined),
      }
    }
    await fs.mkdir(stagingRoot, { recursive: true })
    await fs.writeFile(path.join(stagingRoot, "first.txt"), `${label}-first`)
    await fs.writeFile(path.join(stagingRoot, "second.txt"), `${label}-second`)
  },
})
console.log(JSON.stringify({ label, previousGenerationAtEntry }))
