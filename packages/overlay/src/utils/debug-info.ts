import { getServerUrl } from "../services/api"
import type { BoardSource, TaskSelectionError } from "../store/board"
import type { CardTreeStore } from "../store/card-tree"
import type {
  PersistedChatDebugPlane,
  PersistedChatDebugProjection,
  PersistedChatDebugSummary,
} from "../services/session-debug"
import { getHostTransport } from "../services/host-transport-runtime"
import { boundedDebugText, normalizeDebugDirectory } from "./debug-text"

type RuntimeDebugPaths = { database?: string | null } | null | undefined

const DEBUG_BUNDLE_SCHEMA = "opencorvus.debug.v2"

export class DebugProjectDirectoryUnavailableError extends Error {
  override readonly name = "DebugProjectDirectoryUnavailableError"
}

export function debugCopyFailureMessage(error: unknown, fallback: string): string {
  return error instanceof DebugProjectDirectoryUnavailableError ? error.message : fallback
}

export function requireDebugProjectDirectory(directory: string, errorMessage: string): string {
  const candidate = directory.trim()
  if (!candidate) throw new DebugProjectDirectoryUnavailableError(errorMessage)
  return candidate
}

function debugText(value: unknown, fallback = "-", limit = 240): string {
  return boundedDebugText(value, limit) || fallback
}

function aiAnalysisRequest(scope: "Task" | "Chat"): string[] {
  return [
    `AI analysis request:`,
    `  Paste this entire bundle into an AI assistant. Ask it to:`,
    `  1. separate observed facts from inference and treat unavailable data as unknown, never zero;`,
    `  2. reconstruct the ${scope} timeline and identify the direct trigger, likely root cause, and confidence;`,
    `  3. call out contradictory persisted/runtime/rendered states;`,
    `  4. propose the smallest read-only checks that would confirm or falsify the diagnosis.`,
  ]
}

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
    typeof incident?.message === "string" && incident.message.trim() ? `; message=${debugText(incident.message)}` : ""
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
  const artifacts: any[] = Array.isArray(board?.artifacts) ? board.artifacts : []
  const incidents = taskProcessIncidents(board)
  const completedAt = Number(board?.task?.time?.completed ?? 0)
  const counts = new Map<string, number>()
  const terminalReasonCounts = new Map<string, number>()
  let occurrenceUpdated = 0
  for (const occurrence of occurrences) {
    const status = typeof occurrence?.latest?.status?.type === "string" ? occurrence.latest.status.type : "pending"
    counts.set(status, (counts.get(status) ?? 0) + 1)
    if (status === "terminal") {
      const reason =
        typeof occurrence?.latest?.status?.reason === "string" && occurrence.latest.status.reason.trim()
          ? debugText(occurrence.latest.status.reason, "unspecified")
          : occurrence?.latest?.status?.error
            ? "error"
            : "unspecified"
      terminalReasonCounts.set(reason, (terminalReasonCounts.get(reason) ?? 0) + 1)
    }
    occurrenceUpdated = Math.max(occurrenceUpdated, Number(occurrence?.latest?.emittedAt ?? 0))
  }
  const topologyUpdated = nodes.reduce(
    (maximum, node) => Math.max(maximum, Number(node?.time?.updated ?? node?.time?.created ?? 0)),
    0,
  )
  const artifactUpdated = artifacts.reduce(
    (maximum, artifact) => Math.max(maximum, Number(artifact?.time?.updated ?? artifact?.time?.created ?? 0)),
    0,
  )
  const incidentUpdated = incidents.reduce(
    (maximum, incident) => Math.max(maximum, Number(incident?.emittedAt ?? 0)),
    0,
  )
  const updated = Math.max(occurrenceUpdated, topologyUpdated, artifactUpdated, incidentUpdated)
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
    updatedSources: {
      occurrence: occurrenceUpdated,
      topology: topologyUpdated,
      artifact: artifactUpdated,
      incident: incidentUpdated,
    },
  }
}

function debugAgentActivityNode(node: any): string {
  const status = node?.latest?.status
  const terminal =
    status?.type === "terminal"
      ? `; reason=${debugText(status?.reason ?? (status?.error ? "error" : "unspecified"), "unspecified")}` +
        (status?.error ? `; error=${debugText(status.error)}` : "")
      : ""
  return (
    `inputMessageID=${String(node?.inputMessageID ?? "?")}  session=${String(node?.sessionID ?? "?")}; agent=${String(node?.agent ?? "?")}; ` +
    `kind=${String(node?.kind ?? "?")}; status=${String(status?.type ?? "unknown")}${terminal}; ` +
    `updated=${formatDebugTime(node?.latest?.emittedAt)}`
  )
}

