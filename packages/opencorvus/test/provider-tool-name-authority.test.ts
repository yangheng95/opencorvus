import { describe, expect, test } from "bun:test"
import {
  admitProviderToolName,
  mergeProviderToolMaps,
  ProviderToolNameCollisionError,
  type ProviderToolNameOwner,
} from "../src/tool/provider-name-authority"

describe("final Provider Tool name authority", () => {
  test("rejects an ordinary MCP Tool colliding with a Browser-owned Tool", () => {
    expect(() =>
      mergeProviderToolMaps([
        { source: "mcp", tools: { browser_navigate: { owner: "ordinary" } }, ref: () => "ordinary:tool" },
        { source: "mcp", tools: { browser_navigate: { owner: "browser" } }, ref: () => "browser:tool" },
      ]),
    ).toThrow(
      expect.objectContaining<Partial<ProviderToolNameCollisionError>>({
        name: "ProviderToolNameCollisionError",
        provider_name: "browser_navigate",
        existing_owner: { source: "mcp", ref: "ordinary:tool" },
        incoming_owner: { source: "mcp", ref: "browser:tool" },
      }),
    )
  })

  test("rejects an MCP Tool colliding with a platform Registry Tool", () => {
    const owners = new Map<string, ProviderToolNameOwner>()
    admitProviderToolName(owners, "capability_search", { source: "registry", ref: "capability_search" })
    expect(() =>
      admitProviderToolName(owners, "capability_search", {
        source: "mcp",
        ref: "search-server:config-digest:tool-digest",
      }),
    ).toThrow(
      expect.objectContaining<Partial<ProviderToolNameCollisionError>>({
        name: "ProviderToolNameCollisionError",
        provider_name: "capability_search",
      }),
    )
  })

  test("allows an explicitly declared runtime-contract owner to shadow", () => {
    const owners = new Map<string, ProviderToolNameOwner>()
    admitProviderToolName(owners, "read", { source: "registry", ref: "read" })
    admitProviderToolName(
      owners,
      "read",
      { source: "stage", ref: "architect:read" },
      { declaredRuntimeShadow: true },
    )
    expect(owners.get("read")).toEqual({ source: "stage", ref: "architect:read" })
  })

  test("finalizes an exact projected runtime Tool with its Registry implementation", () => {
    const owners = new Map<string, ProviderToolNameOwner>()
    admitProviderToolName(owners, "skill", { source: "projected", ref: "runtime:skill" })
    admitProviderToolName(
      owners,
      "skill",
      { source: "registry", ref: "skill" },
      { declaredRuntimeFinalization: true },
    )
    expect(owners.get("skill")).toEqual({ source: "registry", ref: "skill" })
  })

  test("keeps the conditional StructuredOutput response encoder reserved from exact runtime Tools", () => {
    const owners = new Map<string, ProviderToolNameOwner>()
    admitProviderToolName(owners, "StructuredOutput", {
      source: "structured",
      ref: "assistant:message-1:response-encoder",
    })
    expect(() =>
      admitProviderToolName(
        owners,
        "StructuredOutput",
        { source: "projected", ref: "runtime:StructuredOutput" },
        { declaredRuntimeShadow: true },
      ),
    ).toThrow(
      expect.objectContaining<Partial<ProviderToolNameCollisionError>>({
        name: "ProviderToolNameCollisionError",
        provider_name: "StructuredOutput",
        existing_owner: { source: "structured", ref: "assistant:message-1:response-encoder" },
        incoming_owner: { source: "projected", ref: "runtime:StructuredOutput" },
      }),
    )
  })
})
