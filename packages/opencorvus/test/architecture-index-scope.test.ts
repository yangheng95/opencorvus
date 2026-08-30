import { describe, expect, test } from "bun:test"
import path from "node:path"
import { specsIndexTargetBelongsToArchitecture } from "../script/check/architecture-index"

describe("architecture index specs-root scope", () => {
  const specsRoot = path.resolve("specs")
  const architectureRoot = path.join(specsRoot, "current", "architecture")

  test("selects current architecture links for live-authority validation", () => {
    expect(
      specsIndexTargetBelongsToArchitecture({
        target: "current/architecture/17-code-work-agent-platform.md",
        specsRoot,
        architectureRoot,
      }),
    ).toBe(true)
  })

  test("leaves dated-record retention to the records index contract", () => {
    expect(
      specsIndexTargetBelongsToArchitecture({
        target: "records/2026-08/deleted-record.md",
        specsRoot,
        architectureRoot,
      }),
    ).toBe(false)
  })

  test("rejects traversal that only shares the architecture path prefix", () => {
    expect(
      specsIndexTargetBelongsToArchitecture({
        target: "current/architecture/../retired.md",
        specsRoot,
        architectureRoot,
      }),
    ).toBe(false)
  })
})
