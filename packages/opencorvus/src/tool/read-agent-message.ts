import { assistantActionFactScopeInTransaction } from "@/agent/artifact-provenance-facts"
import { findDispatchLineageByDispatchIDInTransaction } from "@/engine/dispatch-lineage-facts"
import { Database, and, eq, sql } from "@/storage/db"
import { MessageTable, ToolPartRequestTable, ToolPartOutcomeTable } from "@/session/session.sql"
import { taskOwnsDispatchFinalMessage } from "@/engine/dispatch-settlement"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { ProviderError } from "@/provider/error"
import { Session } from "@/session"
import { CompactionToolResultReader } from "@/session/compaction-tool-result-reader"
import type { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import type { JSONSchema7 } from "@ai-sdk/provider"
import { jsonSchema, tool } from "ai"
import { createHash } from "node:crypto"
import z from "zod"
import { Tool } from "./tool"
import { resolveCoreProjectedTaskToolExecutionScope } from "./task-tool-execution-scope"

const CAUSAL_TOOL_MESSAGE_INVENTORY_LIMIT_PER_FINAL = 16
const TOOL_INPUT_PREVIEW_CHARS = 240
const CAUSAL_TOOL_REFERENCE_PREVIEW_CHARS = 160
const CAUSAL_TOOL_REFERENCE_INDEX_MAX_CHARS = 40_000
const EVIDENCE_OUTPUT_DEFAULT_CHARS = 8_000
const EVIDENCE_OUTPUT_MAX_CHARS_PER_CALL = 30_000
const EVIDENCE_READS_DESCRIPTION = `Optional exact input, output, or failure chunks from the selected sources' causal inventory in this or an earlier call. Copy returned message_id and part_id values exactly. The sum of every limit in one call must be at most ${EVIDENCE_OUTPUT_MAX_CHARS_PER_CALL} characters. Follow next_offset until null.`

const EvidenceSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dispatch_result"), message_id: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("dispatch_origin"), dispatch_id: z.string().min(1) }).strict(),
])
type EvidenceSource = z.infer<typeof EvidenceSource>
function sourceKey(source: EvidenceSource) {
  return source.kind === "dispatch_result" ? `result:${source.message_id}` : `origin:${source.dispatch_id}`
}
const Sources = z
  .array(EvidenceSource)
  .min(1)
  .max(8)
  .superRefine((sources, context) => {
    const seen = new Set<string>()
    sources.forEach((source, index) => {
      const key = sourceKey(source)
      if (seen.has(key)) context.addIssue({ code: "custom", path: [index], message: "Evidence sources must be unique" })
      seen.add(key)
    })
  })
const InventoryCursor = z.object({ source: EvidenceSource, before_message_id: z.string().min(1) }).strict()

export class TaskEvidenceSourceError extends Error {
  readonly code = "TASK_EVIDENCE_SOURCE_INVALID"
  constructor(detail: string) {
    super(detail)
    this.name = "TaskEvidenceSourceError"
  }
}

function originEvidence(taskID: string, dispatchID: string) {
  return Database.use((db) => {
    const lineage = findDispatchLineageByDispatchIDInTransaction({ db, taskID, dispatchID })
    if (!lineage) throw new TaskEvidenceSourceError(`Dispatch ${dispatchID} does not belong to Task ${taskID}`)
    const origin = lineage.payload
    if (taskIDForSession(origin.orchestrator_session_id) !== taskID) {
      throw new TaskEvidenceSourceError(`Dispatch ${dispatchID} has an invalid Task Session`)
    }
    const scope = assistantActionFactScopeInTransaction(
      db,
      origin.orchestrator_session_id,
      origin.orchestrator_message_id,
      origin.tool_part_id,
    )
    const boundary = scope.before
    const parts = db
      .select({ partID: ToolPartRequestTable.id })
      .from(ToolPartRequestTable)
      .innerJoin(MessageTable, eq(MessageTable.id, ToolPartRequestTable.message_id))
      .innerJoin(ToolPartOutcomeTable, eq(ToolPartOutcomeTable.request_part_id, ToolPartRequestTable.id))
      .where(
        and(
          eq(MessageTable.session_id, origin.orchestrator_session_id),
          sql`json_extract(${MessageTable.data}, '$.role') = 'assistant'`,
          sql`${ToolPartRequestTable.time_created} < ${boundary.timeCreated}`,
          sql`${ToolPartOutcomeTable.time_created} < ${boundary.timeCreated}`,
        ),
      )
      .all()
    return { origin, boundary, partIDs: new Set(parts.map((part) => part.partID)) }
  })
}

