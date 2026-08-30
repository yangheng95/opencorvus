import type { ExpertSquadPackageRevision } from "@/expert-squad/package-revision"

export type ProjectedTaskToolRuntimeBinding = Readonly<{
  taskID: string
  projectDirectory: string
  ownerKind: "projected-scheduler" | "projected-worker"
  expertSquadID: string
  packageRevision: ExpertSquadPackageRevision
  agentID: string
  projectionHash: string
  providerKind: "package-tool" | "package-mcp-tool" | "default-mcp-tool"
  toolRef: string
  providerName: string
  runtimeToolID: string
  mcpServerConfigSHA256?: string
}>

export type PackageToolRuntimeBinding = ProjectedTaskToolRuntimeBinding &
  Readonly<{
    providerKind: "package-tool"
    compiledBundleSHA256: string
  }>

const projectedTaskToolRuntimeBinding = Symbol("opencorvus.projected-task-tool-runtime-binding")

export function bindProjectedTaskToolRuntime<T extends object>(tool: T, binding: ProjectedTaskToolRuntimeBinding): T {
  Object.defineProperty(tool, projectedTaskToolRuntimeBinding, {
    value: Object.freeze({ ...binding, packageRevision: Object.freeze({ ...binding.packageRevision }) }),
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return tool
}

export function bindPackageToolRuntime<T extends object>(tool: T, binding: PackageToolRuntimeBinding): T {
  return bindProjectedTaskToolRuntime(tool, binding)
}

export function projectedTaskToolRuntimeBindingOf(
  tool: object | undefined,
): ProjectedTaskToolRuntimeBinding | undefined {
  return (
    tool &&
    (tool as { [projectedTaskToolRuntimeBinding]?: ProjectedTaskToolRuntimeBinding })[
      projectedTaskToolRuntimeBinding
    ]
  )
}
