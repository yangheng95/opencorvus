// SDK means Software Development Kit; JSON means JavaScript Object Notation.

import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  EXPERT_SQUAD_MANIFEST_PATH,
  writeExpertSquadPackage,
  type ExpertSquadManifestV2,
  type ExpertSquadPackageDefinition,
} from "../src/expert-squad-authoring"

const repositoryRoot = path.resolve(import.meta.dir, "../../../..")
const packageRoot = path.join(
  repositoryRoot,
  "packages",
  "opencorvus",
  "src",
  "expert-squad",
  "builtin",
  "research-studio",
)

function parseManifest(source: string): ExpertSquadManifestV2 {
  return JSON.parse(source.replace(/,(\s*[}\]])/g, "$1")) as ExpertSquadManifestV2
}

async function packageFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const pending = [root]
  while (pending.length > 0) {
    const directory = pending.pop()!
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) pending.push(absolute)
      else if (entry.isFile()) files.push(path.relative(root, absolute).replaceAll("\\", "/"))
    }
  }
  return files.sort()
}

describe("Research Studio expert-squad authoring SDK", () => {
  test("round-trips the complete source package through the SDK writer", async () => {
    const sourceFiles = await packageFiles(packageRoot)
    const manifest = parseManifest(await readFile(path.join(packageRoot, EXPERT_SQUAD_MANIFEST_PATH), "utf8"))
    const files = Object.fromEntries(
      await Promise.all(
        sourceFiles
          .filter((relativePath) => relativePath !== EXPERT_SQUAD_MANIFEST_PATH)
          .map(async (relativePath) => [relativePath, await readFile(path.join(packageRoot, relativePath))] as const),
      ),
    ) satisfies ExpertSquadPackageDefinition["files"]
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "research-studio-sdk-authoring-"))
    const output = path.join(temporaryRoot, "research-studio")

    try {
      const result = await writeExpertSquadPackage({ directory: output, definition: { manifest, files } })
      expect(result.files.sort()).toEqual(sourceFiles)
      expect(await packageFiles(output)).toEqual(sourceFiles)
      expect(parseManifest(await readFile(path.join(output, EXPERT_SQUAD_MANIFEST_PATH), "utf8"))).toEqual(manifest)
      expect(manifest).toMatchObject({
        schema_version: 2,
        namespace: "builtin",
        id: "research-studio",
      })
      expect(Object.keys(manifest.capability_projection.agents).sort()).toEqual([
        "research-studio-analyst",
        "research-studio-fact-checker",
        "research-studio-planner",
        "research-studio-researcher",
        "research-studio-writer",
      ])
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })
})
