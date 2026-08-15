import { Identifier } from "@/id/id"
import { PermissionExecutionResultTable } from "@/permission/permission.sql"
import { Database, eq } from "@/storage/db"
import { Message } from "./message"
import { normalizeToolResult } from "./tool-result-normalization"
import {
  PartTable,
  MessageTable,
  ToolPartRequestTable,
  ToolPartOutcomeTable,
  type ToolOutcomePartData,
  type ToolRequestPartData,
} from "./session.sql"

export function isToolRequestPartData(value: unknown): value is ToolRequestPartData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const data = value as Partial<ToolRequestPartData>
  return data.type === "tool-request" && typeof data.callID === "string" && typeof data.tool === "string"
}

export function toolOutcomePartIdentity(requestPartID: string): string {
  return Identifier.deterministic("part", `tool-outcome\0${requestPartID}`)
}

export function projectToolPartInTransaction(
  db: Database.TxOrDb,
  row: typeof ToolPartRequestTable.$inferSelect,
): Message.ToolPart | undefined {
  if (!isToolRequestPartData(row.data)) return undefined
  const request = row.data
  const message = db.select({ sessionID: MessageTable.session_id }).from(MessageTable)
    .where(eq(MessageTable.id, row.message_id)).get()
  if (!message) throw new Error(`Tool request Part ${row.id} has no parent Message`)
  const outcome = db
    .select()
    .from(ToolPartOutcomeTable)
    .where(eq(ToolPartOutcomeTable.request_part_id, row.id))
    .get()
  const output = outcome?.data.outcome === "completed" && outcome.data.resultAttemptID
    ? (() => {
        const receipt = db.select().from(PermissionExecutionResultTable)
          .where(eq(PermissionExecutionResultTable.attempt_id, outcome.data.resultAttemptID)).get()
        if (!receipt) {
          throw new Error(`Tool outcome Part ${outcome.id} references missing Permission result ${outcome.data.resultAttemptID}`)
        }
        const stored = receipt.result as { kind?: string; value?: unknown }
        if (stored?.kind === "undefined") return ""
        if (stored?.kind !== "json") {
          throw new Error(`Permission result ${receipt.attempt_id} has an invalid durable result envelope`)
        }
        return normalizeToolResult(stored.value).output
      })()
    : outcome?.data.outcome === "completed" ? outcome.data.output : undefined
  const state: Message.ToolPart["state"] = !outcome
    ? {
        status: "running",
        input: request.input,
        ...(request.title ? { title: request.title } : {}),
        ...(request.metadata ? { metadata: request.metadata } : {}),
        time: { start: request.time.start },
      }
    : outcome.data.outcome === "completed"
      ? {
          status: "completed",
          input: request.input,
          output: output!,
          title: outcome.data.title,
          metadata: outcome.data.metadata,
          time: { start: request.time.start, end: outcome.data.time.end },
          ...(outcome.data.attachments ? { attachments: outcome.data.attachments } : {}),
        }
      : {
          status: "error",
          input: request.input,
          failure: outcome.data.failure,
          ...(outcome.data.metadata ? { metadata: outcome.data.metadata } : {}),
          time: { start: request.time.start, end: outcome.data.time.end },
        }
  return Message.ToolPart.parse({
    id: row.id,
    sessionID: message.sessionID,
    messageID: row.message_id,
    type: "tool",
    callID: request.callID,
    tool: request.tool,
    state,
    ...(request.metadata ? { metadata: request.metadata } : {}),
  })
}

export function projectPartInTransaction(
  db: Database.TxOrDb,
  row: typeof PartTable.$inferSelect,
): Message.Part {
  const message = db.select({ sessionID: MessageTable.session_id }).from(MessageTable)
    .where(eq(MessageTable.id, row.message_id)).get()
  if (!message) throw new Error(`Part ${row.id} has no parent Message`)
  return Message.Part.parse({
    ...row.data,
    id: row.id,
    sessionID: message.sessionID,
    messageID: row.message_id,
  })
}

export function toolRequestData(part: Message.ToolPart): ToolRequestPartData {
  return {
    type: "tool-request",
    callID: part.callID,
    tool: part.tool,
    input: part.state.input,
    ...(part.state.status === "running" && part.state.title ? { title: part.state.title } : {}),
    ...(part.metadata ? { metadata: part.metadata } : {}),
    time: { start: part.state.time.start },
  }
}

export function toolOutcomeData(part: Message.ToolPart): ToolOutcomePartData | undefined {
  if (part.state.status === "completed") {
    return {
      outcome: "completed",
      output: part.state.output,
      title: part.state.title,
      metadata: part.state.metadata,
      time: { end: part.state.time.end },
      ...(part.state.attachments ? { attachments: part.state.attachments } : {}),
    }
  }
  if (part.state.status === "error") {
    return {
      outcome: "failed",
      failure: part.state.failure,
      ...(part.state.metadata ? { metadata: part.state.metadata } : {}),
      time: { end: part.state.time.end },
    }
  }
  return undefined
}

export function equivalentToolRequest(left: ToolRequestPartData, right: ToolRequestPartData): boolean {
  return left.callID === right.callID &&
    left.tool === right.tool &&
    left.time.start === right.time.start &&
    JSON.stringify(left.input) === JSON.stringify(right.input) &&
    JSON.stringify(left.metadata) === JSON.stringify(right.metadata)
}

export function equivalentToolOutcome(left: ToolOutcomePartData, right: ToolOutcomePartData): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