function validateSource(taskID: string, source: EvidenceSource) {
  if (source.kind === "dispatch_origin") {
    originEvidence(taskID, source.dispatch_id)
    return
  }
  if (!taskOwnsDispatchFinalMessage({ taskID, messageID: source.message_id })) {
    throw new TaskEvidenceSourceError(
      `Message ${source.message_id} is not a terminal dispatch settlement for Task ${taskID}`,
    )
  }
}

const EvidenceRead = z
  .object({
    message_id: z.string().min(1),
    part_id: z.string().min(1),
    field: z.enum(["input", "output", "failure"]),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(EVIDENCE_OUTPUT_MAX_CHARS_PER_CALL)
      .default(EVIDENCE_OUTPUT_DEFAULT_CHARS),
  })
  .strict()

function orderedBeforeOrAt(
  candidate: { time: { created: number }; id: string },
  boundary: { time: { created: number }; id: string },
) {
  return (
    candidate.time.created < boundary.time.created ||
    (candidate.time.created === boundary.time.created && candidate.id.localeCompare(boundary.id) <= 0)
  )
}

function orderedBefore(
  candidate: { time: { created: number }; id: string },
  boundary: { time: { created: number }; id: string },
) {
  return (
    candidate.time.created < boundary.time.created ||
    (candidate.time.created === boundary.time.created && candidate.id.localeCompare(boundary.id) < 0)
  )
}

function safeInputPreview(input: unknown, limit = TOOL_INPUT_PREVIEW_CHARS) {
  const serialized = JSON.stringify(input) ?? "null"
  const redacted = JSON.stringify(ProviderError.redactSensitiveProviderValue(input)) ?? "null"
  return {
    input_preview: redacted.slice(0, limit),
    input_chars: serialized.length,
    input_preview_truncated: redacted.length > limit,
  }
}

type CausalToolReference = {
  source: EvidenceSource
  message_id: string
  part_id: string
  tool_name: string
  status: string
  input_preview: string
  input_preview_truncated: boolean
}

function compactCausalToolReferenceIndex(refs: CausalToolReference[]) {
  const complete = JSON.stringify(refs).length <= CAUSAL_TOOL_REFERENCE_INDEX_MAX_CHARS
  return {
    complete,
    tool_count: refs.length,
    refs: complete ? refs : [],
  }
}

function causalInventoryPage<T extends { info: { time: { created: number }; id: string } }>(messages: T[], before?: T) {
  const eligible = before ? messages.filter((candidate) => orderedBefore(candidate.info, before.info)) : messages
  const page = eligible.slice(-CAUSAL_TOOL_MESSAGE_INVENTORY_LIMIT_PER_FINAL)
  return {
    page,
    next_before_message_id: eligible.length > page.length && page[0] ? page[0].info.id : null,
  }
}

function evidenceOutputChunk(output: string, offset: number, limit: number) {
  const safeOutput = ProviderError.redactSensitiveProviderPayload(output)
  if (offset > safeOutput.length) {
    throw new Error(`Evidence output offset ${offset} exceeds ${safeOutput.length} characters`)
  }
  const end = Math.min(safeOutput.length, offset + limit)
  return {
    redacted: safeOutput !== output,
    total_chars: safeOutput.length,
    sha256: createHash("sha256").update(safeOutput).digest("hex"),
    offset,
    end,
    next_offset: end < safeOutput.length ? end : null,
    content: safeOutput.slice(offset, end),
  }
}

export const ReadAgentMessageTestHooks = Object.freeze({
  orderedBeforeOrAt,
  safeInputPreview,
  causalInventoryPage,
  evidenceOutputChunk,
  compactCausalToolReferenceIndex,
  causalToolMessageInventoryLimitPerFinal: CAUSAL_TOOL_MESSAGE_INVENTORY_LIMIT_PER_FINAL,
  evidenceOutputDefaultChars: EVIDENCE_OUTPUT_DEFAULT_CHARS,
  evidenceOutputMaxCharsPerCall: EVIDENCE_OUTPUT_MAX_CHARS_PER_CALL,
  evidenceReadsDescription: EVIDENCE_READS_DESCRIPTION,
})

