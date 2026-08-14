import fs from "node:fs/promises"
import path from "node:path"
import {
  applyIsolatedTestUserEnvironment,
  bootstrapIsolatedTestRuntime,
  removeIsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

const INACTIVITY_MS = 120_000
const POLL_MS = 500
const MODEL = process.env.OPENCORVUS_GRILL_BENCHMARK_MODEL?.trim() || "deepseek/deepseek-chat"
if (process.argv[2]) {
  throw new Error("Advanced Requirements grill benchmark owns its temporary project and accepts no directory argument")
}
const testProcessSupervisor = prepareTestProcessSupervisor()
const isolatedRuntime = await bootstrapIsolatedTestRuntime("runner")
applyIsolatedTestUserEnvironment(isolatedRuntime)
if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor
const benchmarkRoot = await fs.mkdtemp(path.join(isolatedRuntime.processRoot, "advanced-grill-"))
const projectDirectory = path.join(benchmarkRoot, "project")
process.env.OPENCORVUS_HOME = path.join(benchmarkRoot, "home")
const { Database } = await import("@/storage/db")
const { waitForIngressDeliveryHooksForTest } = await import("@/engine/task-root-ingress-delivery")
const { Log } = await import("@/util/log")
const { Server } = await import("@/server/server")
const { declareNativeTaskProcessDeployment } = await import("@/runtime/task-process-deployment")

async function seedBenchmarkProject() {
  await fs.mkdir(path.join(projectDirectory, "src"), { recursive: true })
  await fs.mkdir(path.join(projectDirectory, "test"), { recursive: true })
  await Promise.all([
    fs.writeFile(
      path.join(projectDirectory, "package.json"),
      JSON.stringify(
        {
          name: "advanced-requirements-grill-fixture",
          private: true,
          type: "module",
          scripts: { test: "bun test" },
        },
        null,
        2,
      ) + "\n",
    ),
    fs.writeFile(
      path.join(projectDirectory, "src", "config.ts"),
      [
        "export type ApplicationConfig = { compact_logs: boolean }",
        "export const defaultApplicationConfig: ApplicationConfig = { compact_logs: false }",
        "",
      ].join("\n"),
    ),
    fs.writeFile(
      path.join(projectDirectory, "src", "log-renderer.ts"),
      [
        'export type LogLine = { level: "info" | "warning" | "error"; text: string }',
        "export function renderTerminalLogs(lines: readonly LogLine[]): string[] {",
        "  return lines.map((line) => line.text)",
        "}",
        "",
      ].join("\n"),
    ),
    fs.writeFile(
      path.join(projectDirectory, "test", "log-renderer.test.ts"),
      [
        'import { expect, test } from "bun:test"',
        'import { renderTerminalLogs } from "../src/log-renderer"',
        'test("renders every line in order", () => {',
        '  expect(renderTerminalLogs([{ level: "info", text: "ready" }])).toEqual(["ready"])',
        "})",
        "",
      ].join("\n"),
    ),
  ])
}

await seedBenchmarkProject()
await Log.init({ print: false })
declareNativeTaskProcessDeployment()

let backend: ReturnType<typeof Server.listen> | undefined

async function requestJSON<T>(route: string, init: RequestInit = {}): Promise<T> {
  if (!backend) throw new Error("Advanced Requirements grill benchmark Server is not listening")
  const url = new URL(route, backend.url)
  url.searchParams.set("directory", projectDirectory)
  const headers = new Headers(init.headers)
  headers.set("x-opencorvus-directory", projectDirectory)
  headers.set("x-opencorvus-request-id", crypto.randomUUID())
  const response = await fetch(url, { ...init, headers })
  const body = await response.text()
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${url.pathname} failed ${response.status}: ${body}`)
  }
  return body ? (JSON.parse(body) as T) : (undefined as T)
}

async function createBenchmarkTask(input: { title: string; request: string }) {
  return requestJSON<{ task_id: string }>("/task?init-git=true", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      request: input.request,
      source: "advanced-requirements-grill-e2e",
      productPillar: "code",
      model: MODEL,
      promptProfile: "advanced",
    }),
  })
}

type ToolObservation = {
  sessionID: string
  agent: string
  messageID: string
  callID: string
  order: number
  timeCompleted: number
  tool: string
  status?: string
  input?: unknown
}

function sameRegisteredRequirement(left: any, right: any): boolean {
  return ["id", "type", "description", "acceptance", "non_goals"].every((key) => left?.[key] === right?.[key])
}

function sameRegisteredDecision(left: any, right: any): boolean {
  return ["key", "value", "reason"].every((key) => left?.[key] === right?.[key])
}

function exactMultisetMatch<T>(left: T[], right: T[], same: (left: T, right: T) => boolean): boolean {
  if (left.length !== right.length) return false
  const unmatched = [...right]
  for (const item of left) {
    const index = unmatched.findIndex((candidate) => same(item, candidate))
    if (index === -1) return false
    unmatched.splice(index, 1)
  }
  return unmatched.length === 0
}

function artifactMatchesSessionRegistrations(input: {
  payload: any
  tools: ToolObservation[]
  sessionID: string
  afterOrder?: number
}): boolean {
  const registrations = input.tools.filter(
    (item) =>
      item.sessionID === input.sessionID &&
      item.status === "completed" &&
      item.order > (input.afterOrder ?? -1) &&
      typeof item.input === "object" &&
      item.input !== null,
  )
  const requirements = registrations.filter((item) => item.tool === "register_requirement")
  const decisions = registrations.filter((item) => item.tool === "register_decision")
  return (
    input.payload.requirements.length > 0 &&
    input.payload.decisions.length > 0 &&
    exactMultisetMatch(
      input.payload.requirements,
      requirements.map((item) => item.input),
      sameRegisteredRequirement,
    ) &&
    exactMultisetMatch(
      input.payload.decisions,
      decisions.map((item) => item.input),
      sameRegisteredDecision,
    )
  )
}

function messageText(parts: Array<Record<string, unknown>>): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => String(part.text))
    .join("\n")
}

async function taskObservations(taskID: string) {
  const [board, transcript, interactions] = await Promise.all([
    requestJSON<any>(`/task/${taskID}/board`),
    requestJSON<Array<{ info: Record<string, unknown>; parts: Array<Record<string, any>> }>>(
      `/task/${taskID}/transcript`,
    ),
    requestJSON<
      Array<{
        id: string
        type: "permission" | "question"
        status: "pending" | "answered" | "rejected" | "expired"
        body: string
        externalID: string
      }>
    >(`/task/${taskID}/interactions`),
  ])
  const tools: ToolObservation[] = []
  const messages: Array<{
    id: string
    sessionID: string
    agent: string
    role: string
    timeCreated: number
  }> = []
  const texts: Array<{ sessionID: string; agent: string; text: string }> = []
  let toolOrder = 0
  for (const message of transcript) {
    const agent = typeof message.info.agent === "string" ? message.info.agent : ""
    const sessionID = typeof message.info.sessionID === "string" ? message.info.sessionID : ""
    const messageID = typeof message.info.id === "string" ? message.info.id : ""
    const role = typeof message.info.role === "string" ? message.info.role : ""
    const time = message.info.time as { created?: unknown } | undefined
    const timeCreated = typeof time?.created === "number" ? time.created : 0
    messages.push({ id: messageID, sessionID, agent, role, timeCreated })
    const text = messageText(message.parts as Array<Record<string, unknown>>).trim()
    if (text) texts.push({ sessionID, agent, text })
    for (const part of message.parts) {
      if (part.type !== "tool") continue
      tools.push({
        sessionID,
        agent,
        messageID,
        callID: typeof part.callID === "string" ? part.callID : "",
        order: toolOrder++,
        timeCompleted: typeof part.state?.time?.end === "number" ? part.state.time.end : Number.POSITIVE_INFINITY,
        tool: String(part.tool),
        status: typeof part.state?.status === "string" ? part.state.status : undefined,
        input: part.state?.input,
      })
    }
  }
  const requirementSets = (board.artifacts as Array<any>).filter((artifact) => artifact.kind === "requirement_set")
  const coordinationActions = (board.artifacts as Array<any>).filter(
    (artifact) => artifact.kind === "agent_coordination_action",
  )
  const status = String(board.task.status)
  return {
    task: {
      time_updated: board.task.updatedAt ?? board.task.time?.updated ?? 0,
      time_completed: ["completed", "failed", "cancelled"].includes(status) ? 1 : null,
    },
    tools,
    messages,
    texts,
    interactions,
    requirementSets,
    coordinationActions,
  }
}

async function waitForObservation<T>(input: {
  taskID: string
  label: string
  select: (observation: Awaited<ReturnType<typeof taskObservations>>) => T | undefined
}): Promise<{ selected: T; observation: Awaited<ReturnType<typeof taskObservations>> }> {
  let lastSignature = ""
  let inactivityDeadline = Date.now() + INACTIVITY_MS
  while (Date.now() < inactivityDeadline) {
    const observation = await taskObservations(input.taskID)
    const selected = input.select(observation)
    if (selected !== undefined) return { selected, observation }
    const signature = JSON.stringify({
      taskUpdated: observation.task.time_updated,
      interactions: observation.interactions.map((item) => [item.id, item.status]),
      requirementSets: observation.requirementSets.map((item) => [item.id, item.revision]),
      tools: observation.tools.map((item) => [item.sessionID, item.tool, item.status]),
      messages: observation.messages.map((item) => [item.id, item.role]),
      texts: observation.texts.map((item) => [item.sessionID, item.text.length]),
    })
    if (signature !== lastSignature) {
      lastSignature = signature
      inactivityDeadline = Date.now() + INACTIVITY_MS
      process.stdout.write(
        JSON.stringify({
          event: "activity",
          label: input.label,
          taskStatus: observation.task.time_completed ? "terminal" : "active",
          interactions: observation.interactions.map((item) => ({ id: item.id, status: item.status })),
          requirementSets: observation.requirementSets.length,
          tools: observation.tools.length,
        }) + "\n",
      )
    }
    await Bun.sleep(POLL_MS)
  }
  throw new Error(`${input.label} had no observable activity for ${INACTIVITY_MS}ms`)
}

async function cancelBenchmarkTask(taskID: string) {
  await Promise.race([
    (async () => {
      const board = await requestJSON<any>(`/task/${taskID}/board`)
      if (["completed", "failed", "cancelled"].includes(String(board.task.status))) return
      await requestJSON(`/task/${taskID}/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ surface: "api", reason: "benchmark observation completed" }),
      })
    })(),
    Bun.sleep(10_000),
  ])
}

