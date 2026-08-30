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
    id: "radiation-therapy-physics-quality-assurance",
    roots: [
      "radiotherapy-equipment-configuration-commissioning-analyst",
      "radiotherapy-reference-dosimetry-machine-qa-analyst",
      "radiotherapy-treatment-planning-patient-specific-qa-analyst",
      "radiotherapy-incident-change-independent-audit-analyst",
    ],
    join: "radiation-therapy-physics-quality-review-owner",
    assets: [
      "radiotherapy-facility-equipment-software-authority-baseline.md",
      "radiotherapy-commissioning-reference-dosimetry-machine-qa-ledger.csv",
      "radiotherapy-treatment-planning-patient-specific-qa-register.md",
      "radiotherapy-change-incident-independent-audit-register.md",
      "radiation-therapy-physics-qualified-review-pack.md",
    ],
    terms: ["radiotherapy", "dosimetry", "commissioning", "patient specific", "independent audit"],
  },
  {
    id: "medical-device-postmarket-surveillance",
    roots: [
      "device-installed-base-complaint-intake-quality-analyst",
      "device-adverse-event-vigilance-reportability-evidence-analyst",
      "device-trend-benefit-risk-pmcf-rwe-analyst",
      "device-field-action-capa-effectiveness-analyst",
    ],
    join: "medical-device-postmarket-surveillance-review-owner",
    assets: [
      "medical-device-postmarket-scope-authority-installed-base-baseline.md",
      "medical-device-complaint-adverse-event-vigilance-ledger.csv",
      "medical-device-trend-pmcf-real-world-performance-register.md",
      "medical-device-field-action-capa-risk-file-trace-register.md",
      "medical-device-postmarket-qualified-review-pack.md",
    ],
    terms: ["installed base", "complaint", "vigilance", "PMCF", "CAPA"],
  },
  {
    id: "clinical-biostatistics-data-monitoring",
    roots: [
      "clinical-estimand-sap-population-analyst",
      "clinical-analysis-dataset-traceability-analyst",
      "clinical-model-missing-data-multiplicity-analyst",
      "clinical-interim-data-monitoring-evidence-analyst",
    ],
    join: "clinical-biostatistics-data-monitoring-review-owner",
    assets: [
      "clinical-estimand-sap-analysis-population-baseline.md",
      "clinical-source-sdtm-adam-derivation-trace-ledger.csv",
      "clinical-model-endpoint-missing-data-multiplicity-register.md",
      "clinical-interim-monitoring-blinding-decision-evidence-register.md",
      "clinical-biostatistics-data-monitoring-qualified-review-pack.md",
    ],
    terms: ["estimand", "SDTM", "ADaM", "missing data", "multiplicity", "blinding"],
  },
  {
    id: "internal-audit-control-assurance",
    roots: [
      "audit-universe-risk-prioritization-analyst",
      "control-design-walkthrough-analyst",
      "control-operating-effectiveness-testing-analyst",
      "finding-root-cause-remediation-analyst",
    ],
    join: "internal-audit-control-assurance-review-owner",
    assets: [
      "internal-audit-charter-universe-risk-prioritization-baseline.md",
      "risk-control-objective-design-walkthrough-trace-matrix.md",
      "control-population-sample-operating-effectiveness-test-ledger.csv",
      "audit-exception-finding-root-cause-remediation-register.md",
      "internal-audit-control-assurance-qualified-review-pack.md",
    ],
    terms: [
      "internal audit",
      "audit universe",
      "control design",
      "walkthrough",
      "operating effectiveness",
      "remediation",
    ],
  },
  {
    id: "mergers-acquisitions-due-diligence",
    roots: [
      "commercial-customer-market-operations-analyst",
      "deal-scope-vdr-completeness-analyst",
      "financial-quality-working-capital-analyst",
      "legal-regulatory-technology-people-analyst",
    ],
    join: "mergers-acquisitions-due-diligence-review-owner",
    assets: [
      "deal-authority-perimeter-materiality-vdr-baseline.md",
      "vdr-request-document-completeness-provenance-ledger.csv",
      "financial-quality-working-capital-net-debt-trace-matrix.md",
      "commercial-customer-market-legal-technology-people-issue-register.md",
      "mergers-acquisitions-due-diligence-qualified-review-pack.md",
    ],
    terms: ["VDR", "working capital", "net debt", "commercial", "counterevidence"],
  },
  {
    id: "advertising-measurement-brand-safety",
    roots: [
      "brand-safety-suitability-verification-analyst",
      "campaign-taxonomy-metric-contract-analyst",
      "delivery-reconciliation-data-quality-analyst",
      "outcome-attribution-experiment-analyst",
    ],
    join: "advertising-measurement-brand-safety-review-owner",
    assets: [
      "campaign-authority-taxonomy-measurement-baseline.md",
      "advertising-metric-definition-event-lineage-register.md",
      "delivery-viewability-invalid-traffic-reconciliation-ledger.csv",
      "outcome-attribution-incrementality-experiment-matrix.md",
      "brand-safety-suitability-claim-qualified-review-pack.md",
    ],
    terms: ["brand safety", "viewability", "invalid traffic", "attribution", "incrementality"],
  },
  {
    id: "records-ediscovery-operations",
    roots: [
      "custodian-source-collection-provenance-analyst",
      "processing-dedup-search-review-analyst",
      "production-privilege-disposition-analyst",
      "records-authority-retention-hold-analyst",
    ],
    join: "records-ediscovery-operations-review-owner",
    assets: [
      "matter-records-authority-retention-legal-hold-baseline.md",
      "custodian-source-system-preservation-collection-ledger.csv",
      "processing-dedup-normalization-family-exception-register.md",
      "search-review-coding-privilege-issue-trace-matrix.md",
      "production-retention-disposition-qualified-review-pack.md",
    ],
    terms: ["custodian", "legal hold", "dedup", "privilege", "production"],
  },
  {
    id: "fire-protection-engineering-assurance",
    roots: [
      "fire-protection-basis-occupancy-hazard-analyst",
      "passive-fire-compartmentation-egress-evidence-analyst",
      "active-fire-detection-suppression-water-supply-analyst",
      "fire-modeling-inspection-impairment-evidence-analyst",
    ],
    join: "fire-protection-engineering-assurance-review-owner",
    assets: [
      "fire-protection-facility-occupancy-authority-basis-register.md",
      "passive-fire-compartmentation-egress-evidence-matrix.md",
      "active-fire-protection-system-interface-test-ledger.csv",
      "fire-scenario-model-inspection-impairment-evidence-map.md",
      "fire-protection-engineering-qualified-review-pack.md",
    ],
    terms: ["occupancy", "compartmentation", "egress", "suppression", "impairment"],
  },
  {
    id: "power-grid-protection-reliability-assurance",
    roots: [
      "power-grid-protection-zone-device-configuration-analyst",
      "power-grid-fault-study-relay-coordination-analyst",
      "power-grid-disturbance-misoperation-event-analyst",
      "power-grid-reliability-outage-data-analyst",
    ],
    join: "power-grid-protection-reliability-assurance-review-owner",
    assets: [
      "power-grid-protection-zone-device-configuration-register.md",
      "fault-study-relay-setting-coordination-ledger.csv",
      "trip-logic-teleprotection-breaker-evidence-matrix.md",
      "disturbance-misoperation-outage-reliability-evidence-map.md",
      "power-grid-protection-reliability-qualified-review-pack.md",
    ],
    terms: ["protection zone", "relay", "coordination", "misoperation", "reliability"],
  },
  {
    id: "oceanographic-observation-data-assurance",
    roots: [
      "ocean-observing-platform-instrument-metadata-analyst",
      "oceanographic-profile-timeseries-quality-control-analyst",
      "ocean-data-coordinate-format-provenance-analyst",
      "oceanographic-cross-platform-validation-analyst",
    ],
    join: "oceanographic-observation-data-assurance-review-owner",
    assets: [
      "ocean-observing-platform-instrument-metadata-register.md",
      "oceanographic-profile-timeseries-quality-control-ledger.csv",
      "ocean-data-coordinate-variable-format-provenance-map.md",
      "oceanographic-cross-platform-collocation-validation-scorecard.md",
      "oceanographic-observation-data-qualified-review-pack.md",
    ],
    terms: ["oceanographic", "pressure", "QARTOD", "NetCDF", "cross platform"],
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => resetMemoryDatabase())

describe("Tenth ten-domain Expert Squad package expansion", () => {
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
        schema_version: 2,
        namespace: "builtin",
        id: definition.id,
        version: "2026.08.30.1",
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
            "outcome_unknown",
            "stop_escalation",
          ].every((field) => content.toLowerCase().includes(field)),
        ),
      ).toEqual(assetContents.map(() => true))
      expect(
        assetContents.map((content) =>
          definition.terms.some((term) =>
            content
              .toLowerCase()
              .replace(/[-/_]/g, " ")
              .includes(term.toLowerCase().replace(/[-/_]/g, " ")),
          ),
        ),
      ).toEqual(assetContents.map(() => true))
      expect(references.length).toBeGreaterThanOrEqual(2)
      expect(references.map((file) => file.bytes > 400)).toEqual(references.map(() => true))
      expect(allCapabilityGrants(loaded.manifest).map((grant) => grant.packageSkillRefs)).toEqual(
        allCapabilityGrants(loaded.manifest).map(() => [skillRef]),
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
