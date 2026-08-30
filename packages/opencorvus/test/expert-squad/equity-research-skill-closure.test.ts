import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { cp, mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { agentCapabilityGrants, schedulerCapabilityGrants } from "./capability-grant-fixture"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const sourceRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "equity-research")
const skillRefs = ["equity-research/shared/method", "equity-research/shared/workflow"]
const upstreamCommit = "38652224c10610fa52eee2acee3ac712dcff01f2"
const expectedAgents = [
  "equity-research-planner",
  "equity-source-analyst",
  "equity-fundamentals-analyst",
  "equity-valuation-analyst",
  "equity-thesis-analyst",
  "equity-fact-checker",
  "equity-report-writer",
]

let isolatedRoot: string
let isolatedSourceRoot: string

beforeAll(async () => {
  isolatedRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-equity-research-"))
  isolatedSourceRoot = path.join(isolatedRoot, "equity-research")
  await cp(sourceRoot, isolatedSourceRoot, {
    recursive: true,
    filter: (source) => source !== path.join(sourceRoot, "report.md"),
  })
})

afterAll(async () => {
  await resetMemoryDatabase()
  await rm(isolatedRoot, { recursive: true, force: true })
})

describe("Equity Research professional Skill closure", () => {
  test("loads the seven-worker package with complete financial assets and pinned provenance", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(isolatedSourceRoot)
    const method = loaded.packageSkills.get("equity-research/shared/method")!
    const upstream = await readFile(
      path.join(isolatedSourceRoot, "skills", "method", "references", "upstream.md"),
      "utf8",
    )
    const license = await readFile(
      path.join(isolatedSourceRoot, "skills", "method", "references", "upstream-license.txt"),
      "utf8",
    )

    expect([...loaded.packageSkills.keys()].sort()).toEqual(skillRefs)
    expect(method.snapshot.files.map((file) => file.path)).toEqual([
      "assets/investment-research-audit.md",
      "assets/investment-research-charter.md",
      "assets/source-normalization-ledger.md",
      "assets/thesis-catalyst-risk-register.md",
      "assets/valuation-model-checklist.md",
      "references/upstream-license.txt",
      "references/upstream.md",
      "SKILL.md",
    ])
    expect(method.snapshot.files.every((file) => file.bytes > 0)).toBe(true)
    expect(upstream).toContain(`Commit: \`${upstreamCommit}\``)
    expect(upstream).toContain("anthropics/financial-services")
    expect(license).toContain("Apache License")
    expect(license).toContain("Version 2.0, January 2004")
    expect(method.content).toContain(upstreamCommit)
    expect(method.content).toContain("initiating-coverage")
    expect(method.content).toContain("dcf-model")
    expect(method.content).toContain("comps-analysis")
    expect(method.content).toContain("thesis-tracker")
    expect(method.content).toContain("audit-xls")
    expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(expectedAgents)
    expect(schedulerCapabilityGrants(loaded.manifest).packageSkillRefs).toEqual(skillRefs)
    expect(
      expectedAgents.map((agentID) =>
        agentCapabilityGrants(loaded.manifest, agentID).packageSkillRefs,
      ),
    ).toEqual(expectedAgents.map(() => skillRefs))
  })

  test("installs an immutable revision and resolves exact scheduler and worker production grants", async () => {
    await using project = await memoryProject()
    const source = await ExpertSquadRegistry.loadSourcePackage(isolatedSourceRoot)
    const receipt = await ExpertSquadPackageManager.importDirectory({
      projectDirectory: project.path,
      sourceDirectory: isolatedSourceRoot,
      installationScope: "project",
    })

    expect(receipt).toMatchObject({
      operation: "installed",
      after: {
        id: "equity-research",
        version: source.version,
        packageDigest: source.packageDigest,
      },
    })

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({ prompt_profile: { active: "equity-research" } })
        const revision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        expect(revision).toMatchObject({
          id: "equity-research",
          version: source.version,
          packageDigest: source.packageDigest,
        })

        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
        })
        expect(scheduler.productionSkills.map((skill) => skill.ref).sort()).toEqual(skillRefs)

        for (const agentID of expectedAgents) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            packageRevision: revision,
            agentID,
          })
          expect(worker.productionSkills.map((skill) => skill.ref).sort()).toEqual(skillRefs)
        }
      },
    })
  }, 30_000)
})
