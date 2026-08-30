import { afterAll, describe, expect, test } from "bun:test"
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
    id: "cybersecurity-assurance",
    skillName: "cybersecurity-assurance-method",
    workflowID: "security-assurance-pack",
    roots: [
      "security-threat-evidence-analyst",
      "security-control-coverage-analyst",
      "security-incident-readiness-analyst",
    ],
    join: "security-assurance-integrator",
    asset: "assets/security-assurance-register.md",
  },
  {
    id: "cloud-platform-architecture",
    skillName: "cloud-platform-architecture-method",
    workflowID: "cloud-architecture-decision-pack",
    roots: ["cloud-workload-requirements-analyst", "cloud-reliability-analyst", "cloud-cost-operations-analyst"],
    join: "cloud-architecture-decision-owner",
    asset: "assets/cloud-decision-record.md",
  },
  {
    id: "data-engineering-reliability",
    skillName: "data-engineering-reliability-method",
    workflowID: "data-product-release-pack",
    roots: ["data-contract-analyst", "data-pipeline-resilience-analyst", "data-observability-analyst"],
    join: "data-release-integrator",
    asset: "assets/data-product-contract.md",
  },
  {
    id: "scientific-research-design",
    skillName: "scientific-research-design-method",
    workflowID: "research-design-decision-register",
    roots: [
      "research-evidence-landscape-analyst",
      "research-hypothesis-alternatives-analyst",
      "research-rigor-ethics-analyst",
    ],
    join: "research-decision-integrator",
    asset: "assets/research-decision-register.md",
  },
  {
    id: "healthcare-operations",
    skillName: "healthcare-operations-method",
    workflowID: "healthcare-operations-improvement-pack",
    roots: [
      "healthcare-service-flow-analyst",
      "healthcare-capacity-access-analyst",
      "healthcare-safety-privacy-analyst",
    ],
    join: "healthcare-operations-improvement-owner",
    asset: "assets/healthcare-operations-register.md",
  },
  {
    id: "education-program-design",
    skillName: "education-program-design-method",
    workflowID: "learning-program-blueprint",
    roots: [
      "education-learner-evidence-analyst",
      "education-curriculum-architect",
      "education-assessment-accessibility-analyst",
    ],
    join: "education-program-integrator",
    asset: "assets/learning-program-blueprint.md",
  },
  {
    id: "supply-chain-logistics",
    skillName: "supply-chain-logistics-method",
    workflowID: "logistics-control-tower-plan",
    roots: [
      "logistics-demand-inventory-analyst",
      "logistics-transport-constraints-analyst",
      "logistics-disruption-risk-analyst",
    ],
    join: "logistics-plan-owner",
    asset: "assets/logistics-control-tower.md",
  },
  {
    id: "manufacturing-quality",
    skillName: "manufacturing-quality-method",
    workflowID: "manufacturing-quality-disposition-pack",
    roots: [
      "quality-process-evidence-analyst",
      "quality-defect-analysis-specialist",
      "quality-control-verification-analyst",
    ],
    join: "quality-disposition-owner",
    asset: "assets/nonconformance-register.md",
  },
  {
    id: "real-estate-due-diligence",
    skillName: "real-estate-due-diligence-method",
    workflowID: "property-due-diligence-pack",
    roots: [
      "property-document-analyst",
      "property-market-financial-analyst",
      "property-physical-regulatory-risk-analyst",
    ],
    join: "property-diligence-pack-owner",
    asset: "assets/property-diligence-register.md",
  },
  {
    id: "ecommerce-merchandising",
    skillName: "ecommerce-merchandising-method",
    workflowID: "merchandising-test-plan",
    roots: [
      "merchandising-catalog-evidence-analyst",
      "merchandising-demand-pricing-analyst",
      "merchandising-experience-operations-analyst",
    ],
    join: "merchandising-plan-owner",
    asset: "assets/merchandising-test-plan.md",
  },
] as const

const packageRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)
const skillRef = (id: string) => `${id}/shared/method`

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Ten-domain Expert Squad package expansion", () => {
  for (const definition of packages) {
    test(`${definition.id} loads a saved Skill, asset, and three-root join workflow`, async () => {
      const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot(definition.id))
      const ref = skillRef(definition.id)
      const method = loaded.packageSkills.get(ref)!
      const agents = loaded.manifest.capability_projection.agents
      const workflow = loaded.manifest.capability_projection.virtual_workflows[definition.workflowID]!

      expect(loaded.manifest).toMatchObject({
        schema_version: 2,
        namespace: "builtin",
        id: definition.id,
        version: "2026.08.30.1",
      })
      expect([...loaded.packageSkills.keys()]).toEqual([ref])
      expect(method.definition.name).toBe(definition.skillName)
      expect(method.snapshot.files.map((file) => file.path)).toContain(definition.asset)
      expect(method.snapshot.files.find((file) => file.path === definition.asset)?.bytes).toBeGreaterThan(0)
      expect(allCapabilityGrants(loaded.manifest).map((grant) => grant.packageSkillRefs)).toEqual(
        allCapabilityGrants(loaded.manifest).map(() => [ref]),
      )
      expect(Object.keys(agents)).toEqual([...definition.roots, definition.join])
      expect(Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on]))).toEqual({
        ...Object.fromEntries(definition.roots.map((id) => [id, []])),
        [definition.join]: [...definition.roots].sort(),
      })
    }, 30_000)
  }

  test("installs all ten source packages and resolves their exact scheduler and worker Skill grants", async () => {
    await using project = await memoryProject()

    for (const definition of packages) {
      await ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: packageRoot(definition.id),
        replace: false,
        installationScope: "project",
      })
    }

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const definition of packages) {
          const ref = skillRef(definition.id)
          const config = Config.Info.parse({ prompt_profile: { active: definition.id } })
          const revision = await PromptProfileResolver.resolveActivePackageRevision({
            projectDirectory: project.path,
            config,
          })
          const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
            projectDirectory: project.path,
            config,
            packageRevision: revision,
          })

          expect(scheduler).toMatchObject({
            expertSquadID: definition.id,
            packageRevision: { version: "2026.08.30.1" },
          })
          expect(scheduler.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
            { ref, source: "package" },
          ])
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual([definition.workflowID])

          for (const agentID of [...definition.roots, definition.join]) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
              { ref, source: "package" },
            ])
          }
        }
      },
    })
  }, 60_000)
})
