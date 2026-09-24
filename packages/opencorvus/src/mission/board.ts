import z from "zod"
import { isDeepStrictEqual } from "node:util"
import { Database, and, desc, eq } from "@/storage/db"
import { MessageTable, ToolPartRequestTable as PartTable } from "@/session/session.sql"
import { projectToolPartInTransaction } from "@/session/tool-part-facts"
import { Message } from "@/session/message"
import { SessionWakeReason } from "@/session/wake-reason"
import { listMissionTasks } from "@/engine/store"
import { deriveTaskStatus } from "@/engine/task-status"
import { terminalLifecycleReferenceMatchesTaskRow } from "@/engine/terminal-lifecycle-reference"
import { AutomationFireTable, AutomationTable } from "@/scheduler/automation.sql"
import { resolveMissionArtifactReadAcceptancesBeforeCompletion } from "@/agent/artifact-read-facts"
import type { MissionSession } from "./session"
import {
  MissionBlockActionInput,
  MissionBlockReceipt,
  MissionCompletionActionInput,
  MissionCompletionReceipt,
  MissionOutcomeFact,
  type MissionOutcomeFactValue,
} from "./completion"

export const MissionBoardLane = z.enum(["backlog", "running", "attention", "review", "completed"])

export const MissionBoardProjection = z.object({
  lane: MissionBoardLane,
  pendingInteractions: z.number().int().nonnegative(),
  outcome: MissionOutcomeFact.optional(),
})

type MissionTaskLifecycleStatus = "active" | "completed" | "failed" | "cancelled"

export type MissionBoardProjectionInput = {
  interruptible: boolean
  pendingInteractions: number
  taskLifecycleStatuses: MissionTaskLifecycleStatus[]
  outcome?: Pick<MissionOutcomeFactValue, "kind" | "summary">
}

export type MissionBoardProjectionValue = z.infer<typeof MissionBoardProjection>

const terminalTaskStatuses = new Set<MissionTaskLifecycleStatus>(["completed", "failed", "cancelled"])

export function deriveMissionBoardLane(input: MissionBoardProjectionInput): z.infer<typeof MissionBoardLane> {
  const rules: Array<{ lane: z.infer<typeof MissionBoardLane>; matches: boolean }> = [
    { lane: "completed", matches: input.outcome?.kind === "accepted" },
    { lane: "attention", matches: input.outcome?.kind === "blocked" },
    {
      lane: "attention",
      matches: input.pendingInteractions > 0 || input.taskLifecycleStatuses.includes("cancelled"),
    },
    {
      lane: "running",
      matches: input.interruptible || input.taskLifecycleStatuses.some((status) => status === "active"),
    },
    {
      lane: "review",
      matches:
        input.taskLifecycleStatuses.length > 0 &&
        input.taskLifecycleStatuses.every((status) => terminalTaskStatuses.has(status)),
    },
    { lane: "backlog", matches: true },
  ]
  return rules.find((rule) => rule.matches)!.lane
}

function orderedAfter(
  candidate: { timeCreated: number; id: string },
  reference: { timeCreated: number; id: string },
): boolean {
  return (
    candidate.timeCreated > reference.timeCreated ||
    (candidate.timeCreated === reference.timeCreated && candidate.id > reference.id)
  )
}

