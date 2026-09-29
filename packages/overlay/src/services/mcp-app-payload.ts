import type { McpUiResourceCsp } from "@modelcontextprotocol/ext-apps/app-bridge"

export const MCP_APP_MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024

function cspSource(values: string[] | undefined, fallback: string): string {
  return values?.length ? values.join(" ") : fallback
}

export function mcpAppContentSecurityPolicy(csp: McpUiResourceCsp | undefined): string {
  const resources = csp?.resourceDomains?.length ? ` ${csp.resourceDomains.join(" ")}` : ""
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' blob:${resources}`,
    `style-src 'unsafe-inline'${resources}`,
    `img-src data: blob:${resources}`,
    `font-src data:${resources}`,
    `media-src data: blob:${resources}`,
    `worker-src blob:${resources}`,
    `connect-src ${cspSource(csp?.connectDomains, "'none'")}`,
    `frame-src ${cspSource(csp?.frameDomains, "'none'")}`,
    `base-uri ${cspSource(csp?.baseUriDomains, "'none'")}`,
    "object-src 'none'",
    "form-action 'none'",
  ].join("; ")
}

function bytesFromBase64(value: string): Uint8Array {
  const decoded = atob(value)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index)
  return bytes
}

export function mcpAppDownloadBytes(resource: { text?: unknown; blob?: unknown }, remainingBytes: number): Uint8Array {
  let payload: Uint8Array | undefined
  if (typeof resource.text === "string") {
    if (resource.text.length > remainingBytes) {
      throw new Error(`MCP App download exceeds ${MCP_APP_MAX_DOWNLOAD_BYTES} bytes`)
    }
    payload = new TextEncoder().encode(resource.text)
  } else if (typeof resource.blob === "string") {
    if (resource.blob.length > Math.ceil(remainingBytes / 3) * 4 + 4) {
      throw new Error(`MCP App download exceeds ${MCP_APP_MAX_DOWNLOAD_BYTES} bytes`)
    }
    payload = bytesFromBase64(resource.blob)
  }
  if (!payload) throw new Error("MCP App download resource has no text or blob content")
  if (payload.byteLength > remainingBytes) {
    throw new Error(`MCP App download exceeds ${MCP_APP_MAX_DOWNLOAD_BYTES} bytes`)
  }
  return payload
}
