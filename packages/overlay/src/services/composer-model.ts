import { batch } from "solid-js"
import { appStore, setAppStore } from "../store/app"
import { activeSessionID, activeTaskID, boardStore, rootTaskSessionID } from "../store/board"
import { getSessionConfig, patchSessionConfig } from "./config"
import { taskOwningDirectory } from "./task-directory"
import { saveSettings, settingsStore, setSettingsStore } from "../store/settings"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "./api"
import { formatErrorDetails, reportError } from "./diagnostics"
import { t } from "../utils/i18n"

export interface ComposerModelSessionTarget {
  sessionID: string
  directory: string
  authority?: ApiAuthority
}

export type ComposerModelProjectionResult =
  | { status: "ready"; model: string }
  | { status: "failed"; error: unknown }
  | { status: "retired" }

let composerModelProjectionGeneration = 0
let composerModelSelectionGeneration = 0

function normalizedModel(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function targetKey(target: ComposerModelSessionTarget): string {
  return `${target.directory.trim()}\u0000${target.sessionID.trim()}`
}

function activeComposerModelSessionTarget(): ComposerModelSessionTarget | null {
  const source = boardStore.selectedSource
  if (source?.kind === "task") {
    const taskID = activeTaskID().trim()
    const sessionID = rootTaskSessionID().trim()
    if (!taskID || !sessionID) return null
    return {
      sessionID,
      directory: taskOwningDirectory(taskID),
    }
  }
  if (source?.kind === "session") {
    const sessionID = activeSessionID().trim()
    const directory = source.directory?.trim() || ""
    if (!sessionID || !directory) return null
    return { sessionID, directory }
  }
  return null
}

/**
 * Re-read the canonical effective model for the currently selected Task or
 * Session when that root Session's config changes outside the selection
 * response that initiated the write.
 */
export function refreshActiveComposerModelFromSession(
  changedSessionID?: string,
): Promise<ComposerModelProjectionResult> | undefined {
  const target = activeComposerModelSessionTarget()
  if (!target) return undefined
  const changed = changedSessionID?.trim()
  if (changed && target.sessionID !== changed) return undefined
  return projectComposerModelFromSession(target, () => activeTargetMatches(target))
}

function activeTargetMatches(target: ComposerModelSessionTarget): boolean {
  const active = activeComposerModelSessionTarget()
  return !!active && targetKey(active) === targetKey(target)
}

function beginComposerModelProjection(): number {
  composerModelProjectionGeneration += 1
  return composerModelProjectionGeneration
}

function ownsComposerModelProjection(generation: number, target: ComposerModelSessionTarget): boolean {
  return (
    generation === composerModelProjectionGeneration &&
    activeTargetMatches(target) &&
    (!target.authority || isApiAuthorityCurrent(target.authority))
  )
}

export function retireComposerModel(clearPreference: boolean): void {
  composerModelSelectionGeneration += 1
  clearComposerModelProjection()
  if (clearPreference) setSettingsStore("lastSelectedModel", "")
}

/** Clear the current-view projection before changing Task or Session identity. */
export function clearComposerModelProjection(): void {
  beginComposerModelProjection()
  batch(() => {
    setAppStore("composerModel", "")
    setAppStore("composerModelIssue", null)
  })
}

/** Initialize a new draft from the last explicit choice, without changing Session config. */
export function restoreDraftComposerModel(): void {
  beginComposerModelProjection()
  batch(() => {
    setAppStore("composerModel", settingsStore.lastSelectedModel)
    setAppStore("composerModelIssue", null)
  })
}

async function rememberComposerModel(
  model: string,
  selectionGeneration: number,
  authority: ApiAuthority,
): Promise<void> {
  if (selectionGeneration !== composerModelSelectionGeneration || !isApiAuthorityCurrent(authority)) return
  setSettingsStore("lastSelectedModel", model)
  if (!boardStore.selectedSource) restoreDraftComposerModel()
  await saveSettings({
    onFailure: ({ confirmed }) => {
      if (selectionGeneration !== composerModelSelectionGeneration || !isApiAuthorityCurrent(authority)) return
      setSettingsStore("lastSelectedModel", confirmed.lastSelectedModel ?? "")
      if (!boardStore.selectedSource) restoreDraftComposerModel()
    },
  })
}

/**
 * Project the canonical effective model of one persisted root Session into
 * the current Composer view. Passive configuration reads settle independently
 * of historical conversation loading; failures retain their original error.
 * The caller owns selection-response ordering.
 */
export async function projectComposerModelFromSession(
  target: ComposerModelSessionTarget,
  ownsResponse: () => boolean,
): Promise<ComposerModelProjectionResult> {
  target = { ...target, authority: target.authority ?? captureApiAuthority() }
  const generation = beginComposerModelProjection()
  const selectionEpoch = boardStore.selectEpoch
  const owns = () =>
    boardStore.selectEpoch === selectionEpoch && ownsResponse() && ownsComposerModelProjection(generation, target)
  if (!owns()) return { status: "retired" }
  const issue = appStore.composerModelIssue
  if (issue) setAppStore("composerModelIssue", { error: issue.error, retrying: true })
  let result: Exclude<ComposerModelProjectionResult, { status: "retired" }>
  try {
    const saved = await getSessionConfig(target)
    result = { status: "ready", model: normalizedModel(saved.config.model) }
  } catch (error) {
    result = { status: "failed", error }
  }
  if (!owns()) return { status: "retired" }
  batch(() => {
    setAppStore("composerModel", result.status === "ready" ? result.model : "")
    setAppStore("composerModelIssue", result.status === "failed" ? { error: result.error, retrying: false } : null)
  })
  if (result.status === "failed") {
    reportError({
      id: "composer-model:projection",
      title: t("chat.model_config_failed_title"),
      message: result.error instanceof Error ? result.error.message : String(result.error),
      details: formatErrorDetails(result.error),
    })
  }
  return result
}

/**
 * Select a model for the current Composer scope. Persisted Task/Session
 * scopes write through the root Session Config owner; an empty New Chat
 * saves only the Overlay preference until its existing first-submission
 * create boundary. Passive Session reads never change that preference.
 */
export async function selectComposerModel(model: string): Promise<void> {
  const authority = captureApiAuthority()
  const selected = normalizedModel(model)
  if (!selected || selected !== model || !selected.includes("/")) {
    throw new Error("selectComposerModel: model must be a trimmed provider/model reference")
  }

  const previous = appStore.composerModel
  const previousIssue = appStore.composerModelIssue
    ? { error: appStore.composerModelIssue.error, retrying: false }
    : null
  const selectedTarget = activeComposerModelSessionTarget()
  const target = selectedTarget ? { ...selectedTarget, authority } : null
  if (boardStore.selectedSource && !target) {
    throw new Error("selectComposerModel: selected root Session is not resolved")
  }
  const generation = beginComposerModelProjection()
  const selectionGeneration = ++composerModelSelectionGeneration
  setAppStore("composerModel", selected)
  setAppStore("composerModelIssue", previousIssue)
  if (!target) return rememberComposerModel(selected, selectionGeneration, authority)

  let savedModel: string
  try {
    const saved = await patchSessionConfig({
      ...target,
      diff: { model: selected },
    })
    savedModel = normalizedModel(saved.config.model)
    if (ownsComposerModelProjection(generation, target)) {
      batch(() => {
        setAppStore("composerModel", savedModel)
        setAppStore("composerModelIssue", null)
      })
    }
  } catch (error) {
    if (ownsComposerModelProjection(generation, target)) {
      batch(() => {
        setAppStore("composerModel", previous)
        setAppStore("composerModelIssue", previousIssue)
      })
    }
    throw error
  }
  await rememberComposerModel(savedModel, selectionGeneration, authority)
}
