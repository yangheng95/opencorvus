/** Formal backend + two isolated projects; local streamed Provider, no credentials.
 * COMPACTION_RUNTIME_CRASH_RESULT is an absolute new report path.
 * OWNER is task or mission; CUT is after-checkpoint or during-compaction.
 */
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
import { CompactionPolicyCase } from "./compaction-policy-case"

type Row = Record<string, any>
const ownerKind = (() => {
  const value = process.env.COMPACTION_RUNTIME_CRASH_OWNER ?? "task"
  assert(value === "task" || value === "mission", "Explicit Task or Mission owner")
  return value
})()
const cut = process.env.COMPACTION_RUNTIME_CRASH_CUT ?? "after-checkpoint"
assert(cut === "after-checkpoint" || cut === "during-compaction", "Explicit supported checkpoint cut")
const reportPath = process.env.COMPACTION_RUNTIME_CRASH_RESULT
assert(reportPath && path.isAbsolute(reportPath), "COMPACTION_RUNTIME_CRASH_RESULT must be an absolute new report path")
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
const localRequestLimit = 40
const cases = ["alpha", "beta"].map((name) => {
  const correctionQuote = `Current user correction for ${name}: only read this project's evidence. region=REGION-${name}; permission=read-only. A release is not authorized.`
  return {
    name,
    stage: "initial" as "initial" | "correction" | "exercise",
    correctionQuote,
    correctionText: `历史说明😀：项目 ${name} 的旧范围已过期。\n${correctionQuote}\nContinue only under the correction above.`,
    acceptedInputs: [] as Row[],
    sourceSelections: [] as Row[],
    project: path.join(runtime.processRoot, "project-" + name),
    trace: `TRACE-NATIVE-${name}-17031`,
    ownerID: "",
    sessionID: "",
    rootSessionID: "",
    cutMessageID: "",
    producerMessageIDs: [] as string[],
    evidencePartID: "",
    steps: 0,
    summaries: 0,
    recoveredRequests: 0,
    held: false,
    summaryRequest: undefined as Promise<unknown> | undefined,
    summarySettlement: undefined as unknown,
  }
})
const requests: Row[] = []
const errors: string[] = []
const children: ReturnType<typeof launch>[] = []
let generation = "before"
let cutStarted = false
let backend: ReturnType<typeof launch>
let result: Row = {
  status: "running",
  scope: "formal backend interruption and two-project Task/Mission recovery with scripted streaming transport",
  ownerKind,
  cut,
  remoteModelRequests: 0,
  localRequestLimit,
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
  ) ${
    ownerKind === "task"
      ? "SELECT t.id ownerID,t.session_id rootSessionID,p.worktree directory FROM ancestry a JOIN engine_task t ON t.session_id=a.id JOIN project p ON p.id=t.project_id"
      : "SELECT json_extract(s.metadata,'$.mission.id') ownerID,s.id rootSessionID,p.worktree directory FROM ancestry a JOIN session s ON s.id=a.id JOIN project p ON p.id=s.project_id WHERE s.kind='mission'"
  }`,
      )
      .get(sessionID),
  )!
}
function facts(item: (typeof cases)[number]) {
  return readGoalCrashSnapshot(databasePath, {
    kind: ownerKind,
    id: ownerKind === "task" ? item.ownerID : item.rootSessionID,
    sessionID: item.rootSessionID,
  })
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
  const startedAt = Date.now()
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
    startedAt,
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
      assert(requests.length < localRequestLimit, "Finite local request ceiling")
      const sessionID = request.headers.get("x-opencorvus-session")!
      const owned = owner(sessionID)
      assert(owned, "Provider request must belong to a created owner")
      const item = cases.find((c) => path.resolve(c.project) === path.resolve(owned.directory))
      assert(item, "Provider request must belong to an isolated checker project")
      Object.assign(item, { ownerID: owned.ownerID, rootSessionID: owned.rootSessionID, sessionID })
      const names = (body.tools ?? []).map((tool: Row) => tool.function.name)
      const compaction = names.includes("ReadCompactionEvidence")
      requests.push({
        generation,
        stage: item.stage,
        project: item.name,
        sessionID,
        compaction,
        textOnlyHelper: names.length === 0,
        body,
      })
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
          ...(finish
            ? {
                usage: {
                  // Authored local usage exercises the genuine automatic trigger;
                  // it is not a measurement of model tokenizer or billing behavior.
                  prompt_tokens:
                    ownerKind === "mission" &&
                    generation === "before" &&
                    names.length > 0 &&
                    !compaction &&
                    item.steps === 2
                      ? 240_000
                      : 11,
                  completion_tokens: 7,
                  total_tokens:
                    ownerKind === "mission" &&
                    generation === "before" &&
                    names.length > 0 &&
                    !compaction &&
                    item.steps === 2
                      ? 240_007
                      : 18,
                },
              }
            : {}),
        })}\n\n`
      const text = (value: string) =>
        new Response(chunk({ role: "assistant", content: value }, null) + chunk({}, "stop") + "data: [DONE]\n\n", {
          headers: { "content-type": "text/event-stream" },
        })
      const call = (toolName: string, callID: string, input: unknown, prefix = "") => {
        assert(names.includes(toolName), "Use an actually granted Tool")
        return new Response(
          (prefix ? chunk({ role: "assistant", content: prefix }, null) : "") +
            chunk(
              {
                role: "assistant",
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
      }
      const hold = (messageID: string) => {
        item.cutMessageID = messageID
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
      if (names.length === 0) {
        const instruction = body.messages.findLast((message: Row) => message.role === "user")?.content
        if (
          typeof instruction === "string" &&
          instruction.startsWith("Maintain the Project MEMORY.MD from the evidence below.")
        ) {
          const header = instruction.split("\nCURRENT PROJECT MEMORY.MD\n")[0]!
          const revision = header.match(/^baseRevision must be (\d+)\.$/m)
          const occurrences = header.match(/^coveredOccurrenceIDs must be exactly (\[[^\n]+\])\.$/m)
          assert(revision && occurrences, "The scripted Organizer follows its exact declared terminal envelope")
          return text(
            JSON.stringify({
              baseRevision: Number(revision[1]),
              coveredOccurrenceIDs: JSON.parse(occurrences[1]!),
              disposition: "organized",
              markdown: "Compaction recovery fixture. Original participant messages remain authoritative.",
            }),
          )
        }
        return text(`Isolated ${item.name} compaction ${ownerKind}`)
      }
      const snapshot = facts(item)
      if (generation === "before" && ownerKind === "task" && !compaction && item.stage !== "initial") {
        const currentInput = snapshot.messages.findLast(
          (message) =>
            message.data.role === "user" &&
            message.data.author === "user" &&
            message.data.extra?.task_root_message?.source === "compaction-recovery-check",
        )
        assert(currentInput, "The accepted current Task input has an exact participant Message")
        const callID = `input_${item.stage}_${item.name}`
        const read = snapshot.tools.find((tool) => tool.data.callID === callID)
        if (!read)
          return call("read_task_message", callID, {
            message_id: currentInput.id,
            reason: "Read this exact current operator input before the scheduler decision or evidence work.",
          })
        assert(
          snapshot.outcomes.some(
            (outcome) => outcome.request_part_id === read.id && outcome.data.outcome === "completed",
          ),
          "The actual current input reader completes before the scripted decision",
        )
      }
      if (generation === "before" && item.stage !== "exercise") {
        assert.equal(compaction, false, "Setup input completes before the pressure exercise")
        if (ownerKind === "mission")
          return text(`Recorded ${item.name} ${item.stage} setup input. Await next user input.`)
        const opened = snapshot.events.findLast((event) => event.type === "task.execution.opened")!
        assert(opened, "Real Task execution owns setup input")
        return call("no_action", `setup_${item.stage}_${item.name}`, {
          observed_task: { epoch: 1, status: "active", openedEventID: opened.id, terminalEventID: null },
          reason: `Recorded ${item.stage} input; the caller will supply the next bounded user request.`,
        })
      }
      if (compaction) {
        item.summaries++
        const evidence = snapshot.tools.filter((tool) => tool.data.tool === "read").at(-1)!
        assert(evidence, "Compaction follows an actual persisted evidence read")
        const source = snapshot.parts.find(
          (part) =>
            part.data.type === "text" &&
            part.data.text === item.correctionText &&
            snapshot.messages.some(
              (message) =>
                message.id === part.message_id &&
                message.session_id === sessionID &&
                message.data.role === "user" &&
                message.data.author === "user",
            ),
        )
        assert(source, "The owning compactor history contains the exact earlier public user correction")
        const helper = snapshot.messages
          .filter((message) => message.session_id === sessionID && message.data.author === "compaction")
          .at(-1)!
        assert(helper, "Real compactor assistant owns the helper Tools")
        const selected = snapshot.tools.find(
          (tool) =>
            tool.message_id === helper.id &&
            tool.data.tool === "RetainCompactionUserText" &&
            snapshot.outcomes.some(
              (outcome) => outcome.request_part_id === tool.id && outcome.data.outcome === "completed",
            ),
        )
        if (!selected)
          return call("RetainCompactionUserText", `retain_${helper.id}`, {
            excerpts: [{ part_id: source.id, text: item.correctionQuote }],
          })
        const selectedOutcome = snapshot.outcomes.find((outcome) => outcome.request_part_id === selected.id)!
        const receipt = JSON.parse(selectedOutcome.data.output)
        assert.equal(receipt.status, "retained")
        assert.deepEqual(
          receipt.sources.map((value: Row) => ({
            messageID: value.messageID,
            partID: value.partID,
            originalRole: value.originalRole,
            originalAuthor: value.originalAuthor,
            offset: value.offset,
            end: value.end,
          })),
          [
            {
              messageID: source.message_id,
              partID: source.id,
              originalRole: "user",
              originalAuthor: "user",
              offset: item.correctionText.indexOf(item.correctionQuote),
              end: item.correctionText.indexOf(item.correctionQuote) + item.correctionQuote.length,
            },
          ],
        )
        if (!item.sourceSelections.some((value) => value.helperID === helper.id))
          item.sourceSelections.push({
            generation,
            helperID: helper.id,
            source,
            receipt,
            requestPartID: selected.id,
            callID: selected.data.callID,
          })
        const notes = snapshot.tools.find(
          (tool) =>
            tool.message_id === helper.id &&
            tool.data.tool === "SaveCompactionNotes" &&
            snapshot.outcomes.some(
              (outcome) => outcome.request_part_id === tool.id && outcome.data.outcome === "completed",
            ),
        )
        if (!notes)
          return call("SaveCompactionNotes", `notes_${helper.id}`, {
            notes: `Retained the genuine user correction from Part ${source.id}. Preserve original ${item.trace}, next_offset=17031 and read Part ${evidence.id}, call ${evidence.data.callID}.`,
          })
        const retainedFrame = body.messages.find(
          (message: Row) => message.role === "tool" && message.tool_call_id === selected.data.callID,
        )
        assert.deepEqual(
          JSON.parse(retainedFrame.content),
          receipt,
          "Notes retain the genuine original-user selection exchange",
        )
        if (generation === "before" && cut === "during-compaction") {
          item.evidencePartID = evidence.id
          return hold(helper.id)
        }
        return text(
          `The ${item.name} ${ownerKind} has inspected its own evidence: ${item.trace}, next_offset=17031, Part ${evidence.id}, call ${evidence.data.callID}. Keep this project identity and continue the bounded original request.`,
        )
      }
      const assistant = snapshot.messages
        .filter(
          (m) =>
            m.session_id === sessionID &&
            m.data.role === "assistant" &&
            m.data.author === (ownerKind === "task" ? "orchestrator" : "mission"),
        )
        .at(-1)!
      assert(assistant, "Actual scheduler assistant is required")
      let toolName = "read"
      let input: unknown = { filePath: path.join(item.project, "evidence.txt") }
      let callID: string
      if (generation === "before") {
        item.steps++
        item.producerMessageIDs.push(assistant.id)
        if (ownerKind === "task") assert.equal(assistant.id, item.producerMessageIDs[0])
        callID = item.steps === 3 ? `late_${item.name}` : `${item.name}_${item.steps}`
        if (item.steps === 2 && ownerKind === "task") {
          item.summaryRequest = json(backend, item.project, `/session/${sessionID}/summarize`, {
            ...target,
            auto: true,
          })
          void item.summaryRequest.then(
            (value) => {
              item.summarySettlement = { status: "fulfilled", value }
            },
            (error) => {
              item.summarySettlement = { status: "rejected", afterOwnedCut: cutStarted, error: String(error) }
              if (!cutStarted) errors.push(String(error))
            },
          )
          await waitFor("queued automatic summary", backend, () => {
            const value = controls(sessionID)
            return { activity: value, value: value.records.length ? true : undefined }
          })
        }
        if (item.steps === 4) {
          const toolResult = body.messages.find((m: Row) => m.role === "tool" && m.tool_call_id === `late_${item.name}`)
          assert(toolResult?.content.includes(item.trace), "The exact late trace must reach the next real request")
          item.evidencePartID = snapshot.tools.find((tool) => tool.data.callID === `late_${item.name}`)!.id
          return hold(assistant.id)
        }
        assert(item.steps < 4, "Only four original scheduler steps")
      } else {
        item.recoveredRequests++
        const userText = body.messages
          .filter((message: Row) => message.role === "user")
          .flatMap((message: Row) =>
            typeof message.content === "string"
              ? [message.content]
              : message.content.filter((part: Row) => part.type === "text").map((part: Row) => part.text),
          )
        assert(
          userText.includes(item.correctionQuote),
          "Recovered normal request receives the exact selected original user quote",
        )
        if (cut === "after-checkpoint") {
          const toolResult = body.messages.find((m: Row) => m.role === "tool" && m.tool_call_id === `late_${item.name}`)
          assert(toolResult?.content.includes(item.trace), "Recovered request contains the original late Tool trace")
        } else {
          const replay = JSON.stringify(body.messages)
          for (const value of [item.trace, item.evidencePartID, `${item.name}_2`, "17031"])
            assert(replay.includes(value), "Recovered checkpoint carries exact original evidence identity and cursor")
        }
        const interrupted = snapshot.messages.find((m) => m.id === item.cutMessageID)!
        assert.equal(interrupted.data.error?.name, "ProcessExecutionInterruptedError")
        assert.equal(typeof interrupted.data.time.completed, "number")
        assert(assistant.data.time.created >= backend.startedAt, "Recovery creates its assistant in the new backend")
        assert.equal(
          snapshot.promptOwners.find((owner) => owner.session_id === sessionID)?.owner_pid,
          backend.child.pid,
        )
        const opened = snapshot.events.find((e) => e.type === `${ownerKind}.execution.opened`)!
        assert(opened, "Original execution lifecycle required")
        if (ownerKind === "mission" && snapshot.tools.some((tool) => tool.data.callID === `recovered_${item.name}`))
          return text(`Recovered ${item.trace}, next_offset=17031, bounded Mission complete.`)
        toolName = ownerKind === "task" ? "no_action" : "panel_complete_mission"
        input =
          ownerKind === "task"
            ? {
                observed_task: { epoch: 1, status: "active", openedEventID: opened.id, terminalEventID: null },
                reason: "Recovered exact evidence after the isolated checkpoint interruption.",
              }
            : {
                summary: `Recovered ${item.trace}, next_offset=17031; bounded coordination complete.`,
                task_acceptances: [],
              }
        callID = `recovered_${item.name}`
      }
      return call(
        toolName,
        callID,
        input,
        generation === "before" && item.steps === 1 ? `Earlier ${item.name} evidence. `.repeat(1000) : "",
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
      ["config", "user.name", "Compaction Runtime Check"],
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
    const initialText = `This is bounded coordination without child Tasks. Record initial region=OLD-${item.name}, permission=release, then wait for the next user input.`
    const created = (await json(
      backend,
      item.project,
      ownerKind === "task" ? "/task" : "/mission/wake",
      ownerKind === "task"
        ? {
            requestID: crypto.randomUUID(),
            productPillar: "work",
            title: `Compaction crash ${item.name}`,
            request: initialText,
            promptProfile: "base",
            model: `${target.providerID}/${target.modelID}`,
          }
        : {
            requestID: crypto.randomUUID(),
            productPillar: "work",
            text: initialText,
            model: `${target.providerID}/${target.modelID}`,
          },
    )) as Row
    item.acceptedInputs.push({ stage: "initial", text: initialText, response: created })
    item.ownerID = ownerKind === "task" ? created.task_id : created.missionID
    item.rootSessionID =
      ownerKind === "task"
        ? read(
            (db) =>
              db.query<Row, [string]>("SELECT session_id FROM engine_task WHERE id=?").get(item.ownerID)!.session_id,
          )
        : created.sessionID
  }
  for (const stage of ["initial", "correction"] as const) {
    const completed = await waitFor(`both ${stage} input replies`, backend, () => {
      const snapshots = cases.map(facts)
      const done = cases.every((item, index) => {
        const snapshot = snapshots[index]!
        if (ownerKind === "task") {
          const tool = snapshot.tools.find((value) => value.data.callID === `setup_${stage}_${item.name}`)
          return (
            tool &&
            snapshot.outcomes.some(
              (value) => value.request_part_id === tool.id && value.data.outcome === "completed",
            ) &&
            snapshot.messages.some(
              (value) => value.id === tool.message_id && typeof value.data.time.completed === "number",
            )
          )
        }
        const text = `Recorded ${item.name} ${stage} setup input. Await next user input.`
        return snapshot.parts.some(
          (part) =>
            part.data.type === "text" &&
            part.data.text === text &&
            snapshot.messages.some(
              (message) =>
                message.id === part.message_id &&
                message.data.author === "mission" &&
                typeof message.data.time.completed === "number",
            ),
        )
      })
      return { activity: activity(snapshots), value: done ? snapshots : undefined }
    })
    await save(`setup-${stage}-facts.json`, completed)
    for (const item of cases) {
      item.stage = stage === "initial" ? "correction" : "exercise"
      const text =
        item.stage === "correction"
          ? item.correctionText
          : "Continue the unfinished investigation: read the project evidence and preserve its exact trace and cursor through compaction."
      const response = await json(
        backend,
        item.project,
        ownerKind === "task" ? `/task/${item.ownerID}/message` : "/mission/wake",
        ownerKind === "task"
          ? { text, source: "compaction-recovery-check" }
          : {
              requestID: crypto.randomUUID(),
              productPillar: "work",
              missionID: item.ownerID,
              text,
              model: `${target.providerID}/${target.modelID}`,
            },
      )
      item.acceptedInputs.push({ stage: item.stage, text, response })
    }
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
  if (ownerKind === "task" && cut === "after-checkpoint")
    assert.deepEqual(await Promise.all(cases.map((item) => item.summaryRequest)), [true, true])
  before.forEach((snapshot, index) => {
    const item = cases[index]!
    assert.equal(
      snapshot.promptOwners.find((owner) => owner.session_id === item.sessionID)?.owner_pid,
      backend.child.pid,
    )
    const controlFacts = controls(item.sessionID)
    const control = controlFacts.records
      .filter((record) => record.kind === "compaction_request")
      .toSorted((a, b) => a.time_created - b.time_created || a.id.localeCompare(b.id))
      .at(-1)!
    assert(control, "A real compaction control owns the cut boundary")
    const terminal = controlFacts.events
      .filter((event) => event.control_id === control.id && ["consumed", "failed"].includes(event.kind))
      .at(-1)
    assert.equal(terminal?.kind ?? "pending", cut === "after-checkpoint" ? "consumed" : "pending")
    if (cut === "after-checkpoint") {
      const marker = snapshot.parts.find((p) => p.data.type === "compaction")!
      const summary = snapshot.messages.find((message) => message.id === marker.message_id)!
      assert.equal(summary.data.summary, true)
      assert.equal(summary.data.finish, "stop")
      if (ownerKind === "task") {
        assert(marker.data.covered_parts.some((entry: Row) => item.producerMessageIDs.includes(entry.messageID)))
      } else {
        for (const id of item.producerMessageIDs.slice(0, 2)) {
          const original = snapshot.messages.find((message) => message.id === id)!
          assert.equal(typeof original.data.time.completed, "number")
          assert(
            original.data.time.completed <= summary.data.time.completed,
            "Completed Mission messages precede their checkpoint",
          )
        }
      }
    }
  })
  await save("before-facts.json", before)
  await save(
    "before-controls.json",
    cases.map((item) => controls(item.sessionID)),
  )
  cutStarted = true
  backend.child.kill("SIGKILL")
  await backend.child.exited
  await save("crashed-facts.json", cases.map(facts))
  console.log(JSON.stringify({ stage: "crashed", pid: backend.child.pid, owners: cases.map((item) => item.ownerID) }))
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
    const marker = current.parts.findLast((part) => part.data.type === "compaction")!
    assert(marker, "Recovered history owns a completed checkpoint")
    const item = cases[index]!
    const checkpoint = await CompactionPolicyCase.checkCheckpoint(item.sessionID, marker.message_id)
    assert(
      checkpoint.retainedUserSources.some(
        (source: Row) =>
          source.role === "user" &&
          source.author === "user" &&
          source.parts.some((part: Row) => part.text === item.correctionQuote),
      ),
      "The replayed checkpoint retains the exact prior original user correction",
    )
    await save(`${item.name}-checkpoint.json`, checkpoint)
    if (ownerKind === "mission") {
      assert.equal(
        current.events.findLast((event) => event.type === "mission.execution.opened")?.id,
        old.events.findLast((event) => event.type === "mission.execution.opened")?.id,
        "Recovery retains the original Mission execution occurrence",
      )
      const status = (await json(backend, item.project, `/mission/${item.ownerID}/status`)) as Row
      assert.equal(status.outcome?.kind, "accepted")
      const request = current.tools.find((tool) => tool.id === status.outcome.toolPartID)!
      assert.equal(request.data.tool, "panel_complete_mission")
      assert.equal(request.data.callID, status.outcome.toolCallID)
      assert.equal(request.message_id, status.outcome.messageID)
      assert.equal(
        current.outcomes.find((outcome) => outcome.request_part_id === request.id)?.data.outcome,
        "completed",
      )
      await save(`${item.name}-public-outcome.json`, status)
    }
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
    if (item.ownerID && item.rootSessionID) await save(`${item.name}-failed-facts.json`, facts(item))
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
