import z from "zod"
import { ContractIRSchema, renderContractIR, type ContractIR } from "./contract-ir"

export const ArchitectContractKindSchema = z.enum([
  "type",
  "function",
  "enum",
  "component",
  "route",
  "static_data",
  "render_surface",
  "behavior_inventory",
])
export type ArchitectContractKind = z.infer<typeof ArchitectContractKindSchema>

export const RouteContractSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  request: z.string().min(1).optional(),
  response: z.string().min(1).optional(),
}).strict()
export type RouteContract = z.infer<typeof RouteContractSchema>

export const ComponentContractSchema = z.object({
  props: z
    .string()
    .min(1)
    .describe("Comma-separated public prop names or prop signatures, for example: title, items, onSelect.")
    .optional(),
  events: z.array(z.string().min(1)).describe("Event names emitted by the component.").default([]),
  slots: z.array(z.string().min(1)).describe("Named content slots exposed by the component.").default([]),
}).strict()
export type ComponentContract = z.infer<typeof ComponentContractSchema>

export const ArchitectContractRefSchema = z
  .object({
    id: z.string().min(1),
    kind: ArchitectContractKindSchema,
    name: z.string().min(1),
    producer_goal_id: z.string().min(1),
    consumer_goal_ids: z.array(z.string().min(1)).default([]),
    summary: z.string().min(1),
    ir: ContractIRSchema.optional(),
    route: RouteContractSchema.optional(),
    component: ComponentContractSchema.optional(),
    artifact_paths: z.array(z.string().min(1)).default([]),
    evidence_refs: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const typed = value.kind === "type" || value.kind === "function" || value.kind === "enum"
    if (typed && !value.ir) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ir"],
        message: `${value.kind} contract requires ir`,
      })
    }
    if (!typed && value.ir) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ir"],
        message: `${value.kind} contract must not carry ContractIR`,
      })
    }
    if (value.ir && value.ir.kind !== value.kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ir", "kind"],
        message: `ContractIR kind ${value.ir.kind} must match graph kind ${value.kind}`,
      })
    }
  })
export type ArchitectContractRef = z.infer<typeof ArchitectContractRefSchema>

export const ArchitectContractGraphSchema = z
  .object({
    contracts: z.array(ArchitectContractRefSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    const firstIndexByID = new Map<string, number>()
    value.contracts.forEach((contract, index) => {
      const firstIndex = firstIndexByID.get(contract.id)
      if (firstIndex === undefined) {
        firstIndexByID.set(contract.id, index)
        return
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contracts", index, "id"],
        message: `Contract id ${contract.id} duplicates contracts[${firstIndex}].id`,
      })
    })
  })
export type ArchitectContractGraph = z.infer<typeof ArchitectContractGraphSchema>

export function emptyArchitectContractGraph(): ArchitectContractGraph {
  return { contracts: [] }
}

export function parseArchitectContractGraph(input: unknown): ArchitectContractGraph {
  return ArchitectContractGraphSchema.parse(input ?? emptyArchitectContractGraph())
}

export function contractGraphIRIndex(graph: ArchitectContractGraph): Map<string, ContractIR> {
  return new Map(
    graph.contracts
      .filter((contract): contract is ArchitectContractRef & { ir: ContractIR } => !!contract.ir)
      .flatMap((contract) => [[contract.id, contract.ir] as const, [contract.name, contract.ir] as const]),
  )
}

export function remapArchitectContractGraphGoalIDs(
  graph: ArchitectContractGraph,
  mapGoalID: (goalID: string) => string | undefined,
): ArchitectContractGraph {
  const remap = (goalID: string) => {
    const mapped = mapGoalID(goalID)
    if (!mapped) throw new Error(`Architect contract graph references unmapped goal id: ${goalID}`)
    return mapped
  }
  return {
    contracts: graph.contracts.map((contract) => ({
      ...contract,
      producer_goal_id: remap(contract.producer_goal_id),
      consumer_goal_ids: contract.consumer_goal_ids.map(remap),
    })),
  }
}

export function renderContractGraphForPrompt(graph: ArchitectContractGraph, goalID?: string): string {
  const contracts = goalID
    ? graph.contracts.filter(
        (contract) => contract.producer_goal_id === goalID || contract.consumer_goal_ids.includes(goalID),
      )
    : graph.contracts
  const lines: string[] = []
  lines.push("## Contract Graph")
  if (contracts.length === 0) {
    lines.push("No graph contracts registered for this scope.")
  } else {
    for (const contract of contracts) {
      lines.push(
        `- ${contract.id} [${contract.kind}] ${contract.name}: producer=${contract.producer_goal_id}; consumers=${contract.consumer_goal_ids.join(", ") || "(none)"}; ${contract.summary}`,
      )
      if (contract.ir) lines.push(indent(renderContractIR(contract.ir), "  "))
      if (contract.route) lines.push(`  route ${contract.route.method} ${contract.route.path}`)
      if (contract.component) lines.push(`  component props=${contract.component.props ?? "(unspecified)"}`)
      if ((contract.artifact_paths ?? []).length > 0)
        lines.push(`  artifacts=${(contract.artifact_paths ?? []).join(", ")}`)
      if ((contract.evidence_refs ?? []).length > 0)
        lines.push(`  evidence_refs=${(contract.evidence_refs ?? []).join(", ")}`)
    }
  }
  return lines.join("\n")
}

export function graphContractsForGoal(
  graph: ArchitectContractGraph,
  goalID: string,
): {
  produced: ArchitectContractRef[]
  consumed: ArchitectContractRef[]
} {
  return {
    produced: graph.contracts.filter((contract) => contract.producer_goal_id === goalID),
    consumed: graph.contracts.filter((contract) => contract.consumer_goal_ids.includes(goalID)),
  }
}

function indent(value: string, prefix: string): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n")
}
