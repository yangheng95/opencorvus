import { AcceptanceSpecSchema, renderSpecsAsText } from "@/acceptance/types"
import type { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { requireTask, resolveCurrentGoalMembershipContext } from "@/engine/store"
import { z } from "zod"
import type { WorkloadPromptInput } from "./prompt"

const StringArraySchema = z.array(z.string().trim().min(1))

export interface WorkloadInputRefs {
  taskID: string
  workScope: ProjectedAgentWorkScope
  goalIDs: string[]
}

/**
 * Build the provider-visible workload prompt projection from exact durable
 * refs. This object is process-local and is never persisted or handed across
 * the Orchestrator-to-Agent boundary.
 */
export function projectWorkloadInput(input: WorkloadInputRefs): WorkloadPromptInput {
  const task = requireTask(input.taskID)
  const selectedGoalIDs = new Set(input.goalIDs)

  const membership = resolveCurrentGoalMembershipContext(input.taskID)
  const goalsByID = new Map(membership.goals.map((goal) => [goal.goal.id, goal]))
  const missingGoalIDs = [...selectedGoalIDs].filter((goalID) => !goalsByID.has(goalID))
  if (missingGoalIDs.length > 0) {
    throw new Error(
      `Selected Goal IDs are not members of the current GoalGraph for Task ${input.taskID}: ${missingGoalIDs.join(", ")}`,
    )
  }
  const goals = [...selectedGoalIDs].flatMap((goalID) => {
    const current = goalsByID.get(goalID)
    if (!current) return []
    const goal = current.goal
    return [
      {
        id: goal.id,
        title: goal.title,
        objective: goal.objective,
        acceptance_specs: AcceptanceSpecSchema.array()
          .parse(goal.acceptance_specs)
          .map((spec) => renderSpecsAsText([spec])),
        acceptance_spec_ids: AcceptanceSpecSchema.array()
          .parse(goal.acceptance_specs)
          .map((spec) => spec.id),
        owned_paths: StringArraySchema.parse(goal.owned_paths),
        kind: goal.kind,
      },
    ]
  })

  const observationSections: string[] = []
  if (selectedGoalIDs.size === 0) {
    observationSections.push("## Goal selection observation\n- No exact Goal ref was selected for this Turn.")
  }

  observationSections.push(
    [
      "## Durable Artifact discovery",
      "- Search the Task Artifact catalog yourself for current and historical ContractGraph, design, research, and review evidence.",
      "- Select by exact name/kind, recency, and fuzzy relevance, then completely read every Artifact you use with `artifact_read`.",
      "- No upstream participant selected or copied Artifact bodies into this prompt; an empty result is a visible missing-evidence fact.",
    ].join("\n"),
  )

  return {
    taskTitle: task.title,
    taskRequest: task.request,
    taskID: task.id,
    goals,
    observationSections,
  }
}
