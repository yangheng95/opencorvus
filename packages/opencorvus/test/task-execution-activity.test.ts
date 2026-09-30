import { afterEach, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import {
  ensureTaskMessageProtocolBridge,
  awaitTaskMessageProtocolBridgeIdle,
} from "@/orchestrator/protocol/message-bridge"
import { requireTask } from "@/engine/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { ProtocolStore } from "@/protocol/store"
import { deriveTaskStatus } from "@/engine/task-status"
import { ensureMissionSession, type MissionSession } from "@/mission/session"
import { missionRecord, missionStatusRecord } from "@/mission/projection"
import { activityFromTaskExecution } from "@/status/task-status-snapshot"
import { Server } from "@/server/server"
import { listWorkLedger } from "@/work-ledger/projection"
import { WorkLedgerEvent } from "@opencorvus-ai/transport-protocol"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { persistEstablishedTask } from "./fixture/engine-task"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function createTask(mission?: MissionSession) {
  const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Activity contract" })
  const taskID = Identifier.ascending("task")
  const revision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.08.13.1",
    packageDigest: "a".repeat(64),
  }
  const now = Date.now()
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: root.title,
    request: "Observe real execution activity",
    productPillar: "work",
    source: mission ? "mission" : "api",
    projectID: Instance.project.id,
    packageRevision: revision,
    metadata: mission
      ? { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } }
      : { actor: "user" },
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: revision.packageDigest,
      timeCreated: now,
    }),
  })
  return { taskID, root }
}

async function begin(sessionID: string) {
  const input = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent: "chat",
    model: { providerID: "test", modelID: "test" },
    time: { created: Date.now() },
  })
  SessionStatus.beginExecutionOccurrence(sessionID, input.id)
  return input.id
}

test("Task, Mission and ledger project park, descendant work and a new input from current execution", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const mission = await ensureMissionSession({
        missionID: "activity-projection",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      const { taskID, root } = await createTask(mission)
      const scheduler = await Session.create({ kind: "orchestrator", parentID: root.id, title: "Scheduler" })
      const worker = await Session.create({ kind: "assistant", parentID: scheduler.id, title: "Independent worker" })
      ensureTaskMessageProtocolBridge()
      const firstInput = await begin(scheduler.id)
      await begin(worker.id)
      async function check(status: "running" | "inactive") {
        const response = await Server.App().request(`/task/${taskID}/status`, {
          headers: { "x-opencorvus-directory": project.path },
        })
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ status, lifecycleStatus: "active" })
        expect(missionRecord(mission).taskStats).toEqual({
          total: 1,
          running: status === "running" ? 1 : 0,
          inactive: status === "inactive" ? 1 : 0,
        })
        expect(missionStatusRecord(mission)).toMatchObject({
          status,
          tasks: [{ taskID, status, lifecycleStatus: "active" }],
        })
        const ledger = await listWorkLedger()
        expect(ledger.rows.find((row) => row.kind === "mission" && row.id === mission.missionID)).toMatchObject({
          tasks: [{ id: taskID, activityStatus: status, lifecycleStatus: "active" }],
        })
      }
      await SessionStatus.set(scheduler.id, { type: "streaming" })
      await check("running")
      await SessionStatus.set(scheduler.id, { type: "idle" })
      await check("inactive")
      await SessionStatus.set(worker.id, { type: "streaming" })
      await check("running")
      await SessionStatus.set(worker.id, { type: "terminal", reason: "completed" })
      await check("inactive")
      const secondInput = await begin(scheduler.id)
      await SessionStatus.set(scheduler.id, {
        type: "retry",
        attempt: 1,
        message: "Transient retry",
        next: Date.now() + 1000,
      })
      await SessionStatus.set(scheduler.id, { type: "idle" }, { inputMessageID: firstInput })
      expect(SessionStatus.executionOccurrence(scheduler.id)?.inputMessageID).toBe(secondInput)
      await check("running")
      await SessionStatus.set(scheduler.id, { type: "idle" })
      await check("inactive")
      // Restart drops process liveness while the durable latest event remains streaming.
      await SessionStatus.set(scheduler.id, { type: "streaming" })
      await awaitTaskMessageProtocolBridgeIdle()
      SessionStatus.release(scheduler.id)
      await check("inactive")
    },
  })
}, 30_000)

