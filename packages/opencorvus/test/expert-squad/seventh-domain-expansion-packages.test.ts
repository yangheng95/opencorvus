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
    id: "public-health-surveillance",
    roots: [
      "surveillance-system-case-definition-data-quality-analyst",
      "surveillance-measure-trend-signal-analyst",
      "laboratory-genomic-indicator-integration-analyst",
    ],
    join: "public-health-surveillance-review-owner",
    assets: [
      "assets/epidemiologic-measure-trend-signal-analysis-register.md",
      "assets/laboratory-genomic-syndromic-indicator-linkage-register.md",
      "assets/public-health-surveillance-qualified-review-pack.md",
      "assets/surveillance-data-quality-completeness-timeliness-ledger.csv",
      "assets/surveillance-system-population-case-definition-baseline.md",
    ],
    terms: ["case definition", "timeliness", "representativeness", "denominator", "analytic signal"],
  },
  {
    id: "medical-imaging-quality-assurance",
    roots: [
      "imaging-equipment-protocol-configuration-analyst",
      "imaging-phantom-technical-qc-analyst",
      "dicom-data-display-workflow-integrity-analyst",
      "imaging-dose-nonconformance-trend-analyst",
    ],
    join: "medical-imaging-quality-assurance-review-owner",
    assets: [
      "assets/dicom-series-metadata-transfer-display-workflow-integrity-register.md",
      "assets/imaging-dose-nonconformance-capa-trend-register.md",
      "assets/imaging-modality-equipment-protocol-configuration-baseline.md",
      "assets/imaging-phantom-technical-qc-measurement-ledger.csv",
      "assets/medical-imaging-quality-assurance-qualified-review-pack.md",
    ],
    terms: ["transfer syntax", "phantom", "pixel spacing", "dose index", "diagnostic reference level"],
  },
  {
    id: "veterinary-care-operations",
    roots: [
      "veterinary-patient-intake-care-pathway-analyst",
      "veterinary-order-medication-procedure-trace-analyst",
      "veterinary-anesthesia-monitoring-recovery-analyst",
      "veterinary-inventory-biosecurity-client-followup-analyst",
    ],
    join: "veterinary-care-operations-review-owner",
    assets: [
      "assets/veterinary-care-operations-qualified-review-pack.md",
      "assets/veterinary-diagnostic-medication-order-administration-trace.md",
      "assets/veterinary-inventory-cold-chain-biosecurity-client-followup-register.md",
      "assets/veterinary-patient-episode-intake-care-pathway-register.md",
      "assets/veterinary-procedure-anesthesia-monitoring-recovery-ledger.csv",
    ],
    terms: ["species", "signed order", "anesthesia", "biosecurity", "client follow up"],
  },
  {
    id: "industrial-hygiene-exposure-assessment",
    roots: [
      "industrial-hygiene-scope-exposure-group-analyst",
      "industrial-hygiene-sampling-analytical-qa-analyst",
      "industrial-hygiene-exposure-control-evidence-analyst",
    ],
    join: "industrial-hygiene-exposure-assessment-review-owner",
    assets: [
      "assets/exposure-control-respiratory-protection-evidence-map.md",
      "assets/industrial-hygiene-exposure-assessment-qualified-review-pack.md",
      "assets/industrial-hygiene-scope-agent-task-seg-register.md",
      "assets/occupational-exposure-limit-authority-applicability-register.md",
      "assets/sampling-analytical-qa-exposure-ledger.csv",
    ],
    terms: [
      "similar exposure group",
      "occupational exposure limit",
      "calibration",
      "limit of detection",
      "time weighted",
    ],
  },
  {
    id: "battery-safety-reliability",
    roots: [
      "battery-configuration-operating-envelope-analyst",
      "battery-abuse-thermal-runaway-evidence-analyst",
      "battery-reliability-failure-data-analyst",
    ],
    join: "battery-safety-reliability-review-owner",
    assets: [
      "assets/battery-abuse-test-condition-instrumentation-ledger.csv",
      "assets/battery-failure-reliability-analysis-register.md",
      "assets/battery-safety-reliability-qualified-review-pack.md",
      "assets/battery-system-configuration-operating-envelope-register.md",
      "assets/thermal-runaway-propagation-barrier-evidence-map.md",
    ],
    terms: ["state of charge", "state of health", "thermal runaway", "cell to cell propagation", "censoring"],
  },
  {
    id: "materials-failure-analysis",
    roots: [
      "materials-failure-evidence-custody-history-analyst",
      "materials-fractography-characterization-analyst",
      "materials-load-environment-mechanics-analyst",
    ],
    join: "materials-failure-analysis-review-owner",
    assets: [
      "assets/failed-component-identity-service-history-custody-register.md",
      "assets/fracture-surface-origin-morphology-evidence-map.md",
      "assets/load-stress-environment-failure-hypothesis-matrix.md",
      "assets/material-process-microstructure-property-test-ledger.csv",
      "assets/materials-failure-analysis-qualified-review-pack.md",
    ],
    terms: ["fractography", "metallography", "fracture origin", "stress corrosion", "counterevidence"],
  },
  {
    id: "digital-forensics-incident-investigation",
    roots: [
      "digital-evidence-authority-preservation-analyst",
      "endpoint-memory-disk-artifact-analyst",
      "network-cloud-identity-artifact-analyst",
      "incident-timeline-hypothesis-corroboration-analyst",
    ],
    join: "digital-forensics-incident-evidence-owner",
    assets: [
      "assets/digital-evidence-identity-acquisition-custody-ledger.csv",
      "assets/endpoint-memory-disk-artifact-observation-register.md",
      "assets/incident-hypothesis-finding-qualified-review-pack.md",
      "assets/investigation-authority-scope-legal-hold-register.md",
      "assets/network-cloud-identity-timeline-correlation-matrix.md",
    ],
    terms: ["chain of custody", "working copy", "time semantics", "corroborating", "attribution"],
  },
  {
    id: "anti-money-laundering-compliance",
    roots: [
      "aml-program-risk-assessment-control-analyst",
      "customer-beneficial-owner-risk-review-analyst",
      "transaction-monitoring-alert-case-analyst",
      "aml-quality-testing-governance-analyst",
    ],
    join: "anti-money-laundering-compliance-review-owner",
    assets: [
      "assets/aml-applicability-program-risk-control-register.md",
      "assets/aml-independent-testing-training-governance-review-pack.md",
      "assets/customer-beneficial-owner-risk-review-ledger.md",
      "assets/suspicious-activity-escalation-confidentiality-decision-log.md",
      "assets/transaction-monitoring-alert-case-evidence-register.md",
    ],
    terms: ["beneficial owner", "transaction monitoring", "false negative", "confidentiality", "independent testing"],
  },
  {
    id: "customs-trade-compliance",
    roots: [
      "trade-transaction-jurisdiction-document-analyst",
      "tariff-classification-product-evidence-analyst",
      "origin-valuation-preference-analyst",
      "restricted-party-license-entry-control-analyst",
    ],
    join: "customs-trade-compliance-review-owner",
    assets: [
      "assets/broker-filing-audit-correction-qualified-review-pack.md",
      "assets/cross-border-transaction-party-document-baseline-register.md",
      "assets/origin-valuation-preference-duty-evidence-ledger.md",
      "assets/product-classification-rationale-ruling-trace-matrix.md",
      "assets/restricted-party-license-customs-entry-exception-register.md",
    ],
    terms: ["classification rationale", "rules of origin", "customs valuation", "related party", "potential match"],
  },
  {
    id: "forestry-wildfire-resource-management",
    roots: [
      "forest-inventory-condition-trend-analyst",
      "wildfire-hazard-exposure-fuels-analyst",
      "forest-treatment-scenario-tradeoff-analyst",
      "wildfire-monitoring-burn-severity-recovery-analyst",
    ],
    join: "forestry-wildfire-resource-management-review-owner",
    assets: [
      "assets/fire-event-perimeter-burn-severity-impact-monitoring-register.md",
      "assets/forest-fuel-treatment-scenario-objective-tradeoff-matrix.md",
      "assets/forest-planning-unit-inventory-condition-baseline-register.md",
      "assets/forestry-wildfire-resource-qualified-review-pack.md",
      "assets/wildfire-hazard-fuel-exposure-data-provenance-ledger.md",
    ],
    terms: ["forest inventory", "expansion factor", "burn severity", "treatment scenario", "tactical locations"],
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Seventh ten-domain Expert Squad package expansion", () => {
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
        const normalizedMethod = method.content.toLowerCase().replace(/[-/_]/g, " ")
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
