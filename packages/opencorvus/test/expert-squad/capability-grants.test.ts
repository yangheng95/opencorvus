import { describe, expect, test } from "bun:test"
import { PlatformCapabilitySetRegistry } from "../../src/agent/platform-capability-sets"
import { materializeExpertSquadCapabilities } from "../../src/expert-squad/capability-grants"
import { ExpertSquadManifestV2Schema, type ExpertSquadManifestV2 } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { capabilityRef, CapabilityRefCodec, type CapabilityRef } from "@opencorvus-ai/util/capability-ref"
import { ToolCapabilityInventory } from "../../src/tool/capability-inventory"
import { promptToolSwitchesForAgentRun } from "../../src/agent/runner"

const encoded = (ref: CapabilityRef) => CapabilityRefCodec.encode(capabilityRef(ref))
const sorted = (refs: CapabilityRef[]) => refs.map(encoded).sort()

function manifest(): ExpertSquadManifestV2 {
  const packageSkill = capabilityRef({
    kind: "skill",
    source: "package",
    owner_ref: "capability-contract",
    local_ref: "capability-contract/shared/method",
  })
  const defaultMcpTool = capabilityRef({
    kind: "mcp_tool",
    source: "project",
    owner_ref: "default-mcp-registry",
    local_ref: "default/mcp/browser/tool/observe",
  })
  return ExpertSquadManifestV2Schema.parse({
    schema_version: 2,
    namespace: "test",
    id: "capability-contract",
    label: "Capability contract",
    version: "2026.08.30.1",
    product_pillars: ["code"],
    readme: "README.md",
    selector: {
      summary: "Exercise typed capability grants.",
      selection_guidance: "Select only for the capability grant contract.",
      instructions: "selector.md",
    },
    capability_sets: {
      "shared-runtime": {
        description: "Shared package Skill and exact Browser MCP leaf.",
        member_refs: sorted([defaultMcpTool, packageSkill]),
      },
    },
    capability_projection: {
      scheduler: {
        base_role: "orchestrator",
        capability_refs: sorted([
          PlatformCapabilitySetRegistry.baseRef({ kind: "scheduler" }),
          PlatformCapabilitySetRegistry.transportRef("scheduler"),
          capabilityRef({
            kind: "capability_set",
            source: "package",
            owner_ref: "capability-contract",
            local_ref: "shared-runtime",
          }),
          capabilityRef({
            kind: "tool",
            source: "platform",
            owner_ref: "tool-registry",
            local_ref: "expert_squad_author",
          }),
        ]),
      },
      agents: {
        worker: {
          label: "Worker",
          base_role: "build",
          capability_refs: [],
        },
      },
      virtual_workflows: {},
    },
  })
}

