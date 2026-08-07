import { abortAfterAny } from "../util/abort"
import { Config } from "../config/config"
import { proxiedFetchInit, resolveNetworkProxy } from "../util/network-proxy"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import { assertTaskNetworkCapability } from "@/engine/task-execution-capsule-binding"

const EXA_MCP_URL = "https://mcp.exa.ai/mcp"

interface ExaMcpResponse {
  jsonrpc: string
  result?: {
    content?: Array<{ type: string; text: string }>
  }
}

/**
 * Single source for the Exa MCP transport.
 *
 * POSTs a JSON-RPC `tools/call` to mcp.exa.ai, parses the SSE `data:` stream,
 * and returns the first content text. Shared by `websearch`
 * (`web_search_exa`), `external_code_search` (`get_code_context_exa`), and the
 * stage-agent context tools — CLAUDE.md rule 8/9: one implementation of the
 * HTTP + SSE plumbing; callers differ only by method name, arguments, and
 * timeout. EXA_API_KEY (when set) is sent as `x-api-key`.
 *
 * @returns extracted text, or `null` when the response carried no content.
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
}): Promise<string | null> {
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
    for (const line of responseText.split("\n")) {
      if (!line.startsWith("data: ")) continue
      const data: ExaMcpResponse = JSON.parse(line.substring(6))
      const text = data.result?.content?.[0]?.text
      if (text) return text
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