export const ReadAgentMessageInputSchema = z
  .object({
    sources: Sources.describe(
      "One to eight ordered Task evidence sources: a settled worker report or the root Tool facts preceding an exact dispatch.",
    ),
    inventory_before: z
      .array(InventoryCursor)
      .max(8)
      .superRefine((cursors, context) => {
        const seen = new Set<string>()
        cursors.forEach((cursor, index) => {
          if (seen.has(sourceKey(cursor.source))) {
            context.addIssue({
              code: "custom",
              path: [index, "source"],
              message: "Each source may have only one inventory cursor",
            })
          }
          seen.add(sourceKey(cursor.source))
        })
      })
      .optional()
      .describe("Optional older-page cursors returned by a prior causal Tool Message inventory."),
    evidence_reads: z
      .array(EvidenceRead)
      .max(8)
      .superRefine((reads, context) => {
        const seen = new Set<string>()
        reads.forEach((read, index) => {
          const identity = `${read.message_id}\0${read.part_id}\0${read.field}\0${read.offset}`
          if (seen.has(identity)) {
            context.addIssue({ code: "custom", path: [index], message: "Evidence reads must be unique" })
          }
          seen.add(identity)
        })
        const requestedChars = reads.reduce((total, read) => total + read.limit, 0)
        if (requestedChars > EVIDENCE_OUTPUT_MAX_CHARS_PER_CALL) {
          context.addIssue({
            code: "custom",
            message: `Evidence reads may request at most ${EVIDENCE_OUTPUT_MAX_CHARS_PER_CALL} characters per call`,
          })
        }
      })
      .optional()
      .describe(EVIDENCE_READS_DESCRIPTION),
  })
  .strict()

const READ_AGENT_MESSAGE_DESCRIPTION =
  "Read exact Task participant evidence. sources accepts {kind:'dispatch_result',message_id} for settled worker reports, " +
  "or {kind:'dispatch_origin',dispatch_id} for the root's completed Tool facts strictly before that dispatch's Provider step. " +
  "Use current_dispatch_id from your real dispatch context for root evidence. Discover other exact dispatch/result identities in Task dispatch facts. " +
  "Origin facts are historical observations, not a final report or proof of current state. Same-step calls and outcomes at/after the boundary are outside that source; absence does not prove an operation never occurred. " +
  "The result includes a compact redacted causal Tool index plus detailed pages. If complete=false, follow inventory_next_before. " +
  "Read necessary exact message_id/part_id input, output, or failure chunks with evidence_reads and follow next_offset to null. " +
  "This read-only projection preserves Task ownership and causal boundaries; it does not infer success or create artifacts."

