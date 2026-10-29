import { expect, test } from "bun:test"
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { PackageToolBundle } from "../../src/expert-squad/package-tool-bundle"

test("prepared plugin closure executes the shared canonical Unicode project-path contract", async () => {
  const temporaryRoot = path.resolve(tmpdir())
  const packageRoot = await mkdtemp(path.join(temporaryRoot, "package-tool-source-"))
  const sourcePath = path.join(packageRoot, "tools", "inspect-path.ts")
  try {
    await mkdir(path.dirname(sourcePath), { recursive: true })
    await writeFile(sourcePath, `
import { isCanonicalProjectRelativePath, ProjectRelativePathSchema } from "@opencorvus-ai/plugin"
export function inspect(value: string) {
  return { canonical: isCanonicalProjectRelativePath(value), parsed: ProjectRelativePathSchema.parse(value) }
}
`)
    const prepared = await PackageToolBundle.prepare({
      packageID: "source-contract", packageRoot, owner: "shared",
      ref: "source-contract/shared/inspect-path", sourcePath,
    })
    const actual = await import(pathToFileURL(prepared.bundlePath).href)
    for (const value of ["notes/plan.txt", "报告/交接说明.md"]) {
      expect(actual.inspect(value)).toEqual({ canonical: true, parsed: value })
    }
    expect({ ref: prepared.snapshot.ref, entry: prepared.snapshot.entry }).toEqual({
      ref: "source-contract/shared/inspect-path", entry: "tools/inspect-path.ts",
    })
  } finally {
    if (path.dirname(path.resolve(packageRoot)) !== temporaryRoot) throw new Error("Unexpected temporary package owner")
    await rm(packageRoot, { recursive: true, force: true })
  }
})
