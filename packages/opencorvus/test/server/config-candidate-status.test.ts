import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { hostGit } from "@/util/git"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { ConfigCandidateValidationError } from "@/config/candidate-validation"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { serverErrorResponse, publicUnknownErrorMessage } from "@/server/error-handler"
import { Auth } from "@/auth"
import { DatabaseUnavailableError } from "@/storage/db"
import { Provider } from "@/provider/provider"
import { OwnedPromptControllersError } from "@/engine/runtime"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

test("public VCS metadata binds current Git information and directory admission", async () => {
  const spec = await Server.openapi()
  expect(spec.paths?.["/vcs"]?.get?.responses?.["200"]).toMatchObject({
    content: { "application/json": { schema: { $ref: "#/components/schemas/VcsInfo" } } },
  })
  expect(spec.paths?.["/vcs"]?.get?.responses?.["400"]).toMatchObject({
    description: "Project directory required",
    content: { "application/json": { schema: {
      type: "object", required: ["name", "data"], properties: { name: { type: "string", const: "DirectoryRequiredError" } },
    } } },
  })
  expect(ConfigCandidateValidationError.Schema.parse(new ConfigCandidateValidationError({ message: "Owned metadata contract" }).toObject())).toEqual({ name: "ConfigCandidateValidationError", data: { message: "Owned metadata contract" } })
  expect(Provider.ModelNotFoundError.Schema.parse(new Provider.ModelNotFoundError({ providerID: "missing96", modelID: "model", suggestions: [] }).toObject())).toEqual({ name: "ProviderModelNotFoundError", data: { providerID: "missing96", modelID: "model", suggestions: [] } })
})
afterEach(async () => {
  await Instance.disposeAll()
  await ExpertSquadRegistry.invalidateAvailable()
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function cold(directory: string, config: Config.Info, route = "/session/status") {
  const project = await Instance.provideProjectIdentity({ directory, fn: () => ({ ...Instance.project }) })
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(config))
  await Instance.disposeAll()
  Server.resetProjectRoutesAppForTest()
  const result = await runOutsideInstanceContext(async () => {
    const response = await Server.App().request(`${route}?directory=${encodeURIComponent(directory)}`, {
      headers: { "x-opencorvus-directory": directory },
    })
    return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.json() }
  })
  console.log("candidate96 cold", JSON.stringify({ project, directory, file, config, result }))
  expect(typeof result.headers["x-opencorvus-request-id"]).toBe("string")
  return result
}

async function configFor(directory: string) {
  return Instance.provideProjectIdentity({ directory, fn: () => Config.get() })
}
async function collision(directory: string) {
  const root = path.join(ExpertSquadPackageLocations.project(directory).packagesRoot, "collision96", "base")
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, "expert-squad.jsonc"), "{}")
  await ExpertSquadRegistry.invalidateAvailable()
  console.log(
    "candidate96 collision",
    JSON.stringify({ root, discovery: await ExpertSquadRegistry.discoverAvailable(directory) }),
  )
}
const collisionMessage = 'External expert squad package id "base" collides with a built-in expert squad id.'

test("cold builtin collision returns canonical candidate validation 400", async () => {
  await using project = await memoryProject("candidate96-collision")
  const config = await configFor(project.path)
  await collision(project.path)
  const result = await cold(project.path, { ...config, prompt_profile: { active: "base" } })
  expect({ status: result.status, body: result.body }).toEqual({
    status: 400,
    body: { name: "ConfigCandidateValidationError", data: { message: collisionMessage } },
  })
})

test("cold lawful external active profile with colliding nonactive builtin mount returns candidate 400", async () => {
  await using project = await memoryProject("candidate96-mount")
  const config = await configFor(project.path)
  const definition: ExpertSquadPackageDefinition = {
    manifest: {
      schema_version: 2,
      namespace: "candidate96",
      id: "mount-active96",
      label: "Mount active",
      description: "Owned mount contract",
      version: "2026.10.07.1",
      product_pillars: ["code"],
      readme: "README.md",
      selector: { summary: "Owned mount", selection_guidance: "Inspect mount", instructions: "selector.md" },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": "# Mount active\n", "selector.md": "# Mount\n" },
  }
  const sourceDirectory = path.join(project.path, "source")
  await writeExpertSquadPackage({ directory: sourceDirectory, definition })
  const receipt = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: () =>
      ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory,
        installationScope: "project",
      }),
  })
  console.log("candidate96 installed", JSON.stringify({ sourceDirectory, definition, receipt }))
  await collision(project.path)
  const result = await cold(project.path, {
    ...config,
    prompt_profile: { active: "mount-active96" },
    skill_mounts: { base: { orchestrator: {} } },
  })
  expect({ status: result.status, body: result.body }).toEqual({
    status: 400,
    body: { name: "ConfigCandidateValidationError", data: { message: collisionMessage } },
  })
})

test("cold unavailable explicit model preserves model-first canonical 400", async () => {
  await using project = await memoryProject("candidate96-model")
  const config = await configFor(project.path)
  await collision(project.path)
  const result = await cold(project.path, { ...config, model: "missing96/model", prompt_profile: { active: "base" } })
  expect({ status: result.status, body: result.body }).toEqual({
    status: 400,
    body: { name: "ProviderModelNotFoundError", data: { providerID: "missing96", modelID: "model", suggestions: [] } },
  })
})

test("cold lawful runtime returns its real VCS output", async () => {
  await using project = await memoryProject("candidate96-lawful")
  const branch = await hostGit(["branch", "--show-current"], { cwd: project.path, timeoutProfile: "default" })
  expect(branch.exitCode).toBe(0)
  const result = await cold(project.path, await configFor(project.path), "/vcs")
  expect(result.status).toBe(200)
  expect(result.body).toMatchObject({
    initialized: true,
    branch: branch.stdout.toString().trim(),
    clean: false,
    dirty: true,
    staged: 0,
    modified: 0,
    conflicts: 0,
    ahead: 0,
    behind: 0,
    hasRemote: false,
  })
})

{
  const rows = [
    { error: new ConfigCandidateValidationError({ message: "Invalid owned candidate" }), status: 400 },
    {
      error: new Provider.ModelNotFoundError({ providerID: "missing96", modelID: "model", suggestions: [] }),
      status: 400,
    },
    {
      error: new Auth.ReadError({
        operation: "read_saved_credentials",
        reason: "malformed_json",
        message: "Owned malformed saved credentials",
      }),
      status: 503,
    },
    {
      error: new DatabaseUnavailableError({
        message: "Owned unavailable database",
        path: "/owned96/database",
        operation: "read",
        code: "SQLITE_CANTOPEN",
      }),
      status: 503,
    },
    {
      error: new OwnedPromptControllersError({ message: "Owned prompt controllers remain", operation: "owned96" }),
      status: 409,
    },
    { error: new Error("Private ordinary error"), status: 500 },
  ]
  for (const [index, row] of rows.entries())
    test(`shared Hono canonical response ${row.error.name}`, async () => {
      const app = new Hono().onError(serverErrorResponse).get("/owned", () => {
        throw row.error
      })
      const response = await app.request("/owned")
      const actual = {
        index,
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.json(),
      }
      console.log("candidate96 shared", JSON.stringify(actual))
      expect(actual.status).toBe(row.status)
      expect(typeof actual.headers["x-opencorvus-request-id"]).toBe("string")
      expect(actual.body).toEqual(
        "toObject" in row.error
          ? row.error.toObject()
          : { name: "UnknownError", data: { message: publicUnknownErrorMessage() } },
      )
    })
}
