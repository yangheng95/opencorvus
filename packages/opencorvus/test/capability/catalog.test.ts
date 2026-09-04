import { describe, expect, spyOn, test } from "bun:test"
import z from "zod"
import {
  CapabilityCatalogCache,
  CapabilityCatalogContractError,
  CapabilityCatalogSnapshot,
  createCapabilityCatalogSnapshot,
  projectCapabilityCatalogSearch,
  searchCapabilityCatalog,
} from "../../src/capability/catalog"
import {
  CapabilityDescriptor,
  createCapabilityCatalogProjection,
  createCapabilityCatalogSource,
  createCapabilityCatalogViewEntry,
  createCapabilityDescriptor,
  type CapabilityAvailability,
  type CapabilityCatalogProjection,
  type CapabilityCatalogSource,
  type CapabilityDescriptor as CapabilityDescriptorValue,
} from "../../src/capability/descriptor"
import { RuntimeCapabilityCatalog } from "../../src/tool/capability-runtime-catalog"
import { capabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { createHarnessGrantSet } from "../../src/capability/harness-projection"
import { memoryProject } from "../fixture/memory"
import { Instance } from "../../src/project/instance"
import { ensureMissionSession } from "../../src/mission/session"
import { Session } from "../../src/session"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { MissionSkillCatalog } from "../../src/mission-skill/catalog"
import { SkillManager } from "../../src/skill/manager"
import { MCP } from "../../src/mcp"
import { HostSessionMcpRuntime } from "../../src/mcp/host-session-runtime"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const CONTEXT_REVISION = "c".repeat(64)
const PROJECTION_REVISION = "a".repeat(64)

function entry(
  kind: "mcp_server" | "mcp_tool" | "tool",
  localRef: string,
  ownerRef = "mcp-config",
): CapabilityDescriptorValue {
  const ref = capabilityRef({ kind, source: "project", owner_ref: ownerRef, local_ref: localRef })
  return createCapabilityDescriptor({
    ref,
    name: localRef,
    description: `${localRef} capability`,
    aliases: [],
    search_terms: [localRef],
    behavior:
      kind === "mcp_tool" || kind === "tool"
        ? { kind: "call_tool", tool_ref: ref }
        : { kind: "unavailable", reason_code: "mcp_server_managed_in_settings" },
  })
}

function context(revision = CONTEXT_REVISION) {
  return { caller: "conversation" as const, context_ref: "conversation:work", context_revision: revision }
}

function source(
  ownerRef: string,
  ownerRevision: string,
  descriptors: CapabilityDescriptorValue[],
): CapabilityCatalogSource {
  return createCapabilityCatalogSource({
    owner_ref: ownerRef,
    owner_revision: ownerRevision,
    descriptors,
    sets: [],
  })
}

function projection(
  ownerRef: string,
  descriptors: CapabilityDescriptorValue[],
  options?: { revision?: string; availability?: CapabilityAvailability },
): CapabilityCatalogProjection {
  return createCapabilityCatalogProjection({
    owner_ref: ownerRef,
    projection_revision: options?.revision ?? PROJECTION_REVISION,
    entries: descriptors.map((descriptor) =>
      createCapabilityCatalogViewEntry({
        descriptor_ref: descriptor.ref,
        descriptor_digest: descriptor.metadata_digest,
        discoverable_by: ["conversation"],
        availability: options?.availability ?? "visible",
        next_owner:
          descriptor.ref.kind === "mcp_server"
            ? { kind: "open_settings", target: `mcp.${descriptor.ref.local_ref}` }
            : { kind: "call_tool", tool_id: descriptor.ref.local_ref },
      }),
    ),
  })
}

describe("capability catalog executable discovery", () => {
  test("empty structural filters preserve the authorized view for every caller", () => {
    const tools = [entry("tool", "read", "tool-registry"), entry("tool", "write", "tool-registry")]
    const mcp = [entry("mcp_tool", "lookup", "mcp-config")]
    for (const caller of ["conversation", "mission", "task_scheduler", "task_agent"] as const) {
      const projections = [projection("tool-registry", [tools[0]!]), projection("mcp-config", mcp)]
        .map((item) => createCapabilityCatalogProjection({
          ...item,
          entries: item.entries.map((view) => ({ ...view, discoverable_by: [caller] })),
        }))
      const snapshot = createCapabilityCatalogSnapshot({
        context: { ...context(), caller },
        sources: [source("tool-registry", "tools", tools), source("mcp-config", "mcp", mcp)],
        projections,
      })
      for (let mask = 0; mask < 8; mask++) {
        const filters = {
          ...(mask & 1 ? { kinds: [] } : {}),
          ...(mask & 2 ? { next_owner_kinds: [] } : {}),
          ...(mask & 4 ? { owner_refs: [] } : {}),
        }
        expect(searchCapabilityCatalog(snapshot, caller, { queries: [""], ...filters })
          .map((item) => [item.ref.kind, item.ref.local_ref]))
          .toEqual([["mcp_tool", "lookup"], ["tool", "read"]])
      }
      expect(searchCapabilityCatalog(snapshot, caller, {
        queries: ["read"], kinds: ["tool", "mcp_tool"], next_owner_kinds: ["call_tool"], owner_refs: [],
      }).map((item) => item.ref)).toEqual([tools[0]!.ref])
      expect(searchCapabilityCatalog(snapshot, caller, {
        queries: [""], kinds: ["tool"], next_owner_kinds: ["call_tool"], owner_refs: ["tool-registry"],
      }).map((item) => item.ref)).toEqual([tools[0]!.ref])
    }
  })

  test("projects exactly the immutable Mission-held Expert Squad set", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "held-catalog-test",
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const { caller, snapshot } = await RuntimeCapabilityCatalog.snapshot({
          config: await Config.get(),
          sessionID: mission.id,
          agentID: "mission",
          executionToolIDs: [],
          permission: [],
        })
        const results = searchCapabilityCatalog(snapshot, caller, { kinds: ["expert_squad"] })
        expect(results.map((item) => item.ref.local_ref)).toEqual(["base"])
        expect(results[0]?.next_owner).toEqual({ kind: "create_task_with_expert_squad", profile_id: "base" })
        const conflict = projectCapabilityCatalogSearch(snapshot, caller, {
          queries: [""],
          kinds: ["expert_squad"],
          next_owner_kinds: ["call_tool"],
          product_pillar: "code",
        })
        expect(conflict).toEqual({
          results: [],
          filterDiagnostic: {
            code: "incompatible_structural_filters",
            requested_kinds: ["expert_squad"],
            requested_next_owner_kinds: ["call_tool"],
            compatible_next_owner_kinds: ["create_task_with_expert_squad"],
            message:
              'The requested capability kinds are visible, but none have the requested next-owner kinds. Use one of ["create_task_with_expert_squad"] or omit next_owner_kinds.',
          },
        })
        expect(
          projectCapabilityCatalogSearch(snapshot, caller, {
            queries: [""],
            kinds: ["mcp_prompt"],
            next_owner_kinds: ["call_tool"],
          }),
        ).toEqual({ results: [], filterDiagnostic: null })
        expect(snapshot.owner_revisions["expert-squad-registry"]).toMatch(/^[a-f0-9]{64}$/)
        expect(snapshot.descriptors.filter((item) => item.ref.kind === "expert_squad").length).toBeGreaterThan(1)
      },
    })
  }, 0)

  test("uses the canonical project worktree when Mission cwd is a subdirectory", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await ExpertSquadPackageManager.installPayloadPackage({
          projectDirectory: project.path,
          id: "evolution-lab",
          installationScope: "project",
        })
        const missionCwd = path.join(project.path, "mission", "nested")
        await mkdir(missionCwd, { recursive: true })
        const mission = await ensureMissionSession({
          missionID: "subdirectory-catalog-test",
          defaultCwd: missionCwd,
          productPillar: "code",
          heldExpertSquadIDs: ["evolution-lab"],
        })
        const { caller, snapshot } = await RuntimeCapabilityCatalog.snapshot({
          config: await Config.get(),
          sessionID: mission.id,
          agentID: "mission",
          executionToolIDs: [],
          permission: [],
        })
        expect(
          searchCapabilityCatalog(snapshot, caller, { kinds: ["expert_squad"] }).map((item) => item.ref.local_ref),
        ).toEqual(["evolution-lab"])
      },
    })
  }, 0)

  test("searches stable owner descriptors through caller-specific executable views", () => {
    const mcpDescriptors = [entry("mcp_tool", "computer_session_create"), entry("mcp_server", "computer")]
    const platformDescriptors = [entry("tool", "bash", "tool-registry")]
    const snapshot = createCapabilityCatalogSnapshot({
      context: context(),
      sources: [
        source("mcp-config", "complete-mcp-source", mcpDescriptors),
        source("tool-registry", "complete-platform-source", platformDescriptors),
      ],
      projections: [projection("mcp-config", mcpDescriptors), projection("tool-registry", platformDescriptors)],
    })
    const results = searchCapabilityCatalog(snapshot, "conversation", { next_owner_kinds: ["call_tool"] })

    expect(snapshot.owner_revisions).toEqual({
      "mcp-config": "complete-mcp-source",
      "tool-registry": "complete-platform-source",
    })
    expect(platformDescriptors[0]?.behavior).toEqual({
      kind: "call_tool",
      tool_ref: platformDescriptors[0]?.ref,
    })
    expect(results.map((item) => [item.ref.kind, item.ref.local_ref])).toEqual([
      ["mcp_tool", "computer_session_create"],
      ["tool", "bash"],
    ])
  })

  test("canonicalizes input ordering and reuses one immutable project snapshot", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        const descriptors = [entry("mcp_server", "computer"), entry("mcp_tool", "computer_session_create")]
        const published = await CapabilityCatalogCache.publishSource(
          source("mcp-config", "revision-1", [...descriptors].reverse()),
        )
        const first = await CapabilityCatalogCache.publishSnapshot({
          context: context(),
          sources: [published],
          projections: [projection("mcp-config", [...descriptors].reverse())],
        })
        const second = await CapabilityCatalogCache.publishSnapshot({
          context: context(),
          sources: [published],
          projections: [projection("mcp-config", descriptors)],
        })

        expect(second).toBe(first)
        expect(Object.isFrozen(first)).toBe(true)
        expect(Object.isFrozen(first.descriptors)).toBe(true)
        expect(Object.isFrozen(first.views)).toBe(true)
        expect(first.catalog_revision).toMatch(/^[a-f0-9]{64}$/)
      },
    })
  })

  test("content-addresses concurrent runtime composition without a mutation-prone request join", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        const config = await Config.get()
        const session = await Session.create({ kind: "assistant", title: "Concurrent capability Catalog" })
        const request = {
          config,
          sessionID: session.id,
          agentID: "work",
          executionToolIDs: ["capability_search"],
          permission: [],
        }
        const [first, second] = await Promise.all([
          RuntimeCapabilityCatalog.snapshot(request),
          RuntimeCapabilityCatalog.snapshot(request),
        ])

        expect(second.snapshot).toBe(first.snapshot)
        expect(second.snapshot.catalog_revision).toBe(first.snapshot.catalog_revision)
      },
    })
  })

  test("publishes distinct revisions for owner, projection and caller-context changes", () => {
    const descriptor = entry("mcp_server", "computer")
    const first = createCapabilityCatalogSnapshot({
      context: context("1".repeat(64)),
      sources: [source("mcp-config", "owner-revision-1", [descriptor])],
      projections: [projection("mcp-config", [descriptor])],
    })
    const ownerAdvanced = createCapabilityCatalogSnapshot({
      context: context("1".repeat(64)),
      sources: [source("mcp-config", "owner-revision-2", [descriptor])],
      projections: [projection("mcp-config", [descriptor])],
    })
    const projectionAdvanced = createCapabilityCatalogSnapshot({
      context: context("1".repeat(64)),
      sources: [source("mcp-config", "owner-revision-1", [descriptor])],
      projections: [projection("mcp-config", [descriptor], { revision: "b".repeat(64), availability: "unavailable" })],
    })
    const contextAdvanced = createCapabilityCatalogSnapshot({
      context: context("2".repeat(64)),
      sources: [source("mcp-config", "owner-revision-1", [descriptor])],
      projections: [projection("mcp-config", [descriptor])],
    })

    expect(
      new Set([
        first.catalog_revision,
        ownerAdvanced.catalog_revision,
        projectionAdvanced.catalog_revision,
        contextAdvanced.catalog_revision,
      ]).size,
    ).toBe(4)
    expect(first.descriptors).toEqual(projectionAdvanced.descriptors)
    expect(first.views).not.toEqual(projectionAdvanced.views)
  })

  test("maps one owner revision to one exact stable descriptor publication", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        await CapabilityCatalogCache.publishSource(
          source("mcp-config", "fixed-revision", [entry("mcp_server", "computer")]),
        )
        const conflict = CapabilityCatalogCache.publishSource(
          source("mcp-config", "fixed-revision", [entry("mcp_server", "browser")]),
        )
        await expect(conflict).rejects.toMatchObject({
          name: "CapabilityCatalogContractError",
          code: "source_revision_conflict",
        } satisfies Partial<CapabilityCatalogContractError>)
      },
    })
  })

  test("returns exact typed errors for duplicate owners, refs and foreign refs", () => {
    const descriptor = entry("mcp_server", "computer")
    const duplicateOwner = () =>
      createCapabilityCatalogSnapshot({
        context: context(),
        sources: [source("mcp-config", "one", [descriptor]), source("mcp-config", "two", [descriptor])],
        projections: [projection("mcp-config", [descriptor])],
      })
    expect(duplicateOwner).toThrow(expect.objectContaining({ code: "duplicate_owner" }))

    const duplicateRef = () =>
      createCapabilityCatalogSnapshot({
        context: context(),
        sources: [source("mcp-config", "one", [descriptor, descriptor])],
        projections: [projection("mcp-config", [descriptor])],
      })
    expect(duplicateRef).toThrow(expect.objectContaining({ code: "duplicate_ref" }))

    const foreignRef = () =>
      createCapabilityCatalogSnapshot({
        context: context(),
        sources: [source("foreign-owner", "one", [descriptor])],
        projections: [],
      })
    expect(foreignRef).toThrow(expect.objectContaining({ code: "foreign_owner_ref" }))
  })

  test("treats __proto__ as an exact owner identity and detects its duplicate", () => {
    const descriptor = entry("tool", "safe", "__proto__")
    const accepted = createCapabilityCatalogSnapshot({
      context: context(),
      sources: [source("__proto__", "prototype-owner-revision", [descriptor])],
      projections: [projection("__proto__", [descriptor])],
    })
    expect(Object.hasOwn(accepted.owner_revisions, "__proto__")).toBe(true)
    expect(accepted.owner_revisions["__proto__"]).toBe("prototype-owner-revision")
    const parsed = CapabilityCatalogSnapshot.parse(accepted)
    expect(Object.hasOwn(parsed.owner_revisions, "__proto__")).toBe(true)
    expect(parsed.owner_revisions["__proto__"]).toBe("prototype-owner-revision")

    const duplicate = () =>
      createCapabilityCatalogSnapshot({
        context: context(),
        sources: [source("__proto__", "one", [descriptor]), source("__proto__", "two", [descriptor])],
        projections: [projection("__proto__", [descriptor])],
      })
    expect(duplicate).toThrow(expect.objectContaining({ code: "duplicate_owner" }))
  })

  test("content-addresses source cache tuples with embedded NUL characters", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        const first = await CapabilityCatalogCache.publishSource(
          source("owner\u0000a", "b", [entry("tool", "first", "owner\u0000a")]),
        )
        const second = await CapabilityCatalogCache.publishSource(
          source("owner", "a\u0000b", [entry("tool", "second", "owner")]),
        )

        expect(first.owner_ref).toBe("owner\u0000a")
        expect(first.owner_revision).toBe("b")
        expect(second.owner_ref).toBe("owner")
        expect(second.owner_revision).toBe("a\u0000b")
      },
    })
  })

  test("canonicalizes Harness grants across Unicode input order", () => {
    const refs = [
      capabilityRef({ kind: "mcp_tool", source: "project", owner_ref: "Éclair", local_ref: "中" }),
      capabilityRef({ kind: "mcp_tool", source: "project", owner_ref: "apple", local_ref: "éclair" }),
    ]
    const build = (mcpToolRefs: typeof refs) =>
      createHarnessGrantSet({
        context: { kind: "conversation", agent_id: "work" },
        owner_revision: "unicode-owner",
        grants: mcpToolRefs.map((ref) => ({ ref, access: "discover_execute" })),
      })
    const first = build(refs)
    const second = build([...refs].reverse())

    expect(second.grant_hash).toBe(first.grant_hash)
    expect(second.grants.map((grant) => CapabilityRefCodec.encode(grant.ref))).toEqual(
      first.grants.map((grant) => CapabilityRefCodec.encode(grant.ref)),
    )
  })

  test("returns an exact typed contract error for an unknown set member", () => {
    const run = () =>
      createCapabilityCatalogSnapshot({
        context: context(),
        sources: [
          createCapabilityCatalogSource({
            owner_ref: "tool-registry",
            owner_revision: "set-revision",
            descriptors: [],
            sets: [
              {
                ref: capabilityRef({
                  kind: "capability_set",
                  source: "platform",
                  owner_ref: "tool-registry",
                  local_ref: "base",
                }),
                name: "Base",
                description: "Base tools",
                member_refs: [
                  capabilityRef({
                    kind: "tool",
                    source: "platform",
                    owner_ref: "tool-registry",
                    local_ref: "unknown",
                  }),
                ],
              },
            ],
          }),
        ],
        projections: [projection("tool-registry", [])],
      })

    expect(run).toThrow(
      expect.objectContaining({
        name: "CapabilityCatalogContractError",
        code: "unknown_set_member",
      } satisfies Partial<CapabilityCatalogContractError>),
    )
  })

  test("validates non-nested sets, descriptor digests and view digest bindings", () => {
    const nestedSet = () =>
      createCapabilityCatalogSource({
        owner_ref: "tool-registry",
        owner_revision: "nested-set",
        descriptors: [],
        sets: [
          {
            ref: capabilityRef({
              kind: "capability_set",
              source: "platform",
              owner_ref: "tool-registry",
              local_ref: "outer",
            }),
            name: "Outer",
            description: "Outer",
            member_refs: [
              capabilityRef({
                kind: "capability_set",
                source: "platform",
                owner_ref: "tool-registry",
                local_ref: "inner",
              }),
            ],
          },
        ],
      })
    expect(nestedSet).toThrow(z.ZodError)

    const descriptor = entry("mcp_server", "computer")
    const wrongDescriptorDigest = () => CapabilityDescriptor.parse({ ...descriptor, metadata_digest: "0".repeat(64) })
    expect(wrongDescriptorDigest).toThrow(z.ZodError)

    const wrongViewDigest = () =>
      createCapabilityCatalogSnapshot({
        context: context(),
        sources: [source("mcp-config", "digest-owner", [descriptor])],
        projections: [
          createCapabilityCatalogProjection({
            owner_ref: "mcp-config",
            projection_revision: PROJECTION_REVISION,
            entries: [
              createCapabilityCatalogViewEntry({
                descriptor_ref: descriptor.ref,
                descriptor_digest: "0".repeat(64),
                discoverable_by: ["conversation"],
                availability: "visible",
                next_owner: { kind: "open_settings", target: "mcp.computer" },
              }),
            ],
          }),
        ],
      })
    expect(wrongViewDigest).toThrow(expect.objectContaining({ code: "view_digest_mismatch" }))
  })

  test("requires every stable behavior target to resolve to one exact catalog descriptor", () => {
    const skillRef = capabilityRef({
      kind: "skill",
      source: "project",
      owner_ref: "skill-manager",
      local_ref: "review",
    })
    const skill = createCapabilityDescriptor({
      ref: skillRef,
      name: "review",
      description: "Review Skill",
      aliases: [],
      search_terms: [],
      behavior: {
        kind: "open_skill",
        loader_tool_ref: capabilityRef({
          kind: "tool",
          source: "platform",
          owner_ref: "tool-registry",
          local_ref: "skill",
        }),
        name: "review",
      },
    })
    const unresolved = () =>
      createCapabilityCatalogSnapshot({
        context: context(),
        sources: [source("skill-manager", "skill-owner", [skill])],
        projections: [
          createCapabilityCatalogProjection({
            owner_ref: "skill-manager",
            projection_revision: PROJECTION_REVISION,
            entries: [
              createCapabilityCatalogViewEntry({
                descriptor_ref: skillRef,
                descriptor_digest: skill.metadata_digest,
                discoverable_by: ["conversation"],
                availability: "visible",
                next_owner: { kind: "load_skill", name: "review" },
              }),
            ],
          }),
        ],
      })

    expect(unresolved).toThrow(expect.objectContaining({ code: "unknown_behavior_target" }))
  })

  test("exposes exact Skill, Mission Skill and Expert Squad owner revisions", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const [skills, missionSkills, squads] = await Promise.all([
          SkillManager.installedCatalogSnapshot(),
          MissionSkillCatalog.catalogSnapshot(),
          PromptProfileResolver.catalogIndexSnapshot(project.path),
        ])
        expect(skills.revision.length).toBeGreaterThan(0)
        expect(skills.skills.length).toBeGreaterThan(0)
        expect(missionSkills.revision).toMatch(/^[a-f0-9]{64}$/)
        expect(Array.isArray(missionSkills.skills)).toBe(true)
        expect(squads.revision).toMatch(/^[a-f0-9]{64}$/)
        expect(squads.entries.length).toBeGreaterThan(0)

        const issues: MissionSkillCatalog.Issue[] = [
          { kind: "invalid_mission_skill", source: "project", path: "a\u0000b", message: "c" },
          { kind: "invalid_mission_skill", source: "project", path: "a", message: "b\u0000c" },
          { kind: "mission_skill_scan_failed", source: "global", path: "Éclair", message: "中" },
          { kind: "mission_skill_scan_failed", source: "global", path: "éclair", message: "Apple" },
        ]
        const firstMissionOrder = MissionSkillCatalog.canonicalCatalogSnapshot({
          skills: [...missionSkills.skills].reverse(),
          issues,
        })
        const secondMissionOrder = MissionSkillCatalog.canonicalCatalogSnapshot({
          skills: missionSkills.skills,
          issues: [...issues].reverse(),
        })
        expect(secondMissionOrder.revision).toBe(firstMissionOrder.revision)
        expect(secondMissionOrder.issues).toEqual(firstMissionOrder.issues)
      },
    })
  })

  test("projects MCP auth, disabled, failed and unbound states into caller views", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        const config = Config.Info.parse({
          mcp: {
            auth: { type: "remote", transport: "streamable-http", url: "https://auth.example.invalid/mcp" },
            disabled: { enabled: false },
            failed: { type: "remote", transport: "streamable-http", url: "https://failed.example.invalid/mcp" },
            idle: { type: "remote", transport: "streamable-http", url: "https://idle.example.invalid/mcp" },
          },
          primary_assistant_capabilities: {
            chat: { skill_refs: [], mcp_server_refs: ["auth", "disabled", "failed"] },
          },
        })
        const observed = spyOn(MCP, "observedCatalogSnapshot").mockResolvedValue(
          Object.freeze({
            owner_revision: "d".repeat(64),
            config_digest: "e".repeat(64),
            provenance: "runtime_observed" as const,
            tool_ids: Object.freeze([]),
            tool_bindings: Object.freeze({}),
            inventory_revision_vector: Object.freeze({}),
            statuses: Object.freeze({
              auth: Object.freeze({ status: "needs_auth" as const }),
              disabled: Object.freeze({ status: "disabled" as const }),
              failed: Object.freeze({ status: "failed" as const, error: "connection failed" }),
              idle: Object.freeze({ status: "disconnected" as const }),
            }),
          }),
        )
        const prepared = spyOn(HostSessionMcpRuntime, "prepareCatalog").mockResolvedValue()
        try {
          const session = await Session.create({ kind: "assistant", title: "MCP status Catalog" })
          const { caller, snapshot } = await RuntimeCapabilityCatalog.snapshot({
            config,
            sessionID: session.id,
            agentID: "chat",
            executionToolIDs: ["capability_search"],
            permission: [],
          })
          const states = Object.fromEntries(
            searchCapabilityCatalog(snapshot, caller, { kinds: ["mcp_server"] }).map((item) => [
              item.ref.local_ref,
              item.availability,
            ]),
          )
          expect(states).toEqual({
            auth: "requires_auth",
            disabled: "unavailable",
            failed: "unavailable",
            idle: "installed_unbound",
          })
          expect(snapshot.owner_revisions["mcp-config"]).toBe("d".repeat(64))
        } finally {
          prepared.mockRestore()
          observed.mockRestore()
        }
      },
    })
  })

  test("projects exact Host Session authentication and failure status instead of an empty visible inventory", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        const config = Config.Info.parse({
          mcp: {
            host_auth: { type: "remote", transport: "streamable-http", url: "https://auth.example.invalid/mcp" },
            host_failed: { type: "remote", transport: "streamable-http", url: "https://failed.example.invalid/mcp" },
          },
        })
        const session = await Session.create({ kind: "assistant", title: "Exact Host MCP status" })
        const statuses = new Map([
          ["host_auth", { status: "needs_auth" as const }],
          ["host_failed", { status: "failed" as const, error: "sanitized fixture failure" }],
        ])
        const owners = new Map<string, MCP.ScopedConnectionOwner>()
        const createOwner = spyOn(MCP, "createScopedConnectionOwner").mockImplementation((id) => {
          const serverID = id.split(":mcp:").at(-1)!
          const status = statuses.get(serverID)
          if (!status) throw new Error(`No status fixture for ${serverID}.`)
          const owner: MCP.ScopedConnectionOwner = {
            id,
            catalogSnapshot: () => ({
              owner_id: id,
              owner_revision: serverID === "host_auth" ? "a".repeat(64) : "b".repeat(64),
              entries: [
                {
                  server_id: serverID,
                  connection_identity: id,
                  config_digest: "c".repeat(64),
                  inventory_revision: "d".repeat(64),
                  status,
                },
              ],
            }),
            close: async () => {},
          }
          owners.set(id, owner)
          return owner
        })
        const inspect = spyOn(MCP, "inspectScopedCapabilitySnapshot").mockRejectedValue(
          new Error("fixture inspection did not produce an inventory"),
        )
        const harness = createHarnessGrantSet({
          context: { kind: "conversation", agent_id: "chat" },
          owner_revision: "host-status-harness",
          grants: [...statuses.keys()].map((serverID) => ({
            ref: capabilityRef({
              kind: "mcp_server" as const,
              source: "project" as const,
              owner_ref: "mcp-config",
              local_ref: serverID,
            }),
            access: "discover_execute" as const,
            descendant_scope: ["mcp_tool" as const, "mcp_prompt" as const, "mcp_resource" as const],
          })),
        })
        try {
          const catalog = await RuntimeCapabilityCatalog.snapshot({
            config,
            sessionID: session.id,
            agentID: "chat",
            executionToolIDs: ["capability_search"],
            harnessGrants: harness,
            permission: [],
          })
          expect({
            states: searchCapabilityCatalog(catalog.snapshot, catalog.caller, { kinds: ["mcp_server"] })
              .map((entry) => [entry.ref.local_ref, entry.availability])
              .sort(),
            owners: [...owners.keys()].sort(),
          }).toEqual({
            states: [
              ["host_auth", "requires_auth"],
              ["host_failed", "unavailable"],
            ],
            owners: [
              `session:${session.id}:mcp:host_auth`,
              `session:${session.id}:mcp:host_failed`,
            ],
          })
        } finally {
          inspect.mockRestore()
          createOwner.mockRestore()
        }
      },
    })
  })

  test("keeps MCP owner inventory stable while different Harness projections select different tools", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        const config = Config.Info.parse({
          mcp: {
            exact: { type: "remote", transport: "streamable-http", url: "https://exact.example.invalid/mcp" },
          },
          primary_assistant_capabilities: {
            chat: { skill_refs: [], mcp_server_refs: [] },
          },
        })
        const observed = spyOn(MCP, "observedCatalogSnapshot").mockResolvedValue(
          Object.freeze({
            owner_revision: "f".repeat(64),
            config_digest: "e".repeat(64),
            provenance: "runtime_observed" as const,
            statuses: Object.freeze({ exact: Object.freeze({ status: "connected" as const }) }),
            tool_ids: Object.freeze(["exact_one", "exact_two"]),
            tool_bindings: Object.freeze({}),
            inventory_revision_vector: Object.freeze({ exact: "1".repeat(64) }),
          }),
        )
        const harness = (toolID: string) =>
          createHarnessGrantSet({
            context: { kind: "conversation", agent_id: "chat" },
            owner_revision: `harness-${toolID}`,
            grants: [
              capabilityRef({ kind: "mcp_server", source: "project", owner_ref: "mcp-config", local_ref: "exact" }),
              capabilityRef({ kind: "mcp_tool", source: "project", owner_ref: "mcp-config", local_ref: toolID }),
            ].map((ref) => ({ ref, access: "discover_execute" })),
          })
        try {
          const [firstSession, secondSession] = await Promise.all([
            Session.create({ kind: "assistant", title: "MCP projection one" }),
            Session.create({ kind: "assistant", title: "MCP projection two" }),
          ])
          const first = await RuntimeCapabilityCatalog.snapshot({
            config,
            sessionID: firstSession.id,
            agentID: "chat",
            executionToolIDs: ["exact_one"],
            harnessGrants: harness("exact_one"),
            permission: [],
          })
          const second = await RuntimeCapabilityCatalog.snapshot({
            config,
            sessionID: secondSession.id,
            agentID: "chat",
            executionToolIDs: ["exact_two"],
            harnessGrants: harness("exact_two"),
            permission: [],
          })

          expect(first.snapshot.descriptors.filter((item) => item.ref.kind === "mcp_tool").length).toBe(2)
          expect(second.snapshot.descriptors.filter((item) => item.ref.kind === "mcp_tool").length).toBe(2)
          expect(searchCapabilityCatalog(first.snapshot, first.caller, { kinds: ["mcp_tool"] })[0]?.ref.local_ref).toBe(
            "exact_one",
          )
          expect(
            searchCapabilityCatalog(second.snapshot, second.caller, { kinds: ["mcp_tool"] })[0]?.ref.local_ref,
          ).toBe("exact_two")
          expect(first.snapshot.owner_revisions["mcp-config"]).toBe("f".repeat(64))
          expect(second.snapshot.owner_revisions["mcp-config"]).toBe("f".repeat(64))
        } finally {
          observed.mockRestore()
        }
      },
    })
  })

  test("publishes config-only MCP provenance and hashes the complete configured identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const firstConfig = Config.Info.parse({
          mcp: {
            enabled: { type: "remote", transport: "streamable-http", url: "https://first.example.invalid/mcp" },
            disabled: { enabled: false },
          },
        })
        const secondConfig = Config.Info.parse({
          mcp: {
            enabled: { type: "remote", transport: "streamable-http", url: "https://second.example.invalid/mcp" },
            disabled: { enabled: false },
          },
        })
        const first = await MCP.observedCatalogSnapshot(firstConfig)
        const second = await MCP.observedCatalogSnapshot(secondConfig)

        expect(first.provenance).toBe("config_only")
        expect(first.statuses).toEqual({ enabled: { status: "disconnected" }, disabled: { status: "disabled" } })
        expect(first.config_digest).toMatch(/^[a-f0-9]{64}$/)
        expect(first.owner_revision).toMatch(/^[a-f0-9]{64}$/)
        expect(second.config_digest).not.toBe(first.config_digest)
        expect(second.owner_revision).not.toBe(first.owner_revision)
        expect(Object.keys(first).sort()).toEqual([
          "config_digest",
          "inventory_revision_vector",
          "owner_revision",
          "provenance",
          "statuses",
          "tool_bindings",
          "tool_ids",
        ])
        expect(first.tool_ids).toEqual([])

        const unicodeEntries = [
          ["Éclair", { enabled: false }],
          ["apple", { enabled: false }],
          ["中", { enabled: false }],
          ["éclair", { enabled: false }],
        ] as const
        const unicodeFirst = await MCP.observedCatalogSnapshot(
          Config.Info.parse({ mcp: Object.fromEntries(unicodeEntries) }),
        )
        const unicodeSecond = await MCP.observedCatalogSnapshot(
          Config.Info.parse({ mcp: Object.fromEntries([...unicodeEntries].reverse()) }),
        )
        expect(unicodeSecond.config_digest).toBe(unicodeFirst.config_digest)
        expect(unicodeSecond.owner_revision).toBe(unicodeFirst.owner_revision)
      },
    })
  })

  test("canonicalizes scoped MCP catalog tuples containing NUL in either identity field", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Mcp.parse({
          type: "local",
          command: [process.execPath, "-e", "process.exit(0)"],
          enabled: false,
        })
        const inputs = [
          { key: "a\u0000b", connectionIdentity: "c" },
          { key: "a", connectionIdentity: "b\u0000c" },
          { key: "Éclair", connectionIdentity: "中" },
          { key: "éclair", connectionIdentity: "Apple" },
        ] as const
        const publish = async (owner: MCP.ScopedConnectionOwner, input: (typeof inputs)[number]) => {
          await expect(
            MCP.inspectScopedCapabilities({
              ...input,
              mcp: config,
              cwd: project.path,
              connectionOwner: owner,
              processAuthority: MCP.hostProcessAuthority(project.path),
            }),
          ).rejects.toThrow("did not connect: disabled")
        }
        const first = MCP.createScopedConnectionOwner("nul-canonical-owner")
        const second = MCP.createScopedConnectionOwner("nul-canonical-owner")
        try {
          for (const input of inputs) await publish(first, input)
          for (const input of [...inputs].reverse()) await publish(second, input)
          const firstSnapshot = first.catalogSnapshot()
          const secondSnapshot = second.catalogSnapshot()

          expect(firstSnapshot.entries.map((entry) => [entry.server_id, entry.connection_identity])).toEqual(
            secondSnapshot.entries.map((entry) => [entry.server_id, entry.connection_identity]),
          )
          expect(secondSnapshot.owner_revision).toBe(firstSnapshot.owner_revision)
        } finally {
          await Promise.all([first.close(), second.close()])
        }
      },
    })
  })
})
