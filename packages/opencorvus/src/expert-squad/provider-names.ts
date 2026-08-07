import { createHash } from "node:crypto"

function packageProviderName(prefix: string, ref: string): string {
  const hint = ref
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
  const hash = createHash("sha256").update(ref).digest("hex").slice(0, 12)
  return `${prefix}__${hint || "tool"}__${hash}`
}

export function packageToolProviderName(ref: string): string {
  return packageProviderName("pkg_tool", ref)
}

export function packageMcpToolProviderName(ref: string): string {
  return packageProviderName("pkg_mcp_tool", ref)
}

export function packageMcpPromptProviderName(ref: string): string {
  return packageProviderName("pkg_mcp_prompt", ref)
}

export function packageMcpResourceProviderName(ref: string): string {
  return packageProviderName("pkg_mcp_resource", ref)
}

export function defaultToolNameFromRef(ref: string): string {
  const prefix = "default/tool/"
  if (!ref.startsWith(prefix)) throw new Error(`Invalid default tool ref ${JSON.stringify(ref)}`)
  const name = ref.slice(prefix.length)
  if (!name || /[/\\]/.test(name)) throw new Error(`Invalid default tool ref ${JSON.stringify(ref)}`)
  return name
}

export function defaultToolProviderName(ref: string): string {
  return defaultToolNameFromRef(ref)
}

export function defaultMcpToolProviderName(ref: string): string {
  return packageProviderName("default_mcp_tool", ref)
}

export function defaultMcpPromptProviderName(ref: string): string {
  return packageProviderName("default_mcp_prompt", ref)
}

export function defaultMcpResourceProviderName(ref: string): string {
  return packageProviderName("default_mcp_resource", ref)
}
