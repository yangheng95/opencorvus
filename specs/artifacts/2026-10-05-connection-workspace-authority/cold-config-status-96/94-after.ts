import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTaskPackageRevisionBinding } from "@/engine/task-package-revision-binding"
import { resolvePinnedTaskSchedulerTurnProjection } from "@/engine/task-package-projection"
import { SkillMount } from "@/skill/mounts"
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
      version: "2026.10.07.1",
      description: "Owned builtin identity contract",
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: "Owned contract",
        selection_guidance: "Inspect actual identity",
        instructions: "selector.md",
      },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": `# ${namespace}/${id}\n`, "selector.md": "# Identity contract\n" },
  }
}
async function collision(directory: string, scope: "project" | "global", malformed: boolean, id = "base") {
  const root = path.join(
    (scope === "project" ? ExpertSquadPackageLocations.project(directory) : ExpertSquadPackageLocations.global())
      .packagesRoot,
    "collision-check",
    id,
  )
  if (scope === "global") globalRoots.add(root)
  if (malformed) {
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(path.join(root, "expert-squad.jsonc"), "{}")
  } else await writeExpertSquadPackage({ directory: root, definition: definition(id, "collision-check") })
  await ExpertSquadRegistry.invalidateAvailable()
  return root
}
const config = { prompt_profile: { active: "base" } }
async function actualConfig(directory: string) {
  return Instance.provideProjectIdentity({ directory, fn: async () => Config.mergeOverlay(await Config.get(), config) })
}
async function installExternal(directory: string, id: string) {
  const sourceDirectory = path.join(directory, `source-${id}`)
  await writeExpertSquadPackage({ directory: sourceDirectory, definition: definition(id, "external-check") })
  return Instance.provideProjectIdentity({
    directory,
    fn: () =>
      ExpertSquadPackageManager.importDirectory({
        projectDirectory: directory,
        sourceDirectory,
        installationScope: "project",
      }),
  })
}
const message = (id: string) =>
  `External expert squad package id ${JSON.stringify(id)} collides with a built-in expert squad id.`
async function observed<T>(action: () => Promise<T>) {
  try {
    return { kind: "value" as const, value: await action() }
  } catch (error) {
    return { kind: "error" as const, error }
  }
}
function collisionFact(result: Awaited<ReturnType<typeof observed>>) {
  return result.kind === "error"
    ? {
        kind: result.kind,
        name: result.error instanceof Error ? result.error.name : "unknown",
        message: result.error instanceof Error ? result.error.message : String(result.error),
      }
    : { kind: result.kind }
}
async function coldRequest(directory: string) {
  await Instance.disposeAll()
  Server.resetProjectRoutesAppForTest()
  return runOutsideInstanceContext(async () => {
    const response = await Server.App().request(`/vcs?directory=${encodeURIComponent(directory)}`, {
      headers: { "x-opencorvus-directory": directory },
    })
    return { status: response.status, body: await response.json() }
  })
}

test("lawful unbound builtin Project and global return real materialized scheduler identity", async () => {
  await using project = await memoryProject("collision94-lawful")
  const effective = await actualConfig(project.path)
  for (const input of [{ projectDirectory: project.path }, { scope: "global" as const }]) {
    const revision = await PromptProfileResolver.resolveActivePackageRevision({
      ...input,
      config: effective,
      defaultSkills: [],
    })
    const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
      ...input,
      config: effective,
      defaultSkills: [],
    })
    console.log("lawful", JSON.stringify({ input, revision, identity: scheduler.identity }))
    expect({ id: revision.id, scope: revision.scope, namespace: revision.namespace }).toEqual({
      id: "base",
      scope: "built_in",
      namespace: "builtin",
    })
    expect(scheduler.packageRevision).toEqual(revision)
    expect(scheduler.expertSquadID).toBe("base")
  }
})

