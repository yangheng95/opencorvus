import { expect, test } from "bun:test"
import { DynamicAgentIDSchema } from "../src/dynamic-agent-id"

test.each(["research-worker", "user-reviewer", "universal-build"])("parses exact worker identity %s", (id) => {
  expect(DynamicAgentIDSchema.parse(id)).toBe(id)
})

test.each(["user", "orchestrator", "shared"])("returns the reserved participant error for %s", (id) => {
  const result = DynamicAgentIDSchema.safeParse(id)
  expect(result).toMatchObject({
    success: false,
    error: { issues: [{ code: "custom", path: [], message: `dynamic agent id "${id}" is reserved` }] },
  })
})
