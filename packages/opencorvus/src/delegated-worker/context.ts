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
      "Discover durable Task evidence with artifact_search, then read every selected locator to complete=true.",
    ].join("\n"),
    renderUserRequestSection({ heading: "## Original request", request: input.task.request, taskID: input.task.id }),
  ]
}
