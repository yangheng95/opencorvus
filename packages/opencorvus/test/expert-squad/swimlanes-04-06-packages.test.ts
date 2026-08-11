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
    id: "customer-success",
    name: "Customer Success Operations",
    workflowID: "customer-success-operating-plan",
    skillRef: "customer-success/shared/method",
    agentIDs: [
      "customer-success-evidence-analyst",
      "customer-success-lifecycle-analyst",
      "customer-success-operations-designer",
      "customer-success-plan-reviewer",
    ],
    dependencies: {
      "customer-success-evidence-analyst": [],
      "customer-success-lifecycle-analyst": [],
      "customer-success-operations-designer": [
        "customer-success-evidence-analyst",
        "customer-success-lifecycle-analyst",
      ],
      "customer-success-plan-reviewer": ["customer-success-operations-designer"],
    },
    skillEvidence: [
      "https://github.com/coreyhaines31/marketingskills",
      "7868cb9251fad80a73d26e488a5ad5f6c4a9f335",
      "Massachusetts Institute of Technology (MIT) License",
    ],
    skillFiles: ["references/UPSTREAM-LICENSE.md", "SKILL.md"],
  },
  {
    id: "finance-operations",
    name: "Finance Operations",
    workflowID: "finance-operations-close-plan",
    skillRef: "finance-operations/shared/method",
    agentIDs: [
      "finance-operations-record-analyst",
      "finance-operations-controls-analyst",
      "finance-operations-close-planner",
      "finance-operations-reviewer",
    ],
    dependencies: {
      "finance-operations-record-analyst": [],
      "finance-operations-controls-analyst": [],
      "finance-operations-close-planner": ["finance-operations-controls-analyst", "finance-operations-record-analyst"],
      "finance-operations-reviewer": ["finance-operations-close-planner"],
    },
    skillEvidence: [
      "clean-room for OpenCorvus",
      "does not provide financial, investment, accounting, audit, legal, or tax advice",
      "require review and approval",
    ],
    skillFiles: ["SKILL.md"],
  },
  {
    id: "meeting-knowledge",
    name: "Meeting Knowledge Operations",
    workflowID: "meeting-knowledge-publication",
    skillRef: "meeting-knowledge/shared/method",
    agentIDs: [
      "meeting-evidence-curator",
      "meeting-decision-analyst",
      "meeting-knowledge-editor",
      "meeting-knowledge-reviewer",
    ],
    dependencies: {
      "meeting-evidence-curator": [],
      "meeting-decision-analyst": [],
      "meeting-knowledge-editor": ["meeting-decision-analyst", "meeting-evidence-curator"],
      "meeting-knowledge-reviewer": ["meeting-knowledge-editor"],
    },
    skillEvidence: ["clean-room for OpenCorvus", "Never turn discussion into a decision", "source locator"],
    skillFiles: ["SKILL.md"],
  },
] as const

function packageRoot(id: string): string {
  return path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)
}

function skillText(
  loaded: Awaited<ReturnType<typeof ExpertSquadRegistry.loadSourcePackage>>,
  skillRef: string,
): string {
  return loaded.packageSkills.get(skillRef)!.content
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Expert Squad swimlanes 04-06 packages", () => {
  for (const definition of packages) {
    test(`${definition.id} loads one saved method Skill and its four-Agent join workflow`, async () => {
      const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot(definition.id))
      const workflow = loaded.manifest.capability_projection.virtual_workflows[definition.workflowID]!
      const method = loaded.packageSkills.get(definition.skillRef)!

      expect(loaded.manifest).toMatchObject({
        schema_version: 1,
        namespace: "builtin",
        id: definition.id,
        name: definition.name,
        label: definition.name,
        version: "2026.08.10.1",
        product_pillars: ["work"],
      })
      expect([...loaded.packageSkills.keys()]).toEqual([definition.skillRef])
      expect(method.snapshot.files.map((file) => file.path)).toEqual(definition.skillFiles)
      expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(definition.agentIDs)
      expect(loaded.manifest.capability_projection.scheduler.package_skill_refs).toEqual([definition.skillRef])
      expect(
        definition.agentIDs.map((agentID) => loaded.manifest.capability_projection.agents[agentID]!.package_skill_refs),
      ).toEqual(definition.agentIDs.map(() => [definition.skillRef]))
      expect(
        Object.fromEntries(Object.entries(workflow.nodes).map(([nodeID, node]) => [nodeID, node.depends_on])),
      ).toEqual(definition.dependencies)
      for (const evidence of definition.skillEvidence)
        expect(skillText(loaded, definition.skillRef)).toContain(evidence)
    })
  }

  test("installs and projects every lane through the real Registry and Prompt Profile Resolver", async () => {
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
            packageRevision: { id: definition.id, version: "2026.08.10.1" },
          })
          expect(scheduler.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source }))).toEqual([
            { ref: definition.skillRef, source: "package" },
          ])
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
              skills: worker.productionSkills.map((skill) => ({ ref: skill.ref, source: skill.source })),
            })),
          ).toEqual(
            definition.agentIDs.map((agentID) => ({
              id: agentID,
              skills: [{ ref: definition.skillRef, source: "package" }],
            })),
          )
        }
      },
    })
  }, 30_000)
})
