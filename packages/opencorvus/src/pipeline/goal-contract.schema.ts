/**
 * Canonical Zod schema for GoalContractFields.
 *
 * Single source of truth for Goal-contract constraints. Projected planning
 * capabilities and operator tools both submit through this boundary.
 *
 * The TypeScript `GoalContractFields` interface in pipeline/types.ts
 * intentionally stays looser (e.g. `kind: string`) so existing call sites
 * that pass through runtime values from the database don't break.
 * Validation happens at the input boundaries (tool inputs) where
 * strictness is meaningful.
 */
import { z } from "zod"
import { AcceptanceSpecSchema } from "@/acceptance/types"

export const GOAL_KINDS = ["bootstrap", "feature", "verification", "integration", "system"] as const

export const GOAL_PRIORITIES = ["blocking", "advisory"] as const

/**
 * Core fields consumed by any capability that creates a durable Goal. Goal
 * updates use a partial version (`GoalContractUpdateSchema`) further down.
 */
export const GoalContractFieldsSchema = z
  .object({
    id: z.string().min(1).describe("Unique goal ID, e.g. goal_bootstrap, goal_api, goal_ui"),
    title: z.string().min(1).describe("Short human-readable goal title"),
    objective: z
      .string()
      .min(50)
      .describe(
        "Complete objective for this Goal: the outcome to produce, its Goal-specific constraints, " +
          "and the edge cases its selected projected capability must handle. Keep cross-Goal facts in " +
          "their canonical persisted contracts instead of copying another Goal's objective.",
      ),
    acceptance_specs: z
      .array(AcceptanceSpecSchema)
      .min(1)
      .describe(
        "Typed acceptance specs. At least one spec is required — a goal " +
          "without acceptance criteria cannot be evaluated.",
      ),
    owned_paths: z
      .array(z.string().min(1))
      .min(1)
      .describe(
        "Primary responsibility paths for this Goal. These guide collaboration and review; " +
          "they are not a file sandbox. Persist only paths established by current project evidence.",
      ),
    priority: z.enum(GOAL_PRIORITIES).default("blocking"),
    kind: z.enum(GOAL_KINDS).default("feature"),
  })
  .strict()

/**
 * Strict TypeScript type derived from the schema. Use at runtime input
 * boundaries; the looser `GoalContractFields` interface in pipeline/types.ts
 * stays the canonical type for downstream consumers.
 */
export type GoalContractFieldsParsed = z.infer<typeof GoalContractFieldsSchema>

export function normalizeGoalContractFields(input: z.input<typeof GoalContractFieldsSchema>): GoalContractFieldsParsed {
  const withDefaults = { ...input }
  if (withDefaults.priority === undefined) withDefaults.priority = "blocking"
  if (withDefaults.kind === undefined) withDefaults.kind = "feature"
  return GoalContractFieldsSchema.parse(withDefaults)
}

/**
 * Schema for `modify_goal.updates` — every field optional, id excluded
 * (never re-keyed), and constraints still enforced on whichever fields are
 * supplied. Use `.parse()` to reject invalid updates.
 */
export const GoalContractUpdateSchema = z
  .object({
    title: z.string().min(1).describe("Short human-readable goal title").optional(),
    objective: z
      .string()
      .min(50)
      .describe("Complete objective for this Goal. Replaces the prior objective when present.")
      .optional(),
    acceptance_specs: z
      .array(AcceptanceSpecSchema)
      .min(1)
      .describe("Typed acceptance specs. Replaces the prior acceptance spec list when present.")
      .optional(),
    owned_paths: z
      .array(z.string().min(1))
      .min(1)
      .describe("Primary responsibility paths for this Goal. Replaces the prior path list when present.")
      .optional(),
    priority: z.enum(GOAL_PRIORITIES).describe("Goal priority.").optional(),
    kind: z.enum(GOAL_KINDS).describe("Goal kind.").optional(),
  })
  .strict()

export type GoalContractUpdate = z.infer<typeof GoalContractUpdateSchema>

export function normalizeGoalContractUpdate(input: z.input<typeof GoalContractUpdateSchema>): GoalContractUpdate {
  const parsed = GoalContractUpdateSchema.parse(input)
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined)) as GoalContractUpdate
}
