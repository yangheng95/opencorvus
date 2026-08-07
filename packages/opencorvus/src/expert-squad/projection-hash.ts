import { createHash } from "node:crypto"

export const ProjectionHashDomain = {
  catalogDeclaration: "opencorvus.expert-squad.catalog-declaration.v1",
  scheduler: "opencorvus.expert-squad.scheduler-projection.v1",
  worker: "opencorvus.expert-squad.worker-projection.v1",
  productionSkills: "opencorvus.expert-squad.production-skill-projection.v1",
  activeAgents: "opencorvus.expert-squad.active-agent-projection.v1",
  selector: "opencorvus.expert-squad.selector-projection.v1",
} as const

export type ProjectionHashDomain = (typeof ProjectionHashDomain)[keyof typeof ProjectionHashDomain]

export function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function canonicalJSON(value: unknown, context: string): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${context} contains a non-finite number`)
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) throw new Error(`${context}[${index}] is a sparse array hole`)
    }
    return `[${value.map((item, index) => canonicalJSON(item, `${context}[${index}]`)).join(",")}]`
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${context} contains a non-plain object`)
    }
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareCanonicalStrings(left, right))
      .map(([key, item]) => {
        if (item === undefined) throw new Error(`${context}.${key} is undefined`)
        return `${JSON.stringify(key)}:${canonicalJSON(item, `${context}.${key}`)}`
      })
      .join(",")}}`
  }
  throw new Error(`${context} contains unsupported ${typeof value} data`)
}

export function canonicalProjectionHash(domain: ProjectionHashDomain, payload: unknown): string {
  return createHash("sha256")
    .update(canonicalJSON({ domain, payload }, domain))
    .digest("hex")
}

export function canonicalStringSet(values: readonly string[], context: string): string[] {
  if (new Set(values).size !== values.length) throw new Error(`${context} contains duplicate values`)
  return [...values].sort(compareCanonicalStrings)
}

export function textSHA256(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}
