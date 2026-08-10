import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./websearch.txt"
import {
  DEFAULT_WEB_SEARCH_RESULT_COUNT,
  renderWebSearchResults,
  WebSearchService,
  webSearchSources,
} from "./websearch-service"

export const WebSearchTool = Tool.define("websearch", async () => {
  return {
    get description() {
      return DESCRIPTION.replace("{{year}}", new Date().getFullYear().toString())
    },
    parameters: z.object({
      query: z.string().describe("Websearch query"),
      numResults: z.number().int().min(1).max(50).optional().describe("Number of search results to return"),
    }),
    async execute(params, ctx) {
      await ctx.ask({
        permission: "websearch",
        patterns: [params.query],
        always: ["*"],
        metadata: {
          query: params.query,
          numResults: params.numResults,
        },
      })

      const response = await WebSearchService.search({
        executionAuthority: Tool.requireExecutionAuthority(ctx),
        query: params.query,
        numResults: params.numResults ?? DEFAULT_WEB_SEARCH_RESULT_COUNT,
        signal: ctx.abort,
      })

      return {
        output: renderWebSearchResults(response),
        title: `Web search: ${params.query}`,
        metadata: {
          provider: response.provider,
          attempts: response.attempts,
          resultCount: response.results.length,
        },
        sources: webSearchSources(response.results),
      }
    },
  }
})
