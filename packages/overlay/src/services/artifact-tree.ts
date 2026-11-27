import type { InteractiveArtifactPayload } from "./interactive-artifact"

type TreeNode = Extract<InteractiveArtifactPayload, { renderer: "tree@1" }>["nodes"][number]

export const normalizeArtifactTreeQuery = (query: string): string => query.trim().toLowerCase()

/** Search the published labels/descriptions and retain their real ancestors. */
export function createArtifactTreeSearch(nodes: readonly TreeNode[]) {
  const byID = new Map(nodes.map((node) => [node.id, node]))
  return (query: string): Set<string> => {
    const value = normalizeArtifactTreeQuery(query)
    if (!value) return new Set(nodes.map((node) => node.id))
    const visible = new Set<string>()
    for (const node of nodes) {
      if (!`${node.label} ${node.description ?? ""}`.toLowerCase().includes(value)) continue
      let current: TreeNode | undefined = node
      while (current) {
        visible.add(current.id)
        current = current.parentID ? byID.get(current.parentID) : undefined
      }
    }
    return visible
  }
}
