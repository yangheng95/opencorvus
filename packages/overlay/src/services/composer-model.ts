import { appStore, setAppStore } from "../store/app"
import { activeSessionID, activeTaskID, boardStore, rootTaskSessionID } from "../store/board"
import { getSessionConfig, patchSessionConfig } from "./config"
import { taskOwningDirectory } from "./task-directory"

export interface ComposerModelSessionTarget {
  sessionID: string
  directory: string
}

let composerModelProjectionGeneration = 0

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
export function refreshActiveComposerModelFromSession(changedSessionID?: string): Promise<string> | undefined {
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
  return generation === composerModelProjectionGeneration && activeTargetMatches(target)
}

/** Clear the current-view projection before changing Task or Session identity. */
export function clearComposerModelProjection(): void {
  beginComposerModelProjection()
  setAppStore("composerModel", "")
}

/**
 * Project the canonical effective model of one persisted root Session into
 * the current Composer view. The caller owns selection-response ordering.
 */
export async function projectComposerModelFromSession(
  target: ComposerModelSessionTarget,
  ownsResponse: () => boolean,
): Promise<string> {
  const generation = beginComposerModelProjection()
  const saved = await getSessionConfig(target)
  const model = normalizedModel(saved.config.model)
  if (ownsResponse() && ownsComposerModelProjection(generation, target)) setAppStore("composerModel", model)
  return model
}

/**
 * Select a model for the current Composer scope. Persisted Task/Session
 * scopes write through the root Session Config owner; an empty New Chat
 * remains draft-local until its existing first-submission create boundary.
 */
export async function selectComposerModel(model: string): Promise<void> {
  const selected = normalizedModel(model)
  if (!selected || selected !== model || !selected.includes("/")) {
    throw new Error("selectComposerModel: model must be a trimmed provider/model reference")
  }

  const generation = beginComposerModelProjection()
  const previous = appStore.composerModel
  const target = activeComposerModelSessionTarget()
  if (boardStore.selectedSource && !target) {
    throw new Error("selectComposerModel: selected root Session is not resolved")
  }
  setAppStore("composerModel", selected)
  if (!target) return

  try {
    const saved = await patchSessionConfig({
      ...target,
      diff: { model: selected },
    })
    if (ownsComposerModelProjection(generation, target)) {
      setAppStore("composerModel", normalizedModel(saved.config.model))
    }
  } catch (error) {
    if (ownsComposerModelProjection(generation, target)) setAppStore("composerModel", previous)
    throw error
  }
}
