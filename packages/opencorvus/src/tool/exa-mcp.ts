import { abortAfterAny } from "../util/abort"
import { readHttpResponseBody, fetchHttpResponseOwner } from "../util/http-response-body"
import { Config } from "../config/config"
import { proxiedFetchInit, resolveNetworkProxy } from "../util/network-proxy"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import { assertTaskNetworkCapability } from "@/engine/task-execution-capsule-binding"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { createParser } from "eventsource-parser"
import {
  CallToolResultSchema,
  JSONRPCMessageSchema,
  JSONRPCErrorResponseSchema,
  JSONRPCResultResponseSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js"

export const EXA_MCP_TOOLS = { webSearch: "web_search_exa", codeSearch: "get_code_context_exa" } as const
const endpoint = new URL("https://mcp.exa.ai/mcp")
endpoint.searchParams.set("tools", Object.values(EXA_MCP_TOOLS).join(","))
const EXA_MCP_URL = endpoint.toString()

export interface ExaMcpResult {
  result: CallToolResult
  text: string
}

export const ExaMcpFailure = NamedError.create(
  "ExaMcpFailure",
  z.object({
    code: z.enum(["rate_limited", "tool_error", "protocol_error", "invalid_response"]),
    toolName: z.string(),
    message: z.string(),
    result: CallToolResultSchema.optional(),
    rpcError: JSONRPCErrorResponseSchema.shape.error.optional(),
  }),
)

export function decodeExaMcpResponse(
  responseText: string,
  contentType: string,
  toolName: string,
  label: string,
): ExaMcpResult | null {
  const messages: unknown[] = []
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase()
  if (mediaType === "application/json") messages.push(JSON.parse(responseText))
  else if (mediaType === "text/event-stream") {
    const parser = createParser({ onEvent: (event) => messages.push(JSON.parse(event.data)) })
    parser.feed(responseText)
  } else {
    throw new ExaMcpFailure({
      code: "invalid_response",
      toolName,
      message: `${label}: unsupported MCP content type ${contentType}`,
    })
  }
  for (const input of messages) {
    const message = JSONRPCMessageSchema.parse(input)
    const failure = JSONRPCErrorResponseSchema.safeParse(message)
    if (failure.success)
      throw new ExaMcpFailure({
        code: "protocol_error",
        toolName,
        message: `${label}: ${failure.data.error.message}`,
        rpcError: failure.data.error,
      })
    const response = JSONRPCResultResponseSchema.safeParse(message)
    if (!response.success) continue
    const result = CallToolResultSchema.parse(response.data.result)
    const text = result.content.flatMap((item) => (item.type === "text" ? [item.text] : [])).join("\n\n")
    const rateLimited = result._meta?.["ai.exa/rateLimited"] === true
    if (rateLimited || result.isError === true)
      throw new ExaMcpFailure({
        code: rateLimited ? "rate_limited" : "tool_error",
        toolName,
        message: `${label}: ${text || JSON.stringify(result)}`,
        result,
      })
    return { result, text }
  }
  return null
}

/**
 * Single source for the Exa MCP transport.
 *
 * POSTs a JSON-RPC `tools/call` to mcp.exa.ai, parses the Server-Sent Events
 * (SSE) or standard JSON response and preserves the complete current MCP result.
 * Shared by `websearch` (`web_search_exa`) and `external_code_search`
 * (`get_code_context_exa`). Hypertext Transfer Protocol (HTTP) plumbing remains
 * one implementation; callers differ only by method name, arguments, and
 * timeout. EXA_API_KEY (when set) is sent as `x-api-key`.
 *
 * @returns complete result plus joined text blocks, or `null` when the stream carried no result.
 * @throws ExaMcpFailure for protocol, tool, or explicit provider rate-limit responses.
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

    const owner = await fetchHttpResponseOwner(
      (requestSignal) =>
        fetch(
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
              signal: requestSignal,
            },
            proxyUrl,
            "webResearch",
          ),
        ),
      signal,
    )
    const { response } = owner

    if (!response.ok) {
      const errorText = new TextDecoder().decode(await readHttpResponseBody(owner))
      throw new Error(`${opts.label} error (${response.status}): ${errorText}`)
    }

    const responseText = new TextDecoder().decode(await readHttpResponseBody(owner))
    return decodeExaMcpResponse(responseText, response.headers.get("content-type") ?? "", opts.name, opts.label)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${opts.label} request timed out`)
    }
    throw error
  } finally {
    clearTimeout()
  }
}
