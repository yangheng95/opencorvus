import { randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  assertMissionTaskDuplexContract,
  assertMissionTaskTerminalOrder,
  parseDuplexSchedulerEndpoint,
  type DuplexOccurrence,
} from "./mission-task-duplex-contract"

const ALLOW_REAL_PROVIDER = "MISSION_TASK_DUPLEX_E2E_ALLOW_REAL_PROVIDER"
const AUTH_SOURCE = "MISSION_TASK_DUPLEX_E2E_AUTH_SOURCE"
const MODEL = "MISSION_TASK_DUPLEX_E2E_MODEL"
const RESULT = "MISSION_TASK_DUPLEX_E2E_RESULT"
const INACTIVITY_MS = 180_000
const MAX_RUN_MS = 900_000

if (process.env[ALLOW_REAL_PROVIDER] !== "1") {
  throw new Error(`${ALLOW_REAL_PROVIDER}=1 is required because this checker performs real streaming model calls.`)
}
const authoritySource = process.env[AUTH_SOURCE]?.trim()
if (!authoritySource) throw new Error(`${AUTH_SOURCE} must name an existing auth.json authority file.`)
const model = process.env[MODEL]?.trim() || "deepseek/deepseek-chat"
const nonce = `DUPLEX-${randomBytes(5).toString("hex")}`
const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-mission-task-duplex-e2e-"))
const runtimeRoot = path.join(root, "runtime")
const projectDirectory = path.join(root, "project")
const resultPath = process.env[RESULT]?.trim()
  ? path.resolve(process.env[RESULT]!.trim())
  : path.join(root, "result.json")

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
  await fs.mkdir(projectDirectory, { recursive: true })
  await fs.writeFile(path.join(projectDirectory, "README.md"), "# Mission Task duplex E2E\n", "utf8")
  for (const args of [
    ["git", "init", "--initial-branch=main"],
    ["git", "config", "user.name", "OpenCorvus Duplex E2E"],
    ["git", "config", "user.email", "duplex-e2e@opencorvus.invalid"],
    ["git", "add", "README.md"],
    ["git", "commit", "-m", "test: initialize Mission Task duplex e2e"],
  ])
    await command(args, projectDirectory)
}

async function copyAuthority() {
  const source = path.resolve(authoritySource!)
  const stat = await fs.stat(source)
  if (!stat.isFile()) throw new Error(`${AUTH_SOURCE} is not a file: ${source}`)
  const dataDirectory = path.join(runtimeRoot, "data")
  await fs.mkdir(dataDirectory, { recursive: true })
  await fs.copyFile(source, path.join(dataDirectory, "auth.json"))

  const catalogSource = path.join(path.dirname(source), "models.json")
  const catalog = await fs.stat(catalogSource).catch(() => undefined)
  if (!catalog?.isFile()) {
    throw new Error(`The isolated real-provider checker requires the model catalog beside ${AUTH_SOURCE}: ${catalogSource}`)
  }
  await fs.copyFile(catalogSource, path.join(dataDirectory, "models.json"))
}

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
process.env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({ permission: "allow", model, small_model: model })
process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"

await initializeProject()
await copyAuthority()

const [
  { listenWithRecoveredServerRuntime, requireRecoveredServerRuntime },
  { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded },
  { Instance },
  { Database, eq },
  { ProtocolEventTable, ProtocolInboxTable },
  { InteractiveArtifactTable, MessageTable, PartTable, ToolPartRequestTable },
  { EngineTaskTable },
  {
    missionTaskDuplexFinalEvidenceState,
    projectMissionTaskDuplexControlStateInTransaction,
    missionTaskDuplexProgressKey,
    missionTaskDuplexToolHealth,
  },
  { requireMissionSession },
  { missionRecord },
  { ProcessSupervisor },
  { ProviderUsageEventTable },
] = await Promise.all([
  import("@/cli/server-runtime"),
  import("@/engine/host-recovery"),
  import("@/project/instance"),
  import("@/storage/db"),
  import("@/protocol/protocol.sql"),
  import("@/session/session.sql"),
  import("@/engine/engine.sql"),
  import("./mission-task-duplex-snapshot"),
  import("@/mission/session"),
  import("@/mission/projection"),
  import("@/shell/process-supervisor"),
  import("@/usage/usage.sql"),
])

