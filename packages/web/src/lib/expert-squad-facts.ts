import type { ExpertSquadRegistry } from "../../../opencorvus/src/expert-squad/registry"

type FactSource = Pick<
  ExpertSquadRegistry.CatalogPackage,
  | "namespace"
  | "id"
  | "name"
  | "label"
  | "description"
  | "version"
  | "packageDigest"
  | "selector"
  | "manifest"
>

export function projectExpertSquadFacts(loaded: FactSource) {
  const projections = [
    loaded.manifest.capability_projection.scheduler,
    ...Object.values(loaded.manifest.capability_projection.agents),
  ]
  const skills = new Set<string>()
  const tools = new Set<string>()
  const mcp = new Set<string>()
  const packageSkills = new Set<string>()
  const packageTools = new Set<string>()
  const packageMcp = new Set<string>()

  for (const projection of projections) {
    for (const ref of [...projection.default_skill_refs, ...projection.package_skill_refs]) skills.add(ref)
    for (const ref of projection.package_skill_refs) packageSkills.add(ref)
    for (const ref of [
      ...projection.built_in_tool_ids,
      ...projection.default_tool_refs,
      ...projection.package_tool_refs,
    ]) {
      tools.add(ref)
    }
    for (const ref of projection.package_tool_refs) packageTools.add(ref)

    const mcpRefs = [
      ...projection.default_mcp_server_refs,
      ...projection.package_mcp_server_refs,
      ...projection.default_mcp_tool_refs,
      ...projection.package_mcp_tool_refs,
      ...projection.default_mcp_prompt_refs,
      ...projection.package_mcp_prompt_refs,
      ...projection.default_mcp_resource_refs,
      ...projection.package_mcp_resource_refs,
    ]
    for (const ref of mcpRefs) mcp.add(ref)
    for (const ref of [
      ...projection.package_mcp_server_refs,
      ...projection.package_mcp_tool_refs,
      ...projection.package_mcp_prompt_refs,
      ...projection.package_mcp_resource_refs,
    ]) {
      packageMcp.add(ref)
    }
  }

  return {
    identity: {
      namespace: loaded.namespace,
      id: loaded.id,
      version: loaded.version,
      digest: loaded.packageDigest,
    },
    name: loaded.name,
    label: loaded.label,
    description: loaded.description ?? "",
    selectorSummary: loaded.selector.summary,
    pillars: loaded.manifest.product_pillars,
    agents: Object.entries(loaded.manifest.capability_projection.agents).map(([id, projection]) => ({
      id,
      label: projection.label,
      description: projection.description,
      baseRole: projection.base_role,
    })),
    workflows: Object.entries(loaded.manifest.capability_projection.virtual_workflows).map(([id, workflow]) => ({
      id,
      label: workflow.label,
      description: workflow.description,
      nodes: Object.entries(workflow.nodes).map(([nodeID, node]) => ({
        id: nodeID,
        agentID: node.agent_id,
        description: node.description,
        dependsOn: node.depends_on,
      })),
    })),
    projectedCapabilities: {
      skills: skills.size,
      tools: tools.size,
      mcp: mcp.size,
    },
    packageOwnedCapabilities: {
      skills: packageSkills.size,
      tools: packageTools.size,
      mcp: packageMcp.size,
    },
    configuration: {
      fields: loaded.manifest.configuration?.fields.length ?? 0,
      required:
        loaded.manifest.configuration?.fields.filter((field: { required: boolean }) => field.required).length ?? 0,
    },
  }
}

export type ExpertSquadFacts = ReturnType<typeof projectExpertSquadFacts>
