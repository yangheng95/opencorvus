import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Database as SQLite } from "bun:sqlite"
const [action, input, externalPort] = process.argv.slice(2)
const root = path.resolve(import.meta.dir, "../../..")
const evidence = path.resolve(input!)
assert(
  evidence.startsWith(path.join(root, ".tmp-product-iteration/durable-effect-receipt-audit/automation") + path.sep),
)
fs.mkdirSync(evidence, { recursive: true })
const src = (file: string) => pathToFileURL(path.join(root, "packages/opencorvus", file)).href
const envKeys = [
  "OPENCORVUS_HOME",
  "OPENCORVUS_TEST_PROCESS_ROOT",
  "OPENCORVUS_TEST_HOME",
  "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
  "OPENCORVUS_MODELS_PATH",
  "OPENCORVUS_PROCESS_SUPERVISOR",
  "TEMP",
  "TMP",
  "TMPDIR",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_STATE_HOME",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "HOMEDRIVE",
  "HOMEPATH",
]
if (action!.startsWith("prepare-")) {
  const { bootstrapIsolatedTestRuntime } = await import(
    pathToFileURL(path.join(root, "packages/util/src/test-runtime-environment.ts")).href
  )
  await bootstrapIsolatedTestRuntime("test")
  process.env.OPENCORVUS_MODELS_PATH = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "models.json")
  const { ModelsDev } = await import(src("src/provider/models.ts"))
  fs.writeFileSync(
    process.env.OPENCORVUS_MODELS_PATH,
    JSON.stringify(
      ModelsDev.withLocalProviders(
        JSON.parse(fs.readFileSync(path.join(root, "packages/opencorvus/src/provider/models-bootstrap.json"), "utf8")),
      ),
    ),
  )
  const { expectedTestProcessSupervisor } = await import(src("script/test-process-supervisor.ts"))
  process.env.OPENCORVUS_PROCESS_SUPERVISOR = expectedTestProcessSupervisor()!
} else Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(evidence, "before.json"), "utf8")).environment)
for (const key of Object.keys(process.env))
  if (
    /(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key) ||
    ["AWS_PROFILE", "AWS_ACCESS_KEY_ID"].includes(key)
  )
    delete process.env[key]
const { Log } = await import(src("src/util/log.ts"))
await Log.init({ print: false, dev: true, level: "DEBUG" })
const { installDefaultControlPlaneToolLoaders } = await import(src("src/tool/control-plane-tool-composition.ts"))
installDefaultControlPlaneToolLoaders()
const { declareNativeTaskProcessDeployment } = await import(src("src/runtime/task-process-deployment.ts"))
declareNativeTaskProcessDeployment()
const { Database, eq } = await import(src("src/storage/db.ts"))
const { AutomationRunReceiptTable } = await import(src("src/scheduler/automation.sql.ts"))
const { Instance } = await import(src("src/project/instance.ts"))
const { Project } = await import(src("src/project/project.ts"))
const { AutomationService } = await import(src("src/scheduler/automation-service.ts"))
const { SessionWake } = await import(src("src/session/wake.ts"))
const { Scheduler } = await import(src("src/scheduler/index.ts"))
const { Config } = await import(src("src/config/config.ts"))
const { GlobalConversationService } = await import(src("src/chat/global-chat-service.ts"))
AutomationService.initGlobal({ createGlobalConversation: GlobalConversationService.create })
const tableNames = [
  "project",
  "global_creation_allocation",
  "automation",
  "automation_fire",
  "automation_fire_attempt",
  "automation_run",
  "automation_run_receipt",
  "session",
  "message",
  "part",
  "provider_activity_request",
  "engine_control_activation_lease",
]
function save(name: string, extra: any = {}) {
  using db = new SQLite(Database.Path(), { readonly: true, create: false })
  db.exec("PRAGMA query_only=ON; BEGIN")
  const tables = Object.fromEntries(
    tableNames.map((table) => {
      const query = db.query(`SELECT rowid AS original_rowid,* FROM ${table} ORDER BY rowid`)
      try {
        return [table, query.all()]
      } finally {
        query.finalize()
      }
    }),
  )
  const bytes = db.serialize()
  db.exec("COMMIT")
  const data = { time: Date.now(), databasePath: Database.Path(), tables, ...extra }
  fs.writeFileSync(path.join(evidence, `${name}.json`), JSON.stringify(data, null, 2))
  fs.writeFileSync(path.join(evidence, `${name}.sqlite`), bytes)
  return data
}
const prior = action!.startsWith("prepare-")
  ? undefined
  : JSON.parse(fs.readFileSync(path.join(evidence, "before.json"), "utf8"))