export async function readAgentMessages(taskID: string, rawInput: unknown) {
  const { sources, inventory_before, evidence_reads } = ReadAgentMessageInputSchema.parse(rawInput)
  for (const cursor of inventory_before ?? []) {
    if (!sources.some((source) => sourceKey(source) === sourceKey(cursor.source))) {
      throw new TaskEvidenceSourceError(`Inventory cursor does not name a selected source: ${sourceKey(cursor.source)}`)
    }
  }
  const selections = await Promise.all(
    sources.map(async (source) => {
      validateSource(taskID, source)
      const origin = source.kind === "dispatch_origin" ? originEvidence(taskID, source.dispatch_id) : undefined
      const message_id = source.kind === "dispatch_result" ? source.message_id : origin!.origin.orchestrator_message_id
      const session_id = Session.messageOccurrenceSessionID(message_id)
      if (!session_id || taskIDForSession(session_id) !== taskID) {
        throw new TaskEvidenceSourceError(`Message ${message_id} does not belong to Task ${taskID}`)
      }
      const message = await MessageStore.get({ sessionID: session_id, messageID: message_id })
      if (message.info.role !== "assistant")
        throw new TaskEvidenceSourceError(`Message ${message_id} is not an assistant message`)
      return {
        source,
        origin,
        session_id,
        message_id,
        message: message as Message.WithParts & { info: Message.Assistant },
      }
    }),
  )
  const messages = selections
    .filter((selection) => !selection.origin)
    .map(({ source, session_id, message_id, message }) => ({
      source,
      session_id,
      message_id,
      role: message.info.role,
      author: message.info.author,
      finish: message.info.finish ?? null,
      time_completed: message.info.time.completed ?? null,
      text: message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])),
      tool_facts: message.parts.flatMap((part) =>
        part.type === "tool"
          ? [
              {
                part_id: part.id,
                call_id: part.callID,
                tool_name: part.tool,
                status: part.state.status,
                ...safeInputPreview(part.state.input),
                ...(part.state.status === "completed" ? { stored_output_chars: part.state.output.length } : {}),
              },
            ]
          : [],
      ),
    }))
  type CausalToolMessage = {
    source: EvidenceSource
    session_id: string
    message_id: string
    author: string
    time_created: number
    tool_facts: Array<{
      part_id: string
      call_id: string
      tool_name: string
      status: string
      input_preview: string
      input_chars: number
      input_preview_truncated: boolean
      stored_output_chars?: number
    }>
  }
  const cursorBySource = new Map(
    (inventory_before ?? []).map((cursor) => [sourceKey(cursor.source), cursor.before_message_id]),
  )
  const causalToolMessageInventory: CausalToolMessage[] = []
  const causalToolReferences: CausalToolReference[] = []
  const inventoryNextBefore: Array<{ source: EvidenceSource; before_message_id: string }> = []
  const causalToolPartSessions = new Map<string, string>()
  for (const selection of selections) {
    const occurrenceMessages = (await Session.messages({ sessionID: selection.session_id }))
      .map((candidate) =>
        selection.origin
          ? {
              ...candidate,
              parts: candidate.parts.filter((part) => part.type === "tool" && selection.origin!.partIDs.has(part.id)),
            }
          : candidate,
      )
      .filter(
        (candidate) =>
          candidate.info.role === "assistant" &&
          (selection.origin ||
            (candidate.info.parentID === selection.message.info.parentID &&
              orderedBeforeOrAt(candidate.info, selection.message.info))) &&
          candidate.parts.some((part) => part.type === "tool"),
      )
      .sort(
        (left, right) => left.info.time.created - right.info.time.created || left.info.id.localeCompare(right.info.id),
      )
    const beforeMessageID = cursorBySource.get(sourceKey(selection.source))
    const before = beforeMessageID
      ? occurrenceMessages.find((candidate) => candidate.info.id === beforeMessageID)
      : undefined
    if (beforeMessageID && !before) {
      throw new Error(
        `Inventory cursor ${beforeMessageID} is not a causal Tool Message for source ${sourceKey(selection.source)}`,
      )
    }
    const inventoryPage = causalInventoryPage(occurrenceMessages, before)
    for (const candidate of occurrenceMessages) {
      for (const part of candidate.parts) {
        if (part.type !== "tool") continue
        causalToolPartSessions.set(`${candidate.info.id}\0${part.id}`, selection.session_id)
        const preview = safeInputPreview(part.state.input, CAUSAL_TOOL_REFERENCE_PREVIEW_CHARS)
        causalToolReferences.push({
          source: selection.source,
          message_id: candidate.info.id,
          part_id: part.id,
          tool_name: part.tool,
          status: part.state.status,
          input_preview: preview.input_preview,
          input_preview_truncated: preview.input_preview_truncated,
        })
      }
    }
    if (inventoryPage.next_before_message_id) {
      inventoryNextBefore.push({
        source: selection.source,
        before_message_id: inventoryPage.next_before_message_id,
      })
    }
    for (const candidate of inventoryPage.page) {
      const projected: CausalToolMessage = {
        source: selection.source,
        session_id: selection.session_id,
        message_id: candidate.info.id,
        author: candidate.info.agent,
        time_created: candidate.info.time.created,
        tool_facts: candidate.parts.flatMap((part) => {
          if (part.type !== "tool") return []
          return [
            {
              part_id: part.id,
              call_id: part.callID,
              tool_name: part.tool,
              status: part.state.status,
              ...safeInputPreview(part.state.input),
              ...(part.state.status === "completed" ? { stored_output_chars: part.state.output.length } : {}),
            },
          ]
        }),
      }
      causalToolMessageInventory.push(projected)
    }
  }
  const evidenceReads = await Promise.all(
    (evidence_reads ?? []).map(async (read) => {
      const sessionID = causalToolPartSessions.get(`${read.message_id}\0${read.part_id}`)
      if (!sessionID) {
        throw new TaskEvidenceSourceError(
          `Evidence Part ${read.part_id} of Message ${read.message_id} is not causal to the selected sources`,
        )
      }
      const message = await MessageStore.get({ sessionID, messageID: read.message_id })
      const part = message.parts.find((candidate) => candidate.id === read.part_id)
      if (!part || part.type !== "tool") {
        throw new Error(`Evidence Part ${read.part_id} is not a Tool Part of Message ${read.message_id}`)
      }
      let source: "message-part-input" | "message-part-output" | "truncation-file" | "message-part-failure"
      let output: string
      if (read.field === "input") {
        source = "message-part-input"
        output = JSON.stringify(part.state.input) ?? "null"
      } else if (read.field === "output" && part.state.status === "completed") {
        const resolved = await CompactionToolResultReader.authoritativeOutput(
          part as CompactionToolResultReader.CompletedToolPart,
        )
        source = resolved.source
        output = resolved.output
      } else if (read.field === "failure" && part.state.status === "error") {
        source = "message-part-failure"
        output = JSON.stringify(part.state.failure)
      } else {
        throw new Error(`Evidence Part ${read.part_id} has no terminal ${read.field} field`)
      }
      return {
        message_id: read.message_id,
        part_id: read.part_id,
        call_id: part.callID,
        tool_name: part.tool,
        status: part.state.status,
        field: read.field,
        source,
        ...evidenceOutputChunk(output, read.offset, read.limit),
      }
    }),
  )
  return JSON.stringify(
    {
      messages,
      origins: selections.flatMap((selection) =>
        selection.origin
          ? [
              {
                source: selection.source,
                session_id: selection.session_id,
                message_id: selection.message_id,
                execution_epoch: selection.origin.origin.execution_epoch,
                before_provider_step: {
                  part_id: selection.origin.boundary.partID,
                  time_created: selection.origin.boundary.timeCreated,
                },
              },
            ]
          : [],
      ),
      causal_tool_reference_index: compactCausalToolReferenceIndex(causalToolReferences),
      causal_tool_message_inventory: causalToolMessageInventory,
      inventory_next_before: inventoryNextBefore,
      evidence_reads: evidenceReads,
    },
    null,
    2,
  )
}

