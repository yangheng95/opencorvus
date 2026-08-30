import fs from "node:fs/promises"
import { Instance } from "../../src/project/instance"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { Server } from "../../src/server/server"
import { catalogPackageSkillRefs } from "./catalog-capability-fixture"

const squadIDs = [
  "clinical-genomics-variant-evidence-review",
  "transfusion-medicine-blood-component-assurance",
  "medical-device-human-factors-usability-assurance",
  "dam-safety-surveillance-assurance",
  "bridge-structural-integrity-assurance",
  "marine-vessel-survey-maintenance-assurance",
  "corporate-governance-entity-secretariat",
  "corporate-treasury-liquidity-operations",
  "student-financial-aid-administration",
  "digital-accessibility-assurance",
] as const

const projectDirectory = process.argv[2]
if (!projectDirectory) throw new Error("Ninth domain expansion probe requires an isolated project directory")
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

try {
  const projections = []
  for (const id of squadIDs) {
    const market = await requestJson(`/expert-squad/market?query=${encodeURIComponent(id)}&limit=20`)
    if (!(market.entries as Array<Record<string, unknown>>).some((entry) => entry.id === id)) {
      throw new Error(`Market route omitted ${id}`)
    }
    const detail = await requestJson(`/expert-squad/market/detail?id=${encodeURIComponent(id)}`)
    if (detail.id !== id || detail.skill_count !== 1) {
      throw new Error(`Market detail omitted the saved Skill for ${id}`)
    }
    const installation = await requestJson("/expert-squad/install-payload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, installationScope: "project" }),
    })
    const installed = installation.after as Record<string, unknown>
    if (installed.id !== id || installed.installationScope !== "project") {
      throw new Error(`Install route returned the wrong revision for ${id}`)
    }
    const settings = await requestJson(
      `/expert-squad/settings/detail?directory=${encodeURIComponent(projectDirectory)}&namespace=builtin&id=${encodeURIComponent(id)}&installationScope=project`,
    )
    const selected = settings.selected as Record<string, unknown>
    const capability = selected.capability_projection as Record<string, unknown>
    const scheduler = capability.scheduler as Record<string, unknown>
    const agents = capability.agents as Record<string, Record<string, unknown>>
    const workflow = Object.values(capability.virtual_workflows as Record<string, Record<string, unknown>>)[0]
    const nodes = (workflow?.nodes ?? {}) as Record<string, Record<string, unknown>>
    const schedulerRefs = catalogPackageSkillRefs(selected, scheduler)
    const skillRef = `${id}/shared/method`
    const rootCount = Object.values(nodes).filter((node) => (node.depends_on as string[]).length === 0).length
    const joinCount = Object.values(nodes).filter((node) => (node.depends_on as string[]).length === 4).length
    if (JSON.stringify(schedulerRefs) !== JSON.stringify([skillRef])) {
      throw new Error(`Scheduler did not project the exact Skill for ${id}`)
    }
    if (
      !Object.values(agents).every(
        (agent) => JSON.stringify(catalogPackageSkillRefs(selected, agent)) === JSON.stringify(schedulerRefs),
      )
    ) {
      throw new Error(`Worker Skill projection drifted for ${id}`)
    }
    if (Object.keys(agents).length !== 5 || Object.keys(nodes).length !== 5 || rootCount !== 4 || joinCount !== 1) {
      throw new Error(`Settings did not expose the expected four-root join topology for ${id}`)
    }
    projections.push({
      id,
      packageDigest: selected.package_digest,
      skillRef: schedulerRefs[0],
      agentCount: Object.keys(agents).length,
      rootCount,
      joinCount,
    })
  }

  const catalog = await requestJson("/expert-squad/catalog")
  const activeProjection = catalog.active_skill_projection as Record<string, unknown>
  if (
    activeProjection.active_squad_id !== "base" ||
    !(activeProjection.production_grants as Array<Record<string, unknown>>).some(
      (grant) => grant.ref === "base/shared/method",
    )
  ) {
    throw new Error("Explicit Market installations changed the active embedded Base projection")
  }

  console.log(
    JSON.stringify({
      packages: projections.length,
      requestCount,
      activeSquadID: activeProjection.active_squad_id,
      projections,
    }),
  )
} finally {
  server.stop(true)
  await Instance.disposeAll()
}
