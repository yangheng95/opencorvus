import type { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import type { TaskRow } from "@/engine/store"
import { renderUserRequestSection } from "@/intent/request-prompt"

export function delegatedWorkerContextSections(input: {
  reason: string
  task: TaskRow
  workScope: ProjectedAgentWorkScope
  deliverySliceRevisionIDs: string[]
}): string[] {
  return [
    [
      `## Task: ${input.task.title}`,
      `Reason: ${input.reason}`,
      `Exact Delivery Slice revision subjects: ${input.deliverySliceRevisionIDs.join(", ") || "(none)"}`,
      "These immutable subjects scope work and evidence only; they do not create execution or lifecycle instances.",
      "For an explicit repository path, reveal and use the read Tool on that exact path. For durable Task Artifact evidence, use artifact_search and then read every selected Artifact locator to complete=true. Do not substitute one source authority for the other.",
    ].join("\n"),
    renderUserRequestSection({ heading: "## Original request", request: input.task.request, taskID: input.task.id }),
  ]
}
