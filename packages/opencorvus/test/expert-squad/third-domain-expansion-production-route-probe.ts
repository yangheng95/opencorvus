import fs from "node:fs/promises"
import { Hono } from "hono"
import { Instance } from "../../src/project/instance"
import { ExpertSquadRoutes } from "../../src/server/routes/expert-squad"
import { catalogPackageSkillRefs } from "./catalog-capability-fixture"

const squadIDs = [
  "insurance-claims-operations",
  "energy-utilities-planning",
  "agriculture-food-systems",
  "construction-project-controls",
  "telecom-network-assurance",
  "public-sector-service-delivery",
  "nonprofit-grant-operations",
  "hospitality-service-operations",
  "life-sciences-regulatory",
  "academic-paper-review",
] as const

const expectationFor = (id: (typeof squadIDs)[number]) =>
  id === "academic-paper-review"
    ? { skillRef: "academic-paper-review/shared/academic-paper-review-method", agentCount: 8, joinInputCount: 5 }
    : { skillRef: `${id}/shared/method`, agentCount: 4, joinInputCount: 3 }

const projectDirectory = process.argv[2]
if (!projectDirectory) throw new Error("Third domain expansion probe requires an isolated project directory")
await fs.mkdir(projectDirectory, { recursive: true })

const result = await Instance.provide({
  directory: projectDirectory,
  fn: async () => {
    const app = new Hono().route("/expert-squad", ExpertSquadRoutes())
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
    const origin = `http://${server.hostname}:${server.port}/expert-squad`
    let requestCount = 0

    const requestJson = async (route: string, init?: RequestInit) => {
      requestCount += 1
      const response = await fetch(`${origin}/${route}`, init)
      if (response.status !== 200) {
        throw new Error(`${init?.method ?? "GET"} ${route} returned ${response.status}: ${await response.text()}`)
      }
      return response.json() as Promise<Record<string, unknown>>
    }

    try {
      const projections = []
      for (const id of squadIDs) {
        const market = await requestJson(`market?query=${encodeURIComponent(id)}&limit=20`)
        const entries = market.entries as Array<Record<string, unknown>>
        if (!entries.some((entry) => entry.id === id)) throw new Error(`Market route omitted ${id}`)

        const detail = await requestJson(`market/detail?id=${encodeURIComponent(id)}`)
        if (detail.id !== id || detail.skill_count !== 1) {
          throw new Error(`Market detail omitted the saved Skill for ${id}`)
        }

        const installation = await requestJson("install-payload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, installationScope: "project" }),
        })
        const installed = installation.after as Record<string, unknown>
        if (installed.id !== id || installed.installationScope !== "project") {
          throw new Error(`Install route returned the wrong revision for ${id}`)
        }

        const settings = await requestJson(
          `settings/detail?directory=${encodeURIComponent(projectDirectory)}&namespace=builtin&id=${encodeURIComponent(id)}&installationScope=project`,
        )
        const selected = settings.selected as Record<string, unknown>
        const capability = selected.capability_projection as Record<string, unknown>
        const scheduler = capability.scheduler as Record<string, unknown>
        const agents = capability.agents as Record<string, Record<string, unknown>>
        const workflows = capability.virtual_workflows as Record<string, Record<string, unknown>>
        const workflow = Object.values(workflows)[0]
        const nodes = (workflow?.nodes ?? {}) as Record<string, Record<string, unknown>>
        const expected = expectationFor(id)
        const schedulerRefs = catalogPackageSkillRefs(selected, scheduler)
        const rootCount = Object.values(nodes).filter((node) => (node.depends_on as string[]).length === 0).length
        const joinCount = Object.values(nodes).filter(
          (node) => (node.depends_on as string[]).length === expected.joinInputCount,
        ).length

        if (JSON.stringify(schedulerRefs) !== JSON.stringify([expected.skillRef])) {
          throw new Error(`Scheduler did not project the exact Skill for ${id}`)
        }
        if (
          !Object.values(agents).every(
            (agent) => JSON.stringify(catalogPackageSkillRefs(selected, agent)) === JSON.stringify(schedulerRefs),
          )
        ) {
          throw new Error(`Worker Skill projection drifted for ${id}`)
        }
        if (
          Object.keys(agents).length !== expected.agentCount ||
          Object.keys(nodes).length !== expected.agentCount ||
          rootCount !== 3 ||
          joinCount !== 1
        ) {
          throw new Error(`Settings did not expose the three-root join topology for ${id}`)
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
      return { packages: projections.length, requestCount, projections }
    } finally {
      server.stop(true)
    }
  },
})

await Instance.disposeAll()
console.log(JSON.stringify(result))
