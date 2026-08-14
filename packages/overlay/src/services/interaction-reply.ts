// ── Interaction reply/reject helper ──
// Shared low-level API wrappers used by InteractionCard (the unified
// permission / question card rendered inline in the conversation and in
// the task-scope panel).
//
// `autoReply` is required on every call: `false` for direct user actions
// (permission card buttons, question submissions), `true` for server-side
// timeout resolution. This flag propagates all the way through to
// the durable permission ledger so the transcript can render "[auto-reply]".
//
// Per-interaction mutex: the same interaction id can surface in multiple UI
// surfaces simultaneously (inline conversation card + task-scope card),
// and a timeout may race with a fast user click. The first request wins —
// concurrent calls with the same id share the in-flight promise so we never
// fire two HTTP requests against the same resolution. The server is the final
// arbiter of conflicting actions; this layer guarantees we don't generate the
// conflict ourselves.

import { apiJson } from "./api"
import { directoryScopedPath } from "./task-path"

const REPLY_TIMEOUT_MS = 30_000

const inflight = new Map<string, Promise<void>>()

export type InteractionReplyEndpoint = "interaction" | "question"
export type InteractionReplyTarget = { id: string; directory: string }
export type PermissionDecision = "allow_once" | "allow_task" | "allow_project"

function interactionPath(target: InteractionReplyTarget, path: string, label: string): string {
  const id = String(target.id || "").trim()
  if (!id) throw new Error(`${label}: interaction id is required`)
  return directoryScopedPath(path.replace(":id", encodeURIComponent(id)), target.directory, label)
}

function lockedRequest(id: string, fn: () => Promise<void>): Promise<void> {
  const prev = inflight.get(id)
  if (prev) return prev
  const p = fn().finally(() => {
    if (inflight.get(id) === p) inflight.delete(id)
  })
  inflight.set(id, p)
  return p
}

export async function replyInteraction(
  target: InteractionReplyTarget,
  action: PermissionDecision | "answer",
  autoReply: boolean,
  input: { answers?: unknown[]; message?: string } = {},
  endpoint: InteractionReplyEndpoint = "interaction",
): Promise<void> {
  return lockedRequest(target.id, async () => {
    if (endpoint === "question") {
      if (action !== "answer") throw new Error(`question reply endpoint does not support ${action}`)
      const answers = Array.isArray(input.answers) ? input.answers : []
      await apiJson(interactionPath(target, "question/:id/reply", "question reply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
        signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
      })
      return
    }

    if (action !== "answer") {
      await apiJson(interactionPath(target, "interaction/:id/reply", "interaction reply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: action, autoReply }),
        signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
      })
      return
    }

    const answers = Array.isArray(input.answers) ? input.answers : undefined
    const message = typeof input.message === "string" && input.message.trim() ? input.message.trim() : undefined

    await apiJson(interactionPath(target, "interaction/:id/reply", "interaction reply"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autoReply,
        ...(answers ? { answers } : {}),
        ...(message ? { message } : {}),
      }),
      signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
    })
  })
}

export async function rejectInteraction(
  target: InteractionReplyTarget,
  autoReply: boolean,
  endpoint: InteractionReplyEndpoint = "interaction",
): Promise<void> {
  return lockedRequest(target.id, async () => {
    if (endpoint === "question") {
      await apiJson(interactionPath(target, "question/:id/reject", "question reject"), {
        method: "POST",
        signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
      })
      return
    }

    await apiJson(interactionPath(target, "interaction/:id/reject", "interaction reject"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoReply }),
      signal: AbortSignal.timeout(REPLY_TIMEOUT_MS),
    })
  })
}
