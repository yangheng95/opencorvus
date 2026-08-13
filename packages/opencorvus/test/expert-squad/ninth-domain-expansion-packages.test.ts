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
    id: "clinical-genomics-variant-evidence-review",
    roots: [
      "genomic-case-build-identity-analyst",
      "population-computational-evidence-analyst",
      "functional-segregation-evidence-analyst",
      "variant-classification-provenance-analyst",
    ],
    join: "clinical-genomics-variant-evidence-review-owner",
    assets: [
      "clinical-genomics-qualified-review-pack.md",
      "criteria-classification-provenance-conflict-register.md",
      "functional-case-segregation-evidence-matrix.md",
      "population-computational-evidence-ledger.md",
      "variant-case-build-transcript-identity-register.md",
    ],
    terms: ["genome assembly", "transcript", "population", "segregation", "classification provenance"],
  },
  {
    id: "transfusion-medicine-blood-component-assurance",
    roots: [
      "transfusion-patient-order-specimen-identity-analyst",
      "blood-component-inventory-compatibility-evidence-analyst",
      "component-issue-transfusion-trace-analyst",
      "transfusion-reaction-quality-reconciliation-analyst",
    ],
    join: "transfusion-medicine-blood-component-assurance-owner",
    assets: [
      "blood-component-attribute-inventory-quality-ledger.md",
      "component-issue-transfusion-disposition-trace.md",
      "patient-order-specimen-identity-chain-register.md",
      "reaction-quality-qualified-review-pack.md",
      "testing-compatibility-evidence-matrix.md",
    ],
    terms: ["specimen", "blood component", "compatibility", "transfusion", "reaction"],
  },
  {
    id: "medical-device-human-factors-usability-assurance",
    roots: [
      "device-use-specification-interface-analyst",
      "critical-task-use-risk-analyst",
      "formative-usability-evidence-analyst",
      "summative-usability-traceability-analyst",
    ],
    join: "medical-device-human-factors-usability-review-owner",
    assets: [
      "critical-task-use-error-hazard-trace-matrix.md",
      "device-use-specification-interface-baseline.md",
      "formative-study-observation-design-response-ledger.md",
      "human-factors-usability-qualified-review-pack.md",
      "summative-protocol-result-deviation-register.md",
    ],
    terms: ["use specification", "critical task", "formative", "summative", "traceability"],
  },
  {
    id: "dam-safety-surveillance-assurance",
    roots: [
      "dam-configuration-authority-consequence-analyst",
      "dam-inspection-condition-defect-analyst",
      "dam-instrumentation-performance-surveillance-analyst",
      "dam-potential-failure-mode-control-analyst",
    ],
    join: "dam-safety-surveillance-review-owner",
    assets: [
      "dam-facility-design-authority-consequence-baseline.md",
      "dam-inspection-condition-defect-ledger.md",
      "dam-instrumentation-surveillance-trend-register.md",
      "dam-potential-failure-mode-control-action-register.md",
      "dam-safety-surveillance-qualified-review-pack.md",
    ],
    terms: ["dam", "instrumentation", "datum", "potential failure mode", "reservoir"],
  },
  {
    id: "bridge-structural-integrity-assurance",
    roots: [
      "bridge-asset-configuration-authority-analyst",
      "bridge-inspection-condition-defect-analyst",
      "bridge-load-rating-scour-fatigue-analyst",
      "bridge-maintenance-action-qcqa-analyst",
    ],
    join: "bridge-structural-integrity-review-owner",
    assets: [
      "bridge-asset-configuration-authority-baseline.md",
      "bridge-inspection-element-condition-defect-ledger.md",
      "bridge-load-rating-scour-fatigue-evidence-register.md",
      "bridge-maintenance-restriction-qcqa-action-register.md",
      "bridge-structural-integrity-qualified-review-pack.md",
    ],
    terms: ["bridge", "load rating", "scour", "fatigue", "quality assurance"],
  },
  {
    id: "marine-vessel-survey-maintenance-assurance",
    roots: [
      "vessel-identity-statutory-class-authority-analyst",
      "vessel-hull-structure-condition-survey-analyst",
      "vessel-machinery-electrical-maintenance-analyst",
      "vessel-defect-repair-nonconformity-analyst",
    ],
    join: "marine-vessel-survey-maintenance-review-owner",
    assets: [
      "marine-vessel-survey-maintenance-qualified-review-pack.md",
      "vessel-defect-repair-nonconformity-verification-register.md",
      "vessel-hull-structure-corrosion-survey-ledger.md",
      "vessel-identity-statutory-class-authority-baseline.md",
      "vessel-machinery-electrical-critical-equipment-maintenance-register.md",
    ],
    terms: ["vessel", "IMO number", "statutory", "class", "hull", "machinery"],
  },
  {
    id: "corporate-governance-entity-secretariat",
    roots: [
      "entity-authority-governing-record-analyst",
      "governing-body-meeting-materials-analyst",
      "resolution-minutes-consent-action-analyst",
      "entity-calendar-filing-register-analyst",
    ],
    join: "corporate-governance-entity-secretariat-review-owner",
    assets: [
      "corporate-governance-secretariat-qualified-review-pack.md",
      "entity-action-filing-calendar-register.md",
      "entity-governing-authority-register.md",
      "meeting-notice-agenda-material-attendance-ledger.md",
      "resolution-minutes-consent-evidence-matrix.md",
    ],
    terms: ["entity", "governing", "meeting", "written consent", "corporate secretary"],
  },
  {
    id: "corporate-treasury-liquidity-operations",
    roots: [
      "treasury-cash-account-authority-analyst",
      "treasury-cash-position-forecast-analyst",
      "treasury-payment-funding-liquidity-analyst",
      "treasury-bank-reconciliation-control-analyst",
    ],
    join: "corporate-treasury-liquidity-review-owner",
    assets: [
      "cash-position-forecast-variance-ledger.md",
      "liquidity-funding-maturity-scenario-register.md",
      "payment-settlement-bank-evidence-register.md",
      "treasury-entity-bank-account-authority-baseline.md",
      "treasury-reconciliation-control-qualified-review-pack.md",
    ],
    terms: ["cash position", "value date", "liquidity", "payment", "reconciliation"],
  },
  {
    id: "student-financial-aid-administration",
    roots: [
      "aid-applicant-isir-verification-analyst",
      "aid-academic-cost-packaging-analyst",
      "aid-award-disbursement-reconciliation-analyst",
      "aid-sap-return-overaward-exception-analyst",
    ],
    join: "student-financial-aid-administration-review-owner",
    assets: [
      "academic-calendar-cost-packaging-input-register.md",
      "aid-year-applicant-isir-verification-ledger.md",
      "award-origination-disbursement-reconciliation-ledger.md",
      "sap-withdrawal-return-overaward-exception-register.md",
      "student-financial-aid-qualified-review-pack.md",
    ],
    terms: ["aid year", "ISIR", "verification", "academic calendar", "disbursement", "overaward"],
  },
  {
    id: "digital-accessibility-assurance",
    roots: [
      "accessibility-scope-inventory-analyst",
      "accessibility-semantics-keyboard-assistive-analyst",
      "accessibility-visual-media-cognitive-analyst",
      "accessibility-manual-user-remediation-verification-analyst",
    ],
    join: "digital-accessibility-assurance-review-owner",
    assets: [
      "accessibility-remediation-retest-regression-register.md",
      "accessibility-scope-journey-build-test-matrix.md",
      "digital-accessibility-qualified-review-pack.md",
      "semantic-keyboard-assistive-evidence-ledger.md",
      "visual-reflow-media-cognitive-evidence-register.md",
    ],
    terms: ["accessibility", "keyboard", "assistive", "reflow", "remediation"],
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => resetMemoryDatabase())

