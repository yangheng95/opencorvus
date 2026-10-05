// ── Meta Service ──
// TypeScript port of metadata and diff-normalization functions.

import { boardStore, setBoardStore, setPath, setVcs } from "../store/board"
import { settingsStore } from "../store/settings"
import { AppLog } from "../utils/log"
import { formatErrorDetails } from "../utils/error-details"
import { apiJson, ApiAuthorityChangedError, captureApiAuthority, isApiAuthorityCurrent, assertApiAuthorityCurrent, type ApiAuthority } from "./api"
import { getHostTransport } from "./host-transport-runtime"
import type { StreamHandle } from "./host-transport"
import {
  VcsCommitMessageStreamEvent,
  type VcsCommitMessageStreamEvent as VcsCommitMessageEvent,
} from "@opencorvus-ai/transport-protocol"
import { activeProjectDirectory, projectScopedPath } from "./project-directory"

// ── Types ──

export type DiffStatus = "added" | "deleted" | "modified"

export interface DiffItem {
  file: string
  before?: string
  after?: string
  additions: number
  deletions: number
  status: DiffStatus
}

export interface VcsBranch {
  name: string
  current: boolean
}

export interface VcsCommitResult {
  commit: string
  info: unknown
}

export interface VcsCommitMessageStreamOptions {
  authority?: ApiAuthority
  taskID?: string
  sessionID?: string
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onDone: (message: string) => void
  onError: (error: Error) => void
}

// ── loadMeta ──

/**
 * Fetches the current working path and VCS info from the server and updates
 * the app store. Work Ledger project groups manage already-opened projects,
 * while the compact VCS badge renders through the chat-header runtime actions
 * ProjectRuntimeToolbarActions component (TaskDirBar.tsx). Both react to
 * settingsStore.directory / boardStore.path automatically; loadMeta only
 * pushes data into the stores. Worktrees remain Task dispatch resources and
 * are not projected as Goal fields.
 */
let metaRequest = 0

export function retireMetaProjection(clear = true): void {
  metaRequest += 1
  setBoardStore({ vcsLoading: false, vcsError: "", ...(clear ? { path: null, vcs: null, vcsDirectory: "" } : {}) })
}

export async function loadMeta(directory = activeProjectDirectory(), authority = captureApiAuthority()): Promise<void> {
  assertApiAuthorityCurrent(authority)
  if (directory !== activeProjectDirectory()) return
  const selectionEpoch = boardStore.selectEpoch
  const epoch = settingsStore.directoryEpoch
  const request = ++metaRequest
  if (!directory) {
    setBoardStore({ path: null, vcs: null, vcsDirectory: "", vcsLoading: false, vcsError: "" })
    return
  }
  const isCurrent = () =>
    isApiAuthorityCurrent(authority) && request === metaRequest && selectionEpoch === boardStore.selectEpoch && epoch === settingsStore.directoryEpoch && directory === activeProjectDirectory()
  setBoardStore({
    vcsDirectory: directory,
    vcsLoading: true,
    vcsError: "",
    ...(boardStore.vcsDirectory !== directory ? { vcs: null } : {}),
  })
  try {
    const [path, vcs] = await Promise.all([
      apiJson(projectScopedPath("path", directory), { authority }),
      apiJson(projectScopedPath("vcs", directory), { authority }),
    ])
    if (!isCurrent()) return
    const resolvedDirectory = path && typeof path.directory === "string" ? path.directory.trim() : ""
    setPath(resolvedDirectory ? { directory: resolvedDirectory } : null)
    setVcs(vcs ?? null)
  } catch (e) {
    if (!isCurrent()) return
    AppLog.debug("meta", "loadMeta failed", {
      error: String(e),
    })
    if (!isCurrent()) return
    setBoardStore({ vcs: null, vcsError: e instanceof Error ? e.message : String(e) })
    throw e
  } finally {
    if (request === metaRequest) setBoardStore("vcsLoading", false)
  }
}

/** An accepted write remains accepted when only its current metadata refresh fails. */
async function refreshMetaAfterAcceptedMutation(
  action: "switch-branch" | "commit" | "push",
  directory: string,
  authority: ApiAuthority,
  selectionEpoch: number,
): Promise<void> {
  const owns = () => isApiAuthorityCurrent(authority) && selectionEpoch === boardStore.selectEpoch && directory === activeProjectDirectory()
  if (!owns()) return
  try {
    await loadMeta(directory, authority)
  } catch (cause) {
    if (!owns()) return
    // loadMeta retains the current scoped vcsError for the existing runtime-panel alert.
    AppLog.warn("meta", "VCS mutation accepted; metadata refresh failed", {
      action,
      directory,
      accepted: true,
      cause,
      details: formatErrorDetails(cause),
    })
  }
}

// ── Diff helpers ──

// VCS means Version Control System; these functions own its project-scoped branch request boundary.
export async function loadVcsBranches(directory = activeProjectDirectory(), authority = captureApiAuthority()): Promise<VcsBranch[]> {
  const result = await apiJson(projectScopedPath("vcs/branches", directory), { authority })
  if (!Array.isArray(result)) throw new Error("vcs/branches returned a non-array payload")
  return result.map((item, index) => {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.name !== "string" ||
      !item.name ||
      item.name.trim() !== item.name ||
      typeof item.current !== "boolean"
    ) {
      throw new Error(`vcs/branches returned an invalid branch at index ${index}`)
    }
    return { name: item.name, current: item.current }
  })
}