test("parallel Task and Project trees retain independent activity, including terminal tasks", async () => {
  await using first = await memoryProject("activity-first")
  await using second = await memoryProject("activity-second")
  let liveSessionID = ""
  await Instance.provide({
    directory: first.path,
    fn: async () => {
      const { taskID, root } = await createTask()
      liveSessionID = root.id
      await begin(root.id)
      await SessionStatus.set(root.id, { type: "streaming" })
      expect(activityFromTaskExecution(taskID, "active")).toBe("running")
      const sibling = await createTask()
      expect(activityFromTaskExecution(sibling.taskID, "active")).toBe("inactive")
      const ledger = await listWorkLedger({ directory: first.path })
      expect(ledger.rows.find((row) => row.id === sibling.taskID)).toMatchObject({
        activityStatus: "inactive",
        lifecycleStatus: "active",
      })
    },
  })
  await Instance.provide({
    directory: second.path,
    fn: async () => {
      const { taskID } = await createTask()
      expect(SessionStatus.get(liveSessionID).type).toBe("streaming")
      expect(activityFromTaskExecution(taskID, "active")).toBe("inactive")
      for (const status of ["completed", "failed", "cancelled"] as const) {
        const terminal = await createTask()
        await begin(terminal.root.id)
        await SessionStatus.set(terminal.root.id, { type: "streaming" })
        ProtocolStore.appendEvent({
          kind: "event",
          type: `task.${status}`,
          aggregate: "task",
          aggregate_id: terminal.taskID,
          session_id: terminal.root.id,
          source: "test.activity-terminal-fact",
          payload: { execution_epoch: 1 },
        })
        const lifecycleStatus = deriveTaskStatus(requireTask(terminal.taskID))
        expect({ lifecycleStatus, activity: activityFromTaskExecution(terminal.taskID, lifecycleStatus) }).toEqual({
          lifecycleStatus: status,
          activity: "inactive",
        })
      }
    },
  })
}, 30_000)

test("global ledger stream delivers real Task execution park and wake invalidations across projects", async () => {
  await using first = await memoryProject("activity-stream-first")
  await using second = await memoryProject("activity-stream-second")
  const abort = new AbortController()
  const response = await Server.App().request("/work-ledger/events", { signal: abort.signal })
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffered = ""
  async function nextTaskEvent(taskID: string) {
    const timeout = setTimeout(() => abort.abort(), 5000)
    try {
      while (true) {
        const frames = buffered.split("\n\n")
        buffered = frames.pop() ?? ""
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (!data) continue
          const event = WorkLedgerEvent.parse(JSON.parse(data))
          if (
            event.type === "work-ledger.changed" &&
            event.sourceType === "agent.execution.lifecycle" &&
            event.taskID === taskID
          )
            return event
        }
        const chunk = await reader.read()
        if (chunk.done) throw new Error("Ledger stream ended before the lifecycle update")
        buffered += decoder.decode(chunk.value, { stream: true })
      }
    } finally {
      clearTimeout(timeout)
    }
  }
  try {
    for (const project of [first, second]) {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const { taskID, root } = await createTask()
          const scheduler = await Session.create({ kind: "orchestrator", parentID: root.id, title: "Event owner" })
          await begin(scheduler.id)
          ensureTaskMessageProtocolBridge()
          for (const type of ["streaming", "idle", "streaming", "idle"] as const) {
            await SessionStatus.set(scheduler.id, { type })
            await awaitTaskMessageProtocolBridgeIdle()
            await Database.awaitEffectIdle(5000)
            expect(await nextTaskEvent(taskID)).toMatchObject({
              type: "work-ledger.changed",
              sourceType: "agent.execution.lifecycle",
              taskID,
              sequence: expect.any(Number),
            })
            expect(activityFromTaskExecution(taskID, "active")).toBe(type === "streaming" ? "running" : "inactive")
          }
        },
      })
    }
  } finally {
    abort.abort()
    await reader.cancel()
  }
}, 30_000)
