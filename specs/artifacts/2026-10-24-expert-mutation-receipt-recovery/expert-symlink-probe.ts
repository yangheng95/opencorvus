import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const { bootstrapIsolatedTestRuntime } = await import("../../../packages/util/src/test-runtime-environment")
const runtime = await bootstrapIsolatedTestRuntime("test")
const { ExpertSquadPackageManager: Manager } = await import("@/expert-squad/manager")
const { Global } = await import("@/global")
const { Database } = await import("@/storage/db")
const { memoryProject } = await import("../../../packages/opencorvus/test/fixture/memory")
const { Instance } = await import("@/project/instance")
const source = await Global.createTemporaryDirectory("expert-relative-link-source-")
await fs.cp(
  process.env.EXPERT_SYMLINK_PACKAGE_DIRECTORY ??
    path.join(import.meta.dir, "expert-v7-before-preserved-2", "after-delete-files", "backup"),
  source,
  { recursive: true, verbatimSymlinks: true },
)
const target = path.join(source, "relative-readme.md")
const project = await memoryProject()
let error: any, link: string | undefined
try {
  await fs.symlink("README.md", target, "file")
  link = await fs.readlink(target)
  assert.equal(link, "README.md")
  assert.equal(await fs.readFile(target, "utf8"), await fs.readFile(path.join(source, "README.md"), "utf8"))
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      try {
        await Manager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory: source,
          installationScope: "global",
        })
      } catch (cause: any) {
        error = { name: cause.name, message: cause.message, data: cause.data }
      }
    },
  })
  assert(
    error && error.message.includes("symbolic links are not allowed"),
    "formal Manager/Registry returns its explicit unsupported-package contract",
  )
} catch (cause: any) {
  if (cause.code !== "EPERM") throw cause
  error = { name: cause.name, code: cause.code, message: cause.message }
}
const result = {
  runtime,
  source,
  link,
  formalEntry: "Manager.importDirectory -> Registry.loadSourcePackage",
  error,
  supportedPackage: false,
}
await fs.writeFile(path.join(import.meta.dir, "expert-symlink-result.json"), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
await Instance.disposeAll()
Database.close()
process.exit(0)
