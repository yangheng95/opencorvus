import { asSchema } from "ai"
import { schemaAcceptsValue, schemaAllowsNull } from "./schema-nullability"

export function materializeToolExecutionInput(inputSchema: unknown, args: unknown): unknown {
  const rawJsonSchema = asSchema(inputSchema as never).jsonSchema
  return materializeFromJsonSchema(rawJsonSchema, unwrapRootUnionEnvelope(rawJsonSchema, args), rawJsonSchema)
}

function unwrapRootUnionEnvelope(schema: unknown, value: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return value
  const record = schema as Record<string, unknown>
  if (record.type !== undefined || (!Array.isArray(record.anyOf) && !Array.isArray(record.oneOf))) return value
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const entries = Object.entries(value as Record<string, unknown>)
  return entries.length === 1 && entries[0]?.[0] === "operation" ? entries[0][1] : value
}

function materializeFromJsonSchema(
  schema: unknown,
  value: unknown,
  root: unknown,
  providerUnionProperties?: ReadonlySet<string>,
): unknown {
  const constraint = schema
  schema = resolveLocalReference(schema, root)
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return value
  const record = schema as Record<string, unknown>
  const union = Array.isArray(record.anyOf) ? record.anyOf : Array.isArray(record.oneOf) ? record.oneOf : undefined
  if (union && value && typeof value === "object" && !Array.isArray(value)) {
    return materializeObjectUnion(constraint, union, value, root)
  }
  if (record.type === "array" && Array.isArray(value)) {
    return value.map((item) => materializeFromJsonSchema(record.items, item, root))
  }
  const properties = record.properties
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) return value
  if (!value || typeof value !== "object" || Array.isArray(value)) return value

  const required = new Set(
    Array.isArray(record.required) ? record.required.filter((item) => typeof item === "string") : [],
  )
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const propertySchema = (properties as Record<string, unknown>)[key]
    if (
      item === null &&
      propertySchema === undefined &&
      record.additionalProperties === false &&
      providerUnionProperties?.has(key)
    )
      continue
    if (
      item === null &&
      propertySchema !== undefined &&
      !required.has(key) &&
      !schemaAllowsNull(propertySchema, root)
    ) {
      continue
    }
    out[key] = propertySchema !== undefined ? materializeFromJsonSchema(propertySchema, item, root) : item
  }
  return out
}

function materializeObjectUnion(schema: unknown, union: unknown[], value: unknown, root: unknown): unknown {
  const variants = objectUnionVariants(union, root)
  if (schemaAcceptsValue(schema, value, root)) return value
  const unionProperties = new Set<string>()
  for (const variant of variants) {
    for (const key of Object.keys(variant.properties as Record<string, unknown>)) unionProperties.add(key)
  }
  const candidates = variants
    .map((variant) => materializeFromJsonSchema(variant, value, root, unionProperties))
    .filter((candidate) => schemaAcceptsValue(schema, candidate, root))
  // Equivalent results are interchangeable. Incomparable removals retain the original
  // input so the canonical validator, rather than declaration order, owns the error.
  return candidates.find((candidate) => candidates.every((other) => preservesValues(candidate, other))) ?? value
}

function preservesValues(value: unknown, other: unknown): boolean {
  if (Object.is(value, other)) return true
  if (Array.isArray(value) || Array.isArray(other)) {
    return (
      Array.isArray(value) &&
      Array.isArray(other) &&
      value.length === other.length &&
      other.every((item, index) => preservesValues(value[index], item))
    )
  }
  if (!value || typeof value !== "object" || !other || typeof other !== "object") return false
  return Object.entries(other).every(
    ([key, item]) => Object.hasOwn(value, key) && preservesValues((value as Record<string, unknown>)[key], item),
  )
}

function objectUnionVariants(
  variants: unknown[],
  root: unknown,
  active = new Set<unknown>(),
): Record<string, unknown>[] {
  return variants.flatMap((rawVariant) => {
    const variant = resolveLocalReference(rawVariant, root)
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) return []
    const record = variant as Record<string, unknown>
    if (record.type === "object" && record.properties && typeof record.properties === "object") return [record]
    const nested = Array.isArray(record.anyOf) ? record.anyOf : Array.isArray(record.oneOf) ? record.oneOf : undefined
    if (!nested) return []
    if (active.has(variant)) {
      throw new Error("Tool input schema has a recursive union without advancing the input location")
    }
    active.add(variant)
    const objects = objectUnionVariants(nested, root, active)
    active.delete(variant)
    return objects
  })
}

/** Resolve local JSON Pointers against the original schema, never a selected branch. */
function resolveLocalReference(schema: unknown, root: unknown): unknown {
  const visited = new Set<string>()
  while (schema && typeof schema === "object" && !Array.isArray(schema) && "$ref" in schema) {
    const ref = (schema as Record<string, unknown>).$ref
    if (typeof ref !== "string" || (ref !== "#" && !ref.startsWith("#/")) || visited.has(ref)) {
      throw new Error(`Tool input schema has an invalid local reference ${JSON.stringify(ref)}`)
    }
    visited.add(ref)
    let target = root
    const segments =
      ref === "#"
        ? []
        : ref
            .slice(2)
            .split("/")
            .map((part) => decodeURIComponent(part).replace(/~1/g, "/").replace(/~0/g, "~"))
    for (const segment of segments) {
      if (!target || typeof target !== "object" || !Object.hasOwn(target, segment)) {
        throw new Error(`Tool input schema reference ${JSON.stringify(ref)} does not resolve`)
      }
      target = (target as Record<string, unknown>)[segment]
    }
    schema = target
  }
  return schema
}
