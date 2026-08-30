import { afterEach, describe, expect, test } from "bun:test"
import { TestHooks as TaskControlTestHooks } from "../src/engine/task-root-ingress-delivery"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "../src/engine/task-lifecycle"
import { deriveTaskStatus } from "../src/engine/task-status"
import { listMissionTasks, requireTask } from "../src/engine/store"
import { closeMissionExecutionOperation, currentMissionExecutionClosure } from "../src/mission/execution-closure"
import { ensureMissionSession } from "../src/mission/session"
import { Instance } from "../src/project/instance"
import { InstanceBootstrap } from "../src/project/bootstrap"
import { TaskCreationCommitTestHooks } from "../src/task-api"
import {
  MissionTaskCreationClosureError,
} from "../src/task-api/task-creator"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { openMissionThroughRealWake } from "./fixture/mission-opened"
import { Session } from "../src/session"
import { PanelTool } from "../src/tool/panel"
import { Tool } from "../src/tool/tool"
import { Identifier } from "../src/id/id"
import { MissionClosingEffectsTestHooks } from "../src/mission/execution-close-effects"
import { ProtocolStore } from "../src/protocol/store"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { Database } from "../src/storage/db"
import path from "node:path"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function missionFixture(label: string) {
  const mission = await ensureMissionSession({
    missionID: `mission-${label}`,
    defaultCwd: Instance.directory,
    productPillar: "work",
    heldExpertSquadIDs: ["base"],
  })
  const opened = await openMissionThroughRealWake({
    missionID: mission.missionID,
    sessionID: mission.id,
    source: "mission.dispatch",
    requestID: `${label}:dispatch`,
  })
  if (opened.state !== "opened") throw new Error(`Mission ${mission.missionID} did not open`)
  return {
    mission,
  }
}

function panelTaskInput(label: string) {
  return {
    action: "create_task" as const,
    request_id: `${label}:task`,
    title: `Mission child ${label}`,
    request: `Create the Mission child for ${label}`,
    model: "firmware/gpt-5",
    promptProfile: "base",
  }
}

async function executeMissionPanelCreateTask(mission: Awaited<ReturnType<typeof ensureMissionSession>>, label: string) {
  const now = Date.now()
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: mission.id,
    role: "user",
    author: "user",
    time: { created: now },
    agent: "mission",
    model: { providerID: "test", modelID: "mission-task-fence" },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: mission.id,
    role: "assistant",
    author: "mission",
    parentID: user.id,
    time: { created: now + 1 },
    agent: "mission",
    providerID: "test",
    modelID: "mission-task-fence",
    path: { cwd: Instance.directory, root: Instance.project.worktree },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  const callID = `panel-create-${label}`
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: mission.id,
    messageID: assistant.id,
    type: "tool",
    callID,
    tool: "panel",
    state: {
      status: "running",
      input: panelTaskInput(label),
      time: { start: now + 1 },
    },
  })
  const panel = await PanelTool.init({ agentID: "mission" })
  return panel.execute(
    panelTaskInput(label),
    {
      sessionID: mission.id,
      messageID: assistant.id,
      callID,
      agent: "mission",
      abort: new AbortController().signal,
      messages: [],
      executionSurface: Tool.executionSurface(["panel"], []),
      extra: { surface: "panel" },
      metadata() {},
    },
  )
}

function barrier() {
  let arrive!: () => void
  let release!: () => void
  return {
    arrived: new Promise<void>((resolve) => (arrive = resolve)),
    released: new Promise<void>((resolve) => (release = resolve)),
    arrive,
    release,
  }
}

