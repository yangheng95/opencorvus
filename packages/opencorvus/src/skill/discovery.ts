import path from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import z from "zod"
import { Log } from "../util/log"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"

export namespace Discovery {
  const log = Log.create({ service: "skill-discovery" })
  const SNAPSHOT_MANIFEST = ".opencorvus-remote-skill-snapshot.json"
  const SHA256 = z.string().regex(/^[a-f0-9]{64}$/)

  const Index = z
    .object({
      skills: z.array(
        z
          .object({
            name: z.string().min(1),
            description: z.string(),
            files: z.array(z.string().min(1)).min(1),
          })
          .strip(),
      ),
    })
    .strip()

  const SnapshotFile = z
    .object({
      path: z.string().min(1),
      bytes: z.number().int().nonnegative(),
      sha256: SHA256,
    })
    .strict()

  const SnapshotManifest = z
    .object({
      schema_version: z.literal(1),
      source: z.string().url(),
      skill: z.string().min(1),
      files: z.array(SnapshotFile).min(1),
      snapshot_digest: SHA256,
    })
    .strict()

  export type PublishedSnapshot = z.infer<typeof SnapshotManifest>

  export function dir() {
    return path.join(Global.Path.cache, "skills")
  }

  function sha256(bytes: Uint8Array | string) {
    return createHash("sha256").update(bytes).digest("hex")
  }

  function normalizeSource(value: string) {
    return new URL(value).toString().replace(/\/+$/, "") + "/"
  }

  function sourceKey(source: string) {
    return sha256(normalizeSource(source))
  }

  function skillKey(name: string) {
    return sha256(name)
  }

  function snapshotDigest(input: Omit<PublishedSnapshot, "snapshot_digest">) {
    return sha256(JSON.stringify(input))
  }

  function resolveDiscoveryChild(parent: string, value: string, label: string, options?: { singleSegment?: boolean }) {
    const trimmed = value.trim()
    const segments = trimmed.split("/")
    if (
      !trimmed ||
      trimmed !== value ||
      value.includes("\\") ||
      value.includes(":") ||
      value.includes("?") ||
      value.includes("#") ||
      (options?.singleSegment && segments.length !== 1) ||
      segments.some((segment) => !segment || segment === "." || segment === "..") ||
      path.isAbsolute(value) ||
      path.posix.isAbsolute(value) ||
      path.win32.isAbsolute(value)
    ) {
      throw new Error(`Unsafe skill discovery path ${label}: ${value}`)
    }

    const root = path.resolve(parent)
    const resolved = path.resolve(root, ...segments)
    if (resolved === root || !Filesystem.contains(root, resolved)) {
      throw new Error(`Unsafe skill discovery path ${label}: ${value}`)
    }
    return {
      localPath: resolved,
      relativePath: segments.join("/"),
      remotePath: segments.map(encodeURIComponent).join("/"),
    }
  }

  async function download(url: string): Promise<Uint8Array> {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return new Uint8Array(await response.arrayBuffer())
  }

