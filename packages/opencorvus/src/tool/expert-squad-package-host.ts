import { createHash } from "node:crypto"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  ExpertSquadPackageRevisionSchema,
  MaterializedExpertSquadPackageSchema,
  TaskArtifactResourceSetLocatorSchema,
  ValidatedExpertSquadPackageSchema,
  type ExpertSquadPackageHost,
  type TaskArtifactHost,
} from "@opencorvus-ai/plugin"
import { ExpertSquadRegistry } from "@/expert-squad/registry"

type PackageFile = {
  path: string
  bytes: Uint8Array
  sha256: string
  utf8Text: boolean
}

async function packageFiles(root: string): Promise<PackageFile[]> {
  const files: PackageFile[] = []
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
        utf8Text = !decoder.decode(bytes).includes("\u0000")
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

export function createExpertSquadPackageHost(taskArtifacts: TaskArtifactHost): ExpertSquadPackageHost {
  async function validateResourceSet(input: { resource_set: unknown }) {
    const resourceSet = TaskArtifactResourceSetLocatorSchema.parse(input.resource_set)
    const materialized = await taskArtifacts.materialize({ snapshot: resourceSet.snapshot, tree: resourceSet.tree })
    const loaded = await ExpertSquadRegistry.loadSourcePackage(materialized.directory)
    const files = await packageFiles(materialized.directory)
    return ValidatedExpertSquadPackageSchema.parse({
      resource_set: resourceSet,
      package_digest: loaded.packageDigest,
      namespace: loaded.namespace,
      id: loaded.id,
      version: loaded.manifest.version,
      manifest: loaded.manifest,
      skill_closures: [...loaded.packageSkills.values()]
        .map((skill) => ({
          source: skill.snapshot.source,
          files: skill.snapshot.files.map((file) => file.path),
        }))
        .sort((left, right) => (left.source < right.source ? -1 : left.source > right.source ? 1 : 0)),
      files: files.map((file) => ({
        path: file.path,
        sha256: file.sha256,
        bytes: file.bytes.byteLength,
        utf8_text: file.utf8Text,
      })),
    })
  }

  return Object.freeze({
    async materializeRevision(input) {
      const revision = ExpertSquadPackageRevisionSchema.parse(input.revision)
      const loaded = await ExpertSquadRegistry.loadPackageRevisionSnapshot(revision.package_digest)
      const files = await packageFiles(loaded.root)
      const stage = await taskArtifacts.stage({ trees: ["package"] })
      const treeDirectory = stage.treeDirectories.package!
      for (const file of files) {
        const destination = path.join(treeDirectory, ...file.path.split("/"))
        await mkdir(path.dirname(destination), { recursive: true })
        await writeFile(destination, file.bytes, { flag: "wx" })
      }
      const publication = await taskArtifacts.publish(stage, {
        snapshot_kind: "catalog",
        files: files.map((file) => ({
          tree: "package",
          path: file.path,
          media_type: file.utf8Text ? "text/plain" : "application/octet-stream",
        })),
      })
      const resourceSet = TaskArtifactResourceSetLocatorSchema.parse({
        snapshot: publication.snapshot,
        tree: "package",
      })
      const validated = await validateResourceSet({ resource_set: resourceSet })
      if (validated.package_digest !== revision.package_digest) {
        throw new Error(`Materialized Expert Squad package digest mismatch: ${validated.package_digest}`)
      }
      return MaterializedExpertSquadPackageSchema.parse({
        resource_set: resourceSet,
        package_digest: validated.package_digest,
        namespace: validated.namespace,
        id: validated.id,
        version: validated.version,
      })
    },
    validateResourceSet,
  })
}
