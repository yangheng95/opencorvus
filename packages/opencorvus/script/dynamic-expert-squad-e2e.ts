import { createHash, randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import { RealProviderAudit, CredentialRedactor } from "./real-provider-audit"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"
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
const POLL_MS = 500
const INACTIVITY_MS = 180_000

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
const maxRequests = Number(process.env.DYNAMIC_EXPERT_SQUAD_E2E_MAX_REQUESTS ?? "128")
if (!Number.isSafeInteger(maxRequests) || maxRequests <= 0) throw new Error("Request budget must be a positive integer")
const supervisor = prepareTestProcessSupervisor()
const isolated = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolated)
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
using audit = new RealProviderAudit(modelID, maxRequests)
const redactor = new CredentialRedactor()
redactor.collect(process.env)
const runID = randomBytes(8).toString("hex")
const root = await fs.mkdtemp(path.join(os.tmpdir(), `opencorvus-dynamic-e2e-${runID}-`))
const runtimeRoot = path.join(root, "runtime")
const projectDirectory = path.join(root, "project")
const resultPath = process.env[RESULT]?.trim()
  ? path.resolve(process.env[RESULT]!.trim())
  : path.join(root, "result.json")
const startedAt = Date.now()
const runtime: {
  server?: { stop(force?: boolean): Promise<void> }
  Database?: { close(): void }
  Instance?: { disposeAll(): Promise<void> }
  ProcessSupervisor?: { disposeLiveProcessesUnder(directory: string): Promise<unknown> }
} = {}
let primaryFailure: unknown
let result: JsonObject = { status: "running", model, maxRequests, evidenceRoot: root }

type JsonObject = Record<string, any>
type TranscriptMessage = { info: JsonObject & { id: string; sessionID: string; role: string }; parts: JsonObject[] }

