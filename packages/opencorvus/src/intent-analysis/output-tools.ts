/**
 * Zod-validated tool calls for Intent Analysis Agent incremental recording.
 *
 * Intent classification is rendered directly from the Agent's typed output;
 * incremental tools only record supporting slots and clarification needs.
 *
 * The remaining three tools (`extract_slot`, `flag_missing_info`,
 * `ask_clarification`) stay as incremental "scratchpad" tools, injected
 * via the child session's runtime contract so the same session can be
 * reconstructed later without losing their durable facts.
 *
 * Small tool schemas mirror the architect pattern — gives the LLM an
 * incremental append surface rather than a single monolithic object that
 * amplifies streaming-buffering issues on some providers.
 */
import { tool } from "ai"
import z from "zod"
import type {
  ClarificationPriority,
  IntentAnalysisResult,
  IntentClarification,
  IntentClass,
  IntentComplexity,
  IntentSlot,
} from "./types"
import { FactCheckItemListSchema } from "@/fact-check/schema"

export const INTENT_CLASSES = [
  "question",
  "bug_fix",
  "feature",
  "refactor",
  "exploration",
  "chore",
  "unclear",
] as const satisfies readonly IntentClass[]

export const COMPLEXITY_BANDS = [
  "trivial",
  "small",
  "medium",
  "large",
  "unknown",
] as const satisfies readonly IntentComplexity[]

/**
 * Its two siblings above carry `satisfies`; this one did not, so the enum here
 * and `ClarificationPriority` could drift apart. The consumer in
 * `orchestrator/analyze-intent-tool.ts` selects blockers with `=== "blocker"`,
 * which means a third priority would be sorted into the same bucket as `nice`
 * and never become a question the operator is actually asked.
 */
const CLARIFICATION_PRIORITIES = ["blocker", "nice"] as const satisfies readonly ClarificationPriority[]

const ClarificationOptionSchema = z
  .object({
    value: z.string().min(1).describe("Stable machine-facing answer value returned when selected."),
    label: z.string().min(1).describe("Short selectable answer label shown to the operator."),
    description: z.string().min(1).describe("One sentence explaining when to choose this answer."),
  })
  .strict()

export const IntentClarificationInputSchema = z
  .object({
    header: z.string().min(1).max(30).describe("Short label for the question, at most 30 characters."),
    question: z.string().min(1).describe("The clarifying question, phrased directly to the user."),
    options: z
      .array(ClarificationOptionSchema)
      .describe("Concrete selectable answers. Use [] only when the answer must be free-form."),
    multiple: z.boolean().describe("Whether the user may select more than one option."),
    custom: z.boolean().describe("Whether the user may type a custom free-form answer."),
    why_needed: z.string().min(1).describe("Why answering is needed — which downstream decision it unblocks."),
    priority: z.enum(CLARIFICATION_PRIORITIES).describe("'blocker' or 'nice'."),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.options.length === 0 && value.custom !== true) {
      ctx.addIssue({
        code: "custom",
        message: "Free-form-only clarification questions must set custom=true.",
        path: ["custom"],
      })
    }
  })

// ---------------------------------------------------------------------------
// Optional domain judgment. Recording it enriches the accumulated intent
// facts but does not complete or validate the physical Agent turn.
// ---------------------------------------------------------------------------

export const IntentJudgmentSchema = z.object({
  intent_class: z
    .enum(INTENT_CLASSES)
    .describe("Primary intent class — pick 'unclear' only when no class fits better than random guessing."),
  complexity: z
    .enum(COMPLEXITY_BANDS)
    .describe(
      "Rough work size: trivial (minutes), small (one file / one goal), medium (few files, coordinated), large (multi-subsystem), unknown (not enough info to judge).",
    ),
  confidence: z.number().min(0).max(1).describe("Overall confidence in this analysis, 0-1."),
  summary: z.string().min(1).describe("One-line statement of what the user wants."),
  // Optional fact-check registration: missing means no items registered.
  fact_check_items: FactCheckItemListSchema.default([]).describe(
    "Every factual claim (API behaviour, library version, file path you did not read this session) you have NOT verified via tool calls. Empty when only intent inference or in-session-verified statements.",
  ),
}).strict()
export type IntentJudgment = z.infer<typeof IntentJudgmentSchema>

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

export interface IntentCollector {
  slots: IntentSlot[]
  missing: string[]
  clarifications: IntentClarification[]
  judgment?: IntentJudgment
}

