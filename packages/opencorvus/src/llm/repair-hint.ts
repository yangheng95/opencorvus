/**
 * Tool-call repair: discriminated-union legal-value enumeration.
 *
 * zod4 `z.discriminatedUnion` rejection produces a single issue
 * `{ code:"invalid_union", note:"No matching discriminator", discriminator,
 *   path }` that does NOT carry the legal discriminator values. The AI SDK
 * relays that opaque JSON verbatim, so the model cannot self-correct and
 * loops byte-for-byte (session repair-hint loop record
 * 2026-05-19-goal-contract-tool-schema-single-source §6; observed in architect `register_contract`,
 * task tsk_e3f3a5e13001sIKjGs1nVHLkBD: 9 failures, last 6 byte-identical,
 * task wedged).
 *
 * These helpers pull the legal values straight from the tool's own JSON
 * Schema — the single source (CLAUDE.md rule 8) — so the repair channel can
 * throw a self-correcting tool-error (rule 6.1: the schema stays the only
 * data gate; the host merely translates the gate's rejection into the
 * allowed values). They are extracted from `session/llm.ts` so the behaviour
 * is unit-testable (rule 36) without driving a live stream.
 *
 * IR = intermediate representation; disc = discriminator.
 */
import { InvalidToolInputError } from "ai"
import type { ToolCallRepairFunction, ToolSet } from "ai"

export type JsonSchemaNode = Record<string, any>

/** Walk the error `cause` chain to the first object exposing Zod `issues[]`.
 *  Chain-shape tolerant (InvalidToolInputError → TypeValidationError →
 *  ZodError) so it survives AI-SDK minor-version drift. */
export function zodIssuesFromError(err: unknown): any[] | undefined {
  let e: any = err
  const seen = new Set<unknown>()
  while (e && typeof e === "object" && !seen.has(e)) {
    seen.add(e)
    if (Array.isArray(e.issues)) return e.issues
    e = e.cause
  }
  return undefined
}

