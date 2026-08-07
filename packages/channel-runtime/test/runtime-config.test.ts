import { describe, expect, test } from "bun:test"
import { resolveRuntimeConfig } from "../src/runtime-config"

describe("runtime config", () => {
  test("merges channel profile permission into existing config permission", () => {
    const input = JSON.stringify({
      model: "alibaba-cn/qwen3.5-plus",
      permission: {
        bash: "ask",
      },
    })
    const result = resolveRuntimeConfig(input, "standard")
    const permission = result.config.permission as Record<string, string>
    expect(result.profile).toBe("standard")
    expect(permission.bash).toBe("allow")
    expect(permission["*"]).toBe("deny")
  })

  test("rejects invalid JSON and unknown profile instead of using defaults", () => {
    expect(() => resolveRuntimeConfig("{bad", "standard")).toThrow()
    expect(() => resolveRuntimeConfig(undefined, "unknown_profile")).toThrow(
      "Unknown OPENCORVUS_CHANNEL_PERMISSION_PROFILE",
    )
  })
})
