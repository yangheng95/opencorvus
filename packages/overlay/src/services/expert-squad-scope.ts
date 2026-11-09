import { appStore } from "../store/app"
import { activeSessionID, activeTaskID, boardStore, rootTaskSessionID } from "../store/board"
import { expertSquadCatalogRefreshToken, type ExpertSquadCatalogScope } from "./expert-squad"
import { activeProjectDirectory } from "./project-directory"
import { captureApiAuthority } from "./api"

export type ExpertSquadCatalogScopeState =
  | ({ kind: "project"; directory: string } & ExpertSquadCatalogScope)
  | ({ kind: "session"; directory: string; taskID?: string } & ExpertSquadCatalogScope)
  | { kind: "pending"; taskID: string; directory: string }
  | { kind: "unavailable" }

export function expertSquadCatalogDirectory(): string {
  if (!appStore.connected) return ""
  return activeProjectDirectory()
}

export function expertSquadCatalogScope(): ExpertSquadCatalogScopeState {
  if (!appStore.connected) return { kind: "unavailable" }
  const directory = expertSquadCatalogDirectory()
  if (!directory) return { kind: "unavailable" }
  const taskID = activeTaskID()
  if (taskID) {
    if (boardStore.taskSwitching) return { kind: "pending", taskID, directory }
    const sessionID = rootTaskSessionID().trim()
    return sessionID ? { kind: "session", sessionID, directory, taskID } : { kind: "pending", taskID, directory }
  }
  const sessionID = activeSessionID().trim()
  if (sessionID) return { kind: "session", sessionID, directory }
  return { kind: "project", directory }
}

/** Settings capability pages are project-owned and never inherit a Task/session runtime overlay. */
export function expertSquadSettingsScope():
  | Extract<ExpertSquadCatalogScopeState, { kind: "project" }>
  | { kind: "unavailable" } {
  const directory = expertSquadCatalogDirectory()
  return directory ? { kind: "project", directory } : { kind: "unavailable" }
}

export function expertSquadCatalogScopeIdentity(scope: ExpertSquadCatalogScopeState): string {
  if (scope.kind === "project") return `project:${scope.directory}`
  if (scope.kind === "session")
    return `session:${scope.directory}:${scope.sessionID}${scope.taskID ? `:task:${scope.taskID}` : ""}`
  if (scope.kind === "pending") return `pending:${scope.directory}:${scope.taskID}`
  return scope.kind
}

export function expertSquadCatalogRequestKeyForScope(
  scope: Extract<ExpertSquadCatalogScopeState, { kind: "project" | "session" }>,
): string {
  return `${expertSquadCatalogScopeKeyForRequest(scope)}:${expertSquadCatalogRefreshToken()}`
}

function expertSquadCatalogScopeKeyForRequest(
  scope: Extract<ExpertSquadCatalogScopeState, { kind: "project" | "session" }>,
): string {
  return `expert-squad:catalog:${expertSquadCatalogScopeIdentity(scope)}`
}

export function expertSquadCatalogRequestKey(): string {
  const scope = expertSquadCatalogScope()
  if (scope.kind === "unavailable") return ""
  if (scope.kind === "pending") return `expert-squad:pending-task:${scope.taskID}:${scope.directory}`
  return expertSquadCatalogRequestKeyForScope(scope)
}

export type ComposerReferenceCatalogScopeState = ExpertSquadCatalogScopeState | { kind: "global" }

export function composerReferenceCatalogScope(): ComposerReferenceCatalogScopeState {
  const scope = expertSquadCatalogScope()
  return scope.kind === "unavailable" && appStore.connected ? { kind: "global" } : scope
}

function composerReferenceCatalogContext(productPillar: "code" | "work") {
  const authority = captureApiAuthority()
  const prefix = `api:${authority.revision}:${productPillar}:`
  const scope = composerReferenceCatalogScope()
  if (scope.kind === "global") return { key: `${prefix}composer-reference:global`, refreshes: true }
  if (scope.kind === "unavailable") return { key: "", refreshes: false }
  if (scope.kind === "pending") {
    return { key: `${prefix}composer-reference:pending-task:${scope.taskID}:${scope.directory}`, refreshes: false }
  }
  return { key: `${prefix}${expertSquadCatalogScopeKeyForRequest(scope)}`, refreshes: true }
}

export function composerReferenceCatalogScopeKey(productPillar: "code" | "work"): string {
  return composerReferenceCatalogContext(productPillar).key
}

export function composerReferenceCatalogRequestKey(productPillar: "code" | "work"): string {
  const { key, refreshes } = composerReferenceCatalogContext(productPillar)
  return refreshes ? `${key}:${expertSquadCatalogRefreshToken()}` : key
}