const alive = action!.endsWith("-alive") || prior?.alive === true
const requests: any[] = []
const server =
  alive && !externalPort
    ? Bun.serve({
        hostname: "127.0.0.1",
        port: prior?.providerPort ?? 0,
        idleTimeout: 255,
        async fetch(request) {
          const body = (await request.json()) as any
          const { controlledMemoryReply, controlledProviderRequestKind } = await import(
            src("test/fixture/controlled-streaming-provider.ts")
          )
          const kind = controlledProviderRequestKind(body.messages ?? [])
          requests.push({ kind, time: Date.now() })
          const content =
            kind === "memory" ? controlledMemoryReply(body.messages) : "Actual restarted Automation reply."
          const chunk = (delta: any, finish: any) =>
            `data: ${JSON.stringify({ id: `owner-${requests.length}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "local", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
          return new Response(
            chunk({ role: "assistant" }, null) + chunk({ content }, null) + chunk({}, "stop") + "data: [DONE]\n\n",
            { headers: { "content-type": "text/event-stream" } },
          )
        },
      })
    : undefined
const model = {
  model: "owner-current/local",
  provider: {
    "owner-current": {
      name: "Local owner probe",
      npm: "@ai-sdk/openai-compatible",
      api: externalPort || server ? `http://127.0.0.1:${externalPort ?? server!.port}/v1` : "http://127.0.0.1:9/unused",
      models: {
        local: {
          name: "Local owner preflight",
          tool_call: true,
          modalities: { input: ["text"], output: ["text"] },
          limit: { context: 1000000, output: 4096 },
        },
      },
    },
  },
}
if (action!.startsWith("prepare-")) {
  const scope = action!.split("-")[1]!
  const { memoryProject } = await import(src("test/fixture/memory.ts"))
  const { Session } = await import(src("src/session/index.ts"))
  const fixture = await memoryProject(`current-owner-${scope}-${path.basename(evidence)}`)
  await Config.updateGlobalPatch(model)
  await Instance.provide({
    directory: fixture.path,
    fn: async () => {
      await Config.updateProjectPatch(model)
      const session =
        scope === "session" ? await Session.create({ kind: "root", title: "Exact reserved Session" }) : undefined
      const target =
        scope === "project"
          ? { scope, projectIds: [Instance.project.id] }
          : scope === "session"
            ? { scope, sessionId: session!.id }
            : { scope: "global" }
      const job = await AutomationService.create({
        name: `Current owner ${scope}`,
        target,
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
        prompt: "Owner boundary probe; exit before Provider.",
      })
      await AutomationService.update({ id: job.id, expectedRevisionId: job.revisionId, status: "paused" })
      if (action!.includes("-allocation"))
        AutomationService.TestHooks.installBeforeRunReservation(() => {
          const facts = save("before", {
            scope,
            alive,
            allocationCut: true,
            providerPort: Number(externalPort),
            directory: fixture.path,
            automationID: job.id,
            environment: Object.fromEntries(
              envKeys.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]),
            ),
          })
          assert.equal(facts.tables.global_creation_allocation.length, 1)
          assert.equal(facts.tables.global_creation_allocation[0].accepted_target_id, null)
          assert.equal(facts.tables.automation_run.length, 0)
          const allocation = facts.tables.global_creation_allocation[0]
          assert(
            facts.tables.project.some(
              (p: any) =>
                p.id === allocation.materialized_project_id &&
                p.generation === allocation.materialized_project_generation,
            ),
          )
          console.log(
            JSON.stringify({
              action,
              cut: 23,
              allocationID: allocation.id,
              projectID: allocation.materialized_project_id,
            }),
          )
          process.exit(23)
        })
      SessionWake.TestHooks.installBeforeWakeLoopActivation(() => {
        const facts = save("before", {
          scope,
          alive,
          providerPort: server?.port,
          directory: fixture.path,
          automationID: job.id,
          environment: Object.fromEntries(
            envKeys.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]]),
          ),
        })
        assert.equal(facts.tables.automation_run.length, 1)
        assert.equal(facts.tables.automation_run_receipt.length, 0)
        assert.equal(facts.tables.provider_activity_request.length, 0)
        const run = facts.tables.automation_run[0]
        const actual = facts.tables.project.find((p: any) => p.id === (run.target_project_id ?? Instance.project.id))
        assert.equal(run.target_project_generation, actual.generation)
        if (scope === "global") assert.equal(facts.tables.global_creation_allocation[0].accepted_target_id, run.id)
        console.log(JSON.stringify({ action, cut: 23, runID: run.id, ownerGeneration: run.target_project_generation }))
        process.exit(23)
      })
      const result = await AutomationService.runNow(job.id)
      save("returned", { result })
      throw new Error("owned cut not reached")
    },
  })
} else if (action === "delete-recreate") {
  const before = JSON.parse(fs.readFileSync(path.join(evidence, "before.json"), "utf8"))
  const run = before.tables.automation_run[0]
  const originalMessage = before.tables.message.find((m: any) => JSON.parse(m.data).role === "user")
  const targetSession = before.tables.session.find((s: any) => s.id === originalMessage.session_id)
  const original = Project.occurrence(targetSession.project_id)!
  assert.equal(original.generation, run.target_project_generation)
  const { deleteProject } = await import(src("src/project/delete.ts"))
  const result = await deleteProject(original.project, {
    actor: "user",
    source: "project.delete",
    surface: "api",
    reason: "Owned generation cut acceptance",
  })
  assert.equal(result.status, "committed")
  const deleted = save("deleted", { result })
  assert.equal(deleted.tables.message.length, 0)
  fs.mkdirSync(original.project.worktree, { recursive: true })
  const next = await Project.fromDirectory(original.project.worktree)
  if (before.scope === "project") assert.equal(next.project.id, original.project.id)
  assert.equal(new Set([original.generation, next.generation]).size, 2)
  save("recreated", {
    oldProjectID: original.project.id,
    oldGeneration: original.generation,
    nextProjectID: next.project.id,
    nextGeneration: next.generation,
  })
  console.log(
    JSON.stringify({
      action,
      status: result.status,
      oldProjectID: original.project.id,
      nextProjectID: next.project.id,
    }),
  )
} else if (action.startsWith("resume-allocation")) {
  const before = prior
  const allocation = before.tables.global_creation_allocation[0]
  const lease = before.tables.engine_control_activation_lease.find(
    (l: any) => l.target === "automation" && l.target_id === before.automationID,
  )
  console.log(JSON.stringify({ waitingForRealLeaseExpiryMilliseconds: Math.max(0, lease.expires_at - Date.now()) }))
  while (lease.expires_at >= Date.now()) await Bun.sleep(Math.min(1000, lease.expires_at - Date.now() + 10))
  await Instance.provide({
    directory: before.directory,
    fn: async () => {
      const deadline = Date.now() + 90000
      for (;;) {
        await AutomationService.runDueNow()
        const facts = save(`${action}-observed`)
        if (facts.tables.automation_run_receipt.some((r: any) => r.outcome === "succeeded")) break
        assert(Date.now() < deadline, "formal polling must settle pre-reservation allocation")
        await Bun.sleep(100)
      }
      const facts = save(action, { allocationID: allocation.id })
      assert.equal(facts.tables.global_creation_allocation.length, 1)
      assert.equal(facts.tables.automation_run.length, 1)
      const original = before.tables.project.find((p: any) => p.id === allocation.materialized_project_id)
      assert.deepEqual(
        facts.tables.project.find((p: any) => p.id === allocation.materialized_project_id),
        original,
      )
      assert.equal(facts.tables.automation_run[0].target_project_generation, original.generation)
      assert.equal(facts.tables.global_creation_allocation[0].accepted_target_id, facts.tables.automation_run[0].id)
      assert.equal(facts.tables.message.filter((m: any) => JSON.parse(m.data).role === "user").length, 1)
      assert.equal(facts.tables.message.filter((m: any) => JSON.parse(m.data).finish === "stop").length, 1)
      console.log(JSON.stringify({ action, receipt: "succeeded", runID: facts.tables.automation_run[0].id }))
    },
  })
} else if (action === "resume" || action === "resume-alive") {
  const before = JSON.parse(fs.readFileSync(path.join(evidence, "before.json"), "utf8"))
  const run = before.tables.automation_run[0],
    fire = before.tables.automation_fire.find((f: any) => f.id === run.fire_id)
  const lease = before.tables.engine_control_activation_lease.find(
    (l: any) => l.target === "automation" && l.target_id === before.automationID,
  )
  console.log(JSON.stringify({ waitingForRealLeaseExpiryMilliseconds: Math.max(0, lease.expires_at - Date.now()) }))
  while (lease.expires_at >= Date.now()) await Bun.sleep(Math.min(1000, lease.expires_at - Date.now() + 10))
  await Instance.provide({
    directory: before.directory,
    fn: async () => {
      const deadline = Date.now() + 60000
      for (;;) {
        await AutomationService.runDueNow()
        const receipt = Database.use((db) =>
          db.select().from(AutomationRunReceiptTable).where(eq(AutomationRunReceiptTable.run_id, run.id)).all(),
        ).at(-1)
        if (receipt) break
        assert(Date.now() < deadline, "formal polling must settle the original retired Run")
        await Bun.sleep(100)
      }
      const facts = save("resumed", { runID: run.id, originalGeneration: run.target_project_generation, requests })
      assert.deepEqual(facts.tables.automation_run, before.tables.automation_run)
      if (alive) {
        assert.equal(facts.tables.automation_run_receipt.at(-1).outcome, "succeeded")
        const original = before.tables.message.find((m: any) => JSON.parse(m.data).role === "user")
        assert.deepEqual(
          facts.tables.message.find((m: any) => m.id === original.id),
          original,
        )
        assert.equal(requests.filter((r) => r.kind !== "memory").length, 1)
        assert(facts.tables.message.some((m: any) => JSON.parse(m.data).finish === "stop"))
      } else {
        assert.equal(facts.tables.automation_run_receipt.at(-1).disposition, "target_deleted")
        assert.equal(facts.tables.provider_activity_request.length, 0)
        assert.equal(facts.tables.message.length, 0)
      }
      console.log(
        JSON.stringify({
          action,
          receipt: facts.tables.automation_run_receipt.at(-1).outcome,
          originalRun: run.id,
          actualMessageCount: facts.tables.message.length,
          requests,
        }),
      )
    },
  })
} else throw new Error(`unknown action ${action}`)
if (alive) {
  const { Server } = await import(src("src/server/server.ts"))
  const settled = await Server.settleCurrentProcessExecution("Actual Automation recovery acceptance complete", {
    disposeInstances: () => Instance.disposeAll(),
    runtimeInactivityTimeoutMilliseconds: 30000,
  })
  await settled.releaseHandoff()
  await server?.stop(true)
  save(`${action}-settled`, { physicalSettlement: "complete", requests })
} else {
  await Scheduler.disposeGlobal()
  await Instance.disposeAll()
  await Database.awaitEffectIdle(60000)
}
Database.close()
await Log.close()
