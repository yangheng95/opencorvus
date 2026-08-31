import z from "zod"
import { isDeepStrictEqual } from "node:util"
import { Database, and, desc, eq } from "@/storage/db"
import { MessageTable, ToolPartRequestTable as PartTable } from "@/session/session.sql"
import { projectToolPartInTransaction } from "@/session/tool-part-facts"
import { Message } from "@/session/message"
import { MissionPanelActionSchema } from "@/panel/capability"
import { materializeToolExecutionInput } from "@/provider/tool-execution-input"
import { resolvePanelArtifactReadReferencesBeforeAction } from "@/agent/artifact-read-facts"
import type { MissionSession } from "./session"
import {
  MissionCompletionActionInput,
  MissionCompletionFact,
  MissionCompletionReceipt,
  type MissionCompletionFactValue,
} from "./completion"

export const MissionBoardLane = z.enum(["backlog", "running", "attention", "review", "completed"])

export const MissionBoardProjection = z.object({
  lane: MissionBoardLane,
  pendingInteractions: z.number().int().nonnegative(),
  completion: MissionCompletionFact.optional(),
})

type MissionTaskLifecycleStatus = "active" | "completed" | "failed" | "cancelled"

export type MissionBoardProjectionInput = {
  interruptible: boolean
  pendingInteractions: number
  taskLifecycleStatuses: MissionTaskLifecycleStatus[]
  completion?: Pick<MissionCompletionFactValue, "summary">
}

export type MissionBoardProjectionValue = z.infer<typeof MissionBoardProjection>

const terminalTaskStatuses = new Set<MissionTaskLifecycleStatus>(["completed", "failed", "cancelled"])

export function deriveMissionBoardLane(input: MissionBoardProjectionInput): z.infer<typeof MissionBoardLane> {
  const rules: Array<{ lane: z.infer<typeof MissionBoardLane>; matches: boolean }> = [
    { lane: "completed", matches: input.completion !== undefined },
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

function currentMissionCompletion(session: MissionSession): MissionCompletionFactValue | undefined {
  const messages = Database.use((db) =>
    db
      .select({ id: MessageTable.id, timeCreated: MessageTable.time_created, data: MessageTable.data })
      .from(MessageTable)
      .where(eq(MessageTable.session_id, session.id))
      .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
      .all(),
  )
  const latestUser = messages.find((message) => message.data.role === "user")
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
    if (!part.success || part.data.tool !== "panel" || part.data.state.status !== "completed") continue
    const currentInput = MissionCompletionActionInput.safeParse(
      materializeToolExecutionInput(MissionPanelActionSchema, part.data.state.input),
    )
    if (!currentInput.success) continue
    const input = currentInput.data
    let decoded: unknown
    try {
      decoded = JSON.parse(part.data.state.output)
    } catch {
      continue
    }
    const receipt = MissionCompletionReceipt.safeParse(decoded)
    if (!receipt.success) continue
    const receiptInputAcceptances = receipt.data.task_acceptances.map(
      ({ terminal_lifecycle_reference: _reference, ...acceptance }) => acceptance,
    )
    const canonicalInputAcceptances = input.task_acceptances.map((acceptance) => {
      const receiptAcceptance = receipt.data.task_acceptances.find(
        (candidate) => candidate.task_id === acceptance.task_id,
      )
      if (!receiptAcceptance) {
        throw new Error(`Mission completion receipt omits Task ${acceptance.task_id}.`)
      }
      return {
        task_id: acceptance.task_id,
        evidence_locators: resolvePanelArtifactReadReferencesBeforeAction({
          sessionID: session.id,
          assistantMessageID: row.messageID,
          toolPartID: row.part.id,
          taskID: acceptance.task_id,
          terminalLifecycleReference: receiptAcceptance.terminal_lifecycle_reference,
          references: acceptance.evidence_read_refs,
        }),
      }
    })
    if (
      receipt.data.mission_id !== session.missionID ||
      receipt.data.mission_session_id !== session.id ||
      receipt.data.assistant_message_id !== row.messageID ||
      receipt.data.tool_call_id !== part.data.callID ||
      receipt.data.tool_part_id !== row.part.id ||
      receipt.data.summary !== input.summary ||
      !isDeepStrictEqual(receiptInputAcceptances, canonicalInputAcceptances)
    ) {
      continue
    }
    return MissionCompletionFact.parse({
      messageID: row.messageID,
      toolCallID: part.data.callID,
      toolPartID: row.part.id,
      summary: receipt.data.summary,
      timeRecorded: receipt.data.time_recorded,
    })
  }
}

export function missionBoardProjection(
  session: MissionSession,
  input: Omit<MissionBoardProjectionInput, "completion">,
): MissionBoardProjectionValue {
  const completion = currentMissionCompletion(session)
  return MissionBoardProjection.parse({
    lane: deriveMissionBoardLane({ ...input, completion }),
    pendingInteractions: input.pendingInteractions,
    completion,
  })
}
