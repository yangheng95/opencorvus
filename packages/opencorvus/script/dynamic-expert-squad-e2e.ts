import { randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { payloadPackageSources } from "../generated/expert-squad-payload"
import {
  requireAuthoritativeCompletedWorkerFinalMessage,
  requireCrossSessionProviderExecutionOverlap,
  requireSingleAttemptProviderActivities,
} from "./dynamic-e2e-contract"

const ALLOW_REAL_PROVIDER = "DYNAMIC_EXPERT_SQUAD_E2E_ALLOW_REAL_PROVIDER"
const AUTH_SOURCE = "DYNAMIC_EXPERT_SQUAD_E2E_AUTH_SOURCE"
const MODELS_SOURCE = "DYNAMIC_EXPERT_SQUAD_E2E_MODELS_SOURCE"
const MODEL = "DYNAMIC_EXPERT_SQUAD_E2E_MODEL"
const RESULT = "DYNAMIC_EXPERT_SQUAD_E2E_RESULT"
const FAILED_BASELINE_TOKENS = 1_972_934
const MAX_TASK_TOKENS = 750_000
const MAX_ORCHESTRATOR_TOKENS = 350_000
const MIN_REDUCTION = 0.6
const POLL_MS = 500
const INACTIVITY_MS = 240_000
const TOTAL_TIMEOUT_MS = 900_000

if (process.env[ALLOW_REAL_PROVIDER] !== "1") {
  throw new Error(`${ALLOW_REAL_PROVIDER}=1 is required because this checker performs real streaming model calls.`)
}
const authoritySource = process.env[AUTH_SOURCE]?.trim()
if (!authoritySource) throw new Error(`${AUTH_SOURCE} must name an existing auth.json authority file.`)
const model = process.env[MODEL]?.trim() || "openai/gpt-5.6-luna"
const modelSeparator = model.indexOf("/")
if (modelSeparator <= 0 || modelSeparator === model.length - 1) {
  throw new Error(`${MODEL} must be a provider/model reference, received ${JSON.stringify(model)}.`)
}
const providerID = model.slice(0, modelSeparator)
const modelID = model.slice(modelSeparator + 1)
const runID = randomBytes(8).toString("hex")
const root = await fs.mkdtemp(path.join(os.tmpdir(), `opencorvus-dynamic-e2e-${runID}-`))
const runtimeRoot = path.join(root, "runtime")
const projectDirectory = path.join(root, "project")
const resultPath = process.env[RESULT]?.trim()
  ? path.resolve(process.env[RESULT]!.trim())
  : path.join(os.tmpdir(), `opencorvus-dynamic-e2e-${runID}.json`)
const startedAt = Date.now()
const runtime: {
  server?: { stop(force?: boolean): Promise<void> }
  Database?: { close(): void }
  Instance?: { disposeAll(): Promise<void> }
  ProcessSupervisor?: { disposeLiveProcessesUnder(directory: string): Promise<void> }
} = {}
let primaryFailure: unknown

type JsonObject = Record<string, any>
type TranscriptMessage = { info: JsonObject; parts: JsonObject[] }

function requiredGeneratedDynamicPackage() {
  const source = payloadPackageSources.find((entry) => entry.namespace === "builtin" && entry.id === "dynamic")
  if (!source) throw new Error("Generated Expert Squad payload does not contain builtin/dynamic.")
  const manifestText = source.files["expert-squad.jsonc"]
  if (typeof manifestText !== "string") throw new Error("Generated builtin/dynamic payload has no manifest bytes.")
  const manifest = Bun.JSONC.parse(manifestText) as JsonObject
  if (
    manifest.version !== "2026.08.30.2" ||
    manifest.capability_projection?.scheduler?.inherit_base_tools !== false ||
    JSON.stringify(manifest.capability_projection?.scheduler?.built_in_tool_ids) !==
      JSON.stringify(["dispatch_agents", "manage_task", "no_action", "read_task_message", "read_agent_message", "skill"])
  ) {
    throw new Error(`Generated builtin/dynamic payload is stale: ${JSON.stringify(manifest)}`)
  }
  return manifest
}

async function command(args: string[], cwd: string) {
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(`${args.join(" ")} failed: ${(stderr || stdout).trim()}`)
}

async function initializeProject() {
  await fs.mkdir(path.join(projectDirectory, "evidence"), { recursive: true })
  await Promise.all([
    fs.writeFile(
      path.join(projectDirectory, "README.md"),
      "# Dynamic frontier real-provider E2E\n\nTwo independent evidence files must be read by sibling Sessions.\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(projectDirectory, "evidence", "orion.txt"),
      "ORION_CODE=17\nORION_COLOR=amber\n",
      "utf8",
    ),
    fs.writeFile(
      path.join(projectDirectory, "evidence", "nebula.txt"),
      "NEBULA_CODE=29\nNEBULA_COLOR=violet\n",
      "utf8",
    ),
  ])
  for (const args of [
    ["git", "init", "--initial-branch=main"],
    ["git", "config", "user.name", "OpenCorvus Dynamic E2E"],
    ["git", "config", "user.email", "dynamic-e2e@opencorvus.invalid"],
    ["git", "add", "README.md", "evidence/orion.txt", "evidence/nebula.txt"],
    ["git", "commit", "-m", "test: initialize Dynamic frontier e2e"],
  ]) {
    await command(args, projectDirectory)
  }
}

async function copyProviderAuthority() {
  const source = path.resolve(authoritySource!)
  if (!(await fs.stat(source)).isFile()) throw new Error(`${AUTH_SOURCE} is not a file: ${source}`)
  const configuredModelsSource = process.env[MODELS_SOURCE]?.trim()
  const catalogSource = configuredModelsSource
    ? path.resolve(configuredModelsSource)
    : path.join(path.dirname(source), "models.json")
  if (!(await fs.stat(catalogSource)).isFile()) {
    throw new Error(`${MODELS_SOURCE} must name models.json, or models.json must exist beside ${AUTH_SOURCE}.`)
  }
  const dataDirectory = path.join(runtimeRoot, "data")
  await fs.mkdir(dataDirectory, { recursive: true })
  await Promise.all([
    fs.copyFile(source, path.join(dataDirectory, "auth.json")),
    fs.copyFile(catalogSource, path.join(dataDirectory, "models.json")),
  ])
}

try {
  for (const key of [
    "OPENCORVUS_API_KEY",
    "OPENCORVUS_CONFIG",
    "OPENCORVUS_CONFIG_DIR",
    "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
    "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
  ]) {
    delete process.env[key]
  }
  process.env.OPENCORVUS_HOME = runtimeRoot
  process.env.OPENCORVUS_TEST_HOME = runtimeRoot
  process.env.OPENCORVUS_TEST_PROCESS_ROOT = root
  process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
    permission: "allow",
    permission_mode: "full_access",
    model,
    small_model: model,
  })
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"

  const generatedManifest = requiredGeneratedDynamicPackage()
  await initializeProject()
  await copyProviderAuthority()

  const [
    { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime },
    { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded },
    { Instance },
    { Database },
    { MessageTable, ProviderActivityOutcomeTable, ProviderActivityRequestTable },
    { ProcessSupervisor },
    { WorkerTurnDescriptor },
    { findDispatchLineageBySession },
    { ProtocolStore },
    { SessionLoop },
  ] = await Promise.all([
    import("@/cli/server-runtime"),
    import("@/engine/host-recovery"),
    import("@/project/instance"),
    import("@/storage/db"),
    import("@/session/session.sql"),
    import("@/shell/process-supervisor"),
    import("@/agent/worker-turn-descriptor"),
    import("@/engine/dispatch-lineage"),
    import("@/protocol/store"),
    import("@/session/loop"),
  ])
  runtime.Database = Database
  runtime.Instance = Instance
  runtime.ProcessSupervisor = ProcessSupervisor

  const prepared = await requireRecoveredServerRuntime(
    await listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions()),
      disposeInstances: () => Instance.disposeAll(),
    }),
  )
  const server = prepared.server
  runtime.server = server
  const base = server.url.toString().replace(/\/$/, "")

