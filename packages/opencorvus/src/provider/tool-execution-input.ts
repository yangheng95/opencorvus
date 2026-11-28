import { asSchema } from "ai"

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
  schema = resolveLocalReference(schema, root)
  const selected = selectJsonSchemaVariant(schema, value, root)
  if (selected.schema !== schema) {
    return materializeFromJsonSchema(selected.schema, value, root, selected.unionProperties)
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return value
  const record = schema as Record<string, unknown>
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
    if (propertySchema === undefined && providerUnionProperties?.has(key)) continue
    if (
      item === null &&
      propertySchema !== undefined &&
      !required.has(key) &&
      !jsonSchemaAllowsNull(propertySchema, root)
    ) {
      continue
    }
    out[key] = propertySchema !== undefined ? materializeFromJsonSchema(propertySchema, item, root) : item
  }
  return out
}

function selectJsonSchemaVariant(
  schema: unknown,
  value: unknown,
  root: unknown,
): { schema: unknown; unionProperties?: ReadonlySet<string> } {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return { schema }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { schema }
  const record = schema as Record<string, unknown>
  const union = Array.isArray(record.anyOf) ? record.anyOf : Array.isArray(record.oneOf) ? record.oneOf : undefined
  if (!union) return { schema }
  const variants = objectUnionVariants(union, root)
  const valueRecord = value as Record<string, unknown>
  const unionProperties = new Set<string>()
  for (const rawVariant of variants) {
    const variant = resolveLocalReference(rawVariant, root)
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) continue
    const properties = (variant as Record<string, unknown>).properties
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) continue
    for (const key of Object.keys(properties as Record<string, unknown>)) unionProperties.add(key)
  }
  for (const rawVariant of variants) {
    const variant = resolveLocalReference(rawVariant, root)
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) continue
    const variantRecord = variant as Record<string, unknown>
    const properties = variantRecord.properties
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) continue
    const required = new Set(
      Array.isArray(variantRecord.required) ? variantRecord.required.filter((item) => typeof item === "string") : [],
    )
    let matchedConst = false
    let mismatched = false
    for (const [key, rawPropertySchema] of Object.entries(properties as Record<string, unknown>)) {
      const propertySchema = resolveLocalReference(rawPropertySchema, root)
      if (!propertySchema || typeof propertySchema !== "object" || Array.isArray(propertySchema)) continue
      if (!("const" in propertySchema) || !required.has(key)) continue
      matchedConst = true
      if (valueRecord[key] !== (propertySchema as Record<string, unknown>).const) {
        mismatched = true
        break
      }
    }
    if (matchedConst && !mismatched) return { schema: variant, unionProperties }
  }
  const structuralMatches = variants.filter((rawVariant) => {
    const variant = resolveLocalReference(rawVariant, root)
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) return false
    const candidate = variant as Record<string, unknown>
    if (
      candidate.type !== "object" ||
      candidate.additionalProperties !== false ||
      !candidate.properties ||
      typeof candidate.properties !== "object" ||
      Array.isArray(candidate.properties)
    )
      return false
    const properties = candidate.properties as Record<string, unknown>
    const required = Array.isArray(candidate.required) ? candidate.required : []
    for (const key of required) {
      if (typeof key !== "string" || !Object.hasOwn(valueRecord, key)) return false
      const property = resolveLocalReference(properties[key], root)
      if (property && typeof property === "object" && "const" in property && valueRecord[key] !== property.const)
        return false
      if (valueRecord[key] === null && !jsonSchemaAllowsNull(properties[key], root)) return false
    }
    return Object.entries(valueRecord).every(
      ([key, item]) => Object.hasOwn(properties, key) || (item === null && unionProperties.has(key)),
    )
  })
  if (structuralMatches.length === 1) {
    return { schema: resolveLocalReference(structuralMatches[0], root), unionProperties }
  }
  return { schema }
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
    if (!nested || active.has(variant)) return []
    active.add(variant)
    const objects = objectUnionVariants(nested, root, active)
    active.delete(variant)
    return objects
  })
}

function jsonSchemaAllowsNull(schema: unknown, root: unknown, visited = new Set<unknown>()): boolean {
  schema = resolveLocalReference(schema, root)
  if (visited.has(schema)) return false
  visited.add(schema)
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return false
  const record = schema as Record<string, unknown>
  if (record.type === "null") return true
  if (Array.isArray(record.type) && record.type.includes("null")) return true
  return (
    (Array.isArray(record.anyOf) && record.anyOf.some((item) => jsonSchemaAllowsNull(item, root, visited))) ||
    (Array.isArray(record.oneOf) && record.oneOf.some((item) => jsonSchemaAllowsNull(item, root, visited)))
  )
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
