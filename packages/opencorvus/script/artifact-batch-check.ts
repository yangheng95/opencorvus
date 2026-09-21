import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { bootstrapIsolatedTestRuntime } from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

// Seed completed Task input facts, then exercise a real Mission wake, streamed
// HTTP Provider, tool execution and durable results. No task-generation/model
// quality claim is made by this controlled Provider qualification.
const runtime = await bootstrapIsolatedTestRuntime("runner")
const project = path.join(runtime.processRoot, "project")
await fs.mkdir(project)
for (const args of [
  ["init"],
  ["config", "user.name", "Artifact Checker"],
  ["config", "user.email", "checker@example.invalid"],
  ["commit", "--allow-empty", "-m", "checker input root"],
]) {
  const git = Bun.spawnSync(["git", "-C", project, ...args], { stdout: "pipe", stderr: "pipe" })
  assert.equal(git.exitCode, 0, git.stderr.toString())
}
const supervisor = prepareTestProcessSupervisor()
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
process.env.OPENCORVUS_DISABLE_EXTERNAL_SKILLS = "1"
process.env.OPENCORVUS_DISABLE_AUTOUPDATE = "1"
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
process.env.OPENCORVUS_TEST_HOME = path.join(runtime.processRoot, "home")
await fs.mkdir(process.env.OPENCORVUS_TEST_HOME, { recursive: true })
const models = path.join(runtime.processRoot, "models.json")
await fs.copyFile(path.resolve(import.meta.dir, "../src/provider/models-bootstrap.json"), models)
process.env.OPENCORVUS_MODELS_PATH = models
let taskID = ""
let phase = 0
const providerRequests: unknown[] = []
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const body = (await request.json()) as any
    assert.equal(body.stream, true)
    const names = (body.tools ?? []).map((item: any) => item.function?.name)
    const memory = body.messages?.some(
      (item: any) =>
        item.role === "system" &&
        typeof item.content === "string" &&
        item.content.includes("dedicated Memory Organizer"),
    )
    let content = "ARTIFACT_BATCH_OK"
    let call: { name: string; args: unknown } | undefined
    if (memory) {
      const prompt = body.messages.find((item: any) => item.role === "user")?.content
      const coveredOccurrenceIDs =
        typeof prompt === "string"
          ? JSON.parse(prompt.match(/coveredOccurrenceIDs must be exactly (\[[^\n]+\])/u)?.[1] ?? "[]")
          : []
      content = JSON.stringify({ baseRevision: 0, coveredOccurrenceIDs, disposition: "organized", markdown: "" })
    } else if (names.includes("panel_query_task")) {
      providerRequests.push({ phase, names, messages: body.messages })
      await fs.writeFile(
        path.join(runtime.processRoot, "provider-requests.json"),
        JSON.stringify(providerRequests, null, 2),
      )
      if (phase === 0) call = { name: "panel_query_task", args: { taskIDs: [taskID] } }
      if (phase === 1)
        call = {
          name: "panel_query_task_artifacts",
          args: { queries: [0, 1].map((index) => ({ taskID, page_number: 1, labels: [`Batch evidence ${index}`] })) },
        }
      if (phase === 2) {
        const last = body.messages.filter((item: any) => item.role === "tool").at(-1)?.content
        let result = typeof last === "string" ? JSON.parse(last) : last
        if (result?.output) result = JSON.parse(result.output)
        const entries = result.results.flatMap((item: any) => item.value.entries)
        assert.equal(entries.length, 2)
        call = {
          name: "panel_read_task_artifact",
          args: {
            reads: entries.map((entry: any) => ({
              taskID,
              artifact_transport_version: 2,
              artifact_locator_ref: entry.artifact_locator_ref,
            })),
          },
        }
      }
      if (call && !names.includes(call.name))
        return Response.json({ error: { message: `Checker requires callable ${call.name}` } }, { status: 400 })
      phase++
    }
    const id = `artifact-batch-${phase}`
    const delta = call
      ? {
          role: "assistant",
          tool_calls: [
            { index: 0, id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } },
          ],
        }
      : { role: "assistant", content }
    const chunks = [
      { choices: [{ index: 0, delta, finish_reason: null }] },
      {
        choices: [{ index: 0, delta: {}, finish_reason: call ? "tool_calls" : "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      },
    ]
    return new Response(
      new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 1, model: "batch-model", ...chunk })}\n\n`,
              ),
            )
            await Bun.sleep(20)
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
          controller.close()
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    )
  },
})
const model = "batch-check/batch-model"
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
  model,
  small_model: model,
  enabled_providers: ["batch-check"],
  provider: {
    "batch-check": {
      name: "Local batch checker",
      npm: "@ai-sdk/openai-compatible",
      options: { baseURL: `${provider.url.origin}/v1`, apiKey: "local-checker" },
      models: { "batch-model": { name: "Batch checker", tool_call: true, limit: { context: 200000, output: 4096 } } },
    },
  },
})

console.log(`Evidence: ${runtime.processRoot}`)
const { ModelsDev } = await import("../src/provider/models")
await fs.writeFile(
  models,
  JSON.stringify(ModelsDev.validateExplicitCatalog(ModelsDev.withLocalProviders(await Bun.file(models).json()))),
)
const { Log } = await import("../src/util/log")
await Log.init({ print: false, dev: false, level: "WARN" })
try {
  const { bootstrap } = await import("../src/cli/bootstrap")
  const { Instance } = await import("../src/project/instance")
  const { Session } = await import("../src/session")
  const { Identifier } = await import("../src/id/id")
  const { ensureMissionSession } = await import("../src/mission/session")
  const { openMissionExecutionWithWake, missionOperatorWakeReason } = await import("../src/mission/execution-closure")
  const { SessionWake } = await import("../src/session/wake")
  const { persistEstablishedTask } = await import("../test/fixture/engine-task")
  const { prepareTaskProcessBinding } = await import("../src/engine/task-execution-capsule-binding")
  const { recordEngineArtifact } = await import("../src/engine/artifact")
  const { requireTask } = await import("../src/engine/store")
  const { terminalTask } = await import("../src/engine/state")
  await bootstrap(project, async () => {
    const mission = await ensureMissionSession({
      missionID: "artifact-batch-check",
      defaultCwd: project,
      productPillar: "work",
      heldExpertSquadIDs: ["base"],
    })
    const root = Session.prepareRootNext({ kind: "root", directory: project, title: "Completed batch inputs" })
    taskID = Identifier.ascending("task")
    const now = Date.now()
    const packageRevision = {
      scope: "built_in" as const,
      projectID: null,
      namespace: "builtin",
      id: "base",
      version: "2026.08.09.1",
      packageDigest: "a".repeat(64),
    }
    persistEstablishedTask({
      taskID,
      rootSession: root,
      now,
      title: "Batch inputs",
      request: "Inspect two seeded reports",
      productPillar: "work",
      source: "mission",
      metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
      projectID: Instance.project.id,
      packageRevision,
      executionCapsuleBinding: await prepareTaskProcessBinding({
        mode: "native",
        taskID,
        projectID: Instance.project.id,
        rootDirectory: project,
        packageRevisionSHA256: packageRevision.packageDigest,
        timeCreated: now,
      }),
    })
    for (let index = 0; index < 2; index++)
      recordEngineArtifact({
        taskID,
        kind: "expert_output",
        label: `Batch evidence ${index}`,
        payload: { report: index, conclusion: "accepted" },
      })
    await terminalTask(
      requireTask(taskID),
      { status: "completed", time_started: now, time_completed: Date.now() },
      "Checker completed input dataset",
    )
    const text = `Inspect the two Batch evidence Artifacts of Task ${taskID} using batched queries and reads, then report ARTIFACT_BATCH_OK.`
    const receipt = await openMissionExecutionWithWake({
      missionID: mission.missionID,
      sessionID: mission.id,
      source: "mission.wake",
      requestID: "artifact-batch-check-request",
      acceptedInput: {
        text,
        model,
        attachments: [],
        configPatch: { model },
        context: { surface: "artifact-batch-check" },
      },
      wake: (admission) =>
        SessionWake.wakeWithReceipt({
          sessionID: mission.id,
          messageID: admission.messageID,
          textPartID: admission.textPartID,
          controlID: admission.controlID,
          prompt: text,
          author: "user",
          agent: "mission",
          surface: "panel",
          userAuthored: true,
          reason: missionOperatorWakeReason(admission, mission.missionID),
          commitBundle: admission.commitBundle,
          preflightBundle: admission.preflightBundle,
          ownerPreflight: admission.ownerPreflight,
          ownerLifecycle: admission.ownerLifecycle,
          signal: AbortSignal.timeout(90000),
        }),
    })
    const completion = await receipt.completion
    const transcript = await Session.messages({ sessionID: mission.id })
    await fs.writeFile(path.join(runtime.processRoot, "transcript.json"), JSON.stringify(transcript, null, 2))
    assert.deepEqual(completion, { ok: true })
    const parts = transcript.flatMap((message) => message.parts)
    const queries = parts.filter((part) => part.type === "tool" && part.tool === "panel_query_task_artifacts")
    const reads = parts.filter((part) => part.type === "tool" && part.tool === "panel_read_task_artifact")
    assert.equal(queries.length, 1)
    assert.equal(reads.length, 1)
    for (const part of [...queries, ...reads]) {
      assert.equal(part.type, "tool")
      if (part.type !== "tool" || part.state.status !== "completed") throw new Error("Batch tool did not complete")
      assert.equal(JSON.parse(part.state.output).results.length, 2)
    }
    assert.ok(parts.some((part) => part.type === "text" && part.text.includes("ARTIFACT_BATCH_OK")))
    console.log(
      "PASS: real Mission streaming Provider -> one two-query call -> one two-Artifact read -> persisted final reply",
    )
  })
} finally {
  await provider.stop(true)
  await Log.close()
}
