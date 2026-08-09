#!/usr/bin/env bun

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

type CaseID = "m01" | "m02"

function selectedCaseID(): CaseID {
  const raw = process.env.MISSION_RANDOM_PORT_E2E_CASE ?? "m01"
  if (raw === "m01" || raw === "m02") return raw
  throw new Error(`unsupported MISSION_RANDOM_PORT_E2E_CASE ${JSON.stringify(raw)}`)
}

const caseID = selectedCaseID()
const runID = `${caseID}-${Date.now().toString(36)}`
const root = path.join(os.tmpdir(), `opencorvus-mission-e2e-${runID}`)
const runtimeRoot = path.join(root, "runtime-root")
const home = path.join(root, "home")
const managedConfig = path.join(root, "managed-config")
const tmp = path.join(root, "tmp")
const project = path.join(root, "project")
const liveModelRef = "deepseek/deepseek-v4-flash"
process.env.OPENCORVUS_HOME = runtimeRoot
process.env.OPENCORVUS_TEST_HOME = home
process.env.OPENCORVUS_TEST_MANAGED_CONFIG_DIR = managedConfig
process.env.TEMP = tmp
process.env.TMP = tmp
process.env.TMPDIR = tmp
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
delete process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
  model: liveModelRef,
  small_model: liveModelRef,
  agent: {
    coding: { model: liveModelRef },
    chat: { model: liveModelRef },
    control: { model: liveModelRef },
    mission: { model: liveModelRef },
    title: { model: liveModelRef },
    summary: { model: liveModelRef },
    compaction: { model: liveModelRef },
    orchestrator: { model: liveModelRef },
  },
})

type JsonRecord = Record<string, unknown>
type BunServer = ReturnType<typeof Bun.serve>

type Evidence = {
  runID: string
  caseID: CaseID
  runtimeRoot: string
  home: string
  managedConfig: string
  tmp: string
  project: string
  baseURL?: string
  health?: unknown
  providerPreflight?: unknown
  modelRef: string
  mockProviderURL?: string
  mockProviderRequests?: Array<{
    path: string
    toolNames: string[]
    responseKind: string
  }>
  firstWake?: JsonRecord
  secondWake?: JsonRecord
  status?: unknown
  activityCursor?: unknown
  messages?: unknown
  turnArtifacts?: unknown
  missionSkillCatalog?: unknown
  projectArchive?: {
    status: number
    contentType: string | null
    bytes: number
    fileCount: string | null
  }
  shutdown?: Array<{
    step: string
    status: "completed" | "failed"
    durationMs: number
    message?: string
  }>
  processExecutionSettlement?: {
    sessions: number
    toolParts: number
  }
  blocker?: {
    phase: string
    message: string
  }
  verdict?: {
    status: "accepted" | "rejected"
    failures: string[]
  }
}

const evidence: Evidence = { runID, caseID, runtimeRoot, home, managedConfig, tmp, project, modelRef: liveModelRef }
const mockProviderRequests: NonNullable<Evidence["mockProviderRequests"]> = []
const mockProviderID = "mock-openai-compatible"
const mockModelID = "mission-e2e"
const mockModelRef = `${mockProviderID}/${mockModelID}`
const repoRoot = path.resolve(import.meta.dir, "../../../..")

function mockProviderEnabled() {
  return process.env.MISSION_RANDOM_PORT_E2E_MOCK_PROVIDER === "1"
}

function selectedModelRef(mockProvider: BunServer | undefined) {
  const override = process.env.MISSION_RANDOM_PORT_E2E_MODEL
  if (mockProvider) return override ?? mockModelRef
  if (override && override !== liveModelRef) {
    throw new Error(`MISSION_RANDOM_PORT_E2E_MODEL must be ${liveModelRef}, got ${JSON.stringify(override)}`)
  }
  return liveModelRef
}

function artifactPath() {
  return path.join(repoRoot, "specs", "artifacts", "2026-08-09-mission-random-port-e2e", `${runID}.json`)
}

async function writeEvidence() {
  const output = artifactPath()
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.writeFile(output, JSON.stringify(evidence, null, 2))
  return output
}

