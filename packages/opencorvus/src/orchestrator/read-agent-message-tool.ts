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

const CAUSAL_TOOL_MESSAGE_INVENTORY_LIMIT_PER_FINAL = 16
const TOOL_INPUT_PREVIEW_CHARS = 240
const EVIDENCE_OUTPUT_DEFAULT_CHARS = 8_000
const EVIDENCE_OUTPUT_MAX_CHARS_PER_CALL = 30_000

const MessageIDs = z
  .array(z.string().min(1))
  .min(1)
  .max(8)
  .superRefine((messageIDs, context) => {
    const seen = new Set<string>()
    messageIDs.forEach((messageID, index) => {
      if (seen.has(messageID)) {
        context.addIssue({ code: "custom", path: [index], message: "Message identities must be unique" })
      }
      seen.add(messageID)
    })
  })

const InventoryCursor = z
  .object({
    final_message_id: z.string().min(1),
    before_message_id: z.string().min(1),
  })
  .strict()

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

function safeInputPreview(input: unknown) {
  const serialized = JSON.stringify(input) ?? "null"
  const redacted = JSON.stringify(ProviderError.redactSensitiveProviderValue(input)) ?? "null"
  return {
    input_preview: redacted.slice(0, TOOL_INPUT_PREVIEW_CHARS),
    input_chars: serialized.length,
    input_preview_truncated: redacted.length > TOOL_INPUT_PREVIEW_CHARS,
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
  causalToolMessageInventoryLimitPerFinal: CAUSAL_TOOL_MESSAGE_INVENTORY_LIMIT_PER_FINAL,
  evidenceOutputDefaultChars: EVIDENCE_OUTPUT_DEFAULT_CHARS,
})

