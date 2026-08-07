// SDK means Software Development Kit; JSON means JavaScript Object Notation.

import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  EXPERT_SQUAD_MANIFEST_PATH,
  writeExpertSquadPackage,
  type ExpertSquadManifestV1,
  type ExpertSquadPackageDefinition,
} from "../src/expert-squad-authoring"

const repositoryRoot = path.resolve(import.meta.dir, "../../../..")

function parseJsonc<T>(source: string): T {
  return JSON.parse(source.replace(/,(\s*[}\]])/g, "$1")) as T
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

describe("Review & Debug to independent audit collaboration", () => {
  test("round-trips the complete Review & Debug package through the SDK writer", async () => {
    const sourceRoot = path.join(repositoryRoot, "expert-squads", "builtin", "review-debug")
    const sourceFiles = await packageFiles(sourceRoot)
    const sourceManifest = parseJsonc<ExpertSquadManifestV1>(
      await readFile(path.join(sourceRoot, EXPERT_SQUAD_MANIFEST_PATH), "utf8"),
    )
    const files = Object.fromEntries(
      await Promise.all(
        sourceFiles
          .filter((relativePath) => relativePath !== EXPERT_SQUAD_MANIFEST_PATH)
          .map(async (relativePath) => [relativePath, await readFile(path.join(sourceRoot, relativePath))] as const),
      ),
    ) satisfies ExpertSquadPackageDefinition["files"]
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "review-debug-sdk-authoring-"))
    const output = path.join(temporaryRoot, "review-debug")

    try {
      const result = await writeExpertSquadPackage({
        directory: output,
        definition: { manifest: sourceManifest, files },
      })
      expect(result.files.sort()).toEqual(sourceFiles)
      expect(await packageFiles(output)).toEqual(sourceFiles)
      expect(
        parseJsonc<ExpertSquadManifestV1>(await readFile(path.join(output, EXPERT_SQUAD_MANIFEST_PATH), "utf8")),
      ).toEqual(sourceManifest)
      for (const relativePath of sourceFiles.filter((entry) => entry !== EXPERT_SQUAD_MANIFEST_PATH)) {
        expect(
          Buffer.compare(
            await readFile(path.join(output, relativePath)),
            await readFile(path.join(sourceRoot, relativePath)),
          ),
          relativePath,
        ).toBe(0)
      }
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  })

})
