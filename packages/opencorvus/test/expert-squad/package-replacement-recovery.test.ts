import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import { ExpertSquadInstallLock } from "../../src/expert-squad/install-lock"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

async function materializePayloadSource(
  root: string,
  source: (typeof payloadPackageSources)[number],
  readmeSuffix: string,
) {
  for (const [relativePath, content] of Object.entries(source.files)) {
    const target = path.join(root, ...relativePath.split("/"))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, ExpertSquadRegistry.embeddedPackageFileBytes(content))
  }
  await fs.appendFile(path.join(root, "README.md"), readmeSuffix)
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Expert Squad package replacement recovery", () => {
  test("commits an exact replacement when journal cleanup fails after the backup commit point", async () => {
    await using project = await memoryProject()
    const source = payloadPackageSources[2]!
    const priorRoot = path.join(project.path, "prior-payload-source")
    const currentRoot = path.join(project.path, "current-payload-source")
    await materializePayloadSource(priorRoot, source, "\nPrior managed payload revision.\n")
    await materializePayloadSource(currentRoot, source, "")
    const prior = await ExpertSquadRegistry.loadSourcePackage(priorRoot)
    const current = await ExpertSquadRegistry.loadSourcePackage(currentRoot)
    await ExpertSquadPackageManager.importDirectory({
      projectDirectory: project.path,
      sourceDirectory: priorRoot,
      installationScope: "project",
    })

    const restoreHook = ExpertSquadPackageManager.TestHooks.failAfterBackupRemovalBeforeJournalRemovalOnce()
    try {
      const receipt = await ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: currentRoot,
        installationScope: "project",
        expectedCurrentPackageDigest: prior.packageDigest,
      })
      const installed = await ExpertSquadRegistry.loadInstalledCatalogPackage({
        projectDirectory: project.path,
        installationScope: "project",
        namespace: source.namespace,
        id: source.id,
      })
      const scratch = path.join(project.path, ".opencorvus", "expert-squad-staging")
      const leftovers = (await fs.readdir(scratch)).filter((name) => name.includes(source.id))

      expect(receipt).toMatchObject({
        operation: "replaced",
        before: { packageDigest: prior.packageDigest },
        after: { packageDigest: current.packageDigest },
      })
      expect(installed?.packageDigest).toBe(current.packageDigest)
      expect(leftovers).toEqual([])
    } finally {
      restoreHook()
    }
  }, 120_000)

  test("returns a typed validation error for a tampered replacement journal and preserves peer recovery evidence", async () => {
    await using project = await memoryProject()
    const location = ExpertSquadPackageLocations.project(project.path)
    const scratch = path.join(location.configRoot, "expert-squad-staging")
    const id = "safe-id"
    const namespace = "builtin"
    const operationID = "11111111-1111-4111-8111-111111111111"
    const label = `${namespace}-${id}-${operationID}`
    await fs.mkdir(scratch, { recursive: true })
    const sentinel = path.join(scratch, "other-package-recovery-evidence.txt")
    await fs.writeFile(sentinel, "must survive tampered journal validation\n")
    await fs.writeFile(
      path.join(scratch, `.package-replacement-${id}.json`),
      JSON.stringify({
        protocol: "opencorvus/expert-squad-package-replacement-intent@1",
        operationID,
        target: path.join(location.packagesRoot, namespace, id),
        staging: path.join(scratch, `.staging-${label}`),
        backup: path.join(scratch, `.replace-${label}`),
        discard: scratch,
        installationScope: "project",
        projectDirectory: project.path,
        namespace,
        id,
        beforePackageDigest: "0".repeat(64),
        afterPackageDigest: "1".repeat(64),
      }),
    )

    await expect(
      ExpertSquadInstallLock.run(id, (lease) =>
        ExpertSquadPackageManager.reconcilePendingPackageMutationUnderLease({
          projectDirectory: project.path,
          id,
          lease,
        }),
      ),
    ).rejects.toThrow(/mutation journal discard does not equal/)
    expect(await fs.readFile(sentinel, "utf8")).toBe("must survive tampered journal validation\n")
  })
})
