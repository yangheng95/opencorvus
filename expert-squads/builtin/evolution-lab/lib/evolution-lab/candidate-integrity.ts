// V1 means Version 1. SHA-256 means Secure Hash Algorithm 256-bit.
import { createHash } from "node:crypto"
import { tool, ValidatedExpertSquadPackageSchema } from "@opencorvus-ai/plugin"

type ValidatedPackage = ReturnType<typeof ValidatedExpertSquadPackageSchema.parse>
type Manifest = Record<string, unknown>

function canonicalJSON(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSON(record[key])}`)
      .join(",")}}`
  }
  throw new Error("Candidate integrity value is not canonical JSON")
}

function manifestRecord(value: unknown): Manifest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Validated package manifest is invalid")
  return value as Manifest
}

export function candidateMutableTextPaths(pkg: ValidatedPackage): string[] {
  const manifest = manifestRecord(pkg.manifest)
  const selector = manifestRecord(manifest.selector)
  const capability = manifestRecord(manifest.capability_projection)
  const scheduler = manifestRecord(capability.scheduler)
  const agents = manifestRecord(capability.agents)
  const paths = new Set<string>()
  const files = new Map(pkg.files.map((file) => [file.path, file]))
  for (const value of [manifest.readme, selector.instructions, scheduler.prompt]) {
    if (typeof value === "string") paths.add(value)
  }
  for (const agent of Object.values(agents)) {
    const prompt = manifestRecord(agent).prompt
    if (typeof prompt === "string") paths.add(prompt)
  }
  for (const closure of pkg.skill_closures) {
    const root = closure.source.slice(0, -"SKILL.md".length).replace(/\/$/, "")
    for (const file of closure.files) {
      // Agent Skills reserve scripts and assets for executable or opaque resources.
      // V1 mutates only the instruction and model-readable reference/example closure.
      if (file !== "SKILL.md" && !file.startsWith("references/") && !file.startsWith("examples/")) {
        continue
      }
      const packagePath = root ? `${root}/${file}` : file
      if (files.get(packagePath)?.utf8_text === true) paths.add(packagePath)
    }
  }
  return [...paths].sort()
}

function frozenManifest(manifestValue: unknown) {
  const manifest = { ...manifestRecord(manifestValue) }
  delete manifest.version
  return canonicalJSON(manifest)
}

export function compareCandidateIntegrity(parent: ValidatedPackage, candidate: ValidatedPackage) {
  if (parent.namespace !== candidate.namespace || parent.id !== candidate.id) {
    throw new Error("Candidate logical identity must equal its parent")
  }
  if (parent.version === candidate.version) throw new Error("Candidate revision must declare a new package version")
  if (frozenManifest(parent.manifest) !== frozenManifest(candidate.manifest)) {
    throw new Error("Candidate manifest changed outside the V1 mutable version field")
  }
  const parentMutable = candidateMutableTextPaths(parent)
  const candidateMutable = candidateMutableTextPaths(candidate)
  if (canonicalJSON(parentMutable) !== canonicalJSON(candidateMutable)) {
    throw new Error("Candidate mutable path closure differs from its parent")
  }
  const mutable = new Set(parentMutable)
  const parentFiles = new Map(parent.files.map((file) => [file.path, file]))
  const candidateFiles = new Map(candidate.files.map((file) => [file.path, file]))
  const allPaths = [...new Set([...parentFiles.keys(), ...candidateFiles.keys()])].sort()
  const changedPaths: string[] = ["expert-squad.jsonc"]
  const frozenFiles: Array<{ path: string; parent_sha256: string; candidate_sha256: string }> = []
  for (const path of allPaths) {
    if (path === "expert-squad.jsonc") continue
    const before = parentFiles.get(path)
    const after = candidateFiles.get(path)
    if (!before || !after) throw new Error(`Candidate package file set changed at ${path}`)
    if (mutable.has(path)) {
      if (before.sha256 !== after.sha256) changedPaths.push(path)
      continue
    }
    if (before.sha256 !== after.sha256) throw new Error(`Candidate changed frozen file ${path}`)
    frozenFiles.push({ path, parent_sha256: before.sha256, candidate_sha256: after.sha256 })
  }
  if (changedPaths.length === 1) throw new Error("Candidate revision must change at least one V1 mutable text path")
  changedPaths.sort()
  const diffSHA256 = createHash("sha256")
    .update(
      canonicalJSON({
        parent_digest: parent.package_digest,
        candidate_digest: candidate.package_digest,
        changed_paths: changedPaths,
        frozen_files: frozenFiles,
      }),
    )
    .digest("hex")
  return tool.schema
    .object({
      parent_digest: tool.schema.string().length(64),
      candidate_digest: tool.schema.string().length(64),
      diff_sha256: tool.schema.string().length(64),
      mutable_paths: tool.schema.array(tool.schema.string()),
      changed_paths: tool.schema.array(tool.schema.string()).min(1),
      frozen_files: tool.schema.array(
        tool.schema
          .object({
            path: tool.schema.string(),
            parent_sha256: tool.schema.string().length(64),
            candidate_sha256: tool.schema.string().length(64),
          })
          .strict(),
      ),
    })
    .strict()
    .parse({
      parent_digest: parent.package_digest,
      candidate_digest: candidate.package_digest,
      diff_sha256: diffSHA256,
      mutable_paths: parentMutable,
      changed_paths: changedPaths,
      frozen_files: frozenFiles,
    })
}
