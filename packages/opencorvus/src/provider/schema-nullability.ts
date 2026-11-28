import Ajv, { type AnySchema } from "ajv"
import Ajv2019 from "ajv/dist/2019"
import Ajv2020 from "ajv/dist/2020"

const ROOT_KEY = "urn:opencorvus:tool-input"
const contexts = new WeakMap<object, ReturnType<typeof createContext>>()

/** Test the complete original constraint, keeping references in their original root. */
export function schemaAllowsNull(schema: unknown, root: unknown): boolean {
  if (typeof schema === "boolean") return schema
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return false
  const record = schema as Record<string, unknown>
  // A non-null type alone excludes null, regardless of the remaining constraints.
  if (
    record.type !== undefined &&
    record.type !== "null" &&
    !(Array.isArray(record.type) && record.type.includes("null")) &&
    record.nullable !== true &&
    !("$ref" in record) &&
    !("$dynamicRef" in record) &&
    !("$recursiveRef" in record)
  )
    return false
  if (!root || typeof root !== "object" || Array.isArray(root)) {
    throw new Error("Tool input nullability requires an original schema root")
  }
  let context = contexts.get(root)
  if (!context) {
    context = createContext(root)
    contexts.set(root, context)
  }
  const cached = context.results.get(schema)
  if (cached !== undefined) return cached
  const pointer = context.pointers.get(schema)
  if (pointer === undefined) throw new Error("Tool input constraint is outside its original schema root")
  const validate = context.ajv.getSchema(ROOT_KEY + "#" + pointer)
  if (!validate) throw new Error("Tool input constraint could not be compiled at " + pointer)
  const result = validate(null) === true
  context.results.set(schema, result)
  return result
}

function createContext(root: object) {
  const dialect = "$schema" in root ? root.$schema : undefined
  const Validator =
    dialect === "https://json-schema.org/draft/2020-12/schema"
      ? Ajv2020
      : dialect === "https://json-schema.org/draft/2019-09/schema"
        ? Ajv2019
        : Ajv
  const ajv = new Validator({ strict: false, validateFormats: false })
  ajv.addSchema(root as AnySchema, ROOT_KEY)
  const pointers = new WeakMap<object, string>()
  function index(value: unknown, pointer: string) {
    if (!value || typeof value !== "object" || pointers.has(value)) return
    pointers.set(value, pointer)
    for (const [key, child] of Object.entries(value)) {
      index(child, pointer + "/" + encodeURIComponent(key.replaceAll("~", "~0").replaceAll("/", "~1")))
    }
  }
  index(root, "")
  return { ajv, pointers, results: new WeakMap<object, boolean>() }
}
