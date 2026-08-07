import { createSignal } from "solid-js"
import type {
  ExpertSquadCatalogResponse,
  ExpertSquadConfigurationGetResponse,
  ExpertSquadConfigurationUpdateData,
  ExpertSquadConfigurationUpdateResponse,
  ExpertSquadEvolutionAuthorizationData,
  ExpertSquadEvolutionAuthorizationResponse,
  ExpertSquadEvolutionHistoryData,
  ExpertSquadEvolutionHistoryDetailData,
  ExpertSquadEvolutionHistoryDetailResponse,
  ExpertSquadEvolutionHistoryResponse,
  ExpertSquadEvolutionMutationData,
  ExpertSquadEvolutionMutationResponse,
  ExpertSquadImportFileData,
  ExpertSquadImportFileResponse,
  ExpertSquadImportFolderData,
  ExpertSquadImportFolderResponse,
  ExpertSquadInstallPayloadResponse,
  ExpertSquadMarketResponse,
  ExpertSquadReleasePayloadResponse,
  ExpertSquadUpdateData,
  ExpertSquadUpdateResponse,
  ExpertSquadSettingsResponse,
} from "@opencorvus-ai/sdk"
import { appStore } from "../store/app"
import { apiJson } from "./api"
import { patchSessionConfig, updateConfig, type SessionConfigResponse } from "./config"

export type ExpertSquadCatalog = ExpertSquadCatalogResponse
export interface ExpertSquadCapabilitySurface {
  scope: { kind: "project"; directory: string }
  squad: ExpertSquadCatalog["squads"][number]
}
export type ExpertSquadSettingsSurface = ExpertSquadSettingsResponse
export type ExpertSquadConfiguration = ExpertSquadConfigurationGetResponse
export type ExpertSquadConfigurationUpdates = NonNullable<ExpertSquadConfigurationUpdateData["body"]>["updates"]
export type ExpertSquadOption = ExpertSquadCatalog["squads"][number]
export type ExpertSquadCapabilityProjectionEntry = Omit<
  ExpertSquadOption["capability_projection"]["scheduler"],
  "base_role" | "inherit_base_tools" | "prompt"
>
export type ExpertSquadCatalogScope = ExpertSquadCatalog["scope"]

export type ExpertSquadImportFolderInput = ExpertSquadImportFolderData["body"] & { directory: string }

export type ExpertSquadImportFileInput = ExpertSquadImportFileData["body"] & { directory: string }

export type ExpertSquadImportResult = ExpertSquadImportFolderResponse | ExpertSquadImportFileResponse

export type ExpertSquadReleasePayloadResult = ExpertSquadReleasePayloadResponse

export type ExpertSquadMarketItem = ExpertSquadMarketResponse[number]
export type ExpertSquadMarketInstallResult = ExpertSquadInstallPayloadResponse
export type ExpertSquadUpdateSource = NonNullable<ExpertSquadUpdateData["body"]>["source"]
export type ExpertSquadUpdateResult = ExpertSquadUpdateResponse
export type ExpertSquadEvolutionHistory = ExpertSquadEvolutionHistoryResponse
export type ExpertSquadEvolutionHistoryRecord = ExpertSquadEvolutionHistory["records"][number]
export type ExpertSquadEvolutionHistoryCandidate = ExpertSquadEvolutionHistoryRecord["candidates"][number]
export type ExpertSquadEvolutionHistoryComparison = ExpertSquadEvolutionHistoryCandidate["comparisons"][number]
export type ExpertSquadEvolutionHistoryDetail = ExpertSquadEvolutionHistoryDetailResponse
export type ExpertSquadEvolutionMutationIntent = NonNullable<ExpertSquadEvolutionAuthorizationData["body"]>["intent"]
export type ExpertSquadEvolutionMutationResult = ExpertSquadEvolutionMutationResponse

export interface ExpertSquadExportResult {
  id: string
  filename: string
  archiveBase64: string
  fileCount: number
}

export type ExpertSquadInstallationScope = "project" | "global"
/** Canonical identifier for the built-in Base expert squad. */
export const BASE_EXPERT_SQUAD_ID = "base" as const

export interface ExpertSquadUninstallResult {
  namespace: string
  id: string
  targetRoot: string
  installationScope: ExpertSquadInstallationScope
  replacementID: typeof BASE_EXPERT_SQUAD_ID
  replacedReferences: {
    global: number
    projects: number
    sessions: number
  }
}

export type ExpertSquadUninstallReceipt = ExpertSquadUninstallResult & { directory: string }