for (const scope of ["project", "global"] as const)
  for (const malformed of [false, true]) {
    test(`unbound ${scope} ${malformed ? "malformed" : "SDK-valid"} builtin collision returns original collision Error`, async () => {
      await using project = await memoryProject(`collision94-${scope}-${malformed}`)
      const effective = await actualConfig(project.path)
      await collision(project.path, scope, malformed)
      const discovery =
        scope === "project"
          ? await ExpertSquadRegistry.discoverAvailable(project.path)
          : await ExpertSquadRegistry.discoverGlobalAvailable()
      const result = await observed(() =>
        PromptProfileResolver.resolveSchedulerCapability({
          ...(scope === "project" ? { projectDirectory: project.path } : { scope }),
          config: effective,
          defaultSkills: [],
        }),
      )
      console.log(
        "collision",
        JSON.stringify({ scope, malformed, issues: discovery.issues, result: collisionFact(result) }),
      )
      expect(collisionFact(result)).toEqual({ kind: "error", name: "Error", message: message("base") })
    })
  }

test("lawful external Project wins over broken same-ID global and unbound builtin recovers after own collision removal", async () => {
  await using project = await memoryProject("collision94-external")
  const id = "external94"
  const installed = await installExternal(project.path, id)
  await collision(project.path, "global", true, id)
  const resolved = await PromptProfileResolver.resolveActivePackageRevision({
    projectDirectory: project.path,
    config: { prompt_profile: { active: id } },
    defaultSkills: [],
  })
  expect({ id: resolved.id, scope: resolved.scope, namespace: resolved.namespace, version: resolved.version }).toEqual({
    id,
    scope: "project",
    namespace: "external-check",
    version: "2026.10.07.1",
  })
  expect(resolved.packageDigest).toBe(installed.after.packageDigest)
  const root = await collision(project.path, "project", true)
  await fs.rm(root, { recursive: true, force: true })
  await ExpertSquadRegistry.invalidateAvailable()
  const recovered = await PromptProfileResolver.resolveActivePackageRevision({
    projectDirectory: project.path,
    config,
    defaultSkills: [],
  })
  await using clean = await memoryProject("collision94-clean")
  const separate = await PromptProfileResolver.resolveActivePackageRevision({
    projectDirectory: clean.path,
    config,
    defaultSkills: [],
  })
  expect({ recovered: recovered.id, separate: separate.id }).toEqual({ recovered: "base", separate: "base" })
})

test("explicit global scope keeps global authority when a Project directory is supplied", async () => {
  await using project = await memoryProject("collision94-global-scope")
  const effective = await actualConfig(project.path)
  await collision(project.path, "project", false)
  const revision = await PromptProfileResolver.resolveActivePackageRevision({
    projectDirectory: project.path,
    scope: "global",
    config: effective,
    defaultSkills: [],
  })
  expect({ scope: revision.scope, namespace: revision.namespace, id: revision.id }).toEqual({
    scope: "built_in",
    namespace: "builtin",
    id: "base",
  })
  await collision(project.path, "global", true)
  const result = await observed(() =>
    PromptProfileResolver.resolveActivePackageRevision({
      projectDirectory: project.path,
      scope: "global",
      config: effective,
      defaultSkills: [],
    }),
  )
  console.log("explicit global supplied Project", JSON.stringify({ revision, result: collisionFact(result) }))
  expect(collisionFact(result)).toEqual({ kind: "error", name: "Error", message: message("base") })
})

test("nonactive builtin mount collision returns original Error and lawful empty mount validates identity", async () => {
  await using project = await memoryProject("collision94-mount")
  await installExternal(project.path, "mount-active94")
  const mounts = { base: { orchestrator: {} } }
  const mountConfig = { prompt_profile: { active: "mount-active94" }, skill_mounts: mounts }
  await PromptProfileResolver.assertSkillMountConfig({
    projectDirectory: project.path,
    config: mountConfig,
    defaultSkills: [],
  })
  console.log("lawful empty mount identity validation completed")
  await collision(project.path, "project", true)
  const result = await observed(() =>
    PromptProfileResolver.assertSkillMountConfig({
      projectDirectory: project.path,
      config: mountConfig,
      defaultSkills: [],
    }),
  )
  console.log("mount", JSON.stringify(collisionFact(result)))
  expect(collisionFact(result)).toEqual({ kind: "error", name: "Error", message: message("base") })
})

