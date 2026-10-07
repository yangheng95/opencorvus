import { afterEach, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { ExpertSquadSettingsDetailSchema } from "@/expert-squad/catalog"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { requireTaskPackageRevisionBinding } from "@/engine/task-package-revision-binding"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { persistEstablishedTask } from "../fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

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
      namespace,
      id,
      label: `${namespace} ${id}`,
      description: "Owned selection eligibility contract",
      version: "2026.10.07.1",
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: "Owned eligibility",
        selection_guidance: "Inspect the real owned selection contract",
        instructions: "selector.md",
      },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": `# ${namespace}/${id}\n`, "selector.md": "# Owned eligibility\n" },
  }
}
async function install(directory: string, id: string, namespace: string, installationScope: "project" | "global") {
  const sourceDirectory = path.join(directory, `source-${namespace}-${id}`)
  await writeExpertSquadPackage({ directory: sourceDirectory, definition: definition(id, namespace) })
  const receipt = await Instance.provideProjectIdentity({
    directory,
    fn: () =>
      ExpertSquadPackageManager.importDirectory({ projectDirectory: directory, sourceDirectory, installationScope }),
  })
  if (installationScope === "global") globalRoots.add(receipt.after.targetRoot)
  return receipt.after
}
async function malformedRoot(directory: string, id: string, namespace: string, scope: "project" | "global") {
  const root = path.join(
    (scope === "project" ? ExpertSquadPackageLocations.project(directory) : ExpertSquadPackageLocations.global())
      .packagesRoot,
    namespace,
    id,
  )
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, "expert-squad.jsonc"), "{}")
  if (scope === "global") globalRoots.add(root)
  await ExpertSquadRegistry.invalidateAvailable()
  return root
}
async function request(directory: string, route: string, method = "GET", body?: unknown) {
  return await runOutsideInstanceContext(async () => {
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
    return { status: response.status, body: await response.json() }
  })
}
async function detail(directory: string, id: string, scope: "built_in" | "project" | "global", namespace?: string) {
  const params = new URLSearchParams({ id, installationScope: scope })
  if (namespace) params.set("namespace", namespace)
  const result = await request(directory, `/expert-squad/settings/detail?${params}`)
  expect(result.status).toBe(200)
  return ExpertSquadSettingsDetailSchema.parse(result.body)
}
async function cold() {
  await Instance.disposeAll()
  Server.resetProjectRoutesAppForTest()
}
const identity = (id: string, scope: "project" | "global", namespace: string) => ({
  id,
  source: { kind: "installed_package" as const, installation_scope: scope, namespace },
})

test("inactive builtin, project and global winners support real Project and ordinary Session selection", async () => {
  await using project = await memoryProject("eligibility89-writers")
  await install(project.path, "project-select89", "project-author", "project")
  await install(project.path, "global-select89", "global-author", "global")
  const session = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: () => Session.create({ kind: "assistant", title: "Ordinary eligibility owner" }),
  })
  await cold()
  for (const [id, scope, namespace, winner] of [
    ["research-studio", "built_in", undefined, { id: "research-studio", source: { kind: "built_in" } }],
    ["project-select89", "project", "project-author", identity("project-select89", "project", "project-author")],
    ["global-select89", "global", "global-author", identity("global-select89", "global", "global-author")],
  ] as const) {
    const surface = await detail(project.path, id, scope, namespace)
    const inventory = await request(project.path, "/expert-squad/inventory-status")
    expect(surface.selection).toEqual({ catalog_revision: inventory.body.catalog_revision, effective_identity: winner })
    const changed = await request(project.path, "/config", "PATCH", { prompt_profile: { active: id } })
    expect({ status: changed.status, active: changed.body.prompt_profile?.active }).toEqual({ status: 200, active: id })
    const stored = JSON.parse(await fs.readFile(ConfigPaths.projectFile(project.path), "utf8"))
    expect(stored.prompt_profile.active).toBe(id)
  }
  const override = await request(project.path, `/session/${session.id}/config`, "PATCH", {
    prompt_profile: { active: "project-select89" },
  })
  expect({
    status: override.status,
    active: override.body.config?.prompt_profile.active,
    origin: override.body.origin?.prompt_profile.active,
  }).toEqual({ status: 200, active: "project-select89", origin: "session" })
  expect((await Session.get(session.id)).metadata?.configOverlay).toEqual({
    prompt_profile: { active: "project-select89" },
  })
})