function requiredGeneratedDynamicPackage() {
  const source = payloadPackageSources.find((entry) => entry.namespace === "builtin" && entry.id === "dynamic")
  if (!source) throw new Error("Generated Expert Squad payload does not contain builtin/dynamic.")
  const manifestText = source.files["expert-squad.jsonc"]
  if (typeof manifestText !== "string") throw new Error("Generated builtin/dynamic payload has no manifest bytes.")
  const manifest = Bun.JSONC.parse(manifestText) as JsonObject
  if (manifest.id !== "dynamic" || manifest.schema_version !== 2 || typeof manifest.version !== "string") {
    throw new Error("Generated Dynamic manifest violates the current package identity contract")
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
    fs.writeFile(path.join(projectDirectory, "evidence", "orion.txt"), "ORION_CODE=17\nORION_COLOR=amber\n", "utf8"),
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
  redactor.collect(JSON.parse(await fs.readFile(source, "utf8")))
  await Promise.all([
    fs.copyFile(source, path.join(dataDirectory, "auth.json")),
    fs.copyFile(catalogSource, path.join(dataDirectory, "models.json")),
  ])
}

try {
  const repositoryRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  const patch = execFileSync(
    "git",
    [
      "diff",
      "HEAD",
      "--",
      "packages/opencorvus/src",
      "packages/opencorvus/script",
      "packages/opencorvus/native",
      "expert-squads",
    ],
    { cwd: repositoryRoot },
  )
  result = {
    ...result,
    sourceSHA: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim(),
    sourceDiffSHA256: createHash("sha256").update(patch).digest("hex"),
    checkerSHA256: createHash("sha256")
      .update(await fs.readFile(import.meta.filename))
      .digest("hex"),
    auditSHA256: createHash("sha256")
      .update(await fs.readFile(path.join(import.meta.dir, "real-provider-audit.ts")))
      .digest("hex"),
    runtime: { executable: process.execPath, bun: Bun.version },
  }
  await fs.writeFile(path.join(root, "source.patch"), patch)
  await fs.writeFile(path.join(root, "run.json"), JSON.stringify(result, null, 2))
  process.stdout.write(`[dynamic-e2e] evidence=${resultPath}\n`)
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
    { findDispatchLineageByCollectionMember },
    {
      PersistedDispatchAgentsInputSchema,
      PersistedDispatchCollectionMemberInputSchema,
      DispatchCollectionMemberResultSchema,
    },
    { ProtocolStore },
    { completedReplyToUserMessage },
    { SessionStatus },
  ] = await Promise.all([
    import("@/cli/server-runtime"),
    import("@/engine/host-recovery"),
    import("@/project/instance"),
    import("@/storage/db"),
    import("@/session/session.sql"),
    import("@/shell/process-supervisor"),
    import("@/agent/worker-turn-descriptor"),
    import("@/engine/dispatch-lineage"),
    import("@/engine/dispatch-collection-contract"),
    import("@/protocol/store"),
    import("@/session/completed-reply"),
    import("@/session/status"),
  ])
  runtime.Database = Database
  runtime.Instance = Instance
  runtime.ProcessSupervisor = ProcessSupervisor

  const prepared = await requireRecoveredServerRuntime(
    await listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions())
      },
      disposeInstances: () => Instance.disposeAll(),
    }),
  )
  const server = prepared.server
  runtime.server = server
  const base = server.url.toString().replace(/\/$/, "")
  audit.localOrigins.add(server.url.origin)
  result.serverURL = base

  async function request(route: string, init: RequestInit = {}) {
    const url = new URL(route, base)
    if (!url.searchParams.has("directory")) url.searchParams.set("directory", projectDirectory)
    const headers = new Headers(init.headers)
    headers.set("x-opencorvus-directory", projectDirectory)
    headers.set("x-opencorvus-request-id", crypto.randomUUID())
    return await fetch(url, { ...init, headers, signal: AbortSignal.timeout(30_000) })
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
          ? [
              {
                messageID: String(message.info.id),
                sessionID: String(message.info.sessionID),
                agent: String(message.info.agent),
                part,
              },
            ]
          : [],
      ),
    )
  }

  function tokenValue(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw new Error("Provider usage evidence is unavailable or invalid")
    return value
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
      {
        calls: number
        input: number
        output: number
        reasoning: number
        cacheRead: number
        cacheWrite: number
        total: number
      }
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
  if (!projectedModelIDs.includes(modelID))
    throw new Error("Authorized model is missing from the isolated catalog projection")
  result.preflight = await audit.preflight({
    serverURL: server.url,
    model,
    inactivityMs: INACTIVITY_MS,
    activity: SessionStatus.getActivity,
  })
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
    "Each member must use the read Tool to observe its assigned file and preserve the file unchanged.",
    "In the same dispatch_agents call, submit aligned team rows named orion-reader and nebula-reader with empty depends_on arrays, then submit both dispatches together. Do not inspect either evidence file in the Orchestrator and do not call read_task_message for this already-visible creator request.",
    "After both real Sessions finish, read their exact final messages, report ORION_CODE, ORION_COLOR, NEBULA_CODE, NEBULA_COLOR, and CODE_SUM=46, then complete the Task. Do not ask the operator a question and do not add review, synthesis, or repair members.",
  ].join("\n")
  result.request = requestText
  result.scenarioSHA256 = createHash("sha256").update(requestText).digest("hex")
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
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
  result.taskID = taskID
  process.stdout.write(`[dynamic-e2e] task=${taskID} package=${installed.packageDigest}\n`)

  let board: JsonObject = {}
  let transcript: TranscriptMessage[] = []
  let lastSignature = ""
  let inactivityDeadline = Date.now() + INACTIVITY_MS
  while (Date.now() < inactivityDeadline) {
    if (audit.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
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
      activity: [...new Set(transcript.map((message) => String(message.info.sessionID)))].map((id) => ({
        id,
        activity: SessionStatus.getActivity(id),
        status: SessionStatus.get(id),
      })),
    })
    if (signature !== lastSignature) {
      lastSignature = signature
      inactivityDeadline = Date.now() + INACTIVITY_MS
    }
    await fs.writeFile(
      resultPath,
      JSON.stringify(
        {
          ...result,
          requests: audit.requests,
          observation: { taskStatus: board.task?.status, messages: transcript.length, tools: tools.length },
        },
        null,
        2,
      ),
    )
    if (["completed", "failed", "cancelled"].includes(String(board.task?.status))) break
    await Bun.sleep(POLL_MS)
  }
  if (board.task?.status !== "completed") {
    throw new Error(`Dynamic E2E did not complete: status=${String(board.task?.status)}.`)
  }

  const tools = toolParts(transcript)
  const outer = tools.filter(
    (entry) =>
      entry.agent === "orchestrator" &&
      entry.part.tool === "dispatch_agents" &&
      entry.part.state?.status === "completed",
  )
  if (outer.length !== 1) throw new Error(`Expected one completed dispatch_agents frontier, observed ${outer.length}.`)
  const collectionInput = PersistedDispatchAgentsInputSchema.parse(outer[0]!.part.state.input)
  const dispatches = PersistedDispatchCollectionMemberInputSchema.array().length(2).parse(collectionInput.dispatches)
  const collectionOutput = JSON.parse(String(outer[0]!.part.state.output))
  const members = DispatchCollectionMemberResultSchema.array()
    .length(2)
    .parse(collectionOutput.members)
    .sort((a, b) => a.member_index - b.member_index)
  if (
    collectionInput.dispatches.length !== 2 ||
    members.some(
      (member, index) =>
        member.member_index !== index ||
        member.name !== collectionInput.team[index]?.name ||
        member.target !== dispatches[index]?.dispatch.target,
    )
  ) {
    throw new Error("Collection members do not match the exact two-member visible frontier")
  }
  const targetIDs = dispatches.map((entry) => entry.dispatch.target)
  if (JSON.stringify(targetIDs) !== JSON.stringify(["dynamic-generalist", "dynamic-generalist"])) {
    throw new Error(`Dynamic frontier used unexpected targets: ${JSON.stringify(targetIDs)}`)
  }
  const team = collectionInput.team
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
    throw new Error(
      `Visible frontier structured team is not the requested ready set: ${JSON.stringify(teamProjection)}`,
    )
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

  const childReceipts = members.map((member) => {
    if (member.status !== "completed" || member.outcome.kind !== "accepted") {
      throw new Error(`Collection member ${member.member_index} did not return an accepted worker`)
    }
    return member.outcome
  })
  const childSessionIDs = childReceipts.map((receipt) => String(receipt.session_id))
  if (new Set(childSessionIDs).size !== 2) throw new Error("Dynamic frontier did not create two distinct Sessions.")
  const workerReads = await Promise.all(
    [
      { file: "evidence/orion.txt", content: "ORION_CODE=17\nORION_COLOR=amber\n" },
      { file: "evidence/nebula.txt", content: "NEBULA_CODE=29\nNEBULA_COLOR=violet\n" },
    ].map(async (expected, memberIndex) => {
      const expectedPath = await fs.realpath(path.join(projectDirectory, expected.file))
      if ((await fs.readFile(expectedPath, "utf8")) !== expected.content) {
        throw new Error(`Read-only evidence changed: ${expected.file}`)
      }
      const reads: string[] = []
      for (const entry of tools) {
        if (
          entry.part.tool !== "read" ||
          entry.part.state?.status !== "completed" ||
          typeof entry.part.state.input?.filePath !== "string"
        )
          continue
        const resolved = path.resolve(projectDirectory, entry.part.state.input.filePath)
        const actualPath = await fs.realpath(resolved).catch(() => undefined)
        if (actualPath !== expectedPath) continue
        if (entry.sessionID !== childSessionIDs[memberIndex]) {
          throw new Error(`Evidence ${expected.file} was read by Session ${entry.sessionID} outside its assigned owner`)
        }
        if (
          expected.content
            .trim()
            .split("\n")
            .every((line) => String(entry.part.state.output).includes(line))
        ) {
          reads.push(entry.part.id)
        }
      }
      if (reads.length === 0)
        throw new Error(`Worker ${childSessionIDs[memberIndex]} has no exact read result for ${expected.file}`)
      return {
        file: expected.file,
        sessionID: childSessionIDs[memberIndex],
        readToolPartIDs: reads,
        contentSHA256: createHash("sha256").update(expected.content).digest("hex"),
      }
    }),
  )
  const finalWorkerMessages = await Promise.all(
    childReceipts.map(async (receipt, memberIndex) => {
      const sessionID = String(receipt.session_id)
      const lineage = findDispatchLineageByCollectionMember({
        taskID,
        toolPartID: outer[0]!.part.id,
        toolCallID: outer[0]!.part.callID,
        memberIndex,
        memberCount: members.length,
      })
      if (
        !lineage ||
        lineage.artifactID !== receipt.dispatch_lineage_id ||
        lineage.payload.child_session_id !== sessionID
      ) {
        throw new Error(`Worker Session ${sessionID} accepted receipt does not match its immutable dispatch lineage.`)
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
      const canonicalReply = await completedReplyToUserMessage(sessionID, inputMessageID, false)
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
      Array.isArray(entry.part.state.input?.message_ids) &&
      [...finalWorkerRefs.values()].some((message) => entry.part.state.input.message_ids.includes(message.info.id)),
  )
  const readRefs = new Set(
    exactMessageReads.flatMap((entry) =>
      [...finalWorkerRefs.values()]
        .filter((message) => entry.part.state.input.message_ids.includes(message.info.id))
        .map((message) => `${message.info.sessionID}:${message.info.id}`),
    ),
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
    throw new Error(
      `Dynamic E2E required operator correction: ${operatorCorrections.map((message) => message.info.id)}`,
    )
  }

  const usage = usageFromTaskTranscript(transcript)
  const providerOverlap = requireCrossSessionProviderExecutionOverlap({
    sessionIDs: childSessionIDs,
    messages: transcript.map((message) => ({ id: String(message.info.id), sessionID: String(message.info.sessionID) })),
    requests: usage.requests,
    outcomes: usage.outcomes,
  })
  result = {
    ...result,
    status: "passed",
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
      members,
      childSessionIDs,
      workerReads,
      targets: targetIDs,
      exactWorkerFinalMessageReads: exactMessageReads.map((entry) => entry.part.id),
      completionEvidenceRefs: [...completionEvidenceRefs],
      operatorCorrections: 0,
      structuredTeam: teamProjection,
      orchestratorToolsBeforeFrontier: earlierOrchestratorTools.map((entry) => entry.part.tool),
    },
    facts: {
      orionCode: 17,
      orionColor: "amber",
      nebulaCode: 29,
      nebulaColor: "violet",
      codeSum: 46,
    },
    usage: {
      byAgent: usage.byAgent,
      total: usage.total,
    },
  }
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
  process.stdout.write(`[dynamic-e2e] functional checks passed; cleanup pending, tokens=${usage.total.total}\n`)
} catch (error) {
  primaryFailure = error
} finally {
  const cleanupFailures: unknown[] = []
  try {
    await runtime.ProcessSupervisor?.disposeLiveProcessesUnder(projectDirectory)
  } catch (error) {
    cleanupFailures.push(error)
  }
  for (const cleanup of [() => runtime.server?.stop(true), () => runtime.Instance?.disposeAll()]) {
    try {
      await cleanup()
    } catch (error) {
      cleanupFailures.push(error)
    }
  }
  try {
    runtime.Database?.close()
  } catch (error) {
    cleanupFailures.push(error)
  }
  try {
    redactor.collect(JSON.parse(await fs.readFile(path.join(runtimeRoot, "data/auth.json"), "utf8")))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") cleanupFailures.push(error)
  }
  const credentialErrors: unknown[] = []
  for (const file of [path.join(runtimeRoot, "data", "auth.json"), path.join(runtimeRoot, "data", "models.json")]) {
    try {
      await fs.rm(file, { force: true })
    } catch (error) {
      credentialErrors.push(error)
    }
  }
  cleanupFailures.push(...credentialErrors)
  result.requests = audit.requests
  result.credentialCleanup = credentialErrors.length ? "failed" : "passed"
  result.cleanupErrors = cleanupFailures.map(String)
  if (primaryFailure || cleanupFailures.length || audit.exhausted) {
    result.status = audit.exhausted ? "budget_exhausted" : "failed"
    result.error =
      primaryFailure instanceof Error
        ? primaryFailure.message
        : primaryFailure
          ? String(primaryFailure)
          : audit.exhausted
            ? "E2E_REQUEST_BUDGET_EXHAUSTED"
            : "Owned runtime cleanup failed"
  }
  result.ok = result.status === "passed"
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, redactor.redact(JSON.stringify(result, null, 2)) + "\n", "utf8")
  process.stdout.write(`[dynamic-e2e] ${result.status} evidence=${resultPath}\n`)
  if (result.status !== "passed") process.exitCode = 1
}
