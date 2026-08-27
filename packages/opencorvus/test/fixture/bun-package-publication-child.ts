import fs from "node:fs/promises"
import path from "node:path"
import { BunProc } from "../../src/bun"
import { PackageInstallReceipt } from "../../src/bun/install-receipt"
import { PackageRegistry } from "../../src/bun/registry"

const mode = process.argv[2]
const pkg = "arc021-killed-owner-probe"
const version = "3.0.0"

Object.assign(PackageRegistry, { info: async () => version })
Object.assign(BunProc, {
  run: async (_cmd: string[], options?: { cwd?: string }) => {
    if (!options?.cwd) throw new Error("fixture installer requires cwd")
    const moduleDirectory = path.join(options.cwd, "node_modules", pkg)
    await fs.mkdir(moduleDirectory, { recursive: true })
    await fs.writeFile(
      path.join(moduleDirectory, "package.json"),
      JSON.stringify({ name: pkg, version, dependencies: {} }),
    )
    const marker = mode === "cut" ? "killed" : mode === "compromise" ? "compromised-owner" : "recovered"
    await fs.writeFile(path.join(moduleDirectory, "marker.txt"), marker)
    if (mode === "mid-install") {
      process.stdout.write("STAGED\n")
      await new Promise(() => {})
    }
    return {}
  },
})

if (mode === "cut") {
  Object.assign(PackageInstallReceipt, {
    verifyAndPublish: async () => {
      process.stdout.write("RENAMED\n")
      await new Promise(() => {})
    },
  })
}

if (mode === "compromise") {
  const gate = process.env.ARC021_RELEASE_GATE
  if (!gate) throw new Error("compromise fixture requires ARC021_RELEASE_GATE")
  const verifyAndPublish = PackageInstallReceipt.verifyAndPublish
  Object.assign(PackageInstallReceipt, {
    verifyAndPublish: async (input: Parameters<typeof verifyAndPublish>[0]) => {
      process.stdout.write("RENAMED\n")
      while (
        !(await fs.stat(gate).then(
          () => true,
          () => false,
        ))
      )
        await Bun.sleep(25)
      return verifyAndPublish(input)
    },
  })
}

const installed = await BunProc.install(pkg)
process.stdout.write(
  `RESULT ${JSON.stringify({ installed, marker: await fs.readFile(path.join(installed, "marker.txt"), "utf8") })}\n`,
)