function git(args: string[]) {
  const result = spawnSync("git", args, { cwd: project, encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`)
  }
}

async function prepareProject() {
  await fs.mkdir(project, { recursive: true })
  await fs.mkdir(tmp, { recursive: true })
  await fs.writeFile(
    path.join(project, "package.json"),
    JSON.stringify(
      {
        name: "mission-random-port-e2e-fixture",
        private: true,
        type: "module",
        scripts: { test: "node test.js" },
      },
      null,
      2,
    ),
  )
  await fs.writeFile(path.join(project, "index.js"), "export function answer() { return 41 + 1 }\n")
  await fs.writeFile(
    path.join(project, "test.js"),
    "import { answer } from './index.js'\nif (answer() !== 42) throw new Error('answer mismatch')\nconsole.log('ok')\n",
  )
  git(["init"])
  git(["config", "user.email", "mission-e2e@example.test"])
  git(["config", "user.name", "Mission E2E"])
  git(["add", "."])
  git(["commit", "-m", "initial fixture"])
}

function installMockProviderConfig(baseURL: string) {
  const model = {
    id: mockModelID,
    name: "Mission E2E Mock",
    family: "mock",
    release_date: "2026-08-09",
    attachment: false,
    reasoning: false,
    temperature: true,
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
    limit: { context: 200000, input: 180000, output: 8192 },
    cost: { input: 0, output: 0 },
  }
  process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
    model: mockModelRef,
    small_model: mockModelRef,
    enabled_providers: [mockProviderID],
    agent: {
      coding: { model: mockModelRef },
      chat: { model: mockModelRef },
      control: { model: mockModelRef },
      mission: { model: mockModelRef },
      title: { model: mockModelRef },
      summary: { model: mockModelRef },
      compaction: { model: mockModelRef },
      orchestrator: { model: mockModelRef },
    },
    provider: {
      [mockProviderID]: {
        id: mockProviderID,
        name: "Mission E2E Mock Provider",
        env: [],
        npm: "@ai-sdk/openai-compatible",
        api: baseURL,
        options: {
          apiKey: "mission-e2e",
          timeout: 30000,
          includeUsage: true,
        },
        models: {
          [mockModelID]: model,
        },
      },
    },
  })
}

type MockToolCall = {
  id: string
  name: string
  arguments: JsonRecord
}

function toolNamesFromRequest(body: JsonRecord): string[] {
  const tools = Array.isArray(body.tools) ? body.tools : []
  return tools
    .map((tool) => {
      if (!tool || typeof tool !== "object" || Array.isArray(tool)) return undefined
      const fn = (tool as JsonRecord).function
      if (!fn || typeof fn !== "object" || Array.isArray(fn)) return undefined
      const name = (fn as JsonRecord).name
      return typeof name === "string" ? name : undefined
    })
    .filter((name): name is string => Boolean(name))
}

function streamOpenAIChunks(chunks: JsonRecord[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    },
  )
}

function usageChunk(id: string) {
  return {
    id,
    created: 0,
    model: mockModelID,
    choices: [],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }
}

function textResponse(text: string) {
  const id = `chatcmpl-${IdentifierLike.suffix()}`
  return streamOpenAIChunks([
    {
      id,
      created: 0,
      model: mockModelID,
      choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }],
    },
    {
      id,
      created: 0,
      model: mockModelID,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    },
    usageChunk(id),
  ])
}

function toolResponse(calls: MockToolCall[]) {
  const id = `chatcmpl-${IdentifierLike.suffix()}`
  return streamOpenAIChunks([
    {
      id,
      created: 0,
      model: mockModelID,
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            tool_calls: calls.map((call, index) => ({
              index,
              id: call.id,
              type: "function",
              function: {
                name: call.name,
                arguments: JSON.stringify(call.arguments),
              },
            })),
          },
          finish_reason: null,
        },
      ],
    },
    {
      id,
      created: 0,
      model: mockModelID,
      choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
    },
    usageChunk(id),
  ])
}

const IdentifierLike = {
  counter: 0,
  suffix() {
    this.counter += 1
    return `${Date.now().toString(36)}-${this.counter}`
  },
}

function firstMissionToolCalls(): MockToolCall[] {
  return [
    {
      id: "call_m01_first_skill",
      name: "mission_skill",
      arguments: { name: "general" },
    },
    {
      id: "call_m01_first_frontier",
      name: "mission_state",
      arguments: {
        action: "write",
        file: "frontier.md",
        content: [
          "# M01 Frontier",
          "",
          "- Case: random-port Mission intro, skill load, state write, queued child Task creation.",
          "- Fixture command: npm test.",
        ].join("\n"),
      },
    },
    {
      id: "call_m01_first_tasks",
      name: "mission_state",
      arguments: {
        action: "write",
        file: "tasks.md",
        content: "- [ ] Create one queued child Task for the fixture `npm test` check.\n",
      },
    },
    {
      id: "call_m01_first_catalog",
      name: "panel",
      arguments: { action: "expert_squad_catalog" },
    },
    {
      id: "call_m01_first_task",
      name: "panel",
      arguments: {
        action: "create_task",
        title: "Run fixture npm test",
        request:
          "Run `npm test` in the mission E2E fixture project and report the exact command output. Keep the result concise.",
        promptProfile: "base",
        queue: true,
      },
    },
  ]
}

function resumeMissionToolCalls(): MockToolCall[] {
  return [
    {
      id: "call_m01_resume_state_list",
      name: "mission_state",
      arguments: { action: "list" },
    },
    {
      id: "call_m01_resume_frontier",
      name: "mission_state",
      arguments: { action: "read", file: "frontier.md" },
    },
    {
      id: "call_m01_resume_handoff",
      name: "mission_state",
      arguments: {
        action: "write",
        file: "handoff.md",
        content: [
          "# M01 Handoff",
          "",
          "Resume verified persisted Mission state and published a compact summary artifact.",
        ].join("\n"),
      },
    },
    {
      id: "call_m01_resume_publish",
      name: "publish_interactive_artifact",
      arguments: {
        artifact: {
          schemaVersion: "1",
          renderer: "document@1",
          title: "M01 Mission Resume Summary",
          markdown: [
            "# M01 Mission Resume Summary",
            "",
            "- Backend served this case on a random loopback port.",
            "- First wake loaded the general Mission Skill and wrote Mission state.",
            "- Resume read Mission state and published this artifact.",
          ].join("\n"),
        },
      },
    },
  ]
}

function childTaskToolCalls(): MockToolCall[] {
  return [
    {
      id: "call_m01_child_complete",
      name: "manage_task",
      arguments: {
        action: "complete_task",
        summary: "Fixture npm test request acknowledged by the deterministic Mission E2E child Task.",
        evidence_locators: [],
        deliverable_artifact_locators: [],
        accepted_delivery_slice_revision_ids: [],
        workflow_id: null,
      },
    },
  ]
}

async function handleMockChat(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as JsonRecord
  const toolNames = toolNamesFromRequest(body)
  const transcript = JSON.stringify(body.messages ?? [])
  let responseKind = "generic-text"
  let response: Response
  if (transcript.includes("call_m01_child_complete")) {
    responseKind = "child-final"
    response = textResponse("Child Task completed from the deterministic lifecycle decision.")
  } else if (toolNames.includes("manage_task")) {
    responseKind = "child-tools"
    response = toolResponse(childTaskToolCalls())
  } else if (transcript.includes("call_m01_resume_publish")) {
    responseKind = "resume-final"
    response = textResponse("Resume complete: Mission state was read and a compact summary artifact was published.")
  } else if (transcript.includes("Resume from Mission state") && toolNames.includes("publish_interactive_artifact")) {
    responseKind = "resume-tools"
    response = toolResponse(resumeMissionToolCalls())
  } else if (transcript.includes("call_m01_first_task")) {
    responseKind = "first-final"
    response = textResponse(
      "Mission M01 is introduced: general skill loaded, state recorded, and one queued fixture Task was created.",
    )
  } else if (toolNames.includes("mission_skill") && toolNames.includes("panel")) {
    responseKind = "first-tools"
    response = toolResponse(firstMissionToolCalls())
  } else {
    response = textResponse("Mock provider acknowledged the request without additional tool calls.")
  }
  mockProviderRequests.push({ path: new URL(request.url).pathname, toolNames, responseKind })
  return response
}

function startMockProvider(): BunServer {
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (request.method === "POST" && (url.pathname === "/chat/completions" || url.pathname === "/v1/chat/completions")) {
        return handleMockChat(request)
      }
      return new Response(JSON.stringify({ error: `Unhandled mock provider route ${request.method} ${url.pathname}` }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    },
  })
}

async function requestJSON(baseURL: string, route: string, init?: RequestInit): Promise<JsonRecord> {
  const url = new URL(route, baseURL)
  url.searchParams.set("directory", project)
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-opencorvus-directory": project,
      ...(init?.headers ?? {}),
    },
  })
  const text = await response.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }
  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${route} failed ${response.status}: ${text}`)
  }
  return body && typeof body === "object" && !Array.isArray(body) ? (body as JsonRecord) : { value: body }
}

