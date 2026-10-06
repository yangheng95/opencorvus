/**
 * Real production Task acceptance for eight causal evidence chunks.
 * READ_AGENT_MESSAGE_E2E_ALLOW_REAL_PROVIDER=1, AUTH_SOURCE=<paired auth.json>,
 * MODEL=<provider/model> are required with the READ_AGENT_MESSAGE_E2E_ prefix.
 * Optional RESULT and MAX_REQUESTS (default 256). Inactivity is 180 seconds;
 * there is no wall-clock execution deadline. Only this isolated runtime is owned.
 */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { randomBytes } from "node:crypto"
import { execFileSync } from "node:child_process"
import {
  bootstrapIsolatedTestRuntime,
  applyIsolatedTestUserEnvironment,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"
import { assertCopiedOAuthAccess, CredentialRedactor, RealProviderAudit } from "./real-provider-audit"
import { readerCompletionReferences, readerSchemaObservationOrder } from "./read-agent-message-e2e-contract"

const prefix = "READ_AGENT_MESSAGE_E2E_"
assert.equal(process.env[`${prefix}ALLOW_REAL_PROVIDER`], "1", "Explicit real Provider authorization is required")
const authSource = process.env[`${prefix}AUTH_SOURCE`]?.trim()
const model = process.env[`${prefix}MODEL`]?.trim()
assert(authSource && model && model.indexOf("/") > 0, "Paired auth source and exact Provider/model are required")
const maxRequests = Number(process.env[`${prefix}MAX_REQUESTS`] ?? "256")
assert(Number.isSafeInteger(maxRequests) && maxRequests > 0, "Request budget must be a positive integer")
const resultTarget = process.env[`${prefix}RESULT`]?.trim()
const inactivityMs = 180_000
const supervisor = prepareTestProcessSupervisor()
const isolated = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolated)
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-evidence-reader-e2e-"))
const runtimeRoot = path.join(root, "runtime")
const projectDirectory = path.join(root, "project")
const resultPath = resultTarget ? path.resolve(resultTarget) : path.join(root, "result.json")
const nonce = `READER-${randomBytes(5).toString("hex")}`
const markers = ["A", "B", "C", "D"].map((suffix) => `${nonce}-${suffix}`)
const redactor = new CredentialRedactor()
redactor.collect(process.env)
let audit: RealProviderAudit | undefined
const requestObservationTimes: number[] = []
let cleanup: (() => Promise<void>) | undefined
let dumpEvidence: (() => Promise<void>) | undefined
let failure: unknown
let evidence: Record<string, unknown> = {}
for (const key of [
  "OPENCORVUS_API_KEY",
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
  "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
])
  delete process.env[key]
process.env.OPENCORVUS_HOME = runtimeRoot
process.env.OPENCORVUS_TEST_HOME = runtimeRoot
process.env.OPENCORVUS_TEST_PROCESS_ROOT = root
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({ permission_mode: "full_access", model, small_model: model })
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"

