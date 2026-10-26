#!/usr/bin/env bun
/**
 * Repo-wide in-tree secret scan.
 *
 * Scans ONLY git-tracked files (so .gitignored .env / .secrets are
 * excluded). Fails the build if any common API-key / credential
 * pattern is found in source. Designed to run in pre-push so a
 * credential-shaped content is caught before it reaches remote history.
 *
 * Why a fresh script and not an extension to audit-bundle.ts:
 *   - audit-bundle.ts targets PRODUCTION BUNDLES (dist/extension.cjs,
 *     media/ui), not git-tracked sources.
 *   - This scan covers pushed tips, changed file snapshots in every newly
 *     pushed commit, and the git index, independent of package build status.
 *
 * Allow-list: tests intentionally embed fake-looking secrets to
 *   exercise the scanner. Lines containing `secret-scan: ignore`
 *   anywhere on the same line are skipped. Use sparingly.
 */

import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

interface SecretPattern {
  id: string
  /** Human description shown on hit. */
  description: string
  /** Regex applied to each tracked-file LINE. The match itself is
   *  surfaced in the report (truncated to 16 chars). */
  pattern: RegExp
}

/**
 * Patterns chosen for low false-positive on a typical TS/JS repo:
 *
 *  - `sk-` is a common model-provider secret prefix; require
 *    ≥20 alnum follow chars to avoid `sk-abc` test fixtures.
 *  - `ghp_` / `gho_` / `ghs_` are GitHub PAT prefixes; ≥30 chars.
 *  - `AKIA[A-Z0-9]{16}` matches AWS access key (fixed length 20).
 *  - `AIza[A-Za-z0-9_-]{35}` matches Google API key (length 39).
 *  - `xoxb-`/`xoxp-` Slack bot/user tokens.
 *  - `eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}` JWT shape (catches
 *    embedded user JWTs / opaque service tokens).
 */
export const SECRET_PATTERNS: ReadonlyArray<SecretPattern> = [
  { id: "provider-key", description: "Model-provider key (sk-...)", pattern: /sk-[A-Za-z0-9]{20,}/ },
  { id: "github-pat", description: "GitHub personal access token", pattern: /gh[pos]_[A-Za-z0-9]{30,}/ },
  { id: "aws-akid", description: "AWS access key id", pattern: /\bAKIA[A-Z0-9]{16}\b/ },
  { id: "google-api", description: "Google API key", pattern: /\bAIza[A-Za-z0-9_\-]{35,}\b/ },
  { id: "slack-token", description: "Slack bot/user token", pattern: /\bxox[bp]-[A-Za-z0-9-]{20,}\b/ },
  {
    id: "jwt",
    description: "Embedded JWT",
    pattern: /\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}\b/,
  },
]

const IGNORE_DIRECTIVE = "secret-scan: ignore"
const MAX_SCANNED_BYTES = 1024 * 1024
const GITLINK_MODE = 0o160000
const BLOB_BATCH_TARGET_BYTES = 8 * 1024 * 1024
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".toml",
  ".html",
  ".css",
  ".sh",
  ".rs",
])
const TEXT_COMPOUND_SUFFIXES = [".env.example"]

export interface GitIndexEntry {
  file: string
  objectId: string
  size: number
  mode: number
  stage: number
}

export interface SecretHit {
  file: string
  lineNumber: number
  patternId: string
  description: string
}

export interface PrePushUpdate {
  localRef: string
  localObjectId: string
  remoteRef: string
  remoteObjectId: string
}

export interface ScanOptions {
  repoRoot: string
  /** Override the file list for fixture tests. Production scans git object snapshots. */
  files?: string[]
  /** Exact four-field Git hook updates. Without hook input, scan HEAD and the index. */
  pushUpdates?: PrePushUpdate[]
  /** Git's target remote name or URL, required for a pre-push publication boundary. */
  targetRemote?: string
  /** Override the pattern set (used by tests). */
  patterns?: ReadonlyArray<SecretPattern>
}

