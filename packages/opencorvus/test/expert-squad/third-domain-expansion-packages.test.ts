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
    id: "insurance-claims-operations",
    skillRef: "insurance-claims-operations/shared/method",
    skillName: "insurance-claims-operations-method",
    workflowID: "claims-evidence-pack",
    roots: ["claims-evidence-analyst", "claims-policy-traceability-analyst", "claims-control-risk-analyst"],
    join: "claims-evidence-pack-owner",
    assets: [
      "assets/claim-event-and-custody-ledger.md",
      "assets/claim-financial-control-register.md",
      "assets/claims-evidence-register.md",
      "assets/policy-endorsement-fact-trace.md",
    ],
    methodTerms: ["first notice", "custody", "endorsement", "reserve", "licensed"],
  },
  {
    id: "energy-utilities-planning",
    skillRef: "energy-utilities-planning/shared/method",
    skillName: "energy-utilities-planning-method",
    workflowID: "utility-scenario-plan",
    roots: [
      "utility-demand-supply-analyst",
      "utility-reliability-constraints-analyst",
      "utility-cost-emissions-analyst",
    ],
    join: "utility-plan-owner",
    assets: [
      "assets/demand-energy-capacity-balance.md",
      "assets/reliability-contingency-review.md",
      "assets/utility-scenario-register.md",
    ],
    methodTerms: ["planning basis", "weather", "peak power", "contingency", "emissions"],
  },
  {
    id: "agriculture-food-systems",
    skillRef: "agriculture-food-systems/shared/method",
    skillName: "agriculture-food-systems-method",
    workflowID: "season-food-system-plan",
    roots: [
      "agriculture-production-context-analyst",
      "agriculture-resource-input-analyst",
      "agriculture-market-biosecurity-analyst",
    ],
    join: "food-system-plan-owner",
    assets: [
      "assets/season-system-plan.md",
      "assets/seasonal-resource-balance.md",
      "assets/traceability-logistics-risk-register.md",
    ],
    methodTerms: ["production system", "resource", "biosecurity", "food safety", "traceability"],
  },
  {
    id: "construction-project-controls",
    skillRef: "construction-project-controls/shared/method",
    skillName: "construction-project-controls-method",
    workflowID: "construction-controls-pack",
    roots: [
      "construction-scope-schedule-analyst",
      "construction-cost-procurement-analyst",
      "construction-site-risk-quality-analyst",
    ],
    join: "construction-controls-owner",
    assets: [
      "assets/cost-earned-value-change-register.md",
      "assets/interface-procurement-site-risk-register.md",
      "assets/project-controls-register.md",
      "assets/wbs-schedule-baseline-register.md",
    ],
    methodTerms: ["driving path", "earned value", "estimate at completion", "procurement", "submittal"],
  },
  {
    id: "telecom-network-assurance",
    skillRef: "telecom-network-assurance/shared/method",
    skillName: "telecom-network-assurance-method",
    workflowID: "network-assurance-plan",
    roots: ["telecom-demand-topology-analyst", "telecom-service-level-analyst", "telecom-capacity-change-risk-analyst"],
    join: "network-assurance-owner",
    assets: [
      "assets/capacity-change-scenario-register.md",
      "assets/network-assurance-register.md",
      "assets/service-level-indicator-window-register.md",
      "assets/service-topology-failure-domain-map.md",
    ],
    methodTerms: ["service level", "failure domain", "availability", "error budget", "maintenance"],
  },
  {
    id: "public-sector-service-delivery",
    skillRef: "public-sector-service-delivery/shared/method",
    skillName: "public-sector-service-delivery-method",
    workflowID: "public-service-delivery-pack",
    roots: [
      "public-resident-needs-analyst",
      "public-process-accessibility-analyst",
      "public-policy-delivery-risk-analyst",
    ],
    join: "public-service-plan-owner",
    assets: [
      "assets/resident-journey-and-channel-equity-register.md",
      "assets/service-boundary-and-authority-brief.md",
      "assets/service-delivery-outcome-register.md",
    ],
    methodTerms: ["resident", "accessibility", "eligibility", "failure demand", "public commitment"],
  },
  {
    id: "nonprofit-grant-operations",
    skillRef: "nonprofit-grant-operations/shared/method",
    skillName: "nonprofit-grant-operations-method",
    workflowID: "grant-delivery-pack",
    roots: ["grant-funder-fit-analyst", "grant-program-evidence-analyst", "grant-budget-compliance-analyst"],
    join: "grant-delivery-pack-owner",
    assets: [
      "assets/budget-and-post-award-control-register.md",
      "assets/funder-requirement-traceability-matrix.md",
      "assets/grant-delivery-plan.md",
      "assets/logic-model-and-indicator-register.md",
    ],
    methodTerms: ["funder", "logic model", "allowability", "match", "safeguarding"],
  },
  {
    id: "hospitality-service-operations",
    skillRef: "hospitality-service-operations/shared/method",
    skillName: "hospitality-service-operations-method",
    workflowID: "hospitality-operations-plan",
    roots: [
      "hospitality-guest-journey-analyst",
      "hospitality-revenue-capacity-analyst",
      "hospitality-workforce-safety-analyst",
    ],
    join: "hospitality-plan-owner",
    assets: [
      "assets/demand-revenue-scenario.md",
      "assets/guest-service-operations-plan.md",
      "assets/service-capacity-handoff-plan.md",
    ],
    methodTerms: ["occupancy", "average daily rate", "revenue per available room", "housekeeping", "food safety"],
  },
  {
    id: "life-sciences-regulatory",
    skillRef: "life-sciences-regulatory/shared/method",
    skillName: "life-sciences-regulatory-method",
    workflowID: "regulatory-readiness-pack",
    roots: [
      "regulatory-product-evidence-analyst",
      "regulatory-pathway-market-analyst",
      "regulatory-quality-risk-analyst",
    ],
    join: "regulatory-readiness-owner",
    assets: [
      "assets/market-pathway-current-source-log.md",
      "assets/product-claims-evidence-matrix.md",
      "assets/quality-risk-traceability-register.md",
      "assets/regulatory-readiness-register.md",
    ],
    methodTerms: ["intended use", "jurisdiction", "classification", "quality", "post market"],
  },
  {
    id: "academic-paper-review",
    skillRef: "academic-paper-review/shared/academic-paper-review-method",
    skillName: "academic-paper-review-method",
    workflowID: "academic-paper-review",
    roots: ["paper-review-charter-planner", "paper-literature-landscape-reviewer", "paper-presentation-reviewer"],
    join: "paper-review-integration-editor",
    joinInputs: [
      "paper-citation-hallucination-auditor",
      "paper-logic-argument-reviewer",
      "paper-methods-facts-reviewer",
      "paper-novelty-contribution-reviewer",
      "paper-presentation-reviewer",
    ],
    assets: [
      "assets/argument-logic-map.md",
      "assets/claim-citation-hallucination-ledger.md",
      "assets/literature-search-protocol.md",
      "assets/methods-fact-recalculation-register.md",
      "assets/novelty-prior-art-matrix.md",
      "assets/presentation-quality-checklist.md",
      "assets/review-evidence-register.md",
    ],
    methodTerms: ["literature", "novelty", "logic", "statistics", "hallucination", "presentation"],
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Third ten-domain Expert Squad package expansion", () => {
  for (const definition of packages) {
    test(`${definition.id} loads its substantive Skill, dedicated assets, and parallel join workflow`, async () => {
      const root = packageRoot(definition.id)
      const loaded = await ExpertSquadRegistry.loadSourcePackage(root)
      const method = loaded.packageSkills.get(definition.skillRef)!
      const agents = loaded.manifest.capability_projection.agents
      const workflow = loaded.manifest.capability_projection.virtual_workflows[definition.workflowID]!
      const roots = Object.entries(workflow.nodes)
        .filter(([, node]) => node.depends_on.length === 0)
        .map(([id]) => id)
      const joinInputs = "joinInputs" in definition ? definition.joinInputs : definition.roots
      const assetFiles = method.snapshot.files.filter((file) => file.path.startsWith("assets/"))

      expect(loaded.manifest).toMatchObject({
        schema_version: 1,
        namespace: "builtin",
        id: definition.id,
        version: "2026.08.13.1",
      })
      expect([...loaded.packageSkills.keys()]).toEqual([definition.skillRef])
      expect(method.definition.name).toBe(definition.skillName)
      expect(method.content.length).toBeGreaterThan(3_000)
      const normalizedMethod = method.content.toLowerCase().replace(/[-/]/g, " ")
      expect(definition.methodTerms.map((term) => normalizedMethod.includes(term))).toEqual(
        definition.methodTerms.map(() => true),
      )
      expect(assetFiles.map((file) => file.path).sort()).toEqual([...definition.assets].sort())
      expect(assetFiles.map((file) => file.bytes > 800)).toEqual(assetFiles.map(() => true))
      expect(loaded.manifest.capability_projection.scheduler.package_skill_refs).toEqual([definition.skillRef])
      expect(Object.values(agents).map((agent) => agent.package_skill_refs)).toEqual(
        Object.values(agents).map(() => [definition.skillRef]),
      )
      expect(roots).toEqual([...definition.roots])
      expect([...workflow.nodes[definition.join]!.depends_on].sort()).toEqual([...joinInputs].sort())

      const promptContents = await Promise.all(
        Object.values(agents).map((agent) => readFile(path.join(root, agent.prompt), "utf8")),
      )
      expect(promptContents.map((content) => Buffer.byteLength(content) > 600)).toEqual(promptContents.map(() => true))
      if (definition.id !== "academic-paper-review") {
        expect(
          promptContents.map((content) => {
            const normalized = content.toLowerCase()
            return (
              normalized.includes("input contract") &&
              normalized.includes("output") &&
              normalized.includes("stop") &&
              (normalized.includes("review") || normalized.includes("authorized"))
            )
          }),
        ).toEqual(promptContents.map(() => true))
      }
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

          expect(scheduler.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
            { ref: definition.skillRef, source: "package" },
          ])
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual([definition.workflowID])

          for (const agentID of Object.keys(source.manifest.capability_projection.agents)) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
              { ref: definition.skillRef, source: "package" },
            ])
          }
        }
      },
    })
  }, 60_000)
})
