import z from "zod"

const unknownOpenReason = /\b(tbd|unknown|unsure|unclear|n\/a|todo)\b/i

export const ValueDomainSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z
      .literal("open")
      .describe(
        "open — value is an unconstrained instance of typeExpr. Requires a concrete reason (TBD/unknown rejected).",
      ),
    reason: z
      .string()
      .refine((value) => value.trim().length > 0, {
        message: "open valueDomain requires a concrete reason",
      })
      .refine((value) => !unknownOpenReason.test(value), {
        message: "open valueDomain requires a concrete reason; unknown/TBD is not a valid domain",
      }),
  }).strict(),
  z.object({
    kind: z
      .literal("literal_union")
      .describe("literal_union — a closed set of string literals. Requires values (>=1)."),
    values: z.array(z.string().min(1)).min(1),
  }).strict(),
  z.object({
    kind: z
      .literal("branded")
      .describe(
        "branded — a nominal/opaque type such as a branded id or ISO date string. Requires brand and examples (>=1).",
      ),
    brand: z.string().min(1),
    examples: z.array(z.string().min(1)).min(1),
  }).strict(),
  z
    .object({
      kind: z.literal("numeric_range").describe("numeric_range — a bounded number. Requires min and/or max."),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .strict()
    .refine((value) => value.min !== undefined || value.max !== undefined, {
      message: "numeric_range requires min or max",
    }),
  z.object({
    kind: z.literal("ref").describe("ref — value is governed by another contract. Requires contractName."),
    contractName: z.string().min(1),
  }).strict(),
])

export type ValueDomain = z.infer<typeof ValueDomainSchema>

export const TypeSpecSchema = z.object({
  typeExpr: z.string().min(1),
  valueDomain: ValueDomainSchema,
  semantic: z.string().min(1).optional(),
}).strict()
export type TypeSpec = z.infer<typeof TypeSpecSchema>

export const FieldSpecSchema = TypeSpecSchema.extend({
  name: z.string().min(1),
})
export type FieldSpec = z.infer<typeof FieldSpecSchema>

export const ContractIRSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z
      .literal("type")
      .describe(
        "type — object/interface contract. Requires name and fields[] (typeExpr, valueDomain, optional semantic). ir.kind must equal the graph contract kind.",
      ),
    name: z.string().min(1),
    fields: z.array(FieldSpecSchema).min(1),
  }).strict(),
  z.object({
    kind: z
      .literal("function")
      .describe(
        "function — callable contract. Requires name, params (FieldSpec[]), returns (TypeSpec). ir.kind must equal the graph contract kind.",
      ),
    name: z.string().min(1),
    params: z.array(FieldSpecSchema),
    returns: TypeSpecSchema,
  }).strict(),
  z.object({
    kind: z
      .literal("enum")
      .describe(
        "enum — closed enumeration. Requires name and variants[] (value + meaning). ir.kind must equal the graph contract kind.",
      ),
    name: z.string().min(1),
    variants: z
      .array(
        z.object({
          value: z.string().min(1),
          meaning: z.string().min(1),
        }).strict(),
      )
      .min(1),
  }).strict(),
])

export type ContractIR = z.infer<typeof ContractIRSchema>
export type ContractCategory = "type_contract" | "function_contract" | "enum_contract"

export interface AuditEligibleField {
  contractName: string
  fieldName: string
  expectedValues: string[]
}

export function contractCategory(ir: ContractIR): ContractCategory {
  if (ir.kind === "type") return "type_contract"
  if (ir.kind === "function") return "function_contract"
  return "enum_contract"
}

export function auditEligibleFieldsForSymbols(input: {
  index: Map<string, ContractIR>
  symbols: readonly string[]
}): AuditEligibleField[] {
  const fields: AuditEligibleField[] = []
  for (const symbol of input.symbols) {
    const contract = input.index.get(symbol)
    if (!contract) continue
    if (contract.kind === "type") {
      for (const field of contract.fields) {
        const values = closedStringValuesForValueDomain(field.valueDomain, input.index)
        if (values) fields.push({ contractName: contract.name, fieldName: field.name, expectedValues: values })
      }
      continue
    }
    if (contract.kind === "function") {
      for (const param of contract.params) {
        const values = closedStringValuesForValueDomain(param.valueDomain, input.index)
        if (values) fields.push({ contractName: contract.name, fieldName: param.name, expectedValues: values })
      }
      const returnValues = closedStringValuesForValueDomain(contract.returns.valueDomain, input.index)
      if (returnValues) fields.push({ contractName: contract.name, fieldName: "return", expectedValues: returnValues })
    }
  }
  return fields
}

