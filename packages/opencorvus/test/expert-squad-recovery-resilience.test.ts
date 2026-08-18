import { describe, expect, test } from "bun:test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { ExpertSquadPackageLocations } from "../src/expert-squad/locations"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { Instance } from "../src/project/instance"
import { memoryProject } from "./fixture/memory"

describe("Expert Squad package mutation recovery resilience", () => {
  test("retains an unreconcilable journal and still opens the project", async () => {
    const project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const location = ExpertSquadPackageLocations.resolve("project", project.path)
        const scratch = path.join(location.configRoot, "expert-squad-staging")
        await mkdir(scratch, { recursive: true })
        // A journal whose own identity cannot be reconstructed. Background
        // reconciliation must report it and continue instead of failing the
        // surrounding project or catalog open.
        const corrupt = path.join(scratch, ".evolution-mutation-corrupt.json")
        await writeFile(corrupt, "{ not valid json", "utf8")

        await expect(ExpertSquadPackageManager.reconcilePendingPackageMutations(project.path)).resolves.toBeUndefined()
        expect(await readFile(corrupt, "utf8")).toBe("{ not valid json")

        // A well-formed journal whose filename disagrees with its manifest ID is
        // equally unreconcilable and equally non-blocking.
        const mismatched = path.join(scratch, ".evolution-mutation-mismatched.json")
        await writeFile(
          mismatched,
          JSON.stringify({
            id: "some-other-id",
            operationID: "op-1",
            installationScope: "project",
            projectDirectory: project.path,
            namespace: "evolution-test",
            beforePackageDigest: "a".repeat(64),
            afterPackageDigest: "b".repeat(64),
          }),
          "utf8",
        )

        await expect(ExpertSquadPackageManager.reconcilePendingPackageMutations(project.path)).resolves.toBeUndefined()
        expect(await readFile(mismatched, "utf8")).toContain("some-other-id")
      },
    })
  })
})
