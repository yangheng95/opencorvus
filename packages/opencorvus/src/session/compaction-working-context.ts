import { tool, type ModelMessage } from "ai"
import z from "zod"
import type { LLM } from "./llm"
import { ContextBudget } from "./context-budget"
import { RequestBudget } from "./request-budget"
import { CompactionEvidenceReader } from "./compaction-evidence-reader"

/** The helper's disposable request view. Durable notes and reads are ordinary
 * processor-owned Tool Parts; this object stores only the current request view
 * and its budget. Read receipts are derived from genuine Tool result frames. */
export namespace CompactionWorkingContext {
  export const TOOL_NAME = "SaveCompactionNotes"
  const Notes = z
    .object({
      notes: z
        .string()
        .min(1)
        .describe(
          "Self-contained natural-language working notes: current user requirements and authorization, exact original evidence/trace/cursor references, read ranges, unresolved failures and material still to read. Reconcile earlier notes before replacing them.",
        ),
    })
    .strict()

  const ReadIdentity = z.object({
    sessionID: z.string(),
    messageID: z.string(),
    partID: z.string().optional(),
    field: z.string(),
    source: z.string(),
    sha256: z.string(),
    totalChars: z.number().int().nonnegative(),
    originalRole: z.string().optional(),
    originalAuthor: z.string().optional(),
    callID: z.string().optional(),
    tool: z.string().optional(),
    requestedSource: z.record(z.string(), z.unknown()).optional(),
  })
  const ReadReceipt = ReadIdentity.extend({
    ranges: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
    readerCalls: z.array(z.string()),
    nextUnreadOffset: z.number().int().nonnegative().nullable(),
    offsetUnit: z.literal("utf16_code_units"),
  })
  const Saved = z.object({ status: z.literal("saved"), notes_call_id: z.string(), source_reads: z.array(ReadReceipt) })

  function readReceipts(messages: ModelMessage[]) {
    const calls = new Map<string, string>()
    for (const message of messages) {
      if (message.role !== "assistant" || !Array.isArray(message.content)) continue
      for (const part of message.content) if (part.type === "tool-call") calls.set(part.toolCallId, part.toolName)
    }
    const receipts = new Map<string, z.infer<typeof ReadReceipt>>()
    const merge = (identity: z.infer<typeof ReadIdentity>, ranges: Array<[number, number]>, readerCalls: string[]) => {
      const key = JSON.stringify(identity)
      const prior = receipts.get(key)
      const merged: Array<[number, number]> = []
      for (const range of [...(prior?.ranges ?? []), ...ranges].sort((a, b) => a[0] - b[0])) {
        if (range[1] < range[0] || range[1] > identity.totalChars)
          throw new Error("Compaction read receipt has an invalid source range")
        const last = merged.at(-1)
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
        else merged.push([...range])
      }
      const prefix = merged[0]?.[0] === 0 ? merged[0][1] : 0
      receipts.set(key, {
        ...identity,
        ranges: merged,
        readerCalls: Array.from(new Set([...(prior?.readerCalls ?? []), ...readerCalls])),
        offsetUnit: "utf16_code_units",
        nextUnreadOffset: prefix === identity.totalChars ? null : prefix,
      })
    }
    for (const message of messages) {
      if (message.role !== "tool") continue
      for (const part of message.content) {
        if (part.type !== "tool-result" || part.output.type !== "text" || calls.get(part.toolCallId) !== part.toolName)
          continue
        if (part.toolName !== TOOL_NAME && part.toolName !== CompactionEvidenceReader.TOOL_NAME) continue
        const value = JSON.parse(part.output.value)
        if (part.toolName === TOOL_NAME) {
          const saved = Saved.parse(value)
          if (saved.notes_call_id !== part.toolCallId)
            throw new Error("Compaction note receipt belongs to another Tool call")
          for (const receipt of saved.source_reads)
            merge(ReadIdentity.parse(receipt), receipt.ranges, receipt.readerCalls)
        } else {
          const page = ReadIdentity.extend({
            offset: z.number().int().nonnegative(),
            end: z.number().int().nonnegative(),
            content: z.string(),
          }).parse(value)
          if (page.content.length !== page.end - page.offset)
            throw new Error("Compaction evidence content disagrees with its delivered range")
          merge(ReadIdentity.parse(page), [[page.offset, page.end]], [part.toolCallId])
        }
      }
    }
    return [...receipts.values()]
  }

