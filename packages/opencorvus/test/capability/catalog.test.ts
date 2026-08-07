import { describe, expect, test } from "bun:test"
import {
  createCapabilityCatalogSnapshot,
  searchCapabilityCatalog,
  type CapabilityCatalogEntry,
} from "../../src/capability/catalog"

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
