import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { ConfigPaths } from "../../src/config/paths"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import {
  ExpertSquadConfigurationStore,
  ExpertSquadConfigurationResponseSchema,
} from "../../src/expert-squad/configuration"
import { ExpertSquadCatalogInspectionSchema, ExpertSquadSettingsDetailSchema } from "../../src/expert-squad/catalog"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

const configuration = {
  fields: [
    { key: "endpoint", label: "Endpoint", type: "text" as const, required: true },
    { key: "access_key", label: "Access key", type: "secret" as const, required: true },
  ],
}
function definition(): ExpertSquadPackageDefinition {
  return {
    manifest: {
      schema_version: 2,
      namespace: "selected",
      id: "selected-reader",
      label: "Selected reader",
      description: "Real SDK selected declaration fixture.",
      version: "2026.10.07.1",
      product_pillars: ["code"],
      readme: "README.md",
      configuration,
      selector: {
        summary: "Inspect selected metadata.",
        selection_guidance: "Read this selected declaration.",
        instructions: "selector.md",
      },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": "# Selected reader\n", "selector.md": "# Selected instructions\n" },
  }
}
async function coldRequest(directory: string, route: string) {
  await Instance.disposeAll()
  Server.resetProjectRoutesAppForTest()
  const url = new URL(route, "http://opencorvus.test")
  url.searchParams.set("directory", directory)
  const response = await runOutsideInstanceContext(() =>
    Server.App().request(`${url.pathname}${url.search}`, {
      headers: { "x-opencorvus-directory": directory },
    }),
  )
  return { route, status: response.status, body: (await response.json()) as unknown }
}

async function prepareProject(directory: string, label: string, endpoint: string) {
  const sessionID = await Instance.provide({
    directory: directory,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Selected reader runtime control" })
      await writeExpertSquadPackage({
        directory: path.join(
          ExpertSquadPackageLocations.project(directory).packagesRoot,
          "selected",
          "selected-reader",
        ),
        definition: { ...definition(), manifest: { ...definition().manifest, label } },
      })
      await ExpertSquadRegistry.invalidateAvailable()
      await ExpertSquadConfigurationStore.update({
        identity: {
          installationScope: "project",
          projectID: session.projectID,
          namespace: "selected",
          id: "selected-reader",
        },
        configuration,
        updates: { endpoint, access_key: crypto.randomUUID() },
      })
      return session.id
    },
  })
  const model = "missing-selected-provider/missing-selected-model"
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ model }))
  return {
    sessionID,
    readme: await fs.readFile(
      path.join(
        ExpertSquadPackageLocations.project(directory).packagesRoot,
        "selected",
        "selected-reader",
        "README.md",
      ),
      "utf8",
    ),
  }
}

