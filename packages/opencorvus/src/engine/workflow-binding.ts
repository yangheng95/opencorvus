import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import type { ExpertSquadRegistry } from "@/expert-squad/registry"
import z from "zod"
import {
  ExpertSquadPackageRevisionBindingSchema,
  expertSquadPackageRevisionBinding,
  resolvedPackageRevisionFromBinding as resolvedPackageRevisionFromPackageBinding,
} from "./expert-squad-package-revision-binding"

export { ExpertSquadPackageRevisionBindingSchema }

export const SelectedWorkflowNodeBindingSchema = z
  .object({
    node_id: z.string().min(1),
    agent_id: z.string().min(1),
    depends_on: z.array(z.string().min(1)),
  })
  .strict()

export const SelectedWorkflowBindingSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("direct"),
      package_revision: ExpertSquadPackageRevisionBindingSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("virtual_workflow"),
      workflow_id: z.string().min(1),
      package_revision: ExpertSquadPackageRevisionBindingSchema,
      nodes: z.array(SelectedWorkflowNodeBindingSchema).min(1),
    })
    .strict(),
])

export type SelectedWorkflowBinding = z.infer<typeof SelectedWorkflowBindingSchema>

export function resolvedPackageRevisionFromBinding(binding: SelectedWorkflowBinding) {
  return resolvedPackageRevisionFromPackageBinding(binding.package_revision)
}

export interface WorkflowProjection {
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
  virtualWorkflows: ExpertSquadRegistry.VirtualWorkflows
}

export const DispatchWorkflowSubjectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("direct") }).strict(),
  z
    .object({
      kind: z.literal("virtual_workflow"),
      workflow_id: z.string().min(1),
      node_id: z.string().min(1),
    })
    .strict(),
])

export type DispatchWorkflowSubject = z.infer<typeof DispatchWorkflowSubjectSchema>

export function selectedWorkflowBinding(input: {
  projection: WorkflowProjection
  workflowID: string | null
}): SelectedWorkflowBinding {
  const packageRevision = expertSquadPackageRevisionBinding(input.projection.packageRevision)
  if (input.workflowID === null) {
    return SelectedWorkflowBindingSchema.parse({
      kind: "direct",
      package_revision: packageRevision,
    })
  }
  const workflow = input.projection.virtualWorkflows[input.workflowID]
  if (!workflow) {
    throw new Error(
      `Expert squad package ${input.projection.packageRevision.id} does not declare workflow ${input.workflowID}`,
    )
  }
  return SelectedWorkflowBindingSchema.parse({
    kind: "virtual_workflow",
    workflow_id: input.workflowID,
    package_revision: packageRevision,
    nodes: Object.entries(workflow.nodes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([nodeID, node]) => ({
        node_id: nodeID,
        agent_id: node.agent_id,
        depends_on: [...node.depends_on],
      })),
  })
}

export function dispatchWorkflowBinding(input: {
  projection: WorkflowProjection
  subject: DispatchWorkflowSubject
  targetAgentID: string
}): { binding: SelectedWorkflowBinding; workflowNodeID: string | null } {
  if (input.subject.kind === "direct") {
    return {
      binding: selectedWorkflowBinding({ projection: input.projection, workflowID: null }),
      workflowNodeID: null,
    }
  }
  const binding = selectedWorkflowBinding({
    projection: input.projection,
    workflowID: input.subject.workflow_id,
  })
  if (binding.kind !== "virtual_workflow") {
    throw new Error(`Workflow ${input.subject.workflow_id} did not resolve as a virtual workflow`)
  }
  const workflowNodeID = input.subject.node_id
  const node = binding.nodes.find((candidate) => candidate.node_id === workflowNodeID)
  if (!node) {
    throw new Error(`Workflow ${binding.workflow_id} does not declare node ${workflowNodeID}`)
  }
  if (node.agent_id !== input.targetAgentID) {
    throw new Error(
      `Workflow ${binding.workflow_id} node ${node.node_id} targets ${node.agent_id}, not ${input.targetAgentID}`,
    )
  }
  return { binding, workflowNodeID: node.node_id }
}

export function sameSelectedWorkflowBinding(
  left: SelectedWorkflowBinding,
  right: SelectedWorkflowBinding,
): boolean {
  return (
    JSON.stringify(SelectedWorkflowBindingSchema.parse(left)) ===
    JSON.stringify(SelectedWorkflowBindingSchema.parse(right))
  )
}

export function workflowProjectionFromProjectedAgents(
  agents: readonly PromptProfileResolver.ResolvedProjectedAgent[],
): WorkflowProjection {
  const first = agents[0]
  if (!first) throw new Error("Workflow projection requires at least one projected agent")
  const projection = {
    packageRevision: first.packageRevision,
    virtualWorkflows: first.virtualWorkflows,
  }
  const expectedBinding = selectedWorkflowBinding({ projection, workflowID: null })
  for (const agent of agents.slice(1)) {
    const candidate = selectedWorkflowBinding({
      projection: {
        packageRevision: agent.packageRevision,
        virtualWorkflows: agent.virtualWorkflows,
      },
      workflowID: null,
    })
    if (!sameSelectedWorkflowBinding(expectedBinding, candidate)) {
      throw new Error("Projected dispatch agents do not share one expert squad package revision")
    }
    if (JSON.stringify(agent.virtualWorkflows) !== JSON.stringify(first.virtualWorkflows)) {
      throw new Error("Projected dispatch agents do not share one immutable virtual workflow projection")
    }
  }
  return projection
}
