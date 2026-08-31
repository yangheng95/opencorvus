import { afterEach, describe, expect, test } from "bun:test"
import { TestHooks as TaskControlTestHooks } from "../src/engine/task-root-ingress-delivery"
import { EngineTaskCreationContractTable, EngineTaskTable } from "../src/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "../src/engine/task-lifecycle"
import { deriveTaskStatus } from "../src/engine/task-status"
import { listMissionTasks, requireTask } from "../src/engine/store"
import { closeMissionExecutionOperation, currentMissionExecutionClosure } from "../src/mission/execution-closure"
import { ensureMissionSession } from "../src/mission/session"
import { Instance } from "../src/project/instance"
import { InstanceBootstrap } from "../src/project/bootstrap"
import { EngineService, TaskCreationCommitTestHooks } from "../src/task-api"
import {
  MissionTaskCreationClosureError,
} from "../src/task-api/task-creator"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { openMissionThroughRealWake } from "./fixture/mission-opened"
import { Session } from "../src/session"
import { PanelTool, recoverPanelCreationToolPart } from "../src/tool/panel"
import type { Message } from "../src/session/message"
import { Tool } from "../src/tool/tool"
import { Identifier } from "../src/id/id"
import { MissionClosingEffectsTestHooks } from "../src/mission/execution-close-effects"
import { ProtocolStore } from "../src/protocol/store"
import { Database, eq } from "../src/storage/db"
import {
  exportMysqlTransferSnapshot,
  MysqlTransferValidationError,
  preflightMysqlTransferSnapshot,
} from "../src/storage/mysql-transfer"
import { taskCreationContractFingerprint } from "../src/engine/task-creation-contract"

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

function panelTaskInput(label: string, explicitRuntime = true) {
  return {
    action: "create_task" as const,
    request_id: `${label}:task`,
    title: `Mission child ${label}`,
    request: `Create the Mission child for ${label}`,
    promptProfile: "base",
    ...(explicitRuntime ? { model: "firmware/gpt-5" } : {}),
  }
}