function debugIngressProjection(projection: any): string {
  if (!projection || typeof projection !== "object" || typeof projection.state !== "string") return "unknown"
  const details = Object.entries(projection)
    .filter(([key]) => key !== "state")
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") || "none" : String(value)}`)
    .join("; ")
  return `${projection.state}${details ? `; ${details}` : ""}`
}

function debugTaskRootIngress(ingress: any): string[] {
  const activationIDs = Array.isArray(ingress?.activationIDs) ? ingress.activationIDs : undefined
  const activations = Array.isArray(ingress?.activations) ? ingress.activations : undefined
  const semanticTurnIDs = Array.isArray(ingress?.semanticTurnIDs) ? ingress.semanticTurnIDs : undefined
  const decisions = Array.isArray(ingress?.decisions) ? ingress.decisions : undefined
  return [
    `  ingress=${String(ingress?.ingressID ?? "?")} source=${String(ingress?.source ?? "unknown")}:${String(ingress?.sourceID ?? "unknown")}; epoch=${String(ingress?.executionEpoch ?? "unknown")}; sequence=${String(ingress?.sequence ?? "unknown")}; accepted=${formatDebugTime(ingress?.acceptedAt)}`,
    `    activations=${activationIDs ? activationIDs.length : "unknown"}; activation_ids=${activationIDs ? activationIDs.join(",") || "none" : "unknown"}; activated_at=${activations ? activations.map((activation: any) => formatDebugTime(activation?.activatedAt)).join(",") || "none" : "unknown"}`,
    `    semantic_turns=${semanticTurnIDs ? semanticTurnIDs.length : "unknown"}; semantic_turn_ids=${semanticTurnIDs ? semanticTurnIDs.join(",") || "none" : "unknown"}`,
    `    decisions=${decisions ? decisions.map((decision: any) => `${String(decision?.receiptID ?? "?")}:${String(decision?.command ?? "unknown")}`).join(",") || "none" : "unknown"}`,
    `    projection=${debugIngressProjection(ingress?.projection)}`,
  ]
}

