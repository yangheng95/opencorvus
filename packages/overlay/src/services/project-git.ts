import { apiJson, serverSettledRequest, type ApiAuthority } from "./api"

export interface ProjectGitInitializationResult {
  created: boolean
}

export interface ProjectGitInitializationOptions {
  signal?: AbortSignal
  authority?: ApiAuthority
}

/**
 * Initialize one exact project directory through the canonical server
 * endpoint. Callers pass the directory explicitly so a concurrent workspace
 * selection cannot redirect this identity mutation through ambient API state.
 */
export async function initializeProjectDirectoryGit(
  directory: string,
  options: ProjectGitInitializationOptions = {},
): Promise<ProjectGitInitializationResult> {
  const target = directory.trim()
  if (!target) throw new Error("Git initialization requires a project directory")
  const query = new URLSearchParams({ directory: target })
  return await apiJson(
    `project/current/init-git?${query.toString()}`,
    serverSettledRequest({ method: "POST", signal: options.signal, authority: options.authority }),
  )
}
