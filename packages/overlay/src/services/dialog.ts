// ── Dialog Service ──
// Manages dialog open/close and config tab switching.
// Uses direct imports.
// imports as of Phase 4 cleanup.

import { boardStore, loadBoard, activeTaskID } from "../store/board"
import { apiJson } from "./api"
import { selectedTaskDirectory } from "../store/board"
import { renderMarkdown, escapeHtml } from "../utils/markdown"
import { iconHtml } from "../utils/icon-html"
import { describeToolPart } from "../utils/tool"
import { dialogStore, setDialogStore } from "../store/dialog"
import { panelMessage } from "./chat"
import { directoryScopedPath } from "./task-path"

let sessionDialogSeq = 0
let goalDialogGeneration = 0

interface GoalDialogOwner {
  generation: number
  taskID: string
  directory: string
  goalID: string
}

function renderSessionToolChip(part: any): string {
  const display = describeToolPart(part, selectedTaskDirectory())
  if (!display) return ""
  const statusAttr = display.status ? ` data-status="${escapeHtml(display.status)}"` : ""
  const detail = display.detail ? `<span class="tool-detail">${escapeHtml(display.detail)}</span>` : ""
  return `<div class="msg-tool"${statusAttr}>
    <span class="tool-icon" aria-hidden="true">${iconHtml(display.icon)}</span>
    <span class="tool-name">${escapeHtml(display.label)}</span>
    ${detail}
  </div>`
}

export function openGoalDialog(goalID = "", title = "", acceptance = ""): void {
  goalDialogGeneration += 1
  setDialogStore("goal", {
    open: true,
    goalID,
    title,
    acceptance: goalID ? "" : acceptance,
    saving: false,
  })
}

function resetGoalDialog(): void {
  setDialogStore("goal", {
    open: false,
    goalID: "",
    title: "",
    acceptance: "",
    saving: false,
  })
}

export function closeGoalDialog(): boolean {
  if (dialogStore.goal.saving) return false
  goalDialogGeneration += 1
  resetGoalDialog()
  return true
}

export async function saveGoalDialog(): Promise<void> {
  const taskID = String(activeTaskID() || "").trim()
  const directory = selectedTaskDirectory()
  if (dialogStore.goal.saving || !taskID || !directory) return
  const goalID = dialogStore.goal.goalID.trim()
  const title = dialogStore.goal.title.trim()
  const acceptanceText = dialogStore.goal.acceptance.trim()
  if (!title) return

  const owner: GoalDialogOwner = {
    generation: goalDialogGeneration,
    taskID,
    directory,
    goalID,
  }
  const ownsDialog = () =>
    goalDialogGeneration === owner.generation &&
    dialogStore.goal.open &&
    dialogStore.goal.goalID.trim() === owner.goalID &&
    activeTaskID() === owner.taskID &&
    selectedTaskDirectory() === owner.directory

  setDialogStore("goal", "saving", true)
  try {
    if (goalID) {
      await apiJson(directoryScopedPath(`goal/${encodeURIComponent(goalID)}`, owner.directory, "update goal"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
    } else {
      const payload = acceptanceText ? `/goal ${title}\nAcceptance: ${acceptanceText}` : `/goal ${title}`
      await panelMessage(payload, { target: { taskID: owner.taskID, directory: owner.directory } })
    }
    if (!ownsDialog()) return
    goalDialogGeneration += 1
    resetGoalDialog()
    await loadBoard()
  } catch (err) {
    if (!ownsDialog()) return
    setDialogStore("goal", "saving", false)
    throw err
  }
}

/**
 * Open the session dialog, loading messages for a given session.
 * Shared by the sidebar Goals panel (GoalGroup "Open session" button)
 * and the main conversation (Card step body) so the render logic isn't
 * duplicated across surfaces.
 */
export async function openBuildSessionDialog(sessionID: string, title: string): Promise<void> {
  const openToken = ++sessionDialogSeq
  setDialogStore("session", {
    open: true,
    title: title || "Build Session",
    bodyHtml: '<p class="empty-hint">Loading…</p>',
  })
  try {
    const messages: any[] = await apiJson(`session/${sessionID}/message`)
    if (!messages || messages.length === 0) {
      if (sessionDialogSeq === openToken) {
        setDialogStore("session", "bodyHtml", '<p class="empty-hint">No messages yet.</p>')
      }
      return
    }
    const html = messages
      .map((msg: any) => {
        const role: string = msg.info?.role ?? msg.role ?? "unknown"
        const parts: any[] = Array.isArray(msg.parts) ? msg.parts : []
        const textParts = parts
          .filter((p) => p.type === "text" && p.text)
          .map((p) => `<div class="session-msg-text md-content">${renderMarkdown(p.text)}</div>`)
          .join("")
        const toolParts = parts
          .filter((p) => p.type === "tool-invocation" || p.type === "tool-call")
          .map((p) => renderSessionToolChip(p))
          .filter(Boolean)
          .join("")
        if (!textParts && !toolParts) return ""
        return `<div class="session-msg" data-role="${escapeHtml(role)}">
          <span class="session-msg-role">${escapeHtml(role)}</span>
          ${textParts}${toolParts}
        </div>`
      })
      .filter(Boolean)
      .join("")
    if (sessionDialogSeq === openToken) {
      const bodyHtml = html ? html : '<p class="empty-hint">No displayable messages.</p>'
      setDialogStore("session", "bodyHtml", bodyHtml)
    }
  } catch (e) {
    if (sessionDialogSeq === openToken) {
      setDialogStore(
        "session",
        "bodyHtml",
        `<p class="empty-hint">Failed to load session: ${escapeHtml(String(e))}</p>`,
      )
    }
  }
}

export function closeBuildSessionDialog(): void {
  sessionDialogSeq += 1
  setDialogStore("session", "open", false)
}
