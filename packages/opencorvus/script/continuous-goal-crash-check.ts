import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { Database as SQLite } from "bun:sqlite"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "@opencorvus-ai/util/test-runtime-environment"
import { CredentialRedactor } from "./real-provider-audit"
import { latestAuditSnapshotFiles } from "./audit-snapshot"
import { Identifier } from "../src/id/id"

type Owner = { kind: "task" | "mission"; id: string; sessionID: string }
type Row = Record<string, any>
type Snapshot = ReturnType<typeof readGoalCrashSnapshot>

export function readGoalCrashSnapshot(databasePath: string, owner: Owner) {
  const db = new SQLite(databasePath, { readonly: true })
  db.exec("BEGIN")
  try {
    const session = db.query<Row, [string]>("SELECT * FROM session WHERE id=?").get(owner.sessionID)!
    const roots = [owner.sessionID]
    if (owner.kind === "mission")
      roots.push(
        ...db
          .query<Row, [string]>(
            "SELECT session_id FROM engine_task WHERE source='mission' AND json_extract(metadata,'$.mission.session_id')=?",
          )
          .all(owner.sessionID)
          .map((row) => row.session_id),
      )
    const ids = db
      .query<Row, string[]>(
        `WITH RECURSIVE tree(id) AS (SELECT id FROM session WHERE id IN (${roots.map(() => "?").join(",")}) UNION SELECT s.id FROM session s JOIN tree p ON s.parent_id=p.id) SELECT id FROM tree`,
      )
      .all(...roots)
      .map((row) => row.id as string)
    const placeholders = ids.map(() => "?").join(",")
    const decoded = (rows: Row[]) =>
      rows.map((row) => ({
        ...row,
        ...(row.data ? { data: JSON.parse(row.data) } : {}),
        ...(row.payload ? { payload: JSON.parse(row.payload) } : {}),
      }))
    const messages = decoded(
      db
        .query<Row, string[]>(`SELECT * FROM message WHERE session_id IN (${placeholders}) ORDER BY time_created,id`)
        .all(...ids),
    )
    const parts = decoded(
      db
        .query<
          Row,
          string[]
        >(`SELECT p.* FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id IN (${placeholders}) ORDER BY p.time_created,p.id`)
        .all(...ids),
    )
    const tools = decoded(
      db
        .query<
          Row,
          string[]
        >(`SELECT t.* FROM tool_part_request t JOIN message m ON m.id=t.message_id WHERE m.session_id IN (${placeholders}) ORDER BY t.time_created,t.id`)
        .all(...ids),
    )
    const outcomes = decoded(
      db
        .query<
          Row,
          string[]
        >(`SELECT o.* FROM tool_part_outcome o JOIN tool_part_request t ON t.id=o.request_part_id JOIN message m ON m.id=t.message_id WHERE m.session_id IN (${placeholders}) ORDER BY o.time_created,o.id`)
        .all(...ids),
    )
    const events = decoded(
      db
        .query<
          Row,
          [string, string]
        >("SELECT * FROM protocol_event WHERE aggregate_type=? AND aggregate_id=? ORDER BY seq")
        .all(owner.kind === "task" ? "task" : "session", owner.id),
    )
    const created = events.filter((row) => row.type === "continuous_goal.created").at(-1)
    const updates = events.filter(
      (row) => row.type === "continuous_goal.updated" && row.payload.goal_id === created?.id,
    )
    const continuations = events.filter(
      (row) => row.type === "continuous_goal.continuation_requested" && row.payload.goal_id === created?.id,
    )
    const usage = created
      ? db
          .query<
            Row,
            [string]
          >("SELECT u.*, e.id association_id FROM provider_usage_event u JOIN protocol_event e ON e.type='continuous_goal.usage' AND json_extract(e.payload,'$.usage_id')=u.id WHERE json_extract(e.payload,'$.goal_id')=? ORDER BY u.occurred_at,u.id")
          .all(created.id)
      : []
    const ingresses =
      owner.kind === "task"
        ? db
            .query<Row, [string]>("SELECT * FROM engine_task_root_ingress WHERE task_id=? ORDER BY sequence")
            .all(owner.id)
        : []
    const promptOwners = db
      .query<Row, string[]>(`SELECT * FROM session_prompt_owner WHERE session_id IN (${placeholders})`)
      .all(...ids)
    const activations =
      owner.kind === "task"
        ? db
            .query<
              Row,
              [string]
            >("SELECT a.* FROM engine_control_activation_lease a JOIN engine_task_root_ingress i ON i.id=a.target_id WHERE a.target='task_root_ingress' AND i.task_id=? ORDER BY a.time_activated,a.id")
            .all(owner.id)
        : []
    return {
      session,
      ids,
      messages,
      parts,
      tools,
      outcomes,
      events,
      created,
      updates,
      continuations,
      usage,
      ingresses,
      promptOwners,
      activations,
    }
  } finally {
    db.exec("ROLLBACK")
    db.close()
  }
}