async function requestArchive(baseURL: string, missionID: string) {
  const url = new URL(`/mission/${missionID}/project-archive`, baseURL)
  url.searchParams.set("directory", project)
  const response = await fetch(url, { headers: { "x-opencorvus-directory": project } })
  const bytes = await response.arrayBuffer()
  evidence.projectArchive = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    bytes: bytes.byteLength,
    fileCount: response.headers.get("x-opencorvus-archive-file-count"),
  }
}

function requireIsolatedDatabase(health: unknown) {
  const paths = inputRecord(inputRecord(health).paths)
  const database = paths.database
  if (typeof database !== "string") {
    throw new Error(`global health did not expose paths.database: ${JSON.stringify(health)}`)
  }
  const expectedRoot = path.normalize(runtimeRoot)
  const actual = path.normalize(database)
  if (!actual.startsWith(expectedRoot + path.sep)) {
    throw new Error(`database path ${database} is not under isolated OPENCORVUS_HOME ${runtimeRoot}`)
  }
}

async function preflightIsolatedBackend(baseURL: string, modelRef: string, options: { skipProviderTest?: boolean } = {}) {
  const [providerID, modelID] = modelRef.split("/")
  if (!providerID || !modelID) throw new Error(`invalid model ref for preflight: ${modelRef}`)
  evidence.health = await requestJSON(baseURL, "/global/health")
  requireIsolatedDatabase(evidence.health)
  if (options.skipProviderTest) {
    evidence.providerPreflight = {
      ok: true,
      status: "skipped",
      providerID,
      modelID,
      reason: "local mock provider is exercised by Mission requests",
    }
    return
  }
  evidence.providerPreflight = await requestJSON(baseURL, `/provider/${providerID}/test`, {
    method: "POST",
    body: JSON.stringify({ modelID }),
  })
  const preflight = inputRecord(evidence.providerPreflight)
  if (preflight.ok !== true || preflight.status !== "connected" || preflight.modelID !== modelID) {
    throw new Error(`provider preflight failed for ${modelRef}: ${JSON.stringify(evidence.providerPreflight)}`)
  }
}

function responseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== "object") return []
  const wrapped = (value as JsonRecord).value
  return Array.isArray(wrapped) ? wrapped : []
}

type ToolEvidencePart = {
  tool: string
  status: unknown
  input: unknown
  output: unknown
  failure: unknown
}

function toolParts(messages: unknown): ToolEvidencePart[] {
  const parts: ToolEvidencePart[] = []
  for (const message of responseArray(messages)) {
    if (!message || typeof message !== "object" || Array.isArray(message)) continue
    for (const part of responseArray((message as JsonRecord).parts)) {
      if (!part || typeof part !== "object" || Array.isArray(part)) continue
      const record = part as JsonRecord
      const state = record.state
      if (record.type !== "tool" || typeof record.tool !== "string") continue
      if (!state || typeof state !== "object" || Array.isArray(state)) continue
      const toolState = state as JsonRecord
      parts.push({
        tool: record.tool,
        status: toolState.status,
        input: toolState.input,
        output: toolState.output,
        failure: toolState.failure,
      })
    }
  }
  return parts
}

function completedToolParts(messages: unknown): ToolEvidencePart[] {
  return toolParts(messages).filter((part) => part.status === "completed")
}

function assistantMessages(messages: unknown): JsonRecord[] {
  return responseArray(messages).filter((message): message is JsonRecord => {
    if (!message || typeof message !== "object" || Array.isArray(message)) return false
    return inputRecord((message as JsonRecord).info).role === "assistant"
  })
}

