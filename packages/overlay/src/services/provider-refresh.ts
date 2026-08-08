import { apiJson } from "./api"
import { AppLog } from "../utils/log"

export interface ProviderRefreshIssue {
  phase?: string
  providerID?: string
  message: string
}

export interface ProviderRefreshResult {
  ok: boolean
  fetchedAt?: number
  error?: string
  issues?: ProviderRefreshIssue[]
}

type ProviderRefreshResource = "catalog" | "models"

function refreshPath(resource: ProviderRefreshResource, directory: string): string {
  const scopedDirectory = directory.trim()
  const suffix = resource === "models" ? "models/refresh" : "refresh"
  return scopedDirectory
    ? `provider/${suffix}?directory=${encodeURIComponent(scopedDirectory)}`
    : `global/providers/${suffix}`
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error || "unknown")
}

async function requestProviderRefresh(
  resource: ProviderRefreshResource,
  directory: string,
): Promise<ProviderRefreshResult> {
  const path = refreshPath(resource, directory)
  try {
    const result = (await apiJson(path, { method: "POST" })) as ProviderRefreshResult
    if (!result.ok) {
      AppLog.error("provider-refresh", `Provider ${resource} refresh failed`, {
        directory,
        error: result.error || "unknown",
        path,
      })
    }
    if (result.issues?.length) {
      AppLog.warn("provider-refresh", `Provider ${resource} refresh completed with issues`, {
        directory,
        issues: result.issues,
        path,
      })
    }
    return result
  } catch (error) {
    AppLog.error("provider-refresh", `Provider ${resource} refresh request failed`, {
      directory,
      error: errorMessage(error),
      path,
    })
    throw error
  }
}

export function requestProviderCatalogRefresh(directory: string): Promise<ProviderRefreshResult> {
  return requestProviderRefresh("catalog", directory)
}

export function requestProviderModelsRefresh(directory: string): Promise<ProviderRefreshResult> {
  return requestProviderRefresh("models", directory)
}
