import { afterAll, describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { allCapabilityGrants } from "./capability-grant-fixture"

const packages = [
  {
    id: "pharmacovigilance-drug-safety",
    roots: [
      "pv-case-intake-quality-analyst",
      "pv-aggregate-signal-analyst",
      "pv-risk-management-compliance-trace-analyst",
    ],
    join: "pharmacovigilance-safety-review-owner",
    assets: [
      "assets/adverse-event-aggregate-signal-register.md",
      "assets/pharmacovigilance-qualified-review-pack.md",
      "assets/reference-safety-information-version-trace.md",
      "assets/safety-case-intake-duplicate-quality-ledger.md",
      "assets/signal-validation-assessment-action-log.md",
    ],
    terms: ["adverse event", "adverse drug reaction", "seriousness", "expectedness", "reportability"],
  },
  {
    id: "laboratory-quality-assurance",
    roots: [
      "laboratory-method-validation-analyst",
      "laboratory-metrology-equipment-analyst",
      "laboratory-sample-qc-proficiency-analyst",
    ],
    join: "laboratory-quality-review-owner",
    assets: [
      "assets/equipment-calibration-traceability-uncertainty-ledger.md",
      "assets/laboratory-quality-qualified-review-pack.md",
      "assets/laboratory-scope-method-version-register.md",
      "assets/method-validation-verification-performance-plan.md",
      "assets/sample-qc-pt-nonconformance-capa-register.md",
    ],
    terms: [
      "measurand",
      "metrological traceability",
      "measurement uncertainty",
      "proficiency testing",
      "method validation",
    ],
  },
  {
    id: "patent-landscape-prior-art",
    roots: [
      "invention-claim-concept-decomposer",
      "patent-search-family-bibliography-analyst",
      "prior-art-claim-evidence-landscape-analyst",
    ],
    join: "patent-landscape-prior-art-owner",
    assets: [
      "assets/authorized-invention-feature-claim-concept-chart.md",
      "assets/patent-family-priority-bibliographic-ledger.md",
      "assets/patent-landscape-qualified-review-pack.md",
      "assets/patent-search-query-classification-log.md",
      "assets/prior-art-element-passage-evidence-matrix.md",
    ],
    terms: ["critical date", "patent family", "priority", "classification", "freedom to operate"],
  },
  {
    id: "railway-operations-safety",
    roots: [
      "railway-timetable-capacity-analyst",
      "railway-signalling-infrastructure-risk-analyst",
      "railway-service-occurrence-assurance-analyst",
    ],
    join: "railway-operations-safety-review-owner",
    assets: [
      "assets/railway-operating-baseline-and-authority-register.md",
      "assets/railway-operations-safety-review-pack.md",
      "assets/service-disruption-occurrence-assurance-log.md",
      "assets/signalling-infrastructure-restriction-risk-register.md",
      "assets/timetable-path-platform-capacity-ledger.csv",
    ],
    terms: ["movement authority", "interlocking", "headway", "platform", "possession"],
  },
  {
    id: "maritime-port-operations",
    roots: [
      "vessel-call-berth-nautical-analyst",
      "terminal-yard-gate-flow-analyst",
      "cargo-document-safety-custody-analyst",
    ],
    join: "maritime-port-operations-review-owner",
    assets: [
      "assets/cargo-document-safety-custody-register.md",
      "assets/port-operating-baseline-and-authority-register.md",
      "assets/port-operations-integrated-review-pack.md",
      "assets/terminal-yard-gate-capacity-flow-ledger.csv",
      "assets/vessel-call-berth-nautical-services-plan.md",
    ],
    terms: ["vessel call", "berth", "verified gross mass", "vessel traffic service", "custody"],
  },
  {
    id: "water-wastewater-operations",
    roots: [
      "drinking-water-treatment-quality-analyst",
      "wastewater-collection-treatment-analyst",
      "water-asset-compliance-reliability-analyst",
    ],
    join: "water-wastewater-operations-review-owner",
    assets: [
      "assets/collection-distribution-asset-reliability-register.md",
      "assets/flow-quality-mass-balance-ledger.csv",
      "assets/permit-sampling-excursion-review-pack.md",
      "assets/treatment-process-monitoring-control-evidence.md",
      "assets/water-wastewater-operating-baseline-register.md",
    ],
    terms: ["mass load", "detection limit", "infiltration", "bypass", "scada"],
  },
  {
    id: "chemical-process-safety",
    roots: [
      "process-safety-information-boundary-analyst",
      "pha-hazop-lopa-scenario-analyst",
      "mechanical-integrity-moc-readiness-analyst",
      "incident-barrier-learning-analyst",
    ],
    join: "process-safety-evidence-owner",
    assets: [
      "assets/incident-barrier-action-decision-register.md",
      "assets/lopa-ipl-assumption-register.md",
      "assets/mechanical-integrity-moc-pssr-readiness-register.md",
      "assets/pha-hazop-scenario-safeguard-worksheet.md",
      "assets/process-safety-information-boundary-register.md",
    ],
    terms: ["process safety information", "hazop", "lopa", "independent protection layer", "pre startup safety review"],
  },
  {
    id: "automotive-functional-safety",
    roots: [
      "item-definition-hara-evidence-analyst",
      "safety-concept-requirement-trace-analyst",
      "hardware-software-safety-analysis-verification-analyst",
      "functional-safety-lifecycle-assurance-analyst",
    ],
    join: "automotive-functional-safety-case-owner",
    assets: [
      "assets/functional-technical-hw-sw-requirement-interface-vv-trace-matrix.md",
      "assets/hara-hazardous-event-safety-goal-asil-trace-matrix.md",
      "assets/hw-sw-failure-dependent-failure-metric-evidence-register.md",
      "assets/item-odd-interface-boundary-register.md",
      "assets/lifecycle-configuration-confirmation-safety-case-decision-register.md",
    ],
    terms: ["hara", "automotive safety integrity level", "safety goal", "dependent failure", "confirmation measure"],
  },
  {
    id: "ai-model-governance-evaluation",
    roots: [
      "ai-use-case-risk-governance-analyst",
      "model-data-provenance-documentation-analyst",
      "ai-evaluation-design-results-analyst",
      "ai-independent-trustworthiness-reviewer",
    ],
    join: "ai-model-governance-evaluation-owner",
    assets: [
      "assets/ai-system-use-case-model-accountability-inventory.md",
      "assets/evaluation-protocol-dataset-slice-metric-register.md",
      "assets/model-card-change-drift-incident-oversight-register.md",
      "assets/risk-control-approval-exception-register.md",
      "assets/run-result-failure-trustworthiness-register.md",
    ],
    terms: ["intended use", "test set contamination", "deterministic", "inter rater", "risk acceptance"],
  },
  {
    id: "actuarial-reserving",
    roots: [
      "reserving-data-triangle-reconciliation-analyst",
      "reserving-method-assumption-diagnostics-analyst",
      "reserve-uncertainty-validation-analyst",
      "reserve-governance-rollforward-disclosure-analyst",
    ],
    join: "actuarial-reserving-evidence-owner",
    assets: [
      "assets/booked-indicated-rollforward-disclosure-decision-register.md",
      "assets/diagnostic-backtest-actual-expected-register.md",
      "assets/method-development-tail-elr-assumption-worksheet.md",
      "assets/source-triangle-reinsurance-reconciliation-control-register.md",
      "assets/uncertainty-scenario-discount-reinsurance-register.md",
    ],
    terms: ["incremental triangle", "chain ladder", "bornhuetter", "ibnr", "appointed actuary"],
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Fifth ten-domain Expert Squad package expansion", () => {
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
          schema_version: 2,
          namespace: "builtin",
          id: definition.id,
          version: "2026.08.30.1",
        })
        expect([...loaded.packageSkills.keys()]).toEqual([skillRef])
        expect(method.definition.name).toBe(definition.id + "-method")
        expect(method.content.length).toBeGreaterThan(4_000)
        const normalizedMethod = method.content.toLowerCase().replace(/[-/]/g, " ")
        expect(definition.terms.map((term) => normalizedMethod.includes(term))).toEqual(
          definition.terms.map(() => true),
        )
        expect(assetFiles.map((file) => file.path).sort()).toEqual([...definition.assets].sort())
        expect(assetFiles.map((file) => file.bytes > 1_200)).toEqual(assetFiles.map(() => true))
        expect(referenceFiles.length).toBeGreaterThan(0)
        expect(referenceFiles.map((file) => file.bytes > 400)).toEqual(referenceFiles.map(() => true))
        expect(allCapabilityGrants(loaded.manifest).map((grant) => grant.packageSkillRefs)).toEqual(
          allCapabilityGrants(loaded.manifest).map(() => [skillRef]),
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
