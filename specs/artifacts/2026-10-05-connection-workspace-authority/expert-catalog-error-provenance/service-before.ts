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
  ExpertSquadMarketDetailResponse,
  ExpertSquadReleasePayloadResponse,
  ExpertSquadUpdateData,
  ExpertSquadUpdateResponse,
  ExpertSquadRepairBundledResponse,
  ExpertSquadSearchResponse,
  ExpertSquadInventoryStatusResponse,
  ExpertSquadDiagnosticsResponse,
  ExpertSquadInspectResponse,
  ExpertSquadSettingsDetailResponse,
} from "@opencorvus-ai/sdk"
import { appStore } from "../store/app"
import { apiJson, serverSettledRequest } from "./api"
import { ApiAuthorityChangedError, captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { patchSessionConfig, updateConfig, type SessionConfigResponse } from "./config"

export type ExpertSquadCatalog = ExpertSquadCatalogResponse
export type ExpertSquadCatalogPage = ExpertSquadSearchResponse
export type ExpertSquadInventoryStatus = ExpertSquadInventoryStatusResponse
export type ExpertSquadDiagnosticsPage = ExpertSquadDiagnosticsResponse
export type ExpertSquadInspection = ExpertSquadInspectResponse
export type ExpertSquadSettingsSurface = ExpertSquadSettingsDetailResponse
export type ExpertSquadDetail = ExpertSquadSettingsSurface["selected"]
export type ExpertSquadConfiguration = ExpertSquadConfigurationGetResponse
export type ExpertSquadConfigurationUpdates = NonNullable<ExpertSquadConfigurationUpdateData["body"]>["updates"]
export type ExpertSquadOption = ExpertSquadCatalogPage["entries"][number]
export type ExpertSquadCatalogScope = ExpertSquadCatalog["scope"] & { authority?: ApiAuthority }

export type ExpertSquadImportFolderInput = ExpertSquadImportFolderData["body"] & { directory: string; authority?: ApiAuthority }

export type ExpertSquadImportFileInput = ExpertSquadImportFileData["body"] & { directory: string; authority?: ApiAuthority }

export type ExpertSquadImportResult = ExpertSquadImportFolderResponse | ExpertSquadImportFileResponse

export type ExpertSquadReleasePayloadResult = ExpertSquadReleasePayloadResponse

export type ExpertSquadMarketPage = ExpertSquadMarketResponse
export type ExpertSquadMarketIndexItem = ExpertSquadMarketPage["entries"][number]
export type ExpertSquadMarketItem = ExpertSquadMarketDetailResponse
export type ExpertSquadMarketInstallResult = ExpertSquadInstallPayloadResponse
export type ExpertSquadUpdateSource = NonNullable<ExpertSquadUpdateData["body"]>["source"]
export type ExpertSquadUpdateResult = ExpertSquadUpdateResponse

export async function repairObsoleteBundledExpertSquads(directory: string, authority = captureApiAuthority()): Promise<ExpertSquadRepairBundledResponse> {
  return apiJson<ExpertSquadRepairBundledResponse>(
    directoryScopedPath("expert-squad/repair-bundled", directory, "repairObsoleteBundledExpertSquads"),
    serverSettledRequest({ method: "POST", body: JSON.stringify({}), authority }),
  )
}
export type ExpertSquadEvolutionHistory = ExpertSquadEvolutionHistoryResponse
export type ExpertSquadEvolutionHistoryRecord = ExpertSquadEvolutionHistory["records"][number]
export type ExpertSquadEvolutionHistoryCandidate = ExpertSquadEvolutionHistoryRecord["candidates"][number]
export type ExpertSquadEvolutionFeedbackRevision = ExpertSquadEvolutionHistory["feedback_revisions"][number]
export type ExpertSquadEvolutionRevisionChoice = ExpertSquadEvolutionHistory["revisions"][number]
export type ExpertSquadEvolutionHistoryComparison = ExpertSquadEvolutionHistoryCandidate["comparisons"][number]
export type ExpertSquadEvolutionHistoryDetail = ExpertSquadEvolutionHistoryDetailResponse
export type ExpertSquadEvolutionMutationIntent = NonNullable<ExpertSquadEvolutionAuthorizationData["body"]>["intent"]
export type ExpertSquadEvolutionMutationResult = ExpertSquadEvolutionMutationResponse

const EXPERT_SQUAD_PUBLIC_MARKET_ORIGIN = "https://opencorvus.com"

export function expertSquadPublicMarketURL(input: { namespace: string; id: string; locale: string }): string {
  const namespace = input.namespace.trim()
  const id = input.id.trim()
  if (!namespace || !id) throw new Error("expertSquadPublicMarketURL: namespace and id are required")
  const localePath = input.locale.toLocaleLowerCase().startsWith("zh") ? "/zh-cn" : ""
  return `${EXPERT_SQUAD_PUBLIC_MARKET_ORIGIN}${localePath}/market/${encodeURIComponent(namespace)}/${encodeURIComponent(id)}/`
}

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
let pendingExpertSquadCatalogLoad: { key: string; promise: Promise<ExpertSquadCatalog>; authority: ApiAuthority } | null = null

export function retireExpertSquadProjection(): void {
  pendingExpertSquadCatalogLoad = null
  setExpertSquadUninstallReceiptValue(null)
}

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
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  if (!appStore.connected) {
    throw new Error("Cannot load expert squads while disconnected")
  }
  const path = expertSquadCatalogPath(scope)
  const key = path
  if (pendingExpertSquadCatalogLoad?.key === key && isApiAuthorityCurrent(pendingExpertSquadCatalogLoad.authority)) return await pendingExpertSquadCatalogLoad.promise
  const promise = apiJson<ExpertSquadCatalog>(path, { authority })
  pendingExpertSquadCatalogLoad = { key, promise, authority }
  try {
    return await promise
  } catch (error) {
    if (error instanceof ApiAuthorityChangedError) throw error
    throw new Error(`GET /${path} failed: ${errorMessage(error)}`)
  } finally {
    if (pendingExpertSquadCatalogLoad?.promise === promise) pendingExpertSquadCatalogLoad = null
  }
}

