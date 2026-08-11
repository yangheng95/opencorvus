import { getServerUrl } from "../services/api"
import type { BoardSource, TaskSelectionError } from "../store/board"
import type { CardTreeStore } from "../store/card-tree"
import type { PersistedChatDebugProjection } from "../services/session-debug"

type RuntimeDebugPaths = { database?: string | null } | null | undefined

/** Format a millisecond timestamp for copyable debug blobs. */
export function formatDebugTime(ms: unknown): string {
  const n = typeof ms === "number" ? ms : Number(ms)
  if (!Number.isFinite(n) || n <= 0) return "-"
  return new Date(n)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, "Z")
}

function debugGoalBoardFiles(goal: any): string {
  const contribution = goal?.contribution && typeof goal.contribution === "object" ? goal.contribution : {}
  const files = Array.isArray(contribution.files) ? contribution.files : []
  const commitRefs = Array.isArray(contribution.contributionCommitRefs)
    ? contribution.contributionCommitRefs.filter((value: unknown): value is string => typeof value === "string")
    : []
  const publishedCommitRefs = Array.isArray(contribution.publishedCommitRefs)
    ? contribution.publishedCommitRefs.filter((value: unknown): value is string => typeof value === "string")
    : []
  const diffRefs = Array.isArray(contribution.diffRefs)
    ? contribution.diffRefs.flatMap((value: any) =>
        typeof value?.base === "string" && typeof value?.head === "string" ? [`${value.base}..${value.head}`] : [],
      )
    : []
  const observationRefs = Array.isArray(contribution.observationArtifactIDs)
    ? contribution.observationArtifactIDs.filter((value: unknown): value is string => typeof value === "string")
    : []
  const additions = files.reduce((sum: number, diff: any) => sum + Number(diff?.additions ?? 0), 0)
  const deletions = files.reduce((sum: number, diff: any) => sum + Number(diff?.deletions ?? 0), 0)
  const statText = `${files.length} files, +${additions}/-${deletions}`
  return (
    `observedChangedFiles=${files.length}; changedFileDiffs=${files.length}; ` +
    `contributionCommits=${commitRefs.length ? commitRefs.join(",") : "none"}; ` +
    `publishedCommits=${publishedCommitRefs.length ? publishedCommitRefs.join(",") : "none"}; ` +
    `diffRefs=${diffRefs.length ? diffRefs.join(",") : "-"}; diffStats=${statText}; ` +
    `buildObservations=${observationRefs.length ? observationRefs.join(",") : "-"}`
  )
}

function taskProcessIncidents(board: any): any[] {
  return Array.isArray(board?.processIncidents) ? board.processIncidents : []
}

function debugProcessIncident(incident: any): string {
  const message =
    typeof incident?.message === "string" && incident.message.trim()
      ? `; message=${incident.message.replace(/\s+/g, " ").slice(0, 240)}`
      : ""
  const affectedExecutions = Array.isArray(incident?.affectedExecutions)
    ? incident.affectedExecutions
        .map(
          (execution: any) =>
            `${String(execution?.sessionID ?? "?")}/${String(execution?.inputMessageID ?? "precommit")}`,
        )
        .join(",") || "-"
    : "-"
  return (
    `${String(incident?.id ?? "?")}  source=${String(incident?.source ?? "?")}; session=${String(incident?.sessionID ?? "?")}; ` +
    `inputMessageID=${String(incident?.inputMessageID ?? "-")}; ` +
    `processOccurrenceID=${String(incident?.processOccurrenceID ?? "-")}; affectedExecutions=${affectedExecutions}; ` +
    `error=${String(incident?.errorName ?? "unknown")}; emitted=${formatDebugTime(incident?.emittedAt)}${message}`
  )
}