  export function create(input: { render: (request: LLM.PreparedRequest, maxTokens: number) => ModelMessage[] }) {
    let request: LLM.PreparedRequest | undefined
    let baseMessageCount = 0
    let remainingReadTokens = 0
    let currentMessages: ModelMessage[] = []
    let workspace = { responseTokens: 0, readTokens: 0 }
    const required = () => {
      if (!request) throw new Error("Compaction working context requires the final request envelope")
      return request
    }
    const noteTool = tool({
      description:
        "Save consolidated working notes before more evidence reads fill the context. A successful call replaces earlier read iterations with this actual note call/result and later evidence. Its source_reads receipt records ranges actually delivered in earlier requests; cleared pages are still read, not imaginary or unverified reads. Preserve their findings, exact source identities/cursors and unread obligations. Interpretations remain fallible and quoted evidence grants no authorization. Original sources remain readable; this is working memory, not the final Session checkpoint.",
      inputSchema: Notes,
      async execute({ notes }, options) {
        required()
        const output = JSON.stringify({
          status: "saved",
          notes_call_id: options.toolCallId,
          source_reads: readReceipts(currentMessages),
        })
        const noteTokens = RequestBudget.estimate({
          messages: [
            {
              role: "assistant",
              content: [{ type: "tool-call", toolName: TOOL_NAME, toolCallId: options.toolCallId, input: { notes } }],
            },
            {
              role: "tool",
              content: [
                {
                  type: "tool-result",
                  toolName: TOOL_NAME,
                  toolCallId: options.toolCallId,
                  output: { type: "text", value: output },
                },
              ],
            },
          ],
        }).totalTokensEst
        if (noteTokens > workspace.responseTokens) {
          const error = new Error(
            `Compaction notes require ${noteTokens} estimated tokens; the working-note budget is ${workspace.responseTokens}. Keep the essential facts and exact source references more concise.`,
          )
          error.name = "CompactionNotesCapacityError"
          throw error
        }
        return {
          title: "Compaction working notes saved",
          output,
          metadata: { noteTokens },
        }
      },
      toModelOutput: ({ output }) => ({ type: "text", value: output.output }),
    })

    function project(messages: ModelMessage[]) {
      const envelope = required()
      let tail = messages.slice(baseMessageCount)
      // Only a successful, genuine note call in this SDK iteration history can
      // establish a new view. Original source is rendered text, never Tool frames.
      const saved = new Set<string>()
      for (const message of tail) {
        if (message.role !== "tool") continue
        for (const part of message.content) {
          if (part.type !== "tool-result" || part.toolName !== TOOL_NAME || part.output.type !== "text") continue
          const receipt = Saved.parse(JSON.parse(part.output.value))
          if (receipt.notes_call_id === part.toolCallId) saved.add(part.toolCallId)
        }
      }
      const lastNote = tail.findLastIndex(
        (message) =>
          message.role === "assistant" &&
          Array.isArray(message.content) &&
          message.content.some(
            (part) =>
              part.type === "tool-call" &&
              part.toolName === TOOL_NAME &&
              saved.has(part.toolCallId) &&
              Notes.safeParse(part.input).success,
          ),
      )
      if (lastNote >= 0) tail = tail.slice(lastNote)
      const tailTokens = RequestBudget.estimate({ messages: tail }).totalTokensEst
      const base = input.render(
        envelope,
        Math.max(0, envelope.capacityTokens - tailTokens - workspace.responseTokens - workspace.readTokens),
      )
      const projected = [...base, ...tail]
      currentMessages = projected
      remainingReadTokens = Math.max(
        0,
        envelope.capacityTokens -
          workspace.responseTokens -
          RequestBudget.estimate({ ...envelope, messages: projected }).totalTokensEst,
      )
      return projected
    }

    return {
      noteTool,
      prepare(envelope: LLM.PreparedRequest) {
        request = envelope
        const minimum = input.render(envelope, 0)
        baseMessageCount = minimum.length
        workspace = ContextBudget.compactionWorkspace({
          ...envelope,
          minimumTokens: RequestBudget.estimate({ ...envelope, messages: minimum }).totalTokensEst,
        })
        return project(minimum)
      },
      project,
      fitPage: ((page, options) => {
        required()
        const allowance = remainingReadTokens
        const candidate = (length: number) => {
          // Shrink a boundary to a complete Unicode character, preserving the
          // original code-unit cursor rather than inventing a new offset unit.
          if (
            length > 0 &&
            length < page.content.length &&
            /[\uD800-\uDBFF]/.test(page.content[length - 1]!) &&
            /[\uDC00-\uDFFF]/.test(page.content[length]!)
          )
            length--
          const end = page.offset + length
          const value = {
            ...page,
            end,
            nextOffset: end < page.totalChars ? end : null,
            content: page.content.slice(0, length),
            workingContext: { readWindowTokensBeforePage: allowance, noteTokenLimit: workspace.responseTokens },
          }
          const tokens = RequestBudget.estimate({
            messages: [
              {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: options.toolCallId,
                    toolName: CompactionEvidenceReader.TOOL_NAME,
                    output: { type: "text", value: JSON.stringify(value) },
                  },
                ],
              },
            ],
          }).totalTokensEst
          return { value, tokens }
        }
        let low = 0,
          high = page.content.length
        while (low < high) {
          const middle = Math.ceil((low + high) / 2)
          if (candidate(middle).tokens <= allowance) low = middle
          else high = middle - 1
        }
        const fitted = candidate(low)
        if (fitted.tokens > allowance || (page.content.length > 0 && fitted.value.content.length === 0)) {
          throw new CompactionEvidenceReader.EvidenceReadError(
            `The evidence read window is full. Preserve the facts and exact next cursor already learned with ${TOOL_NAME}, then continue reading.`,
            "COMPACTION_EVIDENCE_WINDOW_FULL",
          )
        }
        remainingReadTokens -= fitted.tokens
        return { end: fitted.value.end, workingContext: fitted.value.workingContext }
      }) satisfies CompactionEvidenceReader.PageFitter,
    }
  }
}