using auditLifetime = new DisposableStack()
try {
  await fs.mkdir(projectDirectory, { recursive: true })
  await fs.writeFile(path.join(projectDirectory, "README.md"), "# Real causal evidence reader acceptance\n")
  for (const args of [
    ["init"],
    ["config", "user.name", "OpenCorvus Evidence Acceptance"],
    ["config", "user.email", "evidence@opencorvus.invalid"],
    ["add", "README.md"],
    ["commit", "-m", "test: initialize causal evidence project"],
  ]) {
    execFileSync("git", args, { cwd: projectDirectory, stdio: "ignore" })
  }
  await fs.mkdir(path.join(runtimeRoot, "data"), { recursive: true })
  redactor.collect(JSON.parse(await fs.readFile(authSource, "utf8")))
  for (const name of ["auth.json", "models.json"]) {
    await fs.copyFile(path.join(path.dirname(authSource), name), path.join(runtimeRoot, "data", name))
  }
  const { Auth } = await import("@/auth")
  const [providerID, ...modelParts] = model.split("/")
  const modelID = modelParts.join("/")
  const credential = await Auth.get(providerID)
  assert(credential, "Canonical isolated Provider authorization must be present")
  const authority = credential.type === "oauth" ? { copiedOAuthExpiresAt: credential.expires } : undefined
  if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
  const { ReadAgentMessageInputSchema, ReadAgentMessageTestHooks } = await import("@/tool/read-agent-message")
  const observed = auditLifetime.use(new RealProviderAudit(
    modelID,
    maxRequests,
    () => {
      // RealProviderAudit calls this synchronously after adding each request,
      // before native fetch. Response-status updates retain its first observation.
      while (audit && requestObservationTimes.length < audit.requests.length) requestObservationTimes.push(Date.now())
    },
    authority,
    {
      redactor,
      probes: [{ id: "reader-budget-schema", text: ReadAgentMessageTestHooks.evidenceReadsDescription }],
    },
  ))
  audit = observed
  const [
    { Instance },
    { Database, eq },
    { Provider },
    { SessionStatus },
    { EngineTaskTable },
    { readTaskDurableActivityScope },
    { projectTaskRowInTransaction },
    { projectToolPartInTransaction },
    { taskLifecycleProjection },
    { MessageStore },
    { CompactionToolResultReader },
    { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime },
    { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded },
    { listOwnedPromptSessionsForTask },
    { Message },
  ] = await Promise.all([
    import("@/project/instance"),
    import("@/storage/db"),
    import("@/provider/provider"),
    import("@/session/status"),
    import("@/engine/engine.sql"),
    import("@/engine/durable-activity"),
    import("@/engine/store"),
    import("@/session/tool-part-facts"),
    import("@/engine/task-lifecycle"),
    import("@/session/message-store"),
    import("@/session/compaction-tool-result-reader"),
    import("@/cli/server-runtime"),
    import("@/engine/host-recovery"),
    import("@/engine/runtime"),
    import("@/session/message"),
  ])
  cleanup = async () => {
    await Instance.disposeAll()
    Database.close()
  }
  await Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      assert.equal((await Provider.getModel(providerID, modelID)).api.id, modelID)
    },
  })
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
  observed.localOrigins.add(server.url.origin)
  cleanup = async () => {
    await server.stop(true)
    await Instance.disposeAll()
    Database.close()
  }
  evidence.preflight = await observed.preflight({
    serverURL: server.url,
    model,
    inactivityMs,
    activity: SessionStatus.getActivity,
  })
  const prompt = [
    `Prove actual causal Tool evidence transfer for ${nonce}. This is a small read-only execution and independent historical-evidence verification task.`,
    `An execution worker must perform four separate shell Tool invocations, each printing exactly one of these distinct markers: ${markers.join(", ")}. After those four actual executions, the worker finishes and reports its real evidence. No repository change or extra deliverable file is requested.`,
    "A different real participant (the coordinator may verify) must inspect that worker's settled dispatch_result through the production read_agent_message Tool. Discover exact Message/Part identities from its actual causal inventory. In one evidence_reads call, obtain eight chunks: the input and output fields of each of the four shell occurrences. Choose your own offsets and limits using the published Tool schema.",
    "Verify and report every original command and exact output marker from those historical fields. Rerunning commands, reading files or trusting the worker narrative alone does not satisfy this evidence-transfer request. Do not fabricate Message IDs, Tool outputs or source locators.",
    "Complete the Task only after actual eight-field reading succeeds. The final visible report must include all four markers and the exact producing participant Message references; retain those real producer and verification references in the Completion Decision. The independent reader's own report should state its exact source and read Tool Part identity.",
  ].join("\n")
  evidence.operatorPrompt = prompt
  const createURL = new URL("/task", server.url)
  createURL.searchParams.set("directory", projectDirectory)
  createURL.searchParams.set("init-git", "false")
  const response = await fetch(createURL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productPillar: "code",
      promptProfile: "base",
      title: "Eight causal evidence chunks",
      request: prompt,
      requestID: nonce,
      model,
    }),
  })
  assert(response.ok, `Task creation returned HTTP ${response.status}`)
  const { task_id: taskID } = (await response.json()) as { task_id: string }
  evidence.taskID = taskID
  process.stdout.write(`[reader-e2e] task=${taskID} root=${root} result=${resultPath}\n`)
  const snapshot = () =>
    Database.use((db) => {
      const row = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
      assert(row, "The accepted Task must exist")
      const scope = readTaskDurableActivityScope(db, projectTaskRowInTransaction(db, row))
      return { ...scope, tools: scope.toolRequests.map((request) => projectToolPartInTransaction(db, request)!) }
    })
  dumpEvidence = async () => {
    const current = snapshot()
    await fs.writeFile(
      path.join(root, "task-evidence.json"),
      redactor.redact(
        JSON.stringify(
          {
            messages: current.messages,
            parts: current.parts,
            toolRequests: current.toolRequests,
            toolOutcomes: current.toolOutcomes,
            artifacts: current.artifacts,
          },
          null,
          2,
        ),
      ),
    )
  }
  let lastActivity = Date.now()
  let lastKey = ""
  let settled: ReturnType<typeof snapshot> | undefined
  while (Date.now() - lastActivity <= inactivityMs) {
    if (observed.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
    const current = snapshot()
    const lifecycle = taskLifecycleProjection(taskID)
    const activityKey = JSON.stringify({
      durable: current.latest,
      sessions: current.sessions.map((session) => ({
        id: session.id,
        activity: SessionStatus.getActivity(session.id),
      })),
    })
    if (lastKey !== activityKey) {
      lastKey = activityKey
      lastActivity = Date.now()
    }
    const summary = {
      lifecycle: lifecycle.status,
      tools: current.tools.map((part) => ({
        id: part.id,
        tool: part.tool,
        status: part.state.status,
        ...(part.state.status === "error" ? { failure: part.state.failure } : {}),
      })),
    }
    evidence.latest = summary
    await fs.writeFile(
      path.join(root, "progress.json"),
      redactor.redact(
        JSON.stringify({ ...summary, observedRequests: observed.requests.length, observedAt: Date.now() }),
      ),
    )
    if (["completed", "failed", "cancelled"].includes(lifecycle.status)) {
      assert.equal(lifecycle.status, "completed", "The real Task must complete its requested evidence transfer")
      if (listOwnedPromptSessionsForTask(taskID).length === 0) {
        settled = current
        break
      }
    }
    await Bun.sleep(500)
  }
  assert(settled, "EVIDENCE_READER_INACTIVITY")
  await dumpEvidence()
  const candidates = settled.tools.filter(
    (part) => part.tool === "read_agent_message" && part.state.status === "completed",
  )
  const candidate = candidates.find(
    (part) => ReadAgentMessageInputSchema.parse(part.state.input).evidence_reads?.length === 8,
  )
  assert(candidate && candidate.state.status === "completed", "A real completed eight-field reader call is required")
  const input = ReadAgentMessageInputSchema.parse(candidate.state.input)
  const output = JSON.parse(candidate.state.output)
  assert.equal(input.sources.length, 1, "All four producer executions belong to the same settled source")
  const source = input.sources[0]!
  assert.equal(source.kind, "dispatch_result")
  assert(source.kind === "dispatch_result")
  const sourceMessage = settled.messages.find((message) => message.id === source.message_id)
  assert(sourceMessage && sourceMessage.data.role === "assistant", "Source must be a real assistant Message")
  const sourceInfo = Message.Assistant.parse({
    ...sourceMessage.data,
    id: sourceMessage.id,
    sessionID: sourceMessage.session_id,
  })
  assert(sourceInfo.time.completed, "The producer source must be settled")
  assert.equal(
    new Set([candidate.sessionID, sourceMessage.session_id]).size,
    2,
    "Producer and reader have two real Session identities",
  )
  const pairs = new Map<string, Set<string>>()
  const byteComparisons: Array<Record<string, unknown>> = []
  for (const read of input.evidence_reads!) {
    const original = await MessageStore.get({ sessionID: sourceMessage.session_id, messageID: read.message_id })
    const part = original.parts.find((part) => part.id === read.part_id)
    assert(
      part?.type === "tool" && part.tool === "bash" && part.state.status === "completed",
      "Selected fields must bind real completed producer shell invocations",
    )
    assert.equal(read.offset, 0)
    assert(read.field === "input" || read.field === "output")
    const raw =
      read.field === "input"
        ? JSON.stringify(part.state.input)
        : (await CompactionToolResultReader.authoritativeOutput(part)).output
    const returned = output.evidence_reads.filter(
      (item: any) => item.message_id === read.message_id && item.part_id === read.part_id && item.field === read.field,
    )
    assert.equal(returned.length, 1)
    const value = returned[0]
    assert.deepEqual(
      Buffer.from(value.content, "utf8"),
      Buffer.from(raw, "utf8"),
      "Actual reader bytes must equal the canonical historical field",
    )
    assert.deepEqual(
      { offset: value.offset, end: value.end, total: value.total_chars, next: value.next_offset },
      { offset: 0, end: raw.length, total: raw.length, next: null },
    )
    const matched = markers.filter((marker) => raw.includes(marker))
    assert.equal(matched.length, 1, "Each real field must bind one exact marker")
    const fields = pairs.get(read.part_id) ?? new Set<string>()
    fields.add(read.field)
    pairs.set(read.part_id, fields)
    byteComparisons.push({
      messageID: read.message_id,
      partID: read.part_id,
      field: read.field,
      limit: read.limit,
      marker: matched[0],
      utf8Bytes: Buffer.byteLength(raw, "utf8"),
      exactBytes: true,
    })
  }
  assert.deepEqual(
    [...pairs.values()].map((fields) => [...fields].sort()),
    Array.from({ length: 4 }, () => ["input", "output"]),
  )
  assert.deepEqual([...new Set(byteComparisons.map((item) => item.marker))].sort(), [...markers].sort())
  evidence = { ...evidence, readerPartID: candidate.id, actualInput: input, actualOutput: output, byteComparisons }
  const decision = settled.artifacts.find((artifact) => artifact.kind === "task_completion_decision")
  assert(decision?.payload, "Completion must have its canonical decision")
  const readerMessages = settled.messages.filter((message) => {
    const parsed = Message.Assistant.safeParse({ ...message.data, id: message.id, sessionID: message.session_id })
    return message.session_id === candidate.sessionID && parsed.success && Boolean(parsed.data.time.completed)
  })
  const verifierFinal = readerMessages.findLast((message) => {
    const text = settled.parts
      .filter((part) => part.message_id === message.id && part.data.type === "text")
      .map((part) => (part.data as { text: string }).text)
      .join("\n")
    return markers.every((marker) => text.includes(marker))
  })
  const completionReferences = readerCompletionReferences({
    decision: decision.payload,
    producerSessionID: sourceMessage.session_id,
    producerMessageID: source.message_id,
    readerSessionID: candidate.sessionID,
    readerMessageID: candidate.messageID,
    readerFinalMessageID: verifierFinal?.id,
  })
  const schemaObservations = observed.requests.flatMap(
    (request, requestIndex) =>
      request.input_evidence?.probes.flatMap((probe) =>
        probe.matches
          .filter((match) => match.json_pointer.includes("tools") && match.json_pointer.includes("description"))
          .map((match) => ({
            requestIndex,
            observedAt: requestObservationTimes[requestIndex],
            probeID: probe.id,
            ...match,
          })),
      ) ?? [],
  )
  const schemaObservationOrder = readerSchemaObservationOrder({
    toolStartedAt: candidate.state.time.start,
    observations: schemaObservations,
  })
  evidence = {
    ...evidence,
    status: "passed",
    sourceMessageID: source.message_id,
    sourceSessionID: sourceMessage.session_id,
    readerSessionID: candidate.sessionID,
    readerMessageID: candidate.messageID,
    readerPartID: candidate.id,
    actualInput: input,
    actualOutput: output,
    byteComparisons,
    completionDecision: decision,
    completionReferences,
    schemaObservations,
    schemaObservationOrder,
  }
} catch (error) {
  failure = error
  try {
    await dumpEvidence?.()
  } catch (diagnosticError) {
    evidence.diagnosticError = diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)
  }
} finally {
  const cleanupErrors: string[] = []
  try {
    await cleanup?.()
  } catch (error) {
    cleanupErrors.push(String(error))
  }
  for (const name of ["auth.json", "models.json"]) {
    try {
      await fs.rm(path.join(runtimeRoot, "data", name), { force: true })
    } catch (error) {
      cleanupErrors.push(String(error))
    }
  }
  const result = {
    ...evidence,
    status: audit?.exhausted ? "budget_exhausted" : failure || cleanupErrors.length ? "failed" : "passed",
    model,
    maxRequests,
    nonce,
    evidenceRoot: root,
    requests: audit?.requests ?? [],
    requestObservationTimes,
    error:
      failure instanceof Error
        ? { name: failure.name, message: failure.message, stack: failure.stack }
        : failure === undefined
          ? undefined
          : String(failure),
    credentialCleanup: cleanupErrors.length ? "failed" : "passed",
    cleanupErrors,
  }
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, redactor.redact(JSON.stringify(result, null, 2)))
  process.stdout.write(`[reader-e2e] ${result.status} result=${resultPath}\n`)
  if (result.status !== "passed") process.exitCode = 1
}