function allAssistantMessagesComplete(messages: unknown): boolean {
  const assistants = assistantMessages(messages)
  return assistants.length > 0 && assistants.every((message) => {
    const completed = inputRecord(inputRecord(message.info).time).completed
    return typeof completed === "number"
  })
}

function inputRecord(input: unknown): JsonRecord {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as JsonRecord) : {}
}

function parseJsonOutput(output: unknown): JsonRecord {
  if (typeof output !== "string") return {}
  try {
    return inputRecord(JSON.parse(output))
  } catch {
    return {}
  }
}

function collectToolEvidence(messages: unknown): {
  missionSkill: boolean
  publish: boolean
  completeMission: boolean
  resumeHandoff: boolean
  createdTaskID?: string
  createTaskFailure?: string
} {
  const allToolParts = toolParts(messages)
  const completed = completedToolParts(messages)
  const createTaskParts = allToolParts.filter(
    (part) => part.tool === "panel" && inputRecord(part.input).action === "create_task",
  )
  const createdTaskID = createTaskParts
    .map((part) => parseJsonOutput(part.output))
    .map((output) => (output.kind === "created" && typeof output.task_id === "string" ? output.task_id : undefined))
    .find((taskID): taskID is string => !!taskID)
  const failedCreateTask = createTaskParts.find((part) => part.status === "error")
  return {
    missionSkill: completed.some((part) => part.tool === "mission_skill" && inputRecord(part.input).name === "general"),
    publish: completed.some((part) => part.tool === "publish_interactive_artifact"),
    completeMission: completed.some((part) => {
      if (part.tool !== "panel" || inputRecord(part.input).action !== "complete_mission") return false
      return parseJsonOutput(part.output).kind === "mission_completed"
    }),
    resumeHandoff: completed.some((part) => {
      const input = inputRecord(part.input)
      return part.tool === "mission_state" && input.action === "write" && input.file === "handoff.md"
    }),
    createdTaskID,
    createTaskFailure: failedCreateTask ? JSON.stringify(failedCreateTask.failure ?? failedCreateTask) : undefined,
  }
}

function statusTasks(status: unknown): unknown[] {
  if (!status || typeof status !== "object") return []
  return responseArray((status as JsonRecord).tasks)
}

function statusHasTask(status: unknown, taskID: string) {
  return statusTasks(status).some((task) => inputRecord(task).taskID === taskID)
}

function missionActivityIdle(status: unknown): boolean {
  const record = inputRecord(status)
  const activity = inputRecord(record.activity)
  return record.status === "inactive" && activity.running === 0
}

function evaluate() {
  const failures: string[] = []
  if (!evidence.baseURL) failures.push("backend URL missing")
  if (evidence.firstWake?.created !== true) failures.push("first wake did not create mission")
  if (evidence.secondWake?.created !== false) failures.push("second wake did not resume mission")
  if (evidence.firstWake?.missionID !== evidence.secondWake?.missionID) failures.push("resume missionID mismatch")
  if (evidence.firstWake?.sessionID !== evidence.secondWake?.sessionID) failures.push("resume sessionID mismatch")
  const tools = collectToolEvidence(evidence.messages)
  if (!tools.missionSkill) failures.push("no completed mission_skill general evidence found in session messages")
  if (tools.createTaskFailure) failures.push(`panel.create_task failed: ${tools.createTaskFailure}`)
  if (!tools.createdTaskID) {
    failures.push("no completed panel.create_task created task evidence found in session messages")
  } else if (!statusHasTask(evidence.status, tools.createdTaskID)) {
    failures.push(`mission status did not expose created child task ${tools.createdTaskID}`)
  }
  if (!evidence.activityCursor || JSON.stringify(evidence.activityCursor).length < 5) {
    failures.push("activity cursor missing")
  }
  if (!missionActivityIdle(evidence.status)) failures.push("mission activity still running")
  const artifacts = responseArray(evidence.turnArtifacts)
  if (caseID === "m02" && !tools.publish) {
    failures.push("M02 did not produce completed publish_interactive_artifact evidence")
  }
  if (caseID === "m02" && !tools.completeMission) {
    failures.push("M02 did not produce completed panel.complete_mission evidence")
  }
  if (artifacts.length === 0 && !tools.publish && (evidence.projectArchive?.bytes ?? 0) === 0) {
    failures.push("no publish/artifact/project-archive evidence found")
  }
  evidence.verdict = {
    status: failures.length === 0 ? "accepted" : "rejected",
    failures,
  }
}