export async function loadExpertSquadSettings(
  directory: string,
  id: string,
  installationScope: ExpertSquadInstallationScope | "built_in",
  namespace?: string,
  authority = captureApiAuthority(),
): Promise<ExpertSquadSettingsSurface> {
  if (!appStore.connected) throw new Error("Cannot load expert squad settings while disconnected")
  const params = new URLSearchParams({ directory: directory.trim() })
  if (!params.get("directory")) throw new Error("loadExpertSquadSettings: directory is required")
  params.set("id", id.trim())
  params.set("installationScope", installationScope)
  if (namespace) params.set("namespace", namespace)
  const path = `expert-squad/settings/detail?${params.toString()}`
  try {
    return await apiJson<ExpertSquadSettingsSurface>(path, { authority })
  } catch (error) {
    if (error instanceof ApiAuthorityChangedError) throw error
    throw new Error(`GET /${path} failed: ${errorMessage(error)}`)
  }
}

export async function inspectExpertSquad(input: {
  authority?: ApiAuthority
  directory: string
  id: string
  installationScope?: ExpertSquadInstallationScope | "built_in"
  namespace?: string
  workflowCursor?: string
}): Promise<ExpertSquadInspection> {
  const params = new URLSearchParams({ directory: input.directory.trim(), id: input.id.trim() })
  if (!params.get("directory")) throw new Error("inspectExpertSquad: directory is required")
  if (input.installationScope) params.set("installationScope", input.installationScope)
  if (input.namespace) params.set("namespace", input.namespace)
  if (input.workflowCursor) params.set("workflowCursor", input.workflowCursor)
  return await apiJson<ExpertSquadInspection>(`expert-squad/inspect?${params.toString()}`, { authority: input.authority })
}

export async function searchExpertSquads(input: {
  authority?: ApiAuthority
  directory: string
  view?: "effective" | "installations"
  query?: string
  productPillar?: "code" | "work"
  cursor?: string
  limit?: number
}): Promise<ExpertSquadCatalogPage> {
  const params = new URLSearchParams({
    directory: input.directory.trim(),
    view: input.view ?? "effective",
    query: input.query?.trim() ?? "",
    limit: String(input.limit ?? 20),
  })
  if (!params.get("directory")) throw new Error("searchExpertSquads: directory is required")
  if (input.productPillar) params.set("productPillar", input.productPillar)
  if (input.cursor) params.set("cursor", input.cursor)
  return await apiJson<ExpertSquadCatalogPage>(`expert-squad/search?${params.toString()}`, { authority: input.authority })
}

export async function loadExpertSquadInventoryStatus(directory: string, authority = captureApiAuthority()): Promise<ExpertSquadInventoryStatus> {
  const path = directoryScopedPath("expert-squad/inventory-status", directory, "loadExpertSquadInventoryStatus")
  return await apiJson<ExpertSquadInventoryStatus>(path, { authority })
}