export function buildTaskDebugBlob(
  board: any,
  source: Extract<BoardSource, { kind: "task" }>,
  runtimePaths?: RuntimeDebugPaths,
): string {
  const task = board?.task
  const id = typeof task?.id === "string" ? task.id : ""
  if (!id) return ""
  if (source.id !== id) throw new Error(`Task debug board belongs to ${id}, expected ${source.id}`)
  const taskDirectory = String(task?.directory ?? "-")
  const cancellation = task?.cancellation
  const projectWorktree = String(board?.project?.worktree ?? "-")
  const serverUrl = getServerUrl()
  const goals: any[] = Array.isArray(board?.goals) ? board.goals : []
  const activity = taskAgentActivity(board)
  const processIncidents = taskProcessIncidents(board)
  const taskRootIngresses: any[] | undefined = Array.isArray(board?.taskRootIngresses)
    ? board.taskRootIngresses
    : undefined
  const lines: string[] = []
  const push = (...l: string[]) => lines.push(...l)

  push(
    `# Task Debug Info (double-click 任务 → clipboard)`,
    `bundle.schema:  ${DEBUG_BUNDLE_SCHEMA}`,
    `bundle.scope:   task:${id}`,
    `# Generated: ${formatDebugTime(Date.now())}`,
    ``,
    ...aiAnalysisRequest("Task"),
    ``,
    `selected.source: task:${source.id}`,
    `selected.directory: ${String(source.directory ?? "-")}`,
    `task.id:        ${id}`,
    `task.title:     ${debugText(task?.title)}`,
    `task.status:    ${String(task?.status ?? "-")}`,
    `task.terminal:  ${debugText(task?.terminalReason)}`,
    `task.error:     ${debugText(task?.error)}`,
    `task.cancellation.request_event: ${String(cancellation?.requestEventID ?? "-")}`,
    `task.cancellation.terminal_event: ${String(cancellation?.terminalEventID ?? "-")}`,
    `task.cancellation.requested_at: ${formatDebugTime(cancellation?.requestedAt)}`,
    `task.cancellation.terminal_at: ${formatDebugTime(cancellation?.terminalAt)}`,
    `task.cancellation.source: ${String(cancellation?.source ?? "-")}`,
    `task.cancellation.request: ${String(cancellation?.requestID ?? "-")}`,
    `task.cancellation.actor: ${String(cancellation?.actor ?? "-")}`,
    `task.cancellation.surface: ${String(cancellation?.surface ?? "-")}`,
    `task.cancellation.reason: ${debugText(cancellation?.reason)}`,
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
    `task.activity.sources: occurrence=${formatDebugTime(activity.updatedSources.occurrence)}; topology=${formatDebugTime(activity.updatedSources.topology)}; artifact=${formatDebugTime(activity.updatedSources.artifact)}; incident=${formatDebugTime(activity.updatedSources.incident)}`,
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
  push(``, `Task-root ingress reductions (${taskRootIngresses ? taskRootIngresses.length : "unknown"}):`)
  if (!taskRootIngresses) {
    push(
      `  unavailable; ingress and activation counts are unknown, not zero; error=${debugText(board?.taskRootIngressDebugError, "unknown")}`,
    )
  } else if (taskRootIngresses.length === 0) {
    push(`  (validated empty)`)
  } else {
    for (const ingress of taskRootIngresses) push(...debugTaskRootIngress(ingress))
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
        `  #${n}  ${gid}  ${debugText(goal?.goalTitle, "-", 80)}`,
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
    `bundle.schema:  ${DEBUG_BUNDLE_SCHEMA}`,
    `bundle.scope:   task-load:${taskID}`,
    `# Generated: ${formatDebugTime(Date.now())}`,
    ``,
    ...aiAnalysisRequest("Task"),
    ``,
    `task.id:        ${taskID}`,
    `task.title:     ${debugText(failure.title)}`,
    `task.directory: ${failure.directory || "-"}`,
    `server.url:     ${getServerUrl()}`,
    `runtime.db:     ${runtimePaths?.database?.trim() || "-"}`,
    ``,
    `Load failure:`,
    debugText(failure.details, "-", 1200),
  ].join("\n")
}

function debugPersistedSummary(summary: PersistedChatDebugSummary): string[] {
  const messages = summary.stats.messages
  const tools = summary.stats.tools
  const lines = [
    `  sessions:              ${summary.sessionIDs.join(", ") || "(validated empty)"}`,
    `  messages.total:        ${messages.total}`,
    `  messages.user:         ${messages.user}`,
    `  messages.assistant:    ${messages.assistant}`,
    `  messages.other:        ${messages.other}`,
    `  assistant.incomplete:  ${messages.assistantIncomplete}`,
    `  assistant.completed:   ${messages.assistantCompleted}`,
    `  assistant.error:       ${messages.assistantError}`,
    `  tools.total:           ${tools.total}`,
    `  tools.pending:         ${tools.pending}`,
    `  tools.running:         ${tools.running}`,
    `  tools.completed:       ${tools.completed}`,
    `  tools.error:           ${tools.error}`,
    `  tools.other:           ${tools.other}`,
    `  recent messages (${summary.recentMessages.length}; omitted older=${summary.omittedMessages}):`,
  ]
  if (summary.recentMessages.length === 0) lines.push(`    (validated empty)`)
  for (const message of summary.recentMessages) {
    lines.push(
      `    ${message.messageID} session=${message.sessionID}; role=${message.role}; created=${formatDebugTime(message.created)}; completed=${formatDebugTime(message.completed)}; finish=${message.finish ?? "-"}; error=${message.errorName ?? "-"}; parts=${message.partCount}; tools=${message.toolCount}`,
    )
    if (message.userTextPreview) lines.push(`      user.text: ${message.userTextPreview}`)
  }
  lines.push(`  recent tools (${summary.recentTools.length}; omitted older=${summary.omittedTools}):`)
  if (summary.recentTools.length === 0) lines.push(`    (validated empty)`)
  for (const tool of summary.recentTools) {
    lines.push(
      `    ${tool.partID} session=${tool.sessionID}; message=${tool.messageID}; call=${tool.callID ?? "-"}; tool=${tool.tool}; status=${tool.status}; start=${formatDebugTime(tool.started)}; end=${formatDebugTime(tool.completed)}; failure.kind=${tool.failureKind ?? "-"}; failure=${tool.failure ?? "-"}`,
    )
  }
  return lines
}

function debugPersistedPlane(label: string, plane: PersistedChatDebugPlane): string[] {
  if (plane.status === "unavailable") {
    return [
      `${label}:`,
      `  endpoint: ${plane.endpoint}`,
      `  collected: ${formatDebugTime(plane.collectedAt)}`,
      `  status: unavailable`,
      `  error: ${debugText(plane.error, "unknown persisted Session read failure", 500)}`,
      `  interpretation: unknown; do not treat this plane as zero`,
    ]
  }
  const board = plane.board
    ? [
        `  board.session: ${plane.board.sessionID}`,
        `  board.title: ${debugText(plane.board.title)}`,
        `  board.status: ${plane.board.status ?? "-"}`,
        `  board.directory: ${plane.board.directory ?? "-"}`,
      ]
    : []
  return [
    `${label}:`,
    `  endpoint: ${plane.endpoint}`,
    `  collected: ${formatDebugTime(plane.collectedAt)}`,
    `  status: available`,
    ...board,
    ...debugPersistedSummary(plane.summary),
  ]
}

export function buildChatDebugBlob(
  board: any,
  source: BoardSource | null,
  cardTree: CardTreeStore,
  persisted: PersistedChatDebugProjection,
): string {
  if (source?.kind !== "session") return ""
  const boardSessionID = typeof board?.sessionID === "string" ? board.sessionID : ""
  const sessionID = source.id
  if (!sessionID) return ""
  if (boardSessionID !== sessionID) {
    throw new Error(`Chat debug board belongs to ${boardSessionID || "-"}, expected ${sessionID}`)
  }
  if (persisted.sessionID !== sessionID) {
    throw new Error(`Chat debug persistence belongs to ${persisted.sessionID}, expected ${sessionID}`)
  }
  const sourceDirectory = String(source.directory ?? "").trim()
  const boardDirectory = String(board?.directory ?? "").trim()
  if (!sourceDirectory) throw new Error(`Chat debug source ${sessionID} has no project directory`)
  if (boardDirectory && normalizeDebugDirectory(boardDirectory) !== normalizeDebugDirectory(sourceDirectory)) {
    throw new Error(`Chat debug board directory ${boardDirectory} does not match selected ${sourceDirectory}`)
  }
  if (normalizeDebugDirectory(persisted.directory) !== normalizeDebugDirectory(sourceDirectory)) {
    throw new Error(
      `Chat debug persistence directory ${persisted.directory} does not match selected ${sourceDirectory}`,
    )
  }
  const cards = Object.values(cardTree.cards)
  const counts = cards.reduce(
    (acc, card) => {
      acc.total += 1
      acc[card.kind] = (acc[card.kind] ?? 0) + 1
      return acc
    },
    { total: 0 } as Record<string, number>,
  )
  const generatedAt = Date.now()
  return [
    `# Chat Debug Info (double-click chat → clipboard)`,
    `bundle.schema:  ${DEBUG_BUNDLE_SCHEMA}`,
    `bundle.scope:   session:${sessionID}`,
    `# Generated: ${formatDebugTime(generatedAt)}`,
    ``,
    ...aiAnalysisRequest("Chat"),
    ``,
    `chat.session:   ${sessionID}`,
    `selected.source: ${source.kind}:${source.id}`,
    `selected.directory: ${sourceDirectory}`,
    `server.url:     ${getServerUrl()}`,
    `collection.started: ${formatDebugTime(persisted.startedAt)}`,
    `collection.completed: ${formatDebugTime(persisted.completedAt)}`,
    ``,
    ...debugPersistedPlane(`Persisted root Session (raw messages only)`, persisted.root),
    ``,
    ...debugPersistedPlane(`Persisted Session tree (visible conversation transcript)`, persisted.tree),
    ``,
    `Rendered Overlay snapshot (local, non-atomic with persisted reads):`,
    `  captured: ${formatDebugTime(generatedAt)}`,
    `  board.session: ${boardSessionID}`,
    `  board.title: ${debugText(board?.title)}`,
    `  board.status: ${String(board?.status ?? "-")}`,
    `  board.directory: ${boardDirectory || "-"}`,
    `  top.level: ${cardTree.order.length}`,
    `  total:     ${counts.total}`,
    `  agents:    ${counts.agent ?? 0}`,
    `  messages:  ${counts.message ?? 0}`,
    `  tools:     ${counts.tool ?? 0}`,
  ].join("\n")
}

export async function writeDebugClipboard(text: string): Promise<void> {
  if (!text) throw new Error("debug clipboard text is empty")
  await getHostTransport().native({ kind: "clipboard.writeText", text })
}
