import { randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const ALLOW_REAL_PROVIDER = "MISSION_TASK_DUPLEX_E2E_ALLOW_REAL_PROVIDER"
const AUTH_SOURCE = "MISSION_TASK_DUPLEX_E2E_AUTH_SOURCE"
const MODEL = "MISSION_TASK_DUPLEX_E2E_MODEL"
const RESULT = "MISSION_TASK_DUPLEX_E2E_RESULT"
const INACTIVITY_MS = 180_000

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
  const target = path.join(runtimeRoot, "data", "auth.json")
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(source, target)
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
  { listenWithRecoveredServerRuntime },
  { recoverStartedTaskExecutions, assertStartedTaskProjectRecoverySucceeded },
  { Instance },
  { Database, eq },
  { ProtocolEventTable, ProtocolInboxTable },
  { MessageTable, PartTable },
  { EngineTaskTable },
  { ProcessSupervisor },
] = await Promise.all([
  import("@/cli/server-runtime"),
  import("@/engine/host-recovery"),
  import("@/project/instance"),
  import("@/storage/db"),
  import("@/protocol/protocol.sql"),
  import("@/session/session.sql"),
  import("@/engine/engine.sql"),
  import("@/shell/process-supervisor"),
])

const prepared = await listenWithRecoveredServerRuntime({
  options: { hostname: "127.0.0.1", port: 0, randomPort: true },
  recover: async () => assertStartedTaskProjectRecoverySucceeded(await recoverStartedTaskExecutions()),
  disposeInstances: () => Instance.disposeAll(),
})
const server = prepared.server
const base = server.url.toString().replace(/\/$/, "")
const missionURL = new URL(`${base}/mission/wake`)
missionURL.searchParams.set("directory", projectDirectory)

let primaryFailure: unknown
try {
const missionPrompt = [
  `This is a focused scheduler duplex acceptance run with nonce ${nonce}.`,
  "A visible scheduler reply Message is conclusive delivery evidence for the request named by reply_to. Act on it in that same wake; never query history or continue waiting for that already-delivered reply.",
  "Create exactly two child Tasks using panel.create_task with queue=false: first title 'Duplex responder B', then title 'Duplex initiator A'. Do not create any other Task.",
  "Responder B must use only scheduler_message for this protocol: send notification to Mission subject READY_B with the nonce, then end that Turn without calling wait; the runtime scheduler message will wake it. On a sibling scheduler request subject PEER_CONFIRM, reply with kind=reply and its exact event_id; then notify Mission subject B_DONE with the nonce and immediately complete the Task through the normal Task lifecycle.",
  "Initiator A must use only scheduler_message for this protocol: send notification to Mission subject READY_A with the nonce, then end that Turn without calling wait; the runtime scheduler message will wake it with START_PEER containing responder B's exact Task ID.",
  "After START_PEER arrives, Initiator A sends kind=request to that exact sibling Task B with subject PEER_CONFIRM and the nonce. After B's correlated reply arrives, A sends kind=request to Mission subject DECISION with the nonce. After Mission's correlated reply arrives, A notifies Mission subject A_DONE with the nonce and immediately completes the Task through the normal Task lifecycle.",
  "When both READY_A and READY_B arrive, send scheduler_message kind=request to exact Initiator A, subject START_PEER, with a message containing the exact responder B Task ID and nonce.",
  `When DECISION arrives from A, reply through scheduler_message with the exact request event_id and nonce. When A_DONE arrives, make the next normal Mission response include the exact literal ${nonce} and acknowledge the successful Mission-Task/sibling duplex chain; do not query Tasks or call another tool before that acknowledgement.`,
  "After that acknowledgement, end the Mission without publishing interactive artifacts or performing unrelated follow-up work.",
  "Do not substitute panel messages, operator messages, polling, or completion for any scheduler_message step.",
].join("\n")

const wake = await fetch(missionURL, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ productPillar: "code", text: missionPrompt, model }),
})
if (!wake.ok) throw new Error(`Mission wake failed ${wake.status}: ${await wake.text()}`)
const mission = (await wake.json()) as { missionID: string; sessionID: string }
process.stdout.write(`[duplex-e2e] mission=${mission.missionID} session=${mission.sessionID} model=${model}\n`)

function endpoint(value: string | null) {
  if (!value?.startsWith("scheduler-endpoint:")) return undefined
  return JSON.parse(value.slice("scheduler-endpoint:".length)) as { kind: string; task_id?: string }
}

let lastActivityKey = ""
let lastAcceptanceKey = ""
let deadline = Date.now() + INACTIVITY_MS
let terminal = false
let lastAcceptanceState: Record<string, unknown> = {}
let evidence:
  | {
      taskAID: string
      taskBID: string
      events: Array<typeof ProtocolEventTable.$inferSelect>
      inboxes: Array<typeof ProtocolInboxTable.$inferSelect>
      sourceToolPartIDs: string[]
      missionAckMessageID: string
    }
  | undefined
