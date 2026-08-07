/**
 * AcceptanceSpec is the generic, rubric-first contract attached to a Goal.
 * Package adapters may assign a typed source relation, while Core preserves
 * that relation without interpreting package-specific source kinds.
 */
import z from "zod"
import { VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME } from "./prebuilt-scorer"

export const AcceptanceSeverity = z.enum(["essential", "important", "optional", "pitfall"])
export const LlmJudgeInputKind = z.enum(["acceptance_summary", "changed_files", "requirement_text"])

export const AcceptanceSourceSchema = z
  .object({
    kind: z.string().trim().min(1).describe("Source contract kind. Core preserves this value without interpreting it."),
    id: z.string().trim().min(1).describe("Source-local contract identity."),
  })
  .strict()

const GherkinScenarioSchema = z
  .object({
    given: z.array(z.string().min(1)).min(1),
    when: z.array(z.string().min(1)).min(1),
    then: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .describe("Gherkin Given/When/Then scenario. Optional — omit for pure code checks.")

export const RubricLevelSchema = z
  .object({
    score: z.number().int().min(0).describe("Integer score for this level."),
    label: z.string().min(1).describe("Short level label, e.g. 'fully met'."),
    anchor: z.string().min(1).describe("Behavioral description: what earns this score."),
    passes: z.boolean().describe("Does this level count as pass for binary verdict?"),
  })
  .strict()

const HeuristicScorerSchema = z
  .object({
    type: z
      .literal("heuristic")
      .describe("heuristic — deterministic shell/script check, pass/fail by exit code. Requires: name, spec{kind}."),
    name: z.string().min(1),
    spec: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("shell").describe("shell — run an inline command. Requires: cmd; optional cwd."),
          cmd: z.string().min(1).describe("Shell command. Exit 0 = pass unless expect.exit_code set."),
          cwd: z.string().optional(),
        })
        .strict(),
      z
        .object({
          kind: z
            .literal("script_ref")
            .describe(
              "script_ref — run an existing repo script. Requires: path; optional args. Not for contract_audit; contract_audit is its own scorer type.",
            ),
          path: z.string().min(1).describe("Repo-relative script path that already exists at registration time."),
          args: z.array(z.string()).optional(),
        })
        .strict(),
    ]),
    expect: z
      .object({
        exit_code: z.number().int().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

const LlmJudgeScorerSchema = z
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
        "Which parts of the acceptance to feed the judge. Default: acceptance_summary. LLM judges cannot consume visual feedback; final rendered reference parity uses prebuilt visual-feedback-verification.",
      ),
  })
  .strict()

const PrebuiltScorerSchema = z
  .object({
    type: z.literal("prebuilt").describe("prebuilt — the platform-owned rendered visual feedback verification scorer."),
    name: z
      .literal(VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME)
      .describe("Exact executable prebuilt scorer identity for rendered visual feedback verification."),
  })
  .strict()

const ContractAuditScorerSchema = z
  .object({
    type: z
      .literal("contract_audit")
      .describe(
        "contract_audit — static audit of typed-contract field literals and graph artifact path materialization against registered graph contract_ids. This is a scorer type, not a script_ref path. Requires: name, spec.contract_ids, expect.status='passed'.",
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

export const ScorerSchema = z.discriminatedUnion("type", [
  HeuristicScorerSchema,
  LlmJudgeScorerSchema,
  PrebuiltScorerSchema,
  ContractAuditScorerSchema,
])

export const AcceptanceSpecSchema = z
  .object({
    id: z.string().trim().min(1).describe("Stable spec ID, e.g. 'acc-login-3s'."),
    source: AcceptanceSourceSchema.optional().describe(
      "Optional origin of this atomic acceptance contract. This is not a runtime evidence reference.",
    ),
    title: z.string().trim().min(1),
    scenario: GherkinScenarioSchema.optional(),
    scorers: z.array(ScorerSchema).min(1).describe("At least one scorer — a spec without a scorer is untestable."),
    severity: AcceptanceSeverity,
  })
  .strict()

export type AcceptanceSpec = z.infer<typeof AcceptanceSpecSchema>
export type AcceptanceSource = z.infer<typeof AcceptanceSourceSchema>
export type AcceptanceScorer = z.infer<typeof ScorerSchema>
export type HeuristicScorer = Extract<AcceptanceScorer, { type: "heuristic" }>
export type LlmJudgeScorer = Extract<AcceptanceScorer, { type: "llm_judge" }>
export type PrebuiltScorer = Extract<AcceptanceScorer, { type: "prebuilt" }>
export type ContractAuditScorer = Extract<AcceptanceScorer, { type: "contract_audit" }>
export type RubricLevel = z.infer<typeof RubricLevelSchema>

export function parseAcceptanceSpecs(input: unknown, context: string): AcceptanceSpec[] {
  let decoded = input
  if (typeof input === "string") {
    try {
      decoded = JSON.parse(input) as unknown
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`${context}: acceptance specs are not valid JSON: ${detail}`)
    }
  }
  const result = AcceptanceSpecSchema.array().safeParse(decoded)
  if (!result.success) {
    throw new Error(`${context}: invalid acceptance specs: ${z.prettifyError(result.error)}`)
  }
  return result.data
}

/**
 * Render a spec list as a single human-readable block for prompts, logs and
 * operator-facing docs. Deterministic, stable ordering.
 */
export function renderSpecsAsText(specs: readonly AcceptanceSpec[]): string {
  if (specs.length === 0) return "(no acceptance specs)"
  const lines: string[] = []
  for (const spec of specs) {
    const source = spec.source ? ` source=${spec.source.kind}:${spec.source.id}` : ""
    lines.push(`• [${spec.severity}] ${spec.title} (${spec.id}${source})`)
    if (spec.scenario) {
      for (const g of spec.scenario.given) lines.push(`    Given ${g}`)
      for (const w of spec.scenario.when) lines.push(`    When  ${w}`)
      for (const t of spec.scenario.then) lines.push(`    Then  ${t}`)
    }
    for (const sc of spec.scorers) {
      if (sc.type === "heuristic") {
        const desc = sc.spec.kind === "shell" ? `shell: ${sc.spec.cmd}` : `script: ${sc.spec.path}`
        lines.push(`    - [heuristic] ${sc.name} — ${desc}`)
      } else if (sc.type === "llm_judge") {
        lines.push(`    - [judge] ${sc.name} — ${sc.criteria}`)
      } else if (sc.type === "contract_audit") {
        lines.push(
          `    - [contract_audit] ${sc.name} — ${sc.spec.kind} contracts=${sc.spec.contract_ids.join(", ")} expect=${sc.expect.status}`,
        )
      } else {
        lines.push(`    - [prebuilt:${sc.name}]`)
      }
    }
  }
  return lines.join("\n")
}
