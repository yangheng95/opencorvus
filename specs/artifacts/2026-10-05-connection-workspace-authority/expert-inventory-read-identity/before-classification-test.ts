import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { ConfigPaths } from "@/config/paths"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await ExpertSquadRegistry.invalidateAvailable()
  await resetMemoryDatabase()
})
function ownedPackageDefinition(id: string): ExpertSquadPackageDefinition {
  const emptyResources = { capability_refs: [] as string[] }
  return {
    manifest: {
      schema_version: 2,
      namespace: "scale",
      id,
      label: `Scale ${id}`,
      description: `Bounded catalog fixture ${id}.`,
      version: "2026.08.10.1",
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: `Select ${id} for bounded catalog verification.`,
        selection_guidance: `Use ${id} only for bounded catalog verification.`,
        instructions: "selector.md",
      },
      capability_sets: {},
      capability_projection: {
        scheduler: { ...emptyResources, base_role: "orchestrator" },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": `# ${id}\n`, "selector.md": `# ${id} selector\n` },
  }
}

test("cold inventory and diagnostics retain real project catalogue facts without an execution model", async () => {
  await using project = await memoryProject("inventory78")
  await using other = await memoryProject("inventory-other78")
  for (const [owned, id] of [
    [project, "first-inventory78"],
    [other, "second-inventory78"],
  ] as const) {
    const root = path.join(ExpertSquadPackageLocations.project(owned.path).packagesRoot, "scale", id)
    await writeExpertSquadPackage({ directory: root, definition: ownedPackageDefinition(id) })
    const config = ConfigPaths.projectFile(owned.path)
    await fs.mkdir(path.dirname(config), { recursive: true })
    await fs.writeFile(
      config,
      JSON.stringify({ model: "inventory-unavailable/model", small_model: "inventory-unavailable/model" }),
    )
  }
  const damaged = path.join(
    ExpertSquadPackageLocations.project(project.path).packagesRoot,
    "scale",
    "damaged-inventory78",
  )
  await fs.mkdir(damaged, { recursive: true })
  await fs.writeFile(path.join(damaged, "expert-squad.jsonc"), "{}")
  await ExpertSquadRegistry.invalidateAvailable()
  for (const [owned, id, issueCount] of [
    [project, "first-inventory78", 1],
    [other, "second-inventory78", 0],
  ] as const) {
    await Instance.provideProjectIdentity({
      directory: owned.path,
      fn: async () => {
        const entries = await PromptProfileResolver.searchCatalog({
          projectDirectory: owned.path,
          view: "installations",
          query: id,
          limit: 20,
        })
        expect(entries.entries.map((entry) => ({ id: entry.id, source: entry.source }))).toEqual([
          { id, source: { kind: "installed_package", installation_scope: "project", namespace: "scale" } },
        ])
      },
    })
    await runOutsideInstanceContext(async () => {
      const get = (endpoint: string) =>
        Server.App().request(`/expert-squad/${endpoint}`, { headers: { "x-opencorvus-directory": owned.path } })
      const status = await get("inventory-status")
      const statusBody = await status.json()
      if (status.status !== 200) console.log("cold inventory baseline", status.status, statusBody)
      const diagnostics = await get("diagnostics?limit=20")
      const diagnosticsBody = await diagnostics.json()
      if (diagnostics.status !== 200) console.log("cold diagnostics baseline", diagnostics.status, diagnosticsBody)
      expect({ status: status.status, body: statusBody }).toMatchObject({
        status: 200,
        body: { issue_count: issueCount, warning_count: 0 },
      })
      expect({ status: diagnostics.status, body: diagnosticsBody }).toMatchObject({
        status: 200,
        body: { catalog_revision: statusBody.catalog_revision, total_count: issueCount, next_cursor: null },
      })
      expect(diagnosticsBody.entries.map((entry: { kind: string }) => entry.kind)).toEqual(issueCount ? ["issue"] : [])
      const config = await Server.App().request("/config", { headers: { "x-opencorvus-directory": owned.path } })
      expect({ status: config.status, body: await config.json() }).toMatchObject({
        status: 400,
        body: {
          name: "ProviderModelNotFoundError",
          data: { providerID: "inventory-unavailable", modelID: "model", suggestions: [] },
        },
      })
    })
  }
})
