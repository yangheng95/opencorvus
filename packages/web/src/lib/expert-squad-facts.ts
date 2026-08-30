import type { ExpertSquadRegistry } from "../../../opencorvus/src/expert-squad/registry"
import { CapabilityRefCodec, type CapabilityRef } from "@opencorvus-ai/util/capability-ref"

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

  const count = (ref: CapabilityRef) => {
    if (ref.kind === "skill") {
      skills.add(CapabilityRefCodec.encode(ref))
      if (ref.source === "package") packageSkills.add(ref.local_ref)
      return
    }
    if (ref.kind === "tool") {
      tools.add(CapabilityRefCodec.encode(ref))
      if (ref.source === "package") packageTools.add(ref.local_ref)
      return
    }
    if (!ref.kind.startsWith("mcp_")) return
    mcp.add(CapabilityRefCodec.encode(ref))
    if (ref.source === "package") packageMcp.add(ref.local_ref)
  }

  for (const projection of projections) {
    for (const encoded of projection.capability_refs) {
      const ref = CapabilityRefCodec.decode(encoded)
      if (ref.kind !== "capability_set") {
        count(ref)
        continue
      }
      if (ref.source !== "package") continue
      const set = loaded.manifest.capability_sets[ref.local_ref]
      if (!set) throw new Error(`Expert squad ${loaded.id} references missing capability set ${ref.local_ref}`)
      for (const member of set.member_refs) count(CapabilityRefCodec.decode(member))
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
