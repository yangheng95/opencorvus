import { createHash } from "node:crypto"
import { RESOURCE_MIME_TYPE, McpUiResourceMetaSchema } from "@modelcontextprotocol/ext-apps/app-bridge"
import type { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js"
import { MCP } from "@/mcp"
import { publishInteractiveArtifact } from "./persist"
import type { InteractiveArtifactRecord, McpAppToolLifecycle } from "./schema"
import type z from "zod"

const MAX_RESOURCE_PAGES = 100

function assertOrigin(value: string, kind: "connect" | "resource" | "frame" | "base"): void {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`MCP App ${kind} CSP entry is not an absolute origin: ${value}`)
  }
  const protocols = kind === "connect" ? new Set(["https:", "wss:"]) : new Set(["https:"])
  const wildcard = url.hostname.includes("*")
  const validWildcard =
    wildcard &&
    url.hostname.startsWith("*.") &&
    !url.hostname.slice(2).includes("*") &&
    url.hostname.slice(2).includes(".")
  if (
    !protocols.has(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (wildcard && !validWildcard)
  ) {
    throw new Error(`MCP App ${kind} CSP entry must be a credential-free secure origin: ${value}`)
  }
}

function validateResourceMetadata(value: unknown) {
  const metadata = McpUiResourceMetaSchema.parse(value ?? {})
  for (const origin of metadata.csp?.connectDomains ?? []) assertOrigin(origin, "connect")
  for (const origin of metadata.csp?.resourceDomains ?? []) assertOrigin(origin, "resource")
  for (const origin of metadata.csp?.frameDomains ?? []) assertOrigin(origin, "frame")
  for (const origin of metadata.csp?.baseUriDomains ?? []) assertOrigin(origin, "base")
  if (metadata.domain) {
    let domain: URL
    try {
      domain = new URL(`https://${metadata.domain}`)
    } catch {
      throw new Error(`MCP App dedicated domain is invalid: ${metadata.domain}`)
    }
    if (
      domain.hostname !== metadata.domain ||
      domain.username ||
      domain.password ||
      domain.port ||
      domain.pathname !== "/" ||
      domain.search ||
      domain.hash
    ) {
      throw new Error(`MCP App dedicated domain must be one exact hostname: ${metadata.domain}`)
    }
    throw new Error(
      `MCP App dedicated domain ${metadata.domain} cannot be honored by the sandboxed OpenCorvus Blob origin`,
    )
  }
  return metadata
}

async function findListedResourceMetadata(client: Client, timeout: number, resourceURI: string): Promise<unknown> {
  let cursor: string | undefined
  const seen = new Set<string>()
  for (let pageIndex = 0; pageIndex < MAX_RESOURCE_PAGES; pageIndex++) {
    const page = await client.listResources(cursor ? { cursor } : undefined, { timeout })
    const resource = page.resources.find((candidate) => candidate.uri === resourceURI)
    if (resource) return (resource._meta as { ui?: unknown } | undefined)?.ui
    cursor = page.nextCursor
    if (!cursor) return undefined
    if (seen.has(cursor)) throw new Error(`MCP App resource listing repeated pagination cursor ${cursor}`)
    seen.add(cursor)
  }
  throw new Error(`MCP App resource listing exceeded ${MAX_RESOURCE_PAGES} pages`)
}

export async function materializeMcpAppArtifact(input: {
  sessionID: string
  messageID: string
  binding: MCP.AppToolBinding
  authority:
    | { kind: "configured" }
    | {
        kind: "expert-squad"
        taskID: string
        expertSquadID: string
        agentID: string
        projectionHash: string
        providerKind: "package-mcp-tool" | "default-mcp-tool"
        toolRef: string
        providerName: string
        mcpServerConfigSHA256: string
      }
  lifecycle: z.input<typeof McpAppToolLifecycle>
}): Promise<InteractiveArtifactRecord> {
  if (!input.binding.resourceURI.startsWith("ui://")) {
    throw new Error(`MCP App resource must use ui://: ${input.binding.resourceURI}`)
  }
  return MCP.withBoundAppClient(input.binding, async (client, timeout) => {
    const lifecycle =
      input.lifecycle.status === "completed"
        ? {
            ...input.lifecycle,
            result: CallToolResultSchema.parse(input.lifecycle.result),
          }
        : input.lifecycle
    const capabilities = client.getServerCapabilities()
    if (!capabilities?.resources) {
      throw new Error(`MCP App server ${input.binding.serverID} does not expose resources`)
    }
    const listedMetadata = await findListedResourceMetadata(client, timeout, input.binding.resourceURI)
    const result = await client.readResource({ uri: input.binding.resourceURI }, { timeout })
    if (result.contents.length !== 1) {
      throw new Error(`MCP App resource ${input.binding.resourceURI} must return exactly one content item`)
    }
    const content = result.contents[0] as {
      uri?: unknown
      mimeType?: unknown
      text?: unknown
      blob?: unknown
      _meta?: { ui?: unknown }
    }
    if (content.uri !== input.binding.resourceURI) {
      throw new Error(`MCP App resource content URI does not match ${input.binding.resourceURI}`)
    }
    if (content.mimeType !== RESOURCE_MIME_TYPE) {
      throw new Error(`MCP App resource ${input.binding.resourceURI} must use ${RESOURCE_MIME_TYPE}`)
    }
    if (typeof content.text !== "string" || content.text.length === 0 || content.blob !== undefined) {
      throw new Error(`MCP App resource ${input.binding.resourceURI} must contain one non-empty HTML text item`)
    }
    const listed = validateResourceMetadata(listedMetadata)
    const item = validateResourceMetadata(content._meta?.ui)
    const metadata = validateResourceMetadata({
      ...listed,
      ...item,
      csp: { ...(listed.csp ?? {}), ...(item.csp ?? {}) },
      permissions: { ...(listed.permissions ?? {}), ...(item.permissions ?? {}) },
    })
    return publishInteractiveArtifact({
      sessionID: input.sessionID,
      messageID: input.messageID,
      payload: {
        schemaVersion: "1",
        renderer: "mcp-app@1",
        title: input.binding.tool.title ?? input.binding.tool.name,
        server: {
          id: input.binding.serverID,
          configDigest: input.binding.configDigest,
          authority: input.authority,
        },
        tool: {
          name: input.binding.tool.name,
          definition: input.binding.tool,
          lifecycle,
        },
        resource: {
          uri: input.binding.resourceURI,
          mimeType: RESOURCE_MIME_TYPE,
          html: content.text,
          sha: createHash("sha256").update(content.text).digest("hex"),
          metadata,
        },
      },
    })
  })
}
