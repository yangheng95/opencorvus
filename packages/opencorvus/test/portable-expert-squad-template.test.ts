import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { renderPortableExpertSquadTemplateFiles } from "../script/generate-portable-expert-squad-template"

describe("portable Expert Squad scheduler template", () => {
  test("hands canonical decomposed acceptance criteria to acceptance identities", async () => {
    const rendered = renderPortableExpertSquadTemplateFiles()
    const scheduler = rendered["package/agents/orchestrator/system.md"]

    expect(scheduler).toContain("inventory every Task element")
    expect(scheduler).toContain("stable individually falsifiable Requirement and Slice-local acceptance criteria")
    expect(scheduler).toContain("exact canonical RequirementSet and planning/acceptance Artifacts")
    expect(scheduler).toContain("report every owned criterion as passed, failed, or unresolved")
    expect(rendered["package/expert-squad.jsonc"]).toContain('"version": "2026.08.21.1"')

    const trackedScheduler = await fs.readFile(
      path.resolve(import.meta.dir, "../../../templates/portable-expert-squad-template/package/agents/orchestrator/system.md"),
      "utf8",
    )
    const trackedManifest = await fs.readFile(
      path.resolve(import.meta.dir, "../../../templates/portable-expert-squad-template/package/expert-squad.jsonc"),
      "utf8",
    )
    expect(trackedScheduler).toBe(scheduler)
    expect(trackedManifest).toBe(rendered["package/expert-squad.jsonc"])
  })
})
