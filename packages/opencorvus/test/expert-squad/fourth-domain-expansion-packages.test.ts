import { afterAll, describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packages = [
  {
    id: "aviation-maintenance-reliability",
    roots: [
      "aircraft-configuration-records-analyst",
      "maintenance-reliability-analyst",
      "maintenance-planning-airworthiness-analyst",
    ],
    join: "aviation-maintenance-reliability-owner",
    assets: [
      "assets/aircraft-configuration-life-limited-parts-ledger.md",
      "assets/airworthiness-review-decision-pack.md",
      "assets/due-deferred-work-planning-register.md",
      "assets/maintenance-event-defect-reliability-register.md",
      "assets/program-task-ad-sb-applicability-trace.md",
    ],
    terms: ["flight hours", "cycles", "configuration", "airworthiness", "return to service"],
  },
  {
    id: "semiconductor-yield-engineering",
    roots: [
      "yield-genealogy-data-quality-analyst",
      "wafer-spatial-bin-parametric-analyst",
      "process-spc-excursion-analyst",
    ],
    join: "semiconductor-yield-excursion-owner",
    assets: [
      "assets/excursion-hypothesis-containment-experiment-register.md",
      "assets/lot-wafer-die-genealogy-ledger.md",
      "assets/spc-tool-chamber-tester-comparison.md",
      "assets/yield-bin-parametric-wafer-map-register.md",
      "assets/yield-review-decision-pack.md",
    ],
    terms: ["first pass", "eligible", "wafer", "control limit", "spatial"],
  },
  {
    id: "climate-risk-adaptation",
    roots: [
      "climate-hazard-scenario-analyst",
      "exposure-vulnerability-consequence-analyst",
      "adaptation-options-pathways-analyst",
    ],
    join: "climate-risk-adaptation-owner",
    assets: [
      "assets/adaptation-options-pathways-trigger-register.md",
      "assets/climate-risk-adaptation-decision-pack.md",
      "assets/climate-risk-horizon-scenario-matrix.md",
      "assets/exposure-vulnerability-dependency-ledger.md",
      "assets/hazard-scenario-source-register.md",
    ],
    terms: ["hazard", "exposure", "vulnerability", "residual risk", "maladaptation"],
  },
  {
    id: "geospatial-analysis-cartography",
    roots: [
      "spatial-data-crs-integrity-analyst",
      "spatial-analysis-raster-vector-analyst",
      "cartographic-design-accessibility-analyst",
    ],
    join: "geospatial-cartography-owner",
    assets: [
      "assets/cartographic-style-label-accessibility-spec.md",
      "assets/map-publication-review-pack.md",
      "assets/raster-vector-resolution-uncertainty-register.md",
      "assets/spatial-operation-provenance-reconciliation.md",
      "assets/spatial-source-crs-geometry-ledger.md",
    ],
    terms: ["coordinate reference system", "datum", "antimeridian", "nodata", "label"],
  },
  {
    id: "cultural-heritage-preservation",
    roots: [
      "heritage-significance-provenance-analyst",
      "heritage-condition-risk-analyst",
      "heritage-digital-access-analyst",
    ],
    join: "heritage-conservation-plan-owner",
    assets: [
      "assets/condition-survey-and-change-log.md",
      "assets/conservation-options-and-approval-plan.md",
      "assets/digital-preservation-and-access-matrix.md",
      "assets/heritage-asset-significance-provenance-register.md",
      "assets/preventive-conservation-risk-register.md",
    ],
    terms: ["provenance", "condition", "deterioration", "checksum", "community"],
  },
  {
    id: "sports-performance-analysis",
    roots: ["training-exposure-load-analyst", "performance-testing-analyst", "availability-wellbeing-analyst"],
    join: "sports-performance-review-owner",
    assets: [
      "assets/athlete-exposure-load-ledger.csv",
      "assets/availability-wellbeing-context-log.md",
      "assets/measurement-reliability-and-change-register.md",
      "assets/performance-review-and-decision-gates.md",
      "assets/performance-test-protocol-and-results.md",
    ],
    terms: ["exposure", "external load", "measurement error", "coefficient of variation", "return to play"],
  },
  {
    id: "clinical-trial-operations",
    roots: [
      "trial-startup-site-readiness-analyst",
      "trial-enrollment-conduct-analyst",
      "trial-data-quality-monitoring-analyst",
      "trial-safety-tmf-closeout-analyst",
    ],
    join: "clinical-trial-operations-review-owner",
    assets: [
      "assets/enrollment-visit-and-deviation-ledger.csv",
      "assets/risk-based-monitoring-and-data-quality-plan.md",
      "assets/safety-event-routing-and-reconciliation-log.md",
      "assets/site-readiness-and-activation-evidence-matrix.md",
      "assets/tmf-closeout-and-operations-review-pack.md",
    ],
    terms: ["protocol", "site readiness", "critical to quality", "safety", "trial master file"],
  },
  {
    id: "media-rights-clearance",
    roots: [
      "media-asset-rights-inventory-analyst",
      "media-license-release-terms-analyst",
      "media-intended-use-risk-analyst",
    ],
    join: "media-clearance-register-owner",
    assets: [
      "assets/chain-of-title-and-release-ledger.md",
      "assets/clearance-decision-obligation-expiry-register.md",
      "assets/license-release-terms-matrix.md",
      "assets/media-component-rights-inventory.md",
      "assets/territory-window-edition-calendar.md",
    ],
    terms: ["chain of title", "permission", "prohibition", "territory", "fair use"],
  },
  {
    id: "emergency-management-continuity",
    roots: [
      "hazard-scenario-assumption-analyst",
      "essential-functions-continuity-analyst",
      "incident-resource-communications-analyst",
      "exercise-improvement-analyst",
    ],
    join: "emergency-continuity-readiness-owner",
    assets: [
      "assets/continuity-strategy-recovery-objective-plan.md",
      "assets/essential-function-dependency-bia-register.md",
      "assets/exercise-aar-improvement-action-register.md",
      "assets/hazard-impact-planning-assumption-register.md",
      "assets/incident-resource-communications-coordination-matrix.md",
    ],
    terms: ["essential function", "recovery time objective", "resource typing", "mutual aid", "exercise"],
  },
  {
    id: "mining-resource-operations",
    roots: [
      "mineral-data-resource-evidence-analyst",
      "mine-planning-grade-control-reconciliation-analyst",
      "processing-metallurgy-water-tailings-analyst",
      "fleet-maintenance-critical-control-analyst",
    ],
    join: "mining-integrated-operations-owner",
    assets: [
      "assets/fleet-maintenance-critical-control-integrated-decision-register.md",
      "assets/geological-data-qaqc-resource-assumption-register.md",
      "assets/mine-plan-grade-control-stockpile-reconciliation.md",
      "assets/plant-metallurgical-accounting-recovery-register.md",
      "assets/water-tailings-environmental-dependency-balance.md",
    ],
    terms: ["quality assurance", "contained metal", "recovery", "tailings", "competent person"],
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Fourth ten-domain Expert Squad package expansion", () => {
  for (const definition of packages) {
    test(
      definition.id + " loads its substantive Skill, assets, worker contracts, and explicit join",
      async () => {
        const root = packageRoot(definition.id)
        const loaded = await ExpertSquadRegistry.loadSourcePackage(root)
        const skillRef = definition.id + "/shared/method"
        const method = loaded.packageSkills.get(skillRef)!
        const agents = loaded.manifest.capability_projection.agents
        const workflows = Object.values(loaded.manifest.capability_projection.virtual_workflows)
        const workflow = workflows[0]!
        const roots = Object.entries(workflow.nodes)
          .filter(([, node]) => node.depends_on.length === 0)
          .map(([id]) => id)
        const assetFiles = method.snapshot.files.filter((file) => file.path.startsWith("assets/"))
        const referenceFiles = method.snapshot.files.filter((file) => file.path.startsWith("references/"))

        expect(loaded.manifest).toMatchObject({
          schema_version: 1,
          namespace: "builtin",
          id: definition.id,
          version: "2026.08.11.1",
        })
        expect([...loaded.packageSkills.keys()]).toEqual([skillRef])
        expect(method.definition.name).toBe(definition.id + "-method")
        expect(method.content.length).toBeGreaterThan(3_000)
        const normalizedMethod = method.content.toLowerCase().replace(/[-/]/g, " ")
        expect(definition.terms.map((term) => normalizedMethod.includes(term))).toEqual(
          definition.terms.map(() => true),
        )
        expect(assetFiles.map((file) => file.path).sort()).toEqual([...definition.assets].sort())
        expect(assetFiles.map((file) => file.bytes > 800)).toEqual(assetFiles.map(() => true))
        expect(referenceFiles.length).toBeGreaterThan(0)
        expect(referenceFiles.map((file) => file.bytes > 400)).toEqual(referenceFiles.map(() => true))
        expect(loaded.manifest.capability_projection.scheduler.package_skill_refs).toEqual([skillRef])
        expect(Object.values(agents).map((agent) => agent.package_skill_refs)).toEqual(
          Object.values(agents).map(() => [skillRef]),
        )
        expect(workflows).toHaveLength(1)
        expect(roots).toEqual([...definition.roots])
        expect([...workflow.nodes[definition.join]!.depends_on].sort()).toEqual([...definition.roots].sort())

        const promptContents = await Promise.all(
          Object.values(agents).map((agent) => readFile(path.join(root, agent.prompt), "utf8")),
        )
        expect(promptContents.map((content) => Buffer.byteLength(content) > 900)).toEqual(
          promptContents.map(() => true),
        )
        expect(
          promptContents.map((content) => {
            const normalized = content.toLowerCase()
            return (
              normalized.includes("input contract") &&
              normalized.includes("domain method") &&
              normalized.includes("evidence output") &&
              normalized.includes("unknown") &&
              normalized.includes("stop") &&
              normalized.includes("authority") &&
              normalized.includes("qualified") &&
              normalized.includes("review")
            )
          }),
        ).toEqual(promptContents.map(() => true))
      },
      30_000,
    )
  }

  test("installs all ten immutable revisions and resolves every scheduler and worker Skill grant", async () => {
    await using project = await memoryProject()
    const loadedPackages = new Map<string, ExpertSquadRegistry.LoadedPackage>()

    for (const definition of packages) {
      const source = await ExpertSquadRegistry.loadSourcePackage(packageRoot(definition.id))
      const receipt = await ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: packageRoot(definition.id),
        replace: false,
        installationScope: "project",
      })
      loadedPackages.set(definition.id, source)
      expect(receipt).toMatchObject({
        operation: "installed",
        after: { id: definition.id, version: source.version, packageDigest: source.packageDigest },
      })
    }

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const definition of packages) {
          const source = loadedPackages.get(definition.id)!
          const config = Config.Info.parse({ prompt_profile: { active: definition.id } })
          const revision = await PromptProfileResolver.resolveActivePackageRevision({
            projectDirectory: project.path,
            config,
          })
          expect(revision).toMatchObject({
            id: definition.id,
            version: source.version,
            packageDigest: source.packageDigest,
          })
          const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
            projectDirectory: project.path,
            config,
            packageRevision: revision,
          })
          const skillRef = definition.id + "/shared/method"
          expect(scheduler.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
            { ref: skillRef, source: "package" },
          ])
          expect(Object.keys(scheduler.virtualWorkflows)).toHaveLength(1)

          for (const agentID of Object.keys(source.manifest.capability_projection.agents)) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
              { ref: skillRef, source: "package" },
            ])
          }
        }
      },
    })
  }, 60_000)
})