async function waitForEvidence(baseURL: string, missionID: string, sessionID: string) {
  let last = ""
  let quietSince = Date.now()
  const deadline = Date.now() + Number(process.env.MISSION_RANDOM_PORT_E2E_TIMEOUT_MS ?? 12 * 60 * 1000)
  while (Date.now() < deadline) {
    evidence.status = await requestJSON(baseURL, `/mission/${missionID}/status`)
    evidence.activityCursor = await requestJSON(baseURL, `/mission/${missionID}/activity-cursor`)
    evidence.messages = await requestJSON(baseURL, `/session/${sessionID}/message`)
    evidence.turnArtifacts = await requestJSON(baseURL, `/session/${sessionID}/turn-artifacts`)
    const signature = JSON.stringify({
      status: evidence.status,
      activityCursor: evidence.activityCursor,
      messages: evidence.messages,
      turnArtifacts: evidence.turnArtifacts,
    })
    const tools = collectToolEvidence(evidence.messages)
    const hasTask = !!tools.createdTaskID && statusHasTask(evidence.status, tools.createdTaskID)
    const hasArtifact =
      caseID === "m02" ? tools.publish : responseArray(evidence.turnArtifacts).length > 0 || tools.publish
    const hasResumeSettlement = caseID === "m02" ? tools.publish && tools.completeMission : tools.resumeHandoff || tools.publish
    if (tools.createTaskFailure) return
    if (
      tools.missionSkill &&
      hasTask &&
      hasArtifact &&
      hasResumeSettlement &&
      allAssistantMessagesComplete(evidence.messages) &&
      missionActivityIdle(evidence.status)
    )
      return
    if (signature !== last) {
      last = signature
      quietSince = Date.now()
    } else if (Date.now() - quietSince > 120_000) {
      throw new Error("mission evidence quiet timeout before Mission activity became idle")
    }
    await Bun.sleep(5_000)
  }
  throw new Error("mission evidence deadline reached before Mission activity became idle")
}

async function recordShutdownStep(step: string, operation: Promise<unknown>): Promise<boolean> {
  const start = Date.now()
  evidence.shutdown ??= []
  try {
    await operation
    evidence.shutdown.push({ step, status: "completed", durationMs: Date.now() - start })
    return true
  } catch (error) {
    evidence.shutdown.push({
      step,
      status: "failed",
      durationMs: Date.now() - start,
      message: error instanceof Error ? error.message : String(error),
    })
    process.exitCode = 1
    return false
  } finally {
    await writeEvidence().catch(() => {})
  }
}