/** Resolve a `$ref` ("#/$defs/X" | "#/definitions/X") against the root doc. */
function derefSchema(node: any, root: JsonSchemaNode, depth = 0): JsonSchemaNode | undefined {
  if (!node || typeof node !== "object" || depth > 12) return node
  const ref = node.$ref
  if (typeof ref === "string") {
    const m = ref.match(/^#\/(\$defs|definitions)\/(.+)$/)
    if (m) {
      const bucket = (root as any)[m[1]] as Record<string, any> | undefined
      const target = bucket?.[decodeURIComponent(m[2])]
      if (target) return derefSchema(target, root, depth + 1)
    }
  }
  return node
}

/** Pick the discriminated-union branch matching `value` by any literal
 *  (`const`/`enum`) property — generic, not hard-coded to a "kind" key. */
function pickUnionBranch(branches: any[], value: unknown, root: JsonSchemaNode): JsonSchemaNode | undefined {
  if (!value || typeof value !== "object") return undefined
  for (const raw of branches) {
    const b = derefSchema(raw, root)
    const props = b?.properties as Record<string, any> | undefined
    if (!props) continue
    for (const [key, rawProp] of Object.entries(props)) {
      const prop = derefSchema(rawProp, root)
      if (!prop) continue
      const v = (value as any)[key]
      if ("const" in prop && prop.const === v) return b
      if (Array.isArray(prop.enum) && prop.enum.includes(v)) return b
    }
  }
  return undefined
}

function valueAtPath(obj: unknown, path: (string | number)[]): unknown {
  let v: any = obj
  for (const seg of path) {
    if (v == null) return undefined
    v = v[seg as any]
  }
  return v
}

/** From a tool's JSON Schema + the failing `invalid_union` issue + the model's
 *  submitted input, derive the legal discriminator values at the failure site.
 *  Returns undefined (no fabrication — rule 1) when it cannot be derived; the
 *  caller then preserves the original SDK behaviour. */
export function discriminatorRepairHint(
  schema: JsonSchemaNode,
  issue: { path?: (string | number)[]; discriminator?: unknown },
  input: unknown,
): { at: string; field: string; values: unknown[]; supplied: unknown } | undefined {
  const path = Array.isArray(issue.path) ? issue.path : []
  if (path.length === 0) return undefined
  const disc = typeof issue.discriminator === "string" ? issue.discriminator : String(path[path.length - 1])
  const containerPath = path.slice(0, -1)

  let node: any = derefSchema(schema, schema)
  let val: any = input
  for (const seg of containerPath) {
    let guard = 0
    while (node && (Array.isArray(node.anyOf) || Array.isArray(node.oneOf)) && guard++ < 12) {
      const branch = pickUnionBranch(node.anyOf ?? node.oneOf, val, schema)
      if (!branch) break
      node = derefSchema(branch, schema)
    }
    if (!node) return undefined
    if (typeof seg === "number") {
      node = derefSchema(node.items, schema)
      val = Array.isArray(val) ? val[seg] : undefined
    } else {
      node = derefSchema(node.properties?.[seg], schema)
      val = val && typeof val === "object" ? (val as any)[seg] : undefined
    }
    if (!node) return undefined
  }

  const branches = node?.anyOf ?? node?.oneOf
  if (!Array.isArray(branches)) return undefined
  const values: unknown[] = []
  for (const raw of branches) {
    const b = derefSchema(raw, schema)
    const prop = b?.properties ? derefSchema(b.properties[disc], schema) : undefined
    if (!prop) continue
    if ("const" in prop) values.push(prop.const)
    else if (Array.isArray(prop.enum)) values.push(...prop.enum)
  }
  const unique = [...new Map(values.map((v) => [JSON.stringify(v), v])).values()]
  if (unique.length === 0) return undefined
  return { at: path.join("."), field: disc, values: unique, supplied: valueAtPath(input, path) }
}

/**
 * The single tool-call repair function for every `streamText` call.
 *
 * Installed once at the `@/llm/api` streamText wrapper so EVERY agent and
 * direct LLM call with tools (architect, orchestrator, build, integrity, …)
 * gets identical behaviour. Per-call injection
 * was the structural cause of the rule-35 gap: any new `streamText` caller
 * that forgot to wire repair silently reverted to the opaque-`invalid_union`
 * death loop. A wrapper-level
 * single source (rule 8) makes that omission structurally impossible.
 *
 * Two — and only two — repairs:
 *  1. Case-normalize a model-emitted tool name ("Register_X" → "register_x").
 *     Any other mismatch must surface to the model as a real tool-error so it
 *     can retry; rewriting to a sentinel "invalid" tool was a fallback
 *     (rule 1) that hid the error and trapped the model with no feedback path.
 *  2. Discriminated-union rejection: zod4's `invalid_union` issue carries no
 *     legal values, and returning null relays that opaque JSON verbatim — the
 *     model then guesses schema-external values forever (architect
 *     register_contract: 9 failures, last 6 byte-identical, task wedged; spec
 *     session repair-hint loop record §6). The schema stays the sole data gate
 *     (rule 6.1); we only translate the gate's rejection into the allowed
 *     values, pulled live from the tool's own JSON Schema (rule 8 — no second
 *     source). Thrown here → SDK wraps it as ToolCallRepairError whose message
 *     reaches the model as a readable tool-error, so it self-corrects.
 *
 * Plain Zod errors (min/length/type) already carry enough text — they fall
 * through to `return null` and keep the native SDK tool-error behaviour.
 */
export function createToolCallRepair(
  tools: ToolSet,
  log?: { info: (message: string, extra?: Record<string, unknown>) => void },
): ToolCallRepairFunction<ToolSet> {
  return async (failed) => {
    const lower = failed.toolCall.toolName.toLowerCase()
    if (lower !== failed.toolCall.toolName && tools[lower]) {
      log?.info("repairing tool call", { tool: failed.toolCall.toolName, repaired: lower })
      return { ...failed.toolCall, toolName: lower }
    }
    if (InvalidToolInputError.isInstance(failed.error)) {
      const issues = zodIssuesFromError(failed.error)
      const union = issues?.find((it) => it && typeof it === "object" && it.code === "invalid_union")
      if (union && Array.isArray(union.path) && union.path.length > 0) {
        let jsonSchema: JsonSchemaNode | undefined
        try {
          jsonSchema = (await failed.inputSchema({ toolName: failed.toolCall.toolName })) as JsonSchemaNode
        } catch {
          jsonSchema = undefined
        }
        let submitted: unknown
        try {
          submitted = JSON.parse(failed.toolCall.input)
        } catch {
          submitted = undefined
        }
        const hint = jsonSchema ? discriminatorRepairHint(jsonSchema, union, submitted) : undefined
        if (hint) {
          log?.info("repair: enumerating discriminator legal values", {
            tool: failed.toolCall.toolName,
            at: hint.at,
            values: hint.values,
          })
          throw new Error(
            `Schema rejected this ${failed.toolCall.toolName} call: the ` +
              `discriminator field "${hint.at}" must be exactly one of ` +
              `${hint.values.map((v) => JSON.stringify(v)).join(" | ")}, ` +
              `but you sent ${JSON.stringify(hint.supplied)}. Reissue the ` +
              `call with "${hint.field}" set to one of those exact values, ` +
              `then include the fields that the chosen variant requires.`,
          )
        }
      }
    }
    // Could not repair — SDK emits a native tool-error the model reads/retries.
    return null
  }
}
