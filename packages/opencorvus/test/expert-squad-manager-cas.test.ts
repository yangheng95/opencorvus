import { afterAll, describe, expect, spyOn, test } from "bun:test"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { rm } from "node:fs/promises"
import path from "node:path"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { Global } from "../src/global"
import { Instance } from "../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

function emptyProjectionResources() {
  return {
    inherit_base_tools: false,
    built_in_tool_ids: [] as string[],
    default_skill_refs: [] as string[],
    package_skill_refs: [] as string[],
    default_tool_refs: [] as string[],
    package_tool_refs: [] as string[],
    default_mcp_server_refs: [] as string[],
    package_mcp_server_refs: [] as string[],
    default_mcp_tool_refs: [] as string[],
    package_mcp_tool_refs: [] as string[],
    default_mcp_prompt_refs: [] as string[],
    package_mcp_prompt_refs: [] as string[],
    default_mcp_resource_refs: [] as string[],
    package_mcp_resource_refs: [] as string[],
  }
}

function packageDefinition(version: string, marker: string): ExpertSquadPackageDefinition {
  return {
    manifest: {
      schema_version: 1,
      namespace: "evolution-test",
      id: "manager-cas-squad",
      label: "Manager CAS squad",
      description: "Exercises exact package publication receipts.",
      version,
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: "Manager CAS contract package.",
        selection_guidance: "Select only for the Manager CAS contract.",
        instructions: "selector.md",
      },
      capability_projection: {
        scheduler: { ...emptyProjectionResources(), base_role: "orchestrator" },
        agents: {
          "manager-cas-worker": {
            ...emptyProjectionResources(),
            label: "Manager CAS worker",
            description: "Owns the Manager CAS contract fixture.",
            base_role: "build",
            prompt: "agents/manager-cas-worker/system.md",
          },
        },
        virtual_workflows: {},
      },
    },
    files: {
      "README.md": `# Manager CAS squad\n\n${marker}\n`,
      "selector.md": "# Manager CAS selector\n",
      "agents/manager-cas-worker/system.md": `# Manager CAS worker\n\n${marker}\n`,
    },
  }
}

