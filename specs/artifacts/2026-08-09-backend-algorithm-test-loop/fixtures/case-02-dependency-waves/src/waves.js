export class DependencyCycleError extends Error {
  constructor(nodes) {
    super(`Dependency cycle: ${nodes.join(", ")}`)
    this.name = "DependencyCycleError"
    this.code = "DEPENDENCY_CYCLE"
    this.nodes = nodes
  }
}

export function dependencyWaves(graph) {
  throw new Error("Not implemented")
}
