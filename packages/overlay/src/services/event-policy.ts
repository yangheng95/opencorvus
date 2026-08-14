function hasPrefix(type: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => type.startsWith(prefix))
}

const TREE_WRITER_NOOP_TYPES = new Set([
  "task.heartbeat",
  "task.connected",
  "task-list.heartbeat",
  "task-list.connected",
  "server.heartbeat",
  "server.connected",
  "config.changed",
  "session.created",
  "session.updated",
  "session.deleted",
  "session.diff",
  "session.bridge.persist_failed",
  "task.replay_expired",
  "task.live_replay_expired",
  "task.messages.changed",
  "task.cancellation.requested",
  "agent.updated",
  "message.created",
  "message.injected",
  "mission.handoff",
  "conversation.handoff",
  "interactive-artifact.mcp-app.lifecycle.changed",
  "command.executed",
  "global.disposed",
  "server.instance.disposed",
  "installation.updated",
  "installation.update-available",
  "project.updated",
  "pty.created",
  "pty.updated",
  "pty.exited",
  "pty.deleted",
  "lsp.client.diagnostics",
  "lsp.updated",
  "mcp.tools.changed",
  "mcp.auth.required",
  "mcp.browser.open.failed",
  "mcp.prompts.changed",
  "mcp.resources.changed",
  "scheduler.message",
  "file.watcher.updated",
  "file.watcher.failed",
  "vcs.branch.updated",
  "worktree.ready",
  "worktree.failed",
  "task_plan.updated",
  "session.compacted",
  "file.edited",
  "workspace.ready",
  "workspace.failed",
  "todo.updated",
  // Mailbox rendering and desktop notification projection subscribe to the
  // task-scoped mailbox event stream. The main conversation stream must not
  // duplicate those records as cards.
  "mailbox.message",
  "mailbox.acknowledged",
  // Integrity `started` / `progress` / `completed` are NOT noop —
  // started/progress promote a running integrity card, and completed upserts
  // it with the structured verdict. Handled by tree-writer's `handleIntegrity*`
  // family; the same card id (`integrity:<taskID>`) is upserted across all
  // three events.
])

const TREE_WRITER_PASS_THROUGH_PREFIXES = [] as const

const TREE_WRITER_PASS_THROUGH_EXACT_TYPES = new Set([
  "task.failed",
  "task.infrastructure.failed",
  "task.cancelled",
  "task.blocked",
  "task.rewound",
  "task.message",
  "agent.coordination.requested",
  "agent.coordination.responded",
  "agent.coordination.cancelled",
  "agent.coordination.action",
])

const TREE_WRITER_PROJECTED_EXACT_TYPES = new Set([
  "message.part.delta",
  "task.created",
  "task.updated",
  "task.completed",
  "goal.created",
  "interaction.requested",
  "interaction.resolved",
  "question.asked",
  "question.replied",
  "question.rejected",
  "message.updated",
  "message.part.updated",
  "message.moved",
  "message.removed",
  "message.part.removed",
  "review.stream.started",
  "review.stream.progress",
  "review.stream.chunk",
  "agent.execution.lifecycle",
  "approval.request",
  "input.request",
  "permission.asked",
  "permission.replied",
  "diff.delta",
])

const BOARD_INVALIDATING_EXACT_TYPES = new Set([
  "task.created",
  "task.updated",
  "task.completed",
  "task.failed",
  "task.infrastructure.failed",
  "task.cancelled",
  "task.blocked",
  "mission.execution.closure",
  "artifact.persisted",
  "agent.execution.lifecycle",
  "session.error",
  "review.stream.started",
  "review.stream.progress",
  "review.stream.chunk",
])

const BOARD_INVALIDATING_PREFIXES = [
  "run.",
  "goal.",
  "interaction.",
  "agent.coordination.",
] as const

const ROUTER_CONSUMED_NOOP_TYPES = new Set([
  "agent.updated",
  "message.injected",
  "mission.handoff",
  "session.diff",
  "scheduler.message",
])

export function isTreeWriterNoopEventType(type: string): boolean {
  return TREE_WRITER_NOOP_TYPES.has(type)
}

export function isTreeWriterPassThroughEventType(type: string): boolean {
  return TREE_WRITER_PASS_THROUGH_EXACT_TYPES.has(type) || hasPrefix(type, TREE_WRITER_PASS_THROUGH_PREFIXES)
}

export function isTreeWriterKnownEventType(type: string): boolean {
  return (
    TREE_WRITER_PROJECTED_EXACT_TYPES.has(type) ||
    isTreeWriterNoopEventType(type) ||
    isTreeWriterPassThroughEventType(type)
  )
}

export function isBoardInvalidatingEventType(type: string): boolean {
  return (
    BOARD_INVALIDATING_EXACT_TYPES.has(type) ||
    hasPrefix(type, BOARD_INVALIDATING_PREFIXES)
  )
}

export function isRouterConsumedNoopEventType(type: string): boolean {
  return ROUTER_CONSUMED_NOOP_TYPES.has(type)
}

export type ConversationEventOwner = "tree-writer" | "board"

/**
 * Assign every task-scoped conversation event to its canonical projection
 * owner. Tree events may also invalidate the Board, but the tree writer must
 * never receive Board-only control-plane events such as artifact persistence.
 */
export function conversationEventOwner(type: string): ConversationEventOwner {
  const normalized = String(type || "").trim()
  if (!normalized) throw new Error("conversation event missing type")
  if (isTreeWriterKnownEventType(normalized)) return "tree-writer"
  if (isBoardInvalidatingEventType(normalized)) return "board"
  throw new Error(`conversation event has no projection owner: "${normalized}"`)
}