function emptyCollector(): IntentCollector {
  return {
    slots: [],
    missing: [],
    clarifications: [],
    judgment: undefined,
  }
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createIntentOutputTools() {
  let collector = emptyCollector()

  const tools = {
    extract_slot: tool({
      description:
        "Record one extracted requirement element (a 'slot') from the user's " +
        "request. Call once per distinct element — e.g. target file, module, " +
        "action verb, stack, constraint, data source, etc. If nothing can be " +
        "extracted with non-trivial confidence, do not call this tool.",
      inputSchema: z.object({
        key: z
          .string()
          .min(1)
          .describe(
            "Slot name in snake_case, e.g. 'target_file', 'module', 'stack', " +
              "'action_verb', 'constraint', 'data_source'.",
          ),
        value: z.string().min(1).describe("Extracted value, verbatim or lightly normalized."),
        confidence: z.number().min(0).max(1).describe("Confidence in this extraction, 0-1."),
      }),
      execute: async ({ key, value, confidence }) => {
        collector.slots.push({ key, value, confidence })
        const output = `OK: slot "${key}" recorded (${collector.slots.length} total)`
        return { output, title: `slot:${key}`, metadata: { count: collector.slots.length } }
      },
    }),

    flag_missing_info: tool({
      description:
        "Flag one piece of information judged missing but important for the " +
        "downstream planning agents. Use short snake_case keys; the matching " +
        "human-phrased question (if any) belongs in ask_clarification.",
      inputSchema: z.object({
        key: z
          .string()
          .min(1)
          .describe(
            "Missing info key in snake_case, e.g. 'target_file', " + "'acceptance_criteria', 'env_credentials'.",
          ),
      }),
      execute: async ({ key }) => {
        if (!collector.missing.includes(key)) collector.missing.push(key)
        const output = `OK: missing "${key}" flagged (${collector.missing.length} total)`
        return { output, title: `missing:${key}`, metadata: { count: collector.missing.length } }
      },
    }),

    ask_clarification: tool({
      description:
        "Record one clarification question the user would need to answer " +
        "before downstream agents can proceed safely. Use priority='blocker' " +
        "when downstream cannot start without it, 'nice' when it is merely " +
        "helpful. Provide concrete options when there are known likely answers, " +
        "and set custom=true when the user may need to type their own answer. " +
        "Skip entirely when the request is already unambiguous.",
      inputSchema: IntentClarificationInputSchema,
      execute: async ({ header, question, options, multiple, custom, why_needed, priority }) => {
        collector.clarifications.push({ header, question, options, multiple, custom, why_needed, priority })
        const output = `OK: clarification recorded (${collector.clarifications.length} total)`
        return {
          output,
          title: `clarify:${priority}`,
          metadata: { count: collector.clarifications.length, priority },
        }
      },
    }),

    record_intent_analysis: tool({
      description:
        "Record or revise the current intent classification judgment. This is an optional domain fact, not a finalizer: extracted slots, missing information, and clarification facts remain readable when no judgment is recorded.",
      inputSchema: IntentJudgmentSchema,
      execute: async (judgment) => {
        collector.judgment = IntentJudgmentSchema.parse(judgment)
        return {
          output: `OK: intent judgment recorded (${collector.judgment.intent_class}/${collector.judgment.complexity})`,
          title: "intent-analysis",
          metadata: { intent_class: collector.judgment.intent_class, complexity: collector.judgment.complexity },
        }
      },
    }),
  }

  return {
    tools,
    reset() {
      collector = emptyCollector()
      return collector
    },
    getCollector() {
      return collector
    },
  }
}

// ---------------------------------------------------------------------------
// Collector → optional domain result
// ---------------------------------------------------------------------------

/**
 * Project a complete IntentAnalysisResult only when the Agent recorded a
 * judgment. Missing judgment stays missing; no fallback classification is
 * fabricated and the already-recorded incremental facts remain available.
 */
export function collectorToResult(c: IntentCollector): IntentAnalysisResult | undefined {
  const judgment = c.judgment
  if (!judgment) return undefined
  return {
    intent_class: judgment.intent_class,
    complexity: judgment.complexity,
    extracted_slots: c.slots,
    missing_info: c.missing,
    clarifications: c.clarifications,
    confidence: judgment.confidence,
    summary: judgment.summary,
  }
}