export async function switchVcsBranch(branch: string, directory = activeProjectDirectory(), authority = captureApiAuthority()): Promise<void> {
  const selectionEpoch = boardStore.selectEpoch
  const requested = branch.trim()
  if (!requested) throw new Error("switchVcsBranch requires a branch")
  await apiJson(projectScopedPath("vcs/branch", directory), {
    authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ branch: requested }),
  })
  await refreshMetaAfterAcceptedMutation("switch-branch", directory, authority, selectionEpoch)
}

export function streamVcsCommitMessage(options: VcsCommitMessageStreamOptions): StreamHandle {
  const authority = options.authority ?? captureApiAuthority()
  assertApiAuthorityCurrent(authority)
  let terminal = false
  return getHostTransport().openStream(
    {
      authority,
      path: "vcs/commit-message/stream",
      method: "POST",
      body: {
        kind: "json",
        value: {
          ...(options.taskID ? { taskID: options.taskID } : {}),
          ...(options.sessionID ? { sessionID: options.sessionID } : {}),
        },
      },
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
    },
    {
      onEvent: (data) => {
        if (terminal || !isApiAuthorityCurrent(authority)) return
        let event: unknown
        try {
          event = JSON.parse(data)
        } catch (error) {
          terminal = true
          options.onError(
            new Error("Malformed VCS commit-message stream event", {
              cause: error instanceof Error ? error : undefined,
            }),
          )
          return
        }
        const parsed = VcsCommitMessageStreamEvent.safeParse(event)
        if (!parsed.success) {
          terminal = true
          options.onError(new Error("Invalid VCS commit-message stream event", { cause: parsed.error }))
          return
        }
        const payload: VcsCommitMessageEvent = parsed.data
        if (payload.type === "delta" && typeof payload.delta === "string") {
          options.onDelta(payload.delta)
          return
        }
        if (payload.type === "done" && typeof payload.message === "string") {
          terminal = true
          options.onDone(payload.message)
          return
        }
        if (payload.type === "error" && typeof payload.message === "string") {
          terminal = true
          options.onError(new Error(payload.message))
          return
        }
        terminal = true
        options.onError(new Error("Unknown VCS commit-message stream event"))
      },
      onError: (error) => {
        if (terminal || !isApiAuthorityCurrent(authority)) return
        terminal = true
        options.onError(error)
      },
      onClose: (reason, info) => {
        if (terminal || options.signal?.aborted) return
        terminal = true
        if (info?.current === false || !isApiAuthorityCurrent(authority)) {
          options.onError(info
            ? new ApiAuthorityChangedError(authority, { phase: "stream_closed", reason, info })
            : new Error("Retired VCS stream closed without its transport authority receipt"))
          return
        }
        options.onError(new Error(`VCS commit-message stream closed before completion: ${reason}`))
      },
    },
  )
}

export async function commitVcsChanges(message: string, directory: string, authority = captureApiAuthority()): Promise<VcsCommitResult> {
  const selectionEpoch = boardStore.selectEpoch
  const requested = message.trim()
  if (!requested) throw new Error("commitVcsChanges requires a message")
  const result = await apiJson<VcsCommitResult>(projectScopedPath("vcs/commit", directory), {
    authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: requested }),
    timeoutMilliseconds: null,
  })
  await refreshMetaAfterAcceptedMutation("commit", directory, authority, selectionEpoch)
  return result
}

export async function pushVcsBranch(directory: string, authority = captureApiAuthority()): Promise<void> {
  const selectionEpoch = boardStore.selectEpoch
  await apiJson(projectScopedPath("vcs/push", directory), {
    authority,
    method: "POST",
    timeoutMilliseconds: null,
  })
  await refreshMetaAfterAcceptedMutation("push", directory, authority, selectionEpoch)
}

/**
 * Normalises a raw diff list from the server into a consistent DiffItem array,
 * sorted by filename.
 * Mirrors normalizeDiffs.
 */
export function normalizeDiffs(list: any[]): DiffItem[] {
  return (Array.isArray(list) ? list : [])
    .filter((item) => item && typeof item.file === "string")
    .map((item) => ({
      file: String(item.file || "").replace(/^[ab]\//, ""),
      before: typeof item.before === "string" ? item.before : undefined,
      after: typeof item.after === "string" ? item.after : undefined,
      additions: Number.isFinite(Number(item.additions)) ? Number(item.additions) : 0,
      deletions: Number.isFinite(Number(item.deletions)) ? Number(item.deletions) : 0,
      status: diffStatus(item),
    }))
    .sort((a, b) => a.file.localeCompare(b.file))
}

/**
 * Derives the diff status for a single raw diff item.
 * Mirrors diffStatus.
 */
export function diffStatus(item: any): DiffStatus {
  if (item.status === "added" || item.status === "deleted" || item.status === "modified") {
    return item.status as DiffStatus
  }
  if (!item.before && item.after) return "added"
  if (item.before && !item.after) return "deleted"
  return "modified"
}
