import { selectPromptAttachments, type PromptAttachmentRef } from "@/agent/prompt-projection"
import type { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { requireTask } from "@/engine/store"

export interface RequirementsInputRefs {
  instruction: string
  taskID: string
  workScope: ProjectedAgentWorkScope
  attachmentRefs: string[]
}

export interface RequirementsPromptProjection {
  instruction: string
  taskID: string
  taskTitle: string
  taskRequest: string
  attachments: PromptAttachmentRef[]
  observationSections: string[]
}

/** Rebuild one transient Requirements prompt from exact durable refs. */
export function projectRequirementsInput(input: RequirementsInputRefs): RequirementsPromptProjection {
  const task = requireTask(input.taskID)
  const selectedAttachments = selectPromptAttachments(
    Array.isArray(task.attachments) ? task.attachments : [],
    input.attachmentRefs,
  )
  const observationSections: string[] = []

  observationSections.push(
    [
      "## Task Artifact discovery",
      "Enumerate the current Task catalog with `artifact_search` before registering requirements.",
      "Select and read relevant IntentAnalysis, research, and other durable inputs yourself.",
      "Only locators read completely by this Requirements Session may appear in requirement evidence_refs.",
    ].join("\n"),
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
    attachments: selectedAttachments.attachments,
    observationSections,
  }
}
