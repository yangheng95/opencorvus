import fs from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"

const mode = process.argv[2]
const projectDirectory = process.argv[3]
if ((mode !== "crash" && mode !== "crash-cleanup" && mode !== "recover") || !projectDirectory) {
  throw new Error(
    "Default payload interruption probe requires crash|crash-cleanup|recover and an isolated project directory",
  )
}

const source = payloadPackageSources.find((candidate) => candidate.id === "cloud-platform-architecture")
if (!source) throw new Error("Default payload interruption probe requires cloud-platform-architecture")
const payload = ExpertSquadPackageManager.validatePayloadPackageSource(source)

async function writeModifiedPriorSource(root: string) {
  for (const [relativePath, content] of Object.entries(source.files)) {
    const target = path.join(root, ...relativePath.split("/"))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, ExpertSquadRegistry.embeddedPackageFileBytes(content))
  }
  await fs.appendFile(path.join(root, "README.md"), "\nPrior managed application payload revision.\n")
}

async function prepareInterruptedUpgrade() {
  await fs.mkdir(projectDirectory, { recursive: true })
  await ExpertSquadPackageManager.provisionDefaultPayloadPackages({ projectDirectory })
  const current = await ExpertSquadRegistry.loadInstalledCatalogPackage({
    projectDirectory,
    installationScope: "project",
    namespace: source.namespace,
    id: source.id,
  })
  if (!current) throw new Error(`Expected ${source.id} after fresh default provisioning`)

  const priorSourceRoot = path.join(projectDirectory, "prior-managed-payload")
  await writeModifiedPriorSource(priorSourceRoot)
  const prior = await ExpertSquadRegistry.loadSourcePackage(priorSourceRoot)
  await ExpertSquadPackageManager.importDirectory({
    projectDirectory,
    sourceDirectory: priorSourceRoot,
    installationScope: "project",
    expectedCurrentPackageDigest: current.packageDigest,
  })

  const statePath = ProjectRuntimePaths.expertSquadPayloadProvisioningState(projectDirectory)
  const state = JSON.parse(await fs.readFile(statePath, "utf8")) as {
    entries: Array<{
      id: string
      payload_digest: string
      disposition: string
      installed_package_digest: string | null
    }>
  }
  const entry = state.entries.find((candidate) => candidate.id === source.id)
  if (!entry) throw new Error(`Expected provisioning ledger entry for ${source.id}`)
  entry.payload_digest = prior.packageDigest
  entry.disposition = "managed"
  entry.installed_package_digest = prior.packageDigest
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)

  if (mode === "crash-cleanup") {
    ExpertSquadPackageManager.TestHooks.interruptAfterTargetInstallBeforeBackupCleanupOnce()
  } else {
    ExpertSquadPackageManager.TestHooks.interruptAfterTargetMoveBeforeInstallOnce()
  }
  await ExpertSquadPackageManager.provisionDefaultPayloadPackages({ projectDirectory })
  throw new Error("Expected abrupt package replacement interruption")
}

async function recoverInterruptedUpgrade() {
  const result = await ExpertSquadPackageManager.provisionDefaultPayloadPackages({ projectDirectory })
  const installed = await ExpertSquadRegistry.loadInstalledCatalogPackage({
    projectDirectory,
    installationScope: "project",
    namespace: source.namespace,
    id: source.id,
  })
  if (!installed) throw new Error(`Recovery did not restore and update ${source.id}`)
  const state = JSON.parse(
    await fs.readFile(ProjectRuntimePaths.expertSquadPayloadProvisioningState(projectDirectory), "utf8"),
  ) as {
    entries: Array<{
      id: string
      payload_digest: string
      disposition: string
      installed_package_digest: string | null
    }>
  }
  const entry = state.entries.find((candidate) => candidate.id === source.id)
  if (!entry) throw new Error(`Recovery did not retain provisioning ledger entry for ${source.id}`)
  const scratch = path.join(projectDirectory, ".opencorvus", "expert-squad-staging")
  const leftovers = (await fs.readdir(scratch)).filter(
    (name) => name.includes(source.id) || name === `.package-replacement-${source.id}.json`,
  )

  if (
    installed.packageDigest !== payload.packageDigest ||
    entry.disposition !== "managed" ||
    entry.payload_digest !== payload.packageDigest ||
    entry.installed_package_digest !== payload.packageDigest ||
    leftovers.length !== 0
  ) {
    throw new Error(
      `Interrupted replacement recovery did not converge: ${JSON.stringify({ installed, entry, leftovers })}`,
    )
  }

  console.log(
    JSON.stringify({
      id: source.id,
      packageDigest: installed.packageDigest,
      updated: result.updated.map((receipt) => receipt.after.id),
      disposition: entry.disposition,
      leftovers,
    }),
  )
}

if (mode === "crash" || mode === "crash-cleanup") {
  await prepareInterruptedUpgrade()
} else {
  await recoverInterruptedUpgrade()
}
