import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
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

describe("repository-hosted Expert Squad default provisioning", () => {
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

  test("rejects a tampered replacement journal scratch alias before filesystem recovery", async () => {
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

    await expect(ExpertSquadPackageManager.reconcilePendingPackageMutations(project.path)).rejects.toThrow(
      /mutation journal discard does not equal/,
    )
    expect(await fs.readFile(sentinel, "utf8")).toBe("must survive tampered journal validation\n")
  })

  test("installs a fresh payload, honors removal and modification, and CAS-updates managed bytes", async () => {
    await using project = await memoryProject()
    const removedSource = payloadPackageSources[0]!
    const updatedSource = payloadPackageSources[1]!

    const fresh = await ExpertSquadPackageManager.provisionDefaultPayloadPackages({
      projectDirectory: project.path,
    })
    const installed = await ExpertSquadRegistry.discoverInstalledPackageIdentities(project.path)

    expect({
      installed: fresh.installed.length,
      updated: fresh.updated,
      unchanged: fresh.unchanged,
      removed: fresh.removed,
      preserved: fresh.preserved,
    }).toEqual({
      installed: payloadPackageSources.length,
      updated: [],
      unchanged: [],
      removed: [],
      preserved: [],
    })
    expect(
      installed
        .filter((entry) => entry.location === "project")
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(payloadPackageSources.map((source) => source.id).sort())

    await ExpertSquadPackageManager.uninstallPackage({
      projectDirectory: project.path,
      id: removedSource.id,
      installationScope: "project",
      beforeRemove: async () => ({ replacementID: "base" as const }),
    })

    const modifiedRoot = path.join(project.path, "modified-payload-source")
    await materializePayloadSource(modifiedRoot, updatedSource, "\nLocal operator-owned package change.\n")
    const modified = await ExpertSquadRegistry.loadSourcePackage(modifiedRoot)
    const current = await ExpertSquadRegistry.loadInstalledCatalogPackage({
      projectDirectory: project.path,
      installationScope: "project",
      namespace: updatedSource.namespace,
      id: updatedSource.id,
    })
    if (!current) throw new Error(`Expected installed payload package ${updatedSource.id}`)
    await ExpertSquadPackageManager.importDirectory({
      projectDirectory: project.path,
      sourceDirectory: modifiedRoot,
      installationScope: "project",
      expectedCurrentPackageDigest: current.packageDigest,
    })

    const operatorChoices = await ExpertSquadPackageManager.provisionDefaultPayloadPackages({
      projectDirectory: project.path,
    })
    expect(operatorChoices.removed).toEqual([
      {
        namespace: removedSource.namespace,
        id: removedSource.id,
        payloadDigest: ExpertSquadPackageManager.validatePayloadPackageSource(removedSource).packageDigest,
      },
    ])
    expect(operatorChoices.preserved).toEqual([
      {
        namespace: updatedSource.namespace,
        id: updatedSource.id,
        payloadDigest: ExpertSquadPackageManager.validatePayloadPackageSource(updatedSource).packageDigest,
        installedPackageDigest: modified.packageDigest,
      },
    ])

    const statePath = ProjectRuntimePaths.expertSquadPayloadProvisioningState(project.path)
    const state = JSON.parse(await fs.readFile(statePath, "utf8")) as {
      entries: Array<{
        id: string
        payload_digest: string
        disposition: string
        installed_package_digest: string | null
      }>
    }
    const managedPriorRevision = state.entries.find((entry) => entry.id === updatedSource.id)
    if (!managedPriorRevision) throw new Error(`Expected provisioning state for ${updatedSource.id}`)
    managedPriorRevision.payload_digest = modified.packageDigest
    managedPriorRevision.disposition = "managed"
    managedPriorRevision.installed_package_digest = modified.packageDigest
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)

    const applicationUpgrade = await ExpertSquadPackageManager.provisionDefaultPayloadPackages({
      projectDirectory: project.path,
    })
    const upgraded = await ExpertSquadRegistry.loadInstalledCatalogPackage({
      projectDirectory: project.path,
      installationScope: "project",
      namespace: updatedSource.namespace,
      id: updatedSource.id,
    })
    const payloadRevision = ExpertSquadPackageManager.validatePayloadPackageSource(updatedSource)

    expect(applicationUpgrade.updated).toEqual([
      expect.objectContaining({
        operation: "replaced",
        before: expect.objectContaining({ packageDigest: modified.packageDigest }),
        after: expect.objectContaining({ packageDigest: payloadRevision.packageDigest }),
      }),
    ])
    expect(upgraded).toMatchObject({
      id: updatedSource.id,
      packageDigest: payloadRevision.packageDigest,
      version: payloadRevision.version,
    })
  }, 120_000)
})
