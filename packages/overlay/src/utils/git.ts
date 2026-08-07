// ── Git Checkpoint Utilities ──
// boardGitCheckpoints .
// Also includes canInitGit and initGitCurrent (lines 4258–4391).

import { t } from "./i18n"
import { appStore } from "../store/app"
import { boardStore } from "../store/board"
import { showAppDialog } from "../services/app-dialog"
import { activeDirectory, clearProjectScopeData } from "../services/workspace"
import { reloadProjectScope } from "../services/config"
import { initializeProjectDirectoryGit } from "../services/project-git"

// ── Internal helpers ──

function record(value: any): boolean {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

// ── Exported functions ──

/** Return the section heading for a git checkpoint card. */
export function gitCheckpointTitle(stage: string, mode: string): string {
  if (stage === "baseline") {
    return mode === "created_commit" ? t("chat.git.baseline_created") : t("chat.git.baseline_recorded")
  }
  return mode === "created_commit" ? t("chat.git.result_created") : t("chat.git.result_recorded")
}

/**
 * Format a single key/value line for a git checkpoint block.
 * Returns an empty string when `value` is falsy.
 * Pass `{ code: true }` to wrap the value in backticks.
 */
export function gitCheckpointLine(key: string, value: any, options: { code?: boolean } = {}): string {
  if (!value) return ""
  const text = options.code ? `\`${value}\`` : String(value)
  return `- ${t(key)}: ${text}`
}

/**
 * Build the full markdown text block for a single git checkpoint item.
 * The item shape mirrors the objects returned by `boardGitCheckpoints`.
 */
export function gitCheckpointText(item: {
  stage: string
  mode: string
  message?: string
  branch?: string
  commit?: string
  snapshot?: string
}): string {
  return [
    `**${gitCheckpointTitle(item.stage, item.mode)}**`,
    "",
    gitCheckpointLine("chat.git.message", item.message),
    gitCheckpointLine("chat.git.branch", item.branch, { code: true }),
    gitCheckpointLine("chat.git.commit", item.commit ? String(item.commit).slice(0, 8) : "", { code: true }),
    item.stage === "baseline"
      ? gitCheckpointLine("chat.git.snapshot", item.snapshot ? String(item.snapshot).slice(0, 8) : "", { code: true })
      : "",
  ]
    .filter(Boolean)
    .join("\n")
}

/** The shape of a normalised git checkpoint entry. */
export interface GitCheckpoint {
  stage: string
  mode: string
  branch: string
  commit: string
  message: string
  snapshot: string
  time: number
}

/**
 * Extract and normalise all git checkpoint entries from a board object.
 * Source: `board.task.metadata.git.baseline` / `board.task.metadata.git.result`.
 * Returns checkpoints sorted by creation time (ascending).
 */
export function boardGitCheckpoints(board: any): GitCheckpoint[] {
  const out: GitCheckpoint[] = []
  const meta = record(board?.task?.metadata) ? board.task.metadata : null
  const git = record(meta?.git) ? meta.git : null

  for (const stage of ["baseline", "result"]) {
    const item = record(git?.[stage]) ? git[stage] : null
    if (!item) continue
    const time = Number(item.time)
    if (!Number.isFinite(time)) continue
    out.push({
      stage,
      mode: typeof item.mode === "string" ? item.mode : "recorded_head",
      branch: typeof item.branch === "string" ? item.branch : "",
      commit: typeof item.commit === "string" ? item.commit : "",
      message: typeof item.message === "string" ? item.message : "",
      snapshot: typeof item.snapshot === "string" ? item.snapshot : "",
      time,
    })
  }

  return out.sort((a, b) => a.time - b.time)
}

// ── Git Init Utilities ──

/**
 * Returns true when the current directory is set, the overlay is connected,
 * and the directory has no git VCS branch yet (i.e. git is not initialised).
 */
export function canInitGit(): boolean {
  return !!activeDirectory() && appStore.connected && boardStore.vcs !== null && !boardStore.vcs?.initialized
}

/**
 * Initialize Git for the API client's active directory through the canonical
 * project endpoint. This primitive has no reload, notification, or retry
 * behavior so startup can await it before any project-scoped load begins.
 */
export async function initializeActiveDirectoryGit(): Promise<{ created: boolean }> {
  const directory = activeDirectory()
  if (!directory) throw new Error("Git initialization requires an active directory")
  return await initializeProjectDirectoryGit(directory)
}

/**
 * POST project/current/init-git to initialise a git repository in the active
 * directory. The endpoint is idempotent and is the single source of truth;
 * do not block it on boardStore.vcs because that metadata can still be null
 * immediately after switching to a new directory. Calls resetProjectScope +
 * reloadProjectScope on success and shows a native notification. Returns
 * true on success, false on error.
 */
export async function initGitCurrent(options: { notify?: boolean } = {}): Promise<boolean> {
  const dir = activeDirectory()
  if (!dir) return false
  try {
    const result = await initializeActiveDirectoryGit()
    // Reload project scope after git init (config, extensions, meta).
    clearProjectScopeData()
    await reloadProjectScope({ restoreWorkspace: false })
    if (options.notify !== false) {
      const msg = result?.created ? t("git.init_done", { dir }) : t("git.init_exists", { dir })
      await showAppDialog({ title: t("git.init"), message: msg, kind: "info" })
    }
    return true
  } catch (e) {
    console.error("[git] Failed to initialize Git", e)
    if (options.notify !== false) {
      await showAppDialog({ title: t("git.init"), message: String(e), kind: "error" })
    }
    return false
  }
}
