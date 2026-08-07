import { describe, expect, test } from "bun:test"
import * as nativeFiles from "node:fs/promises"
import path from "node:path"
import { Global } from "../src/global"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import {
  PACKAGE_TOOL_FILES_FACADE_IMPORT,
  PackageToolBundle,
} from "../src/expert-squad/package-tool-bundle"

describe("Package tool filesystem capability", () => {
  test("freezes bundled filesystem imports into the ToolHost RPC closure", async () => {
    const packageRoot = await Global.createTemporaryDirectory("package-tool-files-")
    try {
      const toolsRoot = path.join(packageRoot, "tools")
      const sourcePath = path.join(toolsRoot, "files-probe.ts")
      await nativeFiles.mkdir(toolsRoot, { recursive: true })
      await nativeFiles.writeFile(
        sourcePath,
        `import fileSystem from "node:fs"
import { writeFile } from "node:fs/promises"
import { tool } from "@opencorvus-ai/plugin"

export default tool({
  description: "Exercise the invocation filesystem capability.",
  args: { value: tool.schema.string() },
  async execute(args) {
    await writeFile("capsule.txt", args.value)
    return await fileSystem.promises.readFile("capsule.txt", "utf8")
  },
})
`,
      )

      const prepared = await PackageToolBundle.prepare({
        packageID: "files-probe",
        packageRoot,
        ref: "files-probe/shared/files-probe",
        owner: "shared",
        sourcePath,
      })
      expect(prepared.snapshot.coreImports).toEqual([
        { specifier: "@opencorvus-ai/plugin", sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
        { specifier: PACKAGE_TOOL_FILES_FACADE_IMPORT, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
      ])
      expect(prepared.snapshot.files).toEqual([
        {
          path: "tools/files-probe.ts",
          extension: ".ts",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ])
      expect(prepared.snapshot.compiledBundleSHA256).toMatch(/^[a-f0-9]{64}$/)
    } finally {
      await nativeFiles.rm(packageRoot, { recursive: true, force: true })
    }
  }, 0)

  test("compiles every repository package-tool closure through the current plugin runtime", async () => {
    const expectedBundles = [
      ["expert-squads/builtin/evolution-lab", 5],
      ["expert-squads/builtin/frontend-innovate", 1],
      ["expert-squads/builtin/frontend-replica", 2],
    ] as const
    const loadedBundles: Array<[string, number]> = []
    for (const [relativeRoot] of expectedBundles) {
      const loaded = await ExpertSquadRegistry.loadSourcePackage(path.resolve(import.meta.dir, `../../..`, relativeRoot))
      loadedBundles.push([relativeRoot, loaded.packageToolBundles.size])
    }
    expect(loadedBundles).toEqual(expectedBundles)
  }, 0)
})
