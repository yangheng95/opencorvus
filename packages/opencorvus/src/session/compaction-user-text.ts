import { tool, type ModelMessage, type Tool as AITool, type ToolExecutionOptions } from "ai"
import z from "zod"
import type { Message } from "./message"
import { CompactionEvidenceReader } from "./compaction-evidence-reader"
import { CompactionHandoff } from "./compaction-handoff"
import { MessageCopyEvidence } from "./copy-evidence"

/** Selection is a genuine Tool receipt. Source text has only its original owner. */
export namespace CompactionUserText {
  export const TOOL_NAME = "RetainCompactionUserText"
  const Parameters = z
    .object({
      excerpts: z
        .array(
          z
            .object({
              part_id: z.string().min(1),
              text: z
                .string()
                .min(1)
                .describe("One contiguous verbatim excerpt, including context needed to interpret it."),
              offset: z
                .number()
                .int()
                .nonnegative()
                .optional()
                .describe("Exact UTF-16 start offset, needed only when the same text occurs more than once."),
            })
            .strict(),
        )
        .describe(
          "Complete replacement selection of still-needed original user instructions. Empty explicitly releases the selection.",
        ),
    })
    .strict()
  const Source = z
    .object({
      sessionID: z.string(),
      messageID: z.string(),
      partID: z.string(),
      originalRole: z.literal("user"),
      originalAuthor: z.string(),
      sha256: z.string(),
      offset: z.number().int().nonnegative(),
      end: z.number().int().positive(),
    })
    .strict()
  export const Receipt = z
    .object({
      status: z.literal("retained"),
      selection_call_id: z.string(),
      sources: z.array(Source),
    })
    .strict()
  export type Receipt = z.infer<typeof Receipt>
  /** The original request is read from the same immutable Tool exchange. */
  export type Selection = Receipt & { excerpts: z.infer<typeof Parameters>["excerpts"] }
  const excerpts = new WeakMap<Message.TextPart, z.infer<typeof Source>>()
  export const excerptSource = (part: Message.TextPart) => excerpts.get(part)

  export class IntegrityError extends Error {
    readonly code = "COMPACTION_USER_TEXT_INVALID"
    constructor(message: string) {
      super(message)
      this.name = "CompactionUserTextIntegrityError"
    }
  }

  function boundary(text: string, offset: number) {
    return (
      offset >= 0 &&
      offset <= text.length &&
      !(offset > 0 && /[\uD800-\uDBFF]/.test(text[offset - 1]!) && /[\uDC00-\uDFFF]/.test(text[offset] ?? ""))
    )
  }

  function receiptOutput(output: string, callID: string): Receipt {
    let parsed: unknown
    try {
      parsed = JSON.parse(output)
    } catch {
      throw new IntegrityError(`User-text selection ${callID} has an invalid JSON receipt.`)
    }
    const receipt = Receipt.safeParse(parsed)
    if (!receipt.success || receipt.data.selection_call_id !== callID)
      throw new IntegrityError(`User-text selection ${callID} has an invalid Tool receipt.`)
    return receipt.data
  }

  export function readReceipt(parts: Message.Part[]): Selection | undefined {
    const part = parts.findLast(
      (part) => part.type === "tool" && part.tool === TOOL_NAME && part.state.status === "completed",
    )
    if (!part || part.type !== "tool" || part.state.status !== "completed") return undefined
    const receipt = receiptOutput(part.state.output, part.callID)
    const request = Parameters.safeParse(part.state.input)
    if (!request.success || request.data.excerpts.length !== receipt.sources.length)
      throw new IntegrityError(`User-text selection ${part.callID} has an invalid original Tool request.`)
    return { ...receipt, excerpts: request.data.excerpts }
  }

  /** Input is canonical chronological history, never prose claiming to be a Tool. */
  export function selection(messages: Message.WithParts[], checkpointID?: string) {
    const end = checkpointID ? messages.findIndex((message) => message.info.id === checkpointID) : messages.length - 1
    const users = new Set(messages.filter((m) => m.info.role === "user").map((m) => m.info.id))
    for (let index = end; index >= 0; index--) {
      const message = messages[index]!
      if (
        message.info.role !== "assistant" ||
        message.info.author !== "compaction" ||
        !CompactionHandoff.isValidSummaryMessage(message.info) ||
        message.info.time.completed === undefined ||
        !users.has(message.info.parentID) ||
        !message.parts.some((part) => part.type === "compaction")
      )
        continue
      const receipt = readReceipt(message.parts)
      if (receipt) return receipt
    }
  }

