import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./codesearch.txt"
import { exaMcpCall } from "./exa-mcp"

export const ExternalCodeSearchTool = Tool.define("external_code_search", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Search query to find relevant context for APIs, Libraries, and SDKs. For example, 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware', 'Next js partial prerendering configuration'",
      ),
    tokensNum: z
      .number()
      .min(1000)
      .max(50000)
      .default(5000)
      .describe(
        "Number of tokens to return (1000-50000). Default is 5000 tokens. Adjust this value based on how much context you need - use lower values for focused queries and higher values for comprehensive documentation.",
      ),
  }),
  async execute(params, ctx) {

    const result = await exaMcpCall({
      executionAuthority: Tool.requireExecutionAuthority(ctx),
      name: "get_code_context_exa",
      arguments: {
        query: params.query,
        tokensNum: params.tokensNum || 5000,
      },
      timeoutMs: 30000,
      signal: ctx.abort,
      label: "Code search",
    })

    return {
      output:
        result?.text ??
        "No code snippets or documentation found. Please try a different query, be more specific about the library or programming concept, or check the spelling of framework names.",
      title: `External code search: ${params.query}`,
      metadata: {},
    }
  },
})