test("selected physical global package reports project winner and preserves reservations and duplicate errors", async () => {
  await using project = await memoryProject("eligibility89-precedence")
  const id = "precedence89"
  await install(project.path, id, "global-author", "global")
  await install(project.path, id, "project-author", "project")
  await cold()
  const shadowed = await detail(project.path, id, "global", "global-author")
  expect({ selected: shadowed.selected.source, winning: shadowed.selection.effective_identity }).toMatchObject({
    selected: { kind: "installed_package", installation_scope: "global", namespace: "global-author" },
    winning: identity(id, "project", "project-author"),
  })
  const projectWinner = await detail(project.path, id, "project", "project-author")
  expect(projectWinner.selection.effective_identity).toEqual(identity(id, "project", "project-author"))
  // Intentionally damaged canonical project input retains its ID reservation.
  await fs.writeFile(
    path.join(
      ExpertSquadPackageLocations.project(project.path).packagesRoot,
      "project-author",
      id,
      "expert-squad.jsonc",
    ),
    "{}",
  )
  await ExpertSquadRegistry.invalidateAvailable()
  await cold()
  expect((await detail(project.path, id, "global", "global-author")).selection.effective_identity).toBe(null)
  const blocked = await request(project.path, "/config", "PATCH", { prompt_profile: { active: id } })
  expect({ status: blocked.status, success: blocked.body.success, message: blocked.body.data?.message }).toMatchObject({
    status: 400,
    success: false,
    message: expect.any(String),
  })
  // Two complete SDK declarations in one physical scope are invalid discovery input, not Manager-published inventory.
  const duplicateID = "duplicate89"
  await install(project.path, duplicateID, "global-duplicate", "global")
  for (const namespace of ["duplicate-a", "duplicate-b"])
    await writeExpertSquadPackage({
      directory: path.join(ExpertSquadPackageLocations.project(project.path).packagesRoot, namespace, duplicateID),
      definition: definition(duplicateID, namespace),
    })
  await ExpertSquadRegistry.invalidateAvailable()
  await cold()
  const duplicate = await detail(project.path, duplicateID, "global", "global-duplicate")
  expect(duplicate.selection.effective_identity).toBe(null)
  const facts = await ExpertSquadRegistry.discoverAvailable(project.path)
  expect(
    facts.issues
      .filter((issue) => issue.id === duplicateID)
      .map((issue) => ({ id: issue.id, namespace: issue.namespace, phase: issue.phase }))
      .sort((a, b) => a.namespace!.localeCompare(b.namespace!)),
  ).toEqual([
    { id: duplicateID, namespace: "duplicate-a", phase: "identity.duplicate" },
    { id: duplicateID, namespace: "duplicate-b", phase: "identity.duplicate" },
  ])
})

