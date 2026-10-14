import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { renderPortableExpertSquadTemplateFiles } from "../script/generate-portable-expert-squad-template"
import { ExpertSquadManifestV2Schema } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { schedulerCapabilityGrants } from "./expert-squad/capability-grant-fixture"

describe("portable Expert Squad scheduler template", () => {
  test("hands capability-matched criteria and tools to acceptance identities", async () => {
    const rendered = renderPortableExpertSquadTemplateFiles()
    const scheduler = rendered["package/agents/orchestrator/system.md"]

    expect(scheduler).toContain("inventory every Task element")
    expect(scheduler).toContain("stable individually falsifiable Requirement and Slice-local acceptance criteria")
    expect(scheduler).toContain("exact canonical RequirementSet and planning/acceptance Artifacts")
    expect(scheduler).toContain("every owned criterion's passed, failed, or unresolved status")
    expect(scheduler).toContain("exact current projected Agent and Tool inventory")
    expect(scheduler).toContain("dispatch only an Agent whose projection exposes it")
    expect(scheduler).toContain("missing fact as discovery work owned by a capable Agent")
    expect(scheduler).toContain("freeze a finite candidate ledger")
    expect(scheduler).toContain("forbid synonymous expansion")
    expect(scheduler).toContain("source-derived action matrix with one row per in-scope entity")
    expect(scheduler).toContain("independently rebuild the same finite candidate ledger and action matrix")
    expect(scheduler).toContain("omitted, extra, surrogate, or rule-precedence failures")
    const manifest = ExpertSquadManifestV2Schema.parse(Bun.JSONC.parse(rendered["package/expert-squad.jsonc"]!))
    expect({
      version: manifest.version,
      dispatch: schedulerCapabilityGrants(manifest).builtInToolIDs.filter((id) => id.startsWith("dispatch_")),
    }).toEqual({ version: "2026.10.14.1", dispatch: ["dispatch_agents"] })

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

    for (const [relativePath, expected] of Object.entries(rendered)) {
      const tracked = await fs.readFile(
        path.resolve(import.meta.dir, "../../../templates/portable-expert-squad-template", relativePath),
        "utf8",
      )
      expect(tracked).toBe(expected)
    }
  })
})
