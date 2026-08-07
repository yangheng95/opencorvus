import type { RuntimeTemplateID } from "@/agent/runtime-template-id"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"

export const SCOPED_PROJECT_SOURCE_BOUNDARY_PROMPT = `## Scoped Project Source Boundary

This runtime template does not own broad project-source work. The current projected agent remains responsible for its assigned deliverable but must keep source inspection narrow: read only files, evidence artifacts, and agent-owned outputs directly needed for that deliverable; do not read or write broad project source areas; do not load task-irrelevant skills. If broad implementation, repair investigation, or rendered-interface validation is required, report the concrete need to the Orchestrator so it can dispatch a projected capability that owns that work.`

export const SCHEDULER_PROJECT_SOURCE_BOUNDARY_PROMPT = `## Scheduler Project Source Boundary

The scheduler coordinates projected capabilities and lifecycle decisions. Keep direct source inspection narrow to evidence needed for a dispatch or lifecycle decision; delegate broad implementation, repair investigation, and rendered-interface validation to a projected agent whose runtime template owns that work.`

export function requiresScopedProjectSourceBoundary(baseRole: RuntimeTemplateID): boolean {
  return !RuntimeTemplateRegistry.get(baseRole).broadProjectSourceWork
}

export function appendScopedProjectSourceBoundary(input: { baseRole: RuntimeTemplateID; prompt: string }): string {
  if (!requiresScopedProjectSourceBoundary(input.baseRole)) return input.prompt
  return [input.prompt.trimEnd(), SCOPED_PROJECT_SOURCE_BOUNDARY_PROMPT].join("\n\n")
}

export function appendSchedulerProjectSourceBoundary(prompt: string): string {
  return [prompt.trimEnd(), SCHEDULER_PROJECT_SOURCE_BOUNDARY_PROMPT].join("\n\n")
}
