// ── MCP Service ──
// configure, connect, disconnect, auth cleanup, and atomic project removal.
// DOM-rendering is handled by declarative Solid.js components.

import type { McpStatus } from "@opencorvus-ai/sdk"
import { isMcpConnectionStatus } from "../utils/settings-status-labels"
import { apiJson, type ApiAuthority } from "./api"
import type { ConfigRequestOptions } from "./config"

export type RemoteMcpTransport = "streamable-http" | "sse"
export type RemoteMcpCredentialType = "none" | "query" | "bearer" | "header"

export type AddMcpInput = {
  name: string
} & (
  | {
      type: "remote"
      transport: RemoteMcpTransport
      url?: string
      credentialType?: RemoteMcpCredentialType
      credentialName?: string
      credentialSecret?: string
    }
  | {
      type: "local"
      command?: string
      args?: string
    }
)

const remoteMcpTransports = new Set<RemoteMcpTransport>(["streamable-http", "sse"])

function requireRemoteMcpTransport(transport: unknown): RemoteMcpTransport {
  if (remoteMcpTransports.has(transport as RemoteMcpTransport)) return transport as RemoteMcpTransport
  throw new Error("MCP remote transport is required")
}

type McpAddRequest =
  | {
      name: string
      config: {
        type: "remote"
        transport: RemoteMcpTransport
        url: string
        oauth?: false
        credential?: { type: "query" | "header"; name: string } | { type: "bearer" }
      }
      credentialSecret?: string
    }
  | { name: string; config: { type: "local"; command: string[] } }

type McpRequestOptions = ConfigRequestOptions

function mcpPath(path: string, options: McpRequestOptions = {}): string {
  const directory = options.directory?.trim()
  return directory ? `${path}?directory=${encodeURIComponent(directory)}` : path
}

export class McpArgumentQuoteError extends Error {
  override readonly name = "McpArgumentQuoteError"

  constructor(readonly quote: "'" | '"') {
    super("MCP arguments contain an unterminated quote")
  }
}

export function parseMcpArguments(input: string): string[] {
  const args: string[] = []
  let current = ""
  let started = false
  let quote: "'" | '"' | "" = ""

  for (const char of input) {
    if (quote) {
      if (char === quote) {
        quote = ""
      } else {
        current += char
      }
      continue
    }
    if (char === "'" || char === '"') {
      started = true
      quote = char
      continue
    }
    if (/\s/.test(char)) {
      if (started) {
        args.push(current)
        current = ""
        started = false
      }
      continue
    }
    current += char
    started = true
  }

  if (quote) throw new McpArgumentQuoteError(quote)
  if (started) args.push(current)
  return args
}

export function buildMcpAddRequest(input: AddMcpInput): McpAddRequest {
  const name = input.name.trim()
  if (!name) throw new Error("MCP name is required")

  if (input.type === "remote") {
    const url = (input.url ?? "").trim()
    if (!url) throw new Error("MCP remote URL is required")
    const transport = requireRemoteMcpTransport(input.transport)
    const credentialType = input.credentialType ?? "none"
    if (credentialType === "none") return { name, config: { type: "remote", transport, url } }
    const credentialSecret = input.credentialSecret ?? ""
    if (!credentialSecret.trim()) throw new Error("MCP credential secret is required")
    if (credentialType === "bearer") {
      return {
        name,
        config: { type: "remote", transport, url, oauth: false, credential: { type: "bearer" } },
        credentialSecret,
      }
    }
    const credentialName = (input.credentialName ?? "").trim()
    if (!credentialName) throw new Error("MCP credential name is required")
    return {
      name,
      config: {
        type: "remote",
        transport,
        url,
        oauth: false,
        credential: { type: credentialType, name: credentialName },
      },
      credentialSecret,
    }
  }

  const command = (input.command ?? "").trim()
  if (!command) throw new Error("MCP command is required")
  return {
    name,
    config: {
      type: "local",
      command: [command, ...parseMcpArguments(input.args ?? "")],
    },
  }
}

export function isMcpServerStatus(value: unknown): value is McpStatus {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("status" in value)) return false
  const status = value.status
  if (typeof status !== "string" || !isMcpConnectionStatus(status)) return false
  if ("scope" in value && ((status !== "disabled" && status !== "disconnected") || value.scope !== "execution")) return false
  if (status === "disabled") return !("reason" in value) || value.reason === "manual_disconnect"
  return status !== "failed" && status !== "needs_client_registration" ||
    ("error" in value && typeof value.error === "string")
}

export class InvalidMcpAddReceiptError extends Error {
  override readonly name = "InvalidMcpAddReceiptError"

  constructor(readonly serverName: string, readonly reason: "missing_target" | "invalid_status") {
    const detail = reason === "missing_target" ? "did not include" : "included an invalid status for"
    super(`The MCP add response ${detail} ${JSON.stringify(serverName)}.`)
  }
}

export async function addMcpServer(request: McpAddRequest, options: { directory: string; authority: ApiAuthority }): Promise<void> {
  const response = await apiJson<unknown>(mcpPath("mcp", options), {
    authority: options.authority,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!response || typeof response !== "object" || Array.isArray(response) || !Object.hasOwn(response, request.name)) {
    throw new InvalidMcpAddReceiptError(request.name, "missing_target")
  }
  if (!isMcpServerStatus((response as Record<string, unknown>)[request.name])) {
    throw new InvalidMcpAddReceiptError(request.name, "invalid_status")
  }
}

export class InvalidMcpConnectionReceiptError extends Error {
  override readonly name = "InvalidMcpConnectionReceiptError"

  constructor(readonly action: "connect" | "disconnect", readonly serverName: string) {
    super(`MCP ${action} returned an invalid acknowledgment for ${serverName}.`)
  }
}

async function changeMcpConnection(name: string, action: "connect" | "disconnect", options: McpRequestOptions): Promise<void> {
  const result = await apiJson<unknown>(mcpPath(`mcp/${encodeURIComponent(name)}/${action}`, options), {
    authority: options.authority,
    method: "POST",
  })
  if (result !== true) throw new InvalidMcpConnectionReceiptError(action, name)
}

/** Connects a configured MCP server by name. */
export function connectMcp(name: string, options: McpRequestOptions = {}): Promise<void> {
  return changeMcpConnection(name, "connect", options)
}

/** Disconnects an active MCP connection by name. */
export function disconnectMcp(name: string, options: McpRequestOptions = {}): Promise<void> {
  return changeMcpConnection(name, "disconnect", options)
}

/** Removes stored OAuth/auth credentials for an MCP server by name. */
export async function removeMcpAuth(name: string, options: McpRequestOptions = {}): Promise<void> {
  await apiJson(mcpPath(`mcp/${encodeURIComponent(name)}/auth`, options), {
    method: "DELETE",
  })
}

/**
 * Atomically removes project-owned MCP definitions after backend reference,
 * connection, and credential cleanup.
 */
export async function deleteAllMcp(options: { directory: string; authority: ApiAuthority; names: readonly string[] }): Promise<void> {
  await apiJson(mcpPath("mcp", options), {
    authority: options.authority,
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names: options.names }),
  })
}
