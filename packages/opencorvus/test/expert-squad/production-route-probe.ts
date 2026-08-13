import fs from "node:fs/promises"
import path from "node:path"
import { Hono } from "hono"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { ExpertSquadRoutes } from "../../src/server/routes/expert-squad"

const EXPERT_SQUAD_IDS = [
  "browser-research-acceptance",
  "office-delivery",
  "product-management",
  "customer-success",
  "finance-operations",
  "meeting-knowledge",
  "procurement-vendor",
  "localization-adaptation",
  "knowledge-base-operations",
  "product-video",
] as const

const EXPERT_SQUAD_SKILL_REFS: Record<(typeof EXPERT_SQUAD_IDS)[number], string> = {
  "browser-research-acceptance": "browser-research-acceptance/shared/browser-evidence-acceptance",
  "office-delivery": "office-delivery/shared/office-delivery-method",
  "product-management": "product-management/shared/evidence-backed-product-planning",
  "customer-success": "customer-success/shared/method",
  "finance-operations": "finance-operations/shared/method",
  "meeting-knowledge": "meeting-knowledge/shared/method",
  "procurement-vendor": "procurement-vendor/shared/method",
  "localization-adaptation": "localization-adaptation/shared/method",
  "knowledge-base-operations": "knowledge-base-operations/shared/method",
  "product-video": "product-video/shared/method",
}

const REPAIRED_SQUADS = [
  { id: "base", installationScope: "built_in", skillRef: "base/shared/method" },
  { id: "advanced", installationScope: "built_in", skillRef: "advanced/shared/method" },
  { id: "frontend-innovate", installationScope: "project", skillRef: "frontend-innovate/shared/method" },
] as const

const projectDirectory = process.argv[2]
if (!projectDirectory) throw new Error("Production route probe requires an isolated project directory")

const sourceRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

