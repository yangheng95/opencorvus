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
    id: "satellite-mission-operations",
    roots: [
      "spacecraft-telemetry-health-state-analyst",
      "mission-planning-ground-contact-resource-analyst",
      "telecommand-procedure-anomaly-readiness-analyst",
    ],
    join: "satellite-mission-operations-review-owner",
    assets: [
      "assets/ground-contact-mission-plan-resource-schedule.csv",
      "assets/mission-operations-configuration-authority-baseline.md",
      "assets/satellite-mission-operations-qualified-review-pack.md",
      "assets/telecommand-procedure-verification-anomaly-register.md",
      "assets/telemetry-health-mode-event-ledger.md",
    ],
    terms: ["telemetry", "telecommand", "spacecraft clock", "acquisition of signal", "loss of signal"],
  },
  {
    id: "food-safety-quality",
    roots: [
      "food-process-hazard-haccp-analyst",
      "food-control-monitoring-verification-analyst",
      "food-traceability-recall-readiness-analyst",
    ],
    join: "food-safety-quality-review-owner",
    assets: [
      "assets/food-safety-quality-qualified-review-pack.md",
      "assets/food-safety-scope-product-process-flow-register.md",
      "assets/hazard-analysis-control-point-evidence-plan.md",
      "assets/lot-traceability-mass-balance-recall-readiness-register.md",
      "assets/monitoring-verification-deviation-corrective-action-ledger.md",
    ],
    terms: ["hazard analysis", "critical control point", "critical limit", "traceability", "mass balance"],
  },
  {
    id: "privacy-data-protection-operations",
    roots: [
      "personal-data-inventory-flow-analyst",
      "privacy-impact-assessment-analyst",
      "data-subject-request-retention-analyst",
      "personal-data-incident-evidence-analyst",
    ],
    join: "privacy-data-protection-review-owner",
    assets: [
      "assets/data-subject-request-retention-deletion-control-log.md",
      "assets/personal-data-incident-facts-effects-action-evidence-register.md",
      "assets/personal-data-processing-inventory-flow-register.md",
      "assets/privacy-data-protection-qualified-review-pack.md",
      "assets/privacy-impact-assessment-risk-measure-ledger.md",
    ],
    terms: ["data subject request", "retention", "legal hold", "privacy impact", "breach occurred"],
  },
  {
    id: "nuclear-facility-operations-safety",
    roots: [
      "nuclear-configuration-design-basis-analyst",
      "nuclear-defence-in-depth-barrier-analyst",
      "nuclear-event-operating-experience-analyst",
    ],
    join: "nuclear-operations-safety-review-owner",
    assets: [
      "assets/defence-in-depth-safety-function-barrier-map.md",
      "assets/nuclear-event-operating-experience-corrective-action-log.md",
      "assets/nuclear-facility-configuration-design-basis-register.md",
      "assets/nuclear-facility-operations-safety-review-pack.md",
      "assets/plant-state-operating-limit-surveillance-ledger.csv",
    ],
    terms: ["defence in depth", "design basis", "safety function", "operating experience", "operability"],
  },
  {
    id: "payments-fraud-risk-operations",
    roots: [
      "payment-transaction-authentication-analyst",
      "payment-merchant-monitoring-analyst",
      "payment-dispute-evidence-analyst",
    ],
    join: "payments-fraud-risk-review-owner",
    assets: [
      "assets/dispute-chargeback-evidence-timeline.md",
      "assets/merchant-account-monitoring-cohort-analysis.md",
      "assets/payment-event-identity-provenance-ledger.csv",
      "assets/payments-fraud-risk-review-pack.md",
      "assets/transaction-authentication-fraud-signal-register.md",
    ],
    terms: ["authentication", "chargeback", "merchant", "cohort", "mature labels"],
  },
  {
    id: "biopharmaceutical-manufacturing-quality",
    roots: [
      "biopharma-batch-record-genealogy-analyst",
      "biopharma-deviation-capa-analyst",
      "biopharma-process-validation-analyst",
    ],
    join: "biopharma-manufacturing-quality-review-owner",
    assets: [
      "assets/biopharma-batch-record-material-genealogy-ledger.csv",
      "assets/biopharma-manufacturing-quality-review-pack.md",
      "assets/continued-process-verification-trend-review.md",
      "assets/deviation-investigation-capa-effectiveness-register.md",
      "assets/process-validation-control-strategy-trace-matrix.md",
    ],
    terms: ["batch record", "material genealogy", "capa", "process validation", "continued process verification"],
  },
  {
    id: "robotics-safety-validation",
    roots: [
      "robot-system-requirement-interface-analyst",
      "robot-task-hazard-risk-reduction-analyst",
      "robot-safety-function-control-validation-analyst",
      "robot-application-test-evidence-analyst",
    ],
    join: "robotics-safety-validation-case-owner",
    assets: [
      "assets/commissioning-change-periodic-validation-decision-register.md",
      "assets/robot-system-application-boundary-requirement-register.md",
      "assets/safeguarding-collaboration-contact-event-test-register.md",
      "assets/safety-function-srp-cs-configuration-validation-matrix.md",
      "assets/task-mode-lifecycle-hazard-risk-reduction-trace.md",
    ],
    terms: ["hardware in the loop", "fault injection", "safety function", "safeguard", "residual risk"],
  },
  {
    id: "forensic-accounting-investigations",
    roots: [
      "investigation-scope-evidence-custody-analyst",
      "transaction-anomaly-population-analyst",
      "funds-flow-entity-relationship-analyst",
      "control-interview-corroboration-analyst",
    ],
    join: "forensic-accounting-investigation-evidence-owner",
    assets: [
      "assets/allegation-hypothesis-corroboration-contradiction-matrix.md",
      "assets/forensic-investigation-report-referral-decision-register.md",
      "assets/funds-flow-source-use-beneficiary-link-ledger.md",
      "assets/investigation-authority-scope-evidence-custody-register.md",
      "assets/transaction-population-reconciliation-anomaly-register.md",
    ],
    terms: ["evidence identity", "transaction population", "funds flow", "corroboration", "contradiction"],
  },
  {
    id: "petroleum-well-integrity-operations",
    roots: [
      "well-basis-design-envelope-analyst",
      "drilling-completion-barrier-verification-analyst",
      "production-well-integrity-surveillance-analyst",
      "well-intervention-change-anomaly-analyst",
    ],
    join: "petroleum-well-integrity-evidence-owner",
    assets: [
      "assets/drilling-completion-test-cement-casing-control-register.md",
      "assets/intervention-change-anomaly-remediation-decision-register.md",
      "assets/production-annulus-pressure-corrosion-integrity-surveillance-ledger.md",
      "assets/well-barrier-element-envelope-verification-matrix.md",
      "assets/well-identity-lifecycle-design-basis-envelope-register.md",
    ],
    terms: ["well barrier", "operating envelope", "annulus pressure", "casing", "cement"],
  },
  {
    id: "urban-mobility-transport-planning",
    roots: [
      "urban-mobility-baseline-network-analyst",
      "travel-demand-accessibility-analyst",
      "multimodal-options-performance-analyst",
      "mobility-equity-safety-engagement-analyst",
    ],
    join: "urban-mobility-transport-plan-owner",
    assets: [
      "assets/equity-safety-environment-burden-benefit-register.md",
      "assets/multimodal-accessibility-level-of-service-performance-matrix.md",
      "assets/option-package-engagement-funding-decision-register.md",
      "assets/travel-demand-model-calibration-scenario-assumption-ledger.md",
      "assets/urban-mobility-scope-network-service-baseline-register.md",
    ],
    terms: ["multimodal", "accessibility", "first last mile", "last mile", "public involvement"],
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Sixth ten-domain Expert Squad package expansion", () => {
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
          version: "2026.08.13.1",
        })
        expect([...loaded.packageSkills.keys()]).toEqual([skillRef])
        expect(method.definition.name).toBe(definition.id + "-method")
        expect(method.content.length).toBeGreaterThan(4_000)
        const normalizedMethod = method.content.toLowerCase().replace(/[-/_]/g, " ")
        expect(definition.terms.map((term) => normalizedMethod.includes(term))).toEqual(
          definition.terms.map(() => true),
        )
        expect(assetFiles.map((file) => file.path).sort()).toEqual([...definition.assets].sort())
        expect(assetFiles.map((file) => file.bytes > 1_200)).toEqual(assetFiles.map(() => true))
        expect(referenceFiles.length).toBeGreaterThan(0)
        expect(referenceFiles.map((file) => file.bytes > 400)).toEqual(referenceFiles.map(() => true))
        expect(loaded.manifest.capability_projection.scheduler.package_skill_refs).toEqual([skillRef])
        expect(Object.values(agents).map((agent) => agent.package_skill_refs)).toEqual(
          Object.values(agents).map(() => [skillRef]),
        )
        expect(workflows).toHaveLength(1)
        expect(roots).toEqual([...definition.roots])
        expect([...workflow.nodes[definition.join]!.depends_on].sort()).toEqual([...definition.roots].sort())

        const prompts = await Promise.all(
          Object.values(agents).map((agent) => readFile(path.join(root, agent.prompt), "utf8")),
        )
        expect(prompts.map((content) => Buffer.byteLength(content) > 1_200)).toEqual(prompts.map(() => true))
        expect(
          prompts.map((content) => {
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
        ).toEqual(prompts.map(() => true))
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
