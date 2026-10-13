/** Formal backend + two isolated projects; local streamed Provider, no credentials. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { Database as SQLite } from "bun:sqlite"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"
import { readGoalCrashSnapshot } from "./continuous-goal-crash-check"

type Row = Record<string, any>
const reportPath = process.env.COMPACTION_TASK_CRASH_RESULT
assert(reportPath && path.isAbsolute(reportPath), "COMPACTION_TASK_CRASH_RESULT must be an absolute new report path")
assert.equal(
  await fs.stat(reportPath).then(
    () => true,
    () => false,
  ),
  false,
  "Keep earlier crash evidence",
)
const runtime = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(runtime)
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
const supervisor = prepareTestProcessSupervisor()
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
const databasePath = path.join(runtime.runtimeRoot, "data", "opencorvus.db")
const evidenceRoot = reportPath + ".evidence"
await fs.mkdir(evidenceRoot, { recursive: true })
const target = { providerID: "opencorvus-compaction-crash", modelID: "checkpoint" }
const cases = ["alpha", "beta"].map((name) => ({
  name,
  project: path.join(runtime.processRoot, "project-" + name),
  trace: `TRACE-NATIVE-${name}-17031`,
  taskID: "",
  sessionID: "",
  rootSessionID: "",
  cutMessageID: "",
  steps: 0,
  summaries: 0,
  recoveredRequests: 0,
  held: false,
  summaryRequest: undefined as Promise<unknown> | undefined,
}))
const requests: Row[] = []
const errors: string[] = []
const children: ReturnType<typeof launch>[] = []
let generation = "before"
let backend: ReturnType<typeof launch>
let result: Row = {
  status: "running",
  scope: "formal backend interruption and two-project Task recovery with scripted streaming transport",
  remoteModelRequests: 0,
  runtime: runtime.runtimeRoot,
  databasePath,
  cases,
  requests,
  errors,
}
const save = async (name: string, value: unknown) =>
  fs.writeFile(path.join(evidenceRoot, name), JSON.stringify(value, null, 2))
const report = async () =>
  fs.writeFile(
    reportPath,
    JSON.stringify(result, (key, value) => (key === "summaryRequest" ? undefined : value), 2),
  )

function read<T>(run: (db: SQLite) => T): T {
  const db = new SQLite(databasePath, { readonly: true })
  try {
    return run(db)
  } finally {
    db.close()
  }
}
function owner(sessionID: string) {
  return read((db) =>
    db
      .query<Row, [string]>(
        `WITH RECURSIVE ancestry(id,parent_id) AS (
    SELECT id,parent_id FROM session WHERE id=? UNION ALL SELECT s.id,s.parent_id FROM session s JOIN ancestry a ON s.id=a.parent_id
  ) SELECT t.id taskID,t.session_id rootSessionID,p.worktree directory FROM ancestry a
    JOIN engine_task t ON t.session_id=a.id JOIN project p ON p.id=t.project_id`,
      )
      .get(sessionID),
  )!
}
function facts(item: (typeof cases)[number]) {
  return readGoalCrashSnapshot(databasePath, { kind: "task", id: item.taskID, sessionID: item.rootSessionID })
}
function controls(sessionID: string) {
  return read((db) => ({
    records: db.query<Row, [string]>("SELECT * FROM session_control_record WHERE session_id=?").all(sessionID),
    events: db
      .query<
        Row,
        [string]
      >("SELECT e.* FROM session_control_event e JOIN session_control_record c ON c.id=e.control_id WHERE c.session_id=? ORDER BY e.time_created,e.id")
      .all(sessionID),
  }))
}
async function json(child: ReturnType<typeof launch>, directory: string, route: string, body?: unknown) {
  const url = new URL(route, child.url)
  url.searchParams.set("directory", directory)
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(180_000),
  })
  assert(response.ok, `${route}: ${response.status} ${response.ok ? "" : await response.text()}`)
  return response.json()
}
async function waitFor<T>(
  label: string,
  child: ReturnType<typeof launch>,
  inspect: () => { value?: T; activity: unknown },
) {
  let lastActivity = Date.now()
  let previous = ""
  for (;;) {
    if (child.child.exitCode !== null || child.child.signalCode != null)
      throw new Error(`${label}: owned backend exited`)
    if (errors.length) throw new Error(errors.join("\n"))
    const sample = inspect()
    const signature = JSON.stringify(sample.activity)
    if (signature !== previous) {
      lastActivity = Date.now()
      previous = signature
    }
    if (sample.value !== undefined) return sample.value
    if (Date.now() - lastActivity > 180_000) throw new Error(`${label}: 180 seconds without durable progress`)
    await Bun.sleep(100)
  }
}
function launch(phase: string) {
  const receipt = path.join(evidenceRoot, phase + "-startup.json")
  const child = Bun.spawn(
    [
      process.execPath,
      path.resolve(import.meta.dir, "../src/index.ts"),
      "serve",
      "--hostname",
      "127.0.0.1",
      "--port",
      "0",
      "--project-dir",
      cases[0]!.project,
      "--startup-receipt",
      receipt,
      "--startup-occurrence",
      crypto.randomUUID(),
    ],
    { cwd: path.resolve(import.meta.dir, ".."), env: { ...process.env }, stdout: "pipe", stderr: "pipe" },
  )
  const state = {
    phase,
    receipt,
    child,
    stdout: Promise.resolve(""),
    stderr: Promise.resolve(""),
    lastStartupActivity: Date.now(),
    url: "",
  }
  const drain = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder()
    let text = ""
    for await (const chunk of stream) {
      text += decoder.decode(chunk, { stream: true })
      state.lastStartupActivity = Date.now()
    }
    return text + decoder.decode()
  }
  state.stdout = drain(child.stdout)
  state.stderr = drain(child.stderr)
  return state
}
async function ready(child: ReturnType<typeof launch>) {
  let receipt: Row | undefined
  while (!receipt) {
    if (child.child.exitCode !== null || child.child.signalCode != null)
      throw new Error("Backend exited during startup")
    receipt = await fs.readFile(child.receipt, "utf8").then(JSON.parse, () => undefined)
    if (Date.now() - child.lastStartupActivity > 180_000) throw new Error("No startup activity for 180 seconds")
    if (!receipt) await Bun.sleep(100)
  }
  assert.equal(receipt.outcome, "listening")
  assert.equal(receipt.pid, child.child.pid)
  child.url = receipt.url
  console.log(JSON.stringify({ stage: "ready", phase: child.phase, pid: child.child.pid, url: child.url }))
}
function activity(snapshots: ReturnType<typeof facts>[]) {
  return {
    requests: requests.length,
    facts: snapshots.map((s) => ({
      messages: s.messages.map((m) => ({ id: m.id, finish: m.data.finish, error: m.data.error, time: m.data.time })),
      parts: s.parts.map((p) => ({ id: p.id, type: p.data.type, textLength: p.data.text?.length })),
      outcomes: s.outcomes.map((o) => ({ id: o.id, data: o.data })),
      ingresses: s.ingresses,
      events: s.taskEvents.map((e) => e.id),
    })),
  }
}

const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 0,
  async fetch(request) {
    try {
      const body = (await request.json()) as Row
      assert.equal(body.stream, true)
      assert.equal(body.model, target.modelID)
      assert(requests.length < 24, "Finite local request ceiling")
      const sessionID = request.headers.get("x-opencorvus-session")!
      const owned = owner(sessionID)
      assert(owned, "Provider request must belong to a created Task")
      const item = cases.find((c) => path.resolve(c.project) === path.resolve(owned.directory))
      assert(item, "Provider request must belong to an isolated checker project")
      Object.assign(item, { taskID: owned.taskID, rootSessionID: owned.rootSessionID, sessionID })
      const names = (body.tools ?? []).map((tool: Row) => tool.function.name)
      const compaction = names.includes("ReadCompactionEvidence")
      requests.push({ generation, project: item.name, sessionID, compaction, textOnlyHelper: names.length === 0, body })
      console.log(
        JSON.stringify({ stage: "provider", generation, project: item.name, compaction, count: requests.length }),
      )
      const chunk = (delta: unknown, finish: string | null) =>
        `data: ${JSON.stringify({
          id: `native-${requests.length}`,
          object: "chat.completion.chunk",
          created: 1,
          model: target.modelID,
          choices: [{ index: 0, delta, finish_reason: finish }],
          ...(finish ? { usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } } : {}),
        })}\n\n`
      const text = (value: string) =>
        new Response(chunk({ role: "assistant", content: value }, null) + chunk({}, "stop") + "data: [DONE]\n\n", {
          headers: { "content-type": "text/event-stream" },
        })
      if (names.length === 0) return text(`Isolated ${item.name} compaction Task`)
      if (compaction) {
        item.summaries++
        return text(
          `The ${item.name} Task has inspected its own evidence. Keep project identity and continue reading subsequent exact traces.`,
        )
      }
      const snapshot = facts(item)
      const assistant = snapshot.messages
        .filter((m) => m.session_id === sessionID && m.data.role === "assistant" && m.data.author === "orchestrator")
        .at(-1)!
      assert(assistant, "Actual scheduler assistant is required")
      let toolName = "read"
      let input: unknown = { filePath: path.join(item.project, "evidence.txt") }
      let callID: string
      if (generation === "before") {
        item.steps++
        item.cutMessageID ||= assistant.id
        assert.equal(assistant.id, item.cutMessageID)
        callID = item.steps === 3 ? `late_${item.name}` : `${item.name}_${item.steps}`
        if (item.steps === 2) {
          item.summaryRequest = json(backend, item.project, `/session/${sessionID}/summarize`, {
            ...target,
            auto: true,
          })
          void item.summaryRequest.catch((error) => {
            errors.push(String(error))
          })
          await waitFor("queued automatic summary", backend, () => {
            const value = controls(sessionID)
            return { activity: value, value: value.records.length ? true : undefined }
          })
        }
        if (item.steps === 4) {
          const toolResult = body.messages.find((m: Row) => m.role === "tool" && m.tool_call_id === `late_${item.name}`)
          assert(toolResult?.content.includes(item.trace), "The exact late trace must reach the next real request")
          item.held = true
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode(
                    chunk({ role: "assistant", content: `Persisted crash boundary ${item.trace}.` }, null),
                  ),
                )
              },
            }),
            { headers: { "content-type": "text/event-stream" } },
          )
        }
        assert(item.steps < 4, "Only four original scheduler steps")
      } else {
        item.recoveredRequests++
        const toolResult = body.messages.find((m: Row) => m.role === "tool" && m.tool_call_id === `late_${item.name}`)
        assert(
          toolResult?.content.includes(item.trace),
          "Recovered Provider request must contain the original exact Tool trace",
        )
        const interrupted = snapshot.messages.find((m) => m.id === item.cutMessageID)!
        assert.equal(interrupted.data.error?.name, "ProcessExecutionInterruptedError")
        assert.equal(typeof interrupted.data.time.completed, "number")
        assert(assistant.id !== item.cutMessageID, "Recovery owns a new physical assistant occurrence")
        const opened = snapshot.events.find((e) => e.type === "task.execution.opened")!
        assert(opened, "Original Task lifecycle required")
        toolName = "no_action"
        input = {
          observed_task: { epoch: 1, status: "active", openedEventID: opened.id, terminalEventID: null },
          reason: "Recovered exact evidence after the isolated checkpoint interruption.",
        }
        callID = `recovered_${item.name}`
      }
      assert(names.includes(toolName), "Use an actually granted Tool")
      return new Response(
        (generation === "before" && item.steps === 1
          ? chunk({ role: "assistant", content: `Earlier ${item.name} evidence. `.repeat(1000) }, null)
          : "") +
          chunk(
            {
              tool_calls: [
                {
                  index: 0,
                  id: callID,
                  type: "function",
                  function: { name: toolName, arguments: JSON.stringify(input) },
                },
              ],
            },
            null,
          ) +
          chunk({}, "tool_calls") +
          "data: [DONE]\n\n",
        { headers: { "content-type": "text/event-stream" } },
      )
    } catch (error) {
      errors.push(String(error))
      return new Response(String(error), { status: 500 })
    }
  },
})

try {
  process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
    model: `${target.providerID}/${target.modelID}`,
    small_model: `${target.providerID}/${target.modelID}`,
    enabled_providers: [target.providerID],
    permission_mode: "full_access",
    compaction: { tail_turns: 0 },
    provider: {
      [target.providerID]: {
        name: "Isolated native crash transport",
        npm: "@ai-sdk/openai-compatible",
        api: `http://127.0.0.1:${provider.port}/v1`,
        models: {
          [target.modelID]: {
            name: "Checkpoint",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 16_000 },
          },
        },
      },
    },
  })
  for (const item of cases) {
    await fs.mkdir(item.project)
    await fs.writeFile(path.join(item.project, "evidence.txt"), `${item.trace} next_offset=17031\n`)
    for (const args of [
      ["init"],
      ["config", "user.name", "Compaction Native Check"],
      ["config", "user.email", "native@example.invalid"],
      ["add", "evidence.txt"],
      ["commit", "-m", "Isolated project evidence"],
    ])
      execFileSync("git", args, { cwd: item.project, stdio: "ignore", windowsHide: true })
  }
  backend = launch("before")
  children.push(backend)
  await ready(backend)
  for (const item of cases) {
    const created = (await json(backend, item.project, "/task", {
      requestID: crypto.randomUUID(),
      productPillar: "work",
      title: `Compaction crash ${item.name}`,
      request: "Read the project evidence and preserve its exact trace through compaction.",
      promptProfile: "base",
      model: `${target.providerID}/${target.modelID}`,
    })) as Row
    item.taskID = created.task_id
    item.rootSessionID = read(
      (db) => db.query<Row, [string]>("SELECT session_id FROM engine_task WHERE id=?").get(item.taskID)!.session_id,
    )
  }
  const before = await waitFor("both durable crash boundaries", backend, () => {
    const snapshots = cases.map(facts)
    const complete = cases.every(
      (item, index) =>
        item.held &&
        snapshots[index]!.parts.some(
          (part) =>
            part.message_id === item.cutMessageID && part.data.text === `Persisted crash boundary ${item.trace}.`,
        ),
    )
    return { activity: activity(snapshots), value: complete ? snapshots : undefined }
  })
  assert.deepEqual(await Promise.all(cases.map((item) => item.summaryRequest)), [true, true])
  console.log(JSON.stringify({ stage: "summary_waiters_settled", tasks: cases.map((item) => item.taskID) }))
  before.forEach((snapshot, index) => {
    const item = cases[index]!
    assert.equal(snapshot.messages.find((m) => m.id === item.cutMessageID)!.data.time.completed, undefined)
    const marker = snapshot.parts.find((p) => p.data.type === "compaction")!
    assert(marker.data.covered_parts.some((entry: Row) => entry.messageID === item.cutMessageID))
  })
  await save("before-facts.json", before)
  backend.child.kill("SIGKILL")
  await backend.child.exited
  await save("crashed-facts.json", cases.map(facts))
  console.log(JSON.stringify({ stage: "crashed", pid: backend.child.pid, tasks: cases.map((item) => item.taskID) }))
  generation = "recover"
  backend = launch("recover")
  children.push(backend)
  await ready(backend)
  for (const item of cases) await json(backend, item.project, "/session")
  const after = await waitFor("both recovered ingress receipts", backend, () => {
    const snapshots = cases.map(facts)
    const complete = cases.every((item, index) => {
      const snap = snapshots[index]!
      const tool = snap.tools.find((tool) => tool.data.callID === `recovered_${item.name}`)
      return (
        item.recoveredRequests > 0 &&
        tool &&
        snap.outcomes.some((outcome) => outcome.request_part_id === tool.id && outcome.data.outcome === "completed") &&
        snap.messages.find((message) => message.id === tool.message_id)?.data.time.completed !== undefined
      )
    })
    return { activity: activity(snapshots), value: complete ? snapshots : undefined }
  })
  for (let index = 0; index < cases.length; index++) {
    const old = before[index]!,
      current = after[index]!
    assert.equal(current.session.id, old.session.id)
    for (const part of old.parts) assert.deepEqual(current.parts.find((item) => item.id === part.id)?.data, part.data)
    for (const tool of old.tools) assert.deepEqual(current.tools.find((item) => item.id === tool.id)?.data, tool.data)
    for (const outcome of old.outcomes)
      assert.deepEqual(current.outcomes.find((item) => item.id === outcome.id)?.data, outcome.data)
  }
  await save("after-facts.json", after)
  result.status = "passed"
  console.log(JSON.stringify({ stage: "passed", projects: cases.length, requests: requests.length }))
} catch (error) {
  result.status = "failed"
  result.error = error instanceof Error ? error.stack : String(error)
  console.error(String(error))
  process.exitCode = 1
  for (const item of cases)
    if (item.taskID && item.rootSessionID) await save(`${item.name}-failed-facts.json`, facts(item))
} finally {
  result.settlement = []
  for (const child of children) {
    if (child.child.exitCode === null && child.child.signalCode == null) child.child.kill("SIGTERM")
    const settled = await Promise.race([child.child.exited.then(() => true), Bun.sleep(30_000).then(() => false)])
    if (!settled) {
      child.child.kill("SIGKILL")
      await child.child.exited
    }
    await fs.writeFile(path.join(evidenceRoot, child.phase + "-stdout.log"), await child.stdout)
    await fs.writeFile(path.join(evidenceRoot, child.phase + "-stderr.log"), await child.stderr)
    result.settlement.push({
      pid: child.child.pid,
      exitCode: child.child.exitCode,
      signalCode: child.child.signalCode,
      forcedCleanup: !settled,
    })
  }
  await Promise.allSettled(cases.flatMap((item) => (item.summaryRequest ? [item.summaryRequest] : [])))
  await provider.stop(true)
  await report()
}
