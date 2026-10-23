#!/usr/bin/env bun

/**
 * Move a built-in Expert Squad's version whenever its bytes move.
 *
 * `package_digest` is derived from the package bytes and is published: the site registry keys a
 * revision on `(namespace, id, version)` and refuses to store a second digest under a version it
 * already has. So editing a shipped package without bumping its version is not a style problem, it
 * is a deploy that fails at the registry import — which is exactly what `squad-sdk` did on
 * 2026-08-19, after a refactor touched its authoring Skill and left `2026.08.13.1` in place.
 *
 * Nothing checked it, because the version was the one fact about a package a human was expected to
 * maintain by hand. It is not one: the runtime already treats it as derivable, and
 * `nextExpertSquadVersion` computes it there rather than asking an author to restate it. This is
 * the same rule for the packages that ship in the repository.
 *
 * The version lives inside the bytes it describes, so it cannot be hashed naively — stamping a new
 * version would change the digest that decided to stamp it. What is compared instead is a *content*
 * digest taken with the version field replaced by a fixed placeholder, so it answers "did anything
 * else about this package change" and nothing else. That makes the pass idempotent: once stamped,
 * the content digest matches the recorded one and a second run changes nothing.
 *
 * A bump is therefore driven by content, not by the clock. Running this on a later day with no edit
 * does nothing, which is what keeps the generated baseline stable under CI freshness checks.
 */

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { EMBEDDED_EXPERT_SQUAD_IDS } from "../src/expert-squad/builtin/ids"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { nextExpertSquadVersion } from "../src/expert-squad/version"
import { canonicalExpertSquadPackageFileBytes } from "./expert-squad-package-file-bytes"

/** Placeholder substituted for the real version before hashing, so the hash ignores it. */
const VERSION_PLACEHOLDER = "0000.00.00.0"
const MANIFEST = "expert-squad.jsonc"
const VERSION_FIELD = /("version"\s*:\s*)"(\d{4}\.\d{2}\.\d{2}\.[1-9]\d*)"/

export type ExpertSquadRevisionRecord = {
  readonly id: string
  readonly root: string
  readonly version: string
  readonly contentDigest: string
}

/**
 * Both roots that ship. `squad-sdk` is authored under `expert-squads/` with the market packages
 * even though it is embedded, which is the same split `generate-public-market.ts` encodes.
 */
export function shippedPackageRoots(repoRoot: string): { id: string; root: string }[] {
  const authoringRoot = path.join(repoRoot, ExpertSquadRegistry.DIRECTORY, "builtin")
  const roots = fs
    .readdirSync(authoringRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ id: entry.name, root: path.join(authoringRoot, entry.name) }))
  for (const id of EMBEDDED_EXPERT_SQUAD_IDS) {
    if (roots.some((entry) => entry.id === id)) continue
    const root = path.join(repoRoot, "packages", "opencorvus", "src", "expert-squad", "builtin", id)
    // Presence, not the identifier list, decides: whether an embedded package exists is the
    // topology check's business, and a tree without one is a fixture rather than a fault here.
    if (fs.existsSync(path.join(root, MANIFEST))) roots.push({ id, root })
  }
  return roots
    .filter((entry) => fs.existsSync(path.join(entry.root, MANIFEST)))
    .sort((left, right) => left.id.localeCompare(right.id))
}

