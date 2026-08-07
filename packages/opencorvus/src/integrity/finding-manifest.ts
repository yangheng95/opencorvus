import { createHash } from "node:crypto"

export type IntegrityManifestSource = {
  id?: string
  fingerprint?: string
  title?: string
  description?: string
  repair?: string
  evidence?: string[]
  filePaths?: string[]
  targetIDs?: string[]
  requirementIDs?: string[]
  specIDs?: string[]
  canonicalSymptom?: string
  affectedSymbols?: string[]
  verify?: string[]
}

export type IntegrityFingerprintSource = IntegrityManifestSource & {
  canonicalSymptom: string
}

export type IntegrityPriorManifestRef = {
  id: string
  fingerprint: string
  reviewNumber?: number
}

const INTEGRITY_FINDING_FINGERPRINT_PATTERN = /^if_[a-f0-9]{16}$/

export function isIntegrityFindingFingerprint(value: unknown): value is string {
  return typeof value === "string" && INTEGRITY_FINDING_FINGERPRINT_PATTERN.test(value)
}

export function assertIntegrityFindingFingerprint(value: unknown, context = "integrity finding fingerprint"): string {
  if (!isIntegrityFindingFingerprint(value)) {
    throw new Error(`${context} must match if_[a-f0-9]{16}`)
  }
  return value
}

export function integrityFindingFingerprint(input: IntegrityFingerprintSource): string {
  const canonicalSymptom = normalizeDisplayText(input.canonicalSymptom)
  if (!canonicalSymptom) throw new Error("integrity finding canonicalSymptom must be non-empty")
  const seed = {
    symptom: normalizeHashText(canonicalSymptom),
    files: stableList(input.filePaths),
    targets: stableList(input.targetIDs),
    requirements: stableList(input.requirementIDs),
    specs: stableList(input.specIDs),
    symbols: stableList(input.affectedSymbols),
  }
  return `if_${createHash("sha256").update(JSON.stringify(seed)).digest("hex").slice(0, 16)}`
}

export function buildPriorManifestIndex(
  priorReviews: Array<{
    reviewNumber?: number
    findings: IntegrityManifestSource[]
    requiredRepairs: IntegrityManifestSource[]
  }>,
): Map<string, IntegrityPriorManifestRef> {
  const out = new Map<string, IntegrityPriorManifestRef>()
  for (const attempt of priorReviews) {
    const items = [...attempt.findings, ...attempt.requiredRepairs]
    for (const item of items) {
      const id = normalizeDisplayText(item.id)
      if (!id) continue
      const fingerprint = assertIntegrityFindingFingerprint(item.fingerprint, `prior manifest item ${id} fingerprint`)
      out.set(fingerprint, { id, fingerprint, reviewNumber: attempt.reviewNumber })
    }
  }
  return out
}

export function stableList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((item) => (typeof item === "string" ? [normalizeDisplayText(item)] : [])))]
    .filter((item) => item.length > 0)
    .sort((a, b) => a.localeCompare(b))
}

function normalizeDisplayText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
}

function normalizeHashText(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._:/#-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600)
}