export function createReadAgentMessageTool(input: { taskID: string }) {
  const providerJSONSchema = z.toJSONSchema(ReadAgentMessageInputSchema, {
    cycles: "ref",
    reused: "ref",
  }) as unknown as JSONSchema7
  const providerInputSchema = jsonSchema<z.infer<typeof ReadAgentMessageInputSchema>>(providerJSONSchema, {
    validate(value) {
      const parsed = ReadAgentMessageInputSchema.safeParse(value)
      if (!parsed.success) return { success: false, error: parsed.error }
      try {
        for (const source of parsed.data.sources) validateSource(input.taskID, source)
        for (const cursor of parsed.data.inventory_before ?? []) {
          if (!parsed.data.sources.some((source) => sourceKey(source) === sourceKey(cursor.source))) {
            throw new TaskEvidenceSourceError(
              `Inventory cursor does not name a selected source: ${sourceKey(cursor.source)}`,
            )
          }
        }
        return { success: true, value: parsed.data }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
      }
    },
  })

  return {
    read_agent_message: tool({
      description: READ_AGENT_MESSAGE_DESCRIPTION,
      inputSchema: providerInputSchema,
      execute: async (rawInput) => {
        return readAgentMessages(input.taskID, rawInput)
      },
    }),
  }
}

export const ReadAgentMessageTool = Tool.define("read_agent_message", {
  description: READ_AGENT_MESSAGE_DESCRIPTION,
  parameters: ReadAgentMessageInputSchema,
  async execute(args, ctx) {
    const scope = await resolveCoreProjectedTaskToolExecutionScope({
      toolName: "read_agent_message",
      options: {
        toolCallId: ctx.callID,
        opencorvus: {
          projectID: ctx.extra?.projectID,
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          toolCallID: ctx.callID,
          toolPartID: ctx.extra?.toolPartID,
          invocationAuthority: ctx.extra?.invocationAuthority,
        },
      },
    })
    return {
      title: "Task participant evidence",
      metadata: {},
      output: await readAgentMessages(scope.taskID, args),
    }
  },
})
