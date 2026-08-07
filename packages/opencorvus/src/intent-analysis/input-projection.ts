import { selectPromptAttachments, type PromptAttachmentRef } from "@/agent/prompt-projection"
import type { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { requireTask } from "@/engine/store"

export interface IntentAnalysisInputRefs {
  instruction: string
  taskID: string
  workScope: ProjectedAgentWorkScope
  attachmentRefs: string[]
}

export interface IntentAnalysisPromptProjection {
  instruction: string
  taskID: string
  taskTitle: string
  taskRequest: string
  attachments: PromptAttachmentRef[]
  observationSections: string[]
}

/** Rebuild one transient Intent Analysis prompt from exact durable refs. */
export function projectIntentAnalysisInput(input: IntentAnalysisInputRefs): IntentAnalysisPromptProjection {
  const task = requireTask(input.taskID)
  const selectedAttachments = selectPromptAttachments(
    Array.isArray(task.attachments) ? task.attachments : [],
    input.attachmentRefs,
  )
  const observationSections = [
    [
      "## Task Artifact discovery",
      "Use `artifact_search` to enumerate the current Task catalog before classification.",
      "Select and read any relevant durable evidence yourself; no upstream scheduler selected Artifact input for this Turn.",
      "An empty catalog is a valid observation.",
    ].join("\n"),
  ]
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
    attachments: selectedAttachments.attachments,
    observationSections,
  }
}
