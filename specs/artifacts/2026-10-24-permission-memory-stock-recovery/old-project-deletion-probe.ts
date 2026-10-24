import assert from "node:assert/strict"
import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"

const [mode, evidence] = process.argv.slice(2)
assert(mode && evidence && path.isAbsolute(evidence))
await fs.mkdir(evidence, { recursive: true })
if (mode.startsWith("old")) {
  const { bootstrapIsolatedTestRuntime } = await import("@opencorvus-ai/util/test-runtime-environment")
  await bootstrapIsolatedTestRuntime("test")
  process.env.OPENCORVUS_MODELS_PATH = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "models.json")
  const { ModelsDev } = await import("@/provider/models")
  const catalog = JSON.parse(await fs.readFile(path.join(import.meta.dir, "src/provider/models-bootstrap.json"), "utf8"))
  await fs.writeFile(process.env.OPENCORVUS_MODELS_PATH, JSON.stringify(ModelsDev.withLocalProviders(catalog)))
} else {
  const saved = JSON.parse(await fs.readFile(path.join(evidence, "before.json"), "utf8"))
  Object.assign(process.env, saved.environment)
}
const { Log } = await import("@/util/log")
await Log.init({ print: false, dev: true, level: "DEBUG" })
const { installDefaultControlPlaneToolLoaders } = await import("@/tool/control-plane-tool-composition")
installDefaultControlPlaneToolLoaders()
const { declareNativeTaskProcessDeployment } = await import("@/runtime/task-process-deployment")
declareNativeTaskProcessDeployment()
const { Bus } = await import("@/bus")
const { Config } = await import("@/config/config")
const { Database } = await import("@/storage/db")
const { Instance } = await import("@/project/instance")
const { ProjectMemory } = await import("@/memory/project-memory")
const { PermissionAuthority } = await import("@/permission/authority")
const { PermissionRoutes } = await import("@/server/routes/permission")
const { Session } = await import("@/session")
const { Identifier } = await import("@/id/id")
const { EngineService } = await import("@/task-api")
const { findInteractionByExternal } = await import("@/engine/store")
const { prepareTaskProcessBinding } = await import("@/engine/task-execution-capsule-binding")
const { persistEstablishedTask } = await import("./test/fixture/engine-task")
const { memoryProject } = await import("./test/fixture/memory")
async function until(check: () => boolean, label: string) {
  const deadline = Date.now() + 60_000
  while (!check()) {
    assert(Date.now() < deadline, label)
    await Bun.sleep(30)
  }
}
function facts(requestID: string) {
  return { projectID: Instance.project.id, directory: Instance.directory, requestID,
    databasePath: Database.Path(), interaction: findInteractionByExternal(requestID),
    memory: ProjectMemory.read(Instance.project.id), pending: ProjectMemory.pending(Instance.project.id),
    ledger: Database.allFinalized("SELECT * FROM permission_ledger"),
    outbox: Database.allFinalized("SELECT * FROM bus_publication_outbox"),
    deliveries: Database.allFinalized("SELECT * FROM bus_publication_delivery"),
    receipts: Database.allFinalized("SELECT * FROM bus_publication_delivery_receipt"),
    leases: Database.allFinalized("SELECT * FROM engine_control_activation_lease"),
  }
}
function consumeMemory(ids: string[], name: string) {
  const projectID = Instance.project.id
  Database.immediateTransaction(db => {
    const snapshot = ProjectMemory.read(projectID), leaseID = `upgrade-${name}`
    ProjectMemory.beginOrganizerAttemptInTransaction(db, { projectID, leaseID, expectedRevision: snapshot.revision, timeUpdated: Date.now() })
    ProjectMemory.commitOrganizationInTransaction(db, { projectID, leaseID, baseRevision: snapshot.revision,
      coveredOccurrenceIDs: ids, markdown: `# Context\n\n${name}\n`, timeUpdated: Date.now() + 1 })
  })
}
function checkpoint(requestID: string) {
  const before = facts(requestID)
  assert.equal(before.memory.pendingCount, mode === "old-pending" ? 1 : 0)
  assert.equal(before.interaction?.status, "answered")
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    ["OPENCORVUS_HOME", "OPENCORVUS_TEST_PROCESS_ROOT", "OPENCORVUS_TEST_HOME", "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
     "OPENCORVUS_MODELS_PATH", "OPENCORVUS_PROCESS_SUPERVISOR", "TEMP", "TMP", "TMPDIR", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_STATE_HOME"].includes(key)))
  fsSync.writeFileSync(path.join(evidence, "before.json"), JSON.stringify({ ...before, environment }, null, 2))
  using sqlite = new SQLite(before.databasePath, { readonly: true })
  fsSync.writeFileSync(path.join(evidence, "before.sqlite"), sqlite.serialize())
  console.log(JSON.stringify({ mode, databasePath: before.databasePath, requestID, pending: before.memory.pendingCount, deliberateExit: 23 }))
  process.exit(23)
}
if (mode.startsWith("old")) {
  console.log("probe:creating-project")
  const project = await memoryProject("old-permission-publication-upgrade")
  console.log("probe:created-project")
  const permissionDirectory = mode === "old-project-subdirectory" ? path.join(project.path,"nested","active") : project.path
  await fs.mkdir(permissionDirectory,{recursive:true})
  const { Project } = await import("@/project/project")
  const parent = mode === "old-project-subdirectory" ? await Project.fromDirectory(project.path) : undefined
  console.log("probe:parent-registered")
  if (parent) await Project.addSandbox(parent.project.id, permissionDirectory)
  console.log("probe:sandbox-registered")
  const setup = await Instance.provide({ directory: permissionDirectory, fn: async () => {
    console.log("probe:child-instance")
    if (parent) assert.equal(Instance.project.id, parent.project.id)
    await Config.updateProjectPatch({ permission_mode: "ask" })
    const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory,
      title: "Old in-flight permission", metadata: { configOverlay: { model: null } } })
    const taskID = Identifier.ascending("task"), now = Date.now()
    const packageRevision = { scope: "built_in" as const, projectID: null, namespace: "builtin",
      id: "interaction-memory-test", version: "2026.10.24.1", packageDigest: "b".repeat(64) }
    persistEstablishedTask({ taskID, rootSession: root, now, title: "Old in-flight permission",
      request: "Preserve the real human reply across upgrade.", productPillar: "work", source: "test",
      priority: "normal", metadata: { actor: "user" }, projectID: Instance.project.id, packageRevision,
      executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID,
        projectID: Instance.project.id, rootDirectory: Instance.directory,
        packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }) })
    const entered = Promise.withResolvers<void>(), asked = Promise.withResolvers<any>()
    const subscribe = Bus.subscribe
    Bus.subscribe = ((definition: any, callback: any, options: any) => {
      if (options?.durableID !== "engine.interaction.permission-replied" || mode === "old-success") return subscribe(definition, callback, options)
      return subscribe(definition, async (event: any) => {
        if (mode.startsWith("old-project-")) { await callback(event); entered.resolve(); throw new Error("OLD_PERMISSION_EFFECT_BEFORE_RECEIPT"); }
        if (mode === "old-pending" || mode === "old-covered") {
          await callback(event)
          if (mode === "old-pending") Database.use(db => db.run("UPDATE engine_task SET title='Later name after original capture'"))
          if (mode === "old-covered") consumeMemory([findInteractionByExternal(event.properties.requestID)!.id], "original human consumed before receipt")
        }
        if (mode === "old-gap") {
          await callback(event)
          const interaction = findInteractionByExternal(event.properties.requestID)!
          const projectID = Instance.project.id
          consumeMemory([interaction.id], "original human consumed before receipt")
          for (let index = 0; index < 501; index++) {
            const id = Identifier.ascending("message"), text = `Fresh human input ${index}`
            await Session.persistMessage({ info: { id, sessionID: root.id, role: "user", author: "user", agent: "work",
              model: { providerID: "test", modelID: "upgrade" }, time: { created: Date.now() },
              extra: ProjectMemory.userInputExtra({ surface: "test.upgrade", literalText: text }) },
              parts: [{ id: Identifier.ascending("part"), messageID: id, sessionID: root.id, type: "text", text, kind: "user_content", source: "user" }] })
          }
          consumeMemory(ProjectMemory.pending(projectID).map(entry => entry.occurrenceID), "501 later human inputs consumed")
        }
        entered.resolve(); await new Promise(() => {})
      }, options)
    }) as typeof Bus.subscribe
    EngineService.init()
    subscribe(PermissionAuthority.Event.Asked, ({ properties }) => asked.resolve(properties))
    void PermissionAuthority.authorizeAndExecute({ projectID: Instance.project.id, sessionID: root.id,
      messageID: "msg_old_upgrade", toolCallID: "call_old_upgrade", providerKind: "builtin", providerID: "builtin",
      toolName: "webfetch", args: { url: "https://example.test/upgrade" } }, async () => "original effect").catch(() => {})
    const request = await asked.promise
    await until(() => findInteractionByExternal(request.id)?.status === "pending" && Bus.TestHooks.outbox().length === 0, "old Asked projection")
    if (mode === "old-ready") {
      const publish = Bus.publishOwnedInTransaction
      Bus.publishOwnedInTransaction = ((definition: any, properties: any) => {
        const publication = publish(definition, properties)
        if (definition.type === "permission.replied") Database.effect(() => checkpoint(request.id))
        return publication
      }) as typeof Bus.publishOwnedInTransaction
    }
    const reply = PermissionRoutes().request(`/${request.id}/reply`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "allow_once", actorID: "operator", message: "Keep this authentic old input." }) })
    void reply.catch(() => {})
    if (mode === "old-success") {
      assert.equal((await reply).status, 200)
      await until(() => Bus.TestHooks.outbox().length === 0, "old successful delivery")
      consumeMemory([findInteractionByExternal(request.id)!.id], "old successful reply consumed")
      checkpoint(request.id)
    }
    await entered.promise
    if (mode.startsWith("old-project-")) { assert.equal((await reply).status, 500); return { projectID: Instance.project.id, directory: Instance.directory, requestID: request.id } }
    checkpoint(request.id)
  } })
  if (mode.startsWith("old-project-")) {
    const { Project } = await import("@/project/project")
    const { deleteProject } = await import("@/project/delete")
    if (mode === "old-project-subdirectory") {
      await Project.removeSandbox(setup!.projectID, setup!.directory)
      const registered = Project.get(setup!.projectID)!
      assert.equal(registered.worktree, project.path)
      assert.equal(registered.sandboxes.length, 0)
      const relative = path.relative(registered.worktree, setup!.directory)
      assert(relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative))
    }
    const result = await deleteProject(Project.get(setup!.projectID)!, { actor: "user", source: "project.delete", surface: "api", requestID: "old-project-retirement", reason: "Controlled original Project deletion before old delivery receipt" })
    assert.equal(result.status, "committed")
    const rows = Database.allFinalized("SELECT * FROM bus_publication_outbox WHERE event_type='permission.replied'")
    assert.equal(rows.length, 1)
    const receipts = Database.allFinalized("SELECT * FROM bus_publication_delivery_receipt WHERE subscriber_id='engine.interaction.permission-replied' AND outcome='succeeded'")
    assert.equal(receipts.length, 0)
    assert.equal(Database.allFinalized("SELECT * FROM project").length, 0)
    if (mode === "old-project-recreated") {
      const recreated = await Project.fromDirectory(setup!.directory)
      assert.equal(recreated.project.id, setup!.projectID)
      await Instance.provide({ directory: setup!.directory, fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "New real owner after Project recreation", metadata: { configOverlay: { model: null } } })
        const messageID = Identifier.ascending("message"), text = "Fresh human input in the recreated Project."
        await Session.persistMessage({ info: { id: messageID, sessionID: session.id, role: "user", author: "user", agent: "work",
          model: { providerID: "test", modelID: "recreated" }, time: { created: Date.now() },
          extra: ProjectMemory.userInputExtra({ surface: "http.session", literalText: text }) },
          parts: [{ id: Identifier.ascending("part"), messageID, sessionID: session.id, type: "text", text, kind: "user_content", source: "user" }] })
        assert.equal(ProjectMemory.pending(setup!.projectID).length, 1)
        Object.assign(setup!, { newSessionID: session.id, newMessageID: messageID, newProjectGeneration: recreated.project.generation })
        ProjectMemory.read(setup!.projectID)
      } })
    }
    const before = { ...setup, databasePath: Database.Path(), deletion: result, originalPublication: rows[0], successCount: receipts.length, authority: Database.Identity() }
    fsSync.writeFileSync(path.join(evidence,"before.json"), JSON.stringify(before,null,2))
    using original = new SQLite(Database.Path(), { readonly: true })
    fsSync.writeFileSync(path.join(evidence,"before.sqlite"), original.serialize())
    fsSync.cpSync(path.join(path.dirname(Database.Path()),"maintenance","project-deletion-cleanup"),path.join(evidence,"project-deletion-cleanup"),{recursive:true})
    console.log(JSON.stringify({ mode, deletion: result.status, projectRows: 0, successCount: 0, databasePath: Database.Path(), deliberateExit: 23 }))
    process.exit(23)
  }
}