test("actual Task immutable scheduler worker and mount matrix retain original owner after later installed collision", async () => {
  await using project = await memoryProject("collision94-pinned")
  await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const actualConfig = Config.mergeOverlay(await Config.get(), config)
      const revision = await PromptProfileResolver.resolveActivePackageRevision({
        projectDirectory: project.path,
        config: actualConfig,
        defaultSkills: [],
      })
      const frozen = await ExpertSquadRegistry.loadPackageRevisionSnapshot(revision.packageDigest)
      const workerID = Object.keys(frozen.manifest.capability_projection.agents)[0]
      if (!workerID) throw new Error("Actual builtin has no projected worker")
      const taskID = Identifier.ascending("task")
      const now = Date.now()
      const root = Session.prepareRootNext({
        kind: "root",
        directory: project.path,
        title: "Actual pinned owner94",
        metadata: { taskConfigSnapshot: actualConfig, configOverlay: config },
      })
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: root.title,
        request: "Inspect immutable runtime authority",
        productPillar: "code",
        source: "test",
        metadata: {},
        projectID: Instance.project.id,
        packageRevision: revision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: revision.packageDigest,
          timeCreated: now,
        }),
      })
      const originalBinding = requireTaskPackageRevisionBinding(taskID)
      await collision(project.path, "project", false)
      const scheduler = await resolvePinnedTaskSchedulerTurnProjection({
        taskID,
        projectDirectory: project.path,
        config: actualConfig,
      })
      const worker = await PromptProfileResolver.resolveWorkerTurnProjection({
        projectDirectory: project.path,
        config: actualConfig,
        agentID: workerID,
        packageRevision: revision,
        defaultSkills: [],
      })
      await PromptProfileResolver.assertSkillMountConfig({
        projectDirectory: project.path,
        config: { ...actualConfig, skill_mounts: { base: { orchestrator: {} } } },
        packageRevision: revision,
        defaultSkills: [],
      })
      const matrix = await SkillMount.matrix({ sessionID: root.id })
      console.log(
        "pinned",
        JSON.stringify({
          revision,
          workerID,
          matrix: { active_profile: matrix.active_profile, projection_hash: matrix.projection_hash },
        }),
      )
      expect(scheduler.packageRevision).toEqual(revision)
      expect(worker.workerCapability.packageRevision).toEqual(revision)
      expect(worker.workerCapability.identity.agentID).toBe(workerID)
      expect(requireTaskPackageRevisionBinding(taskID)).toEqual(originalBinding)
      expect(matrix.active_profile).toBe("base")
    },
  })
})

test("matching pinned mount does not exempt another colliding builtin mount target", async () => {
  await using project = await memoryProject("collision94-othermount")
  const revision = await PromptProfileResolver.resolveActivePackageRevision({
    projectDirectory: project.path,
    config,
    defaultSkills: [],
  })
  await collision(project.path, "project", true, "research-studio")
  const result = await observed(() =>
    PromptProfileResolver.assertSkillMountConfig({
      projectDirectory: project.path,
      config: { ...config, skill_mounts: { "research-studio": { orchestrator: {} } } },
      packageRevision: revision,
      defaultSkills: [],
    }),
  )
  console.log("other mount", JSON.stringify(collisionFact(result)))
  expect(collisionFact(result)).toEqual({ kind: "error", name: "Error", message: message("research-studio") })
})

test("cold actual config preserves model-first error and builtin collision candidate wrapper", async () => {
  await using project = await memoryProject("collision94-cold")
  await collision(project.path, "project", true)
  const file = ConfigPaths.projectFile(project.path)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ model: "missing94/model", ...config }))
  const model = await coldRequest(project.path)
  console.log("cold model", JSON.stringify(model))
  expect(model).toMatchObject({
    status: 400,
    body: { name: "ProviderModelNotFoundError", data: { providerID: "missing94", modelID: "model" } },
  })
  await fs.writeFile(file, JSON.stringify(config))
  const rejected = await coldRequest(project.path)
  console.log("cold collision", JSON.stringify(rejected))
  expect(rejected).toMatchObject({
    status: 400,
    body: { name: "ConfigCandidateValidationError", data: { message: message("base") } },
  })
})