async function runAmbiguousCase() {
  const request = [
    "Implement a project notification-preferences capability using the existing repository stack.",
    "The only unresolved product decision is delivery scope: notifications may be in-app only, or in-app plus email.",
    "This is a downstream requirements decision frontier, not missing request intent; the Request Interpreter should record it without opening a user interaction, and the Requirement Engineer owns asking it.",
    "Do not infer that decision from convention. All other product choices use the current repository behavior and the Requirement Engineer's recommended defaults.",
    "Before implementation, use the Advanced planned-delivery Requirements path to reach shared understanding and register bounded REQ-N acceptance records.",
  ].join("\n")
  const { task_id: taskID } = await createBenchmarkTask({ title: "Advanced Grill Ambiguous Trial", request })

  try {
    const first = await waitForObservation({
      taskID,
      label: "ambiguous-first-question",
      select: (observation) => {
        const requirementAction = observation.coordinationActions.find(
          (artifact) =>
            artifact.payload?.target_agent === "requirement-engineer" &&
            artifact.payload?.action === "ask_user" &&
            typeof artifact.payload?.result?.interaction_id === "string",
        )
        const interaction = observation.interactions.find(
          (item) => item.id === requirementAction?.payload?.result?.interaction_id && item.status === "pending",
        )
        const requirementSessionID = requirementAction?.payload?.target_session_id
        if (typeof requirementSessionID !== "string") return undefined
        const skillLoad = observation.tools.find(
          (item) =>
            item.sessionID === requirementSessionID &&
            item.agent === "requirement-engineer" &&
            item.tool === "skill" &&
            typeof item.input === "object" &&
            item.input !== null &&
            (item.input as Record<string, unknown>).name === "grill-me" &&
            item.status === "completed",
        )
        const handoff = observation.tools.find(
          (item) =>
            item.sessionID === requirementSessionID &&
            item.agent === "requirement-engineer" &&
            item.tool === "request_orchestrator_decision" &&
            item.status === "completed",
        )
        return interaction && skillLoad && handoff && skillLoad.order < handoff.order
          ? { interaction, requirementAction, skillLoad, handoff }
          : undefined
      },
    })

    await requestJSON(`/interaction/${first.selected.interaction.id}/reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        autoReply: false,
        message: "采用你推荐的方案：仅应用内通知；本次不包含邮件投递。",
      }),
    })

    const handoffMessageIDs = new Set(
      first.observation.messages
        .filter((item) => item.sessionID === first.selected.handoff.sessionID)
        .map((item) => item.id),
    )

    const continued = await waitForObservation({
      taskID,
      label: "ambiguous-continuation",
      select: (observation) => {
        const answered = observation.interactions.find(
          (item) => item.id === first.selected.interaction.id && item.status === "answered",
        )
        const continuationUser = observation.messages.find(
          (item) =>
            item.sessionID === first.selected.handoff.sessionID &&
            item.role === "user" &&
            !handoffMessageIDs.has(item.id),
        )
        const continuationAssistant = observation.messages.find(
          (item) =>
            item.sessionID === first.selected.handoff.sessionID &&
            item.role === "assistant" &&
            !handoffMessageIDs.has(item.id) &&
            item.timeCreated >= (continuationUser?.timeCreated ?? Number.POSITIVE_INFINITY),
        )
        const laterRequirementAction = observation.coordinationActions.find(
          (artifact) =>
            artifact.id !== first.selected.requirementAction.id &&
            artifact.payload?.target_session_id === first.selected.handoff.sessionID &&
            artifact.payload?.target_agent === "requirement-engineer" &&
            artifact.payload?.action === "ask_user" &&
            typeof artifact.payload?.result?.interaction_id === "string",
        )
        const laterQuestion = observation.interactions.find(
          (item) => item.id === laterRequirementAction?.payload?.result?.interaction_id,
        )
        const continuationRequirement = observation.tools.find(
          (item) =>
            item.sessionID === first.selected.handoff.sessionID &&
            item.tool === "register_requirement" &&
            item.status === "completed" &&
            item.order > first.selected.handoff.order,
        )
        const continuationDecision = observation.tools.find(
          (item) =>
            item.sessionID === first.selected.handoff.sessionID &&
            item.tool === "register_decision" &&
            item.status === "completed" &&
            item.order > first.selected.handoff.order,
        )
        const continuationRegistrations = observation.tools.filter(
          (item) =>
            item.sessionID === first.selected.handoff.sessionID &&
            (item.tool === "register_requirement" || item.tool === "register_decision") &&
            item.status === "completed" &&
            item.order > first.selected.handoff.order,
        )
        const lastRegistrationCompletion = Math.max(
          ...continuationRegistrations.map((item) => item.timeCompleted),
          Number.NEGATIVE_INFINITY,
        )
        const requirementSet = observation.requirementSets.find(
          (artifact) =>
            artifactMatchesSessionRegistrations({
              payload: artifact.payload,
              tools: observation.tools,
              sessionID: first.selected.handoff.sessionID,
              afterOrder: first.selected.handoff.order,
            }) &&
            typeof artifact.time?.created === "number" &&
            continuationRequirement &&
            continuationDecision &&
            artifact.time.created > lastRegistrationCompletion,
        )
        const persistedOnContinuation = requirementSet && continuationRequirement && continuationDecision
        if (!answered || !continuationUser || !continuationAssistant || (!laterQuestion && !persistedOnContinuation)) {
          return undefined
        }
        return {
          answered,
          continuationUser,
          continuationAssistant,
          laterQuestion,
          requirementSet: persistedOnContinuation ? requirementSet : undefined,
        }
      },
    })

    return {
      taskID,
      firstQuestion: first.selected.interaction.body,
      skillToolSessionID: first.selected.skillLoad.sessionID,
      handoffSessionID: first.selected.handoff.sessionID,
      continuation: continued.selected.requirementSet ? "requirement_set" : "next_question",
      requirementCount: continued.selected.requirementSet?.payload.requirements.length ?? 0,
      decisionCount: continued.selected.requirementSet?.payload.decisions.length ?? 0,
    }
  } finally {
    await cancelBenchmarkTask(taskID)
  }
}

function assertConcreteSemanticCoverage(payload: any) {
  const evidence = JSON.stringify(payload).toLowerCase()
  const acceptanceEvidence = payload.requirements
    .map((requirement) => `${requirement.description}\n${requirement.acceptance}`)
    .join("\n")
    .toLowerCase()
  const nonGoalEvidence = payload.requirements
    .map((requirement) => requirement.non_goals)
    .join("\n")
    .toLowerCase()
  const checks: Array<[label: string, present: boolean]> = [
    [
      "compact_logs defaults to false",
      /compact[_ -]?logs/.test(evidence) &&
        (/(default.{0,100}false)/s.test(evidence) || /(false.{0,100}default)/s.test(evidence)),
    ],
    [
      "only consecutive exactly equal informational level-and-text runs collapse",
      /consecutive/.test(evidence) &&
        /info/.test(evidence) &&
        /exact/.test(evidence) &&
        /level/.test(evidence) &&
        /text/.test(evidence),
    ],
    [
      "warnings and errors remain individual and ordered and break runs",
      /warning/.test(evidence) &&
        /error/.test(evidence) &&
        /individual/.test(evidence) &&
        /order/.test(evidence) &&
        /break/.test(evidence),
    ],
    [
      "counts use the ×N form only for N at least 2",
      (evidence.includes("×n") || /text\s*[x×]\s*n/.test(evidence)) &&
        (/at least\s+2/.test(evidence) || /n\s*(?:>=|≥)\s*2/.test(evidence)),
    ],
    [
      "one configuration surface with no environment alias or compatibility path",
      /single/.test(acceptanceEvidence) &&
        /config/.test(acceptanceEvidence) &&
        /(?:no|without|must not|prohibit|exclude)[^\n.]{0,100}(?:environment|env(?:ironment)?-variable)[^\n.]{0,100}(?:alias|override)/.test(
          nonGoalEvidence,
        ) &&
        /(?:no|without|must not|prohibit|exclude)[^\n.]{0,100}compatib/.test(nonGoalEvidence),
    ],
    [
      "Bun, TypeScript, and bun:test are retained",
      /bun/.test(evidence) && /typescript/.test(evidence) && /bun:test/.test(evidence),
    ],
    [
      "focused non-UI tests prove false preserves current output and true performs only the specified compaction",
      /focused/.test(evidence) &&
        /non[- ]?ui/.test(evidence) &&
        /false/.test(evidence) &&
        /preserv|unchang|unmodif|current output/.test(evidence) &&
        /true/.test(evidence) &&
        /only|strict|exclusiv/.test(evidence) &&
        /compact/.test(evidence),
    ],
    [
      "log persistence, protocol events, and UI layout remain non-goals",
      /(?:no|not|without|out of scope|non-goal|exclude)[^\n.]{0,120}persist/.test(nonGoalEvidence) &&
        /(?:no|not|without|out of scope|non-goal|exclude)[^\n.]{0,120}protocol/.test(nonGoalEvidence) &&
        /(?:no|not|without|out of scope|non-goal|exclude)[^\n.]{0,120}ui[^\n.]{0,80}layout/.test(nonGoalEvidence),
    ],
  ]
  const missing = checks.filter(([, present]) => !present).map(([label]) => label)
  if (missing.length > 0) {
    throw new Error(`Concrete benchmark RequirementSet lost explicit semantics: ${missing.join("; ")}`)
  }
}

async function runConcreteCase() {
  const request = [
    "Add an application-level setting named compact_logs with default false.",
    "When true, terminal log rendering collapses consecutive identical informational lines into one visible line with an occurrence count.",
    "Warnings and errors must remain individually visible and in original order.",
    "Informational runs use exact level-and-text equality, warnings and errors break a run, and counts render as `text ×N` only when N is at least 2.",
    "The setting belongs in the existing single configuration surface; no environment-variable alias or compatibility path is allowed.",
    "Acceptance: focused non-UI tests prove false preserves the current output and true performs only the stated informational-line compaction.",
    "Use the repository's existing Bun + TypeScript stack and bun:test harness.",
    "Non-goal: do not change log persistence, protocol events, or UI layout. All product and technical decisions above are final.",
  ].join("\n")
  const { task_id: taskID } = await createBenchmarkTask({ title: "Advanced Grill Concrete Trial", request })

  try {
    const result = await waitForObservation({
      taskID,
      label: "concrete-requirement-set",
      select: (observation) => {
        const registeredRequirement = observation.tools.find(
          (item) =>
            item.agent === "requirement-engineer" &&
            item.tool === "register_requirement" &&
            item.status === "completed",
        )
        if (!registeredRequirement) return undefined
        const skillLoad = observation.tools.find(
          (item) =>
            item.sessionID === registeredRequirement.sessionID &&
            item.agent === "requirement-engineer" &&
            item.tool === "skill" &&
            typeof item.input === "object" &&
            item.input !== null &&
            (item.input as Record<string, unknown>).name === "grill-me" &&
            item.status === "completed",
        )
        const registeredDecision = observation.tools.find(
          (item) =>
            item.sessionID === registeredRequirement.sessionID &&
            item.agent === "requirement-engineer" &&
            item.tool === "register_decision" &&
            item.status === "completed",
        )
        const typedRegistrations = observation.tools.filter(
          (item) =>
            item.sessionID === registeredRequirement.sessionID &&
            (item.tool === "register_requirement" || item.tool === "register_decision") &&
            item.status === "completed",
        )
        const lastRegistrationCompletion = Math.max(
          ...typedRegistrations.map((item) => item.timeCompleted),
          Number.NEGATIVE_INFINITY,
        )
        const requirementSet = observation.requirementSets.find(
          (artifact) =>
            artifactMatchesSessionRegistrations({
              payload: artifact.payload,
              tools: observation.tools,
              sessionID: registeredRequirement.sessionID,
            }) &&
            typeof artifact.time?.created === "number" &&
            registeredDecision &&
            artifact.time.created > lastRegistrationCompletion,
        )
        return skillLoad &&
          registeredDecision &&
          requirementSet &&
          skillLoad.order < registeredRequirement.order &&
          skillLoad.order < registeredDecision.order
          ? { skillLoad, registeredRequirement, registeredDecision, requirementSet }
          : undefined
      },
    })
    const payload = result.selected.requirementSet.payload
    if (payload.requirements.length === 0 || payload.decisions.length === 0) {
      throw new Error("Concrete benchmark RequirementSet did not contain requirements and decisions")
    }
    if (payload.requirements.some((requirement) => !requirement.acceptance.trim() || !requirement.non_goals.trim())) {
      throw new Error("Concrete benchmark RequirementSet contains an unbounded requirement")
    }
    if (result.observation.interactions.length > 0) {
      throw new Error("Concrete benchmark unexpectedly created a user interaction")
    }
    assertConcreteSemanticCoverage(payload)
    return {
      taskID,
      skillToolSessionID: result.selected.skillLoad.sessionID,
      requirementCount: payload.requirements.length,
      decisionCount: payload.decisions.length,
      requirementIDs: payload.requirements.map((requirement) => requirement.id),
    }
  } finally {
    await cancelBenchmarkTask(taskID)
  }
}

try {
  backend = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  const ambiguous = await runAmbiguousCase()
  const concrete = await runConcreteCase()
  const result = { model: MODEL, benchmarkRoot, ambiguous, concrete }
  process.stdout.write(JSON.stringify({ event: "result", ...result }) + "\n")
} finally {
  const cleanupFailures: unknown[] = []
  try {
    await waitForIngressDeliveryHooksForTest()
  } catch (error) {
    cleanupFailures.push(error)
  }
  if (backend) {
    try {
      await backend.stop(true)
    } catch (error) {
      cleanupFailures.push(error)
    }
  }
  try {
    Database.close()
  } catch (error) {
    cleanupFailures.push(error)
  }
  try {
    await removeIsolatedTestRuntime(isolatedRuntime)
  } catch (error) {
    cleanupFailures.push(error)
  }
  if (cleanupFailures.length === 1) throw cleanupFailures[0]
  if (cleanupFailures.length > 1) throw new AggregateError(cleanupFailures, "Advanced requirements cleanup failed")
}
