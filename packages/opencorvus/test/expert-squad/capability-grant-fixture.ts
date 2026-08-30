import type { RuntimeTemplateID } from "../../src/agent/runtime-template-id"
import {
  materializeExpertSquadCapabilities,
  type MaterializedExpertSquadCapabilities,
} from "../../src/expert-squad/capability-grants"
import type { ExpertSquadRegistry } from "../../src/expert-squad/registry"

export function schedulerCapabilityGrants(
  manifest: ExpertSquadRegistry.Manifest,
): MaterializedExpertSquadCapabilities {
  return materializeExpertSquadCapabilities({
    manifest,
    projection: manifest.capability_projection.scheduler,
    runtime: { kind: "scheduler" },
    context: "test capability_projection.scheduler",
  })
}

export function agentCapabilityGrants(
  manifest: ExpertSquadRegistry.Manifest,
  agentID: string,
): MaterializedExpertSquadCapabilities {
  const projection = manifest.capability_projection.agents[agentID]
  if (!projection) throw new Error(`Test manifest has no projection for ${agentID}`)
  return materializeExpertSquadCapabilities({
    manifest,
    projection,
    runtime: { kind: "worker", baseRole: projection.base_role as RuntimeTemplateID },
    context: `test capability_projection.agents.${agentID}`,
  })
}

export function allCapabilityGrants(manifest: ExpertSquadRegistry.Manifest): MaterializedExpertSquadCapabilities[] {
  return [
    schedulerCapabilityGrants(manifest),
    ...Object.keys(manifest.capability_projection.agents).map((agentID) => agentCapabilityGrants(manifest, agentID)),
  ]
}
