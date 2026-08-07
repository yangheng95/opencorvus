/**
 * User-prompt builder for the Goal Workload Analyst.
 *
 * The workload analyst receives an ephemeral projection resolved from exact
 * Delivery Slice revision and Artifact refs. Slice refs are evidence subjects,
 * never worker, dispatch, or lifecycle identities.
 */
import { renderPromptSections } from "@/agent/prompt-projection"
import { renderUserRequestSection } from "@/intent/request-prompt"

export interface GoalWorkloadGoalInput {
  id: string
  title: string
  objective: string
  acceptance_specs: string[]
  acceptance_spec_ids: string[]
  owned_paths: string[]
  kind: string
}

export interface ReferenceCoverageInput {
  id: string
  surface: string
  visual_spec_ids: string[]
  expectation: string
}

export interface WorkloadPromptInput {
  taskTitle: string
  taskRequest: string
  taskID: string
  goals: GoalWorkloadGoalInput[]
  referenceCoverage?: ReferenceCoverageInput[]
  observationSections: string[]
}

export function buildWorkloadUserPrompt(input: WorkloadPromptInput): string {
  const sections: string[] = []

  sections.push(
    "# Delegation\n\nThe active package scheduler is asking this projected workload-analysis consumer to deeply read the " +
      "available Task evidence and persisted delivery contract, then produce one workload brief per Delivery Slice revision. You do not write code, " +
      "create Slices, modify Slices, dispatch workers, or act as a gate. Fight underestimation, and flag Slices whose declared scope is " +
      "too broad or under-specified to remain an unambiguous delivery and acceptance subject. Workflow nodes execute once per Task regardless of Slice count.",
  )
  sections.push(
    renderUserRequestSection({ heading: "# Original request", request: input.taskRequest, taskID: input.taskID }),
  )

  const contextSection = renderPromptSections(input.observationSections)
  if (contextSection) sections.push(contextSection)

  const goalText = input.goals
    .map((g) => {
      const lines = [`## ${g.id}: ${g.title} [${g.kind}]`, `objective: ${g.objective}`]
      if (g.acceptance_specs.length > 0) {
        lines.push(`acceptance_specs:\n${g.acceptance_specs.map((s) => `  - ${s}`).join("\n")}`)
      }
      if (g.owned_paths.length > 0) lines.push(`owned_paths: ${g.owned_paths.join(", ")}`)
      return lines.join("\n")
    })
    .join("\n\n")
  sections.push(`# Delivery Slice graph under review (${input.goals.length} Slices)\n\n${goalText}`)

  if (input.referenceCoverage && input.referenceCoverage.length > 0) {
    const rcText = input.referenceCoverage
      .map((r) => {
        const vis = r.visual_spec_ids.length > 0 ? ` visual_specs=[${r.visual_spec_ids.join(", ")}]` : ""
        return `- **${r.id}** surface=${r.surface}${vis} — ${r.expectation}`
      })
      .join("\n")
    sections.push(`# Reference coverage (REFERENCE these ids — do not restate the surfaces)\n\n${rcText}`)
  }

  sections.push(
    [
      "# Your task",
      "",
      "For EACH Delivery Slice revision above, call `register_workload_brief`:",
      "- Read the template sections relevant to the Slice; base your counts on evidence, not the Goal label.",
      "- ORIGINATE: `why_not_smaller`, `underestimation_traps`, `execution_inventory` (counts), `verification_inventory`.",
      "- REFERENCE surfaces/contracts only with identities declared by an Artifact you completely read (`references.*`). Leave inapplicable arrays empty. Never put Artifact locators or JSON fragments in `design_sections`, and never restate a surface in your own prose.",
      "- Set `decomposition_concern` ONLY when the Slice contract is too broad or under-specified to identify one coherent delivery and acceptance subject. State the evidence, but do not prescribe a replacement plan; projected plan consumers own plan revision.",
      "- Watch for assembly-owner Slices: a small-looking contract that stitches several sibling-produced surfaces is a classic underestimate.",
      "",
      "End with a visible assistant summary of completed, missing, and conflicting workload evidence.",
    ].join("\n"),
  )

  return sections.join("\n\n")
}