const [expertSquadCatalogRefreshTokenValue, setExpertSquadCatalogRefreshTokenValue] = createSignal(0)
const [expertSquadUninstallReceiptValue, setExpertSquadUninstallReceiptValue] =
  createSignal<ExpertSquadUninstallReceipt | null>(null)
let pendingExpertSquadCatalogLoad: { key: string; promise: Promise<ExpertSquadCatalog> } | null = null

export function expertSquadCatalogRefreshToken(): number {
  return expertSquadCatalogRefreshTokenValue()
}

export function expertSquadUninstallReceipt(): ExpertSquadUninstallReceipt | null {
  return expertSquadUninstallReceiptValue()
}

export function clearExpertSquadUninstallReceipt(receipt: ExpertSquadUninstallReceipt): void {
  setExpertSquadUninstallReceiptValue((current) => (current === receipt ? null : current))
}

export function markExpertSquadCatalogStale(): void {
  pendingExpertSquadCatalogLoad = null
  setExpertSquadCatalogRefreshTokenValue((value) => value + 1)
}

function directoryScopedPath(path: string, directory: string, label: string): string {
  const trimmed = directory.trim()
  if (!trimmed) throw new Error(`${label}: directory is required`)
  const params = new URLSearchParams({ directory: trimmed })
  return `${path}?${params.toString()}`
}

