import fs from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { Server } from "../../src/server/server"

const projectDirectory = process.argv[2]
if (!projectDirectory) throw new Error("Default payload probe requires an isolated project directory")
declareNativeTaskProcessDeployment()
await fs.mkdir(projectDirectory, { recursive: true })

const app = Server.App()
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 0, fetch: app.fetch })
const origin = `http://${server.hostname}:${server.port}`
let requestCount = 0

async function requestJson(route: string, init: RequestInit = {}) {
  requestCount += 1
  const headers = new Headers(init.headers)
  headers.set("x-opencorvus-directory", projectDirectory)
  const response = await fetch(`${origin}${route}`, { ...init, headers })
  if (response.status !== 200) {
    throw new Error(`${init.method ?? "GET"} ${route} returned ${response.status}: ${await response.text()}`)
  }
  return response.json() as Promise<Record<string, unknown>>
}

async function marketInventory() {
  const entries: Array<Record<string, unknown>> = []
  let cursor: string | null = null
  do {
    const query = new URLSearchParams({ limit: "20" })
    if (cursor) query.set("cursor", cursor)
    const page = await requestJson(`/expert-squad/market?${query}`)
    entries.push(...(page.entries as Array<Record<string, unknown>>))
    cursor = page.next_cursor as string | null
  } while (cursor)
  return entries
}

try {
  const firstCatalog = await requestJson("/expert-squad/catalog")
  const firstInventory = await marketInventory()
  const removedSource = payloadPackageSources[0]!
  const modifiedSource = payloadPackageSources[1]!
  const firstActive = firstCatalog.active_skill_projection as Record<string, unknown>

  if (firstActive.active_squad_id !== "base") {
    throw new Error("Default payload provisioning changed the active Squad")
  }
  if (
    firstInventory.length !== payloadPackageSources.length ||
    !firstInventory.every((entry) => (entry.installation_scopes as string[]).includes("project"))
  ) {
    throw new Error("Fresh full bootstrap did not project every repository payload as project-installed")
  }

  await requestJson("/expert-squad/uninstall", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: removedSource.id,
      installationScope: "project",
      replacementID: "base",
    }),
  })
  await Instance.disposeAll()

  const modifiedReadme = path.join(
    projectDirectory,
    ".opencorvus",
    "expert-squads",
    modifiedSource.namespace,
    modifiedSource.id,
    "README.md",
  )
  await fs.appendFile(modifiedReadme, "\nOperator-owned production-route modification.\n")

  const secondCatalog = await requestJson("/expert-squad/catalog")
  const secondActive = secondCatalog.active_skill_projection as Record<string, unknown>
  const removedDetail = await requestJson(`/expert-squad/market/detail?id=${encodeURIComponent(removedSource.id)}`)
  const modifiedDetail = await requestJson(`/expert-squad/market/detail?id=${encodeURIComponent(modifiedSource.id)}`)
  const state = JSON.parse(
    await fs.readFile(ProjectRuntimePaths.expertSquadPayloadProvisioningState(projectDirectory), "utf8"),
  ) as {
    entries: Array<{ id: string; disposition: string }>
  }

  const removedInstallations = removedDetail.installations as Array<Record<string, unknown>>
  const modifiedInstallations = modifiedDetail.installations as Array<Record<string, unknown>>
  const removedState = state.entries.find((entry) => entry.id === removedSource.id)
  const modifiedState = state.entries.find((entry) => entry.id === modifiedSource.id)
  if (secondActive.active_squad_id !== "base") throw new Error("Second bootstrap changed the active Squad")
  if (removedInstallations.length !== 0 || removedState?.disposition !== "removed") {
    throw new Error("Second bootstrap reinstalled an operator-removed payload package")
  }
  if (
    modifiedInstallations.length !== 1 ||
    modifiedInstallations[0]?.installation_scope !== "project" ||
    modifiedInstallations[0]?.update_available !== true ||
    modifiedState?.disposition !== "modified"
  ) {
    throw new Error("Second bootstrap overwrote or misclassified operator-modified payload bytes")
  }

  console.log(
    JSON.stringify({
      payloadCount: payloadPackageSources.length,
      installedByDefault: firstInventory.length,
      requestCount,
      activeSquadID: secondActive.active_squad_id,
      removedID: removedSource.id,
      removedDisposition: removedState.disposition,
      modifiedID: modifiedSource.id,
      modifiedDisposition: modifiedState.disposition,
      modifiedUpdateAvailable: modifiedInstallations[0].update_available,
    }),
  )
} finally {
  server.stop(true)
  await Instance.disposeAll()
}
