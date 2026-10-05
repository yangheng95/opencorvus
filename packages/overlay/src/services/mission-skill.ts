import type {
  MissionSkillCatalogResponse,
  MissionSkillDirectoryResponse,
  MissionSkillSettingsResponse,
} from "@opencorvus-ai/sdk"
import { appStore } from "../store/app"
import { apiJson, ApiAuthorityChangedError, assertApiAuthorityCurrent, captureApiAuthority, type ApiAuthority } from "./api"
import type { ExpertSquadCatalogScope } from "./expert-squad"

const pendingMissionSkillCatalogLoads = new Map<string, { authority: ApiAuthority; promise: Promise<MissionSkillCatalogResponse> }>()
const pendingMissionSkillSettingsLoads = new Map<string, { authority: ApiAuthority; promise: Promise<MissionSkillSettingsResponse> }>()

function missionSkillPath(scope: ExpertSquadCatalogScope, endpoint: "catalog" | "settings" | "directory"): string {
  const directory = scope.directory.trim()
  if (!directory) throw new Error(`Mission Skill ${endpoint} request requires a directory`)
  const sessionID = scope.kind === "session" ? scope.sessionID.trim() : ""
  if (scope.kind === "session" && !sessionID) {
    throw new Error(`Mission Skill ${endpoint} request requires a sessionID`)
  }
  const params = new URLSearchParams({ directory })
  if (sessionID) params.set("sessionID", sessionID)
  return `mission-skill/${endpoint}?${params.toString()}`
}

export function missionSkillCatalogPath(scope: ExpertSquadCatalogScope): string {
  return missionSkillPath(scope, "catalog")
}

export function missionSkillSettingsPath(scope: ExpertSquadCatalogScope): string {
  return missionSkillPath(scope, "settings")
}

export function missionSkillDirectoryPath(scope: ExpertSquadCatalogScope): string {
  return missionSkillPath(scope, "directory")
}

function missionSkillGet<T>(path: string, authority: ApiAuthority): Promise<T> {
  return apiJson<T>(path, { authority }).catch((error) => {
    if (error instanceof ApiAuthorityChangedError) throw error
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`GET /${path} failed: ${message}`)
  })
}

export async function loadMissionSkillCatalog(scope: ExpertSquadCatalogScope): Promise<MissionSkillCatalogResponse> {
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  if (!appStore.connected) throw new Error("Cannot load Mission Skills while disconnected")
  const path = missionSkillCatalogPath(scope)
  const pending = pendingMissionSkillCatalogLoads.get(path)
  if (pending?.authority.revision === authority.revision) return await pending.promise
  const promise = missionSkillGet<MissionSkillCatalogResponse>(path, authority)
  const entry = { authority, promise }
  pendingMissionSkillCatalogLoads.set(path, entry)
  try {
    return await promise
  } finally {
    if (pendingMissionSkillCatalogLoads.get(path) === entry) pendingMissionSkillCatalogLoads.delete(path)
  }
}

export async function loadMissionSkillSettings(scope: ExpertSquadCatalogScope): Promise<MissionSkillSettingsResponse> {
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  if (!appStore.connected) throw new Error("Cannot load Mission Skill Settings while disconnected")
  const path = missionSkillSettingsPath(scope)
  const pending = pendingMissionSkillSettingsLoads.get(path)
  if (pending?.authority.revision === authority.revision) return await pending.promise
  const promise = missionSkillGet<MissionSkillSettingsResponse>(path, authority)
  const entry = { authority, promise }
  pendingMissionSkillSettingsLoads.set(path, entry)
  try {
    return await promise
  } finally {
    if (pendingMissionSkillSettingsLoads.get(path) === entry) pendingMissionSkillSettingsLoads.delete(path)
  }
}

export async function ensureMissionSkillDirectory(
  scope: ExpertSquadCatalogScope,
  source: "global" | "project",
): Promise<string> {
  const authority = scope.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  if (!appStore.connected) throw new Error("Cannot prepare a Mission Skill directory while disconnected")
  const path = missionSkillDirectoryPath(scope)
  const response = await apiJson<MissionSkillDirectoryResponse>(path, {
    authority,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source }),
  })
  return response.path
}