function trackedFiles(repoRoot: string, root: string): string[] {
  const relative = path.relative(repoRoot, root).replaceAll("\\", "/")
  const listed = Bun.spawnSync({
    cmd: ["git", "ls-files", "--cached", "-z", "--", relative],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (listed.exitCode !== 0) throw new Error(`Could not list ${relative}: ${new TextDecoder().decode(listed.stderr)}`)
  return new TextDecoder()
    .decode(listed.stdout)
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
}

/** Hash of everything in the package except the version field itself. */
export function packageContentDigest(repoRoot: string, root: string): string {
  const digest = createHash("sha256")
  digest.update("opencorvus/expert-squad-content@1", "utf8")
  for (const tracked of trackedFiles(repoRoot, root)) {
    const relativePath = path.relative(root, path.join(repoRoot, tracked)).replaceAll("\\", "/")
    let bytes = canonicalExpertSquadPackageFileBytes(fs.readFileSync(path.join(repoRoot, tracked))).bytes
    if (relativePath === MANIFEST) {
      bytes = Buffer.from(
        bytes.toString("utf8").replace(VERSION_FIELD, (_match, prefix: string) => `${prefix}"${VERSION_PLACEHOLDER}"`),
        "utf8",
      )
    }
    digest.update(`${relativePath}\0${bytes.byteLength}\0`, "utf8")
    digest.update(bytes)
  }
  return digest.digest("hex")
}

export function readManifestVersion(root: string): string {
  const text = fs.readFileSync(path.join(root, MANIFEST), "utf8")
  const matches = text.match(new RegExp(VERSION_FIELD, "g"))
  if (matches?.length !== 1) {
    throw new Error(`${root}/${MANIFEST} must declare exactly one version field, found ${matches?.length ?? 0}`)
  }
  return VERSION_FIELD.exec(text)![2]!
}

function writeManifestVersion(root: string, version: string): void {
  const manifestPath = path.join(root, MANIFEST)
  const text = fs.readFileSync(manifestPath, "utf8")
  fs.writeFileSync(
    manifestPath,
    text.replace(VERSION_FIELD, (_match, prefix: string) => `${prefix}"${version}"`),
  )
}

export type RevisionPlan = {
  readonly records: ExpertSquadRevisionRecord[]
  /** Packages whose content moved under an unchanged version. Empty on a clean tree. */
  readonly stamped: { id: string; from: string; to: string }[]
}

export function planExpertSquadRevisions(input: {
  repoRoot: string
  baseline: Readonly<Record<string, { version: string; contentDigest: string }>>
  now: Date
}): RevisionPlan {
  const records: ExpertSquadRevisionRecord[] = []
  const stamped: { id: string; from: string; to: string }[] = []
  for (const { id, root } of shippedPackageRoots(input.repoRoot)) {
    const contentDigest = packageContentDigest(input.repoRoot, root)
    const declared = readManifestVersion(root)
    const recorded = input.baseline[id]
    // A package the baseline has never seen is recorded as authored; only a package whose content
    // moved while its version stood still needs a new one.
    const needsStamp = Boolean(recorded && recorded.contentDigest !== contentDigest && recorded.version === declared)
    const version = needsStamp ? nextExpertSquadVersion({ current: declared, now: input.now.getTime() }) : declared
    if (needsStamp) stamped.push({ id, from: declared, to: version })
    records.push({ id, root: path.relative(input.repoRoot, root).replaceAll("\\", "/"), version, contentDigest })
  }
  return { records, stamped }
}

export function renderRevisionModule(records: readonly ExpertSquadRevisionRecord[]): string {
  const entries = records
    .map((record) => `  "${record.id}": { version: "${record.version}", contentDigest: "${record.contentDigest}" },`)
    .join("\n")
  return [
    "// Auto-generated by packages/opencorvus/script/generate-expert-squad-revisions.ts. Do not edit.",
    "//",
    "// The published version of every built-in Expert Squad, beside a digest of everything in the",
    "// package except the version field. A package whose content digest moves while its version",
    "// stands still would publish a second `package_digest` under a version the site registry has",
    "// already stored, and the deploy fails at the import. Regenerating stamps the next version.",
    "",
    "export const generatedExpertSquadRevisions: Readonly<",
    "  Record<string, { readonly version: string; readonly contentDigest: string }>",
    "> = {",
    entries,
    "}",
    "",
  ].join("\n")
}

export function resolveRevisionModulePath(repoRoot: string): string {
  return path.join(repoRoot, "packages", "opencorvus", "generated", "expert-squad-revisions.ts")
}

export async function generateExpertSquadRevisions(repoRoot: string, now = new Date()): Promise<RevisionPlan> {
  const modulePath = resolveRevisionModulePath(repoRoot)
  let baseline: Record<string, { version: string; contentDigest: string }> = {}
  if (fs.existsSync(modulePath)) {
    const loaded = (await import(`file://${modulePath.replaceAll("\\", "/")}?t=${Date.now()}`)) as {
      generatedExpertSquadRevisions?: Record<string, { version: string; contentDigest: string }>
    }
    baseline = { ...(loaded.generatedExpertSquadRevisions ?? {}) }
  }
  const plan = planExpertSquadRevisions({ repoRoot, baseline, now })
  for (const { id, to } of plan.stamped) {
    const record = plan.records.find((entry) => entry.id === id)!
    writeManifestVersion(path.join(repoRoot, record.root), to)
  }
  // Stamping edits the manifest, so the recorded content digest is taken again afterwards — the
  // placeholder keeps it identical, and re-reading proves that rather than assuming it.
  const settled = plan.records.map((record) => ({
    ...record,
    contentDigest: packageContentDigest(repoRoot, path.join(repoRoot, record.root)),
  }))
  for (const record of settled) {
    const before = plan.records.find((entry) => entry.id === record.id)!
    if (before.contentDigest !== record.contentDigest) {
      throw new Error(`Stamping ${record.id} changed its content digest; the version placeholder is not holding`)
    }
  }
  await fs.promises.mkdir(path.dirname(modulePath), { recursive: true })
  await fs.promises.writeFile(modulePath, renderRevisionModule(settled))
  return { records: settled, stamped: plan.stamped }
}

if (import.meta.main) {
  const repoRoot = path.resolve(
    path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
    "../../..",
  )
  const plan = await generateExpertSquadRevisions(repoRoot)
  for (const { id, from, to } of plan.stamped) console.log(`stamped ${id}: ${from} -> ${to}`)
  console.log(JSON.stringify({ packages: plan.records.length, stamped: plan.stamped.length }))
}
