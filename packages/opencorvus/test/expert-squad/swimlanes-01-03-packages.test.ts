import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packages = [
  {
    id: "browser-research-acceptance",
    version: "2026.08.13.1",
    name: "Browser Research & Acceptance",
    productPillars: ["code", "work"],
    skillName: "browser-evidence-acceptance",
    skillRef: "browser-research-acceptance/shared/browser-evidence-acceptance",
    workflowID: "browser-evidence-acceptance",
    agentIDs: [
      "browser-research-planner",
      "browser-evidence-observer",
      "browser-acceptance-reviewer",
    ],
    dependencies: {
      "browser-research-planner": [],
      "browser-evidence-observer": ["browser-research-planner"],
      "browser-acceptance-reviewer": ["browser-research-planner"],
    },
    skillFiles: ["SKILL.md", "references/upstream.md", "references/upstream-license.txt"],
    skillEvidence: [
      "https://github.com/Tencent/BrowserSkill",
      "610782698bb3229303ba243dec79e796bd46b574",
      "License at the pinned commit: MIT",
    ],
  },
  {
    id: "office-delivery",
    version: "2026.08.13.4",
    name: "Office Delivery",
    productPillars: ["work"],
    skillName: "office-delivery-method",
    skillRef: "office-delivery/shared/office-delivery-method",
    workflowID: "planned-office-delivery",
    agentIDs: ["office-source-analyst", "office-delivery-builder", "office-delivery-planner"],
    dependencies: {
      "office-delivery-planner": [],
      "office-source-analyst": ["office-delivery-planner"],
      "office-delivery-builder": ["office-delivery-planner"],
    },
    skillFiles: ["SKILL.md"],
    skillEvidence: ["clean-room OpenCorvus method", "Source and data branch", "Review the actual deliverables"],
  },
  {
    id: "product-management",
    version: "2026.08.13.1",
    name: "Product Management",
    productPillars: ["work"],
    skillName: "evidence-backed-product-planning",
    skillRef: "product-management/shared/evidence-backed-product-planning",
    workflowID: "evidence-backed-product-decision",
    agentIDs: [
      "product-problem-framer",
      "product-customer-evidence-analyst",
      "product-solution-strategist",
      "product-decision-owner",
    ],
    dependencies: {
      "product-problem-framer": [],
      "product-customer-evidence-analyst": ["product-problem-framer"],
      "product-solution-strategist": ["product-problem-framer"],
      "product-decision-owner": ["product-customer-evidence-analyst", "product-solution-strategist"],
    },
    skillFiles: ["SKILL.md", "references/upstream.md", "references/upstream-license.txt"],
    skillEvidence: [
      "https://github.com/obra/superpowers",
      "44c9b2d6e889982ac18c27d05a19fefe335194e1",
      "License at the pinned commit: MIT",
      "excludes the upstream global startup protocol",
    ],
  },
] as const

function packageRoot(id: string): string {
  return path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)
}

function skillBundleText(
  loaded: Awaited<ReturnType<typeof ExpertSquadRegistry.loadSourcePackage>>,
  skillRef: string,
): string {
  const skill = loaded.packageSkills.get(skillRef)!
  return [skill.bundle.skill, ...Object.values(skill.bundle.files)]
    .map((file) => {
      if (typeof file === "string") return file
      if (file.encoding === "utf8") return file.content
      return Buffer.from(file.content, "base64").toString("utf8")
    })
    .join("\n")
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Expert Squad swimlanes 01-03 packages", () => {
  for (const definition of packages) {
    test(`${definition.id} loads its saved Skill and explicit parallel join`, async () => {
      const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot(definition.id))
      const projection = loaded.manifest.capability_projection
      const workflow = projection.virtual_workflows[definition.workflowID]!
      const skill = loaded.packageSkills.get(definition.skillRef)!

      expect(loaded.manifest).toMatchObject({
        schema_version: 1,
        namespace: "builtin",
        id: definition.id,
        name: definition.name,
        label: definition.name,
        version: definition.version,
        product_pillars: definition.productPillars,
      })
      expect([...loaded.packageSkills.keys()]).toEqual([definition.skillRef])
      expect(skill.definition).toMatchObject({ name: definition.skillName })
      expect(skill.snapshot).toMatchObject({
        ref: definition.skillRef,
        source: `skills/${definition.skillName}/SKILL.md`,
      })
      expect(skill.snapshot.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(skill.snapshot.files.map((file) => file.path)).toEqual(expect.arrayContaining([...definition.skillFiles]))
      for (const evidence of definition.skillEvidence) {
        expect(skillBundleText(loaded, definition.skillRef)).toContain(evidence)
      }

      expect(Object.keys(projection.agents)).toEqual([...definition.agentIDs])
      expect(projection.scheduler.package_skill_refs).toEqual([definition.skillRef])
      expect(definition.agentIDs.map((agentID) => projection.agents[agentID]!.package_skill_refs)).toEqual(
        definition.agentIDs.map(() => [definition.skillRef]),
      )
      expect(
        Object.fromEntries(Object.entries(workflow.nodes).map(([nodeID, node]) => [nodeID, node.depends_on])),
      ).toEqual(definition.dependencies)
    }, 30_000)
  }

  test("installs and projects all three package Skills and workflows through the active Registry revision", async () => {
    await using project = await memoryProject()
    for (const definition of packages) {
      await ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: packageRoot(definition.id),
        installationScope: "project",
      })
    }

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const definition of packages) {
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
            packageRevision: { id: definition.id, version: definition.version },
            productionSkills: [
              {
                authority: "manifest",
                source: "package",
                ref: definition.skillRef,
                skill: { name: definition.skillName },
                snapshot: { source: `skills/${definition.skillName}/SKILL.md` },
              },
            ],
          })
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual([definition.workflowID])

          const workers = await Promise.all(
            definition.agentIDs.map((agentID) =>
              PromptProfileResolver.resolveWorkerCapability({
                projectDirectory: project.path,
                config,
                packageRevision: revision,
                agentID,
              }),
            ),
          )
          expect(
            workers.map((worker) => ({
              id: worker.identity.agentID,
              skills: worker.productionSkills.map((skill) => ({
                authority: skill.authority,
                source: skill.source,
                ref: skill.ref,
              })),
            })),
          ).toEqual(
            definition.agentIDs.map((agentID) => ({
              id: agentID,
              skills: [
                ...(definition.id === "office-delivery" && agentID === "office-delivery-builder"
                  ? [
                      {
                        authority: "manifest" as const,
                        source: "default" as const,
                        ref: "default/skill/work-artifacts",
                      },
                    ]
                  : []),
                {
                  authority: "manifest" as const,
                  source: "package" as const,
                  ref: definition.skillRef,
                },
              ],
            })),
          )
        }
      },
    })
  }, 30_000)
})