export function createReadAgentMessageTool(input: { taskID: string }) {
  const inputSchema = z
    .object({
      message_ids: MessageIDs.describe(
        "One to eight exact terminal worker Message identities from current Task settlements, in result order.",
      ),
      inventory_before: z
        .array(InventoryCursor)
        .max(8)
        .superRefine((cursors, context) => {
          const seen = new Set<string>()
          cursors.forEach((cursor, index) => {
            if (seen.has(cursor.final_message_id)) {
              context.addIssue({
                code: "custom",
                path: [index, "final_message_id"],
                message: "Each final Message may have only one inventory cursor",
              })
            }
            seen.add(cursor.final_message_id)
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
        .describe(
          "Optional exact input, output, or failure chunks selected from this final's causal inventory in this or an earlier call. Follow next_offset until null.",
        ),
    })
    .strict()
  const providerJSONSchema = z.toJSONSchema(inputSchema, { cycles: "ref", reused: "ref" }) as unknown as JSONSchema7
  const messageIDsProperty = providerJSONSchema.properties?.message_ids as JSONSchema7 | undefined
  if (messageIDsProperty) {
    messageIDsProperty.uniqueItems = true
  }
  const providerInputSchema = jsonSchema<z.infer<typeof inputSchema>>(providerJSONSchema, {
    validate(value) {
      const parsed = inputSchema.safeParse(value)
      if (!parsed.success) return { success: false, error: parsed.error }
      const unsupported = parsed.data.message_ids.filter(
        (messageID) => !taskOwnsDispatchFinalMessage({ taskID: input.taskID, messageID }),
      )
      if (unsupported.length > 0) {
        return {
          success: false,
          error: new Error(
            `Message identities are not terminal dispatch settlement authorities for Task ${input.taskID}: ${unsupported.join(", ")}`,
          ),
        }
      }
      const selectedFinalMessageIDSet = new Set(parsed.data.message_ids)
      const unsupportedCursors = (parsed.data.inventory_before ?? []).filter(
        (cursor) => !selectedFinalMessageIDSet.has(cursor.final_message_id),
      )
      if (unsupportedCursors.length > 0) {
        return {
          success: false,
          error: new Error(
            `Inventory cursors do not name selected terminal Messages for Task ${input.taskID}: ${unsupportedCursors.map((cursor) => cursor.final_message_id).join(", ")}`,
          ),
        }
      }
      return { success: true, value: parsed.data }
    },
  })

  return {
    read_agent_message: tool({
      description:
        "Read an ordered batch of exact persisted Agent messages and their tool parts by globally unique message refs from the Task description. " +
        "This is a read-only fact projection: it does not select a latest message, infer success, or materialize an artifact. " +
        "For final worker reports, submit exact Task dispatch settlement final_message_id values in ordered chunks of at most eight, including an earlier settled worker whose evidence remains material after a later dispatch. " +
        "The result includes a paged, redacted inventory of real Tool Messages from each final report's execution occurrence. When a material source or mutation fact is absent from the final text, use only a necessary message_id and part_id returned by that final's inventory in this or an earlier call, select field=input, output, or failure, and paginate with offset/limit until next_offset is null. A completed Tool step is not a final report.",
      inputSchema: providerInputSchema,
      execute: async (rawInput) => {
        const { message_ids, inventory_before, evidence_reads } = inputSchema.parse(rawInput)
        const finals = await Promise.all(
          message_ids.map(async (message_id) => {
            if (!taskOwnsDispatchFinalMessage({ taskID: input.taskID, messageID: message_id })) {
              throw new Error(`Message ${message_id} is not a terminal dispatch settlement for Task ${input.taskID}`)
            }
            const session_id = Session.messageOccurrenceSessionID(message_id)
            if (!session_id) throw new Error(`Message ${message_id} is not persisted`)
            if (taskIDForSession(session_id) !== input.taskID) {
              throw new Error(`Message ${message_id} does not belong to Task ${input.taskID}`)
            }
            const message = await MessageStore.get({ sessionID: session_id, messageID: message_id })
            if (message.info.role !== "assistant") {
              throw new Error(`Message ${message_id} is not an assistant final report`)
            }
            return {
              session_id,
              message_id,
              message: message as Message.WithParts & { info: Message.Assistant },
            }
          }),
        )
        const messages = finals.map(({ session_id, message_id, message }) => ({
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
          final_message_id: string
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
        const cursorByFinal = new Map(
          (inventory_before ?? []).map((cursor) => [cursor.final_message_id, cursor.before_message_id]),
        )
        const causalToolMessageInventory: CausalToolMessage[] = []
        const inventoryNextBefore: Array<{ final_message_id: string; before_message_id: string }> = []
        const causalToolMessageSessions = new Map<string, string>()
        for (const final of finals) {
          const occurrenceMessages = (await Session.messages({ sessionID: final.session_id }))
            .filter(
              (candidate) =>
                candidate.info.role === "assistant" &&
                candidate.info.parentID === final.message.info.parentID &&
                orderedBeforeOrAt(candidate.info, final.message.info) &&
                candidate.parts.some((part) => part.type === "tool"),
            )
            .sort(
              (left, right) =>
                left.info.time.created - right.info.time.created || left.info.id.localeCompare(right.info.id),
            )
          const beforeMessageID = cursorByFinal.get(final.message_id)
          const before = beforeMessageID
            ? occurrenceMessages.find((candidate) => candidate.info.id === beforeMessageID)
            : undefined
          if (beforeMessageID && !before) {
            throw new Error(
              `Inventory cursor ${beforeMessageID} is not a causal Tool Message for final ${final.message_id}`,
            )
          }
          const inventoryPage = causalInventoryPage(occurrenceMessages, before)
          for (const candidate of occurrenceMessages) {
            causalToolMessageSessions.set(candidate.info.id, final.session_id)
          }
          if (inventoryPage.next_before_message_id) {
            inventoryNextBefore.push({
              final_message_id: final.message_id,
              before_message_id: inventoryPage.next_before_message_id,
            })
          }
          for (const candidate of inventoryPage.page) {
            const projected: CausalToolMessage = {
              final_message_id: final.message_id,
              session_id: final.session_id,
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
            const sessionID = causalToolMessageSessions.get(read.message_id)
            if (!sessionID) {
              throw new Error(
                `Evidence Message ${read.message_id} is not causal to the selected terminal dispatch Messages`,
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
            causal_tool_message_inventory: causalToolMessageInventory,
            inventory_next_before: inventoryNextBefore,
            evidence_reads: evidenceReads,
          },
          null,
          2,
        )
      },
    }),
  }
}
