import { afterAll, describe, expect, test } from "bun:test"
import Ajv2020 from "ajv/dist/2020"
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
    id: "one-person-company-operating-system",
    roots: [
      "opc-strategy-offer-demand-analyst",
      "opc-revenue-finance-obligation-analyst",
      "opc-delivery-customer-capacity-analyst",
      "opc-automation-governance-resilience-analyst",
    ],
    join: "one-person-company-operating-system-review-owner",
    assets: [
      "assets/opc-company-profile-authority-risk-control-baseline.md",
      "assets/opc-delivery-customer-automation-observability-register.md",
      "assets/opc-offer-channel-demand-experiment-portfolio.md",
      "assets/opc-operating-review-decision-pack.md",
      "assets/opc-revenue-cash-cost-obligation-evidence-ledger.csv",
    ],
    terms: ["one person company", "offer", "functional currency", "outcome unknown", "self review"],
  },
  {
    id: "pipeline-integrity-management",
    roots: [
      "pipeline-segment-configuration-regulatory-basis-analyst",
      "pipeline-threat-data-integration-analyst",
      "pipeline-assessment-anomaly-remediation-analyst",
    ],
    join: "pipeline-integrity-management-review-owner",
    assets: [
      "assets/pipeline-assessment-run-anomaly-correlation-ledger.csv",
      "assets/pipeline-excavation-repair-moc-evidence-map.md",
      "assets/pipeline-integrity-qualified-review-pack.md",
      "assets/pipeline-segment-identity-regulatory-basis-register.md",
      "assets/pipeline-threat-data-integration-matrix.md",
    ],
    terms: ["segment", "threat", "anomaly", "excavation", "qualified"],
  },
  {
    id: "meteorological-observation-forecast-assurance",
    roots: [
      "meteorological-observation-metadata-quality-analyst",
      "forecast-cycle-provenance-analyst",
      "forecast-verification-evidence-analyst",
    ],
    join: "meteorological-observation-forecast-assurance-review-owner",
    assets: [
      "assets/forecast-product-cycle-valid-time-provenance-register.md",
      "assets/forecast-verification-contingency-scorecard.md",
      "assets/meteorological-assurance-qualified-review-pack.md",
      "assets/meteorological-observation-quality-control-ledger.csv",
      "assets/meteorological-station-sensor-metadata-register.md",
    ],
    terms: ["observation", "valid time", "lead time", "verification", "uncertainty"],
  },
  {
    id: "hazardous-waste-compliance-operations",
    roots: [
      "hazardous-waste-stream-determination-analyst",
      "generator-accumulation-compliance-analyst",
      "hazardous-waste-manifest-disposition-analyst",
    ],
    join: "hazardous-waste-compliance-operations-review-owner",
    assets: [
      "assets/generator-category-accumulation-unit-compliance-map.md",
      "assets/hazardous-waste-determination-evidence-ledger.csv",
      "assets/hazardous-waste-manifest-disposition-chain-register.md",
      "assets/hazardous-waste-qualified-review-pack.md",
      "assets/waste-stream-generation-process-identity-register.md",
    ],
    terms: ["waste stream", "generator", "accumulation", "manifest", "disposition"],
  },
  {
    id: "identity-access-governance",
    roots: [
      "authoritative-identity-lifecycle-analyst",
      "account-entitlement-correlation-analyst",
      "access-request-role-sod-control-analyst",
      "access-certification-orphan-review-analyst",
    ],
    join: "identity-access-governance-review-owner",
    assets: [
      "assets/access-certification-orphan-dormant-account-evidence-register.md",
      "assets/access-request-approval-sod-exception-register.md",
      "assets/identity-account-entitlement-correlation-ledger.csv",
      "assets/identity-access-governance-qualified-review-pack.md",
      "assets/identity-authoritative-source-lifecycle-baseline-register.md",
    ],
    terms: ["authoritative", "entitlement", "joiner mover leaver", "segregation of duties", "certification"],
  },
  {
    id: "enterprise-backup-recovery-assurance",
    roots: [
      "workload-recovery-scope-analyst",
      "backup-copy-retention-immutability-analyst",
      "backup-catalog-hash-integrity-analyst",
      "isolated-restore-recovery-validation-analyst",
    ],
    join: "enterprise-backup-recovery-assurance-owner",
    assets: [
      "assets/backup-integrity-catalog-hash-verification-register.md",
      "assets/backup-job-copy-retention-immutability-evidence-ledger.csv",
      "assets/enterprise-backup-recovery-qualified-review-pack.md",
      "assets/isolated-restore-recovery-validation-matrix.md",
      "assets/workload-recovery-objective-authority-baseline-register.md",
    ],
    terms: ["backup", "recovery", "retention", "integrity", "isolated restore"],
  },
  {
    id: "securities-post-trade-operations",
    roots: [
      "trade-capture-allocation-confirmation-analyst",
      "clearing-netting-obligation-analyst",
      "custody-dvp-settlement-analyst",
      "settlement-fail-break-control-analyst",
    ],
    join: "securities-post-trade-operations-review-owner",
    assets: [
      "assets/clearing-netting-obligation-dvp-custody-trace-matrix.md",
      "assets/securities-post-trade-operations-qualified-review-pack.md",
      "assets/settlement-fail-stock-cash-break-exception-register.md",
      "assets/trade-allocation-confirmation-affirmation-ledger.csv",
      "assets/trade-settlement-scope-market-calendar-baseline.md",
    ],
    terms: ["allocation", "affirmation", "clearing", "delivery versus payment", "settlement fail"],
  },
  {
    id: "air-traffic-management-safety",
    roots: [
      "airspace-facility-procedure-configuration-analyst",
      "traffic-demand-capacity-performance-analyst",
      "air-traffic-hazard-risk-control-analyst",
      "occurrence-change-safety-assurance-analyst",
    ],
    join: "air-traffic-management-safety-review-owner",
    assets: [
      "assets/air-traffic-hazard-risk-control-trace-matrix.md",
      "assets/air-traffic-management-safety-qualified-review-pack.md",
      "assets/airspace-facility-procedure-configuration-baseline.md",
      "assets/operational-occurrence-safety-performance-assurance-register.md",
      "assets/traffic-demand-capacity-sector-runway-evidence-ledger.csv",
    ],
    terms: ["airspace", "demand", "capacity", "hazard", "occurrence"],
  },
  {
    id: "cloud-finops-cost-governance",
    roots: [
      "finops-cost-usage-billing-quality-analyst",
      "finops-allocation-unit-economics-analyst",
      "finops-forecast-commitment-optimization-analyst",
      "finops-anomaly-governance-value-analyst",
    ],
    join: "cloud-finops-cost-governance-review-owner",
    assets: [
      "assets/cloud-finops-qualified-review-pack.md",
      "assets/commitment-optimization-anomaly-evidence-register.md",
      "assets/cost-usage-allocation-reconciliation-ledger.csv",
      "assets/technology-cost-scope-billing-source-baseline.md",
      "assets/unit-economics-budget-forecast-register.md",
    ],
    terms: ["billing quality", "allocation", "unit economics", "commitment", "anomaly"],
  },
  {
    id: "service-reliability-incident-operations",
    roots: [
      "reliability-sli-slo-error-budget-analyst",
      "reliability-observability-alert-quality-analyst",
      "reliability-incident-coordination-handoff-analyst",
      "reliability-postincident-learning-action-analyst",
    ],
    join: "service-reliability-incident-review-owner",
    assets: [
      "assets/incident-timeline-impact-command-handoff-register.md",
      "assets/observability-alert-signal-quality-ledger.csv",
      "assets/postincident-contributing-factor-action-register.md",
      "assets/service-reliability-qualified-review-pack.md",
      "assets/service-sli-slo-error-budget-baseline.md",
    ],
    terms: ["service level indicator", "service level objective", "error budget", "incident", "postmortem"],
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Eighth ten-domain Expert Squad package expansion", () => {
  for (const definition of packages) {
    test(
      definition.id + " loads its substantive Skill, five core assets, worker contracts, and explicit join",
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
        const coreAssets = method.snapshot.files.filter((file) => file.path.startsWith("assets/"))
        const referenceFiles = method.snapshot.files.filter((file) => file.path.startsWith("references/"))

        expect(loaded.manifest).toMatchObject({
          schema_version: 2,
          namespace: "builtin",
          id: definition.id,
          version: "2026.08.30.2",
        })
        expect([...loaded.packageSkills.keys()]).toEqual([skillRef])
        expect(method.definition.name).toBe(definition.id + "-method")
        expect(method.content.length).toBeGreaterThan(4_000)
        const normalizedMethod = method.content.toLowerCase().replace(/[-/_]/g, " ")
        expect(definition.terms.map((term) => normalizedMethod.includes(term))).toEqual(
          definition.terms.map(() => true),
        )
        expect(coreAssets.map((file) => file.path).sort()).toEqual([...definition.assets].sort())
        expect(coreAssets.map((file) => file.bytes > 1_200)).toEqual(coreAssets.map(() => true))
        expect(referenceFiles.length).toBeGreaterThan(0)
        expect(referenceFiles.map((file) => file.bytes > 400)).toEqual(referenceFiles.map(() => true))
        expect(allCapabilityGrants(loaded.manifest).map((grant) => grant.packageSkillRefs)).toEqual(
          allCapabilityGrants(loaded.manifest).map(() => [skillRef]),
        )
        expect(workflows).toHaveLength(1)
        expect(roots).toEqual([...definition.roots])
        expect([...workflow.nodes[definition.join]!.depends_on].sort()).toEqual([...definition.roots].sort())

        const prompts = await Promise.all([
          readFile(path.join(root, loaded.manifest.capability_projection.scheduler.prompt), "utf8"),
          ...Object.values(agents).map((agent) => readFile(path.join(root, agent.prompt), "utf8")),
        ])
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

  test("validates all four OPC commercial profiles against one immutable schema", async () => {
    const skillRoot = path.join(packageRoot("one-person-company-operating-system"), "skills", "method")
    const schema = JSON.parse(await readFile(path.join(skillRoot, "references", "opc-config.schema.json"), "utf8"))
    const validate = new Ajv2020({ allErrors: true, strict: false, formats: { date: true } }).compile(schema)
    const names = ["micro-saas.json", "consulting.json", "creator-media.json", "digital-product-commerce.json"]
    const profiles = await Promise.all(
      names.map(async (name) => JSON.parse(await readFile(path.join(skillRoot, "examples", name), "utf8"))),
    )

    expect(profiles.map((profile) => validate(profile))).toEqual(profiles.map(() => true))
    expect(profiles.map((profile) => profile.profile_id)).toEqual([
      "opc-micro-saas-commercial",
      "opc-consulting-commercial",
      "opc-creator-media-commercial",
      "opc-digital-product-commerce-commercial",
    ])
    expect(profiles.map((profile) => profile.business_model)).toEqual([
      "micro_saas",
      "consulting",
      "creator_media",
      "digital_product_commerce",
    ])
    expect(
      profiles.map((profile) =>
        profile.workflows.every(
          (workflow: Record<string, unknown>) =>
            workflow.automation_mode === "observe_and_draft" &&
            workflow.external_write === false &&
            workflow.dry_run === true &&
            workflow.auto_approve === false &&
            workflow.auto_retry === false,
        ),
      ),
    ).toEqual(profiles.map(() => true))
    expect(
      profiles.flatMap((profile) =>
        profile.secret_refs.map((secret: Record<string, unknown>) => Object.keys(secret).sort()),
      ),
    ).toEqual(profiles.flatMap((profile) => profile.secret_refs.map(() => ["alias", "owner", "provider", "scope"])))
    expect(
      profiles.map((profile) =>
        profile.metric_definitions.every(
          (metric: Record<string, unknown>) =>
            metric.formula_version &&
            metric.numerator &&
            metric.denominator &&
            metric.unit &&
            metric.source_id &&
            metric.owner &&
            metric.uncertainty,
        ),
      ),
    ).toEqual(profiles.map(() => true))

    expect(
      profiles.map((profile) => {
        const sourceIDs = new Set(profile.data_sources.map((source: { source_id: string }) => source.source_id))
        const secretAliases = new Set(profile.secret_refs.map((secret: { alias: string }) => secret.alias))
        const channelIDs = new Set(
          profile.customer_channels.map((channel: { channel_id: string }) => channel.channel_id),
        )
        const approvalClasses = new Set(
          profile.approval_policy.map((approval: { action_class: string }) => approval.action_class),
        )
        const secretReferencesResolve = profile.data_sources.every((source: { auth_ref: string }) => {
          if (!source.auth_ref.startsWith("secret-ref/")) return true
          return secretAliases.has(source.auth_ref.slice("secret-ref/".length))
        })
        const sourceReferencesResolve =
          profile.customer_channels.every((channel: { system_of_record_ref: string }) =>
            sourceIDs.has(channel.system_of_record_ref),
          ) &&
          profile.metric_definitions.every((metric: { source_id: string }) => sourceIDs.has(metric.source_id)) &&
          profile.cash_controls.system_of_record_refs.every((sourceID: string) => sourceIDs.has(sourceID)) &&
          profile.continuity.critical_source_refs.every((sourceID: string) => sourceIDs.has(sourceID)) &&
          sourceIDs.has(profile.pipeline.source_id) &&
          sourceIDs.has(profile.delivery_capacity.source_id)
        const channelReferencesResolve = profile.offer_portfolio.every((offer: { channel_ids: string[] }) =>
          offer.channel_ids.every((channelID) => channelIDs.has(channelID)),
        )
        const approvalReferencesResolve = profile.workflows.every((workflow: { approval_action_class: string }) =>
          approvalClasses.has(workflow.approval_action_class),
        )

        return (
          secretReferencesResolve && sourceReferencesResolve && channelReferencesResolve && approvalReferencesResolve
        )
      }),
    ).toEqual(profiles.map(() => true))

    const calendarBoundaryProfiles = [structuredClone(profiles[0]), structuredClone(profiles[1])]
    calendarBoundaryProfiles[0].localization.fiscal_year_start = "02-29"
    calendarBoundaryProfiles[0].review_cadence.local_time = "00:00"
    calendarBoundaryProfiles[1].localization.fiscal_year_start = "12-31"
    calendarBoundaryProfiles[1].review_cadence.local_time = "23:59"
    expect(calendarBoundaryProfiles.map((profile) => validate(profile))).toEqual([true, true])
  })

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