export function listTrackedEntries(repoRoot: string): GitIndexEntry[] {
  const result = spawnSync("git", ["-C", repoRoot, "ls-files", "--stage", "--full-name", "-z"], {
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr.toString("utf8").trim()}`)
  const entries: GitIndexEntry[] = []
  for (const record of result.stdout.toString("utf8").split("\0")) {
    if (!record) continue
    const tab = record.indexOf("\t")
    const fields = record.slice(0, tab).split(" ")
    if (
      tab < 0 ||
      fields.length !== 3 ||
      !/^[0-7]{6}$/.test(fields[0]!) ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(fields[1]!) ||
      !/^[0-3]$/.test(fields[2]!) ||
      tab === record.length - 1
    ) {
      throw new Error(`invalid git ls-files record: ${record}`)
    }
    const stage = Number(fields[2])
    if (stage !== 0) continue
    entries.push({
      file: record.slice(tab + 1),
      objectId: fields[1]!,
      size: 0,
      mode: Number.parseInt(fields[0]!, 8),
      stage,
    })
  }
  const objectIds = [...new Set(entries.filter((entry) => entry.mode !== GITLINK_MODE).map((entry) => entry.objectId))]
  const sizes = objectIds.length ? readGitObjectSizes(repoRoot, objectIds) : new Map<string, number>()
  return entries.map((entry) => ({ ...entry, size: entry.mode === GITLINK_MODE ? 0 : sizes.get(entry.objectId)! }))
}

export function parseGitTreeEntries(data: Buffer): GitIndexEntry[] {
  const entries: GitIndexEntry[] = []
  for (const record of data.toString("utf8").split("\0")) {
    if (!record) continue
    const tab = record.indexOf("\t")
    if (tab < 0) throw new Error(`git tree record is missing path separator: ${record}`)
    const header = record.slice(0, tab)
    const file = record.slice(tab + 1)
    const parts = header.split(/\s+/)
    if (parts.length !== 4) throw new Error(`git tree record has invalid metadata: ${header}`)
    const [modeText, type, objectId, sizeText] = parts as [string, string, string, string]
    if (type !== "blob") continue
    const size = Number(sizeText)
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error(`git tree blob ${objectId} has invalid size: ${sizeText}`)
    }
    entries.push({ file, objectId, size, mode: Number.parseInt(modeText, 8), stage: 0 })
  }
  return entries
}

function listTreeEntries(repoRoot: string, ref: string): GitIndexEntry[] {
  const result = spawnSync("git", ["-C", repoRoot, "ls-tree", "-r", "-z", "-l", ref], {
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const stderr = result.stderr.toString("utf8").trim()
    throw new Error(`git ls-tree failed for ${ref}: ${stderr}`)
  }
  return parseGitTreeEntries(result.stdout)
}

function resolveHeadRef(repoRoot: string): string | undefined {
  const result = spawnSync("git", ["-C", repoRoot, "rev-parse", "--verify", "HEAD"], { encoding: "utf8" })
  if (result.error) throw result.error
  if (result.status !== 0) return undefined
  return result.stdout.trim()
}

function scanTips(repoRoot: string, updates: PrePushUpdate[] | undefined): string[] {
  if (updates)
    return [
      ...new Set(updates.filter((update) => !/^0+$/.test(update.localObjectId)).map((update) => update.localObjectId)),
    ]
  const head = resolveHeadRef(repoRoot)
  return head ? [head] : []
}

export function parsePrePushUpdates(input: string): PrePushUpdate[] {
  const updates: PrePushUpdate[] = []
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const fields = trimmed.split(/\s+/)
    if (
      fields.length !== 4 ||
      ![fields[1], fields[3]].every((value) => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value!))
    ) {
      throw new Error(`invalid pre-push ref line: ${line}`)
    }
    const [localRef, localObjectId, remoteRef, remoteObjectId] = fields as [string, string, string, string]
    updates.push({ localRef, localObjectId, remoteRef, remoteObjectId })
  }
  return updates
}

function publishedRemoteCommits(repoRoot: string, targetRemote: string | undefined): string[] {
  if (!targetRemote?.trim()) throw new Error("Pre-push secret scan requires the target remote")
  const remote = spawnSync("git", ["-C", repoRoot, "ls-remote", "--", targetRemote], {
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  if (remote.error) throw remote.error
  if (remote.status !== 0)
    throw new Error(`Secret scan remote inventory unavailable: ${remote.stderr.toString("utf8").trim()}`)
  const objectIds = [
    ...new Set(
      remote.stdout
        .toString("utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const match = /^([a-f0-9]{40}|[a-f0-9]{64})\s+\S+$/.exec(line)
          if (!match) throw new Error("Secret scan remote inventory returned invalid ref metadata")
          return match[1]!
        }),
    ),
  ]
  if (objectIds.length === 0) return []
  // Unknown objects cannot prove a local ancestry boundary. Never fetch unrelated remote history here.
  const metadata = spawnSync("git", ["-C", repoRoot, "cat-file", "--batch-check=%(objectname) %(objecttype)"], {
    input: objectIds.join("\n") + "\n",
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  })
  if (metadata.error) throw metadata.error
  if (metadata.status !== 0) throw new Error("Secret scan remote commit metadata could not be read")
  const rows = metadata.stdout.toString("utf8").trim().split(/\r?\n/)
  if (rows.length !== objectIds.length) throw new Error("Secret scan remote commit metadata is incomplete")
  return rows.flatMap((row, index) => {
    const [objectId, type] = row.split(" ")
    if (objectId !== objectIds[index] || !type) throw new Error("Secret scan remote commit identity mismatch")
    return type === "commit" ? [objectId!] : []
  })
}

function listPushedChanges(repoRoot: string, updates: PrePushUpdate[], targetRemote?: string): GitIndexEntry[] {
  const tips = [
    ...new Set(updates.filter((update) => !/^0+$/.test(update.localObjectId)).map((update) => update.localObjectId)),
  ]
  if (tips.length === 0) return []
  const published = new Set([
    ...publishedRemoteCommits(repoRoot, targetRemote),
    ...updates.filter((update) => !/^0+$/.test(update.remoteObjectId)).map((update) => update.remoteObjectId),
  ])
  const revisions = [...tips, ...[...published].map((objectId) => `^${objectId}`)]
  const commits = new Set<string>()
  {
    const result = spawnSync("git", ["-C", repoRoot, "rev-list", "--reverse", ...revisions, "--"], {
      maxBuffer: 64 * 1024 * 1024,
    })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`git rev-list failed: ${result.stderr.toString("utf8").trim()}`)
    for (const commit of result.stdout.toString("utf8").split(/\r?\n/)) if (commit) commits.add(commit)
  }
  if (commits.size === 0) return []
  const result = spawnSync(
    "git",
    [
      "-C",
      repoRoot,
      "diff-tree",
      "--stdin",
      "--root",
      "-r",
      "-m",
      "--no-renames",
      "--raw",
      "--no-abbrev",
      "--no-commit-id",
      "-z",
    ],
    { input: [...commits].join("\n") + "\n", maxBuffer: 64 * 1024 * 1024 },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`git diff-tree failed: ${result.stderr.toString("utf8").trim()}`)
  const records = result.stdout.toString("utf8").split("\0")
  const entries: GitIndexEntry[] = []
  for (let index = 0; index < records.length; index++) {
    const header = records[index]!
    if (!header) continue
    const fields = header.split(" ")
    const file = records[++index]
    if (fields.length !== 5 || !/^:[0-7]{6}$/.test(fields[0]!) || !file) {
      throw new Error(`invalid git diff-tree record: ${header}`)
    }
    const mode = Number.parseInt(fields[1]!, 8)
    if (mode === 0 || mode === GITLINK_MODE || !shouldScan(file)) continue
    entries.push({ file, objectId: fields[3]!, size: 0, mode, stage: 0 })
  }
  if (entries.length === 0) return []
  const sizes = readGitObjectSizes(repoRoot, [...new Set(entries.map((entry) => entry.objectId))])
  return entries.map((entry) => ({ ...entry, size: sizes.get(entry.objectId)! }))
}

function shouldScan(rel: string): boolean {
  const normalized = rel.toLowerCase()
  if (TEXT_COMPOUND_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true
  const ext = path.extname(rel).toLowerCase()
  // No extension is fine (e.g. Dockerfile, LICENSE) — scan as text.
  if (!ext) return true
  return TEXT_EXTENSIONS.has(ext)
}

function scanText(
  file: string,
  text: string,
  patterns: ReadonlyArray<SecretPattern>,
  hits: SecretHit[],
  seen: Set<string>,
) {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes(IGNORE_DIRECTIVE)) continue
    for (const p of patterns) {
      const m = p.pattern.exec(line)
      if (!m) continue
      const key = `${file}\0${i + 1}\0${p.id}\0${m[0]}`
      if (seen.has(key)) continue
      seen.add(key)
      hits.push({
        file,
        lineNumber: i + 1,
        patternId: p.id,
        description: p.description,
      })
    }
  }
}

function* chunkGitEntries(entries: GitIndexEntry[]): Generator<GitIndexEntry[]> {
  let chunk: GitIndexEntry[] = []
  let size = 0
  for (const entry of entries) {
    if (chunk.length > 0 && size + entry.size > BLOB_BATCH_TARGET_BYTES) {
      yield chunk
      chunk = []
      size = 0
    }
    chunk.push(entry)
    size += entry.size
  }
  if (chunk.length > 0) yield chunk
}

function readGitObjectSizes(repoRoot: string, objectIds: string[]): Map<string, number> {
  const input = Buffer.from(objectIds.join("\n") + "\n")
  const result = spawnSync(
    "git",
    ["-C", repoRoot, "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    {
      input,
      maxBuffer: Math.max(objectIds.length * 256, 1024 * 1024),
    },
  )
  if (result.error) throw result.error
  if (result.status !== 0) {
    const stderr = result.stderr.toString("utf8").trim()
    throw new Error(`git cat-file --batch-check failed: ${stderr}`)
  }
  const sizes = new Map<string, number>()
  for (const line of result.stdout.toString("utf8").trim().split(/\r?\n/)) {
    if (!line) continue
    const [objectId, type, sizeText] = line.split(" ") as [string, string, string]
    if (type === "missing") throw new Error(`git blob ${objectId} is missing`)
    if (type !== "blob") throw new Error(`git object ${objectId} is not a blob: ${line}`)
    const size = Number(sizeText)
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`git blob ${objectId} has invalid size: ${sizeText}`)
    sizes.set(objectId, size)
  }
  if (sizes.size !== objectIds.length) throw new Error("git cat-file --batch-check returned an incomplete object list")
  return sizes
}

function* chunkObjectIdsBySize(objectIds: string[], sizes: Map<string, number>) {
  let chunk: string[] = []
  let size = 0
  for (const objectId of objectIds) {
    const objectSize = sizes.get(objectId)
    if (objectSize === undefined) throw new Error(`git blob ${objectId} size was not returned`)
    if (chunk.length > 0 && size + objectSize > BLOB_BATCH_TARGET_BYTES) {
      yield chunk
      chunk = []
      size = 0
    }
    chunk.push(objectId)
    size += objectSize
  }
  if (chunk.length > 0) yield chunk
}

function readGitBlobBatch(repoRoot: string, objectIds: string[], sizes: Map<string, number>): Map<string, Buffer> {
  const input = Buffer.from(objectIds.join("\n") + "\n")
  const expectedBytes = objectIds.reduce((sum, objectId) => sum + sizes.get(objectId)!, 0) + objectIds.length * 128
  const result = spawnSync("git", ["-C", repoRoot, "cat-file", "--batch"], {
    input,
    maxBuffer: Math.max(expectedBytes + 1024 * 1024, BLOB_BATCH_TARGET_BYTES + 1024 * 1024),
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const stderr = result.stderr.toString("utf8").trim()
    throw new Error(`git cat-file --batch failed: ${stderr}`)
  }
  const output = result.stdout
  const blobs = new Map<string, Buffer>()
  let offset = 0
  for (const objectId of objectIds) {
    const headerEnd = output.indexOf(0x0a, offset)
    if (headerEnd < 0) throw new Error(`git cat-file output for ${objectId} is missing a header terminator`)
    const header = output.toString("utf8", offset, headerEnd)
    const parts = header.split(" ")
    if (parts[1] === "missing") throw new Error(`git blob ${objectId} is missing`)
    if (parts.length !== 3 || parts[1] !== "blob") {
      throw new Error(`git object ${objectId} is not a blob: ${header}`)
    }
    const blobSize = Number(parts[2])
    if (!Number.isSafeInteger(blobSize) || blobSize < 0) {
      throw new Error(`git blob ${objectId} has invalid size: ${parts[2]}`)
    }
    const bodyStart = headerEnd + 1
    const bodyEnd = bodyStart + blobSize
    if (bodyEnd > output.length) throw new Error(`git cat-file output for ${objectId} is truncated`)
    blobs.set(objectId, Buffer.from(output.subarray(bodyStart, bodyEnd)))
    offset = bodyEnd
    if (output[offset] !== 0x0a) throw new Error(`git cat-file output for ${objectId} is missing body terminator`)
    offset++
  }
  return blobs
}

function readGitBlobs(repoRoot: string, entries: GitIndexEntry[]): Map<string, Buffer> {
  const objectIds = [...new Set(entries.map((entry) => entry.objectId))]
  const sizes = readGitObjectSizes(repoRoot, objectIds)
  const blobs = new Map<string, Buffer>()
  for (const chunk of chunkObjectIdsBySize(objectIds, sizes)) {
    for (const [objectId, blob] of readGitBlobBatch(repoRoot, chunk, sizes)) {
      blobs.set(objectId, blob)
    }
  }
  return blobs
}

export function scan(opts: ScanOptions): SecretHit[] {
  const patterns = opts.patterns ?? SECRET_PATTERNS
  const hits: SecretHit[] = []
  const seen = new Set<string>()

  if (opts.files) {
    for (const rel of opts.files) {
      if (!shouldScan(rel)) continue
      const abs = path.join(opts.repoRoot, rel)
      const stat = fs.statSync(abs)
      if (stat.size > MAX_SCANNED_BYTES) continue
      scanText(rel, fs.readFileSync(abs, "utf8"), patterns, hits, seen)
    }
    return hits
  }

  const refEntries = scanTips(opts.repoRoot, opts.pushUpdates).flatMap((ref) => listTreeEntries(opts.repoRoot, ref))
  const indexEntries = listTrackedEntries(opts.repoRoot)
  const pushedEntries = opts.pushUpdates ? listPushedChanges(opts.repoRoot, opts.pushUpdates, opts.targetRemote) : []
  const entries = new Map<string, GitIndexEntry>()
  for (const entry of [...refEntries, ...indexEntries, ...pushedEntries]) {
    if (!shouldScan(entry.file) || entry.mode === GITLINK_MODE || entry.size > MAX_SCANNED_BYTES) continue
    // A Git blob identifies immutable bytes. Keep each path and each version,
    // while sharing identical tip/index/history snapshots within this scan.
    const key = `${entry.file}\0${entry.objectId}`
    if (!entries.has(key)) entries.set(key, entry)
  }
  for (const chunk of chunkGitEntries([...entries.values()])) {
    const blobs = readGitBlobs(opts.repoRoot, chunk)
    for (const entry of chunk) {
      const blob = blobs.get(entry.objectId)
      if (!blob) throw new Error(`git blob ${entry.objectId} for ${entry.file} was not returned by git cat-file`)
      scanText(entry.file, blob.toString("utf8"), patterns, hits, seen)
    }
  }
  return hits
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  let prePush = false
  let targetRemote: string | undefined
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--pre-push-stdin" && !prePush) prePush = true
    else if (args[index] === "--remote" && args[index + 1]?.trim() && !targetRemote) targetRemote = args[++index]
    else {
      console.error("usage: bun run script/secret-scan.ts [--pre-push-stdin --remote <target>]")
      process.exit(2)
    }
  }
  // `new URL(import.meta.url).pathname` returns `/C:/...` on Windows
  // — leading slash poisons `path.resolve`. `fileURLToPath` is the
  // canonical conversion that handles both POSIX and Windows.
  const here = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(here, "..")
  const pushUpdates = prePush ? parsePrePushUpdates(fs.readFileSync(0, "utf8")) : undefined
  console.log(
    pushUpdates
      ? "[secret-scan] Checking pushed file snapshots and the index"
      : "[secret-scan] Checking HEAD and index file snapshots",
  )
  const hits = scan({ repoRoot, pushUpdates, targetRemote })
  if (hits.length === 0) {
    console.log(`[secret-scan] OK — 0 hits across tracked sources`)
    process.exit(0)
  }
  console.error(`[secret-scan] FAIL — ${hits.length} hit(s):`)
  for (const h of hits) {
    console.error(`  ${h.file}:${h.lineNumber}  [${h.patternId}] ${h.description}`)
  }
  console.error(
    `\nIf the match is a deliberate test fixture, append \`// ${IGNORE_DIRECTIVE}\` to the line.\n` +
      `Revoke any real credential, then remove it from every commit to be pushed and from the index.\n` +
      `If it was published earlier, coordinate history cleanup with the maintainers.`,
  )
  process.exit(1)
}
