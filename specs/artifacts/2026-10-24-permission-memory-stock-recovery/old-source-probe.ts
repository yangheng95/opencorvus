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
  const project = await memoryProject("old-permission-publication-upgrade")
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory,
      title: "Old in-flight permission", metadata: { configOverlay: { model: null } } })
    const taskID = Identifier.ascending("task"), now = Date.now()
    const packageRevision = { scope: "built_in" as const, projectID: null, namespace: "builtin",
      id: "interaction-memory-test", version: "2026.10.24.1", packageDigest: "b".repeat(64) }
    persistEstablishedTask({ taskID, rootSession: root, now, title: "Old in-flight permission",
      request: "Preserve the real human reply across upgrade.", productPillar: "work", source: "test",
      priority: "normal", metadata: { actor: "mission" }, projectID: Instance.project.id, packageRevision,
      executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID,
        projectID: Instance.project.id, rootDirectory: Instance.directory,
        packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now }) })
    const entered = Promise.withResolvers<void>(), asked = Promise.withResolvers<any>()
    const subscribe = Bus.subscribe
    Bus.subscribe = ((definition: any, callback: any, options: any) => {
      if (options?.durableID !== "engine.interaction.permission-replied" || mode === "old-success") return subscribe(definition, callback, options)
      return subscribe(definition, async (event: any) => {
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
    checkpoint(request.id)
  } })
} else {
  const before = JSON.parse(await fs.readFile(path.join(evidence, "before.json"), "utf8"))
  if (mode === "new-ambiguous") {
    let error: any
    try { Database.Identity() } catch (caught) { error = caught }
    console.log(JSON.stringify({ upgradeError: error && { name: error.name, code: error.code, message: error.message, data: error.data,
      cause: error.cause && { name: error.cause.name, code: error.cause.code, message: error.cause.message } } }))
    assert.equal(error?.data?.code, "SCHEMA_MIGRATION_REQUIRED")
    assert(error.data.message.includes(before.requestID))
    const backupDirectory = path.join(path.dirname(before.databasePath), "migration-backups")
    const backupPaths = fsSync.readdirSync(backupDirectory).filter(name => name.startsWith("opencorvus.db.v4-to-v5.") && name.endsWith(".sqlite"))
      .map(name => path.join(backupDirectory, name))
    assert(backupPaths.length > 0)
    const read = (file: string) => {
      using sqlite = new SQLite(file, { readonly: true })
      const schema = sqlite.query("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
      const names = sqlite.query("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as Array<{ name: string }>
      const rows = names.map(({ name }) => ({ name, rows: sqlite.query(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all() }))
      return { schema, rows, version: sqlite.query("PRAGMA user_version").get() }
    }
    const original = read(path.join(evidence, "before.sqlite")), after = read(before.databasePath)
    assert.deepEqual(after, original)
    for (const backup of backupPaths) assert.deepEqual(read(backup), original)
    await fs.writeFile(path.join(evidence, "upgrade-error.json"), JSON.stringify({ name: error.name, code: error.data.code,
      message: error.data.message, backupPaths, originalTableCount: original.rows.length,
      originalRowCount: original.rows.reduce((sum, table) => sum + table.rows.length, 0),
      originalVersion: original.version, finalVersion: after.version, originalAndBackupRowsEqual: true }, null, 2))
    console.log(JSON.stringify({ mode, code: error.data.code, originalAndBackupRowsEqual: true }))
  } else await Instance.provide({ directory: before.directory, fn: async () => {
    EngineService.init()
    Bus.resumeDurablePublications()
    await until(() => Bus.TestHooks.outbox().length === 0, "recover original old publication")
    const after = facts(before.requestID)
    await fs.writeFile(path.join(evidence, "after.json"), JSON.stringify(after, null, 2))
    console.log(JSON.stringify({ mode, pending: after.memory.pendingCount, expected: mode === "new-settled" ? 0 : 1,
      terminalID: after.interaction?.id, originalTerminalID: before.interaction.id }))
    if (mode === "new-settled") {
      assert.equal(after.memory.pendingCount, 0)
      assert.deepEqual(JSON.parse(JSON.stringify(after.memory)), before.memory)
      const publication = before.outbox.find((row: any) => row.event_type === "permission.replied")
      const receipt = (rows: any[]) => rows.filter(row => row.occurrence_id === publication.occurrence_id && row.subscriber_id === "engine.interaction.permission-replied")
      assert.deepEqual(receipt(after.receipts), receipt(before.receipts))
      assert.deepEqual(after.ledger, before.ledger)
    } else {
      assert.equal(after.memory.pendingCount, 1, "the old original human input reaches memory exactly once")
      assert.equal(after.pending[0]!.text, "Keep this authentic old input.")
    }
    assert.equal(after.interaction?.id, before.interaction.id)
  } })
  if (mode !== "new-ambiguous") {
    await Instance.disposeAll()
    await Database.awaitEffectIdle(30_000)
    Database.close()
  }
  await Log.close()
}
