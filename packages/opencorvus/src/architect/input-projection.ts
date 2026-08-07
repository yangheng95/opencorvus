import { selectPromptAttachments } from "@/agent/prompt-projection"
import type { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { createDecisionLog } from "@/decision-log"
import { requireTask } from "@/engine/store"
import type { FrontendDesignMode as VisualDesignAuthority } from "@/frontend-design/schema"
import type { GoalContractFields } from "@/pipeline/types"
import type { DecisionLog } from "@/decision-log"
import type { ParsedRequirement, RequirementsDecision } from "./types"

export interface ArchitectInputRefs {
  instruction: string
  taskID: string
  workScope: ProjectedAgentWorkScope
  attachmentRefs: string[]
}

export interface ArchitectPromptProjection {
  instruction: string
  taskID: string
  taskTitle: string
  taskRequest: string
  goals: Array<
    GoalContractFields & { order_index?: number }
  >
  decisionLog: DecisionLog
  requirements: ParsedRequirement[]
  requirementDecisions: RequirementsDecision[]
  knownVisualSpecIDs: string[]
  knownResearchEvidenceRefs: string[]
  observationSections: string[]
  designAuthority?: VisualDesignAuthority
  attachments: Array<{ sha: string; url: string; mime: string; size: number; filename?: string }>
}

/**
 * Resolve exact durable refs into one process-local Architect prompt
 * projection. No caller can supply parallel payload or context-section copies.
 */
export function projectArchitectInput(input: ArchitectInputRefs): ArchitectPromptProjection {
  const task = requireTask(input.taskID)
  const observationSections: string[] = [
    [
      "## Durable Artifact discovery and binding",
      "- Search this Task's Artifact catalog yourself by exact name/kind, current or historical version, recency, and fuzzy relevance.",
      "- Completely read the RequirementSet and every other Artifact you use with `artifact_read`; no upstream participant selected or copied an Artifact body into this prompt.",
      "- Completely read and select the exact RequirementSet and linked evidence needed for this single Architect occurrence before the first output-tool call.",
      "- A projection:null GoalGraph Candidate may also be selected when its proposed contracts materially support this output, but it is supporting evidence, never the executable prior or a source of automatically registered current Goals.",
      "- When using contracts or fidelity from any Candidate or historical GoalGraphProjection, completely read and select its exact linked ArchitectContractGraph too.",
      "- Historical GoalGraphProjection versions may be selected only as comparison evidence for a newly scoped Task; they never authorize another Architect occurrence in this Task.",
      "- An empty search result is a visible missing-evidence fact. Do not invent Requirement IDs, prior Goals, or design authority.",
    ].join("\n"),
  ]
  const selectedAttachments = selectPromptAttachments(
    Array.isArray(task.attachments) ? task.attachments : [],
    input.attachmentRefs,
  )
  if (selectedAttachments.missingRefs.length > 0) {
    observationSections.push(
      `## Missing selected Attachment facts\n${selectedAttachments.missingRefs
        .map((reference) => `- ${reference}`)
        .join("\n")}`,
    )
  }
  return {
    instruction: input.instruction,
    taskID: input.taskID,
    taskTitle: task.title,
    taskRequest: task.request,
    goals: [],
    decisionLog: createDecisionLog(input.taskID),
    requirements: [],
    requirementDecisions: [],
    knownVisualSpecIDs: [],
    knownResearchEvidenceRefs: [],
    observationSections,
    attachments: selectedAttachments.attachments as ArchitectPromptProjection["attachments"],
  }
}
