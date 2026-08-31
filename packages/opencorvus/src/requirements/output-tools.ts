/**
 * Structured output tools for the Requirements Agent.
 *
 * Requirements is narrow: it parses the user input into REQ-N requirements
 * and records foundational technical decisions (runtime / framework / test
 * strategy). Goals, acceptance specs, acceptance-source mappings, source/reference
 * coverage, and cross-goal contracts are produced by the Architect — not
 * here.
 *
 * Each tool call is small (~500 bytes). Zod schema validation at the wire
 * enforces required fields, enums, and min lengths.
 */
import { tool } from "ai"
import z from "zod"
import type { DecisionLog } from "@/decision-log"
import {
  RequirementCoverageDeclarationSchema,
  RequirementSchema,
  RequirementsDecisionSchema,
  type ParsedRequirement,
  type RequirementCoverageDeclaration,
  type RequirementsDecision,
} from "./types"
import { bindStageToolMaterializer } from "@/agent/stage-tool-materializer"
import { createDecisionLog } from "@/decision-log/index"

// ---------------------------------------------------------------------------
// Collector — accumulates registered items across tool calls
// ---------------------------------------------------------------------------

export interface RequirementsCollector {
  requirements: RegisteredRequirement[]
  decisions: RegisteredDecision[]
  finalization?: RequirementCoverageDeclaration
}

export type RegisteredRequirement = ParsedRequirement
export type RegisteredDecision = RequirementsDecision

export interface RequirementsOutputToolOptions {
  taskID?: string
  decisionLog?: DecisionLog
  decisionPhase?: string
}

export function materializeRequirementsRegisterDecisionTool(
  raw: Record<string, unknown>,
  options?: { decisionLog?: DecisionLog; onDecision?: (decision: RegisteredDecision) => void },
) {
  const input = z.object({ taskID: z.string().min(1), decisionPhase: z.string().min(1) }).strict().parse(raw)
  const decisionLog = options?.decisionLog ?? createDecisionLog(input.taskID)
  return bindStageToolMaterializer(
    tool({
      description:
        "Register a foundational technical or scope-calibration decision in the Task Decision Log.",
      inputSchema: DecisionRegistrationSchema,
      execute: async ({ key, value, reason }) => {
        options?.onDecision?.({ key, value, reason })
        decisionLog.append({ phase: input.decisionPhase, key, value, reason })
        return `OK: decision "${key}=${value}" registered`
      },
    }),
    { id: "requirements.register-decision", input },
  )
}

export const RequirementRegistrationSchema = z
  .object({
    id: RequirementSchema.shape.id.describe("Requirement ID in REQ-N format, e.g. REQ-1"),
    type: RequirementSchema.shape.type.describe("explicit = directly stated, implicit = logically required"),
    description: RequirementSchema.shape.description.describe("What the requirement asks for"),
    acceptance: RequirementSchema.shape.acceptance.describe("One observable success condition for this REQ-N"),
    non_goals: RequirementSchema.shape.non_goals.describe("One nearby behavior this REQ-N does not cover"),
    evidence_refs: RequirementSchema.shape.evidence_refs.default([]).describe(
      "Exact Task Artifact locators that support this requirement. Include only locators this Requirements Agent discovered with artifact_search, read completely with artifact_read, and declared with artifact_select. Empty when the requirement does not depend on another durable Artifact.",
    ),
  })
  .strict()

export const DecisionRegistrationSchema = z
  .object({
    key: RequirementsDecisionSchema.shape.key.describe(
      "Decision key, e.g. runtime, backend_framework, test_framework, user_workflows, visual_surfaces",
    ),
    value: RequirementsDecisionSchema.shape.value.describe(
      "Decision value, e.g. Bun, Hono, bun:test, or a concise comma/semicolon-separated inventory",
    ),
    reason: RequirementsDecisionSchema.shape.reason.describe("Why this decision was made (based on codebase evidence)"),
  })
  .strict()

function emptyCollector(): RequirementsCollector {
  return {
    requirements: [],
    decisions: [],
  }
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createRequirementsOutputToolFactory(options: RequirementsOutputToolOptions = {}) {
  let collector = emptyCollector()
  const materializeExact = (toolID: string) => {
    const exact = toolID === "register_requirement" ? tool({
      description: "Register a parsed requirement from user input. Call once per requirement.",
      inputSchema: RequirementRegistrationSchema,
      execute: async ({ id, type, description, acceptance, non_goals, evidence_refs = [] }) => {
        if (collector.requirements.some((r) => r.id === id)) return `Error: ${id} already registered`
        collector.requirements.push({ id, type, description, acceptance, non_goals, evidence_refs })
        return `OK: ${id} registered (${collector.requirements.length} total)`
      },
    }) : toolID === "register_decision" ? options.taskID
      ? materializeRequirementsRegisterDecisionTool(
          { taskID: options.taskID, decisionPhase: options.decisionPhase ?? "requirements" },
          {
            decisionLog: options.decisionLog,
            onDecision: (decision) => collector.decisions.push(decision),
          },
        )
      : tool({
          description: "Register a foundational technical or scope-calibration decision.",
          inputSchema: DecisionRegistrationSchema,
          execute: async ({ key, value, reason }) => {
            collector.decisions.push({ key, value, reason })
            return `OK: decision "${key}=${value}" registered`
          },
        }) : toolID === "finalize_requirements" ? tool({
      description:
        "Finalize the typed Requirements coverage declaration exactly once after registering every requirement and decision. " +
        "Bind the current request SHA-256, exact registered REQ-N identities, exact selected source Artifact locators, and every unresolved item. " +
        "Declare complete only when no unresolved coverage remains.",
      inputSchema: RequirementCoverageDeclarationSchema,
      execute: async (raw) => {
        if (collector.finalization) return "Error: Requirements coverage was already finalized for this Turn"
        collector.finalization = RequirementCoverageDeclarationSchema.parse(raw)
        return `OK: Requirements coverage declared ${collector.finalization.status}`
      },
    }) : undefined
    return exact
  }

  return {
    materializeExact,
    /** Reset collector between retry attempts. */
    reset() {
      collector = emptyCollector()
      return collector
    },
    /** Get current collector reference. */
    getCollector() {
      return collector
    },
  }
}