export function expertSquadCatalogPath(scope: ExpertSquadCatalogScope): string {
  const directory = scope.directory.trim()
  if (!directory) throw new Error("loadExpertSquadCatalog: directory is required")
  const sessionID = scope.kind === "session" ? scope.sessionID.trim() : ""
  if (scope.kind === "session" && !sessionID) throw new Error("loadExpertSquadCatalog: sessionID is required")
  const params = new URLSearchParams({ directory })
  if (sessionID) params.set("sessionID", sessionID)
  return `expert-squad/catalog?${params.toString()}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function loadExpertSquadCatalog(scope: ExpertSquadCatalogScope): Promise<ExpertSquadCatalog> {
  if (!appStore.connected) {
    throw new Error("Cannot load expert squads while disconnected")
  }
  const path = expertSquadCatalogPath(scope)
  const key = path
  if (pendingExpertSquadCatalogLoad?.key === key) return await pendingExpertSquadCatalogLoad.promise
  const promise = apiJson(path) as Promise<ExpertSquadCatalog>
  pendingExpertSquadCatalogLoad = { key, promise }
  try {
    return await promise
  } catch (error) {
    throw new Error(`GET /${path} failed: ${errorMessage(error)}`)
  } finally {
    if (pendingExpertSquadCatalogLoad?.promise === promise) pendingExpertSquadCatalogLoad = null
  }
}

export async function loadExpertSquadSettings(
  directory: string,
  id?: string,
  installationScope?: ExpertSquadInstallationScope | "built_in",
): Promise<ExpertSquadSettingsSurface> {
  if (!appStore.connected) throw new Error("Cannot load expert squad settings while disconnected")
  const params = new URLSearchParams({ directory: directory.trim() })
  if (!params.get("directory")) throw new Error("loadExpertSquadSettings: directory is required")
  if (id?.trim()) params.set("id", id.trim())
  if (installationScope) params.set("installationScope", installationScope)
  const path = `expert-squad/settings?${params.toString()}`
  try {
    return await apiJson<ExpertSquadSettingsSurface>(path)
  } catch (error) {
    throw new Error(`GET /${path} failed: ${errorMessage(error)}`)
  }
}

export async function loadExpertSquadConfiguration(
  directory: string,
  id: string,
  installationScope: ExpertSquadInstallationScope,
): Promise<ExpertSquadConfiguration> {
  const path = directoryScopedPath("expert-squad/configuration", directory, "loadExpertSquadConfiguration")
  return (await apiJson(
    `${path}&id=${encodeURIComponent(id)}&installationScope=${encodeURIComponent(installationScope)}`,
  )) as ExpertSquadConfiguration
}

export async function updateExpertSquadConfiguration(
  directory: string,
  id: string,
  installationScope: ExpertSquadInstallationScope,
  updates: ExpertSquadConfigurationUpdates,
): Promise<ExpertSquadConfigurationUpdateResponse> {
  return (await apiJson(
    directoryScopedPath("expert-squad/configuration", directory, "updateExpertSquadConfiguration"),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, installationScope, updates }),
    },
  )) as ExpertSquadConfigurationUpdateResponse
}

export async function setProjectExpertSquadActive(
  expertSquadID: string,
  directory: string,
  options: { isCurrentDirectory?: (directory: string) => boolean } = {},
): Promise<any> {
  const saved = await updateConfig(
    (current) => {
      const promptProfile =
        current.prompt_profile && typeof current.prompt_profile === "object" && !Array.isArray(current.prompt_profile)
          ? { ...current.prompt_profile }
          : {}
      current.prompt_profile = {
        ...promptProfile,
        active: expertSquadID,
      }
    },
    { directory, isCurrentDirectory: options.isCurrentDirectory },
  )
  markExpertSquadCatalogStale()
  return saved
}

export async function setSessionExpertSquadActive(
  sessionID: string,
  expertSquadID: string,
  directory: string,
): Promise<SessionConfigResponse> {
  const saved = await patchSessionConfig({ sessionID, directory, diff: { prompt_profile: { active: expertSquadID } } })
  markExpertSquadCatalogStale()
  return saved
}

export async function clearSessionExpertSquadOverride(
  sessionID: string,
  directory: string,
): Promise<SessionConfigResponse> {
  const saved = await patchSessionConfig({ sessionID, directory, diff: { prompt_profile: null } })
  markExpertSquadCatalogStale()
  return saved
}

export async function importExpertSquadFolder(input: ExpertSquadImportFolderInput): Promise<ExpertSquadImportResult> {
  const sourceDirectory = input.sourceDirectory.trim()
  if (!sourceDirectory) throw new Error("importExpertSquadFolder: sourceDirectory is required")
  const result = (await apiJson(
    directoryScopedPath("expert-squad/import-folder", input.directory, "importExpertSquadFolder"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceDirectory,
        expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
        installationScope: input.installationScope,
      }),
    },
  )) as ExpertSquadImportResult
  markExpertSquadCatalogStale()
  return result
}

export async function importExpertSquadArchive(input: ExpertSquadImportFileInput): Promise<ExpertSquadImportResult> {
  const archiveBase64 = input.archiveBase64.trim()
  if (!archiveBase64) throw new Error("importExpertSquadArchive: archiveBase64 is required")
  const result = (await apiJson(
    directoryScopedPath("expert-squad/import-file", input.directory, "importExpertSquadArchive"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        archiveBase64,
        filename: input.filename,
        expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
        installationScope: input.installationScope,
      }),
    },
  )) as ExpertSquadImportResult
  markExpertSquadCatalogStale()
  return result
}

export async function releaseExpertSquadPayload(directory: string): Promise<ExpertSquadReleasePayloadResult> {
  const result = (await apiJson(
    directoryScopedPath("expert-squad/release-payload", directory, "releaseExpertSquadPayload"),
    {
      method: "POST",
    },
  )) as ExpertSquadReleasePayloadResult
  markExpertSquadCatalogStale()
  return result
}

export async function loadExpertSquadMarket(directory: string): Promise<ExpertSquadMarketItem[]> {
  const path = directoryScopedPath("expert-squad/market", directory, "loadExpertSquadMarket")
  try {
    return (await apiJson(path)) as ExpertSquadMarketItem[]
  } catch (error) {
    throw new Error(`GET /${path} failed: ${errorMessage(error)}`)
  }
}

export async function installExpertSquadMarketPackage(
  directory: string,
  expertSquadID: string,
  installationScope: ExpertSquadInstallationScope,
): Promise<ExpertSquadMarketInstallResult> {
  const id = expertSquadID.trim()
  if (!id) throw new Error("installExpertSquadMarketPackage: expertSquadID is required")
  const result = (await apiJson(
    directoryScopedPath("expert-squad/install-payload", directory, "installExpertSquadMarketPackage"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, installationScope }),
    },
  )) as ExpertSquadMarketInstallResult
  markExpertSquadCatalogStale()
  return result
}

export async function updateExpertSquadPackage(
  directory: string,
  expertSquadID: string,
  installationScope: ExpertSquadInstallationScope,
  source: ExpertSquadUpdateSource,
  expectedCurrentPackageDigest: string,
): Promise<ExpertSquadUpdateResult> {
  const id = expertSquadID.trim()
  if (!id) throw new Error("updateExpertSquadPackage: expertSquadID is required")
  const result = (await apiJson(directoryScopedPath("expert-squad/update", directory, "updateExpertSquadPackage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, installationScope, source, expectedCurrentPackageDigest }),
  })) as ExpertSquadUpdateResult
  markExpertSquadCatalogStale()
  return result
}

export async function uninstallExpertSquadPackage(
  directory: string,
  expertSquadID: string,
  installationScope: ExpertSquadInstallationScope,
): Promise<ExpertSquadUninstallResult> {
  const id = expertSquadID.trim()
  if (!id) throw new Error("uninstallExpertSquadPackage: expertSquadID is required")
  const result = (await apiJson(
    directoryScopedPath("expert-squad/uninstall", directory, "uninstallExpertSquadPackage"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, installationScope, replacementID: BASE_EXPERT_SQUAD_ID }),
    },
  )) as ExpertSquadUninstallResult
  markExpertSquadCatalogStale()
  setExpertSquadUninstallReceiptValue({ ...result, directory: directory.trim() })
  return result
}

export async function exportExpertSquadArchive(
  directory: string,
  expertSquadID: string,
  installationScope: ExpertSquadInstallationScope,
): Promise<ExpertSquadExportResult> {
  const id = expertSquadID.trim()
  if (!id) throw new Error("exportExpertSquadArchive: expertSquadID is required")
  return (await apiJson(directoryScopedPath("expert-squad/export", directory, "exportExpertSquadArchive"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, installationScope }),
  })) as ExpertSquadExportResult
}

export async function loadExpertSquadEvolutionHistory(input: {
  directory: string
  namespace: string
  id: string
  installationScope: ExpertSquadInstallationScope
  limit?: number
  cursor?: ExpertSquadEvolutionHistory["next_cursor"]
}): Promise<ExpertSquadEvolutionHistory> {
  const directory = input.directory.trim()
  if (!directory) throw new Error("loadExpertSquadEvolutionHistory: directory is required")
  const query: ExpertSquadEvolutionHistoryData["query"] = {
    directory,
    namespace: input.namespace,
    id: input.id,
    installationScope: input.installationScope,
    limit: input.limit ?? 20,
    ...(input.cursor
      ? {
          catalogRevisionUpper: input.cursor.catalog_revision_upper,
          beforeCatalogRevision: input.cursor.before_catalog_revision,
        }
      : {}),
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) params.set(key, String(value))
  return await apiJson<ExpertSquadEvolutionHistory>(`expert-squad/evolution-history?${params.toString()}`)
}

export async function loadExpertSquadEvolutionHistoryDetail(input: {
  directory: string
  namespace: string
  id: string
  installationScope: ExpertSquadInstallationScope
  campaignTaskID: string
  campaignLocator: ExpertSquadEvolutionHistoryRecord["campaign"]["artifact"]["locator"]
  candidateLocator: ExpertSquadEvolutionHistoryCandidate["artifact"]["locator"]
  comparisonLocator: ExpertSquadEvolutionHistoryComparison["artifact"]["locator"]
  catalogRevisionUpper: number
}): Promise<ExpertSquadEvolutionHistoryDetail> {
  const directory = input.directory.trim()
  if (!directory) throw new Error("loadExpertSquadEvolutionHistoryDetail: directory is required")
  const body: NonNullable<ExpertSquadEvolutionHistoryDetailData["body"]> = {
    namespace: input.namespace,
    id: input.id,
    installationScope: input.installationScope,
    campaignTaskID: input.campaignTaskID,
    campaignLocator: input.campaignLocator,
    candidateLocator: input.candidateLocator,
    comparisonLocator: input.comparisonLocator,
    catalogRevisionUpper: input.catalogRevisionUpper,
  }
  return await apiJson<ExpertSquadEvolutionHistoryDetail>(
    `expert-squad/evolution-history/detail?${new URLSearchParams({ directory }).toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
}

export async function executeExpertSquadEvolutionMutation(input: {
  directory: string
  taskID: string
  sessionID: string
  confirmationText: string
  intent: ExpertSquadEvolutionMutationIntent
}): Promise<ExpertSquadEvolutionMutationResult> {
  const directory = input.directory.trim()
  if (!directory) throw new Error("executeExpertSquadEvolutionMutation: directory is required")
  const authorizationBody: NonNullable<ExpertSquadEvolutionAuthorizationData["body"]> = {
    taskID: input.taskID,
    sessionID: input.sessionID,
    confirmationText: input.confirmationText,
    intent: input.intent,
  }
  const authorization = await apiJson<ExpertSquadEvolutionAuthorizationResponse>(
    `expert-squad/evolution-authorization?${new URLSearchParams({ directory }).toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authorizationBody),
    },
  )
  const mutationBody: NonNullable<ExpertSquadEvolutionMutationData["body"]> = {
    ...input.intent,
    authorization: authorization.authorization,
  }
  const result = await apiJson<ExpertSquadEvolutionMutationResult>(
    `expert-squad/evolution-mutation?${new URLSearchParams({ directory }).toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mutationBody),
    },
  )
  markExpertSquadCatalogStale()
  return result
}