function currentMissionOutcome(session: MissionSession): MissionOutcomeFactValue | undefined {
  const messages = Database.use((db) =>
    db
      .select({ id: MessageTable.id, timeCreated: MessageTable.time_created, data: MessageTable.data })
      .from(MessageTable)
      .where(eq(MessageTable.session_id, session.id))
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .all(),
  )
  const latestUser = messages.find((message) => {
    if (message.data.role !== "user") return false
    if (message.data.author === "user") return true
    const extra = (message.data as { extra?: { wake_reason?: unknown } }).extra
    const wake = SessionWakeReason.safeParse(extra?.wake_reason)
    if (wake.success && wake.data.source === "scheduler.automation") {
      const reason = wake.data
      const delay = Database.use((db) => db.select({ id: AutomationFireTable.id }).from(AutomationFireTable)
        .innerJoin(AutomationTable, eq(AutomationTable.id, AutomationFireTable.automation_revision_id))
        .where(and(eq(AutomationFireTable.id, reason.fireID), eq(AutomationTable.definition_id, reason.jobID),
          eq(AutomationTable.kind, "delay"), eq(AutomationTable.session_id, session.id),
          eq(AutomationTable.project_id, session.projectID))).get())
      return delay === undefined
    }
    return wake.success && ["mission.operator", "conversation.handoff", "api.chat"].includes(wake.data.source)
  })
  const currentTasks = listMissionTasks({ projectID: session.projectID, missionID: session.missionID, sessionID: session.id })
  const parts = Database.use((db) =>
    db
      .select({
        part: PartTable,
        messageID: PartTable.message_id,
        messageTimeCreated: MessageTable.time_created,
        messageData: MessageTable.data,
      })
      .from(PartTable)
      .innerJoin(MessageTable, eq(PartTable.message_id, MessageTable.id))
      .where(eq(MessageTable.session_id, session.id))
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id), desc(PartTable.time_created), desc(PartTable.id))
      .all()
      .map((row) => ({ ...row, projected: projectToolPartInTransaction(db, row.part) })),
  )

  for (const row of parts) {
    if (row.messageData.role !== "assistant") continue
    if (latestUser && !orderedAfter({ id: row.messageID, timeCreated: row.messageTimeCreated }, latestUser)) continue
    const part = Message.ToolPart.safeParse(row.projected)
    if (!part.success || part.data.state.status !== "completed") continue
    const blocked = part.data.tool === "panel_block_mission"
    if (!blocked && part.data.tool !== "panel_complete_mission") continue
    if (!part.data.state.input || typeof part.data.state.input !== "object" || Array.isArray(part.data.state.input))
      continue
    let decoded: unknown
    try {
      decoded = JSON.parse(part.data.state.output)
    } catch {
      continue
    }
    let inputRows: Array<{ task_id: string; evidence_read_refs: string[] }>
    let receiptRows: Array<{
      task_id: string
      evidence_locators: z.infer<typeof MissionBlockReceipt>["task_reviews"][number]["evidence_locators"]
      terminal_lifecycle_reference: z.infer<typeof MissionBlockReceipt>["task_reviews"][number]["terminal_lifecycle_reference"]
    }>
    let receipt: {
      mission_id: string
      mission_session_id: string
      assistant_message_id: string
      tool_call_id: string
      tool_part_id: string
      summary: string
      time_recorded: number
    }
    let summary: string
    let unresolvedCriteria: string[] | undefined
    if (blocked) {
      const currentInput = MissionBlockActionInput.safeParse({
        action: "block_mission",
        ...(part.data.state.input as Record<string, unknown>),
      })
      const currentReceipt = MissionBlockReceipt.safeParse(decoded)
      if (!currentInput.success || !currentReceipt.success) continue
      inputRows = currentInput.data.task_reviews
      receiptRows = currentReceipt.data.task_reviews
      receipt = currentReceipt.data
      summary = currentInput.data.summary
      unresolvedCriteria = currentInput.data.unresolved_criteria
      if (!isDeepStrictEqual(currentReceipt.data.unresolved_criteria, unresolvedCriteria)) continue
    } else {
      const currentInput = MissionCompletionActionInput.safeParse({
        action: "complete_mission",
        ...(part.data.state.input as Record<string, unknown>),
      })
      const currentReceipt = MissionCompletionReceipt.safeParse(decoded)
      if (!currentInput.success || !currentReceipt.success) continue
      inputRows = currentInput.data.task_acceptances
      receiptRows = currentReceipt.data.task_acceptances
      receipt = currentReceipt.data
      summary = currentInput.data.summary
    }
    const reviewedIDs = new Set(receiptRows.map((review) => review.task_id))
    if (reviewedIDs.size !== receiptRows.length || reviewedIDs.size !== currentTasks.length ||
      currentTasks.some((task) => {
        const review = receiptRows.find((entry) => entry.task_id === task.id)
        const status = deriveTaskStatus(task)
        return !review || (blocked ? status !== "completed" && status !== "failed" : status !== "completed") ||
          !terminalLifecycleReferenceMatchesTaskRow(review.terminal_lifecycle_reference, task)
      })) continue
    if (blocked && !currentTasks.some((task) => deriveTaskStatus(task) === "failed")) continue
    const receiptInputRows = receiptRows.map(
      ({ terminal_lifecycle_reference: _reference, ...review }) => review,
    )
    const receiptByTaskID = new Map(receiptRows.map((review) => [review.task_id, review]))
    const resolvedAcceptances = resolveMissionArtifactReadAcceptancesBeforeCompletion({
      sessionID: session.id,
      assistantMessageID: row.messageID,
      toolPartID: row.part.id,
      acceptances: inputRows.map((review) => {
        const receiptReview = receiptByTaskID.get(review.task_id)
        if (!receiptReview) {
          throw new Error(`Mission outcome receipt omits Task ${review.task_id}.`)
        }
        return {
          taskID: review.task_id,
          terminalLifecycleReference: receiptReview.terminal_lifecycle_reference,
          references: review.evidence_read_refs,
        }
      }),
    })
    const evidenceLocatorsByTaskID = new Map(
      resolvedAcceptances.map((acceptance) => [acceptance.taskID, acceptance.evidenceLocators]),
    )
    const canonicalInputRows = inputRows.map((review) => {
      return {
        task_id: review.task_id,
        evidence_locators: evidenceLocatorsByTaskID.get(review.task_id)!,
      }
    })
    if (
      receipt.mission_id !== session.missionID ||
      receipt.mission_session_id !== session.id ||
      receipt.assistant_message_id !== row.messageID ||
      receipt.tool_call_id !== part.data.callID ||
      receipt.tool_part_id !== row.part.id ||
      receipt.summary !== summary ||
      !isDeepStrictEqual(receiptInputRows, canonicalInputRows)
    ) {
      continue
    }
    return MissionOutcomeFact.parse({
      kind: blocked ? "blocked" : "accepted",
      messageID: row.messageID,
      toolCallID: part.data.callID,
      toolPartID: row.part.id,
      summary: receipt.summary,
      timeRecorded: receipt.time_recorded,
      ...(blocked ? { unresolvedCriteria } : {}),
    })
  }
}

export function missionBoardProjection(
  session: MissionSession,
  input: Omit<MissionBoardProjectionInput, "outcome">,
): MissionBoardProjectionValue {
  const outcome = currentMissionOutcome(session)
  return MissionBoardProjection.parse({
    lane: deriveMissionBoardLane({ ...input, outcome }),
    pendingInteractions: input.pendingInteractions,
    outcome,
  })
}
