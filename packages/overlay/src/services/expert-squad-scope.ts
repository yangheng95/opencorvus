import { appStore } from "../store/app"
import { activeSessionID, activeTaskID, boardStore, rootTaskSessionID } from "../store/board"
import { expertSquadCatalogRefreshToken, type ExpertSquadCatalogScope } from "./expert-squad"
import { activeProjectDirectory } from "./project-directory"

export type ExpertSquadCatalogScopeState =
  | ({ kind: "project"; directory: string } & ExpertSquadCatalogScope)
  | ({ kind: "session"; directory: string } & ExpertSquadCatalogScope)
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
    return sessionID ? { kind: "session", sessionID, directory } : { kind: "pending", taskID, directory }
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

export function expertSquadCatalogRequestKeyForScope(scope: ExpertSquadCatalogScope): string {
  const catalogID = scope.kind === "session" ? `session:${scope.sessionID}` : "project"
  return `expert-squad:catalog:${scope.directory}:${catalogID}:${expertSquadCatalogRefreshToken()}`
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

export function composerReferenceCatalogRequestKey(): string {
  const scope = composerReferenceCatalogScope()
  if (scope.kind === "global") return `composer-reference:global:${expertSquadCatalogRefreshToken()}`
  if (scope.kind === "unavailable") return ""
  if (scope.kind === "pending") return `composer-reference:pending-task:${scope.taskID}:${scope.directory}`
  return expertSquadCatalogRequestKeyForScope(scope)
}