while (Date.now() < deadline) {
  const snapshot = Database.use((db) => {
    const tasks = db.select().from(EngineTaskTable).all()
    const events = db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.type, "scheduler.message")).all()
    const inboxes = db.select().from(ProtocolInboxTable).all()
    const messages = db.select().from(MessageTable).all()
    const parts = db.select().from(PartTable).all()
    return { tasks, events, inboxes, messages, parts }
  })
  const activityKey = `${snapshot.tasks.length}:${snapshot.events.length}:${snapshot.inboxes.filter((row) => row.status === "delivered").length}:${snapshot.messages.length}:${snapshot.parts.length}`
  if (activityKey !== lastActivityKey) {
    lastActivityKey = activityKey
    deadline = Date.now() + INACTIVITY_MS
    process.stdout.write(`[duplex-e2e] activity=${activityKey}\n`)
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
      },
      source: endpoint(event.source),
      target: endpoint(event.target),
    }))
    const readyA = messages.find(
      (item) =>
        item.payload.message_kind === "notification" &&
        item.payload.subject === "READY_A" &&
        item.source?.task_id === taskA.id &&
        item.source?.kind === "task_scheduler" &&
        item.target?.kind === "mission_scheduler",
    )
    const readyB = messages.find(
      (item) =>
        item.payload.message_kind === "notification" &&
        item.payload.subject === "READY_B" &&
        item.source?.task_id === taskB.id &&
        item.target?.kind === "mission_scheduler",
    )
    const startPeer = messages.find(
      (item) =>
        item.payload.message_kind === "request" &&
        item.payload.subject === "START_PEER" &&
        item.source?.kind === "mission_scheduler" &&
        item.target?.task_id === taskA.id,
    )
    const peerRequest = messages.find(
      (item) =>
        item.payload.message_kind === "request" &&
        item.payload.subject === "PEER_CONFIRM" &&
        item.source?.task_id === taskA.id &&
        item.target?.task_id === taskB.id,
    )
    const peerReply = messages.find(
      (item) =>
        item.payload.message_kind === "reply" &&
        item.event.reply_to === peerRequest?.event.id &&
        item.source?.task_id === taskB.id &&
        item.target?.task_id === taskA.id,
    )
    const decisionRequest = messages.find(
      (item) =>
        item.payload.message_kind === "request" &&
        item.payload.subject === "DECISION" &&
        item.source?.task_id === taskA.id &&
        item.target?.kind === "mission_scheduler",
    )
    const decisionReply = messages.find(
      (item) =>
        item.payload.message_kind === "reply" &&
        item.event.reply_to === decisionRequest?.event.id &&
        item.source?.kind === "mission_scheduler" &&
        item.target?.task_id === taskA.id,
    )
    const bDone = messages.find(
      (item) =>
        item.payload.message_kind === "notification" &&
        item.payload.subject === "B_DONE" &&
        item.source?.task_id === taskB.id &&
        item.target?.kind === "mission_scheduler",
    )
    const aDone = messages.find(
      (item) =>
        item.payload.message_kind === "notification" &&
        item.payload.subject === "A_DONE" &&
        item.source?.task_id === taskA.id &&
        item.target?.kind === "mission_scheduler",
    )
    const chain = [readyA, readyB, startPeer, peerRequest, peerReply, decisionRequest, decisionReply, bDone, aDone]
    if (chain.every((item) => item !== undefined)) {
      const exactChain = chain as Array<NonNullable<(typeof chain)[number]>>
      const protocolInboxes = snapshot.inboxes.filter((row) =>
        snapshot.events.some((event) => event.id === row.envelope_id),
      )
      const allDelivered = exactChain.every(
        (item) => protocolInboxes.find((row) => row.envelope_id === item.event.id)?.status === "delivered",
      )
      const sourceToolParts = exactChain.map((item) =>
        snapshot.parts.find((row) => row.id === item.payload.source_part_id),
      )
      const allSourceToolsCompleted = sourceToolParts.every((row, index) => {
        if (!row) return false
        const part = row.data as {
          type?: string
          tool?: string
          state?: { status?: string; input?: { kind?: string; reply_to?: string; message?: string } }
        }
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
        const notification = terminalNotifications.find((item) => item.source?.task_id === taskID)
        return (
          notification !== undefined &&
          protocolInboxes.find((row) => row.envelope_id === notification.event.id)?.status === "delivered"
        )
      })
      const taskTerminalNotifications = terminalNotifications.filter((item) =>
        [taskA.id, taskB.id].includes(item.source?.task_id ?? ""),
      )
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
        terminalWakeRepliesCompleted
      ) {
        terminal = true
        evidence = {
          taskAID: taskA.id,
          taskBID: taskB.id,
          events: snapshot.events,
          inboxes: protocolInboxes,
          sourceToolPartIDs: sourceToolParts.map((row) => row!.id),
          missionAckMessageID: missionAck.id,
        }
        break
      }
    }
  }
  await Bun.sleep(500)
}

  if (!evidence) {
    throw new Error(
      `Mission/Task scheduler duplex did not converge after activity ${lastActivityKey}: ${JSON.stringify(lastAcceptanceState)}`,
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
    kind: (event.payload as { message_kind?: string }).message_kind,
    source: endpoint(event.source),
    target: endpoint(event.target),
    replyTo: event.reply_to,
    correlationID: event.correlation_id,
  }))
  const result = {
    ok: true,
    model,
    nonce,
    missionID: mission.missionID,
    missionSessionID: mission.sessionID,
    taskAID: evidence.taskAID,
    taskBID: evidence.taskBID,
    terminal,
    sourceToolPartIDs: evidence.sourceToolPartIDs,
    missionAckMessageID: evidence.missionAckMessageID,
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
