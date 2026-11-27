import type { ElementDefinition } from "cytoscape"
import type { InteractiveArtifactPayload } from "./interactive-artifact"

export type ArtifactNetworkPayload = Extract<InteractiveArtifactPayload, { renderer: "network@1" }>

/** Graph data is mutable presentation state; the published payload owns exports. */
export function artifactNetworkElements(payload: ArtifactNetworkPayload): ElementDefinition[] {
  return [
    ...payload.nodes.map((node) => ({ data: structuredClone(node) })),
    ...payload.edges.map((edge) => ({
      data: { ...edge, directed: edge.directed ?? true, weight: edge.weight ?? 1 },
    })),
  ]
}
