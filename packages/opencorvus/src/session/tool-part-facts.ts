import { Identifier } from "@/id/id"
import { PermissionExecutionResultTable } from "@/permission/permission.sql"
import { Database, desc, eq } from "@/storage/db"
import { isDeepStrictEqual } from "node:util"
import { Message } from "./message"
import { normalizeToolResult } from "./tool-result-normalization"
import {
  PartTable,
  MessageTable,
  ToolPartRequestTable,
  ToolPartProgressTable,
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

/**
 * The canonical string output of a completed tool outcome. A completed outcome
 * either carries its output inline or defers it to a durable Permission result
 * through `resultAttemptID`; every reader that reconstructs persisted tool facts
 * must resolve both, or a deferred output reads as an absent one.
 */
export function completedToolOutcomeOutput(
  db: Database.TxOrDb,
  outcome: ToolOutcomePartData,
  describe: () => string,
): string | undefined {
  if (outcome.outcome !== "completed") return undefined
  if (!outcome.resultAttemptID) return outcome.output
  const receipt = db
    .select()
    .from(PermissionExecutionResultTable)
    .where(eq(PermissionExecutionResultTable.attempt_id, outcome.resultAttemptID))
    .get()
  if (!receipt) throw new Error(`${describe()} references missing Permission result ${outcome.resultAttemptID}`)
  const stored = receipt.result as { kind?: string; value?: unknown }
  if (stored?.kind === "undefined") return ""
  if (stored?.kind !== "json") throw new Error(`Permission result ${receipt.attempt_id} has an invalid durable result envelope`)
  return normalizeToolResult(stored.value).output
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
  const progress = !outcome
    ? db
        .select()
        .from(ToolPartProgressTable)
        .where(eq(ToolPartProgressTable.request_part_id, row.id))
        .orderBy(desc(ToolPartProgressTable.time_created), desc(ToolPartProgressTable.id))
        .get()
    : undefined
  const output = outcome
    ? completedToolOutcomeOutput(db, outcome.data, () => `Tool outcome Part ${outcome.id}`)
    : undefined
  const liveTitle = progress?.title ?? request.title
  const liveMetadata = progress?.metadata ?? request.metadata
  const state: Message.ToolPart["state"] = !outcome
    ? {
        status: "running",
        input: request.input,
        ...(liveTitle ? { title: liveTitle } : {}),
        ...(liveMetadata ? { metadata: liveMetadata } : {}),
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
  return toolRequestDivergence(left, right).length === 0
}

const TOOL_REQUEST_DIVERGENCE_FIELD_BYTES = 600

function boundedRequestFieldText(value: unknown): string {
  let text: string
  try {
    text = value === undefined ? "undefined" : JSON.stringify(value) ?? String(value)
  } catch {
    text = String(value)
  }
  return text.length > TOOL_REQUEST_DIVERGENCE_FIELD_BYTES
    ? `${text.slice(0, TOOL_REQUEST_DIVERGENCE_FIELD_BYTES)}…(${text.length} chars)`
    : text
}

/**
 * Name every field on which an incoming Tool request disagrees with the
 * persisted immutable fact.
 *
 * The conflict is a Host invariant violation, so the thrower is the only place
 * that still holds both sides: once it escapes as a bare "conflicts with its
 * immutable request fact" the durable record keeps the losing payload nowhere,
 * and the next occurrence is undiagnosable without a live repro. Reporting
 * stored-vs-incoming per field follows the same rule model-facing validation
 * errors already follow.
 */
export function toolRequestDivergence(
  stored: ToolRequestPartData,
  incoming: ToolRequestPartData,
): Array<{ field: "callID" | "tool" | "input" | "metadata"; stored: string; incoming: string }> {
  const divergence: Array<{ field: "callID" | "tool" | "input" | "metadata"; stored: string; incoming: string }> = []
  const record = (field: "callID" | "tool" | "input" | "metadata", left: unknown, right: unknown) => {
    divergence.push({ field, stored: boundedRequestFieldText(left), incoming: boundedRequestFieldText(right) })
  }
  if (stored.callID !== incoming.callID) record("callID", stored.callID, incoming.callID)
  if (stored.tool !== incoming.tool) record("tool", stored.tool, incoming.tool)
  if (!isDeepStrictEqual(stored.input, incoming.input)) record("input", stored.input, incoming.input)
  if (!isDeepStrictEqual(stored.metadata, incoming.metadata)) record("metadata", stored.metadata, incoming.metadata)
  return divergence
}

/**
 * Reconcile a repeated Tool request write against its durable fact.
 *
 * A request's identity is its call, its Tool, and its input. `providerMetadata`
 * is transport annotation the Provider may only supply later: OpenAI streams
 * the function call first and attaches its `itemId` on a second `tool-call`
 * chunk for the same call. Treating that late arrival as a conflicting request
 * made every OpenAI Tool call fail (observed 2026-08-17: `metadata:
 * stored=undefined received={"openai":{"itemId":…}}`).
 *
 * Metadata that was absent when the fact became durable is therefore accepted
 * without rewriting it — the row is immutable by database trigger, and this
 * annotation feeds no prompt reconstruction, so the first write stays the
 * record. Replacing metadata that already exists, or any divergence in
 * call/Tool/input, stays a conflict.
 */
export function reconcileToolRequestFact(
  stored: ToolRequestPartData,
  incoming: ToolRequestPartData,
): { kind: "compatible" } | { kind: "conflict"; description: string } {
  const divergence = toolRequestDivergence(stored, incoming)
  if (divergence.length === 0) return { kind: "compatible" }
  const onlyMetadataDiverged = divergence.every((entry) => entry.field === "metadata")
  if (onlyMetadataDiverged && stored.metadata === undefined) return { kind: "compatible" }
  return { kind: "conflict", description: describeToolRequestConflict(stored, incoming) }
}

export function describeToolRequestConflict(stored: ToolRequestPartData, incoming: ToolRequestPartData): string {
  const divergence = toolRequestDivergence(stored, incoming)
  if (divergence.length === 0) return "no field diverged"
  return divergence
    .map((entry) => `${entry.field}: stored=${entry.stored} received=${entry.incoming}`)
    .join("; ")
}

export function equivalentToolOutcome(left: ToolOutcomePartData, right: ToolOutcomePartData): boolean {
  return isDeepStrictEqual(left, right)
}
