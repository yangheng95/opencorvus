export type ProviderToolNameOwner = Readonly<{
  source: "registry" | "mcp" | "projected" | "stage" | "structured"
  ref: string
}>

export class ProviderToolNameCollisionError extends Error {
  override readonly name = "ProviderToolNameCollisionError"

  constructor(
    public readonly provider_name: string,
    public readonly existing_owner: ProviderToolNameOwner,
    public readonly incoming_owner: ProviderToolNameOwner,
  ) {
    super(
      `Provider Tool name ${provider_name} is owned by ${existing_owner.source}:${existing_owner.ref} and cannot also be owned by ${incoming_owner.source}:${incoming_owner.ref}`,
    )
  }
}

/**
 * Final Provider-surface name authority. An exact runtime-contract Tool may shadow an
 * earlier owner, and its projected placeholder may be finalized by the real Registry Tool.
 */
export function admitProviderToolName(
  owners: Map<string, ProviderToolNameOwner>,
  providerName: string,
  incoming: ProviderToolNameOwner,
  options: { declaredRuntimeShadow?: boolean; declaredRuntimeFinalization?: boolean } = {},
): void {
  const existing = owners.get(providerName)
  if (!existing) {
    owners.set(providerName, incoming)
    return
  }
  if (
    options.declaredRuntimeFinalization === true &&
    existing.source === "projected" &&
    incoming.source === "registry"
  ) {
    owners.set(providerName, incoming)
    return
  }
  if (existing.source === incoming.source && existing.ref === incoming.ref) return
  if (
    options.declaredRuntimeShadow === true &&
    existing.source !== "structured" &&
    (incoming.source === "projected" || incoming.source === "stage")
  ) {
    owners.set(providerName, incoming)
    return
  }
  throw new ProviderToolNameCollisionError(providerName, existing, incoming)
}

export function mergeProviderToolMaps<T>(
  groups: readonly {
    source: ProviderToolNameOwner["source"]
    tools: Readonly<Record<string, T>>
    ref(name: string, tool: T): string
  }[],
): Record<string, T> {
  const owners = new Map<string, ProviderToolNameOwner>()
  const result: Record<string, T> = {}
  for (const group of groups) {
    for (const [name, tool] of Object.entries(group.tools)) {
      admitProviderToolName(owners, name, { source: group.source, ref: group.ref(name, tool) })
      result[name] = tool
    }
  }
  return result
}
