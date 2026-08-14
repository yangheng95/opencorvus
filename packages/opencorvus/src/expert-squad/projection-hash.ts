import { createHash } from "node:crypto"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"

export { compareCanonicalStrings } from "@/util/canonical-digest"

export const ProjectionHashDomain = {
  catalogDeclaration: "opencorvus.expert-squad.catalog-declaration.v1",
  scheduler: "opencorvus.expert-squad.scheduler-projection.v1",
  worker: "opencorvus.expert-squad.worker-projection.v1",
  productionSkills: "opencorvus.expert-squad.production-skill-projection.v1",
  activeAgents: "opencorvus.expert-squad.active-agent-projection.v1",
  selector: "opencorvus.expert-squad.selector-projection.v1",
} as const

export type ProjectionHashDomain = (typeof ProjectionHashDomain)[keyof typeof ProjectionHashDomain]

export function canonicalProjectionHash(domain: ProjectionHashDomain, payload: unknown): string {
  return canonicalDigestSource(domain, payload).sha256
}

export function canonicalStringSet(values: readonly string[], context: string): string[] {
  if (new Set(values).size !== values.length) throw new Error(`${context} contains duplicate values`)
  return [...values].sort(compareCanonicalStrings)
}

export function textSHA256(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}
