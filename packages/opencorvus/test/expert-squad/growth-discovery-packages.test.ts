import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import {
  MarketingGrowthArtifactTypes,
  parseMarketingGrowthArtifact,
} from "@squads/marketing-growth/lib/marketing-growth/artifacts"
import {
  SeoGeoArtifactTypes,
  parseSeoGeoArtifact,
} from "@squads/seo-geo/lib/seo-geo/artifacts"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

const packages = [
  {
    id: "marketing-growth",
    name: "Marketing & Growth Strategy",
    workflowID: "marketing-growth-campaign",
    agentIDs: [
      "marketing-growth-planner",
      "marketing-growth-evidence-researcher",
      "marketing-growth-audience-analyst",
      "marketing-growth-channel-analyst",
      "marketing-growth-strategist",
      "marketing-growth-fact-checker",
      "marketing-growth-campaign-writer",
    ],
    dependencies: {
      "marketing-growth-planner": [],
      "marketing-growth-evidence-researcher": ["marketing-growth-planner"],
      "marketing-growth-audience-analyst": ["marketing-growth-evidence-researcher"],
      "marketing-growth-channel-analyst": ["marketing-growth-evidence-researcher"],
      "marketing-growth-strategist": [
        "marketing-growth-audience-analyst",
        "marketing-growth-channel-analyst",
      ],
      "marketing-growth-fact-checker": ["marketing-growth-strategist"],
      "marketing-growth-campaign-writer": ["marketing-growth-fact-checker"],
    },
    artifactTypes: MarketingGrowthArtifactTypes,
    parseArtifact: parseMarketingGrowthArtifact,
  },
  {
    id: "seo-geo",
    name: "SEO & Generative Engine Optimization",
    workflowID: "search-generative-discovery-plan",
    agentIDs: [
      "seo-geo-planner",
      "seo-geo-source-researcher",
      "seo-geo-search-analyst",
      "seo-geo-generative-analyst",
      "seo-geo-strategist",
      "seo-geo-fact-checker",
      "seo-geo-plan-writer",
    ],
    dependencies: {
      "seo-geo-planner": [],
      "seo-geo-source-researcher": ["seo-geo-planner"],
      "seo-geo-search-analyst": ["seo-geo-source-researcher"],
      "seo-geo-generative-analyst": ["seo-geo-source-researcher"],
      "seo-geo-strategist": ["seo-geo-generative-analyst", "seo-geo-search-analyst"],
      "seo-geo-fact-checker": ["seo-geo-strategist"],
      "seo-geo-plan-writer": ["seo-geo-fact-checker"],
    },
    artifactTypes: SeoGeoArtifactTypes,
    parseArtifact: parseSeoGeoArtifact,
  },
] as const

describe("Growth and discovery Expert Squad packages", () => {
  for (const definition of packages) {
    test(`${definition.id} loads its complete released contract`, async () => {
      const packageRoot = path.resolve(
        import.meta.dir,
        "../../../..",
        "expert-squads",
        "builtin",
        definition.id,
      )
      const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
      const workflow = loaded.manifest.capability_projection.virtual_workflows[definition.workflowID]!

      expect(loaded.manifest).toMatchObject({
        schema_version: 1,
        namespace: "builtin",
        id: definition.id,
        name: definition.name,
        label: definition.name,
        version: "2026.08.13.1",
        product_pillars: ["work"],
      })
      expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(definition.agentIDs)
      expect(
        Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on])),
      ).toEqual(definition.dependencies)
      expect([...loaded.packageSkills.keys()]).toEqual([
        `${definition.id}/shared/method`,
        `${definition.id}/shared/workflow`,
      ])
      expect([...loaded.packageToolBundles.keys()]).toEqual([
        `${definition.id}/shared/publish-${definition.id}-artifact`,
      ])
    })

    test(`${definition.id} parses every current Artifact ABI payload`, () => {
      for (const [index, artifactType] of definition.artifactTypes.entries()) {
        const parsed = definition.parseArtifact(artifactType, {
          stage: artifactType,
          scope: `Acceptance scope ${index + 1}`,
          as_of: "2026-08-10",
          evidence: [
            {
              statement: `Observed fact ${index + 1}`,
              source: "Operator-provided acceptance material",
              source_url: null,
              as_of: "2026-08-10",
            },
          ],
          findings: [{ finding: `Finding ${index + 1}`, evidence_indexes: [0], confidence: "high" }],
          decisions: [`Decision ${index + 1}`],
          unknowns: [],
          resource_roles: [],
        })
        expect(parsed).toMatchObject({ artifactType, payload: { stage: artifactType } })
      }
    })

    test(`${definition.id} projects the exact workflow, Skills, and typed publisher`, async () => {
      await using project = await memoryProject()
      const packageRoot = path.resolve(
        import.meta.dir,
        "../../../..",
        "expert-squads",
        "builtin",
        definition.id,
      )
      await ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: packageRoot,
        replace: false,
        installationScope: "project",
      })
      await Instance.provide({
        directory: project.path,
        fn: async () => {
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
            packageRevision: { id: definition.id, version: "2026.08.13.1" },
          })
          expect(scheduler.productionSkills.map((skill) => skill.ref)).toEqual([
            `${definition.id}/shared/method`,
            `${definition.id}/shared/workflow`,
          ])
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual([definition.workflowID])

          for (const agentID of definition.agentIDs) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker.productionSkills.map((skill) => skill.ref)).toEqual([
              `${definition.id}/shared/method`,
              `${definition.id}/shared/workflow`,
            ])
            expect(worker.packageTools.map((entry) => entry.ref)).toEqual([
              `${definition.id}/shared/publish-${definition.id}-artifact`,
            ])
          }
        },
      })
    }, 30_000)
  }
})
