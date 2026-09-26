import { describe, expect, test } from "bun:test"
import { CapabilityRules } from "../../src/capability/rules"

describe("capability rules edit family", () => {
  // `Config.Permission` has one `edit` key and no `write` / `patch` /
  // `multiedit` keys, so those Tools can only be denied through `edit`. The
  // mapping used to live inside `disabled` alone, which made the module answer
  // the same question two ways: `disabled(["write"])` denied while
  // `evaluate("write", "*")` fell through to allow. `tool/execution-surface.ts`
  // and `skill/eligibility.ts` both call the `evaluate` form, and the first of
  // those is what removes a Tool from the model-visible table.
  const denyEdit = CapabilityRules.fromConfig({ edit: "deny" })

  test("denies every edit-family Tool through the one config key", () => {
    for (const toolID of ["edit", "write", "patch", "multiedit"]) {
      expect(CapabilityRules.evaluate(toolID, "*", denyEdit).action).toBe("deny")
      expect(CapabilityRules.disabled([toolID], denyEdit).has(toolID)).toBe(true)
    }
  })

  test("agrees between the two entry points for every Tool, denied or not", () => {
    const toolIDs = ["edit", "write", "patch", "multiedit", "read", "bash", "skill"]
    for (const toolID of toolIDs) {
      const evaluated = CapabilityRules.evaluate(toolID, "*", denyEdit).action === "deny"
      expect(CapabilityRules.disabled([toolID], denyEdit).has(toolID)).toBe(evaluated)
    }
  })

  test("leaves subjects outside the edit family alone", () => {
    expect(CapabilityRules.evaluate("read", "*", denyEdit).action).toBe("allow")
    expect(CapabilityRules.evaluate("bash", "npm test", denyEdit).action).toBe("allow")
    expect(CapabilityRules.disabled(["read", "bash"], denyEdit).size).toBe(0)
  })

  test("still resolves a blanket deny written as an explicit pattern rule", () => {
    // The scan `disabled` used to run compared `pattern === "*"` as a literal,
    // so a blanket rule written any other way failed to disable the Tool.
    const denyEverything = CapabilityRules.fromConfig({ edit: { "**": "deny" } })
    expect(CapabilityRules.disabled(["write"], denyEverything).has("write")).toBe(true)
  })
})
