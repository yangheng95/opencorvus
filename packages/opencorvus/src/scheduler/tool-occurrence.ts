import { createHash } from "node:crypto"
import { MessageTable, ToolPartRequestTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { canonicalJSONValue } from "@/util/canonical-digest"
import type { Tool } from "@/tool/tool"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export type ScheduledToolOccurrence = {
  sessionID: string
  messageID: string
  toolPartID: string
  toolCallID: string
  toolName: "wait" | "schedule"
}

export const ScheduledToolOccurrenceConflictError = NamedError.create(
  "ScheduledToolOccurrenceConflictError",
  z.object({
    message: z.string(),
    tool: z.enum(["wait", "schedule"]),
    toolPartID: z.string(),
    reason: z.string(),
  }),
)

export function scheduledToolOccurrenceConflict(
  occurrence: Pick<ScheduledToolOccurrence, "toolName" | "toolPartID">,
  reason: string,
): InstanceType<typeof ScheduledToolOccurrenceConflictError> {
  return new ScheduledToolOccurrenceConflictError({
    message: `${occurrence.toolName} Tool occurrence ${occurrence.toolPartID} ${reason}`,
    tool: occurrence.toolName,
    toolPartID: occurrence.toolPartID,
    reason,
  })
}

export function scheduledToolOccurrenceFromContext(
  ctx: Pick<Tool.Context, "sessionID" | "messageID" | "callID" | "extra">,
  toolName: ScheduledToolOccurrence["toolName"],
): ScheduledToolOccurrence {
  const toolPartID = typeof ctx.extra?.toolPartID === "string" ? ctx.extra.toolPartID : ""
  const toolCallID = ctx.callID ?? ""
  if (!toolPartID || !toolCallID) {
    throw scheduledToolOccurrenceConflict(
      { toolName, toolPartID },
      "requires an exact persisted Tool request occurrence",
    )
  }
  return {
    sessionID: ctx.sessionID,
    messageID: ctx.messageID,
    toolPartID,
    toolCallID,
    toolName,
  }
}

export function scheduledToolInputDigest(toolName: ScheduledToolOccurrence["toolName"], input: unknown): string {
  return createHash("sha256")
    .update(canonicalJSONValue({ tool: toolName, input }, `scheduler-${toolName}-occurrence-v1`))
    .digest("hex")
}

export function assertScheduledToolOccurrenceInTransaction(
  db: Database.TxOrDb,
  occurrence: ScheduledToolOccurrence,
): void {
  const request = db
    .select({
      messageID: ToolPartRequestTable.message_id,
      data: ToolPartRequestTable.data,
      sessionID: MessageTable.session_id,
    })
    .from(ToolPartRequestTable)
    .innerJoin(MessageTable, eq(MessageTable.id, ToolPartRequestTable.message_id))
    .where(eq(ToolPartRequestTable.id, occurrence.toolPartID))
    .get()
  if (
    !request ||
    request.messageID !== occurrence.messageID ||
    request.sessionID !== occurrence.sessionID ||
    request.data.callID !== occurrence.toolCallID ||
    request.data.tool !== occurrence.toolName
  ) {
    throw scheduledToolOccurrenceConflict(occurrence, "does not match its persisted request")
  }
}
