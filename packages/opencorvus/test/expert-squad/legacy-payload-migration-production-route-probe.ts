import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { Server } from "../../src/server/server"

const projectDirectory = process.argv[2]
if (!projectDirectory) throw new Error("Legacy payload migration probe requires an isolated project directory")
declareNativeTaskProcessDeployment()
await fs.mkdir(projectDirectory, { recursive: true })

const projectSource = payloadPackageSources.find((candidate) => candidate.id === "cloud-platform-architecture")
const globalSource = payloadPackageSources.find((candidate) => candidate.id === "customer-success")
if (!projectSource || !globalSource) throw new Error("Legacy payload migration fixtures are unavailable")

async function materializeSource(root: string, source: (typeof payloadPackageSources)[number]) {
  for (const [relativePath, content] of Object.entries(source.files)) {
    const target = path.join(root, ...relativePath.split("/"))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, ExpertSquadRegistry.embeddedPackageFileBytes(content))
  }
}

async function treeSnapshot(root: string) {
  const files: Array<{ relativePath: string; bytes: Uint8Array }> = []
  async function visit(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const target = path.join(current, entry.name)
      if (entry.isDirectory()) await visit(target)
      else if (entry.isFile()) {
        files.push({
          relativePath: path.relative(root, target).split(path.sep).join("/"),
          bytes: await fs.readFile(target),
        })
      }
    }
  }
  await visit(root)
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const hash = createHash("sha256")
  for (const file of files) {
    hash.update(file.relativePath)
    hash.update("\0")
    hash.update(file.bytes)
    hash.update("\0")
  }
  return { digest: hash.digest("hex"), fileCount: files.length }
}

const sourceRoot = path.join(projectDirectory, "legacy-payload-sources")
const projectSourceRoot = path.join(sourceRoot, projectSource.id)
const globalSourceRoot = path.join(sourceRoot, globalSource.id)
await materializeSource(projectSourceRoot, projectSource)
await materializeSource(globalSourceRoot, globalSource)

const projectReceipt = await ExpertSquadPackageManager.importDirectory({
  projectDirectory,
  sourceDirectory: projectSourceRoot,
  installationScope: "project",
})
const globalReceipt = await ExpertSquadPackageManager.importDirectory({
  projectDirectory,
  sourceDirectory: globalSourceRoot,
  installationScope: "global",
})
await fs.appendFile(path.join(projectReceipt.after.targetRoot, "README.md"), "\nOperator project customization.\n")
await fs.appendFile(path.join(globalReceipt.after.targetRoot, "README.md"), "\nOperator global customization.\n")

const projectBefore = await ExpertSquadRegistry.loadPackage(projectReceipt.after.targetRoot)
const globalBefore = await ExpertSquadRegistry.loadPackage(globalReceipt.after.targetRoot)
const projectBytesBefore = await treeSnapshot(projectReceipt.after.targetRoot)
const globalBytesBefore = await treeSnapshot(globalReceipt.after.targetRoot)
const ledgerPath = path.join(projectDirectory, ".opencorvus", ".r", "project", "expert-squad-payload-provisioning.json")
const ledgerBytes = Buffer.from(
  `${JSON.stringify(
    {
      protocol: "opencorvus/expert-squad-payload-provisioning@1",
      entries: [
        {
          namespace: projectSource.namespace,
          id: projectSource.id,
          disposition: "managed",
          payload_digest: projectReceipt.after.packageDigest,
          installed_package_digest: projectBefore.packageDigest,
        },
      ],
    },
    null,
    2,
  )}\n`,
)
await fs.mkdir(path.dirname(ledgerPath), { recursive: true })
await fs.writeFile(ledgerPath, ledgerBytes)
await Instance.disposeAll()

const app = Server.App()
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 0, fetch: app.fetch })
const origin = `http://${server.hostname}:${server.port}`

try {
  const response = await fetch(`${origin}/expert-squad/catalog`, {
    headers: { "x-opencorvus-directory": projectDirectory },
  })
  if (response.status !== 200)
    throw new Error(`Catalog bootstrap returned ${response.status}: ${await response.text()}`)
  const catalog = (await response.json()) as Record<string, unknown>
  const projectAfter = await ExpertSquadRegistry.loadInstalledCatalogPackage({
    projectDirectory,
    installationScope: "project",
    namespace: projectSource.namespace,
    id: projectSource.id,
  })
  const globalAfter = await ExpertSquadRegistry.loadInstalledCatalogPackage({
    projectDirectory,
    installationScope: "global",
    namespace: globalSource.namespace,
    id: globalSource.id,
  })
  const projectBytesAfter = await treeSnapshot(projectReceipt.after.targetRoot)
  const globalBytesAfter = await treeSnapshot(globalReceipt.after.targetRoot)
  const ledgerAfter = await fs.readFile(ledgerPath)
  const inventoryAfter = await ExpertSquadRegistry.discoverAvailable(projectDirectory)
  const projectDeclaration = inventoryAfter.installations.find(
    (candidate) => candidate.namespace === projectSource.namespace && candidate.id === projectSource.id,
  )
  const globalDeclaration = inventoryAfter.installations.find(
    (candidate) => candidate.namespace === globalSource.namespace && candidate.id === globalSource.id,
  )

  if (
    projectAfter?.packageDigest !== projectBefore.packageDigest ||
    globalAfter?.packageDigest !== globalBefore.packageDigest ||
    projectDeclaration?.installationScope !== "project" ||
    globalDeclaration?.installationScope !== "global" ||
    JSON.stringify(projectBytesAfter) !== JSON.stringify(projectBytesBefore) ||
    JSON.stringify(globalBytesAfter) !== JSON.stringify(globalBytesBefore) ||
    !ledgerAfter.equals(ledgerBytes)
  ) {
    throw new Error("Legacy installed packages or provisioning ledger changed during normal bootstrap")
  }

  console.log(
    JSON.stringify({
      project: {
        id: projectAfter.id,
        digest: projectAfter.packageDigest,
        scope: projectDeclaration.installationScope,
        bytes: projectBytesAfter,
      },
      global: {
        id: globalAfter.id,
        digest: globalAfter.packageDigest,
        scope: globalDeclaration.installationScope,
        bytes: globalBytesAfter,
      },
      ledgerDigest: createHash("sha256").update(ledgerAfter).digest("hex"),
      activeSquadID: (catalog.active_skill_projection as Record<string, unknown>).active_squad_id,
    }),
  )
} finally {
  server.stop(true)
  await Instance.disposeAll()
}