async function executeMissionPanelCreateTask(
  mission: Awaited<ReturnType<typeof ensureMissionSession>>,
  label: string,
  explicitRuntime = true,
) {
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
      input: panelTaskInput(label, explicitRuntime),
      time: { start: now + 1 },
    },
  })
  const panel = await PanelTool.init({ agentID: "mission" })
  return panel.execute(
    panelTaskInput(label, explicitRuntime),
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
  test("replays a committed panel.create_task target from the exact persisted Tool occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const { mission } = await missionFixture("tool-replay")
        const first = await executeMissionPanelCreateTask(mission, "tool-replay")
        const taskID = JSON.parse(first.output).task_id as string
        await Database.awaitEffectIdle(10_000)
        const snapshot = exportMysqlTransferSnapshot()
        expect(preflightMysqlTransferSnapshot(snapshot)).toMatchObject({
          schemaFingerprint: snapshot.schemaFingerprint,
        })
        const staleOpened = structuredClone(snapshot)
        const staleContractRow = staleOpened.tables.find((table) => table.name === "engine_task_creation_contract")
          ?.rows.find((row) => row.task_id === taskID)
        if (!staleContractRow) throw new Error("Mission transfer omitted its Task creation contract")
        const staleContract = JSON.parse(String(staleContractRow.contract)) as Record<string, any>
        staleContract.request.input.creator.opened_occurrence.event_id = "pev_missing_opened"
        staleContract.resolved.creator.opened_occurrence.event_id = "pev_missing_opened"
        staleContractRow.contract = JSON.stringify(staleContract)
        staleContractRow.fingerprint = taskCreationContractFingerprint(staleContract.request)
        expect(() => preflightMysqlTransferSnapshot(staleOpened)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({
              message: expect.stringContaining("invalid panel Tool creator lineage"),
            }),
          }),
        )
        const changedPanelCaller = structuredClone(snapshot)
        const changedPanelContractRow = changedPanelCaller.tables
          .find((table) => table.name === "engine_task_creation_contract")
          ?.rows.find((row) => row.task_id === taskID)
        if (!changedPanelContractRow) throw new Error("Mission transfer omitted its Task creation contract")
        const changedPanelContract = JSON.parse(String(changedPanelContractRow.contract)) as Record<string, any>
        changedPanelContract.request.input.request = "divergent transferred panel request"
        changedPanelContractRow.contract = JSON.stringify(changedPanelContract)
        changedPanelContractRow.fingerprint = taskCreationContractFingerprint(changedPanelContract.request)
        expect(() => preflightMysqlTransferSnapshot(changedPanelCaller)).toThrow(
          expect.objectContaining<MysqlTransferValidationError>({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({
              message: expect.stringContaining("invalid panel Tool creator lineage"),
            }),
          }),
        )
        const transcript = await Session.messages({ sessionID: mission.id })
        const owner = transcript
          .flatMap((message) =>
            message.parts
              .filter(
                (part): part is Message.ToolPart =>
                  part.type === "tool" && part.callID === "panel-create-tool-replay",
              )
              .map((part) => ({ messageID: message.info.id, part })),
          )
          .at(0)
        if (!owner) throw new Error("Persisted panel.create_task Tool occurrence was not found")
        const replay = await recoverPanelCreationToolPart({
          sessionID: mission.id,
          messageID: owner.messageID,
          agent: "mission",
          part: owner.part,
        })
        expect(replay).toEqual(first)
        const task = requireTask(taskID)
        Database.immediateTransaction(() => {
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: taskID,
            task_id: null,
            session_id: task.session_id,
            source: "test.panel-create-retention",
            emitted_at: Date.now(),
            payload: { execution_epoch: 1 },
          })
        })
        expect(await EngineService.deleteTask(taskID, { projectID: Instance.project.id })).toBe(true)
        const unavailable = await recoverPanelCreationToolPart({
          sessionID: mission.id,
          messageID: owner.messageID,
          agent: "mission",
          part: owner.part,
        })
        expect(JSON.parse(unavailable!.output)).toEqual({
          kind: "accepted_target_unavailable",
          operation: "create_task",
          target_id: taskID,
          message: `The accepted create_task target ${taskID} is no longer available.`,
        })
      },
    })
  }, 120_000)

  test("keeps inherited Mission runtime values out of the immutable caller request", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const { mission } = await missionFixture("inherited-caller-semantics")
        const result = await executeMissionPanelCreateTask(mission, "inherited-caller-semantics", false)
        const taskID = JSON.parse(result.output).task_id as string
        const contract = Database.use((db) =>
          db
            .select({ contract: EngineTaskCreationContractTable.contract })
            .from(EngineTaskCreationContractTable)
            .where(eq(EngineTaskCreationContractTable.task_id, taskID))
            .get()?.contract as any,
        )
        expect({
          caller: {
            model: contract.request.input.explicit_model,
            profile: contract.request.input.explicit_prompt_profile,
            source: contract.request.input.explicit_source,
            productPillar: contract.request.input.explicit_product_pillar,
          },
          resolved: {
            model: contract.resolved.effective_model,
            profile: contract.resolved.prompt_profile_id,
            source: contract.resolved.source,
            productPillar: contract.resolved.product_pillar,
          },
        }).toEqual({
          caller: { model: null, profile: "base", source: null, productPillar: null },
          resolved: {
            model: expect.any(String),
            profile: "base",
            source: "mission",
            productPillar: "work",
          },
        })
      },
    })
  }, 120_000)

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
        using _persist = TaskCreationCommitTestHooks.installBeforePersist(async () => {
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
        }).toEqual({
          closedState: "closed",
          result: {
            kind: "typed_closure",
            state: "closed",
            eventID: closed.eventID,
          },
          missionChildren: [],
        })
      },
    })
  }, 120_000)
})
