import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
const [stage = "outer", expectation = "fixed"] = process.argv.slice(2)
const destination =
  process.env.CHANNEL_AUDIT_OUTPUT_DIRECTORY ??
  path.resolve(
    `.tmp-product-iteration/durable-effect-receipt-audit/channel/v7/stale-instance-${expectation}-${Date.now()}`,
  )
fs.mkdirSync(destination, { recursive: true })
const metaPath = path.join(destination, "ready.json")
const gatePath = path.join(destination, "continue")
const input = {
  platform: "slack" as const,
  channel: "stale-instance",
  thread: "stale-instance",
  text: "status",
  request_id: "old-source",
  allow_create: false,
}
async function waitFor(file: string) {
  const deadline = Date.now() + 60_000
  while (!fs.existsSync(file)) {
    assert(Date.now() < deadline, `isolated barrier ${path.basename(file)} settled`)
    await Bun.sleep(20)
  }
}
if (stage === "outer") {
  assert(!fs.existsSync(metaPath), "a new isolated evidence directory preserves the original lifecycle barriers")
  const { bootstrapIsolatedTestRuntime } = await import("../../../packages/util/src/test-runtime-environment")
  const runtime = await bootstrapIsolatedTestRuntime("test")
  for (const key of Object.keys(process.env))
    if (/(?:API_KEY|ACCESS_TOKEN|BEARER_TOKEN|SECRET_ACCESS_KEY)$/.test(key)) delete process.env[key]
  const { memoryProject } = await import("../../../packages/opencorvus/test/fixture/memory")
  const fixture = await memoryProject("channel-stale-instance-formal-delete")
  const env = {
    ...process.env,
    CHANNEL_AUDIT_OUTPUT_DIRECTORY: destination,
    CHANNEL_AUDIT_PROJECT_DIRECTORY: fixture.path,
  }
  async function child(mode: string) {
    const running = Bun.spawn(
      [
        Bun.which("bun")!,
        `--tsconfig-override=${path.resolve("packages/opencorvus/tsconfig.json")}`,
        import.meta.path,
        mode,
        expectation,
      ],
      { env, stdout: "pipe", stderr: "pipe" },
    )
    const [code, stdout, stderr] = await Promise.all([
      running.exited,
      new Response(running.stdout).text(),
      new Response(running.stderr).text(),
    ])
    fs.writeFileSync(path.join(destination, `${mode}.log`), stdout + stderr)
    return code
  }
  const old = child("old")
  await waitFor(metaPath)
  assert.equal(await child("recreate"), 0)
  fs.writeFileSync(gatePath, "formal delete and recreation committed")
  assert.equal(await old, 0)
  const stale = JSON.parse(fs.readFileSync(path.join(destination, "old-result.json"), "utf8"))
  const current = JSON.parse(fs.readFileSync(path.join(destination, "recreated.json"), "utf8"))
  assert.equal(current.deletion.status, "committed")
  assert.equal(current.projectID, stale.projectID)
  assert.equal(new Set([current.generation, stale.generation]).size, 2)
  if (expectation === "red") {
    assert.equal(stale.currentSource.status, "success")
    assert.equal(stale.freshSource.status, "success")
    assert.equal(stale.freshSource.generation, current.generation)
  } else {
    assert.equal(stale.currentSource.error.name, "ChannelIngressOwnerConflictError")
    assert.equal(stale.freshSource.error.data.code, "CHANNEL_INGRESS_PROJECT_CONTEXT_CONFLICT")
    assert.deepEqual(stale.sources.map((row: any) => row.request_id).sort(), ["current-source", "old-source"])
    assert.equal(current.result.kind, "panel_response")
    if (expectation === "event-red") assert.equal(stale.event.status, "success")
    if (expectation === "event-fixed") {
      assert.equal(stale.event.status, "error")
      assert.equal(stale.event.error.name, "SchedulerProjectOwnerError")
      assert.equal(stale.event.error.data.disposition, "target_deleted")
      assert.equal(stale.eventRemove.error.name, "SchedulerProjectOwnerError")
      assert.equal(stale.eventRemove.error.data.disposition, "target_deleted")
      assert.deepEqual(
        stale.eventDefinitions.map((row: any) => row.id),
        [current.event.id],
      )
    }
  }
  const report = {
    expectation,
    actualLifecycle: "formal Project.delete + Project.fromDirectory",
    runtime,
    current,
    stale,
  }
  fs.writeFileSync(path.join(destination, "result.json"), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
  process.exit(0)
}
const { Instance } = await import("@/project/instance")
const { Database } = await import("@/storage/db")
const { ChannelIngress } = await import("@/channel/ingress")
const directory = process.env.CHANNEL_AUDIT_PROJECT_DIRECTORY!
if (stage === "old") {
  await Instance.provide({
    directory,
    fn: async () => {
      const projectID = Instance.project.id,
        generation = Instance.projectGeneration
      await ChannelIngress.message(input)
      fs.writeFileSync(metaPath, JSON.stringify({ projectID, generation, directory, databasePath: Database.Path() }))
      await waitFor(gatePath)
      async function call(requestID: string) {
        try {
          const result = await ChannelIngress.message({ ...input, request_id: requestID })
          return {
            status: "success",
            result,
            generation: Database.allFinalized<any>(
              "SELECT request_id,project_generation FROM channel_ingress_accepted",
            ).find((row) => row.request_id === requestID)?.project_generation,
          }
        } catch (error: any) {
          return { status: "error", error: { name: error.name, message: String(error), data: error.toObject?.().data } }
        }
      }
      const currentSource = await call("current-source"),
        freshSource = await call("fresh-stale-source")
      let event: unknown, eventRemove: unknown
      if (expectation === "event-red" || expectation === "event-fixed") {
        const { EventService } = await import("@/scheduler/event-service")
        try {
          event = {
            status: "success",
            result: await EventService.create({
              projectId: Instance.project.id,
              name: "Stale original context Event",
              eventType: "test.channel.stale-event",
              prompt: "Local registration only",
            }),
            rows: Database.allFinalized("SELECT * FROM event_job"),
          }
        } catch (error: any) {
          event = {
            status: "error",
            error: { name: error.name, message: String(error), data: error.toObject?.().data ?? error.data },
          }
        }
        if (expectation === "event-fixed") {
          const recreated = JSON.parse(fs.readFileSync(path.join(destination, "recreated.json"), "utf8"))
          try {
            eventRemove = { status: "success", result: EventService.remove(recreated.event.id, Instance.project.id) }
          } catch (error: any) {
            eventRemove = {
              status: "error",
              error: { name: error.name, message: String(error), data: error.toObject?.().data ?? error.data },
            }
          }
        }
      }
      const sources = Database.allFinalized(
        "SELECT request_id,project_generation FROM channel_ingress_accepted ORDER BY request_id",
      )
      fs.writeFileSync(
        path.join(destination, "old-result.json"),
        JSON.stringify(
          {
            projectID,
            generation,
            currentSource,
            freshSource,
            sources,
            event,
            eventRemove,
            eventDefinitions:
              expectation === "event-fixed" ? Database.allFinalized("SELECT * FROM event_job") : undefined,
          },
          null,
          2,
        ),
      )
    },
  })
} else {
  const { Project } = await import("@/project/project")
  const { deleteProject } = await import("@/project/delete")
  const old = JSON.parse(fs.readFileSync(metaPath, "utf8"))
  const deletion = await deleteProject(Project.get(old.projectID)!, {
    actor: "user",
    source: "project.delete",
    surface: "api",
    requestID: "channel-stale-formal-delete",
    reason: "Isolated cross-process generation recovery proof",
  })
  assert.equal(deletion.status, "committed")
  const recreated = await Project.fromDirectory(directory)
  const result = await Instance.provide({
    directory,
    fn: () => ChannelIngress.message({ ...input, request_id: "current-source" }),
  })
  const event =
    expectation === "event-fixed"
      ? await Instance.provide({
          directory,
          fn: async () => {
            const { EventService } = await import("@/scheduler/event-service")
            return EventService.create({
              projectId: Instance.project.id,
              name: "Actual current Event",
              eventType: "test.channel.stale-event",
              prompt: "Current occurrence registration",
            })
          },
        })
      : undefined
  fs.writeFileSync(
    path.join(destination, "recreated.json"),
    JSON.stringify(
      { deletion, projectID: recreated.project.id, generation: recreated.generation, result, event },
      null,
      2,
    ),
  )
}
await Instance.disposeAll()
await Database.awaitEffectIdle(60_000)
Database.close()
process.exit(0)