async function waitUntil(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 10_000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`)
    await new Promise<void>((resolve) => setTimeout(resolve, 5))
  }
}

async function seedMissionChild(
  mission: Awaited<ReturnType<typeof ensureMissionSession>>,
  label: string,
  terminal: boolean,
): Promise<string> {
  const root = await Session.create({ kind: "root", title: `Mission bounded child ${label}` })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: mission.projectID,
        session_id: root.id,
        source: "mission",
        product_pillar: "work",
        title: `Mission bounded child ${label}`,
        request: `Settle Mission bounded child ${label}`,
        metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({
      db,
      taskID,
      sessionID: root.id,
      now,
      source: "test.mission-bounded-child",
    })
    if (!terminal) return
    ProtocolStore.appendEventInTransaction({
      kind: "event",
      type: "task.completed",
      aggregate: "task",
      aggregate_id: taskID,
      task_id: null,
      session_id: root.id,
      source: "test.mission-bounded-child",
      emitted_at: now + 1,
      payload: { execution_epoch: 1 },
    })
  })
  return taskID
}

describe("Mission Task creation exact opened occurrence", () => {
  test("commits the Mission child first, then the durable close cancels that stable child and closes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const { mission } = await missionFixture("task-first")
        const commit = barrier()
        using _persist = TaskCreationCommitTestHooks.installBeforePersist(async () => {
          commit.arrive()
          await commit.released
        })

        const creating = executeMissionPanelCreateTask(mission, "task-first")
        await commit.arrived
        commit.release()
        const result = await creating
        const taskID = JSON.parse(result.output).task_id as string
        const committed = requireTask(taskID)
        expect({
          missionChildren: listMissionTasks({
            projectID: mission.projectID,
            missionID: mission.missionID,
            sessionID: mission.id,
          }).map((task) => task.id),
          taskStatus: deriveTaskStatus(committed),
          closureState: currentMissionExecutionClosure(mission.id)?.state,
        }).toEqual({
          missionChildren: [taskID],
          taskStatus: "active",
          closureState: "opened",
        })

        const closed = await closeMissionExecutionOperation({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "task-first:close",
          provenance: {
            kind: "request",
            surface: "api",
            reason: "Close after the exact Mission child commit",
          },
          signal: AbortSignal.timeout(20_000),
        })

        expect({
          closureState: closed.state,
          childStatus: deriveTaskStatus(requireTask(taskID)),
        }).toEqual({
          closureState: "closed",
          childStatus: "cancelled",
        })
      },
    })
  }, 120_000)

  test("cancels active Mission children in fixed batches across a large terminal history", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const { mission } = await missionFixture("bounded-child-cancellation")
        const terminalTaskIDs: string[] = []
        for (let index = 0; index < 70; index += 1) {
          terminalTaskIDs.push(await seedMissionChild(mission, `terminal-${index}`, true))
        }
        const activeTaskIDs: string[] = []
        for (let index = 0; index < 9; index += 1) {
          activeTaskIDs.push(await seedMissionChild(mission, `active-${index}`, false))
        }

        let activeCancellations = 0
        let maximumActiveCancellations = 0
        const releases: Array<() => void> = []
        using _capacity = MissionClosingEffectsTestHooks.installBeforeChildTaskCancellation(async () => {
          activeCancellations += 1
          maximumActiveCancellations = Math.max(maximumActiveCancellations, activeCancellations)
          await new Promise<void>((resolve) => releases.push(resolve))
          activeCancellations -= 1
        })

        const closing = closeMissionExecutionOperation({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "bounded-child-cancellation:close",
          provenance: {
            kind: "request",
            surface: "api",
            reason: "Close through fixed Mission child cancellation batches",
          },
          signal: AbortSignal.timeout(30_000),
        })
        const observedBatchSizes: number[] = []
        for (const expectedSize of [4, 4, 1]) {
          await waitUntil(() => releases.length >= expectedSize, `Mission child cancellation batch ${observedBatchSizes.length + 1}`)
          observedBatchSizes.push(releases.length)
          const currentBatch = releases.splice(0)
          for (const release of currentBatch) release()
        }
        const closed = await closing

        expect({
          closureState: closed.state,
          observedBatchSizes,
          maximumActiveCancellations,
          activeOutcomes: activeTaskIDs.map((taskID) => deriveTaskStatus(requireTask(taskID))),
          terminalOutcomes: terminalTaskIDs.map((taskID) => deriveTaskStatus(requireTask(taskID))),
          childCount: listMissionTasks({
            projectID: mission.projectID,
            missionID: mission.missionID,
            sessionID: mission.id,
          }).length,
        }).toEqual({
          closureState: "closed",
          observedBatchSizes: [4, 4, 1],
          maximumActiveCancellations: 4,
          activeOutcomes: Array.from({ length: 9 }, () => "cancelled"),
          terminalOutcomes: Array.from({ length: 70 }, () => "completed"),
          childCount: 79,
        })
      },
    })
  }, 120_000)

  test("returns a typed closure result when closing commits before the stale opened Task insert", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const { mission } = await missionFixture("close-first")
        const commit = barrier()
        let preparedTaskID: string | undefined
        let cleanupReceipt: { taskID: string; root: string; status: "removed" } | undefined
        using _cleanup = TaskCreationCommitTestHooks.installAfterRejectedPreparationCleanup((receipt) => {
          cleanupReceipt = receipt
        })
        using _persist = TaskCreationCommitTestHooks.installBeforePersist(async ({ taskID }) => {
          preparedTaskID = taskID
          commit.arrive()
          await commit.released
        })
        const creating = executeMissionPanelCreateTask(mission, "close-first")
        await commit.arrived
        const closed = await closeMissionExecutionOperation({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "close-first:close",
          provenance: {
            kind: "request",
            surface: "api",
            reason: "Close before the stale Mission Task insertion",
          },
          signal: AbortSignal.timeout(20_000),
        })

        let result: { kind: "typed_closure"; state: string; eventID: string } | undefined
        try {
          commit.release()
          await creating
        } catch (error) {
          if (!MissionTaskCreationClosureError.isInstance(error)) throw error
          const data = error.toObject().data
          result = {
            kind: "typed_closure",
            state: data.currentState,
            eventID: data.currentClosureEventID!,
          }
        }

        expect({
          closedState: closed.state,
          result,
          missionChildren: listMissionTasks({
            projectID: mission.projectID,
            missionID: mission.missionID,
            sessionID: mission.id,
          }).map((task) => task.id),
          cleanupReceipt,
        }).toEqual({
          closedState: "closed",
          result: {
            kind: "typed_closure",
            state: "closed",
            eventID: closed.eventID,
          },
          missionChildren: [],
          cleanupReceipt: {
            taskID: preparedTaskID,
            root: path.resolve(ProjectRuntimePaths.taskRoot(project.path, preparedTaskID!)),
            status: "removed",
          },
        })
      },
    })
  }, 120_000)
})
