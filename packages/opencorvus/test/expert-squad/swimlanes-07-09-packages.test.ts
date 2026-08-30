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
    id: "procurement-vendor",
    name: "Procurement & Vendor Decision",
    skillName: "procurement-vendor-method",
    skillRef: "procurement-vendor/shared/method",
    workflowID: "vendor-decision-pack",
    parallelAgentIDs: [
      "procurement-commercial-analyst",
      "procurement-diligence-analyst",
      "procurement-governance-reviewer",
    ],
    joinDependencyIDs: [
      "procurement-commercial-analyst",
      "procurement-diligence-analyst",
      "procurement-governance-reviewer",
    ],
    joinAgentID: "procurement-decision-integrator",
  },
  {
    id: "localization-adaptation",
    name: "Localization & Adaptation",
    skillName: "localization-adaptation-method",
    skillRef: "localization-adaptation/shared/method",
    workflowID: "locale-release-pack",
    parallelAgentIDs: ["localization-terminology-steward", "localization-locale-adapter", "localization-linguistic-qa"],
    joinDependencyIDs: [
      "localization-linguistic-qa",
      "localization-locale-adapter",
      "localization-terminology-steward",
    ],
    joinAgentID: "localization-release-integrator",
  },
  {
    id: "knowledge-base-operations",
    name: "Knowledge Base Operations",
    skillName: "knowledge-base-operations-method",
    skillRef: "knowledge-base-operations/shared/method",
    workflowID: "grounded-knowledge-release",
    parallelAgentIDs: ["knowledge-source-curator", "knowledge-change-editor", "knowledge-lifecycle-governor"],
    joinDependencyIDs: ["knowledge-change-editor", "knowledge-lifecycle-governor", "knowledge-source-curator"],
    joinAgentID: "knowledge-publication-integrator",
  },
] as const

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Expert Squad implementation swimlanes 07-09", () => {
  for (const definition of packages) {
    test(`${definition.id} loads its Skill-complete parallel-to-join source package`, async () => {
      const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", definition.id)
      const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
      const workflow = loaded.manifest.capability_projection.virtual_workflows[definition.workflowID]!
      const agentIDs = [...definition.parallelAgentIDs, definition.joinAgentID]

      expect(loaded.manifest).toMatchObject({
        schema_version: 2,
        namespace: "builtin",
        id: definition.id,
        name: definition.name,
        label: definition.name,
        version: "2026.08.30.1",
        product_pillars: ["work"],
      })
      expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(agentIDs)
      expect(Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on]))).toEqual({
        ...Object.fromEntries(definition.parallelAgentIDs.map((agentID) => [agentID, []])),
        [definition.joinAgentID]: definition.joinDependencyIDs,
      })
      expect(
        Object.entries(workflow.nodes)
          .filter(([, node]) => node.depends_on.length === 0)
          .map(([agentID]) => agentID),
      ).toEqual(definition.parallelAgentIDs)
      expect(workflow.nodes[definition.joinAgentID]!.depends_on).toEqual(definition.joinDependencyIDs)

      expect([...loaded.packageSkills.keys()]).toEqual([definition.skillRef])
      const skill = loaded.packageSkills.get(definition.skillRef)!
      expect(skill.definition).toMatchObject({ name: definition.skillName })
      expect(skill.snapshot).toMatchObject({
        ref: definition.skillRef,
        source: "skills/method/SKILL.md",
        files: [{ path: "SKILL.md", bytes: skill.bundle.skill.length }],
      })
      expect(skill.snapshot.sha256).toMatch(/^[a-f0-9]{64}$/)
    }, 30_000)

    test(`${definition.id} installs and projects its exact Skill and workflow through the active Registry revision`, async () => {
      await using project = await memoryProject()
      const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", definition.id)
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
            packageRevision: { id: definition.id, version: "2026.08.30.1" },
          })
          expect(scheduler.productionSkills).toMatchObject([
            {
              authority: "manifest",
              source: "package",
              ref: definition.skillRef,
              skill: { name: definition.skillName },
              snapshot: { source: "skills/method/SKILL.md" },
            },
          ])
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual([definition.workflowID])

          for (const agentID of [...definition.parallelAgentIDs, definition.joinAgentID]) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker).toMatchObject({
              expertSquadID: definition.id,
              packageRevision: { id: definition.id, version: "2026.08.30.1" },
              productionSkills: [
                {
                  authority: "manifest",
                  source: "package",
                  ref: definition.skillRef,
                  skill: { name: definition.skillName },
                  snapshot: { source: "skills/method/SKILL.md" },
                },
              ],
            })
          }
        },
      })
    }, 30_000)
  }
})