function projectedSkillCount(manifest: ExpertSquadRegistry.Manifest) {
  const refs = new Set<string>()
  for (const projection of [
    manifest.capability_projection.scheduler,
    ...Object.values(manifest.capability_projection.agents),
  ]) {
    for (const ref of [...projection.default_skill_refs, ...projection.package_skill_refs]) refs.add(ref)
  }
  return refs.size
}

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

      const readSkillProjection = async (input: {
        id: string
        installationScope: "built_in" | "project"
        expectedSkillRef: string
      }) => {
        const namespace = input.installationScope === "built_in" ? "" : "&namespace=builtin"
        const settings = await requestJson(
          `settings/detail?directory=${encodeURIComponent(projectDirectory)}&id=${encodeURIComponent(input.id)}&installationScope=${input.installationScope}${namespace}`,
        )
        const selected = settings.selected as Record<string, unknown>
        const capability = selected.capability_projection as Record<string, unknown>
        const scheduler = capability.scheduler as Record<string, unknown>
        const schedulerSkillRefs = scheduler.package_skill_refs as string[]
        const agents = capability.agents as Record<string, Record<string, unknown>>

        if (
          selected.id !== input.id ||
          JSON.stringify(schedulerSkillRefs) !== JSON.stringify([input.expectedSkillRef])
        ) {
          throw new Error(`Settings did not project the repaired package Skill for ${input.id}`)
        }
        if (
          !Object.values(agents).every(
            (agent) => JSON.stringify(agent.package_skill_refs) === JSON.stringify(schedulerSkillRefs),
          )
        ) {
          throw new Error(`Worker Skill projection drifted from the scheduler for ${input.id}`)
        }

        return {
          capability,
          agents,
          summary: {
            id: input.id,
            packageDigest: selected.package_digest,
            skillRef: schedulerSkillRefs[0],
            agentCount: Object.keys(agents).length,
          },
        }
      }

      for (const id of EXPERT_SQUAD_IDS) {
        const source = await ExpertSquadRegistry.loadSourcePackage(sourceRoot(id))
        const market = await requestJson(`market?query=${encodeURIComponent(id)}&limit=20`)
        const marketEntries = market.entries as Array<Record<string, unknown>>
        if (!marketEntries.some((entry) => entry.id === id)) throw new Error(`Market route omitted ${id}`)

        const detail = await requestJson(`market/detail?id=${encodeURIComponent(id)}`)
        if (detail.id !== id || detail.skill_count !== projectedSkillCount(source.manifest)) {
          throw new Error(`Market detail did not expose every projected Skill for ${id}`)
        }

        const installation = await requestJson("install-payload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, installationScope: "project" }),
        })
        const installedRevision = installation.after as Record<string, unknown>
        if (installedRevision.id !== id || installedRevision.installationScope !== "project") {
          throw new Error(`Production install route returned the wrong revision for ${id}`)
        }

        const skillProjection = await readSkillProjection({
          id,
          installationScope: "project",
          expectedSkillRef: EXPERT_SQUAD_SKILL_REFS[id],
        })
        const { capability, agents } = skillProjection
        const workflows = capability.virtual_workflows as Record<string, Record<string, unknown>>
        const workflow = Object.values(workflows)[0]
        const nodes = (workflow?.nodes ?? {}) as Record<string, Record<string, unknown>>
        const expectedAgents = source.manifest.capability_projection.agents
        const expectedWorkflow = Object.values(source.manifest.capability_projection.virtual_workflows)[0]
        const expectedNodes = expectedWorkflow?.nodes ?? {}

        if (JSON.stringify(Object.keys(agents).sort()) !== JSON.stringify(Object.keys(expectedAgents).sort())) {
          throw new Error(`Production settings omitted declared workers for ${id}`)
        }
        if (JSON.stringify(Object.keys(nodes).sort()) !== JSON.stringify(Object.keys(expectedNodes).sort())) {
          throw new Error(`Production settings omitted declared workflow nodes for ${id}`)
        }
        for (const [nodeID, expectedNode] of Object.entries(expectedNodes)) {
          const node = nodes[nodeID]
          if (
            node?.agent_id !== expectedNode.agent_id ||
            JSON.stringify(node?.depends_on) !== JSON.stringify(expectedNode.depends_on)
          ) {
            throw new Error(`Production settings changed declared workflow authority for ${id}/${nodeID}`)
          }
        }

        projections.push({
          id,
          packageDigest: skillProjection.summary.packageDigest,
          skillRef: skillProjection.summary.skillRef,
          agentCount: skillProjection.summary.agentCount,
          workflowNodeCount: Object.keys(nodes).length,
        })
      }

      const repairedProjections = []
      for (const repaired of REPAIRED_SQUADS) {
        if (repaired.id === "frontend-innovate") {
          const detail = await requestJson(`market/detail?id=${encodeURIComponent(repaired.id)}`)
          if (detail.id !== repaired.id || detail.skill_count !== 1) {
            throw new Error(`Market detail did not expose the repaired Skill for ${repaired.id}`)
          }
          await requestJson("install-payload", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: repaired.id, installationScope: "project" }),
          })
        }
        repairedProjections.push(
          (
            await readSkillProjection({
              id: repaired.id,
              installationScope: repaired.installationScope,
              expectedSkillRef: repaired.skillRef,
            })
          ).summary,
        )
      }

      const activeCatalog = await requestJson("catalog")
      const activeSkillProjection = activeCatalog.active_skill_projection as Record<string, unknown>
      const activeProductionGrants = activeSkillProjection.production_grants as Array<Record<string, unknown>>
      const activeProductionSkillRefs = activeProductionGrants.map((grant) => grant.ref as string)
      if (
        activeSkillProjection.active_squad_id !== "base" ||
        !activeProductionSkillRefs.includes("base/shared/method")
      ) {
        throw new Error("Active runtime catalog did not grant the repaired Base Skill")
      }

      return {
        packages: projections.length,
        requestCount,
        projections,
        repairedProjections,
        activeBaseSkillRefs: activeProductionSkillRefs,
      }
    } finally {
      server.stop(true)
    }
  },
})

await Instance.disposeAll()
console.log(JSON.stringify(result))