function taskAgentActivity(board: any) {
  const nodes: any[] = Array.isArray(board?.sessionInvocationTopology?.nodes)
    ? board.sessionInvocationTopology.nodes
    : []
  const occurrences: any[] = Array.isArray(board?.executionProjection?.occurrences)
    ? board.executionProjection.occurrences
    : []
  const completedAt = Number(board?.task?.time?.completed ?? 0)
  const counts = new Map<string, number>()
  const terminalReasonCounts = new Map<string, number>()
  let updated = 0
  for (const occurrence of occurrences) {
    const status = typeof occurrence?.latest?.status?.type === "string" ? occurrence.latest.status.type : "pending"
    counts.set(status, (counts.get(status) ?? 0) + 1)
    if (status === "terminal") {
      const reason =
        typeof occurrence?.latest?.status?.reason === "string" && occurrence.latest.status.reason.trim()
          ? occurrence.latest.status.reason.trim()
          : occurrence?.latest?.status?.error
            ? "error"
            : "unspecified"
      terminalReasonCounts.set(reason, (terminalReasonCounts.get(reason) ?? 0) + 1)
    }
    updated = Math.max(updated, Number(occurrence?.latest?.emittedAt ?? 0))
  }
  const nonterminal = occurrences.filter((occurrence) => occurrence?.latest?.status?.type !== "terminal")
  const abnormalTerminal = occurrences.filter(
    (occurrence) =>
      occurrence?.latest?.status?.type === "terminal" &&
      occurrence?.latest?.status?.reason !== "completed" &&
      occurrence?.latest?.status?.reason !== "coordinated",
  )
  const postTerminalActivity =
    completedAt > 0 ? occurrences.filter((occurrence) => Number(occurrence?.latest?.emittedAt ?? 0) > completedAt) : []
  const statusSummary = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${status}=${count}`)
    .join(", ")
  const terminalReasonSummary = [...terminalReasonCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ")
  return {
    nodes,
    occurrences,
    nonterminal,
    abnormalTerminal,
    postTerminalActivity,
    statusSummary,
    terminalReasonSummary,
    updated,
  }
}

function debugAgentActivityNode(node: any): string {
  const status = node?.latest?.status
  const terminal =
    status?.type === "terminal"
      ? `; reason=${String(status?.reason ?? (status?.error ? "error" : "unspecified"))}` +
        (status?.error ? `; error=${String(status.error).replace(/\s+/g, " ").slice(0, 240)}` : "")
      : ""
  return (
    `inputMessageID=${String(node?.inputMessageID ?? "?")}  session=${String(node?.sessionID ?? "?")}; agent=${String(node?.agent ?? "?")}; ` +
    `kind=${String(node?.kind ?? "?")}; status=${String(status?.type ?? "unknown")}${terminal}; ` +
    `updated=${formatDebugTime(node?.latest?.emittedAt)}`
  )
}

export function buildTaskDebugBlob(board: any, runtimePaths?: RuntimeDebugPaths): string {
  const task = board?.task
  const id = typeof task?.id === "string" ? task.id : ""
  if (!id) return ""
  const taskDirectory = String(task?.directory ?? "-")
  const cancellation = task?.cancellation
  const projectWorktree = String(board?.project?.worktree ?? "-")
  const serverUrl = getServerUrl()
  const goals: any[] = Array.isArray(board?.goals) ? board.goals : []
  const activity = taskAgentActivity(board)
  const processIncidents = taskProcessIncidents(board)
  const lines: string[] = []
  const push = (...l: string[]) => lines.push(...l)

  push(
    `# Task Debug Info (double-click 任务 → clipboard)`,
    `# Generated: ${formatDebugTime(Date.now())}`,
    ``,
    `task.id:        ${id}`,
    `task.title:     ${String(task?.title ?? "-")}`,
    `task.status:    ${String(task?.status ?? "-")}`,
    `task.terminal:  ${String(task?.terminalReason ?? "-")}`,
    `task.error:     ${String(task?.error ?? "-")
      .replace(/\s+/g, " ")
      .slice(0, 240)}`,
    `task.cancellation.request_event: ${String(cancellation?.requestEventID ?? "-")}`,
    `task.cancellation.terminal_event: ${String(cancellation?.terminalEventID ?? "-")}`,
    `task.cancellation.requested_at: ${formatDebugTime(cancellation?.requestedAt)}`,
    `task.cancellation.terminal_at: ${formatDebugTime(cancellation?.terminalAt)}`,
    `task.cancellation.source: ${String(cancellation?.source ?? "-")}`,
    `task.cancellation.request: ${String(cancellation?.requestID ?? "-")}`,
    `task.cancellation.actor: ${String(cancellation?.actor ?? "-")}`,
    `task.cancellation.surface: ${String(cancellation?.surface ?? "-")}`,
    `task.cancellation.reason: ${String(cancellation?.reason ?? "-")}`,
    `task.cancellation.session: ${String(cancellation?.sessionID ?? "-")}`,
    `task.cancellation.message: ${String(cancellation?.messageID ?? "-")}`,
    `task.cancellation.tool_call: ${String(cancellation?.toolCallID ?? "-")}`,
    `task.cancellation.tool_part: ${String(cancellation?.toolPartID ?? "-")}`,
    `task.cancellation.mission: ${String(cancellation?.missionID ?? "-")}`,
    `task.directory: ${taskDirectory}`,
    `project.worktree: ${projectWorktree}`,
    `server.url:     ${serverUrl}`,
    `runtime.db:     ${runtimePaths?.database?.trim() || "-"}`,
    `task.session:   ${String(task?.sessionID ?? "-")}`,
    `task.time.created: ${formatDebugTime(task?.time?.created)}`,
    `task.time.updated: ${formatDebugTime(task?.time?.updated ?? task?.time?.created)}`,
    `task.time.completed: ${formatDebugTime(task?.time?.completed)}`,
    `task.activity.updated: ${formatDebugTime(activity.updated || task?.time?.updated || task?.time?.created)}`,
    `task.activity.after_terminal: ${activity.postTerminalActivity.length}`,
    ``,
    `Agent Session Topology (${activity.nodes.length}) / Execution Occurrences (${activity.occurrences.length}):`,
    `  statuses: ${activity.statusSummary || "-"}`,
    `  nonterminal:`,
  )
  if (activity.nonterminal.length === 0) {
    push(`    (none)`)
  } else {
    for (const node of activity.nonterminal) push(`    ${debugAgentActivityNode(node)}`)
  }
  push(`  post-terminal activity:`)
  if (activity.postTerminalActivity.length === 0) {
    push(`    (none)`)
  } else {
    for (const node of activity.postTerminalActivity) push(`    ${debugAgentActivityNode(node)}`)
  }
  push(`  terminal reasons: ${activity.terminalReasonSummary || "-"}`, `  abnormal terminal:`)
  if (activity.abnormalTerminal.length === 0) {
    push(`    (none)`)
  } else {
    for (const node of activity.abnormalTerminal) push(`    ${debugAgentActivityNode(node)}`)
  }
  push(`  process incidents (${processIncidents.length}):`)
  if (processIncidents.length === 0) {
    push(`    (none)`)
  } else {
    for (const incident of processIncidents) push(`    ${debugProcessIncident(incident)}`)
  }
  push(``, `Goals (${goals.length}):`)
  if (goals.length === 0) {
    push(`  (none - task has not produced goals yet)`)
  } else {
    for (const goal of goals) {
      const gid = String(goal?.goalID ?? "?")
      const n = typeof goal?.orderIndex === "number" ? goal.orderIndex + 1 : "?"
      const activity = goal?.activity
      const reviews = Array.isArray(goal?.reviewAssociations) ? goal.reviewAssociations : []
      const accepted = goal?.acceptance?.accepted === true
      push(
        `  #${n}  ${gid}  ${String(goal?.goalTitle ?? "").slice(0, 80)}`,
        `      slice:     ${String(goal?.deliverySliceID ?? gid)}`,
        `      revision:  ${String(goal?.deliverySliceRevisionID ?? gid)}`,
        `      accepted:  ${accepted}`,
        `      sessions:  ${Array.isArray(activity?.sessionIDs) ? activity.sessionIDs.join(", ") || "-" : "-"}`,
        `      active:    ${Array.isArray(activity?.activeSessionIDs) ? activity.activeSessionIDs.join(", ") || "-" : "-"}`,
        `      reviews:   ${reviews.map((review: any) => `${String(review?.artifactID ?? "?")}:${String(review?.judgment ?? "?")}`).join(", ") || "-"}`,
        `      files:     ${debugGoalBoardFiles(goal)}`,
      )
    }
  }
  return lines.join("\n")
}