async function writeSource(root: string, version: string, marker: string) {
  const directory = path.join(root, version)
  await writeExpertSquadPackage({ directory, definition: packageDefinition(version, marker) })
  return directory
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Expert Squad Manager package publication", () => {
  test("publishes one CAS winner, restores an exact snapshot, and isolates project/global scope", async () => {
    const sourceRoot = await Global.createTemporaryDirectory("expert-squad-manager-cas-")
    const project = await memoryProject()
    try {
      const sourceV1 = await writeSource(sourceRoot, "2026.08.06.1", "baseline")
      const sourceV2 = await writeSource(sourceRoot, "2026.08.06.2", "candidate two")
      const sourceV3 = await writeSource(sourceRoot, "2026.08.06.3", "candidate three")

      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const installed = await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: sourceV1,
            installationScope: "project",
          })
          expect(installed.operation).toBe("installed")
          expect(installed.before).toBeNull()
          expect(installed.after.installationScope).toBe("project")
          const baselineDigest = installed.after.packageDigest
          const baselineInventory = await ExpertSquadRegistry.discoverAvailable(project.path)
          expect(baselineInventory.items.find((item) => item.id === "manager-cas-squad")?.version).toBe(
            "2026.08.06.1",
          )

          const unchanged = await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: sourceV1,
            installationScope: "project",
          })
          expect(unchanged).toEqual({ operation: "unchanged", before: installed.after, after: installed.after })

          try {
            await ExpertSquadPackageManager.importDirectory({
              projectDirectory: project.path,
              sourceDirectory: sourceV1,
              installationScope: "project",
              expectedCurrentPackageDigest: "a".repeat(64),
            })
            throw new Error("Expected stale idempotent package mutation conflict")
          } catch (error) {
            expect(error).toBeInstanceOf(ExpertSquadPackageManager.ExpertSquadPackageMutationConflictError)
            expect(
              (
                error as InstanceType<
                  typeof ExpertSquadPackageManager.ExpertSquadPackageMutationConflictError
                >
              ).toObject().data.actualCurrentPackageDigest,
            ).toBe(baselineDigest)
          }

          for (const expectedCurrentPackageDigest of [undefined, "a".repeat(64)]) {
            try {
              await ExpertSquadPackageManager.importDirectory({
                projectDirectory: project.path,
                sourceDirectory: sourceV2,
                installationScope: "project",
                expectedCurrentPackageDigest,
              })
              throw new Error("Expected exact package mutation conflict")
            } catch (error) {
              expect(error).toBeInstanceOf(ExpertSquadPackageManager.ExpertSquadPackageMutationConflictError)
              expect(
                (
                  error as InstanceType<
                    typeof ExpertSquadPackageManager.ExpertSquadPackageMutationConflictError
                  >
                ).toObject().data,
              ).toMatchObject({
                id: "manager-cas-squad",
                installationScope: "project",
                actualCurrentPackageDigest: baselineDigest,
              })
            }
          }

          const invalidationFailure = new Error("Injected Registry invalidation failure")
          const invalidateAvailable = ExpertSquadRegistry.invalidateAvailable
          let invalidationCallCount = 0
          const invalidation = spyOn(ExpertSquadRegistry, "invalidateAvailable").mockImplementation(async () => {
            invalidationCallCount += 1
            if (invalidationCallCount === 1) throw invalidationFailure
            return invalidateAvailable()
          })
          try {
            await ExpertSquadPackageManager.importDirectory({
              projectDirectory: project.path,
              sourceDirectory: sourceV2,
              installationScope: "project",
              expectedCurrentPackageDigest: baselineDigest,
            })
            throw new Error("Expected package publication rollback")
          } catch (error) {
            expect(error).toBe(invalidationFailure)
          } finally {
            invalidation.mockRestore()
          }
          const rolledBack = await ExpertSquadRegistry.loadPackage(installed.after.targetRoot)
          expect(rolledBack.packageDigest).toBe(baselineDigest)
          expect(invalidationCallCount).toBe(2)
          const recoveredBaselineInventory = await ExpertSquadRegistry.discoverAvailable(project.path)
          expect(recoveredBaselineInventory.items.find((item) => item.id === "manager-cas-squad")?.version).toBe(
            "2026.08.06.1",
          )

          const replaced = await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: sourceV2,
            installationScope: "project",
            expectedCurrentPackageDigest: baselineDigest,
          })
          expect(replaced.operation).toBe("replaced")
          expect(replaced.before.packageDigest).toBe(baselineDigest)
          const candidateDigest = replaced.after.packageDigest
          const candidateInventory = await ExpertSquadRegistry.discoverAvailable(project.path)
          expect(candidateInventory.items.find((item) => item.id === "manager-cas-squad")?.version).toBe(
            "2026.08.06.2",
          )

          const baselineSnapshot = await ExpertSquadRegistry.loadPackageRevisionSnapshot(baselineDigest)
          const restored = await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: baselineSnapshot.root,
            installationScope: "project",
            expectedCurrentPackageDigest: candidateDigest,
          })
          expect(restored.operation).toBe("replaced")
          expect(restored.before.packageDigest).toBe(candidateDigest)
          expect(restored.after.packageDigest).toBe(baselineDigest)
          const restoredInventory = await ExpertSquadRegistry.discoverAvailable(project.path)
          expect(restoredInventory.items.find((item) => item.id === "manager-cas-squad")?.version).toBe(
            "2026.08.06.1",
          )

          const competing = await Promise.allSettled(
            [sourceV2, sourceV3].map((sourceDirectory) =>
              ExpertSquadPackageManager.importDirectory({
                projectDirectory: project.path,
                sourceDirectory,
                installationScope: "project",
                expectedCurrentPackageDigest: baselineDigest,
              }),
            ),
          )
          const winner = competing.find(
            (result): result is PromiseFulfilledResult<ExpertSquadPackageManager.PackageMutationReceipt> =>
              result.status === "fulfilled",
          )
          const conflict = competing.find((result): result is PromiseRejectedResult => result.status === "rejected")
          expect(winner?.value.operation).toBe("replaced")
          expect(conflict?.reason).toBeInstanceOf(
            ExpertSquadPackageManager.ExpertSquadPackageMutationConflictError,
          )
          const winningDigest = winner!.value.after.packageDigest
          expect(
            (
              conflict!.reason as InstanceType<
                typeof ExpertSquadPackageManager.ExpertSquadPackageMutationConflictError
              >
            ).toObject().data.actualCurrentPackageDigest,
          ).toBe(winningDigest)

          const globalInstall = await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: sourceV1,
            installationScope: "global",
          })
          expect(globalInstall.operation).toBe("installed")
          expect(globalInstall.after.installationScope).toBe("global")
          expect(globalInstall.after.projectDirectory).toBeNull()

          const identities = await ExpertSquadRegistry.discoverInstalledPackageIdentities(project.path)
          const exactInstallations = identities
            .filter((identity) => identity.id === "manager-cas-squad")
            .map((identity) => ({ scope: identity.location, digest: ExpertSquadRegistry.installedPackageDigest(identity.root) }))
          const resolvedInstallations = await Promise.all(
            exactInstallations.map(async (identity) => ({ scope: identity.scope, digest: await identity.digest })),
          )
          expect(resolvedInstallations).toEqual([
            { scope: "global", digest: baselineDigest },
            { scope: "project", digest: winningDigest },
          ])

          const finalRestore = await ExpertSquadPackageManager.importDirectory({
            projectDirectory: project.path,
            sourceDirectory: baselineSnapshot.root,
            installationScope: "project",
            expectedCurrentPackageDigest: winningDigest,
          })
          expect(finalRestore.after.packageDigest).toBe(baselineDigest)
        },
      })
    } finally {
      await project[Symbol.asyncDispose]()
      await rm(sourceRoot, { recursive: true, force: true })
    }
  }, 0)
})
