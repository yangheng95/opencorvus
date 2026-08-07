/**
 * Zod-validated tool calls for the Architect Agent.
 *
 * The Architect is the authoritative goal decomposer: it registers goals,
 * requirement-derived acceptance coverage, fidelity coverage, assembly ownership, and cross-goal contracts.
 * Every registration path writes an independently readable domain fact; the
 * orchestrator snapshots the collector after the physical agent turn ends.
 *
 * Small tool calls (~500 bytes each) avoid the streaming buffering that a
 * monolithic submit tool would trigger for TypeScript source inside `spec`
 * or long acceptance criteria.
 */
import { tool } from "ai"
import z from "zod"
import path from "path"
import fs from "fs"
import { isDeepStrictEqual } from "node:util"
import { Instance } from "@/project/instance"
import {
  GoalContractFieldsSchema,
  GoalContractUpdateSchema,
  normalizeGoalContractFields,
} from "@/pipeline/goal-contract.schema"
import { AcceptanceSeverity, LlmJudgeInputKind, RubricLevelSchema, type AcceptanceSpec } from "@/acceptance/types"
import { VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME } from "@/acceptance/prebuilt-scorer"
import { RequirementDeclaredIDSchema } from "@/requirements/types"
import {
  AssemblyOwnerEntrySchema,
  SourceCoverageEntrySchema,
  ReferenceCoverageEntrySchema,
} from "./fidelity"
import {
  ArchitectContractRefSchema,
  emptyArchitectContractGraph,
  type ArchitectContractRef,
  type ArchitectContractGraph,
} from "./contract-graph"
import { ContractIRSchema } from "./contract-ir"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { discriminatorRepairHint } from "@/session/repair-hint"

const RegisterContractToolInputBaseSchema = ArchitectContractRefSchema.omit({
  ir: true,
  route: true,
  component: true,
}).extend({
  ir_json: z
    .string()
    .min(2)
    .describe(
      'For kind=type/function/enum only: JSON.stringify of the ContractIR object. Example: {"kind":"type","name":"WidgetProps","fields":[...]}',
    )
    .optional(),
  route_json: z
    .string()
    .min(2)
    .describe("For kind=route only: JSON.stringify of {method,path,request?,response?}.")
    .optional(),
  component_json: z
    .string()
    .min(2)
    .describe(
      "For kind=component only: JSON.stringify of {props?: string, events?: string[], slots?: string[]}. props is a comma-separated string, not an array.",
    )
    .optional(),
}).strict()

function registerContractToolInputSchema(knownResearchEvidenceRefs?: readonly string[]) {
  const refs = [...new Set(knownResearchEvidenceRefs ?? [])]
  return RegisterContractToolInputBaseSchema.extend({
    evidence_refs: z
      .array(z.string().min(1))
      .default([])
      .describe(
        refs.length > 0
          ? `Optional exact ResearchEvidence refs that materially support this contract. Available refs: ${refs.join(", ")}`
          : "Optional exact ResearchEvidence IDs from Research Artifacts you completely read this Turn. Persistence verifies every ID against the exact selected Artifact locators.",
      ),
  })
}