export function crashCandidate(facts: Snapshot, audit: Row) {
  if (facts.continuations.length !== 1 || facts.updates.at(-1)?.payload.input.status === "complete") return
  const continuation = facts.continuations[0]!
  const inputID = Identifier.deterministic("message", continuation.id)
  const controller = facts.messages.find(
    (message) => message.id === inputID && message.data.author === "goal-controller",
  )
  if (!controller) return
  for (const [index, request] of (audit.requests ?? []).entries()) {
    const reader = request.response_reader
    const context = reader.requestContext
    if (reader.state !== "reading" || reader.byteCount <= 0 || !context || !facts.ids.includes(context.sessionID))
      continue
    const assistant = facts.messages.find((message) => message.id === context.activity?.assistantMessageID)
    if (
      !assistant ||
      assistant.data.role !== "assistant" ||
      assistant.time_created < controller.time_created ||
      assistant.data.time.completed
    )
      continue
    const ingress = facts.ingresses.find((row) => row.source_id === inputID)
    const acceptedInputs = assistant.data.acceptedInputMessageIDs ?? [assistant.data.parentID]
    const acceptsCut = ingress
      ? acceptedInputs.some(
          (id: string) =>
            facts.messages.find((message) => message.id === id)?.data.extra?.orchestrator_control_ingress
              ?.ingress_id === ingress.id,
        )
      : acceptedInputs.includes(inputID)
    if (!acceptsCut) continue
    const progress = facts.parts
      .filter((part) => part.message_id === assistant.id && part.time_updated >= reader.firstByteReadAt)
      .map((part) => ({
        id: part.id,
        type: part.data.type,
        characters: typeof part.data.text === "string" ? part.data.text.length : 0,
      }))
    const toolIDs = facts.tools
      .filter((tool) => tool.message_id === assistant.id && tool.time_created >= reader.firstByteReadAt)
      .map((tool) => tool.id)
    if (!progress.some((part) => part.characters > 0) && toolIDs.length === 0) continue
    const promptOwner = facts.promptOwners.find((row) => row.session_id === assistant.session_id)
    if (!promptOwner || promptOwner.owner_pid !== audit.pid) continue
    return {
      continuationID: continuation.id,
      inputID,
      assistantID: assistant.id,
      requestIndex: index,
      reader,
      progress,
      toolIDs,
      promptOwner,
      ingress,
      opened: facts.events
        .filter(
          (row) =>
            row.type === (facts.ingresses.length ? "task.execution.opened" : "mission.execution.opened") ||
            row.type === "task.execution.reopened",
        )
        .at(-1),
    }
  }
}