export async function loadExpertSquadDiagnostics(
  directory: string,
  input: { cursor?: string; limit?: number; authority?: ApiAuthority } = {},
): Promise<ExpertSquadDiagnosticsPage> {
  const params = new URLSearchParams({ directory: directory.trim(), limit: String(input.limit ?? 20) })
  if (!params.get("directory")) throw new Error("loadExpertSquadDiagnostics: directory is required")
  if (input.cursor) params.set("cursor", input.cursor)
  return await apiJson<ExpertSquadDiagnosticsPage>(`expert-squad/diagnostics?${params.toString()}`, { authority: input.authority })
}

export async function loadExpertSquadConfiguration(
  directory: string,
  id: string,
  installationScope: ExpertSquadInstallationScope,
  authority = captureApiAuthority(),
): Promise<ExpertSquadConfiguration> {
  const path = directoryScopedPath("expert-squad/configuration", directory, "loadExpertSquadConfiguration")
  return (await apiJson(
    `${path}&id=${encodeURIComponent(id)}&installationScope=${encodeURIComponent(installationScope)}`,
    { authority },
  )) as ExpertSquadConfiguration
}

export async function updateExpertSquadConfiguration(
  directory: string,
  id: string,
  installationScope: ExpertSquadInstallationScope,
  updates: ExpertSquadConfigurationUpdates,
  authority = captureApiAuthority(),
): Promise<ExpertSquadConfigurationUpdateResponse> {
  return (await apiJson(
    directoryScopedPath("expert-squad/configuration", directory, "updateExpertSquadConfiguration"),
    {
      authority,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, installationScope, updates }),
    },
  )) as ExpertSquadConfigurationUpdateResponse
}

export async function setProjectExpertSquadActive(
  expertSquadID: string,
  directory: string,
  options: { isCurrentDirectory?: (directory: string) => boolean; authority?: ApiAuthority } = {},
): Promise<any> {
  const authority = options.authority ?? captureApiAuthority()
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
    { directory, isCurrentDirectory: options.isCurrentDirectory, authority },
  )
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return saved
}

export async function setSessionExpertSquadActive(
  sessionID: string,
  expertSquadID: string,
  directory: string,
  authority = captureApiAuthority(),
): Promise<SessionConfigResponse> {
  const saved = await patchSessionConfig({ sessionID, directory, authority, diff: { prompt_profile: { active: expertSquadID } } })
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return saved
}

export async function clearSessionExpertSquadOverride(
  sessionID: string,
  directory: string,
  authority = captureApiAuthority(),
): Promise<SessionConfigResponse> {
  const saved = await patchSessionConfig({ sessionID, directory, authority, diff: { prompt_profile: null } })
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return saved
}

export async function importExpertSquadFolder(input: ExpertSquadImportFolderInput): Promise<ExpertSquadImportResult> {
  const authority = input.authority ?? captureApiAuthority()
  const sourceDirectory = input.sourceDirectory.trim()
  if (!sourceDirectory) throw new Error("importExpertSquadFolder: sourceDirectory is required")
  const result = (await apiJson(
    directoryScopedPath("expert-squad/import-folder", input.directory, "importExpertSquadFolder"),
    {
      authority,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceDirectory,
        expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
        installationScope: input.installationScope,
      }),
    },
  )) as ExpertSquadImportResult
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return result
}