const ArchitectHeuristicScorerSchema = z
  .object({
    type: z
      .literal("heuristic")
      .describe(
        "heuristic — deterministic inline shell check. Architect exposes only inline shell checks for one-off page checks.",
      ),
    name: z.string().min(1),
    spec: z
      .object({
        kind: z.literal("shell").describe("shell — run an inline command. Requires: cmd; optional cwd."),
        cmd: z.string().min(1).describe("Shell command. Exit 0 = pass unless expect.exit_code set."),
        cwd: z.string().optional(),
      })
      .strict(),
    expect: z
      .object({
        exit_code: z.number().int().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

const ArchitectLlmJudgeScorerSchema = z
  .object({
    type: z
      .literal("llm_judge")
      .describe("llm_judge — natural-language rubric evaluation. Requires: name, criteria; optional rubric, inputs."),
    name: z.string().min(1),
    criteria: z.string().min(10).describe("Single-criterion evaluation question in natural language."),
    rubric: z
      .array(RubricLevelSchema)
      .min(2)
      .max(5)
      .optional()
      .describe("Ordinal anchors, 2-5 levels. Omit for binary MET/UNMET."),
    inputs: z
      .array(LlmJudgeInputKind)
      .optional()
      .describe(
        "Which parts of the acceptance to feed the judge. LLM judges cannot consume visual feedback; use prebuilt visual-feedback-verification for final reference parity.",
      ),
  })
  .strict()

const ArchitectPrebuiltScorerSchema = z
  .object({
    type: z.literal("prebuilt").describe("prebuilt — the platform-owned rendered visual feedback verifier."),
    name: z
      .literal(VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME)
      .describe("Exact executable prebuilt scorer identity for rendered visual feedback verification."),
  })
  .strict()

const ArchitectContractAuditScorerSchema = z
  .object({
    type: z
      .literal("contract_audit")
      .describe(
        "contract_audit — static audit of typed-contract field literals against registered graph contract_ids.",
      ),
    name: z.string().min(1),
    spec: z
      .object({
        kind: z.literal("contract_graph"),
        contract_ids: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    expect: z
      .object({
        status: z.literal("passed"),
      })
      .strict(),
  })
  .strict()

const ArchitectScorerSchema = z.discriminatedUnion("type", [
  ArchitectHeuristicScorerSchema,
  ArchitectLlmJudgeScorerSchema,
  ArchitectPrebuiltScorerSchema,
  ArchitectContractAuditScorerSchema,
])

const ArchitectAcceptanceSpecSchema = z
  .object({
    id: z.string().min(1).describe("Stable spec ID, e.g. 'acc-final-visual-fidelity'."),
    source: z
      .object({
        kind: z.literal("requirement"),
        id: RequirementDeclaredIDSchema.describe("Known persisted REQ-N that originated this atomic acceptance claim."),
      })
      .strict(),
    title: z.string().min(1),
    scenario: z
      .object({
        given: z.array(z.string().min(1)).min(1),
        when: z.array(z.string().min(1)).min(1),
        then: z.array(z.string().min(1)).min(1),
      })
      .strict()
      .optional()
      .describe("Gherkin Given/When/Then scenario. Optional — omit for pure code checks."),
    scorers: z
      .array(ArchitectScorerSchema)
      .min(1)
      .describe(
        "At least one scorer. Architect-visible scorers are shell, llm_judge, prebuilt visual-feedback-verification, or contract_audit.",
      ),
    severity: AcceptanceSeverity,
  })
  .strict()

const ArchitectGoalContractFieldsSchema = GoalContractFieldsSchema.extend({
  acceptance_specs: z.array(ArchitectAcceptanceSpecSchema).min(1).describe("Architect-visible typed acceptance specs."),
})

const ArchitectGoalContractUpdateSchema = GoalContractUpdateSchema.extend({
  acceptance_specs: z
    .array(ArchitectAcceptanceSpecSchema)
    .min(1)
    .describe("Replace the prior acceptance spec list.")
    .optional(),
})

const ModifyGoalToolInputSchema = z
  .object({
    id: z.string().min(1).describe("Existing goal id to modify."),
    updates: ArchitectGoalContractUpdateSchema,
  })
  .strict()

const RemoveGoalToolInputSchema = z
  .object({
    id: z.string().min(1).describe("Goal id to remove"),
    reason: z.string().min(5).describe("Why this goal is being removed (recorded for audit)"),
  })
  .strict()

const ManageGoalActionInputSchemas = {
  register_goal: ArchitectGoalContractFieldsSchema,
  modify_goal: ModifyGoalToolInputSchema,
  remove_goal: RemoveGoalToolInputSchema,
} satisfies Record<string, z.ZodObject<any>>

type ManageGoalActionName = keyof typeof ManageGoalActionInputSchemas

const MANAGE_GOAL_ACTION_NAMES = Object.keys(ManageGoalActionInputSchemas) as [
  ManageGoalActionName,
  ...ManageGoalActionName[],
]

const ManageGoalActionFieldSets: Record<ManageGoalActionName, ReadonlySet<string>> = {
  register_goal: new Set(Object.keys(ManageGoalActionInputSchemas.register_goal.shape)),
  modify_goal: new Set(Object.keys(ManageGoalActionInputSchemas.modify_goal.shape)),
  remove_goal: new Set(Object.keys(ManageGoalActionInputSchemas.remove_goal.shape)),
}
const ManageGoalUnionFields = [
  ...new Set(MANAGE_GOAL_ACTION_NAMES.flatMap((action) => [...ManageGoalActionFieldSets[action]])),
]

const ManageGoalInputSchema = z.discriminatedUnion(
  "action",
  MANAGE_GOAL_ACTION_NAMES.map((action) =>
    ManageGoalActionInputSchemas[action].safeExtend({
      ...Object.fromEntries(
        ManageGoalUnionFields.filter((field) => !ManageGoalActionFieldSets[action].has(field)).map((field) => [
          field,
          z
            .unknown()
            .optional()
            .describe(
              "Provider union-branch serialization field. It must be null/[] or an exact duplicate of modify_goal.updates and is removed before action execution.",
            ),
        ]),
      ),
      action: z.literal(action).describe("Delivery Slice contract mutation to record through the single Architect Goal tool."),
    }),
  ) as any,
)

function normalizedManageGoalActionInput(
  parsed: { action: ManageGoalActionName } & Record<string, unknown>,
): Record<string, unknown> {
  const acceptedFields = ManageGoalActionFieldSets[parsed.action]
  const updates =
    parsed.action === "modify_goal" && parsed.updates && typeof parsed.updates === "object" && !Array.isArray(parsed.updates)
      ? (parsed.updates as Record<string, unknown>)
      : undefined

  for (const [field, value] of Object.entries(parsed)) {
    if (field === "action" || acceptedFields.has(field) || value === undefined || value === null) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (updates && Object.hasOwn(updates, field) && isDeepStrictEqual(value, updates[field])) continue
    throw new Error(
      `manage_goal action=${parsed.action} received non-neutral field ${JSON.stringify(field)} from another action branch; ` +
        "only null, [], or an exact duplicate of modify_goal.updates is valid.",
    )
  }

  return Object.fromEntries(
    Object.entries(parsed).filter(([field]) => field !== "action" && acceptedFields.has(field)),
  )
}

function parseRegisterContractInput(
  input: unknown,
  inputSchema: ReturnType<typeof registerContractToolInputSchema> = RegisterContractToolInputBaseSchema,
): ArchitectContractRef {
  const parsed = inputSchema.parse(input) as z.infer<typeof RegisterContractToolInputBaseSchema>
  const typed = parsed.kind === "type" || parsed.kind === "function" || parsed.kind === "enum"
  const base = { ...parsed }
  delete (base as { ir_json?: string }).ir_json
  delete (base as { route_json?: string }).route_json
  delete (base as { component_json?: string }).component_json
  const route = parsed.route_json ? parseJSONToolField(parsed.route_json, "route_json") : undefined
  const component = parsed.component_json ? parseJSONToolField(parsed.component_json, "component_json") : undefined
  if (!typed) return ArchitectContractRefSchema.parse({ ...base, route, component })
  if (!parsed.ir_json) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["ir_json"],
        message: `${parsed.kind} contract requires ir_json containing a JSON ContractIR object`,
      },
    ])
  }
  const rawIR = parseJSONToolField(parsed.ir_json, "ir_json")
  const ir = ContractIRSchema.parse(rawIR)
  return ArchitectContractRefSchema.parse({ ...base, ir, route, component })
}

function parseJSONToolField(value: string, field: string): unknown {
  try {
    return JSON.parse(value)
  } catch (error) {
    throw new z.ZodError([
      {
        code: "custom",
        path: [field],
        message: `${field} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      },
    ])
  }
}

function registerContractValidationError(error: z.ZodError, input: unknown): string {
  let rawIR: unknown
  if (input && typeof input === "object" && typeof (input as { ir_json?: unknown }).ir_json === "string") {
    try {
      rawIR = JSON.parse((input as { ir_json: string }).ir_json)
    } catch {
      rawIR = undefined
    }
  }
  const irSchema = z.toJSONSchema(ContractIRSchema as any) as Record<string, any>
  const details = error.issues.map((issue) => {
    if (issue.code === "invalid_union" && rawIR !== undefined) {
      const hint = discriminatorRepairHint(irSchema, issue as any, rawIR)
      if (hint) {
        return (
          `ir_json.${hint.at} must be exactly one of ` +
          `${hint.values.map((value) => JSON.stringify(value)).join(" | ")}; ` +
          `received ${JSON.stringify(hint.supplied)}`
        )
      }
    }
    const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "input"
    return `${pathLabel}: ${issue.message}`
  })
  return `Error: register_contract validation failed; ${details.join("; ")}; collector unchanged.`
}

// ---------------------------------------------------------------------------
// Collector — single buffer for the full Architect output
// ---------------------------------------------------------------------------

export interface RegisteredGoal {
  id: string
  title: string
  objective: string
  acceptance_specs: AcceptanceSpec[]
  owned_paths: string[]
  priority: "blocking" | "advisory"
  kind: "bootstrap" | "feature" | "verification" | "integration" | "system"
}

export type ArchitectSelectedExistingGoals = {
  sourceKey: string
  goals: RegisteredGoal[]
}

export interface ArchitectCollector {
  goals: RegisteredGoal[]
  source_coverage: Array<z.infer<typeof SourceCoverageEntrySchema>>
  reference_coverage: Array<z.infer<typeof ReferenceCoverageEntrySchema>>
  assembly_owners: Array<z.infer<typeof AssemblyOwnerEntrySchema>>
  contract_graph: ArchitectContractGraph
  /** Structured removals preserve the Architect's reason as an immutable graph fact. */
  removed_goals: Array<{ goal_id: string; reason: string }>
}

function toRegisteredGoal(input: unknown): RegisteredGoal {
  const parsed = normalizeGoalContractFields(input as Parameters<typeof normalizeGoalContractFields>[0])
  return {
    ...parsed,
    kind: parsed.kind,
  }
}

function forbiddenInternalRuntimeOwnedPaths(goal: RegisteredGoal): string[] {
  return ProjectRuntimePaths.internalRuntimeRelativePaths(goal.owned_paths)
}

function formatInternalRuntimeOwnedPathError(goalID: string, paths: readonly string[]): string {
  return (
    `Error: goal "${goalID}" owned_paths include internal OpenCorvus runtime path(s): ${paths.join(", ")}. ` +
    "`owned_paths` are build-owned project outputs and review surfaces; `.opencorvus/.r/`, `.opencorvus/runtime/`, `.opencorvus/worktrees/`, `.opencorvus-worktrees/`, and `.opencorvus-meta.json` are host-owned runtime evidence/state. " +
    "Keep those paths as exact read-only evidence references in the objective, acceptance specs, reference coverage, or contract rationale, and write durable deliverables under project source/docs paths instead."
  )
}

function emptyCollector(): ArchitectCollector {
  return {
    goals: [],
    source_coverage: [],
    reference_coverage: [],
    assembly_owners: [],
    contract_graph: emptyArchitectContractGraph(),
    removed_goals: [],
  }
}

function collectorGoalByID(collector: ArchitectCollector): Map<string, RegisteredGoal> {
  return new Map(collector.goals.map((goal) => [goal.id, goal]))
}

function registeredContractIDs(collector: ArchitectCollector): Set<string> {
  return new Set(collector.contract_graph.contracts.map((contract) => contract.id))
}

function unknownContractAuditContractIDs(collector: ArchitectCollector, specs: readonly AcceptanceSpec[]): string[] {
  const contractIDs = registeredContractIDs(collector)
  const unknownIDs: string[] = []
  for (const spec of specs) {
    for (const scorer of spec.scorers) {
      if (scorer.type !== "contract_audit") continue
      for (const contractID of scorer.spec.contract_ids) {
        if (!contractIDs.has(contractID)) unknownIDs.push(contractID)
      }
    }
  }
  return [...new Set(unknownIDs)]
}

function formatGoalCandidateList(goals: RegisteredGoal[]): string {
  if (goals.length === 0) return "(none)"
  return goals.map(formatGoalSnapshot).join(" | ")
}

function formatGoalSnapshot(goal: RegisteredGoal): string {
  const specs =
    goal.acceptance_specs.length > 0 ? goal.acceptance_specs.map(formatAcceptanceSpec).join(", ") : "(none)"
  return (
    `${goal.id} title=${JSON.stringify(goal.title)} objective=${JSON.stringify(goal.objective)} ` +
    `kind=${goal.kind} priority=${goal.priority} owned_paths=${JSON.stringify(goal.owned_paths)} ` +
    `acceptance_specs=[${specs}]`
  )
}

function formatAcceptanceSpec(spec: AcceptanceSpec): string {
  const scorerTypes = spec.scorers.map(formatScorerSnapshot).join("+")
  const source = spec.source ? `${spec.source.kind}:${spec.source.id}` : "no-source"
  return `${spec.id}:${spec.severity}:${source}:${scorerTypes}`
}

function formatScorerSnapshot(scorer: AcceptanceSpec["scorers"][number]): string {
  if (scorer.type === "heuristic") {
    if (scorer.spec.kind === "shell") return `heuristic:shell:${limitInline(scorer.spec.cmd, 48)}`
    return `heuristic:script_ref:${scorer.spec.path}`
  }
  if (scorer.type === "prebuilt") return `prebuilt:${scorer.name}`
  if (scorer.type === "contract_audit") return `contract_audit:${scorer.spec.contract_ids.join(",")}`
  return `llm_judge:${scorer.inputs?.join(",") ?? "acceptance_summary"}`
}

function limitInline(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length > max ? `${compact.slice(0, max - 3)}...` : compact
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createArchitectOutputTools(input: {
  workDir?: string
  knownResearchEvidenceRefs?: string[]
  /**
   * Resolve prior Goals only from Artifact selections completed before the
   * current output-tool message. The callback is intentionally consumer-owned:
   * no unselected database current tip may affect the collector.
   */
  selectedExistingGoals?: (
    options: unknown,
    toolName: string,
  ) => ArchitectSelectedExistingGoals | undefined
}) {
  let collector = emptyCollector()
  let selectedExistingGoalSourceKey: string | undefined
  let outputToolStarted = false
  const dir = input.workDir ?? Instance.directory
  const knownResearchEvidenceRefs =
    input.knownResearchEvidenceRefs !== undefined ? new Set(input.knownResearchEvidenceRefs) : undefined
  const registerContractInputSchema = registerContractToolInputSchema(input.knownResearchEvidenceRefs)

  const seedSelectedExistingGoals = (selected: ArchitectSelectedExistingGoals | undefined) => {
    if (!selected) return collector
    if (selectedExistingGoalSourceKey === selected.sourceKey) return collector
    if (
      selectedExistingGoalSourceKey !== undefined &&
      selectedExistingGoalSourceKey !== selected.sourceKey
    ) {
      throw new Error(
        `Architect collector prior changed from ${selectedExistingGoalSourceKey} to ${selected.sourceKey} within one Turn.`,
      )
    }
    const parsedGoals = selected.goals.map(toRegisteredGoal)
    const mergedGoals = [...collector.goals]
    const registeredGoalIDs = new Set(mergedGoals.map((goal) => goal.id))
    for (const goal of parsedGoals) {
      if (registeredGoalIDs.has(goal.id)) continue
      mergedGoals.push(goal)
      registeredGoalIDs.add(goal.id)
    }
    collector = { ...collector, goals: mergedGoals }
    selectedExistingGoalSourceKey = selected.sourceKey
    return collector
  }

  const synchronizeSelectedExistingGoals = (options: unknown, toolName: string) => {
    const selected = input.selectedExistingGoals?.(options, toolName)
    if (!outputToolStarted || selectedExistingGoalSourceKey !== undefined) {
      seedSelectedExistingGoals(selected)
    }
    outputToolStarted = true
    return collector
  }

  const tools = {
    register_goal: tool({
      description:
        "Register a new Delivery Slice contract, or overwrite a prior registration with " +
        "the same id in this Architect turn. A Goal is a versioned delivery and acceptance subject, " +
        "not a worker, dispatch, worktree, or lifecycle owner. Its objective MUST be self-contained " +
        "enough for Task-level workflow consumers to cite the exact Slice revision. Every selected " +
        "workflow node still executes once for the Task. All " +
        "fields are schema-validated. Use an existing id only for the same logical goal already registered in this Turn; use a new id only for a genuinely new goal. " +
        "Persistence preserves existing G numbers and assigns new goals the " +
        "next unused G number.",
      inputSchema: ArchitectGoalContractFieldsSchema,
      execute: async (goal) => {
        const parsedGoal = toRegisteredGoal(goal)
        const internalRuntimePaths = forbiddenInternalRuntimeOwnedPaths(parsedGoal)
        if (internalRuntimePaths.length > 0) {
          return formatInternalRuntimeOwnedPathError(parsedGoal.id, internalRuntimePaths)
        }
        const warnings: string[] = []
        for (const p of parsedGoal.owned_paths) {
          try {
            const abs = path.resolve(dir, p)
            if (!fs.existsSync(abs) && !fs.existsSync(path.dirname(abs))) {
              warnings.push(p)
            }
          } catch {
            /* cross-platform path issues — skip */
          }
        }

        const existingIdx = collector.goals.findIndex((g) => g.id === parsedGoal.id)
        let msg: string
        if (existingIdx >= 0) {
          collector.goals[existingIdx] = parsedGoal
          msg = `OK: goal "${parsedGoal.id}" updated in-place (${collector.goals.length} total)`
        } else {
          collector.goals.push(parsedGoal)
          msg = `OK: goal "${parsedGoal.id}" registered (${collector.goals.length} total)`
        }
        // A newly registered/updated id cannot also be in the removal list.
        collector.removed_goals = collector.removed_goals.filter((removal) => removal.goal_id !== parsedGoal.id)
        if (warnings.length > 0) {
          msg += `\nWarning: paths without an existing parent directory: ${warnings.join(", ")}. Verify these are intentional.`
        }
        const forwardContractIDs = unknownContractAuditContractIDs(collector, parsedGoal.acceptance_specs)
        if (forwardContractIDs.length > 0) {
          msg += `\nNotice: contract_audit forward reference(s) pending registration: ${forwardContractIDs.join(", ")}. Register matching contract ids or leave the incomplete reference visible.`
        }
        return `${msg}\nCurrent: ${formatGoalSnapshot(parsedGoal)}`
      },
    }),

    modify_goal: tool({
      description:
        "Refine fields on an already-registered goal in this Architect Turn. Supply only the fields you want to change. Unknown " +
        "ids are rejected — use manage_goal action=register_goal if you intend a brand-new goal. " +
        "A modified Goal keeps its stable logical G number and records the next " +
        "immutable Delivery Slice revision V. Revision does not start or retry execution. Architect-visible acceptance scorer schema does not expose script_ref; use inline shell, llm_judge, prebuilt visual-feedback-verification, or contract_audit.",
      inputSchema: ModifyGoalToolInputSchema,
      execute: async ({ id, updates }) => {
        const idx = collector.goals.findIndex((g) => g.id === id)
        if (idx < 0) {
          return `Error: goal "${id}" not registered. Use manage_goal action=register_goal to add new goals.`
        }
        const prior = collector.goals[idx]
        const normalizedUpdates = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined))
        const parsedNext = GoalContractFieldsSchema.safeParse({ ...prior, ...normalizedUpdates })
        if (!parsedNext.success) {
          const issueLines = parsedNext.error.issues.slice(0, 8).map((issue) => {
            const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "(root)"
            return `- ${pathLabel}: ${issue.message}`
          })
          return [
            `Error: manage_goal action=modify_goal produced an invalid goal after merge; collector unchanged.`,
            ...issueLines,
          ].join("\n")
        }
        const next = parsedNext.data
        const internalRuntimePaths = forbiddenInternalRuntimeOwnedPaths(next)
        if (internalRuntimePaths.length > 0) {
          return formatInternalRuntimeOwnedPathError(id, internalRuntimePaths)
        }
        const changedFields = Object.keys(normalizedUpdates).filter(
          (key) =>
            !isDeepStrictEqual(
              (prior as unknown as Record<string, unknown>)[key],
              (next as unknown as Record<string, unknown>)[key],
            ),
        )
        if (changedFields.length === 0) {
          return `No changes: goal "${id}" already matches the registered updates.\nCurrent: ${formatGoalSnapshot(prior)}`
        }
        collector.goals[idx] = next
        const forwardContractIDs = unknownContractAuditContractIDs(collector, next.acceptance_specs)
        const contractNotice =
          forwardContractIDs.length > 0
            ? `\nNotice: contract_audit forward reference(s) pending registration: ${forwardContractIDs.join(", ")}. Register matching contract ids or leave the incomplete reference visible.`
            : ""
        return `OK: goal "${id}" fields updated (${changedFields.join(", ")})${contractNotice}\nCurrent: ${formatGoalSnapshot(next)}`
      },
    }),

    remove_goal: tool({
      description:
        "Remove a goal registered earlier in this Architect Turn when the assembled contract shows it is redundant or wrong. The goal " +
        "id and reason are recorded in the next immutable ContractGraph projection; prior Goal rows and evidence are never deleted. " +
        "Cascades to every dependent registration: fidelity coverage, assembly ownership, and cross-goal contracts " +
        "that mention it. Goal is the single source of " +
        "truth for these dependents — there is no orphan recovery path.",
      inputSchema: RemoveGoalToolInputSchema,
      execute: async ({ id, reason }) => {
        const idx = collector.goals.findIndex((g) => g.id === id)
        if (idx < 0) {
          return `Error: goal "${id}" not in collector — nothing to remove.`
        }
        collector.goals.splice(idx, 1)
        collector.removed_goals = [
          ...collector.removed_goals.filter((removal) => removal.goal_id !== id),
          { goal_id: id, reason },
        ]

        const cascade = {
          source_coverage_rows: 0,
          source_coverage_refs: 0,
          reference_coverage_rows: 0,
          reference_coverage_refs: 0,
          assembly_owners: 0,
          contracts: 0,
        }

        const sourceCoverageNext: ArchitectCollector["source_coverage"] = []
        for (const row of collector.source_coverage) {
          if (!row.goal_ids.includes(id)) {
            sourceCoverageNext.push(row)
            continue
          }
          const filtered = row.goal_ids.filter((goalID) => goalID !== id)
          cascade.source_coverage_refs++
          if (filtered.length === 0) {
            cascade.source_coverage_rows++
            continue
          }
          sourceCoverageNext.push({ ...row, goal_ids: filtered })
        }
        collector.source_coverage = sourceCoverageNext

        const referenceCoverageNext: ArchitectCollector["reference_coverage"] = []
        for (const row of collector.reference_coverage) {
          if (!row.goal_ids.includes(id)) {
            referenceCoverageNext.push(row)
            continue
          }
          const filtered = row.goal_ids.filter((goalID) => goalID !== id)
          cascade.reference_coverage_refs++
          if (filtered.length === 0) {
            cascade.reference_coverage_rows++
            continue
          }
          referenceCoverageNext.push({ ...row, goal_ids: filtered })
        }
        collector.reference_coverage = referenceCoverageNext

        const beforeAssemblyOwners = collector.assembly_owners.length
        collector.assembly_owners = collector.assembly_owners.filter((row) => row.goal_id !== id)
        cascade.assembly_owners = beforeAssemblyOwners - collector.assembly_owners.length

        const beforeContracts = collector.contract_graph.contracts.length
        collector.contract_graph.contracts = collector.contract_graph.contracts
          .map((contract) => ({
            ...contract,
            consumer_goal_ids: contract.consumer_goal_ids.filter((goalID) => goalID !== id),
          }))
          .filter((contract) => contract.producer_goal_id !== id)
        cascade.contracts = beforeContracts - collector.contract_graph.contracts.length

        const cascadeBits: string[] = []
        if (cascade.source_coverage_rows || cascade.source_coverage_refs) {
          cascadeBits.push(
            `${cascade.source_coverage_refs} source coverage ref(s) (${cascade.source_coverage_rows} row(s) dropped)`,
          )
        }
        if (cascade.reference_coverage_rows || cascade.reference_coverage_refs) {
          cascadeBits.push(
            `${cascade.reference_coverage_refs} reference coverage ref(s) (${cascade.reference_coverage_rows} row(s) dropped)`,
          )
        }
        if (cascade.assembly_owners) cascadeBits.push(`${cascade.assembly_owners} assembly owner row(s)`)
        if (cascade.contracts) cascadeBits.push(`${cascade.contracts} contract(s) dropped`)
        const cascadeMsg = cascadeBits.length > 0 ? ` Cascaded: ${cascadeBits.join(", ")}.` : ""
        return `OK: goal "${id}" removed. Reason: ${reason}. (${collector.goals.length} remaining)${cascadeMsg}`
      },
    }),

    register_source_coverage: tool({
      description:
        "Register which existing source files or modules are intentionally reused, modified, preserved, or replaced, and which goals own that work.",
      inputSchema: SourceCoverageEntrySchema,
      execute: async (input, options) => {
        synchronizeSelectedExistingGoals(options, "register_source_coverage")
        const parsed = SourceCoverageEntrySchema.parse(input)
        const existingIdx = collector.source_coverage.findIndex((row) => row.id === parsed.id)
        if (existingIdx >= 0) {
          collector.source_coverage[existingIdx] = parsed
          return `OK: source coverage "${parsed.id}" overwritten (${collector.source_coverage.length} total)`
        }
        collector.source_coverage.push(parsed)
        return `OK: source coverage "${parsed.id}" registered (${collector.source_coverage.length} total)`
      },
    }),

    register_reference_coverage: tool({
      description:
        "Register which authoritative reference surface, visual spec ids, and Frontend Design reference_regions each goal must restore when this evidence is already clear.",
      inputSchema: ReferenceCoverageEntrySchema,
      execute: async (input, options) => {
        synchronizeSelectedExistingGoals(options, "register_reference_coverage")
        const parsed = ReferenceCoverageEntrySchema.parse(input)
        const existingIdx = collector.reference_coverage.findIndex((row) => row.id === parsed.id)
        if (existingIdx >= 0) {
          collector.reference_coverage[existingIdx] = parsed
          return `OK: reference coverage "${parsed.id}" overwritten (${collector.reference_coverage.length} total)`
        }
        collector.reference_coverage.push(parsed)
        return `OK: reference coverage "${parsed.id}" registered (${collector.reference_coverage.length} total)`
      },
    }),

    register_assembly_owner: tool({
      description:
        "Register the single goal that owns final stitching for a shared user-visible or integration surface.",
      inputSchema: AssemblyOwnerEntrySchema,
      execute: async (input, options) => {
        synchronizeSelectedExistingGoals(options, "register_assembly_owner")
        const parsed = AssemblyOwnerEntrySchema.parse(input)
        const existingIdx = collector.assembly_owners.findIndex((row) => row.surface === parsed.surface)
        if (existingIdx >= 0) {
          collector.assembly_owners[existingIdx] = parsed
          return `OK: assembly owner "${parsed.surface}" overwritten (${collector.assembly_owners.length} total)`
        }
        collector.assembly_owners.push(parsed)
        return `OK: assembly owner "${parsed.surface}" registered (${collector.assembly_owners.length} total)`
      },
    }),

    register_contract: tool({
      description:
        "Register one Architect Contract Graph interface. producer_goal_id owns the interface and consumer_goal_ids name its consumers without creating execution order. Use type/function/enum with ir_json for typed contracts; use route/component/static_data/render_surface/behavior_inventory for non-IR surfaces. evidence_refs is projected only when exact ResearchEvidence refs exist; never put an Engine Artifact ID or locator there.",
      inputSchema: registerContractInputSchema,
      execute: async (input, options) => {
        synchronizeSelectedExistingGoals(options, "register_contract")
        let contract: ArchitectContractRef
        try {
          contract = parseRegisterContractInput(input, registerContractInputSchema)
        } catch (error) {
          if (error instanceof z.ZodError) return registerContractValidationError(error, input)
          throw error
        }
        const byID = collectorGoalByID(collector)
        const unknownGoals = [contract.producer_goal_id, ...contract.consumer_goal_ids].filter(
          (goalID) => !byID.has(goalID),
        )
        if (unknownGoals.length > 0) {
          return `Error: contract "${contract.id}" references unknown goal id(s): ${[...new Set(unknownGoals)].join(", ")}. Register the goals first; collector unchanged.`
        }
        if (knownResearchEvidenceRefs && contract.evidence_refs.length > 0) {
          const unknownEvidenceRefs = contract.evidence_refs.filter((ref) => !knownResearchEvidenceRefs.has(ref))
          if (unknownEvidenceRefs.length > 0) {
            return `Error: contract "${contract.id}" evidence_refs contain unknown or stale research evidence ref(s): ${[...new Set(unknownEvidenceRefs)].join(", ")}; collector unchanged.`
          }
        }
        const existingIdx = collector.contract_graph.contracts.findIndex((row) => row.id === contract.id)
        if (existingIdx >= 0) {
          collector.contract_graph.contracts[existingIdx] = contract
          return `OK: contract "${contract.id}" overwritten (${collector.contract_graph.contracts.length} contracts total)\nRegistered contract ids: ${[...registeredContractIDs(collector)].join(", ")}`
        }
        collector.contract_graph.contracts.push(contract)
        return `OK: contract "${contract.id}" registered (${collector.contract_graph.contracts.length} contracts total)\nRegistered contract ids: ${[...registeredContractIDs(collector)].join(", ")}`
      },
    }),

  }

  const manageGoalTool = tool({
    description:
      "Single Architect goal mutation tool. Use action=register_goal, action=modify_goal, or action=remove_goal. " +
      "This replaces separate visible goal tools while preserving exact action-specific schemas and collector semantics.",
    inputSchema: ManageGoalInputSchema,
    execute: async (input, options) => {
      synchronizeSelectedExistingGoals(options, "manage_goal")
      const parsed = ManageGoalInputSchema.parse(input) as { action: ManageGoalActionName } & Record<string, unknown>
      const { action } = parsed
      const actionInput = normalizedManageGoalActionInput(parsed)
      const actionTool = tools[action]
      if (!actionTool?.execute) {
        throw new Error(`manage_goal action ${action} is not backed by an internal Architect goal action`)
      }
      return await actionTool.execute(actionInput as never, options as never)
    },
  })

  const visibleTools = {
    manage_goal: manageGoalTool,
    view_architect_draft: tool({
      description:
        "Read the exact current Architect collector facts without validating, finalizing, routing, or changing them.",
      inputSchema: z.object({}).strict(),
      execute: async (_input, options) => {
        synchronizeSelectedExistingGoals(options, "view_architect_draft")
        return JSON.stringify({
          goals: collector.goals,
          source_coverage: collector.source_coverage,
          reference_coverage: collector.reference_coverage,
          assembly_owners: collector.assembly_owners,
          contracts: collector.contract_graph.contracts,
          removals: collector.removed_goals,
        })
      },
    }),
    register_source_coverage: tools.register_source_coverage,
    register_reference_coverage: tools.register_reference_coverage,
    register_assembly_owner: tools.register_assembly_owner,
    register_contract: tools.register_contract,
  }

  return {
    tools: visibleTools,
    /** Reset the collector between retry attempts. */
    reset() {
      collector = emptyCollector()
      selectedExistingGoalSourceKey = undefined
      outputToolStarted = false
      return collector
    },
    selectedExistingGoalSourceKey() {
      return selectedExistingGoalSourceKey
    },
    getCollector() {
      return collector
    },
    snapshot() {
      return collector
    },
  }
}
