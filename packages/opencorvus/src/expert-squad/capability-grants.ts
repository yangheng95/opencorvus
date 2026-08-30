import { PlatformCapabilitySetRegistry } from "@/agent/platform-capability-sets"
import type { RuntimeTemplateID } from "@/agent/runtime-template-id"
import type { ExpertSquadManifestV2 } from "@opencorvus-ai/sdk/expert-squad-authoring"
import {
  capabilityRef,
  CapabilityRefCodec,
  type CapabilityKind,
  type CapabilityRef,
} from "@opencorvus-ai/util/capability-ref"
import { compareCanonicalStrings } from "@/util/canonical-digest"

type Projection = ExpertSquadManifestV2["capability_projection"]["scheduler"] | ExpertSquadManifestV2["capability_projection"]["agents"][string]

export interface MaterializedExpertSquadCapabilities {
  readonly declaredRefs: readonly CapabilityRef[]
  readonly expandedRefs: readonly CapabilityRef[]
  readonly builtInToolIDs: readonly string[]
  readonly explicitBuiltInToolIDs: readonly string[]
  readonly defaultSkillRefs: readonly string[]
  readonly packageSkillRefs: readonly string[]
  readonly defaultToolRefs: readonly string[]
  readonly packageToolRefs: readonly string[]
  readonly defaultMcpServerRefs: readonly string[]
  readonly packageMcpServerRefs: readonly string[]
  readonly defaultMcpToolRefs: readonly string[]
  readonly packageMcpToolRefs: readonly string[]
  readonly defaultMcpPromptRefs: readonly string[]
  readonly packageMcpPromptRefs: readonly string[]
  readonly defaultMcpResourceRefs: readonly string[]
  readonly packageMcpResourceRefs: readonly string[]
}

interface MutableMaterializedCapabilities {
  declaredRefs: CapabilityRef[]
  expandedRefs: CapabilityRef[]
  builtInToolIDs: string[]
  explicitBuiltInToolIDs: string[]
  defaultSkillRefs: string[]
  packageSkillRefs: string[]
  defaultToolRefs: string[]
  packageToolRefs: string[]
  defaultMcpServerRefs: string[]
  packageMcpServerRefs: string[]
  defaultMcpToolRefs: string[]
  packageMcpToolRefs: string[]
  defaultMcpPromptRefs: string[]
  packageMcpPromptRefs: string[]
  defaultMcpResourceRefs: string[]
  packageMcpResourceRefs: string[]
}

type ProjectionRuntime =
  | { readonly kind: "scheduler" }
  | { readonly kind: "worker"; readonly baseRole: RuntimeTemplateID }

type GrantOrigin = "platform-core" | "platform-base" | "projection" | "transport"

function canonicalRefs(refs: Iterable<CapabilityRef>): CapabilityRef[] {
  return [...refs]
    .map((ref) => Object.freeze({ ...ref }))
    .sort((left, right) =>
      compareCanonicalStrings(CapabilityRefCodec.encode(left), CapabilityRefCodec.encode(right)),
    )
}

function classifyLeaf(
  result: MutableMaterializedCapabilities,
  ref: CapabilityRef,
  explicit: boolean,
  manifestID: string,
  context: string,
) {
  const unsupported = () => {
    throw new Error(`${context}: unsupported Expert Squad capability ref ${CapabilityRefCodec.encode(ref)}`)
  }
  const requireOwner = (source: CapabilityRef["source"], ownerRef: string) => {
    if (ref.source !== source || ref.owner_ref !== ownerRef) unsupported()
  }

  if (ref.kind === "tool") {
    if (ref.source === "package") {
      requireOwner("package", manifestID)
      result.packageToolRefs.push(ref.local_ref)
      return
    }
    if (ref.source === "platform" && ref.owner_ref === "tool-registry") {
      result.builtInToolIDs.push(ref.local_ref)
      if (explicit) result.explicitBuiltInToolIDs.push(ref.local_ref)
      return
    }
    requireOwner("platform", "default-tool-registry")
    result.defaultToolRefs.push(ref.local_ref)
    return
  }

  if (ref.kind === "skill") {
    if (ref.source === "package") {
      requireOwner("package", manifestID)
      result.packageSkillRefs.push(ref.local_ref)
      return
    }
    requireOwner("platform", "skill-manager")
    result.defaultSkillRefs.push(ref.local_ref)
    return
  }

  const classifyMcp = (
    defaultRefs: string[],
    packageRefs: string[],
    kind: Exclude<CapabilityKind, "capability_set" | "skill" | "tool" | "expert_squad" | "mission_skill">,
  ) => {
    if (ref.kind !== kind) return false
    if (ref.source === "package") {
      requireOwner("package", manifestID)
      packageRefs.push(ref.local_ref)
      return true
    }
    requireOwner("project", "default-mcp-registry")
    defaultRefs.push(ref.local_ref)
    return true
  }

  if (classifyMcp(result.defaultMcpServerRefs, result.packageMcpServerRefs, "mcp_server")) return
  if (classifyMcp(result.defaultMcpToolRefs, result.packageMcpToolRefs, "mcp_tool")) return
  if (classifyMcp(result.defaultMcpPromptRefs, result.packageMcpPromptRefs, "mcp_prompt")) return
  if (classifyMcp(result.defaultMcpResourceRefs, result.packageMcpResourceRefs, "mcp_resource")) return
  unsupported()
}