  export function project(receipt: Selection | undefined, messages: Message.WithParts[]): Message.WithParts[] {
    if (!receipt?.sources.length) return []
    const bound = CompactionEvidenceReader.bind(messages)
    const projected = new Map<string, Message.WithParts>()
    const selected = new Set<string>()
    for (const [index, source] of receipt.sources.entries()) {
      const excerpt = receipt.excerpts[index]
      if (!excerpt) throw new IntegrityError(`User-text selection ${receipt.selection_call_id} has no original excerpt.`)
      const { part, owner, origin } = bound.resolvePart(source.partID)
      const requested = bound.resolvePart(excerpt.part_id)
      if (
        part.type !== "text" ||
        owner.role !== "user" ||
        owner.author !== source.originalAuthor ||
        source.originalRole !== owner.role ||
        source.sessionID !== (origin?.sessionID ?? part.sessionID) ||
        source.messageID !== (origin?.messageID ?? owner.id) ||
        requested.part.id !== part.id ||
        requested.owner.id !== owner.id ||
        selected.has(part.id) ||
        source.end <= source.offset ||
        source.end - source.offset !== excerpt.text.length ||
        (excerpt.offset !== undefined && excerpt.offset !== source.offset) ||
        !boundary(part.text, source.offset) ||
        !boundary(part.text, source.end) ||
        part.text.slice(source.offset, source.end) !== excerpt.text
      )
        throw new IntegrityError(
          `Retained user source ${source.partID} no longer matches its exact original identity and range.`,
        )
      selected.add(part.id)
      const retainedPart = { ...part, text: excerpt.text }
      excerpts.set(retainedPart, { ...source, sessionID: part.sessionID, messageID: owner.id, partID: part.id })
      let message = projected.get(owner.id)
      if (!message) projected.set(owner.id, (message = { info: owner, parts: [] }))
      message.parts.push(retainedPart)
    }
    // Original Message and Part order, independent of the model's selection order.
    return messages.flatMap((message) => {
      const result = projected.get(message.info.id)
      if (!result) return []
      const parts = new Map(result.parts.map((part) => [part.id, part]))
      result.parts = message.parts.flatMap((part) => (parts.has(part.id) ? [parts.get(part.id)!] : []))
      return [result]
    })
  }

  export function create(
    messages: Message.WithParts[],
    fit: (input: { name: string; input: unknown; output: string; options: ToolExecutionOptions<unknown> }) => void,
  ): AITool {
    const bound = CompactionEvidenceReader.bind(messages)
    return tool({
      description:
        "Select verbatim original user text to replay with its original user role, Message/Part identity and chronology after compaction. Preserve current requirements, corrections and authorization with enough context to distinguish quotations from instructions. Submit the complete selection; later selections replace it. Existing published selections remain until replaced, including through later checkpoints. Only actual user text in this bound source history is eligible; assistant summaries and Tool quotations cannot acquire user authority. The receipt proves provenance, not permission or semantic completeness. This visible call publishes only with a successful final checkpoint.",
      inputSchema: Parameters,
      toModelOutput: ({ output }) => ({ type: "text", value: output.output }),
      async execute(input, options) {
        const sources: Selection["sources"] = []
        const seen = new Set<string>()
        for (const selected of input.excerpts) {
          const { part, owner } = bound.resolvePart(selected.part_id)
          if (owner.role !== "user" || part.type !== "text" || seen.has(part.id))
            throw new IntegrityError(
              `Selection ${selected.part_id} requires one excerpt from an actual original user text Part.`,
            )
          const first = part.text.indexOf(selected.text)
          if (first < 0)
            throw new IntegrityError(
              `Selection ${selected.part_id} text is not a verbatim substring of the original source. A paraphrase cannot be retained as original user text. Reread the actual source range and copy its text exactly; the source remains unresolved.`,
            )
          const offset = selected.offset ?? first
          if (selected.offset !== undefined && part.text.slice(offset, offset + selected.text.length) !== selected.text)
            throw new IntegrityError(
              `Selection ${selected.part_id} offset ${offset} does not match the supplied text. Its first exact occurrence starts at UTF-16 offset ${first}; omit offset for unique text instead of guessing.`,
            )
          const end = offset + selected.text.length
          if (
            offset < 0 ||
            !boundary(part.text, offset) ||
            !boundary(part.text, end) ||
            part.text.slice(offset, end) !== selected.text ||
            (selected.offset === undefined && part.text.indexOf(selected.text, offset + 1) >= 0)
          )
            throw new IntegrityError(
              `Selection ${selected.part_id} requires an exact, unambiguous Unicode-safe original excerpt.`,
            )
          seen.add(part.id)
          sources.push({
            sessionID: owner.sessionID,
            messageID: owner.id,
            partID: part.id,
            originalRole: "user",
            originalAuthor: owner.author,
            sha256: MessageCopyEvidence.digest(owner, part),
            offset,
            end,
          })
        }
        const receipt: Receipt = { status: "retained", selection_call_id: options.toolCallId, sources }
        const output = JSON.stringify(receipt)
        fit({ name: TOOL_NAME, input, output, options })
        return { title: "Original user text selected", output, metadata: { selectedParts: sources.length } }
      },
    })
  }

  /** Preserve only the genuine latest successful selection exchange across notes. */
  export function pinBefore(messages: ModelMessage[], start: number): ModelMessage[] {
    const saved = new Set<string>()
    for (const message of messages) {
      if (message.role !== "tool") continue
      for (const part of message.content) {
        if (part.type !== "tool-result" || part.toolName !== TOOL_NAME || part.output.type !== "text") continue
        receiptOutput(part.output.value, part.toolCallId)
        saved.add(part.toolCallId)
      }
    }
    let callID: string | undefined
    let callIndex = -1
    for (const [index, message] of messages.entries()) {
      if (message.role !== "assistant" || !Array.isArray(message.content)) continue
      for (const part of message.content) {
        if (part.type !== "tool-call" || part.toolName !== TOOL_NAME || !saved.has(part.toolCallId)) continue
        callID = part.toolCallId
        callIndex = index
      }
    }
    if (callIndex < 0 || callIndex >= start) return []
    return messages.slice(0, start).flatMap((message): ModelMessage[] => {
      if (message.role === "assistant" && Array.isArray(message.content)) {
        const content = message.content.filter((part) => part.type === "tool-call" && part.toolCallId === callID)
        return content.length ? [{ ...message, content }] : []
      }
      if (message.role === "tool") {
        const content = message.content.filter((part) => part.type === "tool-result" && part.toolCallId === callID)
        return content.length ? [{ ...message, content }] : []
      }
      return []
    })
  }
}
