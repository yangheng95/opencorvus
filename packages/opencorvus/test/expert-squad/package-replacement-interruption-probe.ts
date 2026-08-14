import fs from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"

const mode = process.argv[2]
const projectDirectory = process.argv[3]
const supportedModes = ["crash-before", "crash-after", "recover-before", "recover-after"] as const
if (!supportedModes.includes(mode as (typeof supportedModes)[number]) || !projectDirectory) {
  throw new Error("Package replacement interruption probe requires a supported mode and isolated project directory")
}

const source = payloadPackageSources.find((candidate) => candidate.id === "cloud-platform-architecture")
if (!source) throw new Error("Package replacement interruption fixture is unavailable")
const priorSourceRoot = path.join(projectDirectory, "prior-package-source")
const currentSourceRoot = path.join(projectDirectory, "current-package-source")

async function materializeSource(root: string, readmeSuffix: string) {
  for (const [relativePath, content] of Object.entries(source.files)) {
    const target = path.join(root, ...relativePath.split("/"))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, ExpertSquadRegistry.embeddedPackageFileBytes(content))
  }
  await fs.appendFile(path.join(root, "README.md"), readmeSuffix)
}

async function prepareInterruptedReplacement(interruption: "before" | "after") {
  await fs.mkdir(projectDirectory, { recursive: true })
  await materializeSource(priorSourceRoot, "\nPrior package revision.\n")
  await materializeSource(currentSourceRoot, "")
  const prior = await ExpertSquadRegistry.loadSourcePackage(priorSourceRoot)
  await ExpertSquadPackageManager.importDirectory({
    projectDirectory,
    sourceDirectory: priorSourceRoot,
    installationScope: "project",
  })

  if (interruption === "before") {
    ExpertSquadPackageManager.TestHooks.interruptAfterTargetMoveBeforeInstallOnce()
  } else {
    ExpertSquadPackageManager.TestHooks.interruptAfterTargetInstallBeforeBackupCleanupOnce()
  }
  await ExpertSquadPackageManager.importDirectory({
    projectDirectory,
    sourceDirectory: currentSourceRoot,
    installationScope: "project",
    expectedCurrentPackageDigest: prior.packageDigest,
  })
  throw new Error("Expected abrupt package replacement interruption")
}

async function recoverInterruptedReplacement(expectedRevision: "before" | "after") {
  const prior = await ExpertSquadRegistry.loadSourcePackage(priorSourceRoot)
  const current = await ExpertSquadRegistry.loadSourcePackage(currentSourceRoot)
  const discovery = await ExpertSquadRegistry.discoverAvailable(projectDirectory)
  const installed = await ExpertSquadRegistry.loadInstalledCatalogPackage({
    projectDirectory,
    installationScope: "project",
    namespace: source.namespace,
    id: source.id,
  })
  const expectedDigest = expectedRevision === "before" ? prior.packageDigest : current.packageDigest
  const scratch = path.join(projectDirectory, ".opencorvus", "expert-squad-staging")
  const leftovers = (await fs.readdir(scratch)).filter(
    (name) => name.includes(source.id) || name === `.package-replacement-${source.id}.json`,
  )
  const declaration = discovery.installations.find((candidate) => candidate.id === source.id)

  if (installed?.packageDigest !== expectedDigest || declaration?.installationScope !== "project" || leftovers.length) {
    throw new Error(
      `Interrupted package replacement did not converge: ${JSON.stringify({ installed, declaration, leftovers })}`,
    )
  }
  console.log(
    JSON.stringify({
      id: source.id,
      expectedRevision,
      packageDigest: installed.packageDigest,
      leftovers,
    }),
  )
}

if (mode === "crash-before") await prepareInterruptedReplacement("before")
else if (mode === "crash-after") await prepareInterruptedReplacement("after")
else if (mode === "recover-before") await recoverInterruptedReplacement("before")
else await recoverInterruptedReplacement("after")
