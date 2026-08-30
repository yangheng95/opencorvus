import z from "zod"

export const CapabilityKind = z.enum([
  "capability_set",
  "skill",
  "tool",
  "mcp_server",
  "mcp_tool",
  "mcp_prompt",
  "mcp_resource",
  "expert_squad",
  "mission_skill",
])
export type CapabilityKind = z.infer<typeof CapabilityKind>

export const CapabilitySource = z.enum(["platform", "project", "package"])
export type CapabilitySource = z.infer<typeof CapabilitySource>

export const CapabilityRef = z
  .object({
    kind: CapabilityKind,
    source: CapabilitySource,
    owner_ref: z.string().trim().min(1),
    local_ref: z.string().trim().min(1),
  })
  .strict()
  .meta({ ref: "CapabilityRef" })
export type CapabilityRef = z.infer<typeof CapabilityRef>

const PREFIX = "capability"

export namespace CapabilityRefCodec {
  export function encode(input: CapabilityRef): string {
    const ref = CapabilityRef.parse(input)
    return [PREFIX, ref.kind, ref.source, encodeURIComponent(ref.owner_ref), encodeURIComponent(ref.local_ref)].join(":")
  }

  export function decode(value: string): CapabilityRef {
    const parts = value.split(":")
    if (parts.length !== 5 || parts[0] !== PREFIX) {
      throw new Error(`Invalid capability reference ${JSON.stringify(value)}.`)
    }
    let ownerRef: string
    let localRef: string
    try {
      ownerRef = decodeURIComponent(parts[3]!)
      localRef = decodeURIComponent(parts[4]!)
    } catch (cause) {
      throw new Error(`Invalid capability reference encoding ${JSON.stringify(value)}.`, { cause })
    }
    const ref = CapabilityRef.parse({
      kind: parts[1],
      source: parts[2],
      owner_ref: ownerRef,
      local_ref: localRef,
    })
    if (encode(ref) !== value) {
      throw new Error(`Capability reference ${JSON.stringify(value)} is not canonical.`)
    }
    return ref
  }
}

export const EncodedCapabilityRef = z.string().superRefine((value, context) => {
  try {
    CapabilityRefCodec.decode(value)
  } catch (error) {
    context.addIssue({ code: "custom", message: error instanceof Error ? error.message : String(error) })
  }
})
export type EncodedCapabilityRef = z.infer<typeof EncodedCapabilityRef>

export function capabilityRef(input: CapabilityRef): CapabilityRef {
  return Object.freeze(CapabilityRef.parse(input))
}
