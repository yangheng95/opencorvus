import { createHash } from "node:crypto"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const CanonicalDigestContractError = NamedError.create(
  "CanonicalDigestContractError",
  z.object({
    context: z.string(),
    reason: z.string(),
  }),
)

export type CanonicalDigestSource = {
  bytes: string
  sha256: string
}

export function containsRuntimeCapability(value: unknown, active = new Set<object>()): boolean {
  if (typeof value === "function") return true
  if (value === null || typeof value !== "object") return false
  if (active.has(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) return true
  active.add(value)
  try {
    if (Array.isArray(value)) return value.some((item) => containsRuntimeCapability(item, active))
    return Object.values(value as Record<string, unknown>).some((item) => containsRuntimeCapability(item, active))
  } finally {
    active.delete(value)
  }
}

export function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function canonicalDigestSource(domain: string, payload: unknown): CanonicalDigestSource {
  const active = new Set<object>()
  const bytes = canonicalJSON({ domain, payload }, domain, active)
  return {
    bytes,
    sha256: createHash("sha256").update(bytes, "utf8").digest("hex"),
  }
}

export function sha256Text(domain: string, value: string): string {
  return canonicalDigestSource(domain, value).sha256
}

/** Serialize one JSON value with recursively sorted object keys. */
export function canonicalJSONValue(value: unknown, context = "canonical-json"): string {
  return canonicalJSON(value, context, new Set<object>())
}

function canonicalJSON(value: unknown, context: string, active: Set<object>): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw contractError(context, "non-finite number")
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    if (active.has(value)) throw contractError(context, "cycle")
    active.add(value)
    try {
      for (let index = 0; index < value.length; index++) {
        if (!Object.hasOwn(value, index)) throw contractError(`${context}[${index}]`, "sparse array hole")
      }
      return `[${value.map((item, index) => canonicalJSON(item, `${context}[${index}]`, active)).join(",")}]`
    } finally {
      active.delete(value)
    }
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>
    const prototype = Object.getPrototypeOf(object)
    if (prototype !== Object.prototype && prototype !== null) throw contractError(context, "non-plain object")
    if (active.has(object)) throw contractError(context, "cycle")
    active.add(object)
    try {
      return `{${Object.entries(object)
        .sort(([left], [right]) => compareCanonicalStrings(left, right))
        .map(([key, item]) => {
          if (item === undefined) throw contractError(`${context}.${key}`, "undefined")
          return `${JSON.stringify(key)}:${canonicalJSON(item, `${context}.${key}`, active)}`
        })
        .join(",")}}`
    } finally {
      active.delete(object)
    }
  }
  throw contractError(context, `unsupported ${typeof value}`)
}

function contractError(context: string, reason: string) {
  return new CanonicalDigestContractError({ context, reason })
}
