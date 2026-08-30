import fs from "node:fs/promises"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { Instance } from "../../src/project/instance"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { Server } from "../../src/server/server"
import { catalogPackageSkillRefs } from "./catalog-capability-fixture"

const projectDirectory = process.argv[2]
if (!projectDirectory) throw new Error("On-demand payload probe requires an isolated project directory")
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
  const initialCatalog = await requestJson("/expert-squad/catalog")
  const defaultPage = await requestJson("/expert-squad/search?view=installations&limit=20")
  const market = await marketInventory()
  const activeProjection = initialCatalog.active_skill_projection as Record<string, unknown>
  const defaultEntries = defaultPage.entries as Array<Record<string, unknown>>
  const defaultIDs = defaultEntries.map((entry) => entry.id as string).sort()
  const expectedDefaultIDs = ["advanced", "base", "research-studio", "squad-sdk"]

  if (
    defaultPage.total_count !== expectedDefaultIDs.length ||
    JSON.stringify(defaultIDs) !== JSON.stringify(expectedDefaultIDs)
  ) {
    throw new Error(`Fresh project defaults drifted: ${JSON.stringify({ defaultIDs, defaultPage })}`)
  }
  if (
    activeProjection.active_squad_id !== "base" ||
    !(activeProjection.production_grants as Array<Record<string, unknown>>).some(
      (grant) => grant.ref === "base/shared/method",
    )
  ) {
    throw new Error("Fresh project did not retain the embedded Base runtime projection")
  }
  if (
    market.length !== payloadPackageSources.length ||
    !market.every((entry) => (entry.installation_scopes as string[]).length === 0)
  ) {
    throw new Error("Fresh project Market did not expose repository-hosted packages as available on demand")
  }

  const installID = "one-person-company-operating-system"
  const beforeDetail = await requestJson(`/expert-squad/market/detail?id=${encodeURIComponent(installID)}`)
  if (beforeDetail.id !== installID || beforeDetail.skill_count !== 1) {
    throw new Error("Market detail omitted the selected package Skill")
  }
  const installation = await requestJson("/expert-squad/install-payload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: installID, installationScope: "project" }),
  })
  const receipt = installation.after as Record<string, unknown>
  if (receipt.id !== installID || receipt.installationScope !== "project") {
    throw new Error("On-demand Market install returned the wrong package revision")
  }

  const installedDetail = await requestJson(`/expert-squad/market/detail?id=${encodeURIComponent(installID)}`)
  const installations = installedDetail.installations as Array<Record<string, unknown>>
  if (
    installations.length !== 1 ||
    installations[0]?.installation_scope !== "project" ||
    installations[0]?.installed_package_digest !== receipt.packageDigest
  ) {
    throw new Error("Market detail did not converge to the exact installed package revision")
  }

  const settings = await requestJson(
    `/expert-squad/settings/detail?directory=${encodeURIComponent(projectDirectory)}&namespace=builtin&id=${encodeURIComponent(installID)}&installationScope=project`,
  )
  const selected = settings.selected as Record<string, unknown>
  const capability = selected.capability_projection as Record<string, unknown>
  const scheduler = capability.scheduler as Record<string, unknown>
  const agents = capability.agents as Record<string, Record<string, unknown>>
  const schedulerRefs = catalogPackageSkillRefs(selected, scheduler)
  if (
    JSON.stringify(schedulerRefs) !== JSON.stringify([`${installID}/shared/method`]) ||
    !Object.values(agents).every(
      (agent) => JSON.stringify(catalogPackageSkillRefs(selected, agent)) === JSON.stringify(schedulerRefs),
    )
  ) {
    throw new Error("Installed package did not project its exact package-local Skill to scheduler and workers")
  }
  const postInstallCatalog = await requestJson("/expert-squad/catalog")
  const postInstallProjection = postInstallCatalog.active_skill_projection as Record<string, unknown>
  if (
    postInstallProjection.active_squad_id !== "base" ||
    !(postInstallProjection.production_grants as Array<Record<string, unknown>>).some(
      (grant) => grant.ref === "base/shared/method",
    )
  ) {
    throw new Error("Explicit Market installation changed the active embedded Base projection")
  }

  console.log(
    JSON.stringify({
      payloadCount: payloadPackageSources.length,
      defaultIDs,
      marketAvailable: market.length,
      installedID: installID,
      installedDigest: receipt.packageDigest,
      installedSkillRefs: schedulerRefs,
      activeSquadID: postInstallProjection.active_squad_id,
      requestCount,
    }),
  )
} finally {
  server.stop(true)
  await Instance.disposeAll()
}
