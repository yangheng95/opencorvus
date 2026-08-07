#!/usr/bin/env bun
/**
 * Repo-wide in-tree secret scan.
 *
 * Scans ONLY git-tracked files (so .gitignored .env / .secrets are
 * excluded). Fails the build if any common API-key / credential
 * pattern is found in source. Designed to run in pre-push so a
 * credential-shaped content is caught before it lands in a commit.
 *
 * Why a fresh script and not an extension to audit-bundle.ts:
 *   - audit-bundle.ts targets PRODUCTION BUNDLES (dist/extension.cjs,
 *     media/ui), not git-tracked sources.
 *   - This scan operates on pushed git trees plus the git index so the
 *     coverage is independent of any package's build status.
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
 *  - `eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\.` JWT shape (catches
 *    embedded user JWTs / opaque service tokens).
 *  - Bare `password\s*[:=]\s*["'][^"'$]{8,}` — heuristic for
 *    hand-pasted plaintext password assignments.
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
  match: string
}

export interface ScanOptions {
  repoRoot: string
  /** Override the file list for fixture tests. Production scans git object snapshots. */
  files?: string[]
  /** Git commit or tree object ids to scan before the index. Default: HEAD when it exists. */
  refs?: string[]
  /** Override the pattern set (used by tests). */
  patterns?: ReadonlyArray<SecretPattern>
}

function readUInt32BE(buf: Buffer, offset: number): number {
  if (offset + 4 > buf.length) throw new Error("git index is truncated")
  return buf.readUInt32BE(offset)
}

function gitIndexPath(repoRoot: string): string {
  if (process.env.GIT_INDEX_FILE) return process.env.GIT_INDEX_FILE
  const dotGit = path.join(repoRoot, ".git")
  const stat = fs.statSync(dotGit)
  if (stat.isDirectory()) return path.join(dotGit, "index")
  const content = fs.readFileSync(dotGit, "utf8").trim()
  const match = /^gitdir:\s*(.+)$/i.exec(content)
  if (!match) throw new Error(`unsupported .git file format at ${dotGit}`)
  const gitDir = path.isAbsolute(match[1]!) ? match[1]! : path.resolve(repoRoot, match[1]!)
  return path.join(gitDir, "index")
}

export function parseGitIndexEntries(data: Buffer): GitIndexEntry[] {
  if (data.length < 12 || data.toString("ascii", 0, 4) !== "DIRC") {
    throw new Error("git index header is missing DIRC signature")
  }
  const version = readUInt32BE(data, 4)
  if (version !== 2 && version !== 3) {
    throw new Error(`unsupported git index version ${version}; secret scan expects v2/v3 index entries`)
  }
  const count = readUInt32BE(data, 8)
  const entries: GitIndexEntry[] = []
  let offset = 12
  for (let i = 0; i < count; i++) {
    const entryStart = offset
    const fixed = 62
    if (offset + fixed > data.length) throw new Error(`git index entry ${i} is truncated`)
    const flags = data.readUInt16BE(offset + 60)
    const mode = readUInt32BE(data, entryStart + 24)
    const size = readUInt32BE(data, entryStart + 36)
    const objectId = data.toString("hex", entryStart + 40, entryStart + 60)
    const stage = (flags >> 12) & 0x3
    offset += fixed
    if (version === 3 && (flags & 0x4000) !== 0) {
      if (offset + 2 > data.length) throw new Error(`git index entry ${i} extended flags are truncated`)
      offset += 2
    }
    const nul = data.indexOf(0, offset)
    if (nul < 0) throw new Error(`git index entry ${i} path is not null-byte terminated`)
    entries.push({ file: data.toString("utf8", offset, nul), objectId, size, mode, stage })
    offset = nul + 1
    const padding = (8 - ((offset - entryStart) % 8)) % 8
    offset += padding
  }
  return entries
}

export function parseGitIndexPaths(data: Buffer): string[] {
  return parseGitIndexEntries(data).map((entry) => entry.file)
}

export function listTrackedFiles(repoRoot: string): string[] {
  return listTrackedEntries(repoRoot).map((entry) => entry.file)
}

export function listTrackedEntries(repoRoot: string): GitIndexEntry[] {
  return parseGitIndexEntries(fs.readFileSync(gitIndexPath(repoRoot))).filter((entry) => entry.stage === 0)
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

function scanRefs(repoRoot: string, refs: string[] | undefined): string[] {
  if (refs) return [...new Set(refs)]
  const head = resolveHeadRef(repoRoot)
  return head ? [head] : []
}

export function parsePrePushLocalRefs(input: string): string[] {
  const refs = new Set<string>()
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const fields = trimmed.split(/\s+/)
    if (fields.length < 2) throw new Error(`invalid pre-push ref line: ${line}`)
    const localObjectId = fields[1]!
    if (/^0+$/.test(localObjectId)) continue
    refs.add(localObjectId)
  }
  return [...refs]
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
        match: m[0].slice(0, 16) + (m[0].length > 16 ? "…" : ""),
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

  const refEntries = scanRefs(opts.repoRoot, opts.refs).flatMap((ref) => listTreeEntries(opts.repoRoot, ref))
  const indexEntries = listTrackedEntries(opts.repoRoot)
  const entries = [...refEntries, ...indexEntries].filter(
    (entry) => shouldScan(entry.file) && entry.mode !== GITLINK_MODE && entry.size <= MAX_SCANNED_BYTES,
  )
  for (const chunk of chunkGitEntries(entries)) {
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
  if (args.some((arg) => arg !== "--pre-push-stdin")) {
    console.error("usage: bun run script/secret-scan.ts [--pre-push-stdin]")
    process.exit(2)
  }
  // `new URL(import.meta.url).pathname` returns `/C:/...` on Windows
  // — leading slash poisons `path.resolve`. `fileURLToPath` is the
  // canonical conversion that handles both POSIX and Windows.
  const here = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(here, "..")
  const refs = args.includes("--pre-push-stdin") ? parsePrePushLocalRefs(fs.readFileSync(0, "utf8")) : undefined
  const hits = scan({ repoRoot, refs })
  if (hits.length === 0) {
    console.log(`[secret-scan] OK — 0 hits across tracked sources`)
    process.exit(0)
  }
  console.error(`[secret-scan] FAIL — ${hits.length} hit(s):`)
  for (const h of hits) {
    console.error(`  ${h.file}:${h.lineNumber}  [${h.patternId}] ${h.description} → ${h.match}`)
  }
  console.error(
    `\nIf the match is a deliberate test fixture, append \`// ${IGNORE_DIRECTIVE}\` to the line.\n` +
      `If it is a real secret: revoke it at the issuing service, then remove from source. The string\n` +
      `also lives in git history — recovery requires \`git filter-repo\` plus a coordinated force-push.`,
  )
  process.exit(1)
}