async function main() {
  let currentPhase = "prepare"
  await prepareProject()
  const mockProvider = mockProviderEnabled() ? startMockProvider() : undefined
  if (mockProvider) {
    evidence.mockProviderURL = mockProvider.url.toString()
    installMockProviderConfig(evidence.mockProviderURL)
  }
  const model = selectedModelRef(mockProvider)
  evidence.modelRef = model
  const { Log } = await import("@/util/log")
  await Log.init({ print: false })
  const { Server } = await import("@/server/server")
  const { Database } = await import("@/storage/db")
  const { Instance } = await import("@/project/instance")
  const { Scheduler } = await import("@/scheduler")

  const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  evidence.baseURL = server.url.toString()
  try {
    currentPhase = "preflight"
    await preflightIsolatedBackend(evidence.baseURL, model, { skipProviderTest: !!mockProvider })
    currentPhase = "mission"
    evidence.missionSkillCatalog = await requestJSON(evidence.baseURL, "/mission-skill/catalog")
    const firstText =
      caseID === "m02"
        ? [
            '@mission("general")',
            "Introduce the Mission plan briefly, load the general Mission Skill, write Mission state, and dispatch one small read-only code Task that inspects package.json, index.js, and test.js without running npm test.",
            "The child Task should produce a concise inventory artifact listing file names, script names, exported function names, and the expected test assertion. Do not modify project files.",
          ].join("\n")
        : [
            '@mission("general")',
            "Introduce the Mission plan briefly, load the general Mission Skill, write Mission state, dispatch one small code Task that runs npm test, and keep evidence concise.",
            "Use the existing tiny fixture project. Do not modify unrelated files.",
          ].join("\n")
    evidence.firstWake = await requestJSON(evidence.baseURL, "/mission/wake", {
      method: "POST",
      body: JSON.stringify({
        productPillar: "code",
        text: firstText,
        ...(model ? { model } : {}),
      }),
    })
    const missionID = String(evidence.firstWake.missionID)
    const sessionID = String(evidence.firstWake.sessionID)

    await Bun.sleep(15_000)
    evidence.secondWake = await requestJSON(evidence.baseURL, "/mission/wake", {
      method: "POST",
      body: JSON.stringify({
        missionID,
        productPillar: "code",
        text:
          caseID === "m02"
            ? "Resume from Mission state, query the child Task and its artifacts, then publish a compact inventory summary with publish_interactive_artifact. If the child evidence is not ready, record the exact pending state in handoff.md."
            : "Resume from Mission state and publish a compact completion summary artifact if the child Task evidence is ready. If not ready, record the exact pending state in handoff.md.",
        ...(model ? { model } : {}),
      }),
    })

    currentPhase = "collect"
    await waitForEvidence(evidence.baseURL, missionID, sessionID)
    await requestArchive(evidence.baseURL, missionID)
    evidence.mockProviderRequests = mockProviderRequests
    evaluate()
    const output = await writeEvidence()
    console.log(JSON.stringify({ output, verdict: evidence.verdict, baseURL: evidence.baseURL }, null, 2))
    if (evidence.verdict?.status !== "accepted") process.exitCode = 1
  } catch (error) {
    evidence.blocker = {
      phase: currentPhase,
      message: error instanceof Error ? error.message : String(error),
    }
    evidence.verdict = {
      status: "rejected",
      failures: [evidence.blocker.message],
    }
    const output = await writeEvidence()
    console.log(JSON.stringify({ output, verdict: evidence.verdict, baseURL: evidence.baseURL, blocker: evidence.blocker }, null, 2))
    process.exitCode = 1
  } finally {
    currentPhase = "shutdown"
    let runtimeTransfer: import("@/server/server").Server.RuntimeTransferHandle | undefined
    let releaseHandoff: (() => void) | undefined
    await recordShutdownStep(
      "Server.beginRuntimeTransfer",
      Promise.resolve().then(async () => {
        runtimeTransfer = Server.beginRuntimeTransfer(server)
        await runtimeTransfer.quiesced
      }),
    )
    await recordShutdownStep(
      "terminateCurrentProcessOwnedExecution",
      (async () => {
        const { terminateCurrentProcessOwnedExecution } = await import("@/engine/writer")
        const terminated = await terminateCurrentProcessOwnedExecution({
          reason: `mission-random-port-e2e ${runID} shutdown`,
        })
        evidence.processExecutionSettlement = {
          sessions: terminated.sessions,
          toolParts: terminated.toolParts,
        }
        releaseHandoff = terminated.releaseHandoff
      })(),
    )
    await recordShutdownStep(
      "releaseRuntimeHandoff",
      Promise.resolve().then(() => {
        releaseHandoff?.()
        runtimeTransfer?.releaseOwnership()
      }),
    )
    if (mockProvider) await recordShutdownStep("mockProvider.stop", Promise.resolve(mockProvider.stop(true)))
    await recordShutdownStep("Scheduler.disposeGlobal", Scheduler.disposeGlobal())
    await recordShutdownStep("Instance.disposeAll", Instance.disposeAll())
    await recordShutdownStep(
      "Database.close",
      Promise.resolve().then(() => {
        Database.close()
      }),
    )
    await recordShutdownStep("Log.close", Log.close())
  }
}

await main()