export function recoveryCandidate(
  facts: Snapshot,
  audit: Row,
  cut: NonNullable<ReturnType<typeof crashCandidate>>,
  pid: number,
) {
  const interrupted = facts.messages.find((message) => message.id === cut.assistantID)
  if (interrupted?.data.error?.name !== "ProcessExecutionInterruptedError" || !interrupted.data.time.completed) return
  for (const [requestIndex, request] of (audit.requests ?? []).entries()) {
    const context = request.response_reader.requestContext
    if (!context || !facts.ids.includes(context.sessionID)) continue
    const owner = facts.promptOwners.find((row) => row.session_id === context.sessionID)
    if (!owner || owner.owner_pid !== pid || owner.generation === cut.promptOwner.generation) continue
    const assistant = facts.messages.find((message) => message.id === context.activity?.assistantMessageID)
    if (!assistant || assistant.id === cut.assistantID) continue
    const accepted = assistant.data.acceptedInputMessageIDs ?? [assistant.data.parentID]
    const input = facts.messages.find(
      (message) =>
        accepted.includes(message.id) &&
        (message.id === cut.inputID ||
          (cut.ingress && message.data.extra?.orchestrator_control_ingress?.ingress_id === cut.ingress.id) ||
          message.data.extra?.wake_reason?.source === "mission.process_recovery"),
    )
    if (!input) continue
    const reason = input.data.extra?.wake_reason
    if (
      reason?.source === "mission.process_recovery" &&
      (reason.openedEventID !== cut.opened?.id ||
        reason.deadOwnerGeneration !== cut.promptOwner.generation ||
        !reason.interruptedAssistantMessageIDs.includes(cut.assistantID))
    )
      continue
    return {
      kind: cut.ingress
        ? "task_ingress"
        : reason?.source === "mission.process_recovery"
          ? "mission_process_recovery"
          : "accepted_goal_input",
      promptOwner: owner,
      inputID: input.id,
      assistantID: assistant.id,
      interruptedAssistantID: interrupted.id,
      interruptedAt: interrupted.data.time.completed,
      requestIndex,
      requestContext: context,
      ...(reason?.source === "mission.process_recovery" ? { reason } : {}),
    }
  }
}

/** Progress facts, excluding renewable leases, owner heartbeats and sampling timestamps. */
export function goalCrashActivity(facts: Snapshot, audit: Row) {
  return {
    messages: facts.messages.map((row) => ({ id: row.id, data: row.data })),
    parts: facts.parts.map((row) => ({ id: row.id, data: row.data })),
    tools: facts.tools.map((row) => ({ id: row.id, data: row.data })),
    outcomes: facts.outcomes.map((row) => ({ id: row.id, data: row.data })),
    protocol: facts.events.map((row) => ({ id: row.id, type: row.type, payload: row.payload })),
    usageIDs: facts.usage.map((row) => row.id),
    requests: (audit.requests ?? []).map((request: Row) => ({
      model: request.model,
      status: request.status,
      state: request.response_reader.state,
      byteCount: request.response_reader.byteCount,
      chunkCount: request.response_reader.chunkCount,
      requestContext: request.response_reader.requestContext,
      terminal: request.response_reader.terminal,
    })),
  }
}

function redactedSnapshot(facts: Snapshot) {
  return {
    ...facts,
    parts: facts.parts.map((part) =>
      part.data.type === "reasoning"
        ? { ...part, data: { type: "reasoning", characters: part.data.text?.length ?? 0 } }
        : part,
    ),
  }
}