  async function snapshotFiles(root: string) {
    const files: string[] = []
    const visit = async (directory: string, prefix: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory()) {
          await visit(path.join(directory, entry.name), relative)
          continue
        }
        if (!entry.isFile()) throw new Error(`Remote Skill snapshot contains a non-file entry: ${relative}`)
        if (relative !== SNAPSHOT_MANIFEST) files.push(relative.replaceAll("\\", "/"))
      }
    }
    await visit(root, "")
    return files.sort()
  }

  export async function requirePublishedSnapshot(
    root: string,
    expected?: { source?: string; skill?: string },
  ): Promise<PublishedSnapshot> {
    const resolvedRoot = path.resolve(root)
    if (!Filesystem.contains(path.resolve(dir()), resolvedRoot)) {
      throw new Error(`Remote Skill snapshot is outside the published cache: ${resolvedRoot}`)
    }
    const manifest = SnapshotManifest.parse(await Filesystem.readJson(path.join(resolvedRoot, SNAPSHOT_MANIFEST)))
    const source = normalizeSource(manifest.source)
    if (source !== manifest.source) throw new Error(`Remote Skill snapshot source is not normalized: ${manifest.source}`)
    if (expected?.source && source !== normalizeSource(expected.source)) {
      throw new Error(`Remote Skill snapshot source identity changed: ${source}`)
    }
    if (expected?.skill && manifest.skill !== expected.skill) {
      throw new Error(`Remote Skill snapshot identity changed: ${manifest.skill}`)
    }
    const sorted = [...manifest.files].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    )
    if (JSON.stringify(sorted) !== JSON.stringify(manifest.files)) {
      throw new Error(`Remote Skill snapshot file manifest is not canonical: ${resolvedRoot}`)
    }
    const paths = new Set<string>()
    for (const file of manifest.files) {
      const resolved = resolveDiscoveryChild(resolvedRoot, file.path, "published file")
      if (resolved.relativePath !== file.path || file.path === SNAPSHOT_MANIFEST || paths.has(file.path)) {
        throw new Error(`Remote Skill snapshot has an invalid or duplicate file: ${file.path}`)
      }
      paths.add(file.path)
      const bytes = await Filesystem.readBytes(resolved.localPath)
      if (bytes.byteLength !== file.bytes || sha256(bytes) !== file.sha256) {
        throw new Error(`Remote Skill snapshot file digest mismatch: ${file.path}`)
      }
    }
    if (!paths.has("SKILL.md")) throw new Error(`Remote Skill snapshot does not contain SKILL.md: ${resolvedRoot}`)
    const actualFiles = await snapshotFiles(resolvedRoot)
    if (JSON.stringify(actualFiles) !== JSON.stringify(manifest.files.map((file) => file.path))) {
      throw new Error(`Remote Skill snapshot membership differs from its manifest: ${resolvedRoot}`)
    }
    const content = {
      schema_version: 1 as const,
      source,
      skill: manifest.skill,
      files: manifest.files,
    }
    if (snapshotDigest(content) !== manifest.snapshot_digest || path.basename(resolvedRoot) !== manifest.snapshot_digest) {
      throw new Error(`Remote Skill snapshot digest mismatch: ${resolvedRoot}`)
    }
    const expectedRoot = path.join(dir(), "sources", sourceKey(source), "skills", skillKey(manifest.skill), "snapshots")
    if (path.dirname(resolvedRoot) !== path.resolve(expectedRoot)) {
      throw new Error(`Remote Skill snapshot publication identity changed: ${resolvedRoot}`)
    }
    return manifest
  }

  export async function publishedSnapshotSource(root: string): Promise<string | undefined> {
    const resolved = path.resolve(root)
    if (!Filesystem.contains(path.resolve(dir()), resolved)) return undefined
    return (await requirePublishedSnapshot(resolved)).source
  }

  async function publishSkill(input: {
    source: string
    base: string
    skill: z.infer<typeof Index>["skills"][number]
  }): Promise<string> {
    const snapshots = path.join(
      dir(),
      "sources",
      sourceKey(input.source),
      "skills",
      skillKey(input.skill.name),
      "snapshots",
    )
    await mkdir(snapshots, { recursive: true })
    const staging = await mkdtemp(path.join(snapshots, `.staging-${randomUUID()}-`))
    try {
      const declared = input.skill.files.map((file) => resolveDiscoveryChild(staging, file, "file"))
      const canonicalPaths = declared.map((file) => file.relativePath)
      const normalizedPaths = canonicalPaths.map((file) => file.toLowerCase())
      if (
        new Set(normalizedPaths).size !== normalizedPaths.length ||
        canonicalPaths.filter((file) => file === "SKILL.md").length !== 1 ||
        normalizedPaths.filter((file) => path.posix.basename(file) === "skill.md").length !== 1
      ) {
        throw new Error(`Remote Skill ${JSON.stringify(input.skill.name)} must declare one unique SKILL.md and file set`)
      }
      if (normalizedPaths.includes(SNAPSHOT_MANIFEST.toLowerCase())) {
        throw new Error(`Remote Skill ${JSON.stringify(input.skill.name)} declares the reserved snapshot manifest`)
      }
      const receipts = await Promise.all(
        declared.map(async (file) => {
          const link = new URL(
            `${encodeURIComponent(input.skill.name)}/${file.remotePath}`,
            input.base,
          ).href
          const bytes = await download(link)
          await Filesystem.write(file.localPath, bytes)
          return { path: file.relativePath, bytes: bytes.byteLength, sha256: sha256(bytes) }
        }),
      )
      receipts.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
      const content = {
        schema_version: 1 as const,
        source: input.source,
        skill: input.skill.name,
        files: receipts,
      }
      const manifest = SnapshotManifest.parse({ ...content, snapshot_digest: snapshotDigest(content) })
      await Filesystem.writeJson(path.join(staging, SNAPSHOT_MANIFEST), manifest)
      const target = path.join(snapshots, manifest.snapshot_digest)
      try {
        await Filesystem.renameNoReplace(staging, target)
      } catch (error) {
        if ((error as NodeJS.ErrnoException | undefined)?.code !== "EEXIST") throw error
      }
      await rm(staging, { recursive: true, force: true })
      return await requirePublishedSnapshot(target, { source: input.source, skill: input.skill.name }).then(() => target)
    } finally {
      await rm(staging, { recursive: true, force: true }).catch(() => {})
    }
  }

  export async function pull(url: string, onIssue?: (message: string) => void): Promise<string[]> {
    const result: string[] = []
    const source = normalizeSource(url)
    const index = new URL("index.json", source).href

    log.info("fetching index", { url: index })
    let data: z.infer<typeof Index>
    try {
      const response = await fetch(index)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      data = Index.parse(await response.json())
    } catch (error) {
      log.warn("invalid or unavailable index", { url: index, error })
      onIssue?.(`Remote Skill index ${index} is unavailable or invalid.`)
      return result
    }

    const duplicateNames = new Set<string>()
    const names = new Set<string>()
    for (const skill of data.skills) {
      if (names.has(skill.name)) duplicateNames.add(skill.name)
      names.add(skill.name)
    }

    for (const skill of data.skills) {
      if (duplicateNames.has(skill.name)) {
        onIssue?.(`Remote Skill index ${index} contains duplicate identity ${JSON.stringify(skill.name)}.`)
        continue
      }
      try {
        result.push(await publishSkill({ source, base: source, skill }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.error("failed to publish remote Skill snapshot", { source, skill: skill.name, error })
        onIssue?.(`Remote Skill ${JSON.stringify(skill.name)} from ${source} was ignored: ${message}`)
      }
    }

    return result
  }
}
