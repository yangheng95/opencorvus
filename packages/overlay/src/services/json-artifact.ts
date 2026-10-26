import type { InteractiveArtifactPayload } from "./interactive-artifact"

type TreePayload = Extract<InteractiveArtifactPayload, { renderer: "tree@1" }>

/** Preserve JSON value kinds in the shared tree; exports keep the original text. */
export function jsonArtifactTree(title: string, source: string): TreePayload {
  const nodes: TreePayload["nodes"] = []
  const visit = (label: string, value: unknown, parentID?: string): void => {
    const id = `json-${nodes.length}`
    const entries =
      value !== null && typeof value === "object"
        ? Array.isArray(value)
          ? value.map((item, index) => [`[${index}]`, item] as const)
          : Object.entries(value)
        : undefined
    let description: string | undefined
    if (entries) {
      description = Array.isArray(value) ? (entries.length ? "[…]" : "[]") : (entries.length ? "{…}" : "{}")
    } else {
      description = typeof value === "number" ? String(value) : JSON.stringify(value)
    }
    nodes.push({ id, label, ...(parentID ? { parentID } : {}), description })
    for (const [key, item] of entries ?? []) visit(key, item, id)
  }
  visit(title, JSON.parse(source))
  return { schemaVersion: "1", renderer: "tree@1", title, nodes, defaultExpandedDepth: 2 }
}
