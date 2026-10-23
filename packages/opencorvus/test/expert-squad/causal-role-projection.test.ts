import { afterAll, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { EffectiveConfig } from "../../src/config/effective"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

for (const [id, agentID] of [
  ["review-debug", "review-debug-root-cause-investigator"],
  ["evolution-lab", "evolution-failure-analyst"],
] as const) {
  test(`${id} projects its independent causal proof through the general development contract`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await ExpertSquadPackageManager.installPayloadPackage({
          projectDirectory: project.path,
          id,
          installationScope: "project",
        })
        const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), { prompt_profile: { active: id } })
        const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        const worker = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision,
          agentID,
        })
        expect(worker.identity).toMatchObject({
          agentID,
          baseRole: "delegated-worker",
          dispatchAdapterID: "delegated_worker",
        })
        expect(worker.builtInToolIDs).toEqual(
          expect.arrayContaining(["read", "bash", "skill", "artifact_read", "artifact_publish"]),
        )
        expect(worker.productionSkills.map((skill) => skill.ref)).toEqual(
          expect.arrayContaining([`${id}/shared/${id === "review-debug" ? "workflow" : "campaign"}`]),
        )
        expect(worker.packageRevision).toEqual(packageRevision)
      },
    })
  })
}