async function main() {
  const kind = process.env.GOAL_CRASH_KIND as Owner["kind"]
  const model = process.env.GOAL_CRASH_MODEL
  const authSource = process.env.GOAL_CRASH_AUTH_SOURCE
  const evidence = process.env.GOAL_CRASH_EVIDENCE
  assert(
    process.env.GOAL_CRASH_ALLOW_REAL_PROVIDER === "1" &&
      ["task", "mission"].includes(kind) &&
      model &&
      authSource &&
      evidence,
    "Set explicit GOAL_CRASH_ALLOW_REAL_PROVIDER, KIND, MODEL, AUTH_SOURCE and EVIDENCE",
  )
  const sourceModel = model!
  const evidenceRoot = path.resolve(evidence!)
  await fs.mkdir(evidenceRoot, { recursive: false })
  const runtime = await bootstrapIsolatedTestRuntime("runner")
  applyIsolatedTestUserEnvironment(runtime)
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
  process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
    model: sourceModel,
    small_model: sourceModel,
    permission_mode: "full_access",
  })
  const { prepareTestProcessSupervisor } = await import("./prepare-test-process-supervisor")
  const supervisor = prepareTestProcessSupervisor()
  if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
  const project = path.join(runtime.processRoot, "project")
  await fs.mkdir(project)
  for (const args of [
    ["init"],
    ["config", "user.name", "Goal Crash Acceptance"],
    ["config", "user.email", "crash@example.invalid"],
    ["commit", "--allow-empty", "-m", "Isolated crash acceptance"],
  ])
    execFileSync("git", args, { cwd: project, stdio: "ignore" })
  const authTarget = path.join(runtime.runtimeRoot, "data", "auth.json")
  const modelsTarget = path.join(runtime.runtimeRoot, "data", "models.json")
  await fs.mkdir(path.dirname(authTarget), { recursive: true })
  await fs.copyFile(path.resolve(authSource!), authTarget)
  await fs.copyFile(path.join(path.dirname(path.resolve(authSource!)), "models.json"), modelsTarget)
  const redactor = new CredentialRedactor()
  redactor.collect(JSON.parse(await fs.readFile(authTarget, "utf8")))
  const save = async (name: string, data: unknown) =>
    fs.writeFile(path.join(evidenceRoot, name), redactor.redact(JSON.stringify(data, null, 2)))
  const inactivityMs = 180_000
  const maxRequests = 32
  const tokenBudget = 800_000
  const turnBudget = 3
  const request = [
    `请执行有限持续目标验收。用户明确授权创建持续目标，tokenBudget=${tokenBudget}，turnBudget=${turnBudget}。目标是交付一份含六项具体核对标准的两阶段验收说明。`,
    "首次输入这一轮：创建目标，简要说明阶段一需求核对、阶段二验收核对，然后结束当前输入，保持目标active。",
    "第一个goal-controller自动轮次：实际输出两阶段各三项具体核对标准，每项包括可观察证据和通过条件；写完六项后核对实际消息，调用update_continuous_goal标记complete并引用证据，再完成当前模式的正常完成合同。",
    "本验收可能在自动轮次中发生真实进程中断。若收到运行时恢复消息，请核对已有持久化输入和结果，从同一六项标准的安全边界继续，避免重复已完成工作；不创建新目标，不要求用户再说继续。",
    "不访问网站、不部署、不读凭据、不改变权限、不创建计划定时等待。本有限说明由当前负责人直接交付，无需子agent或子Task。",
    kind === "task"
      ? "首轮用现有no_action结算当前输入；最后目标complete后按当前Task完成合同正常完成Task。"
      : "这是无子Task的有限Mission协调；最后使用现有panel_complete_mission完成，task_acceptances=[]。",
  ].join("\n")
  const databasePath = path.join(runtime.runtimeRoot, "data", "opencorvus.db")
  const manifest = {
    kind,
    sourceModel,
    project,
    runtimeRoot: runtime.runtimeRoot,
    databasePath,
    maxRequests,
    tokenBudget,
    turnBudget,
    inactivityMs,
    request,
    startedAt: Date.now(),
  }
  await save("manifest.json", manifest)
  let failure: unknown
  let owner: Owner | undefined
  const children: Array<ReturnType<typeof start>> = []
  const auditRoots: string[] = []
  let lastActivity = Date.now()
  let activitySignature = ""
  let before: Snapshot | undefined
  let cut: ReturnType<typeof crashCandidate>
  let recoveryEvidence: ReturnType<typeof recoveryCandidate>
  const result: Row = { ...manifest, status: "running" }
  function start(phase: string, used: number) {
    let startup = true
    const receipt = path.join(evidenceRoot, `${phase}-startup.json`)
    const auditRoot = path.join(evidenceRoot, `${phase}-audit`)
    auditRoots.push(auditRoot)
    const child = Bun.spawn(
      [
        process.execPath,
        "--preload",
        path.join(import.meta.dir, "continuous-goal-crash-preload.ts"),
        path.resolve(import.meta.dir, "../src/index.ts"),
        "serve",
        "--hostname",
        "127.0.0.1",
        "--port",
        "0",
        "--project-dir",
        project,
        "--startup-receipt",
        receipt,
        "--startup-occurrence",
        crypto.randomUUID(),
      ],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        env: {
          ...process.env,
          GOAL_CRASH_AUDIT_ROOT: auditRoot,
          GOAL_CRASH_REMAINING_REQUESTS: String(maxRequests - used),
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const read = async (stream: ReadableStream<Uint8Array>) => {
      let text = ""
      for await (const chunk of stream) {
        text += new TextDecoder().decode(chunk)
        if (startup) lastActivity = Date.now()
      }
      return redactor.redact(text)
    }
    return {
      child,
      phase,
      receipt,
      auditRoot,
      startedAt: Date.now(),
      stdout: read(child.stdout),
      stderr: read(child.stderr),
      url: "",
      startupFinished() {
        startup = false
      },
    }
  }
  async function auditAt(root: string): Promise<Row> {
    const files = await latestAuditSnapshotFiles(root, "provider")
    assert(files.length <= 1, "One formal serve process owns each physical Provider audit")
    return files.length ? JSON.parse(await fs.readFile(files[0]!, "utf8")) : { requests: [] }
  }
  async function waitFor<T>(
    label: string,
    child: ReturnType<typeof start>,
    sample: () => Promise<{ activity: unknown; value?: T }>,
  ): Promise<T> {
    activitySignature = ""
    lastActivity = Date.now()
    for (;;) {
      if (child.child.exitCode !== null || child.child.signalCode != null)
        throw new Error(`${label}: process ${child.child.pid} exited ${child.child.exitCode}`)
      const { activity, value } = await sample()
      const next = JSON.stringify(activity)
      if (next !== activitySignature) {
        activitySignature = next
        lastActivity = Date.now()
      }
      if (value !== undefined) return value
      if (Date.now() - lastActivity > inactivityMs) throw new Error(`${label}: no real activity for ${inactivityMs}ms`)
      await Bun.sleep(100)
    }
  }
  async function ready(child: ReturnType<typeof start>) {
    const receipt = await waitFor<Row>("formal server startup", child, async () => {
      const value = await fs
        .readFile(child.receipt, "utf8")
        .then(JSON.parse)
        .catch(() => undefined)
      return { activity: value ?? null, value }
    })
    assert.equal(receipt.outcome, "listening")
    assert.equal(receipt.pid, child.child.pid)
    child.url = receipt.url
    child.startupFinished()
    console.log(
      JSON.stringify({ stage: "server_ready", kind, phase: child.phase, pid: child.child.pid, url: child.url }),
    )
  }
  async function json(child: ReturnType<typeof start>, route: string, body?: unknown, directory = project) {
    const url = new URL(route, child.url)
    url.searchParams.set("directory", directory)
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    })
    assert(response.ok, `${route}: ${response.status} ${response.ok ? "" : await response.text()}`)
    return response.json() as Promise<Row>
  }
  try {
    const first = start("before", 0)
    children.push(first)
    await ready(first)
    const catalog = await json(first, "/provider")
    const projected = catalog.all.find((provider: Row) => provider.id === sourceModel.split("/")[0])?.models[
      sourceModel.split("/")[1]!
    ]
    assert.equal(projected?.api?.id, sourceModel.split("/")[1], "Exact target model projection")
    const preflight = await json(first, "/global/chat/start", {
      requestID: crypto.randomUUID(),
      model: sourceModel,
      text: "Reply with OK.",
    })
    await waitFor("credential preflight", first, async () => {
      const messages = (await json(
        first,
        `/session/${preflight.session.id}/message`,
        undefined,
        preflight.session.directory,
      )) as unknown as Row[]
      const audit = await auditAt(first.auditRoot)
      assert.equal(audit.exhausted, false, "Preflight within request ceiling")
      const reply = messages.find(
        (item) =>
          item.info.role === "assistant" && item.info.parentID === preflight.messageID && item.info.time.completed,
      )
      if (reply?.info.error) throw new Error("Credential preflight failed: " + JSON.stringify(reply.info.error))
      return {
        activity: { messages, audit: audit.requests },
        value:
          reply?.parts.some((part: Row) => part.type === "text" && part.text.trim()) &&
          audit.requests.some((entry: Row) => entry.status === 200)
            ? true
            : undefined,
      }
    })
    result.preflight = {
      credential: "usable",
      catalog: "projected",
      actualModel: sourceModel.split("/")[1],
      streaming: true,
    }
    await save("preflight.json", result.preflight)
    if (kind === "task") {
      const created = await json(first, "/task", {
        requestID: crypto.randomUUID(),
        productPillar: "code",
        title: "持续目标真实崩溃恢复",
        source: "continuous-goal-crash-check",
        promptProfile: "base",
        request,
        model: sourceModel,
      })
      const db = new SQLite(databasePath, { readonly: true })
      try {
        owner = {
          kind,
          id: created.task_id,
          sessionID: db.query<Row, [string]>("SELECT session_id FROM engine_task WHERE id=?").get(created.task_id)!
            .session_id,
        }
      } finally {
        db.close()
      }
    } else {
      const created = await json(first, "/mission/wake", {
        requestID: crypto.randomUUID(),
        productPillar: "work",
        text: request,
        model: sourceModel,
        expertSquadIDs: ["base"],
      })
      owner = { kind, id: created.sessionID, sessionID: created.sessionID }
    }
    result.owner = owner
    await save("owner.json", owner)
    cut = await waitFor("partial automatic goal response", first, async () => {
      const facts = readGoalCrashSnapshot(databasePath, owner!)
      const audit = await auditAt(first.auditRoot)
      assert.equal(audit.exhausted, false, "Crash phase within total request ceiling")
      if (facts.updates.at(-1)?.payload.input.status === "complete")
        throw new Error("Goal completed before an observable automatic-turn crash cut")
      const candidate = crashCandidate(facts, audit)
      if (candidate) before = facts
      return { activity: goalCrashActivity(facts, audit), value: candidate }
    })
    await save("crash-cut.json", { pid: first.child.pid, at: Date.now(), ...cut })
    await save("before-facts.json", redactedSnapshot(before!))
    first.child.kill("SIGKILL")
    await first.child.exited
    const crashed = readGoalCrashSnapshot(databasePath, owner!)
    await save("crashed-facts.json", redactedSnapshot(crashed))
    if (
      crashed.messages.find((message) => message.id === cut!.assistantID)?.data.time.completed !== undefined ||
      crashed.updates.at(-1)?.payload.input.status === "complete"
    )
      throw new Error("CRASH_CUT_ALREADY_SETTLED: the physical interruption missed the active assistant")
    assert.equal(
      crashed.promptOwners.find((row) => row.session_id === cut!.promptOwner?.session_id)?.generation,
      cut!.promptOwner?.generation,
      "Dead Prompt owner generation retained",
    )
    const firstAudit = await auditAt(first.auditRoot)
    await save("before-provider.json", firstAudit)
    const used = firstAudit.requests.length
    result.crash = {
      pid: first.child.pid,
      exitCode: first.child.exitCode,
      signalCode: first.child.signalCode,
      requestCount: used,
      cut,
    }
    assert(used < maxRequests, "Remaining recovery request capacity")
    console.log(
      JSON.stringify({
        stage: "crashed",
        kind,
        pid: first.child.pid,
        requests: used,
        continuationID: cut!.continuationID,
        partial: cut!.progress,
      }),
    )
    const second = start("after", used)
    children.push(second)
    await ready(second)
    const final = await waitFor("automatic formal startup recovery", second, async () => {
      const facts = readGoalCrashSnapshot(databasePath, owner!)
      const audit = await auditAt(second.auditRoot)
      assert.equal(audit.exhausted, false, "Recovery within total request ceiling")
      if (!recoveryEvidence) {
        recoveryEvidence = recoveryCandidate(facts, audit, cut!, second.child.pid)
        if (recoveryEvidence) await save("recovery-admission.json", recoveryEvidence)
      }
      const status = facts.updates.at(-1)?.payload.input.status
      if (["blocked", "paused"].includes(status)) throw new Error("Goal stopped after recovery: " + status)
      const completion =
        kind === "task"
          ? facts.events.find(
              (row) => row.type === "task.completed" && row.payload.execution_epoch === cut!.ingress!.execution_epoch,
            )
          : facts.outcomes.find(
              (outcome) =>
                outcome.data.outcome === "completed" &&
                facts.tools.some(
                  (tool) => tool.id === outcome.request_part_id && tool.data.tool === "panel_complete_mission",
                ),
            )
      const live = facts.messages.filter((message) => message.data.role === "assistant" && !message.data.time.completed)
      const reading = audit.requests.some((entry: Row) =>
        ["awaiting_response", "awaiting_binding", "reading"].includes(entry.response_reader.state),
      )
      const latestReply = facts.messages
        .filter(
          (message) =>
            message.data.role === "assistant" && (kind === "task" || message.session_id === owner!.sessionID),
        )
        .at(-1)
      const replySettled =
        kind === "task" ||
        (latestReply?.data.finish === "stop" && latestReply.data.time.completed >= completion?.data.time.end)
      return {
        activity: goalCrashActivity(facts, audit),
        value: status === "complete" && completion && replySettled && live.length === 0 && !reading ? facts : undefined,
      }
    })
    assert.equal(final.created!.id, before!.created!.id, "Goal identity retained")
    assert.deepEqual(
      final.continuations.map((row) => row.id),
      [cut!.continuationID],
      "Exactly the same accepted automatic continuation",
    )
    assert.deepEqual(
      final.messages.filter((row) => row.data.author === "goal-controller").map((row) => row.id),
      [cut!.inputID],
      "Exactly the same visible controller input",
    )
    if (kind === "task")
      assert.deepEqual(
        final.ingresses.find((row) => row.id === cut!.ingress!.id),
        cut!.ingress,
        "Exact Task ingress occurrence retained",
      )
    else {
      assert.equal(
        final.events.filter((row) => row.type === "mission.execution.opened").at(-1)!.id,
        cut!.opened!.id,
        "Same Mission opened occurrence",
      )
    }
    assert(recoveryEvidence, "Exact new-process recovery input and Prompt generation observed")
    result.recoveryEvidence = recoveryEvidence
    const goal = await json(second, `/continuous-goal/${kind}/${owner!.id}`)
    assert.equal(goal.status, "complete")
    assert.equal(goal.turnsAccepted, 1)
    assert.equal(
      goal.tokensUsed,
      final.usage.reduce((sum, row) => sum + row.total_tokens, 0),
      "Goal usage joins the original ledger",
    )
    const priorUsage = new Set(crashed.usage.map((row) => row.id))
    const recoveredUsage = final.usage.filter((row) => !priorUsage.has(row.id) && row.occurred_at >= second.startedAt)
    assert(recoveredUsage.length > 0, "New process settles new Provider usage")
    for (const row of recoveredUsage) {
      assert.equal(row.provider_id, sourceModel.split("/")[0])
      assert.equal(row.model_id, sourceModel.split("/")[1])
      assert(final.ids.includes(row.session_id), "Recovered usage belongs to exact owner scope")
    }
    result.recoveredUsageIDs = recoveredUsage.map((row) => row.id)
    result.recoveryStartedAt = second.startedAt
    if (kind === "mission") {
      const missionID = JSON.parse(final.session.metadata).mission.id
      const status = await json(second, `/mission/${missionID}/status`)
      assert.equal(status.outcome?.kind, "accepted", "Public Mission completion authority")
      result.publicOwnerOutcome = status.outcome
    } else {
      const task = await json(second, `/task/${owner!.id}`)
      assert.equal(task.status, "completed", "Public Task completion authority")
      assert.equal(task.executionLifecycle.epoch, cut!.ingress!.execution_epoch, "Public current Task epoch")
      result.publicOwnerOutcome = task
    }
    const transcripts = []
    for (const id of final.ids) {
      const transcript = (await json(second, `/session/${id}/message`)) as unknown as Row[]
      transcripts.push({
        sessionID: id,
        messages: transcript.map((entry) => ({
          ...entry,
          parts: entry.parts.filter((part: Row) => part.type !== "reasoning"),
        })),
      })
    }
    assert(
      transcripts.some((entry) =>
        entry.messages.some(
          (message) =>
            message.info.role === "assistant" &&
            message.info.time.created >= before!.messages.find((row) => row.id === cut!.assistantID)!.time_created &&
            message.parts.some((part: Row) => part.type === "text" && part.text.trim()),
        ),
      ),
      "Real visible output after interrupted automatic turn",
    )
    if (kind === "mission") {
      const outcome = result.publicOwnerOutcome
      const message = transcripts
        .flatMap((entry) => entry.messages)
        .find((entry) => entry.info.id === outcome.messageID)
      const part = message?.parts.find(
        (entry: Row) =>
          entry.id === outcome.toolPartID &&
          entry.callID === outcome.toolCallID &&
          entry.tool === "panel_complete_mission",
      )
      assert.equal(part?.state.status, "completed", "Mission public outcome names its exact completed Tool")
      const receipt = JSON.parse(part.state.output)
      assert.equal(receipt.kind, "mission_completed")
      assert.equal(receipt.mission_session_id, owner!.sessionID)
      assert.equal(receipt.assistant_message_id, outcome.messageID)
      assert.equal(receipt.tool_call_id, outcome.toolCallID)
      assert.equal(receipt.tool_part_id, outcome.toolPartID)
      assert.deepEqual(receipt.task_acceptances, [], "Finite coordination has its exact empty child acceptance set")
      result.completionReceipt = receipt
    }
    result.goal = goal
    result.status = "passed"
    result.interruptedUsage =
      "unknown: hard termination can precede Provider usage settlement; no usage was synthesized"
    await save("final-facts.json", redactedSnapshot(final))
    await save("transcripts.json", transcripts)
    await save("after-provider.json", await auditAt(second.auditRoot))
    console.log(JSON.stringify({ stage: "passed", kind, goalID: goal.id, tokens: goal.tokensUsed }))
  } catch (error) {
    failure = error
    result.status = "failed"
    result.error = redactor.redact(error instanceof Error ? (error.stack ?? error.message) : String(error))
    if (owner) await save("failed-facts.json", redactedSnapshot(readGoalCrashSnapshot(databasePath, owner)))
    console.error(redactor.redact(String(error)))
  } finally {
    const settlement: Row = { processes: [], ports: [], credentialPairRemoved: false }
    for (const child of children) {
      if (child.child.exitCode === null && child.child.signalCode == null) child.child.kill("SIGTERM")
      const exited = await Promise.race([child.child.exited.then(() => true), Bun.sleep(30_000).then(() => false)])
      if (!exited) {
        child.child.kill("SIGKILL")
        await child.child.exited
      }
      settlement.processes.push({
        pid: child.child.pid,
        exited: true,
        exitCode: child.child.exitCode,
        signalCode: child.child.signalCode,
        forcedCleanup: !exited,
      })
      await fs.writeFile(path.join(evidenceRoot, child.phase + "-stdout.log"), await child.stdout)
      await fs.writeFile(path.join(evidenceRoot, child.phase + "-stderr.log"), await child.stderr)
    }
    for (const url of new Set(children.map((child) => child.url).filter(Boolean)))
      settlement.ports.push({
        url,
        reachable: await fetch(url, { signal: AbortSignal.timeout(1000) }).then(
          () => true,
          () => false,
        ),
      })
    const audits = await Promise.all(auditRoots.map(auditAt))
    result.totalRequests = audits.reduce((sum, entry) => sum + entry.requests.length, 0)
    result.requestReaders = audits.flatMap((entry) =>
      entry.requests.map((request: Row) => ({ pid: entry.pid, ...request })),
    )
    await fs.rm(authTarget, { force: true })
    await fs.rm(modelsTarget, { force: true })
    settlement.credentialPairRemoved = (
      await Promise.all(
        [authTarget, modelsTarget].map((file) =>
          fs.stat(file).then(
            () => false,
            () => true,
          ),
        ),
      )
    ).every(Boolean)
    settlement.endedAt = Date.now()
    await save("settlement.json", settlement)
    await save("result.json", result)
  }
  if (failure) process.exitCode = 1
}

if (import.meta.main) await main()
