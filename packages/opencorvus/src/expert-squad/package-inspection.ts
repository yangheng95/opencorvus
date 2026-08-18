import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { InspectedExpertSquadPackageSchema } from "@opencorvus-ai/plugin"
import type { ExpertSquadRegistry } from "./registry"

export type ExpertSquadPackageFile = {
  path: string
  bytes: Uint8Array
  sha256: string
  utf8Text: boolean
}

/**
 * Every regular file under a package root, in canonical path order, with the
 * text/binary classification the candidate mutable closure depends on. A file
 * is text when it decodes as strict UTF-8 and carries no NUL byte.
 */
export async function readExpertSquadPackageFiles(root: string): Promise<ExpertSquadPackageFile[]> {
  const files: ExpertSquadPackageFile[] = []
  const decoder = new TextDecoder("utf-8", { fatal: true })
  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!entry.isFile()) throw new Error(`Expert Squad package contains a non-regular entry: ${absolute}`)
      const bytes = await readFile(absolute)
      let utf8Text = false
      try {
        decoder.decode(bytes)
        utf8Text = !bytes.includes(0)
      } catch {
        utf8Text = false
      }
      files.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        utf8Text,
      })
    }
  }
  await walk(root)
  return files
}

export function inspectExpertSquadPackage(input: {
  loaded: Pick<ExpertSquadRegistry.LoadedPackage, "packageDigest" | "namespace" | "id" | "manifest" | "packageSkills">
  files: readonly ExpertSquadPackageFile[]
}) {
  return InspectedExpertSquadPackageSchema.parse({
    package_digest: input.loaded.packageDigest,
    namespace: input.loaded.namespace,
    id: input.loaded.id,
    version: input.loaded.manifest.version,
    manifest: input.loaded.manifest,
    skill_closures: [...input.loaded.packageSkills.values()]
      .map((skill) => ({
        source: skill.snapshot.source,
        files: skill.snapshot.files.map((file) => file.path),
      }))
      .sort((left, right) => (left.source < right.source ? -1 : left.source > right.source ? 1 : 0)),
    files: input.files.map((file) => ({
      path: file.path,
      sha256: file.sha256,
      bytes: file.bytes.byteLength,
      utf8_text: file.utf8Text,
    })),
  })
}
