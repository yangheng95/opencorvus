import { setAppStore } from "../store/app"
import { apiJson, captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { activeProjectDirectory, projectScopedPath } from "./project-directory"
import { settingsStore } from "../store/settings"

export interface ProjectMemoryOptions { authority?: ApiAuthority; directory?: string }
function memoryScope(options: ProjectMemoryOptions) {
  const authority = options.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  const directory = options.directory ?? activeProjectDirectory()
  const epoch = settingsStore.directoryEpoch
  return { authority, directory, owns: () => isApiAuthorityCurrent(authority) && epoch === settingsStore.directoryEpoch && directory === activeProjectDirectory() }
}

type ProjectMemoryDocument = {
  status: string
  pendingCount: number
  tokenCount: number
  notice?: { status: string; message: string; generation: string; acknowledged: boolean }
}

export async function refreshProjectMemory(options: ProjectMemoryOptions = {}): Promise<ProjectMemoryDocument> {
  const scope = memoryScope(options)
  const document = await apiJson<ProjectMemoryDocument>(projectScopedPath("experimental/project-memory", scope.directory), { authority: scope.authority })
  if (scope.owns()) setAppStore("projectMemory", document)
  return document
}

export async function organizeProjectMemory(options: ProjectMemoryOptions = {}): Promise<ProjectMemoryDocument> {
  const scope = memoryScope(options)
  const response = await apiJson<{ document: ProjectMemoryDocument }>(projectScopedPath("experimental/project-memory/organize", scope.directory), {
    authority: scope.authority,
    method: "POST",
  })
  if (scope.owns()) setAppStore("projectMemory", response.document)
  return response.document
}

export async function acknowledgeProjectMemoryNotice(generation: string, options: ProjectMemoryOptions = {}): Promise<void> {
  const scope = memoryScope(options)
  await apiJson(projectScopedPath("experimental/project-memory/notice/acknowledge", scope.directory), {
    authority: scope.authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ generation }),
  })
  if (scope.owns()) await refreshProjectMemory(scope)
}
