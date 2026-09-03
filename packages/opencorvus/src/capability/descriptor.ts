import z from "zod"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"
import { CapabilityKind, CapabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"

export const CapabilityCaller = z.enum(["conversation", "mission", "task_scheduler", "task_agent"])
export type CapabilityCaller = z.infer<typeof CapabilityCaller>

export const CapabilityAvailability = z.enum(["visible", "installed_unbound", "requires_auth", "denied", "unavailable"])
export type CapabilityAvailability = z.infer<typeof CapabilityAvailability>

export const CapabilityNextOwnerKind = z.enum([
  "load_skill",
  "call_tool",
  "create_task_with_expert_squad",
  "open_settings",
  "unavailable",
])
export type CapabilityNextOwnerKind = z.infer<typeof CapabilityNextOwnerKind>

export const CapabilityNextOwner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("load_skill"), name: z.string() }).strict(),
  z.object({ kind: z.literal("call_tool"), tool_id: z.string() }).strict(),
  z.object({ kind: z.literal("create_task_with_expert_squad"), profile_id: z.string() }).strict(),
  z.object({ kind: z.literal("open_settings"), target: z.string() }).strict(),
  z.object({ kind: z.literal("unavailable"), reason: z.string() }).strict(),
])
export type CapabilityNextOwner = z.infer<typeof CapabilityNextOwner>

const LeafCapabilityRef = CapabilityRef.refine((ref) => ref.kind !== "capability_set", {
  message: "Capability behavior targets must be leaf references.",
})
const CallableToolRef = CapabilityRef.refine((ref) => ref.kind === "tool" || ref.kind === "mcp_tool", {
  message: "Callable behavior targets must be Tool references.",
})
const PlatformActionToolRef = CapabilityRef.refine((ref) => ref.kind === "tool", {
  message: "Capability action targets must be platform Tool references.",
})
const McpServerRef = LeafCapabilityRef.refine((ref) => ref.kind === "mcp_server", {
  message: "MCP inspection must target an MCP server reference.",
})
const McpPromptRef = LeafCapabilityRef.refine((ref) => ref.kind === "mcp_prompt", {
  message: "MCP prompt behavior must target an MCP prompt reference.",
})
const McpResourceRef = LeafCapabilityRef.refine((ref) => ref.kind === "mcp_resource", {
  message: "MCP resource behavior must target an MCP resource reference.",
})

/** Stable, exact owner behavior. This is intentionally different from the
 * legacy model-facing CapabilityNextOwner navigation contract. */
export const CapabilityBehavior = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("call_tool"), tool_ref: CallableToolRef }).strict(),
  z
    .object({ kind: z.literal("open_skill"), loader_tool_ref: PlatformActionToolRef, name: z.string().trim().min(1) })
    .strict(),
  z
    .object({
      kind: z.literal("open_mission_skill"),
      loader_tool_ref: PlatformActionToolRef,
      name: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("create_task"),
      action_tool_ref: PlatformActionToolRef,
      profile_id: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("inspect_mcp"),
      action_tool_ref: PlatformActionToolRef,
      server_ref: McpServerRef,
    })
    .strict(),
  z
    .object({
      kind: z.literal("open_mcp_prompt"),
      action_tool_ref: PlatformActionToolRef,
      prompt_ref: McpPromptRef,
    })
    .strict(),
  z
    .object({
      kind: z.literal("open_mcp_resource"),
      action_tool_ref: PlatformActionToolRef,
      resource_ref: McpResourceRef,
    })
    .strict(),
  z.object({ kind: z.literal("manage"), action_tool_ref: PlatformActionToolRef }).strict(),
  z.object({ kind: z.literal("unavailable"), reason_code: z.string().trim().min(1).max(120) }).strict(),
])
export type CapabilityBehavior = z.infer<typeof CapabilityBehavior>

/** Stable owner-published semantics. Caller assignment, policy and current
 * availability are deliberately absent; they belong to CapabilityCatalogViewEntry. */
const CapabilityDescriptorMetadata = z
  .object({
    ref: CapabilityRef.refine((ref) => ref.kind !== "capability_set", {
      message: "Capability descriptors must address leaf references.",
    }),
    name: z.string().trim().min(1).max(240),
    description: z.string().max(2_000),
    aliases: z.array(z.string().trim().min(1).max(240)).max(40).default([]),
    search_terms: z.array(z.string().trim().min(1).max(240)).max(40).default([]),
    product_pillars: z.array(z.enum(["code", "work"])).optional(),
    behavior: CapabilityBehavior,
  })
  .strict()

function descriptorMetadataDigest(metadata: z.output<typeof CapabilityDescriptorMetadata>): string {
  return canonicalDigestSource("capability-descriptor-metadata-v2", metadata).sha256
}