async function request(route: string, init: RequestInit = {}) {
  const url = new URL(route, base)
  if (!url.searchParams.has("directory")) url.searchParams.set("directory", projectDirectory)
  const headers = new Headers(init.headers)
  headers.set("x-opencorvus-directory", projectDirectory)
  headers.set("x-opencorvus-request-id", crypto.randomUUID())
  return await fetch(url, { ...init, headers })
}

async function requestJSON<T = JsonObject>(route: string, init: RequestInit = {}): Promise<T> {
  const response = await request(route, init)
  const body = await response.text()
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${route} failed ${response.status}: ${body}`)
  return body ? (JSON.parse(body) as T) : (undefined as T)
}

function toolParts(transcript: TranscriptMessage[]) {
  return transcript.flatMap((message) =>
    message.parts.flatMap((part) =>
      part.type === "tool"
        ? [{ messageID: String(message.info.id), sessionID: String(message.info.sessionID), agent: String(message.info.agent), part }]
        : [],
    ),
  )
}

function tokenValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function usageFromTaskTranscript(transcript: TranscriptMessage[]) {
  const messages = transcript.filter(
    (message) => message.info.role === "assistant" && typeof message.info.providerID === "string",
  )
  const messageIDs = new Set(messages.map((message) => String(message.info.id)))
  const requests = Database.use((db) => db.select().from(ProviderActivityRequestTable).all())
  const outcomes = Database.use((db) => db.select().from(ProviderActivityOutcomeTable).all())
  const taskRequests = requests.filter((request) => messageIDs.has(request.assistant_message_id))
  const taskRequestIDs = new Set(taskRequests.map((request) => request.id))
  const taskOutcomes = outcomes.filter((outcome) => taskRequestIDs.has(outcome.request_id))
  const taskOutcomeByRequest = new Map(taskOutcomes.map((outcome) => [outcome.request_id, outcome.data]))
  requireSingleAttemptProviderActivities({ requests: taskRequests, outcomes: taskOutcomes })
  const byAgent: Record<
    string,
    { calls: number; input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number; total: number }
  > = {}
  for (const message of messages) {
    if (message.info.providerID !== providerID || message.info.modelID !== modelID) {
      throw new Error(
        `Task assistant ${String(message.info.id)} used ${String(message.info.providerID)}/${String(message.info.modelID)}, expected ${model}.`,
      )
    }
    const agent = String(message.info.agent || "unknown")
    const current = (byAgent[agent] ??= {
      calls: 0,
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    })
    const tokens = message.info.tokens ?? {}
    current.input += tokenValue(tokens.input)
    current.output += tokenValue(tokens.output)
    current.reasoning += tokenValue(tokens.reasoning)
    current.cacheRead += tokenValue(tokens.cache?.read)
    current.cacheWrite += tokenValue(tokens.cache?.write)
    current.total += tokenValue(tokens.total)
  }
  for (const providerRequest of taskRequests) {
    const message = messages.find((candidate) => candidate.info.id === providerRequest.assistant_message_id)
    if (!message) throw new Error(`Provider request ${providerRequest.id} lost its Task assistant Message.`)
    byAgent[String(message.info.agent || "unknown")]!.calls += 1
    const outcome = taskOutcomeByRequest.get(providerRequest.id)
    if (!outcome || outcome.outcome !== "done") {
      throw new Error(`Task Provider activity ${providerRequest.id} settled as ${JSON.stringify(outcome)}.`)
    }
  }
  const total = Object.values(byAgent).reduce(
    (sum, usage) => ({
      calls: sum.calls + usage.calls,
      input: sum.input + usage.input,
      output: sum.output + usage.output,
      reasoning: sum.reasoning + usage.reasoning,
      cacheRead: sum.cacheRead + usage.cacheRead,
      cacheWrite: sum.cacheWrite + usage.cacheWrite,
      total: sum.total + usage.total,
    }),
    { calls: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  )
  return { byAgent, total, requests: taskRequests, outcomes: taskOutcomes }
}

  const providerCatalog = await requestJSON("/provider")
  const provider = (providerCatalog.all as JsonObject[]).find((entry) => entry.id === providerID)
  const projectedModelIDs = Object.keys(provider?.models ?? {})
  const providerTestResponse = await request(`/provider/${encodeURIComponent(providerID)}/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelID }),
  })
  const providerTest = (await providerTestResponse.json()) as JsonObject
  if (
    !providerTestResponse.ok ||
    providerTest.ok !== true ||
    providerTest.status !== "connected" ||
    !projectedModelIDs.includes(modelID)
  ) {
    throw new Error(
      `Provider/model preflight failed: ${JSON.stringify({
        providerTest,
        providerProjected: Boolean(provider),
        requestedModelProjected: projectedModelIDs.includes(modelID),
      })}`,
    )
  }
  process.stdout.write(`[dynamic-e2e] provider=${model} connected\n`)

  const install = await requestJSON("/expert-squad/install-payload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "dynamic", installationScope: "project" }),
  })
  const installed = install.after as JsonObject
  if (
    installed.id !== "dynamic" ||
    installed.version !== generatedManifest.version ||
    typeof installed.packageDigest !== "string"
  ) {
    throw new Error(`Dynamic generated payload installation did not converge: ${JSON.stringify(install)}`)
  }

  const requestText = [
    "Use Dynamic to solve this focused read-only case with exactly two independent dynamic-generalist members in the first frontier and no Builder.",
    "Name one member orion-reader; it owns only evidence/orion.txt and must report both exact key/value lines with the file locator.",
    "Name the other member nebula-reader; it owns only evidence/nebula.txt and must report both exact key/value lines with the file locator.",
    "In the same dispatch_agents call, submit aligned team rows named orion-reader and nebula-reader with empty depends_on arrays, then submit both dispatches together. Do not inspect either evidence file in the Orchestrator and do not call read_task_message for this already-visible creator request.",
    "After both real Sessions finish, read their exact final messages, report ORION_CODE, ORION_COLOR, NEBULA_CODE, NEBULA_COLOR, and CODE_SUM=46, then complete the Task. Do not ask the operator a question and do not add review, synthesis, or repair members.",
  ].join("\n")
  const created = await requestJSON<{ task_id: string }>("/task?init-git=true", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Dynamic frontier reliability E2E",
      request: requestText,
      source: "dynamic-expert-squad-e2e",
      productPillar: "work",
      model,
      promptProfile: "dynamic",
    }),
  })
  const taskID = created.task_id
  process.stdout.write(`[dynamic-e2e] task=${taskID} package=${installed.packageDigest}\n`)

  let board: JsonObject = {}
  let transcript: TranscriptMessage[] = []
  let lastSignature = ""
  let inactivityDeadline = Date.now() + INACTIVITY_MS
  const totalDeadline = Date.now() + TOTAL_TIMEOUT_MS
  while (Date.now() < totalDeadline && Date.now() < inactivityDeadline) {
    ;[board, transcript] = await Promise.all([
      requestJSON(`/task/${taskID}/board`),
      requestJSON<TranscriptMessage[]>(`/task/${taskID}/transcript`),
    ])
    const interactions = await requestJSON<Array<{ id: string; status: string }>>(`/task/${taskID}/interactions`)
    const pending = interactions.filter((interaction) => interaction.status === "pending")
    if (pending.length > 0) throw new Error(`Dynamic E2E opened operator interactions: ${JSON.stringify(pending)}`)
    const tools = toolParts(transcript)
    const signature = JSON.stringify({
      status: board.task?.status,
      messages: transcript.map((message) => [message.info.id, message.info.time?.completed]),
      tools: tools.map((entry) => [entry.part.id, entry.part.tool, entry.part.state?.status]),
    })
    if (signature !== lastSignature) {
      lastSignature = signature
      inactivityDeadline = Date.now() + INACTIVITY_MS
      process.stdout.write(
        `[dynamic-e2e] status=${String(board.task?.status)} messages=${transcript.length} tools=${tools.length}\n`,
      )
    }
    if (["completed", "failed", "cancelled"].includes(String(board.task?.status))) break
    await Bun.sleep(POLL_MS)
  }
  if (board.task?.status !== "completed") {
    throw new Error(`Dynamic E2E did not complete: status=${String(board.task?.status)}.`)
  }

  const tools = toolParts(transcript)
  const outer = tools.filter(
    (entry) => entry.agent === "orchestrator" && entry.part.tool === "dispatch_agents" && entry.part.state?.status === "completed",
  )
  if (outer.length !== 1) throw new Error(`Expected one completed dispatch_agents frontier, observed ${outer.length}.`)
  const childDispatches = tools.filter(
    (entry) =>
      entry.messageID === outer[0]!.messageID &&
      entry.part.tool === "dispatch_agent" &&
      entry.part.state?.status === "completed",
  )
  if (childDispatches.length !== 2) {
    throw new Error(`Expected two completed child dispatch_agent occurrences, observed ${childDispatches.length}.`)
  }
  const targetIDs = childDispatches.map((entry) => entry.part.state.input?.dispatch?.target)
  if (JSON.stringify(targetIDs) !== JSON.stringify(["dynamic-generalist", "dynamic-generalist"])) {
    throw new Error(`Dynamic frontier used unexpected targets: ${JSON.stringify(targetIDs)}`)
  }
  const team = outer[0]!.part.state.input?.team
  if (!Array.isArray(team) || team.length !== 2) {
    throw new Error(`Visible frontier Tool input has an invalid structured team: ${JSON.stringify(team)}`)
  }
  const teamProjection = team.map((member: JsonObject) => ({
    name: member.name,
    target: member.target,
    depends_on: member.depends_on,
    responsibility: member.responsibility,
    boundary: member.boundary,
    expected_result: member.expected_result,
  }))
  if (
    JSON.stringify(teamProjection.map((member) => [member.name, member.target, member.depends_on])) !==
    JSON.stringify([
      ["orion-reader", "dynamic-generalist", []],
      ["nebula-reader", "dynamic-generalist", []],
    ])
  ) {
    throw new Error(`Visible frontier structured team is not the requested ready set: ${JSON.stringify(teamProjection)}`)
  }
  for (const member of teamProjection) {
    for (const field of ["responsibility", "boundary", "expected_result"] as const) {
      if (typeof member[field] !== "string" || member[field].trim().length === 0) {
        throw new Error(`Visible frontier team member ${String(member.name)} has no ${field}.`)
      }
    }
  }

  const outerStarted = tokenValue(outer[0]!.part.state?.time?.start)
  const earlierOrchestratorTools = tools.filter(
    (entry) =>
      entry.agent === "orchestrator" &&
      tokenValue(entry.part.state?.time?.start) < outerStarted &&
      entry.part.tool !== "dispatch_agents",
  )
  if (earlierOrchestratorTools.length > 0) {
    throw new Error(
      `Orchestrator used Tools before the first frontier even though the creator request was already visible: ${earlierOrchestratorTools.map((entry) => entry.part.tool).join(", ")}`,
    )
  }

  const childReceipts = childDispatches.map((entry) => JSON.parse(String(entry.part.state.output)) as JsonObject)
  if (childReceipts.some((receipt) => receipt.kind !== "accepted" || typeof receipt.session_id !== "string")) {
    throw new Error(`Dynamic child receipts are not accepted Session identities: ${JSON.stringify(childReceipts)}`)
  }
  const childSessionIDs = childReceipts.map((receipt) => String(receipt.session_id))
  if (new Set(childSessionIDs).size !== 2) throw new Error("Dynamic frontier did not create two distinct Sessions.")
  const finalWorkerMessages = await Promise.all(
    childReceipts.map(async (receipt) => {
      const sessionID = String(receipt.session_id)
      const lineage = findDispatchLineageBySession({ taskID, sessionID })
      if (!lineage || lineage.artifactID !== receipt.dispatch_lineage_id) {
        throw new Error(
          `Worker Session ${sessionID} accepted receipt does not match its immutable dispatch lineage.`,
        )
      }
      const descriptor = WorkerTurnDescriptor.findForDispatch({
        sessionID,
        dispatchID: lineage.dispatchID,
      })
      if (!descriptor || descriptor.payload.lifecycle.taskID !== taskID) {
        throw new Error(`Worker Session ${sessionID} has no Task-owned Worker Turn descriptor.`)
      }
      const inputMessageID = descriptor.payload.messageAuthority.user_message_id
      const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
        sessionID,
        "agent.execution.lifecycle",
        inputMessageID,
      )
      const canonicalReply = await SessionLoop.completedReplyToUserMessage(sessionID, inputMessageID, false)
      return requireAuthoritativeCompletedWorkerFinalMessage({
        sessionID,
        inputMessageID,
        lifecycle,
        canonicalFinalMessageID: canonicalReply?.info.id,
        messages: transcript,
      })
    }),
  )
  const finalWorkerRefs = new Map(
    finalWorkerMessages.map((message) => [`${message.info.sessionID}:${message.info.id}`, message]),
  )
  const exactMessageReads = tools.filter(
    (entry) =>
      entry.agent === "orchestrator" &&
      entry.part.tool === "read_agent_message" &&
      entry.part.state?.status === "completed" &&
      [...finalWorkerRefs.values()].some((message) => message.info.id === entry.part.state.input?.message_id),
  )
  const readRefs = new Set(
    exactMessageReads.map((entry) => {
      const message = [...finalWorkerRefs.values()].find(
        (candidate) => candidate.info.id === entry.part.state.input?.message_id,
      )
      return `${message!.info.sessionID}:${message!.info.id}`
    }),
  )
  if (readRefs.size !== finalWorkerRefs.size) {
    throw new Error(
      `Orchestrator did not read every exact worker final message: expected=${JSON.stringify([...finalWorkerRefs.keys()])} observed=${JSON.stringify([...readRefs])}`,
    )
  }
  const completedTaskDecisions = tools.filter(
    (entry) =>
      entry.agent === "orchestrator" &&
      entry.part.tool === "manage_task" &&
      entry.part.state?.status === "completed" &&
      entry.part.state.input?.action === "complete_task",
  )
  if (completedTaskDecisions.length !== 1) {
    throw new Error(`Expected one completed complete_task decision, observed ${completedTaskDecisions.length}.`)
  }
  const completionSummary = String(completedTaskDecisions[0]!.part.state.input?.summary ?? "")
  const completionEvidenceRefs = new Set(
    (completedTaskDecisions[0]!.part.state.input?.evidence_locators ?? [])
      .filter((locator: JsonObject) => locator?.source === "session_message")
      .map((locator: JsonObject) => `${locator.session_id}:${locator.message_id}`),
  )
  if (
    completionEvidenceRefs.size !== finalWorkerRefs.size ||
    [...finalWorkerRefs.keys()].some((reference) => !completionEvidenceRefs.has(reference))
  ) {
    throw new Error(
      `Task completion did not bind every exact worker final Message: expected=${JSON.stringify([...finalWorkerRefs.keys()])} observed=${JSON.stringify([...completionEvidenceRefs])}`,
    )
  }
  for (const required of [
    "ORION_CODE=17",
    "ORION_COLOR=amber",
    "NEBULA_CODE=29",
    "NEBULA_COLOR=violet",
    "CODE_SUM=46",
  ]) {
    if (!completionSummary.includes(required)) {
      throw new Error(`Dynamic completion summary is missing exact fact ${required}.`)
    }
  }

  const operatorCorrections = transcript.filter(
    (message) =>
      message.info.extra?.operator_steer ||
      message.info.extra?.task_root_message?.origin === "operator_steer" ||
      message.info.extra?.task_root_message?.kind === "operator_steer",
  )
  if (operatorCorrections.length > 0) {
    throw new Error(`Dynamic E2E required operator correction: ${operatorCorrections.map((message) => message.info.id)}`)
  }

  const usage = usageFromTaskTranscript(transcript)
  const providerOverlap = requireCrossSessionProviderExecutionOverlap({
    sessionIDs: childSessionIDs,
    messages: transcript.map((message) => ({ id: String(message.info.id), sessionID: String(message.info.sessionID) })),
    requests: usage.requests,
    outcomes: usage.outcomes,
  })
  const orchestratorUsage = usage.byAgent.orchestrator
  if (!orchestratorUsage) throw new Error("Dynamic E2E has no Orchestrator Provider usage.")
  const reduction = 1 - usage.total.total / FAILED_BASELINE_TOKENS
  if (usage.total.total > MAX_TASK_TOKENS) {
    throw new Error(`Dynamic Task token budget exceeded: ${usage.total.total} > ${MAX_TASK_TOKENS}.`)
  }
  if (orchestratorUsage.total > MAX_ORCHESTRATOR_TOKENS) {
    throw new Error(
      `Dynamic Orchestrator token budget exceeded: ${orchestratorUsage.total} > ${MAX_ORCHESTRATOR_TOKENS}.`,
    )
  }
  if (reduction < MIN_REDUCTION) {
    throw new Error(`Dynamic token reduction ${(reduction * 100).toFixed(2)}% is below ${MIN_REDUCTION * 100}%.`)
  }

  const result = {
    ok: true,
    runID,
    model,
    taskID,
    package: {
      namespace: "builtin",
      id: "dynamic",
      version: installed.version,
      digest: installed.packageDigest,
      generatedPayloadVerified: true,
    },
    timing: {
      durationMs: Date.now() - startedAt,
      workerProviderActivities: providerOverlap.activities,
      overlapMs: providerOverlap.overlapMs,
    },
    frontier: {
      outerToolPartID: outer[0]!.part.id,
      childToolPartIDs: childDispatches.map((entry) => entry.part.id),
      childSessionIDs,
      targets: targetIDs,
      exactWorkerFinalMessageReads: exactMessageReads.map((entry) => entry.part.id),
      completionEvidenceRefs: [...completionEvidenceRefs],
      operatorCorrections: 0,
      structuredTeam: teamProjection,
      orchestratorToolsBeforeFrontier: earlierOrchestratorTools.map((entry) => entry.part.tool),
      orchestratorNonControlToolsBeforeFrontier: 0,
      orchestratorSkillLoadsBeforeFrontier: 0,
    },
    facts: {
      orionCode: 17,
      orionColor: "amber",
      nebulaCode: 29,
      nebulaColor: "violet",
      codeSum: 46,
    },
    usage: {
      baselineTotalTokens: FAILED_BASELINE_TOKENS,
      thresholds: {
        maxTaskTokens: MAX_TASK_TOKENS,
        maxOrchestratorTokens: MAX_ORCHESTRATOR_TOKENS,
        minimumReduction: MIN_REDUCTION,
      },
      reduction,
      byAgent: usage.byAgent,
      total: usage.total,
    },
  }
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
  process.stdout.write(`[dynamic-e2e] PASS result=${resultPath} tokens=${usage.total.total}\n`)
} catch (error) {
  primaryFailure = error
  process.stderr.write(`[dynamic-e2e] failure=${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
} finally {
  const cleanupFailures: unknown[] = []
  try {
    await runtime.ProcessSupervisor?.disposeLiveProcessesUnder(projectDirectory)
  } catch (error) {
    cleanupFailures.push(error)
  }
  try {
    await runtime.server?.stop(true)
  } catch (error) {
    cleanupFailures.push(error)
    try {
      await runtime.Instance?.disposeAll()
    } catch (disposeError) {
      cleanupFailures.push(disposeError)
    }
  }
  try {
    runtime.Database?.close()
  } catch (error) {
    cleanupFailures.push(error)
  }
  for (const file of [path.join(runtimeRoot, "data", "auth.json"), path.join(runtimeRoot, "data", "models.json")]) {
    try {
      await fs.rm(file, { force: true })
    } catch (error) {
      cleanupFailures.push(error)
    }
  }
  if (!primaryFailure) {
    try {
      await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    } catch (error) {
      cleanupFailures.push(error)
    }
  } else {
    process.stderr.write(`[dynamic-e2e] retained failure root=${root}\n`)
  }
  if (primaryFailure && cleanupFailures.length > 0) {
    throw new AggregateError([primaryFailure, ...cleanupFailures], "Dynamic E2E failed during cleanup")
  }
  if (primaryFailure) throw primaryFailure
  if (cleanupFailures.length > 0) throw new AggregateError(cleanupFailures, "Dynamic E2E cleanup failed")
}
