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
import { ArtifactReadLocatorSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import type { DecisionLog } from "@/decision-log"
import { RequirementDeclaredIDSchema } from "./types"
import { bindStageToolMaterializer } from "@/agent/stage-tool-materializer"
import { createDecisionLog } from "@/decision-log/index"

// ---------------------------------------------------------------------------
// Collector — accumulates registered items across tool calls
// ---------------------------------------------------------------------------

export interface RequirementsCollector {
  requirements: RegisteredRequirement[]
  decisions: RegisteredDecision[]
}

export interface RegisteredRequirement {
  id: string
  type: "explicit" | "implicit"
  description: string
  acceptance: string
  non_goals: string
  evidence_refs: Array<z.infer<typeof ArtifactReadLocatorSchema>>
}

export interface RegisteredDecision {
  key: string
  value: string
  reason: string
}

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
    id: RequirementDeclaredIDSchema.describe("Requirement ID in REQ-N format, e.g. REQ-1"),
    type: z.enum(["explicit", "implicit"]).describe("explicit = directly stated, implicit = logically required"),
    description: z.string().trim().min(5).describe("What the requirement asks for"),
    acceptance: z.string().trim().min(1).describe("One observable success condition for this REQ-N"),
    non_goals: z.string().trim().min(1).describe("One nearby behavior this REQ-N does not cover"),
    evidence_refs: z.array(ArtifactReadLocatorSchema).default([]).describe(
      "Exact Task Artifact locators that support this requirement. Include only locators this Requirements Agent discovered with artifact_search, read completely with artifact_read, and declared with artifact_select. Empty when the requirement does not depend on another durable Artifact.",
    ),
  })
  .strict()

export const DecisionRegistrationSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .describe("Decision key, e.g. runtime, backend_framework, test_framework, user_workflows, visual_surfaces"),
    value: z
      .string()
      .min(1)
      .describe("Decision value, e.g. Bun, Hono, bun:test, or a concise comma/semicolon-separated inventory"),
    reason: z.string().describe("Why this decision was made (based on codebase evidence)"),
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

export function createRequirementsOutputTools(options: RequirementsOutputToolOptions = {}) {
  let collector = emptyCollector()
  const tools = {
    register_requirement: tool({
      description: "Register a parsed requirement from user input. Call once per requirement.",
      inputSchema: RequirementRegistrationSchema,
      execute: async ({ id, type, description, acceptance, non_goals, evidence_refs = [] }) => {
        if (collector.requirements.some((r) => r.id === id)) return `Error: ${id} already registered`
        collector.requirements.push({ id, type, description, acceptance, non_goals, evidence_refs })
        return `OK: ${id} registered (${collector.requirements.length} total)`
      },
    }),

    register_decision: options.taskID
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
        }),
  }

  return {
    tools,
    collector,
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