const prepared = await requireRecoveredServerRuntime(await listenWithRecoveredServerRuntime({
  options: { hostname: "127.0.0.1", port: 0, randomPort: true },
  recover: async () => assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions()),
  disposeInstances: () => Instance.disposeAll(),
}))
const server = prepared.server
const base = server.url.toString().replace(/\/$/, "")
const missionURL = new URL(`${base}/mission/wake`)
missionURL.searchParams.set("directory", projectDirectory)

let primaryFailure: unknown
try {
const missionPrompt = [
  `Prove autonomous direct coordination between one Mission and two child Task schedulers. The acceptance nonce is ${nonce}.`,
  "Launch exactly two active child Tasks, first titled 'Duplex responder B' and then 'Duplex initiator A'. Do not create another Task.",
  "Responder B first sends the Mission a one-way READY_B fact containing the nonce. It then remains available for a direct PEER_CONFIRM request from its sibling. It answers that exact request, sends the Mission a one-way B_DONE fact containing the nonce, and completes normally.",
  "Initiator A first sends the Mission a one-way READY_A fact containing the nonce. It then remains available for the Mission's direct START_PEER request, which will contain responder B's exact Task ID. A acknowledges that exact request before asking B for PEER_CONFIRM. After B's correlated answer, A asks the Mission for a DECISION. After the Mission's correlated answer, A sends the Mission a one-way A_DONE fact containing the nonce and completes normally.",
  "After both readiness facts arrive, the Mission asks A to START_PEER and includes B's exact Task ID and the nonce. When A asks for DECISION, answer that exact request with the nonce.",
  `When A_DONE arrives, acknowledge the successful Mission-to-Task, Task-to-Mission, and sibling duplex chain in the next normal Mission response, including the exact literal ${nonce}.`,
  "Every live coordination fact and answer in this scenario must contain the nonce and travel directly between the real schedulers with durable correlation. The operator is not a relay: do not substitute panel or operator messages, Task-history polling, or lifecycle completion for a missing coordination answer.",
  `After each Task terminal notification, reconcile that exact Task and its canonical acceptance evidence. When accepting the last terminal Task makes completion due, publish one final interactive Artifact that summarizes the proven duplex chain and includes ${nonce}; then, in that same response, re-query both current child Tasks, bind each Task's required canonical evidence from that physical Turn, and durably complete the Mission with exactly those two accepted child Tasks.`,
].join("\n")

const wake = await fetch(missionURL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ productPillar: "code", text: missionPrompt, model }),
})
if (!wake.ok) throw new Error(`Mission wake failed ${wake.status}: ${await wake.text()}`)
const mission = (await wake.json()) as { missionID: string; sessionID: string }
process.stdout.write(`[duplex-e2e] mission=${mission.missionID} session=${mission.sessionID} model=${model}\n`)

let lastActivityKey = ""
let lastProgressKey = ""
let lastAcceptanceKey = ""
const absoluteDeadline = Date.now() + MAX_RUN_MS
let deadline = Math.min(absoluteDeadline, Date.now() + INACTIVITY_MS)
let terminal = false
let lastAcceptanceState: Record<string, unknown> = {}
type DuplexControlState = ReturnType<typeof projectMissionTaskDuplexControlStateInTransaction>
let evidence:
  | {
      taskAID: string
      taskBID: string
      events: Array<typeof ProtocolEventTable.$inferSelect>
      inboxes: DuplexControlState["inboxes"]
      sourceToolPartIDs: string[]
      missionAckMessageID: string
      missionCompletion: NonNullable<ReturnType<typeof missionRecord>["completion"]>
      duplexContract: ReturnType<typeof assertMissionTaskDuplexContract>
      terminalOrder: ReturnType<typeof assertMissionTaskTerminalOrder>
      finalArtifactID: string
      usageByAgent: ReturnType<typeof missionTaskDuplexFinalEvidenceState>["usageByAgent"]
      messageCount: number
      toolPartCount: number
    }
  | undefined