export const CapabilityDescriptor = CapabilityDescriptorMetadata.extend({
  metadata_digest: z.string().regex(/^[a-f0-9]{64}$/),
})
  .strict()
  .superRefine((descriptor, context) => {
    const { metadata_digest: _metadataDigest, ...metadata } = descriptor
    const expected = descriptorMetadataDigest(metadata)
    if (descriptor.metadata_digest !== expected) {
      context.addIssue({
        code: "custom",
        path: ["metadata_digest"],
        message: `Capability descriptor metadata digest mismatch: expected ${expected}.`,
      })
    }
  })
export type CapabilityDescriptor = z.infer<typeof CapabilityDescriptor>

export function createCapabilityDescriptor(raw: z.input<typeof CapabilityDescriptorMetadata>): CapabilityDescriptor {
  const parsed = CapabilityDescriptorMetadata.parse(raw)
  const metadata: z.output<typeof CapabilityDescriptorMetadata> = {
    ...parsed,
    aliases: [...new Set(parsed.aliases)].sort(compareCanonicalStrings),
    search_terms: [...new Set(parsed.search_terms)].sort(compareCanonicalStrings),
    ...(parsed.product_pillars
      ? { product_pillars: [...new Set(parsed.product_pillars)].sort(compareCanonicalStrings) }
      : {}),
  }
  return CapabilityDescriptor.parse({
    ...metadata,
    metadata_digest: descriptorMetadataDigest(metadata),
  })
}

export const CapabilityCatalogViewEntry = z
  .object({
    descriptor_ref: CapabilityRef.refine((ref) => ref.kind !== "capability_set", {
      message: "Capability views must address leaf references.",
    }),
    descriptor_digest: z.string().regex(/^[a-f0-9]{64}$/),
    discoverable_by: z.array(CapabilityCaller).min(1),
    availability: CapabilityAvailability,
    next_owner: CapabilityNextOwner,
  })
  .strict()
export type CapabilityCatalogViewEntry = z.infer<typeof CapabilityCatalogViewEntry>

export function createCapabilityCatalogViewEntry(
  raw: z.input<typeof CapabilityCatalogViewEntry>,
): CapabilityCatalogViewEntry {
  const parsed = CapabilityCatalogViewEntry.parse(raw)
  return CapabilityCatalogViewEntry.parse({
    ...parsed,
    discoverable_by: [...new Set(parsed.discoverable_by)].sort(compareCanonicalStrings),
  })
}

export const CapabilitySetDescriptor = z
  .object({
    ref: CapabilityRef.refine((ref) => ref.kind === "capability_set", {
      message: "Capability sets must use capability_set references.",
    }),
    name: z.string().trim().min(1).max(240),
    description: z.string().max(2_000),
    member_refs: z.array(CapabilityRef).max(1_000),
  })
  .strict()
  .superRefine((set, context) => {
    const members = new Set<string>()
    for (let index = 0; index < set.member_refs.length; index++) {
      const ref = set.member_refs[index]!
      if (ref.kind === "capability_set") {
        context.addIssue({
          code: "custom",
          path: ["member_refs", index],
          message: "Capability sets cannot contain another capability set.",
        })
      }
      const encoded = CapabilityRefCodec.encode(ref)
      if (members.has(encoded)) {
        context.addIssue({
          code: "custom",
          path: ["member_refs", index],
          message: `Capability set repeats member ${encoded}.`,
        })
      }
      members.add(encoded)
    }
  })
export type CapabilitySetDescriptor = z.infer<typeof CapabilitySetDescriptor>

export const CapabilityCatalogSource = z
  .object({
    owner_ref: z.string().trim().min(1),
    owner_revision: z.string().trim().min(1),
    descriptors: z.array(CapabilityDescriptor),
    sets: z.array(CapabilitySetDescriptor).default([]),
  })
  .strict()
export type CapabilityCatalogSource = z.infer<typeof CapabilityCatalogSource>

export function createCapabilityCatalogSource(raw: z.input<typeof CapabilityCatalogSource>): CapabilityCatalogSource {
  const parsed = CapabilityCatalogSource.parse(raw)
  const descriptors = [...parsed.descriptors].sort((left, right) =>
    compareCanonicalStrings(CapabilityRefCodec.encode(left.ref), CapabilityRefCodec.encode(right.ref)),
  )
  const sets = [...parsed.sets]
    .map((set) => ({
      ...set,
      member_refs: [...set.member_refs].sort((left, right) =>
        compareCanonicalStrings(CapabilityRefCodec.encode(left), CapabilityRefCodec.encode(right)),
      ),
    }))
    .sort((left, right) =>
      compareCanonicalStrings(CapabilityRefCodec.encode(left.ref), CapabilityRefCodec.encode(right.ref)),
    )
  return CapabilityCatalogSource.parse({ ...parsed, descriptors, sets })
}

