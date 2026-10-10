import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import type { Message } from "@/session/message"
import { Tool } from "./tool"
import DESCRIPTION from "./codesearch.txt"
import { exaMcpCall, EXA_MCP_TOOLS } from "./exa-mcp"
import { urlSource } from "./source"

export const EMPTY_CODE_SEARCH_RESULT =
  "No code snippets or documentation found. Please try a different query, be more specific about the library or programming concept, or check the spelling of framework names."

export const ExaCodeSearchResultFormatError = NamedError.create(
  "ExaCodeSearchResultFormatError",
  z.object({ text: z.string() }),
)

/** Project Exa's declared code-context records into the shared source contract. */
export function parseExaCodeSearchSources(text: string): Message.SourceUrlPayload[] {
  if (!text.trim() || text.trim() === EMPTY_CODE_SEARCH_RESULT) return []
  return text
    .replaceAll("\r\n", "\n")
    .trim()
    .split(/\n---\n(?=\n?Title: )/)
    .map((raw) => {
      const block = raw.trim()
      const match = block.match(
        /^Title: ([^\n]+)\nURL: (https?:\/\/[^\n]+)(?:\n(?:Code\/Highlights:\n|Text: )([\s\S]*))?$/,
      )
      if (!match) throw new ExaCodeSearchResultFormatError({ text: block })
      const [, title, url, snippet] = match
      return urlSource({
        url: url.trim(),
        title: title.trim() === "N/A" ? undefined : title,
        snippet,
        provider: "exa",
      })
    })
}

export const ExternalCodeSearchTool = Tool.define("external_code_search", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Search query to find relevant context for APIs, Libraries, and SDKs. For example, 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware', 'Next js partial prerendering configuration'",
      ),
    numResults: z
      .number()
      .int()
      .positive()
      .default(8)
      .describe("Number of code examples or documentation results to request from Exa. Default is 8."),
  }),
  async execute(params, ctx) {
    const result = await exaMcpCall({
      executionAuthority: Tool.requireExecutionAuthority(ctx),
      name: EXA_MCP_TOOLS.codeSearch,
      arguments: {
        query: params.query,
        numResults: params.numResults,
      },
      timeoutMs: 30000,
      signal: ctx.abort,
      label: "Code search",
    })

    const output = result?.text ?? EMPTY_CODE_SEARCH_RESULT
    return {
      output,
      title: `External code search: ${params.query}`,
      metadata: { provider: "exa", mcpResult: result?.result },
      sources: parseExaCodeSearchSources(output),
    }
  },
})