export function auditEligibleSymbols(input: { index: Map<string, ContractIR>; symbols: readonly string[] }): string[] {
  return input.symbols.filter(
    (symbol) => auditEligibleFieldsForSymbols({ index: input.index, symbols: [symbol] }).length > 0,
  )
}

export function closedStringValuesForValueDomain(
  domain: ValueDomain,
  index: Map<string, ContractIR>,
): string[] | undefined {
  if (domain.kind === "literal_union") return domain.values
  if (domain.kind === "ref")
    return closedStringValuesFromContract(index.get(domain.contractName), index, new Set([domain.contractName]))
  if (domain.kind === "branded")
    return closedStringValuesFromContract(index.get(domain.brand), index, new Set([domain.brand]))
  return undefined
}

function closedStringValuesFromContract(
  contract: ContractIR | undefined,
  index: Map<string, ContractIR>,
  resolving: Set<string>,
): string[] | undefined {
  if (!contract) return undefined
  if (contract.kind === "enum") return contract.variants.map((variant) => variant.value)
  if (contract.kind === "type" && contract.fields.length === 1) {
    return closedStringValuesFromValueDomainWithCycleGuard(contract.fields[0].valueDomain, index, resolving)
  }
  return undefined
}

function closedStringValuesFromValueDomainWithCycleGuard(
  domain: ValueDomain,
  index: Map<string, ContractIR>,
  resolving: Set<string>,
): string[] | undefined {
  if (domain.kind === "literal_union") return domain.values
  if (domain.kind !== "ref" && domain.kind !== "branded") return undefined
  const contractName = domain.kind === "ref" ? domain.contractName : domain.brand
  if (resolving.has(contractName)) return undefined
  resolving.add(contractName)
  return closedStringValuesFromContract(index.get(contractName), index, resolving)
}

export function renderContractIR(ir: ContractIR): string {
  const lines: string[] = []
  if (ir.kind === "type") {
    lines.push(`type ${ir.name}`)
    for (const field of ir.fields) {
      lines.push(
        `- ${field.name}: ${field.typeExpr}; domain=${renderValueDomain(field.valueDomain)}${field.semantic ? `; semantic=${field.semantic}` : ""}`,
      )
    }
    return lines.join("\n")
  }
  if (ir.kind === "function") {
    lines.push(`function ${ir.name}`)
    lines.push("params:")
    for (const param of ir.params) {
      lines.push(
        `- ${param.name}: ${param.typeExpr}; domain=${renderValueDomain(param.valueDomain)}${param.semantic ? `; semantic=${param.semantic}` : ""}`,
      )
    }
    lines.push(
      `returns: ${ir.returns.typeExpr}; domain=${renderValueDomain(ir.returns.valueDomain)}${ir.returns.semantic ? `; semantic=${ir.returns.semantic}` : ""}`,
    )
    return lines.join("\n")
  }
  lines.push(`enum ${ir.name}`)
  for (const variant of ir.variants) {
    lines.push(`- ${variant.value}: ${variant.meaning}`)
  }
  return lines.join("\n")
}

function renderValueDomain(domain: ValueDomain): string {
  if (domain.kind === "open") return `open(reason=${domain.reason})`
  if (domain.kind === "literal_union")
    return `literal_union(${domain.values.map((value) => JSON.stringify(value)).join(" | ")})`
  if (domain.kind === "branded")
    return `branded(${domain.brand}; examples=${domain.examples.map((value) => JSON.stringify(value)).join(", ")})`
  if (domain.kind === "numeric_range") return `numeric_range(min=${domain.min ?? "-inf"}, max=${domain.max ?? "+inf"})`
  return `ref(${domain.contractName})`
}