export const CapabilityCatalogProjection = z
  .object({
    owner_ref: z.string().trim().min(1),
    projection_revision: z.string().regex(/^[a-f0-9]{64}$/),
    entries: z.array(CapabilityCatalogViewEntry),
  })
  .strict()
export type CapabilityCatalogProjection = z.infer<typeof CapabilityCatalogProjection>

export function createCapabilityCatalogProjection(
  raw: z.input<typeof CapabilityCatalogProjection>,
): CapabilityCatalogProjection {
  const parsed = CapabilityCatalogProjection.parse(raw)
  return CapabilityCatalogProjection.parse({
    ...parsed,
    entries: [...parsed.entries].sort((left, right) =>
      compareCanonicalStrings(
        CapabilityRefCodec.encode(left.descriptor_ref),
        CapabilityRefCodec.encode(right.descriptor_ref),
      ),
    ),
  })
}

export const CapabilityCatalogContext = z
  .object({
    caller: CapabilityCaller,
    context_ref: z.string().trim().min(1),
    context_revision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
export type CapabilityCatalogContext = z.infer<typeof CapabilityCatalogContext>

export const CapabilitySearchInput = z
  .object({
    queries: z.array(z.string().max(500)).min(1).max(4).default([""]),
    kinds: z
      .array(CapabilityKind)
      .max(20)
      .optional()
      .describe(
        'Exact stored capability kinds. All supplied filters are ANDed. "tool" selects platform tools, "mcp_tool" selects Model Context Protocol tools, and "expert_squad" selects held Task owners; omit this field to search across stored kinds.',
      ),
    next_owner_kinds: z
      .array(CapabilityNextOwnerKind)
      .max(20)
      .optional()
      .describe(
        'Exact next-step kinds, ANDed with kinds. Use ["call_tool"] for executable platform or MCP tools. For kinds=["expert_squad"], omit this field or use ["create_task_with_expert_squad"]; call_tool excludes every Expert Squad.',
      ),
    owner_refs: z.array(z.string().trim().min(1).max(320)).max(20).optional(),
    exact_refs: z
      .array(
        CapabilityRef.refine((ref) => ref.kind !== "capability_set", {
          message: "Capability reveal requires exact leaf references.",
        }),
      )
      .max(5)
      .default([]),
    deactivate_refs: z
      .array(
        CapabilityRef.refine((ref) => ref.kind !== "capability_set", {
          message: "Capability deactivation requires exact leaf references.",
        }),
      )
      .max(10)
      .default([]),
    product_pillar: z.enum(["code", "work"]).optional(),
    limit: z.number().int().min(1).max(5).default(5),
  })
  .strict()
  .superRefine((input, context) => {
    for (const field of ["exact_refs", "deactivate_refs"] as const) {
      const refs = input[field].map(CapabilityRefCodec.encode)
      if (new Set(refs).size !== refs.length) {
        context.addIssue({ code: "custom", path: [field], message: `${field} must contain unique references.` })
      }
    }
  })
export type CapabilitySearchInput = z.infer<typeof CapabilitySearchInput>

export const CapabilitySearchFilterDiagnostic = z
  .object({
    code: z.literal("incompatible_structural_filters"),
    requested_kinds: z.array(CapabilityKind).min(1),
    requested_next_owner_kinds: z.array(CapabilityNextOwnerKind).min(1),
    compatible_next_owner_kinds: z.array(CapabilityNextOwnerKind).min(1),
    message: z.string().min(1),
  })
  .strict()
export type CapabilitySearchFilterDiagnostic = z.infer<typeof CapabilitySearchFilterDiagnostic>

export const CapabilitySearchResult = z
  .object({
    ref: CapabilityDescriptor.shape.ref,
    name: CapabilityDescriptor.shape.name,
    description: CapabilityDescriptor.shape.description,
    aliases: CapabilityDescriptor.shape.aliases,
    discoverable_by: CapabilityCatalogViewEntry.shape.discoverable_by,
    product_pillars: CapabilityDescriptor.shape.product_pillars,
    availability: CapabilityCatalogViewEntry.shape.availability,
    next_owner: CapabilityCatalogViewEntry.shape.next_owner,
    catalog_revision: z.string().regex(/^[a-f0-9]{64}$/),
    score: z.number().nullable(),
  })
  .strict()
export type CapabilitySearchResult = z.infer<typeof CapabilitySearchResult>
