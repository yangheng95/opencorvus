import { abortAfterAny } from "../util/abort"
import { Config } from "../config/config"
import { proxiedFetchInit, resolveNetworkProxy } from "../util/network-proxy"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import { assertTaskNetworkCapability } from "@/engine/task-execution-capsule-binding"

const EXA_MCP_URL = "https://mcp.exa.ai/mcp"

interface ExaMcpResponse {
  jsonrpc: string
  result?: {
    content?: Array<{ type: string; text?: string; [key: string]: unknown }>
    structuredContent?: unknown
  }
}

export interface ExaMcpResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>
  structuredContent?: unknown
  text: string
}

/**
 * Single source for the Exa MCP transport.
 *
 * POSTs a JSON-RPC `tools/call` to mcp.exa.ai, parses the Server-Sent Events
 * (SSE) `data:` stream, and preserves its complete result content. Shared by `websearch`
 * (`web_search_exa`), `external_code_search` (`get_code_context_exa`), and the
 * stage-agent context tools — CLAUDE.md rule 8/9: one implementation of the
 * Hypertext Transfer Protocol (HTTP) plumbing; callers differ only by method name, arguments, and
 * timeout. EXA_API_KEY (when set) is sent as `x-api-key`.
 *
 * @returns complete content plus joined text blocks, or `null` when the response carried no result content.
 * @throws Error on non-2xx HTTP, or `"<label> request timed out"` on abort
 *   (internal deadline or caller signal).
 */
export async function exaMcpCall(opts: {
  /** Exa MCP tool name, e.g. "web_search_exa" | "get_code_context_exa". */
  name: string
  arguments: Record<string, unknown>
  /** Internal deadline (ms). Combined with the optional caller signal. */
  timeoutMs: number
  /** Caller abort (task cancel / per-tool ctx.abort). */
  signal?: AbortSignal
  /** Human label for timeout / error messages, e.g. "Web search". */
  label: string
  executionAuthority: SessionExecutionAuthority
}): Promise<ExaMcpResult | null> {
  if (opts.executionAuthority.kind === "task") {
    assertTaskNetworkCapability({ taskID: opts.executionAuthority.taskID, capability: opts.label })
  }
  const { signal, clearTimeout } = abortAfterAny(opts.timeoutMs, ...(opts.signal ? [opts.signal] : []))
  try {
    const headers: Record<string, string> = {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    }
    const exaKey = process.env.EXA_API_KEY
    if (exaKey) headers["x-api-key"] = exaKey
    const proxyUrl = resolveNetworkProxy(await Config.get(), "webResearch")

    const response = await fetch(
      EXA_MCP_URL,
      proxiedFetchInit(
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name: opts.name, arguments: opts.arguments },
          }),
          signal,
        },
        proxyUrl,
        "webResearch",
      ),
    )

    clearTimeout()

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`${opts.label} error (${response.status}): ${errorText}`)
    }

    const responseText = await response.text()
    for (const line of responseText.replaceAll("\r\n", "\n").split("\n")) {
      if (!line.startsWith("data: ")) continue
      const data: ExaMcpResponse = JSON.parse(line.substring(6))
      const content = data.result?.content ?? []
      if (content.length > 0 || data.result?.structuredContent !== undefined) {
        return {
          content,
          structuredContent: data.result?.structuredContent,
          text: content.flatMap((item) => (item.type === "text" && item.text ? [item.text] : [])).join("\n\n"),
        }
      }
    }
    return null
  } catch (error) {
    clearTimeout()
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${opts.label} request timed out`)
    }
    throw error
  }
}