while (Date.now() < deadline && Date.now() < absoluteDeadline) {
  const snapshot = Database.use((db) => {
    const persistedTasks = db.select().from(EngineTaskTable).all()
    const events = db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.type, "scheduler.message")).all()
    const persistedInboxes = db.select().from(ProtocolInboxTable).all()
    const toolRequests = db.select().from(ToolPartRequestTable).all()
    const artifacts = db.select().from(InteractiveArtifactTable).all()
    const usage = db.select().from(ProviderUsageEventTable).all()
    const { tasks, inboxes, toolParts } = projectMissionTaskDuplexControlStateInTransaction(db, {
      tasks: persistedTasks,
      inboxes: persistedInboxes,
      toolRequests,
    })
    const messages = db.select().from(MessageTable).all()
    const parts = db.select().from(PartTable).all()
    return {
      tasks,
      events,
      inboxes,
      messages,
      parts,
      toolParts,
      artifacts,
      usage,
      toolHealth: missionTaskDuplexToolHealth(toolParts),
    }
  })
  const missionProjection = missionRecord(await requireMissionSession(mission.sessionID))
  const activityKey = `${snapshot.tasks.length}:${snapshot.events.length}:${snapshot.inboxes.filter((row) => row.status === "delivered").length}:${snapshot.messages.length}:${snapshot.parts.length + snapshot.toolParts.length}`
  if (activityKey !== lastActivityKey) {
    lastActivityKey = activityKey
    process.stdout.write(`[duplex-e2e] activity=${activityKey}\n`)
  }
  const progressKey = missionTaskDuplexProgressKey({
    tasks: snapshot.tasks,
    inboxes: snapshot.inboxes,
    schedulerEventCount: snapshot.events.length,
    missionCompleted: missionProjection.completion !== undefined,
  })
  if (progressKey !== lastProgressKey) {
    lastProgressKey = progressKey
    deadline = Math.min(absoluteDeadline, Date.now() + INACTIVITY_MS)
    process.stdout.write(`[duplex-e2e] progress=${progressKey}\n`)
  }
  const missionTasks = snapshot.tasks.filter((row) => {
    const metadata = row.metadata as { actor?: string; mission?: { id?: string } } | null
    return metadata?.actor === "mission" && metadata.mission?.id === mission.missionID
  })
  const taskA = missionTasks.find((row) => row.title === "Duplex initiator A")
  const taskB = missionTasks.find((row) => row.title === "Duplex responder B")
  if (missionTasks.length === 2 && taskA && taskB) {
    const messages = snapshot.events.map((event) => ({
      event,
      payload: event.payload as {
        message_kind?: string
        source_message_id?: string
        source_part_id?: string
        source_terminal_event_id?: string
        subject?: string
        thread_id?: string
      },
      source: parseDuplexSchedulerEndpoint(event.source),
      target: parseDuplexSchedulerEndpoint(event.target),
    }))
    const taskEndpointID = (value: (typeof messages)[number]["source"]) =>
      value.kind === "task_scheduler" ? value.task_id : undefined
    const hasSubject = (item: (typeof messages)[number], semantic: string) =>
      item.payload.subject === semantic || item.payload.subject?.startsWith(`${semantic} `) === true
    const readyA = messages.find(
      (item) =>
        item.payload.message_kind === "notification" &&
        hasSubject(item, "READY_A") &&
        taskEndpointID(item.source) === taskA.id &&
        item.source?.kind === "task_scheduler" &&
        item.target?.kind === "mission_scheduler",
    )
    const readyB = messages.find(
      (item) =>
        item.payload.message_kind === "notification" &&
        hasSubject(item, "READY_B") &&
        taskEndpointID(item.source) === taskB.id &&
        item.target?.kind === "mission_scheduler",
    )
    const startPeer = messages.find(
      (item) =>
        item.payload.message_kind === "request" &&
        hasSubject(item, "START_PEER") &&
        item.source?.kind === "mission_scheduler" &&
        taskEndpointID(item.target) === taskA.id,
    )
    const peerRequest = messages.find(
      (item) =>
        item.payload.message_kind === "request" &&
        hasSubject(item, "PEER_CONFIRM") &&
        taskEndpointID(item.source) === taskA.id &&
        taskEndpointID(item.target) === taskB.id,
    )
    const peerReply = messages.find(
      (item) =>
        item.payload.message_kind === "reply" &&
        item.event.reply_to === peerRequest?.event.id &&
        taskEndpointID(item.source) === taskB.id &&
        taskEndpointID(item.target) === taskA.id,
    )
    const startPeerReply = messages.find(
      (item) =>
        item.payload.message_kind === "reply" &&
        item.event.reply_to === startPeer?.event.id &&
        taskEndpointID(item.source) === taskA.id &&
        item.target?.kind === "mission_scheduler",
    )
    const decisionRequest = messages.find(
      (item) =>
        item.payload.message_kind === "request" &&
        hasSubject(item, "DECISION") &&
        taskEndpointID(item.source) === taskA.id &&
        item.target?.kind === "mission_scheduler",
    )
    const decisionReply = messages.find(
      (item) =>
        item.payload.message_kind === "reply" &&
        item.event.reply_to === decisionRequest?.event.id &&
        item.source?.kind === "mission_scheduler" &&
        taskEndpointID(item.target) === taskA.id,
    )
    const bDone = messages.find(
      (item) =>
        item.payload.message_kind === "notification" &&
        hasSubject(item, "B_DONE") &&
        taskEndpointID(item.source) === taskB.id &&
        item.target?.kind === "mission_scheduler",
    )
    const aDone = messages.find(
      (item) =>
        item.payload.message_kind === "notification" &&
        hasSubject(item, "A_DONE") &&
        taskEndpointID(item.source) === taskA.id &&
        item.target?.kind === "mission_scheduler",
    )
    const chain = [
      readyA,
      readyB,
      startPeer,
      startPeerReply,
      peerRequest,
      peerReply,
      decisionRequest,
      decisionReply,
      bDone,
      aDone,
    ]
    if (chain.every((item) => item !== undefined)) {
      const exactChain = chain as Array<NonNullable<(typeof chain)[number]>>
      const occurrence = (item: (typeof exactChain)[number]): DuplexOccurrence => {
        const kind = item.payload.message_kind
        if (kind !== "request" && kind !== "reply" && kind !== "notification") {
          throw new Error(`Scheduler event ${item.event.id} has invalid message_kind ${String(kind)}.`)
        }
        if (!item.payload.subject || !item.payload.thread_id) {
          throw new Error(`Scheduler event ${item.event.id} is missing subject or thread_id.`)
        }
        return {
          eventID: item.event.id,
          sequence: item.event.seq,
          emittedAt: item.event.emitted_at,
          kind,
          subject: item.payload.subject,
          source: item.source,
          target: item.target,
          replyTo: item.event.reply_to,
          correlationID: item.event.correlation_id,
          threadID: item.payload.thread_id,
        }
      }
      if (!taskA.session_id || !taskB.session_id || taskA.project_id !== taskB.project_id) {
        throw new Error(`Mission duplex Tasks do not share exact project and root Session authority.`)
      }
      const duplexContract = assertMissionTaskDuplexContract({
        authority: {
          projectID: taskA.project_id,
          missionID: mission.missionID,
          missionSessionID: mission.sessionID,
          taskA: { id: taskA.id, rootSessionID: taskA.session_id },
          taskB: { id: taskB.id, rootSessionID: taskB.session_id },
        },
        chain: {
          readyA: occurrence(readyA!),
          readyB: occurrence(readyB!),
          startPeer: occurrence(startPeer!),
          startPeerReply: occurrence(startPeerReply!),
          peerRequest: occurrence(peerRequest!),
          peerReply: occurrence(peerReply!),
          decisionRequest: occurrence(decisionRequest!),
          decisionReply: occurrence(decisionReply!),
          bDone: occurrence(bDone!),
          aDone: occurrence(aDone!),
        },
      })
      const protocolInboxes = snapshot.inboxes.filter((row) =>
        snapshot.events.some((event) => event.id === row.envelope_id),
      )
      const allDelivered = exactChain.every(
        (item) => protocolInboxes.find((row) => row.envelope_id === item.event.id)?.status === "delivered",
      )
      const sourceToolParts = exactChain.map((item) =>
        snapshot.toolParts.find((row) => row.id === item.payload.source_part_id),
      )
      const allSourceToolsCompleted = sourceToolParts.every((row, index) => {
        if (!row) return false
        const part = row
        const sourceMessage = snapshot.messages.find(
          (message) => message.id === exactChain[index]!.payload.source_message_id,
        )
        const sourceData = sourceMessage?.data as
          | {
              role?: string
              providerID?: string
              time?: { completed?: number }
              error?: unknown
            }
          | undefined
        return (
          part.type === "tool" &&
          part.tool === "scheduler_message" &&
          part.state?.status === "completed" &&
          part.state.input?.kind === exactChain[index]!.payload.message_kind &&
          part.state.input?.message?.includes(nonce) === true &&
          (exactChain[index]!.payload.message_kind !== "reply" ||
            part.state.input?.reply_to === exactChain[index]!.event.reply_to) &&
          sourceData?.role === "assistant" &&
          Boolean(sourceData.providerID && sourceData.time?.completed && !sourceData.error)
        )
      })
      const exactTaskTargetAuthors = [
        [startPeer!, "mission"],
        [peerRequest!, "orchestrator"],
        [peerReply!, "orchestrator"],
        [decisionReply!, "mission"],
      ].every(([item, author]) => {
        const event = (item as NonNullable<typeof startPeer>).event
        const targetMessageID = (
          protocolInboxes.find((row) => row.envelope_id === event.id)?.delivery_result as { message_id?: string } | null
        )?.message_id
        const target = snapshot.messages.find((row) => row.id === targetMessageID)
        const data = target?.data as { role?: string; author?: string } | undefined
        return data?.role === "user" && data.author === author
      })
      const aDoneWakeMessageID = (
        protocolInboxes.find((row) => row.envelope_id === aDone!.event.id)?.delivery_result as {
          message_id?: string
        } | null
      )?.message_id
      const missionAck = snapshot.messages.find((row) => {
        if (row.session_id !== mission.sessionID) return false
        const data = row.data as {
          role?: string
          parentID?: string
          providerID?: string
          time?: { completed?: number }
          error?: unknown
        }
        if (
          data.role !== "assistant" ||
          data.parentID !== aDoneWakeMessageID ||
          !data.providerID ||
          !data.time?.completed ||
          data.error
        )
          return false
        return snapshot.parts
          .filter((part) => part.message_id === row.id)
          .some((part) => {
            const value = part.data as { type?: string; text?: string }
            return value.type === "text" && value.text?.includes(nonce)
          })
      })
      const terminalNotifications = messages.filter(
        (item) =>
          item.payload.message_kind === "notification" &&
          Boolean(item.payload.source_terminal_event_id) &&
          item.target?.kind === "mission_scheduler",
      )
      const terminalReceiptsDelivered = [taskA.id, taskB.id].every((taskID) => {
        const notification = terminalNotifications.find((item) => taskEndpointID(item.source) === taskID)
        return (
          notification !== undefined &&
          protocolInboxes.find((row) => row.envelope_id === notification.event.id)?.status === "delivered"
        )
      })
      const taskTerminalNotifications = terminalNotifications.filter((item) =>
        [taskA.id, taskB.id].includes(taskEndpointID(item.source) ?? ""),
      )
      const expectedEventIDs = new Set([
        ...exactChain.map((item) => item.event.id),
        ...taskTerminalNotifications.map((item) => item.event.id),
      ])
      const exactSchedulerEventSet =
        taskTerminalNotifications.length === 2 &&
        messages.length === 12 &&
        expectedEventIDs.size === 12 &&
        messages.every((item) => expectedEventIDs.has(item.event.id))
      const taskATerminal = taskTerminalNotifications.find((item) => taskEndpointID(item.source) === taskA.id)
      const taskBTerminal = taskTerminalNotifications.find((item) => taskEndpointID(item.source) === taskB.id)
      const terminalOrder =
        taskATerminal && taskBTerminal
          ? assertMissionTaskTerminalOrder({
              authority: {
                projectID: taskA.project_id,
                missionID: mission.missionID,
                missionSessionID: mission.sessionID,
                taskA: { id: taskA.id, rootSessionID: taskA.session_id },
                taskB: { id: taskB.id, rootSessionID: taskB.session_id },
              },
              aDone: occurrence(aDone!),
              bDone: occurrence(bDone!),
              terminalA: occurrence(taskATerminal),
              terminalB: occurrence(taskBTerminal),
            })
          : undefined
      const terminalWakeRepliesCompleted =
        taskTerminalNotifications.length === 2 &&
        taskTerminalNotifications.every((item) => {
          const wakeMessageID = (
            protocolInboxes.find((row) => row.envelope_id === item.event.id)?.delivery_result as {
              message_id?: string
            } | null
          )?.message_id
          return snapshot.messages.some((row) => {
            const data = row.data as {
              role?: string
              parentID?: string
              time?: { completed?: number }
              error?: unknown
            }
            return (
              data.role === "assistant" &&
              data.parentID === wakeMessageID &&
              Boolean(data.time?.completed) &&
              !data.error
            )
          })
        })
      const noFailedToolOccurrences = snapshot.toolHealth.failedToolPartIDs.length === 0
      const finalEvidence = missionTaskDuplexFinalEvidenceState({
        missionSessionID: mission.sessionID,
        completionMessageID: missionProjection.completion?.messageID,
        nonce,
        artifacts: snapshot.artifacts.map((artifact) => ({
          id: artifact.id,
          messageID: artifact.message_id,
          sessionID: snapshot.messages.find((message) => message.id === artifact.message_id)?.session_id ?? "",
          payload: artifact.payload,
        })),
        usage: snapshot.usage.map((row) => ({
          sessionID: row.session_id,
          agentID: row.agent_id,
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          reasoningTokens: row.reasoning_tokens,
          cacheReadTokens: row.cache_read_tokens,
          cacheWriteTokens: row.cache_write_tokens,
          totalTokens: row.total_tokens,
        })),
        requiredUsageOwners: [
          { sessionID: mission.sessionID, agentID: "mission" },
          { sessionID: taskA.session_id, agentID: "orchestrator" },
          { sessionID: taskB.session_id, agentID: "orchestrator" },
        ],
      })
      lastAcceptanceState = {
        chainLength: exactChain.length,
        allDelivered,
        allSourceToolsCompleted,
        exactTaskTargetAuthors,
        missionAck: Boolean(missionAck),
        taskACompleted: taskA.time_completed !== null,
        taskBCompleted: taskB.time_completed !== null,
        terminalReceiptsDelivered,
        terminalWakeRepliesCompleted,
        exactSchedulerEventSet,
        noFailedToolOccurrences,
        finalEvidenceReady: finalEvidence.ready,
        finalEvidenceBlockingReasons: finalEvidence.blockingReasons,
        finalArtifactID: finalEvidence.finalArtifactID,
        missingUsageOwners: finalEvidence.missingUsageOwners,
        missionBoardLane: missionProjection.boardLane,
        missionCompleted: missionProjection.completion !== undefined,
        duplexContract,
        terminalOrder,
      }
      const acceptanceKey = JSON.stringify(lastAcceptanceState)
      if (acceptanceKey !== lastAcceptanceKey) {
        lastAcceptanceKey = acceptanceKey
        process.stdout.write(`[duplex-e2e] acceptance=${acceptanceKey}\n`)
      }
      if (
        allDelivered &&
        allSourceToolsCompleted &&
        exactTaskTargetAuthors &&
        missionAck &&
        taskA.time_completed !== null &&
        taskB.time_completed !== null &&
        terminalReceiptsDelivered &&
        terminalOrder &&
        terminalWakeRepliesCompleted &&
        exactSchedulerEventSet &&
        noFailedToolOccurrences &&
        missionProjection.boardLane === "completed" &&
        missionProjection.completion !== undefined &&
        finalEvidence.ready &&
        finalEvidence.finalArtifactID !== undefined
      ) {
        terminal = true
        evidence = {
          taskAID: taskA.id,
          taskBID: taskB.id,
          events: snapshot.events,
          inboxes: protocolInboxes,
          sourceToolPartIDs: sourceToolParts.map((row) => row!.id),
          missionAckMessageID: missionAck.id,
          missionCompletion: missionProjection.completion,
          duplexContract,
          terminalOrder,
          finalArtifactID: finalEvidence.finalArtifactID,
          usageByAgent: finalEvidence.usageByAgent,
          messageCount: snapshot.messages.length,
          toolPartCount: snapshot.toolParts.length,
        }
        break
      }
    }
  }
  await Bun.sleep(500)
}

  if (!evidence) {
    throw new Error(
      `Mission/Task scheduler duplex did not converge after progress ${lastProgressKey} and activity ${lastActivityKey}: ${JSON.stringify(lastAcceptanceState)}`,
    )
  }
  const turnArtifactsURL = new URL(`${base}/session/${encodeURIComponent(mission.sessionID)}/turn-artifacts`)
  turnArtifactsURL.searchParams.set("directory", projectDirectory)
  process.stdout.write(`[duplex-e2e] protocol-evidence-ready nonce=${nonce}\n`)
  const turnArtifactsResponse = await fetch(turnArtifactsURL, { signal: AbortSignal.timeout(30_000) })
  if (!turnArtifactsResponse.ok) {
    throw new Error(`Mission turn-artifact hydration failed: ${turnArtifactsResponse.status} ${await turnArtifactsResponse.text()}`)
  }
  const turnArtifacts = (await turnArtifactsResponse.json()) as Array<{
    messageID?: string
    task?: { id?: string; status?: string }
  }>
  process.stdout.write(`[duplex-e2e] turn-artifacts=${turnArtifacts.length}\n`)
  for (const taskID of [evidence.taskAID, evidence.taskBID]) {
    if (!turnArtifacts.some((entry) => entry.task?.id === taskID && entry.task.status === "completed")) {
      throw new Error(`Mission turn-artifact hydration is missing completed Task ${taskID}.`)
    }
  }
  const eventSummary = evidence.events.map((event) => ({
    id: event.id,
    sequence: event.seq,
    emittedAt: event.emitted_at,
    kind: (event.payload as { message_kind?: string }).message_kind,
    subject: (event.payload as { subject?: string }).subject,
    threadID: (event.payload as { thread_id?: string }).thread_id,
    source: parseDuplexSchedulerEndpoint(event.source),
    target: parseDuplexSchedulerEndpoint(event.target),
    replyTo: event.reply_to,
    correlationID: event.correlation_id,
  }))
  const result = {
    ok: true,
    model,
    nonce,
    harnessDiscovery: {
      operatorPromptStyle: "outcome_only",
      schedulerToolSelectedByModels: true,
      correlatedMissionRequestAcknowledged: true,
      exactEndpointCorrelationAndOrder: evidence.duplexContract,
      terminalOrder: evidence.terminalOrder,
    },
    missionID: mission.missionID,
    missionSessionID: mission.sessionID,
    taskAID: evidence.taskAID,
    taskBID: evidence.taskBID,
    terminal,
    sourceToolPartIDs: evidence.sourceToolPartIDs,
    missionAckMessageID: evidence.missionAckMessageID,
    missionCompletion: evidence.missionCompletion,
    finalArtifactID: evidence.finalArtifactID,
    trajectory: {
      schedulerEventCount: evidence.events.length,
      messageCount: evidence.messageCount,
      toolPartCount: evidence.toolPartCount,
      failedToolPartCount: 0,
      exactSchedulerEventSet: true,
    },
    usageByAgent: evidence.usageByAgent,
    turnArtifactMessageIDs: turnArtifacts.flatMap((entry) => (entry.messageID ? [entry.messageID] : [])),
    events: eventSummary,
    inboxes: evidence.inboxes.map((row) => ({
      id: row.id,
      eventID: row.envelope_id,
      actor: row.actor,
      actorID: row.actor_id,
      status: row.status,
      attempt: row.attempt,
      deliveryResult: row.delivery_result,
    })),
  }
  await fs.mkdir(path.dirname(resultPath), { recursive: true })
  await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
  process.stdout.write(`[duplex-e2e] PASS evidence=${resultPath}\n`)
} catch (error) {
  primaryFailure = error
  process.stderr.write(`[duplex-e2e] failure=${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
} finally {
  const cleanupFailures: unknown[] = []
  process.stdout.write("[duplex-e2e] cleanup=processes:start\n")
  try {
    await ProcessSupervisor.disposeLiveProcessesUnder(projectDirectory)
  } catch (error) {
    cleanupFailures.push(error)
  }
  process.stdout.write("[duplex-e2e] cleanup=processes:done server:start\n")
  try {
    await server.stop(true)
  } catch (error) {
    cleanupFailures.push(error)
    try {
      await Instance.disposeAll()
    } catch (disposeError) {
      cleanupFailures.push(disposeError)
    }
  }
  process.stdout.write("[duplex-e2e] cleanup=server:done database:start\n")
  try {
    Database.close()
  } catch (error) {
    cleanupFailures.push(error)
  }
  process.stdout.write("[duplex-e2e] cleanup=database:done\n")
  if (!primaryFailure) {
    try {
      await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
    } catch (error) {
      cleanupFailures.push(error)
    }
  } else {
    process.stderr.write(`[duplex-e2e] retained failure root=${root}\n`)
  }
  if (primaryFailure && cleanupFailures.length) {
    throw new AggregateError([primaryFailure, ...cleanupFailures], "Duplex E2E failed during cleanup")
  }
  if (primaryFailure) throw primaryFailure
  if (cleanupFailures.length) throw new AggregateError(cleanupFailures, "Duplex E2E cleanup failed")
}