export function buildTaskSelectionErrorDebugBlob(
  failure: TaskSelectionError,
  runtimePaths?: RuntimeDebugPaths,
): string {
  const taskID = failure.taskID.trim()
  if (!taskID) return ""
  return [
    `# Task Load Debug Info (double-click 任务 → clipboard)`,
    `# Generated: ${formatDebugTime(Date.now())}`,
    ``,
    `task.id:        ${taskID}`,
    `task.title:     ${failure.title || "-"}`,
    `task.directory: ${failure.directory || "-"}`,
    `server.url:     ${getServerUrl()}`,
    `runtime.db:     ${runtimePaths?.database?.trim() || "-"}`,
    ``,
    `Load failure:`,
    failure.details || "-",
  ].join("\n")
}

export function buildChatDebugBlob(
  board: any,
  source: BoardSource | null,
  cardTree: CardTreeStore,
  persisted?: PersistedChatDebugProjection,
): string {
  if (source?.kind !== "session") return ""
  const boardSessionID = typeof board?.sessionID === "string" ? board.sessionID : ""
  const sessionID = source.id
  if (!sessionID) return ""
  const cards = Object.values(cardTree.cards)
  const counts = cards.reduce(
    (acc, card) => {
      acc.total += 1
      acc[card.kind] = (acc[card.kind] ?? 0) + 1
      return acc
    },
    { total: 0 } as Record<string, number>,
  )
  const persistedLines =
    persisted?.status === "available" && persisted.sessionID === sessionID
      ? [
          `Persisted Session:`,
          `  messages.total:     ${persisted.stats.messages.total}`,
          `  messages.user:      ${persisted.stats.messages.user}`,
          `  messages.assistant: ${persisted.stats.messages.assistant}`,
          `  messages.other:     ${persisted.stats.messages.other}`,
          `  tools.total:        ${persisted.stats.tools.total}`,
          `  tools.pending:      ${persisted.stats.tools.pending}`,
          `  tools.running:      ${persisted.stats.tools.running}`,
          `  tools.completed:    ${persisted.stats.tools.completed}`,
          `  tools.error:        ${persisted.stats.tools.error}`,
          `  tools.other:        ${persisted.stats.tools.other}`,
        ]
      : [
          `Persisted Session:`,
          `  unavailable: ${
            persisted?.status === "available"
              ? `statistics belong to ${persisted.sessionID}, expected ${sessionID}`
              : (persisted?.error ?? "persisted statistics were not requested")
          }`,
        ]
  return [
    `# Chat Debug Info (double-click chat → clipboard)`,
    `# Generated: ${formatDebugTime(Date.now())}`,
    ``,
    `chat.session:   ${sessionID}`,
    `chat.board.session: ${boardSessionID || "-"}`,
    `chat.title:     ${String(board?.title ?? "-")}`,
    `chat.status:    ${String(board?.status ?? "-")}`,
    `chat.directory: ${String(board?.directory ?? "-")}`,
    `server.url:     ${getServerUrl()}`,
    `selected.source: ${source.kind}:${source.id}`,
    ``,
    ...persistedLines,
    ``,
    `Rendered cards:`,
    `  top.level: ${cardTree.order.length}`,
    `  total:     ${counts.total}`,
    `  agents:    ${counts.agent ?? 0}`,
    `  messages:  ${counts.message ?? 0}`,
    `  tools:     ${counts.tool ?? 0}`,
  ].join("\n")
}

export async function writeDebugClipboard(text: string): Promise<void> {
  if (!text) throw new Error("debug clipboard text is empty")
  if (!navigator.clipboard?.writeText) throw new Error("navigator.clipboard.writeText is unavailable")
  await navigator.clipboard.writeText(text)
}