describe("Ninth ten-domain Expert Squad package expansion", () => {
  for (const definition of packages) {
    test(`${definition.id} loads one substantive Skill, five assets, professional workers, and an all-roots join`, async () => {
      const root = packageRoot(definition.id)
      const loaded = await ExpertSquadRegistry.loadSourcePackage(root)
      const skillRef = `${definition.id}/shared/method`
      const method = loaded.packageSkills.get(skillRef)!
      const workflow = Object.values(loaded.manifest.capability_projection.virtual_workflows)[0]!
      const roots = Object.entries(workflow.nodes)
        .filter(([, node]) => node.depends_on.length === 0)
        .map(([id]) => id)
      const assets = method.snapshot.files.filter((file) => file.path.startsWith("assets/"))
      const references = method.snapshot.files.filter((file) => file.path.startsWith("references/"))
      const agents = loaded.manifest.capability_projection.agents

      expect(loaded.manifest).toMatchObject({
        schema_version: 1,
        namespace: "builtin",
        id: definition.id,
        version: "2026.08.13.1",
      })
      expect([...loaded.packageSkills.keys()]).toEqual([skillRef])
      expect(method.definition.name).toBe(`${definition.id}-method`)
      expect(method.content.length).toBeGreaterThan(4_000)
      const normalized = method.content.toLowerCase().replace(/[-/_]/g, " ")
      expect(definition.terms.map((term) => normalized.includes(term.toLowerCase()))).toEqual(
        definition.terms.map(() => true),
      )
      expect(assets.map((file) => file.path).sort()).toEqual(definition.assets.map((file) => `assets/${file}`).sort())
      expect(assets.map((file) => file.bytes > 1_200)).toEqual(assets.map(() => true))
      const assetContents = await Promise.all(
        definition.assets.map((file) => readFile(path.join(root, "skills", "method", "assets", file), "utf8")),
      )
      expect(
        assetContents.map((content) =>
          [
            "artifact_id",
            "source_id_locator",
            "source_version_date",
            "qualified_reviewer",
            "units_and_denominator",
            "assumptions_uncertainty",
            "decision_not_made",
            "domain records",
            "reconciliation checks",
          ].every((field) => content.toLowerCase().includes(field)),
        ),
      ).toEqual(assetContents.map(() => true))
      expect(
        assetContents.map((content) =>
          definition.terms.some((term) => content.toLowerCase().includes(term.toLowerCase())),
        ),
      ).toEqual(assetContents.map(() => true))
      expect(references.length).toBeGreaterThanOrEqual(2)
      expect(references.map((file) => file.bytes > 400)).toEqual(references.map(() => true))
      expect(loaded.manifest.capability_projection.scheduler.package_skill_refs).toEqual([skillRef])
      expect(Object.values(agents).map((agent) => agent.package_skill_refs)).toEqual(
        Object.values(agents).map(() => [skillRef]),
      )
      expect(roots).toEqual([...definition.roots])
      expect([...workflow.nodes[definition.join]!.depends_on].sort()).toEqual([...definition.roots].sort())

      const prompts = await Promise.all([
        readFile(path.join(root, loaded.manifest.capability_projection.scheduler.prompt), "utf8"),
        ...Object.values(agents).map((agent) => readFile(path.join(root, agent.prompt), "utf8")),
      ])
      expect(prompts.map((content) => Buffer.byteLength(content) > 1_200)).toEqual(prompts.map(() => true))
      expect(
        prompts.map((content) =>
          [
            "input contract",
            "domain method",
            "evidence output",
            "unknown",
            "stop",
            "authority",
            "qualified",
            "review",
          ].every((term) => content.toLowerCase().includes(term)),
        ),
      ).toEqual(prompts.map(() => true))
    }, 30_000)
  }

  test("installs all ten immutable revisions and resolves every scheduler and worker Skill grant", async () => {
    await using project = await memoryProject()
    const loadedPackages = new Map<string, ExpertSquadRegistry.LoadedPackage>()
    for (const definition of packages) {
      const source = await ExpertSquadRegistry.loadSourcePackage(packageRoot(definition.id))
      const receipt = await ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: packageRoot(definition.id),
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
          const skillRef = `${definition.id}/shared/method`
          expect(scheduler.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
            { ref: skillRef, source: "package" },
          ])
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
  }, 90_000)
})
