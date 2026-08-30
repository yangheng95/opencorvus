import z from "zod"
import { CapabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"

export const HarnessContext = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("conversation"), agent_id: z.enum(["chat", "work"]) }).strict(),
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

const RefList = z.array(CapabilityRef)

export const HarnessProjection = z
  .object({
    context: HarnessContext,
    owner_revision: z.string().trim().min(1),
    tool_refs: RefList,
    skill_refs: RefList,
    mission_skill_refs: RefList,
    mcp_server_refs: RefList,
    mcp_tool_refs: RefList,
    mcp_prompt_refs: RefList,
    mcp_resource_refs: RefList,
    projection_hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .meta({ ref: "HarnessProjection" })
export type HarnessProjection = z.infer<typeof HarnessProjection>

type HarnessProjectionInput = Omit<HarnessProjection, "projection_hash">

function canonicalRefs(refs: readonly CapabilityRef[], label: string): CapabilityRef[] {
  const byID = new Map<string, CapabilityRef>()
  for (const raw of refs) {
    const ref = CapabilityRef.parse(raw)
    const id = CapabilityRefCodec.encode(ref)
    if (byID.has(id)) throw new Error(`${label} contains duplicate capability reference ${id}.`)
    byID.set(id, ref)
  }
  return [...byID.entries()]
    .sort(([left], [right]) => compareCanonicalStrings(left, right))
    .map(([, ref]) => Object.freeze({ ...ref }))
}

function hashProjection(input: HarnessProjectionInput): string {
  return canonicalDigestSource("harness-projection-v1", input).sha256
}

function freezeParsedRefs(refs: CapabilityRef[]): CapabilityRef[] {
  return Object.freeze(refs.map((ref) => Object.freeze({ ...ref }))) as CapabilityRef[]
}

export function createHarnessProjection(raw: HarnessProjectionInput): HarnessProjection {
  const input = {
    context: HarnessContext.parse(raw.context),
    owner_revision: z.string().trim().min(1).parse(raw.owner_revision),
    tool_refs: canonicalRefs(raw.tool_refs, "tool_refs"),
    skill_refs: canonicalRefs(raw.skill_refs, "skill_refs"),
    mission_skill_refs: canonicalRefs(raw.mission_skill_refs, "mission_skill_refs"),
    mcp_server_refs: canonicalRefs(raw.mcp_server_refs, "mcp_server_refs"),
    mcp_tool_refs: canonicalRefs(raw.mcp_tool_refs, "mcp_tool_refs"),
    mcp_prompt_refs: canonicalRefs(raw.mcp_prompt_refs, "mcp_prompt_refs"),
    mcp_resource_refs: canonicalRefs(raw.mcp_resource_refs, "mcp_resource_refs"),
  }
  const parsed = HarnessProjection.parse({
    ...input,
    projection_hash: hashProjection(input),
  })
  return Object.freeze({
    ...parsed,
    context: Object.freeze({ ...parsed.context }),
    tool_refs: freezeParsedRefs(parsed.tool_refs),
    skill_refs: freezeParsedRefs(parsed.skill_refs),
    mission_skill_refs: freezeParsedRefs(parsed.mission_skill_refs),
    mcp_server_refs: freezeParsedRefs(parsed.mcp_server_refs),
    mcp_tool_refs: freezeParsedRefs(parsed.mcp_tool_refs),
    mcp_prompt_refs: freezeParsedRefs(parsed.mcp_prompt_refs),
    mcp_resource_refs: freezeParsedRefs(parsed.mcp_resource_refs),
  }) as HarnessProjection
}