test("built-in collision is unavailable while a valid Project winner overrides a broken global package", async () => {
  await using project = await memoryProject("eligibility89-collisions")
  const id = "valid-over-broken89"
  await install(project.path, id, "valid-project", "project")
  await malformedRoot(project.path, id, "broken-global", "global")
  await cold()
  expect((await detail(project.path, id, "project", "valid-project")).selection.effective_identity).toEqual(
    identity(id, "project", "valid-project"),
  )
  const accepted = await request(project.path, "/config", "PATCH", { prompt_profile: { active: id } })
  expect({ status: accepted.status, active: accepted.body.prompt_profile?.active }).toEqual({ status: 200, active: id })
  const malformedCollision = await malformedRoot(project.path, "base", "collision89", "project")
  await cold()
  expect((await detail(project.path, "base", "built_in")).selection.effective_identity).toBe(null)
  const refused = await request(project.path, "/config", "PATCH", { prompt_profile: { active: "base" } })
  expect({ status: refused.status, success: refused.body.success, message: refused.body.data?.message }).toEqual({
    status: 400,
    success: false,
    message: 'External expert squad package id "base" collides with a built-in expert squad id.',
  })
  await fs.rm(malformedCollision, { recursive: true, force: true })
  // SDK-valid declaration with a built-in ID is identity-collision input, not a successful Manager installation.
  const collisionRoot = path.join(
    ExpertSquadPackageLocations.project(project.path).packagesRoot,
    "valid-collision89",
    "base",
  )
  await writeExpertSquadPackage({ directory: collisionRoot, definition: definition("base", "valid-collision89") })
  await ExpertSquadRegistry.invalidateAvailable()
  await cold()
  const declarations = await ExpertSquadRegistry.discoverAvailable(project.path)
  expect(
    declarations.installations
      .filter((entry) => entry.id === "base")
      .map((entry) => ({ id: entry.id, namespace: entry.namespace, scope: entry.installationScope })),
  ).toEqual([{ id: "base", namespace: "valid-collision89", scope: "project" }])
  expect((await detail(project.path, "base", "built_in")).selection.effective_identity).toBe(null)
  const validCollisionRefusal = await request(project.path, "/config", "PATCH", { prompt_profile: { active: "base" } })
  expect(validCollisionRefusal).toEqual({
    status: 400,
    body: {
      success: false,
      data: { message: refused.body.data.message },
      error: [{ message: refused.body.data.message }],
    },
  })
})

test("fixed Task changed-ID returns409 and retains actual package binding while missing model stays distinct", async () => {
  await using project = await memoryProject("eligibility89-task")
  const fixture = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const config = await Config.get()
      const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
        projectDirectory: project.path,
        config: Config.mergeOverlay(config, { prompt_profile: { active: "base" } }),
        defaultSkills: [],
      })
      const now = Date.now()
      const taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({
        kind: "root",
        directory: project.path,
        title: "Established fixed Task",
        metadata: { taskConfigSnapshot: config, configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: root.title,
        request: "Established binding eligibility contract",
        productPillar: "code",
        source: "test",
        metadata: {},
        projectID: Instance.project.id,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: now,
        }),
      })
      return { taskID, root, binding: requireTaskPackageRevisionBinding(taskID) }
    },
  })
  await cold()
  const refused = await request(project.path, `/session/${fixture.root.id}/config`, "PATCH", {
    prompt_profile: { active: "research-studio" },
  })
  expect({ status: refused.status, body: refused.body }).toMatchObject({
    status: 409,
    body: {
      name: "TaskPromptProfileImmutableError",
      data: { taskID: fixture.taskID, requestedProfileID: "research-studio", pinnedPackageRevision: fixture.binding },
    },
  })
  expect({
    binding: requireTaskPackageRevisionBinding(fixture.taskID),
    overlay: (await Session.get(fixture.root.id)).metadata?.configOverlay,
  }).toEqual({ binding: fixture.binding, overlay: { prompt_profile: { active: "base" } } })
  const future = await request(project.path, "/config", "PATCH", { prompt_profile: { active: "research-studio" } })
  expect({ status: future.status, active: future.body.prompt_profile?.active }).toEqual({
    status: 200,
    active: "research-studio",
  })
  expect(JSON.parse(await fs.readFile(ConfigPaths.projectFile(project.path), "utf8")).prompt_profile.active).toBe(
    "research-studio",
  )
  const taskCatalog = await request(project.path, `/expert-squad/catalog?sessionID=${fixture.root.id}`)
  console.log(
    "Task future Project default and fixed catalog",
    JSON.stringify({
      projectDefault: future.body.prompt_profile.active,
      taskID: fixture.taskID,
      status: taskCatalog.status,
      active: taskCatalog.body.active,
      binding: fixture.binding,
    }),
  )
  expect({ status: taskCatalog.status, active: taskCatalog.body.active }).toMatchObject({
    status: 200,
    active: {
      project: "research-studio",
      effective: "base",
      package_revision: fixture.binding,
    },
  })
  expect({
    binding: requireTaskPackageRevisionBinding(fixture.taskID),
    overlay: (await Session.get(fixture.root.id)).metadata?.configOverlay,
  }).toEqual({ binding: fixture.binding, overlay: { prompt_profile: { active: "base" } } })
  const clear = await request(project.path, `/session/${fixture.root.id}/config`, "PATCH", { prompt_profile: null })
  console.log("Task clear actual contract", JSON.stringify(clear))
  expect(clear).toMatchObject({
    status: 409,
    body: {
      name: "TaskPromptProfileImmutableError",
      data: { taskID: fixture.taskID, requestedProfileID: "research-studio", pinnedPackageRevision: fixture.binding },
    },
  })
  expect({
    binding: requireTaskPackageRevisionBinding(fixture.taskID),
    overlay: (await Session.get(fixture.root.id)).metadata?.configOverlay,
  }).toEqual({ binding: fixture.binding, overlay: { prompt_profile: { active: "base" } } })
  const file = ConfigPaths.projectFile(project.path)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(
    file,
    JSON.stringify({ model: "missing-eligibility89/model", small_model: "missing-eligibility89/model" }),
  )
  await cold()
  const readable = await detail(project.path, "research-studio", "built_in")
  expect(readable.selection.effective_identity).toEqual({ id: "research-studio", source: { kind: "built_in" } })
  const missing = await request(project.path, "/config", "PATCH", { prompt_profile: { active: "research-studio" } })
  expect({ status: missing.status, body: missing.body }).toMatchObject({
    status: 400,
    body: { name: "ProviderModelNotFoundError", data: { providerID: "missing-eligibility89", modelID: "model" } },
  })
  await fs.writeFile(file, JSON.stringify({ model: "", small_model: "" }))
  await cold()
  const blank = await request(project.path, "/config", "PATCH", { prompt_profile: { active: "research-studio" } })
  console.log("blank model current config contract", JSON.stringify(blank))
  const message =
    'config: model: Model must be in the format "provider/model".; small_model: Model must be in the format "provider/model".'
  expect(blank).toEqual({ status: 400, body: { success: false, data: { message }, error: [{ message }] } })
})