describe("Expert Squad typed capability grants", () => {
  test("publishes the complete core Tool inventory and every platform CapabilitySet", () => {
    const inventory = ToolCapabilityInventory.snapshot()
    expect(inventory.toolIDs).toHaveLength(61)
    expect(inventory.sets.map((set) => CapabilityRefCodec.encode(set.ref))).toEqual(
      PlatformCapabilitySetRegistry.all().map((set) => CapabilityRefCodec.encode(set.ref)),
    )
    expect(new Set(inventory.sets.flatMap((set) => set.member_refs.map(CapabilityRefCodec.encode))).size).toBeGreaterThan(
      0,
    )
  })

  test("expands the explicitly declared scheduler base and transport sets once", () => {
    const source = manifest()
    const grants = materializeExpertSquadCapabilities({
      manifest: source,
      projection: source.capability_projection.scheduler,
      runtime: { kind: "scheduler" },
      context: "capability_projection.scheduler",
    })
    const expectedTools = [
      ...PlatformCapabilitySetRegistry.get(PlatformCapabilitySetRegistry.baseRef({ kind: "scheduler" })).member_refs,
      ...PlatformCapabilitySetRegistry.get(PlatformCapabilitySetRegistry.transportRef("scheduler")).member_refs,
      capabilityRef({
        kind: "tool",
        source: "platform",
        owner_ref: "tool-registry",
        local_ref: "expert_squad_author",
      }),
    ]
      .map((ref) => ref.local_ref)
      .sort()

    expect(grants.builtInToolIDs).toEqual(expectedTools)
    expect(grants.explicitBuiltInToolIDs).toEqual(["expert_squad_author"])
    expect(grants.packageSkillRefs).toEqual(["capability-contract/shared/method"])
    expect(grants.defaultMcpToolRefs).toEqual(["default/mcp/browser/tool/observe"])
  })

  test("keeps base_role as an upper bound while still appending worker transport", () => {
    const source = manifest()
    const grants = materializeExpertSquadCapabilities({
      manifest: source,
      projection: source.capability_projection.agents.worker!,
      runtime: { kind: "worker", baseRole: "build" },
      context: "capability_projection.agents.worker",
    })
    expect(grants.builtInToolIDs).toEqual(
      PlatformCapabilitySetRegistry.get(PlatformCapabilitySetRegistry.transportRef("worker"))
        .member_refs.map((ref) => ref.local_ref)
        .sort(),
    )
    expect(grants.explicitBuiltInToolIDs).toEqual([])
  })

  test("treats direct and package-set Tool leaves as equally explicit", () => {
    const websearch = capabilityRef({
      kind: "tool",
      source: "platform",
      owner_ref: "tool-registry",
      local_ref: "websearch",
    })
    const packageSetRef = capabilityRef({
      kind: "capability_set",
      source: "package",
      owner_ref: "capability-contract",
      local_ref: "explicit-search",
    })
    const packageSetSource = manifest()
    packageSetSource.capability_sets["explicit-search"] = {
      description: "Explicit search Tool grant.",
      member_refs: [encoded(websearch)],
    }
    packageSetSource.capability_projection.agents.worker!.capability_refs = [encoded(packageSetRef)]
    const parsedPackageSetSource = ExpertSquadManifestV2Schema.parse(packageSetSource)
    const packageSetGrants = materializeExpertSquadCapabilities({
      manifest: parsedPackageSetSource,
      projection: parsedPackageSetSource.capability_projection.agents.worker!,
      runtime: { kind: "worker", baseRole: "build" },
      context: "capability_projection.agents.worker",
    })

    const directSource = manifest()
    directSource.capability_projection.agents.worker!.capability_refs = [encoded(websearch)]
    const parsedDirectSource = ExpertSquadManifestV2Schema.parse(directSource)
    const directGrants = materializeExpertSquadCapabilities({
      manifest: parsedDirectSource,
      projection: parsedDirectSource.capability_projection.agents.worker!,
      runtime: { kind: "worker", baseRole: "build" },
      context: "capability_projection.agents.worker",
    })

    expect(packageSetGrants.explicitBuiltInToolIDs).toEqual(["websearch"])
    expect(packageSetGrants.explicitBuiltInToolIDs).toEqual(directGrants.explicitBuiltInToolIDs)
    expect(
      promptToolSwitchesForAgentRun({
        extraToolNames: [...packageSetGrants.builtInToolIDs],
        explicitProjectedToolNames: packageSetGrants.explicitBuiltInToolIDs,
        role: "build",
      }).websearch,
    ).toBe(true)
  })

  test("lets one explicit Tool leaf override the matching platform base grant", () => {
    const source = manifest()
    source.capability_projection.agents.worker!.capability_refs = sorted([
      PlatformCapabilitySetRegistry.baseRef({ kind: "worker", baseRole: "build" }),
      capabilityRef({
        kind: "tool",
        source: "platform",
        owner_ref: "tool-registry",
        local_ref: "websearch",
      }),
    ])
    const parsed = ExpertSquadManifestV2Schema.parse(source)
    const grants = materializeExpertSquadCapabilities({
      manifest: parsed,
      projection: parsed.capability_projection.agents.worker!,
      runtime: { kind: "worker", baseRole: "build" },
      context: "capability_projection.agents.worker",
    })

    expect(grants.builtInToolIDs.filter((toolID) => toolID === "websearch")).toEqual(["websearch"])
    expect(grants.explicitBuiltInToolIDs).toEqual(["websearch"])
    expect(
      promptToolSwitchesForAgentRun({
        extraToolNames: [...grants.builtInToolIDs],
        explicitProjectedToolNames: grants.explicitBuiltInToolIDs,
        role: "build",
      }).websearch,
    ).toBe(true)
  })

  test("rejects the same leaf from two explicit projection declarations", () => {
    const websearch = capabilityRef({
      kind: "tool",
      source: "platform",
      owner_ref: "tool-registry",
      local_ref: "websearch",
    })
    const packageSetRef = capabilityRef({
      kind: "capability_set",
      source: "package",
      owner_ref: "capability-contract",
      local_ref: "explicit-search",
    })
    const source = manifest()
    source.capability_sets["explicit-search"] = {
      description: "Explicit search Tool grant.",
      member_refs: [encoded(websearch)],
    }
    source.capability_projection.agents.worker!.capability_refs = sorted([packageSetRef, websearch])
    const parsed = ExpertSquadManifestV2Schema.parse(source)

    expect(() =>
      materializeExpertSquadCapabilities({
        manifest: parsed,
        projection: parsed.capability_projection.agents.worker!,
        runtime: { kind: "worker", baseRole: "build" },
        context: "capability_projection.agents.worker",
      }),
    ).toThrow(/is granted by both/)
  })

  test("reports a mismatched platform base set as an exact projection contract error", () => {
    const source = manifest()
    source.capability_projection.agents.worker!.capability_refs = [
      encoded(PlatformCapabilitySetRegistry.baseRef({ kind: "worker", baseRole: "explore" })),
    ]
    expect(() =>
      materializeExpertSquadCapabilities({
        manifest: source,
        projection: source.capability_projection.agents.worker!,
        runtime: { kind: "worker", baseRole: "build" },
        context: "capability_projection.agents.worker",
      }),
    ).toThrow(/must equal capability:capability_set:platform:tool-registry:build-base/)
  })

  test("reports a missing package set through the manifest v2 schema", () => {
    const source = manifest()
    source.capability_projection.scheduler.capability_refs = sorted([
      capabilityRef({
        kind: "capability_set",
        source: "package",
        owner_ref: source.id,
        local_ref: "missing-set",
      }),
    ])
    expect(() => ExpertSquadManifestV2Schema.parse(source)).toThrow(/references missing package capability set missing-set/)
  })

  test("returns a structured schema result for a malformed encoded ref", () => {
    const source = manifest()
    source.capability_projection.scheduler.capability_refs = ["not-a-capability-ref"]
    const result = ExpertSquadManifestV2Schema.safeParse(source)
    expect(result.success).toBe(false)
    if (result.success) throw new Error("Malformed capability ref unexpectedly passed manifest v2 validation")
    expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(
      "capability_projection.scheduler.capability_refs.0",
    )
  })
})
