import type { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import type { GoalRow, TaskRow } from "@/engine/store"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { withAttachmentPromptSections } from "@/agent/prompt-projection"

export function delegatedWorkerContextSections(input: {
  reason: string
  task: TaskRow
  workScope: ProjectedAgentWorkScope
  deliverySlices: readonly GoalRow[]
}): string[] {
  return withAttachmentPromptSections(
    [
      [
        `## Task: ${input.task.title}`,
        `Reason: ${input.reason}`,
        `Exact Delivery Slice revision subjects: ${input.deliverySlices.map((goal) => goal.id).join(", ") || "(none)"}`,
        "These immutable subjects scope work and evidence only; they do not create execution or lifecycle instances.",
        "For an explicit repository path, reveal and use the read Tool on that exact path. For durable Task Artifact evidence, use artifact_search and then read every selected Artifact locator to complete=true. Do not substitute one source authority for the other.",
      ].join("\n"),
      renderUserRequestSection({ heading: "## Original request", request: input.task.request, taskID: input.task.id }),
      delegatedWorkerAcceptanceSection(input.deliverySlices),
    ],
    input.task.attachments ?? undefined,
  )
}

export function delegatedWorkerAcceptanceSection(goals: readonly GoalRow[]): string {
  return [
    "## Selected Delivery Slice contracts",
    "These are the exact current revisions selected for this Turn. Apply the original request as well; selection does not waive obligations omitted from a Slice.",
    ...(goals.length
      ? goals.map((goal) =>
          [
            `### ${goal.id}: ${goal.title}`,
            goal.objective,
            `Owned paths: ${JSON.stringify(goal.owned_paths ?? [])}`,
            `Acceptance specs (exact current contract):\n${JSON.stringify(goal.acceptance_specs ?? [], null, 2)}`,
          ].join("\n"),
        )
      : ["(explicitly empty selection; apply the original request and delegated instruction)"]),
  ].join("\n\n")
}
