import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { ConfigPaths } from "@/config/paths"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Session } from "@/session"
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

async function catalogGet(directory: string, endpoint: string, params: Record<string, string>) {
  const response = await Server.App().request(`/expert-squad/${endpoint}?${new URLSearchParams(params)}`, {
    headers: { "x-opencorvus-directory": directory },
  })
  return { status: response.status, body: await response.json() }
}

async function installBundledForProject(directory: string, id: string) {
  const response = await Server.App().request("/expert-squad/install-payload", {
    method: "POST",
    headers: { "x-opencorvus-directory": directory, "content-type": "application/json" },
    body: JSON.stringify({ id, installationScope: "project" }),
  })
  return { status: response.status, body: await response.json() }
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
    const fixture = await Instance.provideProjectIdentity({
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
        const inventory = await PromptProfileResolver.searchCatalog({
          projectDirectory: owned.path,
          view: "installations",
          limit: 1,
        })
        const effective = await PromptProfileResolver.searchCatalog({ projectDirectory: owned.path, limit: 1 })
        return {
          session: await Session.create({ kind: "assistant", title: "Inventory runtime control" }),
          installationCount: inventory.total_count,
          effectiveCount: effective.total_count,
        }
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
        body: {
          issue_count: issueCount,
          warning_count: 0,
          installation_count: fixture.installationCount,
          effective_count: fixture.effectiveCount,
        },
      })
      expect({ status: diagnostics.status, body: diagnosticsBody }).toMatchObject({
        status: 200,
        body: { catalog_revision: statusBody.catalog_revision, total_count: issueCount, next_cursor: null },
      })
      expect(diagnosticsBody.entries.map((entry: { kind: string }) => entry.kind)).toEqual(issueCount ? ["issue"] : [])
      const config = await Server.App().request(`/session/${fixture.session.id}/config`, {
        headers: { "x-opencorvus-directory": owned.path },
      })
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

test("catalog continuation distinguishes a wrong query from a changed revision and accepts a fresh page", async () => {
  await using project = await memoryProject("inventory-cursor-contract")
  const root = ExpertSquadPackageLocations.project(project.path).packagesRoot
  const writePackage = (id: string) =>
    writeExpertSquadPackage({ directory: path.join(root, "scale", id), definition: ownedPackageDefinition(id) })
  await writePackage("cursor-route-a")
  await writePackage("cursor-route-b")
  for (const id of ["broken-cursor-a", "broken-cursor-b"]) {
    const directory = path.join(root, "scale", id)
    await fs.mkdir(directory, { recursive: true })
    await fs.writeFile(path.join(directory, "expert-squad.jsonc"), "{}")
  }
  await ExpertSquadRegistry.invalidateAvailable()

  await runOutsideInstanceContext(async () => {
    const get = (endpoint: string, params: Record<string, string>) => catalogGet(project.path, endpoint, params)
    const query = { limit: "1" }
    const first = await get("diagnostics", query)
    expect(first).toMatchObject({
      status: 200,
      body: { total_count: 2, entries: [{ kind: "issue", issue: { id: "broken-cursor-a" } }] },
    })
    const cursor = first.body.next_cursor as string
    expect(typeof cursor).toBe("string")
    const search = await get("search", { ...query, view: "installations" })
    const wrongQuery = { ...query, cursor: search.body.next_cursor as string }
    expect(search.status).toBe(200)
    expect(typeof wrongQuery.cursor).toBe("string")
    expect(await get("diagnostics", { ...query, cursor: "malformed-cursor" })).toEqual({
      status: 400,
      body: {
        name: "ExpertSquadCatalogCursorInvalidError",
        data: { message: "The Expert Squad catalog cursor is invalid. Request the first page for this query." },
      },
    })
    const wrongQueryResult = {
      status: 400,
      body: {
        name: "ExpertSquadCatalogCursorInvalidError",
        data: { message: "The Expert Squad catalog cursor belongs to a different query. Request the first page for this query." },
      },
    }
    expect(await get("diagnostics", wrongQuery)).toEqual(wrongQueryResult)
    const expectedTail = {
      status: 200,
      body: { entries: [{ kind: "issue", issue: { id: "broken-cursor-b" } }], total_count: 2, next_cursor: null },
    }
    expect(await get("diagnostics", { ...query, cursor })).toMatchObject(expectedTail)

    await writePackage("cursor-route-c")
    await ExpertSquadRegistry.invalidateAvailable()
    expect(await get("diagnostics", wrongQuery)).toEqual(wrongQueryResult)
    expect(await get("diagnostics", { ...query, cursor })).toEqual({
      status: 409,
      body: {
        name: "ExpertSquadCatalogRevisionConflictError",
        data: { message: "The Expert Squad catalog changed. Request the first page and use its next cursor." },
      },
    })
    const refreshed = await get("diagnostics", query)
    expect(refreshed).toMatchObject({ status: 200, body: { total_count: 2 } })
    expect(typeof refreshed.body.next_cursor).toBe("string")
    expect(await get("diagnostics", { ...query, cursor: refreshed.body.next_cursor })).toMatchObject(expectedTail)
  })
})

test("market paging exposes query errors and stale revisions while keeping the current installation view", async () => {
  await using project = await memoryProject("market-cursor-contract")
  await runOutsideInstanceContext(async () => {
    const read = (params: Record<string, string>) => catalogGet(project.path, "market", params)
    const query = { availability: "all", limit: "1" }
    const full = await read({ ...query, limit: "20" })
    const first = await read(query)
    const cursor = first.body.next_cursor as string
    expect(first.status).toBe(200)
    expect(full.status).toBe(200)
    expect(first.body.entries).toEqual(full.body.entries.slice(0, 1))
    expect(typeof cursor).toBe("string")
    expect(await read({ ...query, cursor })).toMatchObject({ status: 200, body: { entries: full.body.entries.slice(1, 2) } })
    expect(await read({ ...query, cursor, availability: "available" })).toMatchObject({
      status: 400,
      body: { name: "ExpertSquadCatalogCursorInvalidError" },
    })
    expect(await read({ ...query, limit: "0" })).toMatchObject({
      status: 400,
      body: { success: false, error: [{ code: "too_small", path: ["limit"] }] },
    })

    expect(await installBundledForProject(project.path, "deep-research")).toMatchObject({
      status: 200,
      body: { operation: "installed", after: { id: "deep-research", namespace: "builtin", installationScope: "project" } },
    })
    expect(await read({ ...query, cursor })).toMatchObject({
      status: 409,
      body: { name: "ExpertSquadCatalogRevisionConflictError" },
    })
    const refreshed = await read(query)
    expect(refreshed.status).toBe(200)
    expect(typeof refreshed.body.next_cursor).toBe("string")
    expect(await read({ ...query, cursor: refreshed.body.next_cursor })).toMatchObject({
      status: 200,
      body: { entries: full.body.entries.slice(1, 2) },
    })
    expect(await read({ availability: "installed", limit: "20" })).toMatchObject({
      status: 200,
      body: { entries: [{ id: "deep-research", namespace: "builtin", installation_scopes: ["project"] }], total_count: 1 },
    })
  })
})

test("market recommendations distinguish the exact package from another scope's same logical ID", async () => {
  await using project = await memoryProject("market-installation-identity")
  await using occupied = await memoryProject("market-occupied-project")
  const id = "deep-research"
  const globalRoot = ExpertSquadPackageLocations.global().packagesRoot
  const runtimeRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!runtimeRoot || !path.resolve(globalRoot).startsWith(path.resolve(runtimeRoot) + path.sep)) {
    throw new Error("Market installation test requires an isolated global package root")
  }
  const first = await runOutsideInstanceContext(() => catalogGet(project.path, "market", { limit: "1" }))
  expect(first.status).toBe(200)
  const originalCursor = first.body.next_cursor as string
  expect(typeof originalCursor).toBe("string")
  const originalNext = await runOutsideInstanceContext(() =>
    catalogGet(project.path, "market", { limit: "1", cursor: originalCursor }),
  )
  expect(originalNext.status).toBe(200)
  for (const [root, namespace] of [
    [globalRoot, "local"],
    [ExpertSquadPackageLocations.project(occupied.path).packagesRoot, "workshop"],
  ]) {
    const definition = ownedPackageDefinition(id)
    definition.manifest.namespace = namespace
    await writeExpertSquadPackage({ directory: path.join(root, namespace, id), definition })
  }
  await ExpertSquadRegistry.invalidateAvailable()

  await runOutsideInstanceContext(async () => {
    const query = { query: id, limit: "20" }
    const market = (directory: string, availability: "all" | "available" | "installed") =>
      catalogGet(directory, "market", { ...query, availability })
    const entry = (body: { entries: Array<{ id: string }> }) => body.entries.find((item) => item.id === id)
    expect(await catalogGet(project.path, "market", { limit: "1", cursor: originalCursor })).toMatchObject({
      status: 200,
      body: { entries: originalNext.body.entries },
    })
    const available = await market(project.path, "available")
    expect(available.status).toBe(200)
    expect(entry(available.body)).toMatchObject({ id, namespace: "builtin", installation_scopes: [] })
    const blockedMarket = await market(occupied.path, "available")
    expect(blockedMarket).toMatchObject({ status: 200, body: { total_count: available.body.total_count - 1 } })
    const blockedAll = await market(occupied.path, "all")
    expect(entry(blockedAll.body)).toMatchObject({ id, namespace: "builtin", installation_scopes: [] })
    expect(await installBundledForProject(occupied.path, id)).toMatchObject({
      status: 400,
      body: { name: "ExpertSquadPackageError", data: { message: expect.stringContaining("already exists") } },
    })
    const duplicate = ownedPackageDefinition(id)
    duplicate.manifest.namespace = "quarantine"
    await writeExpertSquadPackage({
      directory: path.join(ExpertSquadPackageLocations.project(occupied.path).packagesRoot, "quarantine", id),
      definition: duplicate,
    })
    await ExpertSquadRegistry.invalidateAvailable()
    const diagnostics = await catalogGet(occupied.path, "diagnostics", { limit: "20" })
    const duplicateNamespaces = diagnostics.body.entries
      .filter((row: { kind: string; issue?: { id: string; phase: string } }) =>
        row.kind === "issue" && row.issue?.id === id && row.issue.phase === "identity.duplicate",
      )
      .map((row: { issue: { namespace: string } }) => row.issue.namespace)
      .sort()
    expect(diagnostics.status).toBe(200)
    expect(duplicateNamespaces).toEqual(["quarantine", "workshop"])
    expect(await market(occupied.path, "available")).toMatchObject({
      status: 200,
      body: { total_count: blockedMarket.body.total_count },
    })

    expect(await installBundledForProject(project.path, id)).toMatchObject({
      status: 200,
      body: { operation: "installed", after: { id, namespace: "builtin", installationScope: "project" } },
    })
    const installed = await market(project.path, "installed")
    expect(installed.status).toBe(200)
    expect(entry(installed.body)).toMatchObject({ id, namespace: "builtin", installation_scopes: ["project"] })
    const detail = await catalogGet(project.path, "market/detail", { id })
    expect(detail).toMatchObject({
      status: 200,
      body: { namespace: "builtin", id, installations: [{ installation_scope: "project" }] },
    })
  })
})