test("three exact selected readers return actual package and redacted configuration while runtime model remains unavailable", async () => {
  await using project = await memoryProject("selected-reader-cold")
  const { sessionID, readme } = await prepareProject(
    project.path,
    "Selected reader",
    "https://example.invalid/selected",
  )
  const model = "missing-selected-provider/missing-selected-model"
  // Execute every real route before asserting, so the baseline records all three.
  const inspection = await coldRequest(
    project.path,
    "/expert-squad/inspect?id=selected-reader&installationScope=project&namespace=selected",
  )
  const detail = await coldRequest(
    project.path,
    "/expert-squad/settings/detail?id=selected-reader&installationScope=project&namespace=selected",
  )
  const configured = await coldRequest(
    project.path,
    "/expert-squad/configuration?id=selected-reader&installationScope=project",
  )
  const rawConfig = await coldRequest(project.path, "/config")
  const runtimeConfig = await coldRequest(project.path, `/session/${sessionID}/config`)
  const readers = [inspection, detail, configured]
  console.log(
    "selected-reader-cold-receipts",
    JSON.stringify(
      readers.map(({ route, status, body }) => ({
        route,
        status,
        errorName: status >= 400 && body && typeof body === "object" && "name" in body ? body.name : null,
      })),
    ),
  )
  expect(rawConfig).toMatchObject({ status: 200, body: { model } })
  expect(runtimeConfig).toMatchObject({
    status: 400,
    body: {
      name: "ProviderModelNotFoundError",
      data: { providerID: "missing-selected-provider", modelID: "missing-selected-model" },
    },
  })
  expect(readers.map(({ route, status }) => ({ route, status }))).toEqual(
    [inspection.route, detail.route, configured.route].map((route) => ({ route, status: 200 })),
  )
  const inspected = ExpertSquadCatalogInspectionSchema.parse(inspection.body)
  expect(inspected).toMatchObject({
    id: "selected-reader",
    label: "Selected reader",
    version: "2026.10.07.1",
    source: { kind: "installed_package", installation_scope: "project", namespace: "selected" },
  })
  const selected = ExpertSquadSettingsDetailSchema.parse(detail.body)
  expect(selected).toMatchObject({
    scope: { kind: "project", directory: project.path },
    selected: { id: "selected-reader", version: "2026.10.07.1", readme: { content: readme.trim() } },
  })
  const config = ExpertSquadConfigurationResponseSchema.parse(configured.body)
  expect({
    id: config.id,
    scope: config.installationScope,
    namespace: config.namespace,
    fields: config.fields.map((field) =>
      field.type === "secret"
        ? {
            key: field.key,
            type: field.type,
            configured: field.configured,
            exposure: field.value === undefined ? "redacted" : "unexpected-value",
          }
        : { key: field.key, type: field.type, configured: field.configured, value: field.value },
    ),
  }).toEqual({
    id: "selected-reader",
    scope: "project",
    namespace: "selected",
    fields: [
      { key: "endpoint", type: "text", configured: true, value: "https://example.invalid/selected" },
      { key: "access_key", type: "secret", configured: true, exposure: "redacted" },
    ],
  })
}, 60_000)

test("exact current public errors preserve missing declaration identity", async () => {
  await using project = await memoryProject("selected-reader-errors")
  await prepareProject(project.path, "Selected reader", "https://example.invalid/errors")
  const inspection = await coldRequest(
    project.path,
    "/expert-squad/inspect?id=missing-reader&installationScope=project&namespace=selected",
  )
  const detail = await coldRequest(
    project.path,
    "/expert-squad/settings/detail?id=missing-reader&installationScope=project&namespace=selected",
  )
  const config = await coldRequest(
    project.path,
    "/expert-squad/configuration?id=missing-reader&installationScope=project",
  )
  for (const result of [inspection, detail])
    expect(result).toMatchObject({
      status: 404,
      body: { name: "NotFoundError", data: { message: "Expert squad not found: missing-reader" } },
    })
  expect(config).toMatchObject({
    status: 400,
    body: {
      name: "ExpertSquadPackageError",
      data: { message: "Unknown project expert squad installation missing-reader" },
    },
  })
}, 60_000)

test("same package ID reads each Project's actual declaration and configured values", async () => {
  await using first = await memoryProject("selected-reader-first")
  await using second = await memoryProject("selected-reader-second")
  await prepareProject(first.path, "First Project declaration", "https://example.invalid/first")
  await prepareProject(second.path, "Second Project declaration", "https://example.invalid/second")
  for (const [directory, label, endpoint] of [
    [first.path, "First Project declaration", "https://example.invalid/first"],
    [second.path, "Second Project declaration", "https://example.invalid/second"],
  ]) {
    const detail = await coldRequest(
      directory,
      "/expert-squad/settings/detail?id=selected-reader&installationScope=project&namespace=selected",
    )
    const configured = await coldRequest(
      directory,
      "/expert-squad/configuration?id=selected-reader&installationScope=project",
    )
    const selected = ExpertSquadSettingsDetailSchema.parse(detail.body)
    const configuration = ExpertSquadConfigurationResponseSchema.parse(configured.body)
    const fact = {
      detailStatus: detail.status,
      configStatus: configured.status,
      directory: selected.scope.directory,
      label: selected.selected.label,
      endpoint: configuration.fields.find((field) => field.key === "endpoint")?.value,
    }
    expect(fact).toEqual({ detailStatus: 200, configStatus: 200, directory, label, endpoint })
  }
}, 60_000)