export async function importExpertSquadArchive(input: ExpertSquadImportFileInput): Promise<ExpertSquadImportResult> {
  const authority = input.authority ?? captureApiAuthority()
  const archiveBase64 = input.archiveBase64.trim()
  if (!archiveBase64) throw new Error("importExpertSquadArchive: archiveBase64 is required")
  const result = (await apiJson(
    directoryScopedPath("expert-squad/import-file", input.directory, "importExpertSquadArchive"),
    {
      authority,
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
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return result
}

export async function releaseExpertSquadPayload(directory: string, authority = captureApiAuthority()): Promise<ExpertSquadReleasePayloadResult> {
  const result = (await apiJson(
    directoryScopedPath("expert-squad/release-payload", directory, "releaseExpertSquadPayload"),
    {
      authority,
      method: "POST",
    },
  )) as ExpertSquadReleasePayloadResult
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return result
}

export async function loadExpertSquadMarket(
  directory: string,
  input: {
    authority?: ApiAuthority
    query?: string
    availability?: "all" | "available" | "installed"
    productPillar?: "code" | "work"
    cursor?: string
    limit?: number
  } = {},
): Promise<ExpertSquadMarketPage> {
  const params = new URLSearchParams({
    directory: directory.trim(),
    query: input.query?.trim() ?? "",
    availability: input.availability ?? "all",
    limit: String(input.limit ?? 20),
  })
  if (input.productPillar) params.set("productPillar", input.productPillar)
  if (input.cursor) params.set("cursor", input.cursor)
  const path = `expert-squad/market?${params.toString()}`
  try {
    return await apiJson<ExpertSquadMarketPage>(path, { authority: input.authority })
  } catch (error) {
    if (error instanceof ApiAuthorityChangedError) throw error
    throw new Error(`GET /${path} failed: ${errorMessage(error)}`)
  }
}

export async function loadExpertSquadMarketDetail(directory: string, id: string, authority = captureApiAuthority()): Promise<ExpertSquadMarketItem> {
  const params = new URLSearchParams({ directory: directory.trim(), id: id.trim() })
  return await apiJson<ExpertSquadMarketItem>(`expert-squad/market/detail?${params.toString()}`, { authority })
}

export async function installExpertSquadMarketPackage(
  directory: string,
  expertSquadID: string,
  installationScope: ExpertSquadInstallationScope,
  authority = captureApiAuthority(),
): Promise<ExpertSquadMarketInstallResult> {
  const id = expertSquadID.trim()
  if (!id) throw new Error("installExpertSquadMarketPackage: expertSquadID is required")
  const result = (await apiJson(
    directoryScopedPath("expert-squad/install-payload", directory, "installExpertSquadMarketPackage"),
    {
      authority,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, installationScope }),
    },
  )) as ExpertSquadMarketInstallResult
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return result
}

export async function updateExpertSquadPackage(
  directory: string,
  expertSquadID: string,
  installationScope: ExpertSquadInstallationScope,
  source: ExpertSquadUpdateSource,
  expectedCurrentPackageDigest: string,
  authority = captureApiAuthority(),
): Promise<ExpertSquadUpdateResult> {
  const id = expertSquadID.trim()
  if (!id) throw new Error("updateExpertSquadPackage: expertSquadID is required")
  const result = (await apiJson(directoryScopedPath("expert-squad/update", directory, "updateExpertSquadPackage"), {
    authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, installationScope, source, expectedCurrentPackageDigest }),
  })) as ExpertSquadUpdateResult
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return result
}

export async function uninstallExpertSquadPackage(
  directory: string,
  expertSquadID: string,
  installationScope: ExpertSquadInstallationScope,
  authority = captureApiAuthority(),
): Promise<ExpertSquadUninstallResult> {
  const id = expertSquadID.trim()
  if (!id) throw new Error("uninstallExpertSquadPackage: expertSquadID is required")
  const result = (await apiJson(
    directoryScopedPath("expert-squad/uninstall", directory, "uninstallExpertSquadPackage"),
    {
      authority,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, installationScope, replacementID: BASE_EXPERT_SQUAD_ID }),
    },
  )) as ExpertSquadUninstallResult
  if (isApiAuthorityCurrent(authority)) {
    markExpertSquadCatalogStale()
    setExpertSquadUninstallReceiptValue({ ...result, directory: directory.trim() })
  }
  return result
}

export async function exportExpertSquadArchive(
  directory: string,
  expertSquadID: string,
  installationScope: ExpertSquadInstallationScope,
  authority = captureApiAuthority(),
): Promise<ExpertSquadExportResult> {
  const id = expertSquadID.trim()
  if (!id) throw new Error("exportExpertSquadArchive: expertSquadID is required")
  return (await apiJson(directoryScopedPath("expert-squad/export", directory, "exportExpertSquadArchive"), {
    authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, installationScope }),
  })) as ExpertSquadExportResult
}

export async function loadExpertSquadEvolutionHistory(input: {
  authority?: ApiAuthority
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
  return await apiJson<ExpertSquadEvolutionHistory>(`expert-squad/evolution-history?${params.toString()}`, { authority: input.authority })
}

export async function loadExpertSquadEvolutionHistoryDetail(input: {
  authority?: ApiAuthority
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
      authority: input.authority,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
}

export async function executeExpertSquadEvolutionMutation(input: {
  authority?: ApiAuthority
  directory: string
  taskID: string
  sessionID: string
  confirmationText: string
  intent: ExpertSquadEvolutionMutationIntent
}): Promise<ExpertSquadEvolutionMutationResult> {
  const authority = input.authority ?? captureApiAuthority()
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
      authority,
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
      authority,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mutationBody),
    },
  )
  if (isApiAuthorityCurrent(authority)) markExpertSquadCatalogStale()
  return result
}
