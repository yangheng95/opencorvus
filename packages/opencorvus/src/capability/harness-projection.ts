import z from "zod"
import { CapabilityKind, CapabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"

const SHA256 = /^[a-f0-9]{64}$/

export const HarnessContext = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("conversation"), agent_id: z.string().trim().min(1) }).strict(),
  z.object({ kind: z.literal("mission") }).strict(),
  z
    .object({
      kind: z.literal("task_scheduler"),
      task_id: z.string().trim().min(1),
      profile_id: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("task_agent"),
      task_id: z.string().trim().min(1),
      profile_id: z.string().trim().min(1),
      agent_id: z.string().trim().min(1),
    })
    .strict(),
])
export type HarnessContext = z.infer<typeof HarnessContext>

export const HarnessGrantAccess = z.enum(["discover", "execute", "discover_execute"])
export type HarnessGrantAccess = z.infer<typeof HarnessGrantAccess>

const INTERNAL_BEHAVIOR_TOOL_IDS = new Set(["skill", "mission_skill"])

/** Loader Tools execute behavior selected through discoverable Skill leaves; they are not Catalog search results. */
export function harnessLeafAccess(ref: CapabilityRef): HarnessGrantAccess {
  const parsed = CapabilityRef.parse(ref)
  if (parsed.kind === "mcp_prompt" || parsed.kind === "mcp_resource") return "discover"
  return parsed.kind === "tool" &&
    parsed.owner_ref === "tool-registry" &&
    INTERNAL_BEHAVIOR_TOOL_IDS.has(parsed.local_ref)
    ? "execute"
    : "discover_execute"
}

export const HarnessGrant = z
  .object({
    ref: CapabilityRef,
    access: HarnessGrantAccess,
    descendant_scope: z.array(CapabilityKind).min(1).optional(),
  })
  .strict()
  .superRefine((grant, context) => {
    if (grant.descendant_scope && grant.ref.kind !== "capability_set" && grant.ref.kind !== "mcp_server") {
      context.addIssue({
        code: "custom",
        path: ["descendant_scope"],
        message: "Only a capability set or MCP server grant may declare descendant scope.",
      })
    }
  })
export type HarnessGrant = z.infer<typeof HarnessGrant>

/** Pre-occurrence owner authority. The Catalog blob does not exist yet. */
export const HarnessGrantSet = z
  .object({
    context: HarnessContext,
    owner_revision: z.string().trim().min(1),
    grants: z.array(HarnessGrant),
    grant_hash: z.string().regex(SHA256),
  })
  .strict()
  .meta({ ref: "HarnessGrantSet" })
export type HarnessGrantSet = z.infer<typeof HarnessGrantSet>

/** Exact occurrence-bound Harness consumed by execution evidence. */
export const HarnessProjection = z
  .object({
    context: HarnessContext,
    owner_revision: z.string().trim().min(1),
    catalog_snapshot_ref: z.string().min(1),
    catalog_snapshot_hash: z.string().regex(SHA256),
    grants: z.array(HarnessGrant),
    projection_hash: z.string().regex(SHA256),
  })
  .strict()
  .meta({ ref: "HarnessProjection" })
export type HarnessProjection = z.infer<typeof HarnessProjection>

function canonicalGrants(raw: readonly HarnessGrant[]): HarnessGrant[] {
  const byRef = new Map<string, HarnessGrant>()
  for (const value of raw) {
    const parsed = HarnessGrant.parse(value)
    const ref = CapabilityRefCodec.encode(parsed.ref)
    if (byRef.has(ref)) throw new Error(`Harness grants contain duplicate capability reference ${ref}.`)
    const descendantScope = parsed.descendant_scope
      ? [...new Set(parsed.descendant_scope)].sort(compareCanonicalStrings)
      : undefined
    byRef.set(ref, {
      ref: Object.freeze({ ...parsed.ref }),
      access: parsed.access,
      ...(descendantScope ? { descendant_scope: Object.freeze(descendantScope) as CapabilityKind[] } : {}),
    })
  }
  return [...byRef.entries()]
    .sort(([left], [right]) => compareCanonicalStrings(left, right))
    .map(([, grant]) => Object.freeze(grant))
}

function freezeGrantSet<T extends HarnessGrantSet | HarnessProjection>(value: T): T {
  return Object.freeze({
    ...value,
    context: Object.freeze({ ...value.context }),
    grants: Object.freeze(value.grants.map((grant) => Object.freeze(grant))),
  }) as T
}

export function createHarnessGrantSet(raw: {
  context: HarnessContext
  owner_revision: string
  grants: readonly HarnessGrant[]
}): HarnessGrantSet {
  const input = {
    context: HarnessContext.parse(raw.context),
    owner_revision: z.string().trim().min(1).parse(raw.owner_revision),
    grants: canonicalGrants(raw.grants),
  }
  return freezeGrantSet(
    HarnessGrantSet.parse({
      ...input,
      grant_hash: canonicalDigestSource("harness-grant-set-v2", input).sha256,
    }),
  )
}

export function bindHarnessProjection(
  grants: HarnessGrantSet,
  binding: { snapshot_ref: string; snapshot_hash: string },
): HarnessProjection {
  const exact = HarnessGrantSet.parse(grants)
  const input = {
    context: exact.context,
    owner_revision: exact.owner_revision,
    catalog_snapshot_ref: z.string().min(1).parse(binding.snapshot_ref),
    catalog_snapshot_hash: z.string().regex(SHA256).parse(binding.snapshot_hash),
    grants: canonicalGrants(exact.grants),
  }
  return freezeGrantSet(
    HarnessProjection.parse({
      ...input,
      projection_hash: canonicalDigestSource("harness-projection-v2", input).sha256,
    }),
  )
}

export function harnessGrantAllows(grant: HarnessGrant, access: "discover" | "execute"): boolean {
  return grant.access === access || grant.access === "discover_execute"
}

export function harnessGrantedRefs(grants: HarnessGrantSet | HarnessProjection, access: "discover" | "execute") {
  return grants.grants.filter((grant) => harnessGrantAllows(grant, access)).map((grant) => grant.ref)
}