test("held actual selected loader reports generation400 then accepts the next coherent detail", async () => {
  await using project = await memoryProject("eligibility89-generation")
  await install(project.path, "generation89", "generation-author", "project")
  await cold()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const original = ExpertSquadRegistry.loadInstalledCatalogPackage
  let held = true
  const loader = spyOn(ExpertSquadRegistry, "loadInstalledCatalogPackage").mockImplementation(async (input) => {
    const result = await original(input)
    if (held) {
      held = false
      entered.resolve()
      await release.promise
    }
    return result
  })
  const pending = request(
    project.path,
    "/expert-squad/settings/detail?id=generation89&installationScope=project&namespace=generation-author",
  )
  try {
    await Promise.race([
      entered.promise,
      pending.then((result) => {
        throw new Error(`Selected loader was not entered: ${result.status} ${JSON.stringify(result.body)}`)
      }),
    ])
    await ExpertSquadRegistry.invalidateAvailable()
    release.resolve()
    const retired = await pending
    expect(retired).toMatchObject({
      status: 400,
      body: {
        name: "ExpertSquadPackageError",
        data: { message: "Expert squad catalog generation changed while loading settings detail." },
      },
    })
  } finally {
    release.resolve()
    await pending
    loader.mockRestore()
  }
  const current = await detail(project.path, "generation89", "project", "generation-author")
  expect({
    id: current.selected.id,
    namespace: current.selected.source.kind === "installed_package" ? current.selected.source.namespace : null,
    winner: current.selection.effective_identity,
  }).toEqual({
    id: "generation89",
    namespace: "generation-author",
    winner: identity("generation89", "project", "generation-author"),
  })
})
