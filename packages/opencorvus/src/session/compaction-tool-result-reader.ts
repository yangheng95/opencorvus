import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import { tool, type Tool as AITool } from "ai"
import z from "zod"
import type { Message } from "./message"

export namespace CompactionToolResultReader {
  export const TOOL_NAME = "ReadCompactionToolResult"
  export const MAX_CHARS_PER_READ = 30_000

  const Parameters = z
    .object({
      part_id: z.string().min(1).describe("Completed tool part id from a compaction_tool_result_reference."),
      offset: z.coerce
        .number()
        .int()
        .min(0)
        .default(0)
        .describe("Zero-based character offset in the authoritative tool result."),
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_CHARS_PER_READ)
        .default(MAX_CHARS_PER_READ)
        .describe(`Maximum characters to return, capped at ${MAX_CHARS_PER_READ}.`),
    })
    .strict()

  type CompletedToolPart = Message.ToolPart & {
    state: Extract<Message.ToolPart["state"], { status: "completed" }>
  }

  function completedToolParts(messages: Message.WithParts[]) {
    const result = new Map<string, CompletedToolPart>()
    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type !== "tool" || part.state.status !== "completed") continue
        result.set(part.id, part as CompletedToolPart)
      }
    }
    return result
  }

  function materializedOutputPath(part: CompletedToolPart) {
    const outputPath = part.state.metadata.outputPath
    if (outputPath === undefined) return undefined
    if (part.state.metadata.truncated !== true) {
      throw new Error(`Compaction tool result ${part.id} declares outputPath without metadata.truncated=true.`)
    }
    if (typeof outputPath !== "string" || outputPath.length === 0) {
      throw new Error(`Compaction tool result ${part.id} declares an invalid authoritative outputPath.`)
    }
    return outputPath
  }

  async function authoritativeOutput(part: CompletedToolPart) {
    const outputPath = materializedOutputPath(part)
    if (outputPath === undefined) {
      return { source: "message-part-output" as const, output: part.state.output }
    }
    return {
      source: "truncation-file" as const,
      output: await readFile(outputPath, "utf8"),
    }
  }

  export async function assertSources(messages: Message.WithParts[]) {
    for (const part of completedToolParts(messages).values()) {
      const outputPath = materializedOutputPath(part)
      if (outputPath === undefined) continue
      const info = await stat(outputPath)
      if (!info.isFile()) {
        throw new Error(`Compaction tool result ${part.id} outputPath is not a file: ${outputPath}`)
      }
    }
  }

  export function reference(part: Message.ToolPart) {
    if (part.state.status !== "completed") {
      throw new Error(`Compaction tool result reference requires a completed part: ${part.id}`)
    }
    const completed = part as CompletedToolPart
    const outputPath = materializedOutputPath(completed)
    return {
      kind: "compaction_tool_result_reference" as const,
      retrievalTool: TOOL_NAME,
      partID: completed.id,
      messageID: completed.messageID,
      callID: completed.callID,
      tool: completed.tool,
      authoritativeSource:
        outputPath === undefined
          ? {
              kind: "message-part-output" as const,
              chars: completed.state.output.length,
              sha256: createHash("sha256").update(completed.state.output).digest("hex"),
            }
          : {
              kind: "truncation-file" as const,
              outputPath,
              storedPreviewChars: completed.state.output.length,
            },
    }
  }

  export function create(messages: Message.WithParts[]): AITool {
    const parts = completedToolParts(messages)
    return tool({
      description:
        "Read exact persisted output for a completed tool result referenced by the compacted transcript. " +
        "Paginate with offset/limit until nextOffset is null. This tool can read only completed tool parts in the selected compaction head.",
      inputSchema: Parameters,
      async execute(input) {
        const part = parts.get(input.part_id)
        if (!part) {
          throw new Error(
            `Compaction tool result ${input.part_id} is not a completed tool part in the selected compaction head.`,
          )
        }
        const resolved = await authoritativeOutput(part)
        if (input.offset > resolved.output.length) {
          throw new Error(
            `Compaction tool result ${part.id} offset ${input.offset} exceeds ${resolved.output.length} characters.`,
          )
        }
        const end = Math.min(resolved.output.length, input.offset + input.limit)
        const payload = {
          partID: part.id,
          messageID: part.messageID,
          callID: part.callID,
          tool: part.tool,
          source: resolved.source,
          totalChars: resolved.output.length,
          sha256: createHash("sha256").update(resolved.output).digest("hex"),
          offset: input.offset,
          end,
          nextOffset: end < resolved.output.length ? end : null,
          content: resolved.output.slice(input.offset, end),
        }
        return {
          title: `Read compacted ${part.tool} result`,
          output: JSON.stringify(payload),
          metadata: {
            partID: part.id,
            source: resolved.source,
            totalChars: resolved.output.length,
            nextOffset: payload.nextOffset,
          },
        }
      },
    })
  }
}