function freezeResult(result: MutableMaterializedCapabilities): MaterializedExpertSquadCapabilities {
  for (const key of Object.keys(result) as Array<keyof MutableMaterializedCapabilities>) {
    const values = result[key]
    if (key === "declaredRefs" || key === "expandedRefs") Object.freeze(values)
    else Object.freeze((values as string[]).sort(compareCanonicalStrings))
  }
  return Object.freeze(result)
}

export function materializeExpertSquadCapabilities(input: {
  readonly manifest: ExpertSquadManifestV2
  readonly projection: Projection
  readonly runtime: ProjectionRuntime
  readonly context: string
}): MaterializedExpertSquadCapabilities {
  const expectedBase = PlatformCapabilitySetRegistry.baseRef(input.runtime)
  const expectedBaseEncoded = CapabilityRefCodec.encode(expectedBase)
  const declaredRefs = input.projection.capability_refs.map(CapabilityRefCodec.decode)
  const effectiveByRef = new Map<string, { ref: CapabilityRef; declaredBy: string; origin: GrantOrigin }>()

  const addLeaf = (ref: CapabilityRef, declaredBy: string, origin: GrantOrigin) => {
    if (ref.kind === "capability_set") {
      throw new Error(`${input.context}: capability set ${declaredBy} contains nested set ${CapabilityRefCodec.encode(ref)}`)
    }
    const encoded = CapabilityRefCodec.encode(ref)
    const previous = effectiveByRef.get(encoded)
    if (previous) {
      const projectionOverridesBase =
        ((previous.origin === "platform-base" || previous.origin === "platform-core") && origin === "projection") ||
        (previous.origin === "projection" && (origin === "platform-base" || origin === "platform-core"))
      if (projectionOverridesBase) {
        if (origin === "projection") effectiveByRef.set(encoded, { ref, declaredBy, origin })
        return
      }
      if (
        (previous.origin === "platform-core" && origin === "platform-base") ||
        (previous.origin === "platform-base" && origin === "platform-core")
      ) {
        if (origin === "platform-base") effectiveByRef.set(encoded, { ref, declaredBy, origin })
        return
      }
      throw new Error(`${input.context}: capability ${encoded} is granted by both ${previous.declaredBy} and ${declaredBy}`)
    }
    effectiveByRef.set(encoded, { ref, declaredBy, origin })
  }

  addLeaf(
    capabilityRef({
      kind: "tool",
      source: "platform",
      owner_ref: "tool-registry",
      local_ref: "capability_search",
    }),
    "platform-core:capability_search",
    "platform-core",
  )

  for (const ref of declaredRefs) {
    const encoded = CapabilityRefCodec.encode(ref)
    if (ref.kind !== "capability_set") {
      addLeaf(ref, encoded, "projection")
      continue
    }
    let members: readonly string[]
    if (ref.source === "package") {
      if (ref.owner_ref !== input.manifest.id) {
        throw new Error(`${input.context}: package capability set owner ${ref.owner_ref} must equal ${input.manifest.id}`)
      }
      const definition = input.manifest.capability_sets[ref.local_ref]
      if (!definition) throw new Error(`${input.context}: unknown package capability set ${encoded}`)
      members = definition.member_refs
    } else {
      if (encoded !== expectedBaseEncoded) {
        throw new Error(`${input.context}: platform capability set ${encoded} must equal ${expectedBaseEncoded}`)
      }
      members = PlatformCapabilitySetRegistry.get(ref).member_refs.map(CapabilityRefCodec.encode)
    }
    const origin: GrantOrigin = ref.source === "package" ? "projection" : "platform-base"
    for (const member of members) addLeaf(CapabilityRefCodec.decode(member), encoded, origin)
  }

  const transportRef = PlatformCapabilitySetRegistry.transportRef(input.runtime.kind)
  const transportEncoded = CapabilityRefCodec.encode(transportRef)
  for (const member of PlatformCapabilitySetRegistry.get(transportRef).member_refs) {
    addLeaf(member, transportEncoded, "transport")
  }

  const result: MutableMaterializedCapabilities = {
    declaredRefs: canonicalRefs(declaredRefs),
    expandedRefs: canonicalRefs([...effectiveByRef.values()].map((entry) => entry.ref)),
    builtInToolIDs: [],
    explicitBuiltInToolIDs: [],
    defaultSkillRefs: [],
    packageSkillRefs: [],
    defaultToolRefs: [],
    packageToolRefs: [],
    defaultMcpServerRefs: [],
    packageMcpServerRefs: [],
    defaultMcpToolRefs: [],
    packageMcpToolRefs: [],
    defaultMcpPromptRefs: [],
    packageMcpPromptRefs: [],
    defaultMcpResourceRefs: [],
    packageMcpResourceRefs: [],
  }
  for (const { ref, origin } of effectiveByRef.values()) {
    classifyLeaf(result, ref, origin === "projection", input.manifest.id, input.context)
  }
  return freezeResult(result)
}
