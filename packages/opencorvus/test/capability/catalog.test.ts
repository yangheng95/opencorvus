import { describe, expect, test } from "bun:test"
import {
  CapabilityCatalog,
  createCapabilityCatalogSnapshot,
  searchCapabilityCatalog,
  type CapabilityCatalogEntry,
} from "../../src/tool/capability-catalog"
import { memoryProject } from "../fixture/memory"
import { Instance } from "../../src/project/instance"
import { ensureMissionSession } from "../../src/mission/session"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { mkdir } from "node:fs/promises"
import path from "node:path"

function entry(kind: "mcp_server" | "mcp_tool" | "tool", localRef: string): CapabilityCatalogEntry {
  return {
    ref: {
      kind,
      source: "project",
      owner_ref: "mcp-config",
      local_ref: localRef,
    },
    name: localRef,
    description: `${localRef} capability`,
    aliases: [],
    discoverable_by: ["conversation"],
    availability: "visible",
    next_owner:
      kind === "mcp_tool" || kind === "tool"
        ? { kind: "call_tool", tool_id: localRef }
        : { kind: "open_settings", target: `mcp.${localRef}` },
  }
}

describe("capability catalog executable discovery", () => {
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
        const { caller, snapshot } = await CapabilityCatalog.runtimeSnapshot({
          config: await Config.get(),
          sessionID: mission.id,
          agentID: "mission",
          executionToolIDs: [],
        })
        const results = searchCapabilityCatalog(snapshot, caller, { kinds: ["expert_squad"] })
        expect(results.map((item) => item.ref.local_ref)).toEqual(["base"])
        expect(results[0]?.next_owner).toEqual({ kind: "create_task_with_expert_squad", profile_id: "base" })
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
        const { caller, snapshot } = await CapabilityCatalog.runtimeSnapshot({
          config: await Config.get(),
          sessionID: mission.id,
          agentID: "mission",
          executionToolIDs: [],
        })
        const results = searchCapabilityCatalog(snapshot, caller, { kinds: ["expert_squad"] })
        expect(results.map((item) => item.ref.local_ref)).toEqual(["evolution-lab"])
      },
    })
  }, 0)

  test("searches canonical platform and MCP tools through their shared callable owner kind", () => {
    const sources = [
      {
        owner_ref: "mcp-config",
        revision: "complete-mcp-source",
        entries: [entry("mcp_tool", "computer_session_create"), entry("mcp_server", "computer")],
      },
      {
        owner_ref: "tool-registry",
        revision: "complete-platform-source",
        entries: [
          {
            ...entry("tool", "bash"),
            ref: { kind: "tool" as const, source: "platform" as const, owner_ref: "tool-registry", local_ref: "bash" },
          },
        ],
      },
    ]
    const snapshot = createCapabilityCatalogSnapshot(sources)
    const results = searchCapabilityCatalog(snapshot, "conversation", {
      next_owner_kinds: ["call_tool"],
    })

    expect(snapshot.owner_revisions).toEqual({
      "mcp-config": "complete-mcp-source",
      "tool-registry": "complete-platform-source",
    })
    expect(results.map((item) => [item.ref.kind, item.ref.local_ref])).toEqual([
      ["mcp_tool", "computer_session_create"],
      ["tool", "bash"],
    ])
  })
})
