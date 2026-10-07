import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { ExpertSquadSettingsDetailSchema } from "@/expert-squad/catalog"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
const globalRoots = new Set<string>()
afterEach(async () => {
  await Instance.disposeAll()
  for (const root of globalRoots) await fs.rm(root, { recursive: true, force: true })
  globalRoots.clear()
  await ExpertSquadRegistry.invalidateAvailable()
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})
function definition(id: string, namespace: string): ExpertSquadPackageDefinition {
  return {
    manifest: {
      schema_version: 2,
      id,
      namespace,
      label: `${namespace} ${id}`,
      description: "Physical installation scope contract",
      version: "2026.10.07.1",
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: "Physical scope contract",
        selection_guidance: "Inspect the owned physical installation scope",
        instructions: "selector.md",
      },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": `# ${namespace}/${id}\n`, "selector.md": "# Physical scope contract\n" },
  }
}
function installedRoot(directory: string, scope: "project" | "global", namespace: string, id: string) {
  const location = ExpertSquadPackageLocations.resolve(scope, directory)
  const root = path.join(location.packagesRoot, namespace, id)
  if (scope === "global") globalRoots.add(root)
  return root
}
async function damage(directory: string, scope: "project" | "global", namespace: string, id: string) {
  const root = installedRoot(directory, scope, namespace, id)
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, "expert-squad.jsonc"), "{}")
  await ExpertSquadRegistry.invalidateAvailable()
  return root
}
async function source(directory: string, id: string, namespace: string) {
  const sourceDirectory = path.join(directory, `source-${namespace}-${id}`)
  const input = definition(id, namespace)
  await writeExpertSquadPackage({ directory: sourceDirectory, definition: input })
  return { sourceDirectory, definition: input }
}
async function projectIdentity(directory: string) {
  return Instance.provideProjectIdentity({
    directory,
    fn: () => ({ id: Instance.project.id, worktree: Instance.project.worktree, directory: Instance.directory }),
  })
}
async function request(directory: string, route: string, method = "GET", body?: unknown) {
  return runOutsideInstanceContext(async () => {
    const url = new URL(route, "http://opencorvus.test")
    url.searchParams.set("directory", directory)
    const response = await Server.App().request(`${url.pathname}${url.search}`, {
      method,
      headers: {
        "x-opencorvus-directory": directory,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return {
      method,
      url: `${url.pathname}${url.search}`,
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.json(),
    }
  })
}
async function fileObservation(file: string) {
  try {
    return { kind: "text", text: await fs.readFile(file, "utf8") }
  } catch (error) {
    return { kind: "read_error", code: (error as NodeJS.ErrnoException).code }
  }
}
async function cold() {
  await Instance.disposeAll()
  Server.resetProjectRoutesAppForTest()
}
async function captureImport(
  directory: string,
  id: string,
  namespace: string,
  scope: "project" | "global",
  prepared: Awaited<ReturnType<typeof source>>,
) {
  const project = await projectIdentity(directory)
  const targetLocation = ExpertSquadPackageLocations.resolve(scope, directory)
  const targetRoot = installedRoot(directory, scope, namespace, id)
  const input = { sourceDirectory: prepared.sourceDirectory, installationScope: scope }
  const before = await ExpertSquadRegistry.discoverAvailableIdentities(directory, {
    view: "installations",
    reconcileEvolutionMutations: false,
  })
  await cold()
  const response = await request(directory, "/expert-squad/import-folder", "POST", input)
  const after = await ExpertSquadRegistry.discoverAvailableIdentities(directory, {
    view: "installations",
    reconcileEvolutionMutations: false,
  })
  const readme = await fileObservation(path.join(targetRoot, "README.md"))
  const evidence = {
    project,
    targetLocation,
    targetRoot,
    input,
    definition: prepared.definition,
    before,
    response,
    after,
    readme,
  }
  console.log("manager-scope93 actual import", JSON.stringify(evidence))
  return evidence
}
const winner = (id: string, scope: "project" | "global", namespace: string) => ({
  id,
  source: { kind: "installed_package" as const, installation_scope: scope, namespace },
})

// Independent tests ensure the first old-source failure cannot hide the other direction.
test("lawful Project import succeeds over a damaged same-ID global installation", async () => {
  await using project = await memoryProject("manager-scope93-project")
  const id = "project-over-global93",
    namespace = "project-author"
  const broken = await damage(project.path, "global", "broken-global", id)
  const prepared = await source(project.path, id, namespace)
  const evidence = await captureImport(project.path, id, namespace, "project", prepared)
  expect({
    status: evidence.response.status,
    operation: evidence.response.body.operation,
    before: evidence.response.body.before,
    after: evidence.response.body.after,
  }).toMatchObject({
    status: 200,
    operation: "installed",
    before: null,
    after: {
      installationScope: "project",
      projectDirectory: project.path,
      namespace,
      id,
      version: "2026.10.07.1",
      targetRoot: evidence.targetRoot,
    },
  })
  expect(evidence.readme).toEqual({ kind: "text", text: `# ${prepared.definition.manifest.namespace}/${prepared.definition.manifest.id}\n` })
  expect(
    evidence.after.items
      .filter((item) => item.id === id)
      .map((item) => ({ id: item.id, namespace: item.namespace, scope: item.location })),
  ).toEqual([{ id, namespace, scope: "project" }])
  expect(evidence.after.issues.filter((issue) => issue.id === id)).toEqual(
    evidence.before.issues.filter((issue) => issue.id === id),
  )
  expect(await fileObservation(path.join(broken, "expert-squad.jsonc"))).toEqual({ kind: "text", text: "{}" })
  const detail = await request(
    project.path,
    `/expert-squad/settings/detail?id=${id}&installationScope=project&namespace=${namespace}`,
  )
  expect(detail.status).toBe(200)
  expect(ExpertSquadSettingsDetailSchema.parse(detail.body).selection.effective_identity).toEqual(
    winner(id, "project", namespace),
  )
})

test("lawful global import succeeds over damaged Project while preserving that Project reservation", async () => {
  await using project = await memoryProject("manager-scope93-global")
  await using cleanProject = await memoryProject("manager-scope93-clean")
  const id = "global-over-project93",
    namespace = "global-author"
  const broken = await damage(project.path, "project", "broken-project", id)
  const prepared = await source(project.path, id, namespace)
  const evidence = await captureImport(project.path, id, namespace, "global", prepared)
  expect({
    status: evidence.response.status,
    operation: evidence.response.body.operation,
    before: evidence.response.body.before,
    after: evidence.response.body.after,
  }).toMatchObject({
    status: 200,
    operation: "installed",
    before: null,
    after: {
      installationScope: "global",
      projectDirectory: null,
      namespace,
      id,
      version: "2026.10.07.1",
      targetRoot: evidence.targetRoot,
    },
  })
  expect(evidence.readme).toEqual({ kind: "text", text: `# ${prepared.definition.manifest.namespace}/${prepared.definition.manifest.id}\n` })
  expect(
    evidence.after.items
      .filter((item) => item.id === id)
      .map((item) => ({ id: item.id, namespace: item.namespace, scope: item.location })),
  ).toEqual([{ id, namespace, scope: "global" }])
  expect(evidence.after.issues.filter((issue) => issue.id === id)).toEqual(
    evidence.before.issues.filter((issue) => issue.id === id),
  )
  expect(await fileObservation(path.join(broken, "expert-squad.jsonc"))).toEqual({ kind: "text", text: "{}" })
  const route = `/expert-squad/settings/detail?id=${id}&installationScope=global&namespace=${namespace}`
  const reserved = await request(project.path, route)
  const clean = await request(cleanProject.path, route)
  console.log("manager-scope93 actual two-Project selection", JSON.stringify({ reserved, clean }))
  expect(reserved.status).toBe(200)
  expect(clean.status).toBe(200)
  expect(ExpertSquadSettingsDetailSchema.parse(reserved.body).selection.effective_identity).toBe(null)
  expect(ExpertSquadSettingsDetailSchema.parse(clean.body).selection.effective_identity).toEqual(
    winner(id, "global", namespace),
  )
})

test("same target malformed identity retains explicit original diagnostic error and bytes", async () => {
  await using project = await memoryProject("manager-scope93-malformed")
  const id = "same-malformed93"
  const broken = await damage(project.path, "project", "broken-target", id)
  const prepared = await source(project.path, id, "incoming-author")
  const evidence = await captureImport(project.path, id, "incoming-author", "project", prepared)
  const issue = evidence.before.issues.find((issue) => issue.id === id)!
  expect({ phase: issue.phase, namespace: issue.namespace, id: issue.id, location: issue.location }).toEqual({
    phase: "package.identity",
    namespace: "broken-target",
    id,
    location: path.join(broken, "expert-squad.jsonc"),
  })
  expect(evidence.response.body).toEqual({ name: "ExpertSquadPackageError", data: { message: issue.message } })
  expect(evidence.response.status).toBe(400)
  expect(await fileObservation(path.join(broken, "expert-squad.jsonc"))).toEqual({ kind: "text", text: "{}" })
  expect(evidence.after.issues).toEqual(evidence.before.issues)
})

test("same target cross-namespace duplicates retain typed diagnostic refusal", async () => {
  await using project = await memoryProject("manager-scope93-duplicate")
  const id = "same-duplicate93"
  const manifests: Array<{ root: string; text: string }> = []
  for (const namespace of ["duplicate-a", "duplicate-b"]) {
    const root = installedRoot(project.path, "project", namespace, id)
    await writeExpertSquadPackage({ directory: root, definition: definition(id, namespace) })
    manifests.push({ root, text: await fs.readFile(path.join(root, "expert-squad.jsonc"), "utf8") })
  }
  await ExpertSquadRegistry.invalidateAvailable()
  const prepared = await source(project.path, id, "incoming-author")
  const evidence = await captureImport(project.path, id, "incoming-author", "project", prepared)
  expect(
    evidence.before.issues
      .map((issue) => ({ phase: issue.phase, id: issue.id, namespace: issue.namespace }))
      .sort((a, b) => a.namespace!.localeCompare(b.namespace!)),
  ).toEqual([
    { phase: "identity.duplicate", id, namespace: "duplicate-a" },
    { phase: "identity.duplicate", id, namespace: "duplicate-b" },
  ])
  expect({ status: evidence.response.status, body: evidence.response.body }).toEqual({
    status: 400,
    body: { name: "ExpertSquadPackageError", data: { message: evidence.before.issues[0].message } },
  })
  for (const manifest of manifests)
    expect(await fileObservation(path.join(manifest.root, "expert-squad.jsonc"))).toEqual({
      kind: "text",
      text: manifest.text,
    })
  expect(evidence.after.issues).toEqual(evidence.before.issues)
})

test("SDK-valid external builtin ID remains a public builtin-collision refusal", async () => {
  await using project = await memoryProject("manager-scope93-builtin")
  const prepared = await source(project.path, "base", "external-author")
  const evidence = await captureImport(project.path, "base", "external-author", "project", prepared)
  expect({ status: evidence.response.status, body: evidence.response.body }).toEqual({
    status: 400,
    body: {
      name: "ExpertSquadPackageError",
      data: { message: 'Expert squad package id "base" collides with a built-in expert squad id' },
    },
  })
  const builtin = await request(project.path, "/expert-squad/settings/detail?id=base&installationScope=built_in")
  expect(builtin.status).toBe(200)
  expect(ExpertSquadSettingsDetailSchema.parse(builtin.body).selection.effective_identity).toEqual({
    id: "base",
    source: { kind: "built_in" },
  })
})
