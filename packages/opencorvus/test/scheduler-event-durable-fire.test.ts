import { afterAll, describe, expect, test } from "bun:test"
import { EventJobDefinitionTombstoneTable, EventJobFireReceiptTable, EventJobFireTable, EventJobTable, EventOccurrenceTable } from "../src/scheduler/event.sql"
import { EventService } from "../src/scheduler/event-service"
import { Instance } from "../src/project/instance"
import { Database, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Config } from "@/config/config"
import { provideInitializedProjectExecution } from "@/project/independent-project-owner"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import {
  closeMissionExecutionOperation,
  missionOperatorWakeReason,
  openMissionExecutionWithWake,
} from "@/mission/execution-closure"
import { ensureMissionSession } from "@/mission/session"
import {
  exportMysqlTransferSnapshot,
  importMysqlTransferSnapshot,
  MysqlTransferValidationError,
  preflightMysqlTransferSnapshot,
} from "@/storage/mysql-transfer"

afterAll(resetMemoryDatabase)

const TYPE = "test.scheduler.event.fact"

async function openMissionOccurrence(
  mission: Awaited<ReturnType<typeof ensureMissionSession>>,
  requestID: string,
): Promise<void> {
  await openMissionExecutionWithWake({
    missionID: mission.missionID,
    sessionID: mission.id,
    source: "mission.wake",
    requestID,
    acceptedInput: {
      text: `Open Mission occurrence ${requestID}`,
      model: null,
      attachments: [],
      configPatch: {},
      context: { surface: "test.scheduler-event" },
    },
    wake: (admission) =>
      SessionWake.wakeWithReceipt({
        sessionID: mission.id,
        messageID: admission.messageID,
        textPartID: admission.textPartID,
        controlID: admission.controlID,
        prompt: `Open Mission occurrence ${requestID}`,
        author: "user",
        agent: "mission",
        surface: "panel",
        userAuthored: true,
        reason: missionOperatorWakeReason(admission, mission.missionID),
        commitBundle: admission.commitBundle,
        preflightBundle: admission.preflightBundle,
        ownerPreflight: admission.ownerPreflight,
        ownerLifecycle: admission.ownerLifecycle,
      }),
  })
}

async function configureMissionWakeModel(): Promise<void> {
  await Config.updateProjectPatch({
    model: "scheduler-event-mission/wake-model",
    provider: {
      "scheduler-event-mission": {
        name: "Scheduler Event Mission test",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:1/v1",
        models: {
          "wake-model": {
            name: "Scheduler Event Mission model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 32_000, output: 4_096 },
          },
        },
      },
    },
  })
}

describe("Event Job durable fact authority", () => {
  test("settles an old Mission fire against its first opened occurrence after close and reopen", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: "scheduler-event-mission/wake-model",
          provider: {
            "scheduler-event-mission": {
              name: "Scheduler Event Mission test",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: {
                "wake-model": {
                  name: "Scheduler Event Mission model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 32_000, output: 4_096 },
                },
              },
            },
          },
        })
        const mission = await ensureMissionSession({
          missionID: `event-mission-${Date.now()}`,
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        await openMissionOccurrence(mission, "event-old-occurrence")
        const job = await EventService.create({
          name: "Mission closure disposition",
          eventType: TYPE,
          prompt: "This old fire must not cross the reopen.",
          projectId: Instance.project.id,
          sessionId: mission.id,
        })
        using _admission = EventService.TestHooks.installBeforeSessionWake(async () => {
          await closeMissionExecutionOperation({
            missionID: mission.missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "close-event-old-occurrence",
            provenance: { kind: "request", surface: "api", reason: "Close the Event fire occurrence" },
            signal: AbortSignal.timeout(20_000),
          })
          await openMissionOccurrence(mission, "event-new-occurrence")
        })
        await EventService.TestHooks.acceptEnvelope({
          occurrenceID: `event:mission-close:${Date.now()}`,
          type: TYPE,
          properties: { exact: true },
        })
        await EventService.TestHooks.waitForIdle()
        const fire = EventService.TestHooks.fires(Instance.project.id).find((candidate) => candidate.event_job_id === job.id)!
        expect(fire).toMatchObject({
          status: "disposition",
          disposition: "mission_closed",
          mission_opened_event_id: expect.stringMatching(/^pev_/),
          closure_event_id: expect.stringMatching(/^pev_/),
        })
      },
    })
  }, 60_000)

  test("a closed Mission fire survives acceptance crash and terminalizes in FIFO recovery after reopen", async () => {
    await using project = await memoryProject()
    const missionID = `event-closed-reservation-${Date.now()}`
    const first = await Instance.provide({ directory: project.path, fn: async () => {
      await Config.updateProjectPatch({
        model: "scheduler-event-mission/wake-model",
        provider: {
          "scheduler-event-mission": {
            name: "Scheduler Event Mission test",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              "wake-model": {
                name: "Scheduler Event Mission model",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 32_000, output: 4_096 },
              },
            },
          },
        },
      })
      const mission = await ensureMissionSession({
        missionID,
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      await openMissionOccurrence(mission, "event-closed-reservation-open")
      const job = await EventService.create({
        name: "Closed Mission Event reservation",
        eventType: TYPE,
        prompt: "Never deliver this closed Mission fire.",
        projectId: Instance.project.id,
        sessionId: mission.id,
      })
      const closed = await closeMissionExecutionOperation({
        missionID,
        sessionID: mission.id,
        source: "mission.abort",
        requestID: "event-closed-reservation-close",
        provenance: { kind: "request", surface: "api", reason: "Close before Event reservation" },
        signal: AbortSignal.timeout(20_000),
      })
      using _crash = EventService.TestHooks.installFireAcceptedHook(() => {
        throw new Error("simulated Event process crash after durable reservation")
      })
      await expect(EventService.TestHooks.acceptEnvelope({
        occurrenceID: `event:closed-reservation:${Date.now()}`,
        type: TYPE,
        properties: { exact: true },
      })).rejects.toThrow("simulated Event process crash")
      const fire = Database.use((db) => {
        const revision = db.select({ id: EventJobTable.id }).from(EventJobTable)
          .where(eq(EventJobTable.definition_id, job.id)).get()!
        return db.select().from(EventJobFireTable)
          .where(eq(EventJobFireTable.event_job_revision_id, revision.id)).get()!
      })
      const receipts = Database.use((db) => db.select().from(EventJobFireReceiptTable)
        .where(eq(EventJobFireReceiptTable.fire_id, fire.id)).all())
      return { missionSessionID: mission.id, jobID: job.id, fireID: fire.id, closureEventID: closed.eventID, fire, receipts }
    } })

    await Instance.provide({ directory: project.path, fn: async () => {
      const mission = await ensureMissionSession({
        missionID,
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      await openMissionOccurrence(mission, "event-closed-reservation-reopen")
      EventService.TestHooks.recoverProjectFires(Instance.project.id)
      await EventService.TestHooks.waitForIdle()
      const recovered = EventService.TestHooks.fires(Instance.project.id).find((fire) => fire.id === first.fireID)
      const recoveredReceipts = Database.use((db) =>
        db.select().from(EventJobFireReceiptTable).where(eq(EventJobFireReceiptTable.fire_id, first.fireID)).all(),
      )
      expect({ first, recovered, recoveredReceipts }).toMatchObject({
        first: {
          fire: {
            mission_opened_event_id: null,
            mission_disposition: "mission_closed",
            mission_closure_event_id: first.closureEventID,
          },
          receipts: [],
        },
        recovered: {
          status: "disposition",
          disposition: "mission_closed",
          closure_event_id: first.closureEventID,
        },
        recoveredReceipts: [
          { outcome: "disposition", disposition: "mission_closed", closure_event_id: first.closureEventID },
        ],
      })
    } })
  }, 60_000)

  test("a closed-Mission causal-cycle successor settles by its frozen Mission reservation at the FIFO head", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      await configureMissionWakeModel()
      const mission = await ensureMissionSession({
        missionID: `event-closed-cycle-${Date.now()}`,
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      await openMissionOccurrence(mission, "event-closed-cycle-open")
      const job = await EventService.create({
        name: "Closed Mission causal cycle",
        eventType: TYPE,
        prompt: "Settle the frozen closed Mission occurrence.",
        projectId: Instance.project.id,
        sessionId: mission.id,
      })
      const closed = await closeMissionExecutionOperation({
        missionID: mission.missionID,
        sessionID: mission.id,
        source: "mission.abort",
        requestID: "event-closed-cycle-close",
        provenance: { kind: "request", surface: "api", reason: "Close before both Event reservations" },
        signal: AbortSignal.timeout(20_000),
      })
      const firstOccurrenceID = `event:closed-cycle:head:${Date.now()}`
      const secondOccurrenceID = `event:closed-cycle:successor:${Date.now()}`
      {
        using _crash = EventService.TestHooks.installFireAcceptedHook(() => {
          throw new Error("simulated Event process crash before FIFO processing")
        })
        await expect(EventService.TestHooks.acceptEnvelope({
          occurrenceID: firstOccurrenceID,
          type: TYPE,
          properties: { queue: 1 },
        })).rejects.toThrow("simulated Event process crash")
        const firstFireID = Database.use((db) =>
          db.select({ id: EventJobFireTable.id }).from(EventJobFireTable)
            .where(eq(EventJobFireTable.event_occurrence_id, firstOccurrenceID)).get()?.id,
        )
        if (!firstFireID) throw new Error("Closed Mission FIFO fixture omitted its first Fire")
        await expect(EventService.TestHooks.acceptEnvelope({
          occurrenceID: secondOccurrenceID,
          type: TYPE,
          properties: { queue: 2 },
          causation: { source: "scheduler.event", occurrenceID: firstFireID },
        })).rejects.toThrow("simulated Event process crash")
      }

      EventService.TestHooks.recoverProjectFires(Instance.project.id)
      await EventService.TestHooks.waitForIdle()
      const fires = EventService.TestHooks.fires(Instance.project.id).filter((fire) => fire.event_job_id === job.id)
      expect(fires.map((fire) => ({
        queuePosition: fire.queue_position,
        causalCycle: fire.causal_cycle,
        status: fire.status,
        disposition: fire.disposition,
        closureEventID: fire.closure_event_id,
      }))).toEqual([
        {
          queuePosition: 1,
          causalCycle: false,
          status: "disposition",
          disposition: "mission_closed",
          closureEventID: closed.eventID,
        },
        {
          queuePosition: 2,
          causalCycle: true,
          status: "disposition",
          disposition: "mission_closed",
          closureEventID: closed.eventID,
        },
      ])
    } })
  }, 60_000)

  test("round-trips complete Event retry, terminal frontier and Mission reservation facts through strict transfer", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      await configureMissionWakeModel()
      const mission = await ensureMissionSession({
        missionID: `event-transfer-${Date.now()}`,
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
      await openMissionOccurrence(mission, "event-transfer-open")
      const missionJob = await EventService.create({
        name: "Transferred closed Mission Event",
        eventType: `${TYPE}.transfer.mission`,
        prompt: "Persist an exact terminal Mission reservation.",
        projectId: Instance.project.id,
        sessionId: mission.id,
      })
      await closeMissionExecutionOperation({
        missionID: mission.missionID,
        sessionID: mission.id,
        source: "mission.abort",
        requestID: "event-transfer-close",
        provenance: { kind: "request", surface: "api", reason: "Freeze the transfer Mission closure" },
        signal: AbortSignal.timeout(20_000),
      })
      await EventService.TestHooks.acceptEnvelope({
        occurrenceID: `event:transfer:mission:${Date.now()}`,
        type: `${TYPE}.transfer.mission`,
        properties: { authority: "mission" },
      })
      await EventService.TestHooks.waitForIdle()

      const retryJob = await EventService.create({
        name: "Transferred retry Event",
        eventType: `${TYPE}.transfer.retry`,
        prompt: "Persist retry and terminal receipts.",
        projectId: Instance.project.id,
      })
      let attempts = 0
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
        attempts += 1
        if (attempts === 1) throw new Error("transient transfer fixture failure")
        return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
      })
      await EventService.TestHooks.acceptEnvelope({
        occurrenceID: `event:transfer:retry:${Date.now()}`,
        type: `${TYPE}.transfer.retry`,
        properties: { authority: "retry" },
      })
      await EventService.TestHooks.waitForIdle()
      await Bun.sleep(1_250)
      await EventService.TestHooks.waitForIdle()
      expect(attempts).toBe(2)

      const snapshot = exportMysqlTransferSnapshot()
      const eventTables = new Set([
        "event_job",
        "event_occurrence",
        "event_job_fire",
        "event_job_fire_receipt",
      ])
      const expectedEventRows = snapshot.tables
        .filter((table) => eventTables.has(table.name))
        .map((table) => ({ name: table.name, rows: table.rows }))
      const fireRows = snapshot.tables.find((table) => table.name === "event_job_fire")?.rows ?? []
      const receiptRows = snapshot.tables.find((table) => table.name === "event_job_fire_receipt")?.rows ?? []
      const missionFire = fireRows.find((row) => row.definition_id === missionJob.id)
      const retryFire = fireRows.find((row) => row.definition_id === retryJob.id)
      if (!missionFire || !retryFire) throw new Error("Strict Event transfer fixture omitted one immutable Fire")
      expect({
        missionJobID: missionJob.id,
        missionReceipts: receiptRows.filter((row) => row.fire_id === missionFire.id).map((row) => ({
          outcome: row.outcome,
          disposition: row.disposition,
          closureEventID: row.closure_event_id,
        })),
        retryOutcomes: receiptRows.filter((row) => row.fire_id === retryFire.id).map((row) => row.outcome),
      }).toEqual({
        missionJobID: missionFire.definition_id,
        missionReceipts: [{
          outcome: "disposition",
          disposition: "mission_closed",
          closureEventID: missionFire.mission_closure_event_id,
        }],
        retryOutcomes: ["retry_wait", "succeeded"],
      })

      expect(preflightMysqlTransferSnapshot(snapshot).schemaFingerprint).toBe(snapshot.schemaFingerprint)

      const wrongFrontier = structuredClone(snapshot)
      const wrongFrontierReceipt = wrongFrontier.tables
        .find((table) => table.name === "event_job_fire_receipt")
        ?.rows.find((row) => row.fire_id === retryFire.id && row.outcome === "retry_wait")
      if (!wrongFrontierReceipt) throw new Error("Strict Event transfer fixture omitted its retry receipt")
      wrongFrontierReceipt.definition_id = missionJob.id
      expect(() => preflightMysqlTransferSnapshot(wrongFrontier)).toThrow(
        expect.objectContaining<MysqlTransferValidationError>({
          name: "MysqlTransferValidationError",
          data: expect.objectContaining({ message: expect.stringContaining("invalid Fire frontier") }),
        }),
      )

      const wrongMissionReceipt = structuredClone(snapshot)
      const changedMissionReceipt = wrongMissionReceipt.tables
        .find((table) => table.name === "event_job_fire_receipt")
        ?.rows.find((row) => row.fire_id === missionFire.id)
      if (!changedMissionReceipt) throw new Error("Strict Event transfer fixture omitted its Mission receipt")
      Object.assign(changedMissionReceipt, {
        disposition: "causal_cycle",
        closure_event_id: null,
        error: "divergent terminal disposition",
      })
      expect(() => preflightMysqlTransferSnapshot(wrongMissionReceipt)).toThrow(
        expect.objectContaining<MysqlTransferValidationError>({
          name: "MysqlTransferValidationError",
          data: expect.objectContaining({ message: expect.stringContaining("Mission authority") }),
        }),
      )

      expect(importMysqlTransferSnapshot(snapshot)).toMatchObject({ ok: true })
      expect(
        exportMysqlTransferSnapshot().tables
          .filter((table) => eventTables.has(table.name))
          .map((table) => ({ name: table.name, rows: table.rows })),
      ).toEqual(expectedEventRows)
    } })
  }, 60_000)

  test("the configured production wake owner persists and activates the exact Event fire Message", async () => {
    await using project = await memoryProject()
    const model = { providerID: "scheduler-event-test", modelID: "wake-model" }
    await Instance.provide({
      directory: project.path,
      fn: () => Config.updateProjectPatch({
        model: `${model.providerID}/${model.modelID}`,
        provider: {
          [model.providerID]: {
            name: "Scheduler Event test provider",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: {
              [model.modelID]: {
                name: "Scheduler Event wake model",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 32_000, output: 4_096 },
              },
            },
          },
        },
      }),
    })
    await provideInitializedProjectExecution({
      directory: project.path,
      fn: async () => {
        let resolveActivation!: (value: { sessionID: string; messageID: string }) => void
        const activation = new Promise<{ sessionID: string; messageID: string }>((resolve) => { resolveActivation = resolve })
        using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ sessionID, messageID }) => {
          resolveActivation({ sessionID, messageID })
        })
        const job = await EventService.create({
          name: "production wake",
          eventType: TYPE,
          prompt: "wake through the configured Session owner",
          projectId: Instance.project.id,
          oneShot: true,
        })
        await EventService.TestHooks.acceptEnvelope({
          occurrenceID: "event:production-wake:1",
          type: TYPE,
          properties: { value: "exact" },
        })
        await EventService.TestHooks.waitForIdle()
        const fire = EventService.TestHooks.fires(Instance.project.id)[0]!
        expect(fire).toMatchObject({
          event_job_id: job.id,
          event_occurrence_id: "event:production-wake:1",
          status: "succeeded",
        })
        const activated = await activation
        const message = (await Session.messages({ sessionID: fire.target_session_id })).find((entry) => entry.info.id === activated.messageID)
        expect({ fire, activated, message }).toMatchObject({
          fire: { target_session_id: activated.sessionID },
          message: {
            info: {
              id: activated.messageID,
              role: "user",
              author: "orchestrator",
              extra: {
                wake_reason: {
                  source: "scheduler.event",
                  jobID: job.id,
                  jobName: "production wake",
                  fireID: fire.id,
                  eventType: TYPE,
                  oneShot: true,
                },
              },
            },
            parts: [expect.objectContaining({ type: "text", text: "wake through the configured Session owner" })],
          },
        })
      },
    })
  }, 60_000)

  test("persists a transient Bus input once and binds one successful fire to the exact definition revision", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const job = await EventService.create({ name: "one shot", eventType: TYPE, prompt: "wake", projectId: Instance.project.id, oneShot: true })
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({ sessionID: fire.target_session_id, messageID: `message:${fire.id}` }))
      await EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:transient:1", type: TYPE, properties: { value: 1 } })
      await EventService.TestHooks.waitForIdle()
      const occurrence = Database.use((db) => db.select().from(EventOccurrenceTable).where(eq(EventOccurrenceTable.id, "event:transient:1")).get())
      expect(occurrence).toMatchObject({ bus_outbox_id: null, project_id: Instance.project.id, event_type: TYPE, properties: { value: 1 } })
      expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
        expect.objectContaining({ event_job_id: job.id, event_occurrence_id: "event:transient:1", status: "succeeded" }),
      ])
      expect(EventService.list(Instance.project.id)[0]).toMatchObject({ id: job.id, enabled: false, lastEvent: "event:transient:1" })
      expect(Database.use((db) => db.select().from(EventJobTable).where(eq(EventJobTable.definition_id, job.id)).get())?.enabled).toBe(true)
    } })
  })

  test("runs distinct Event Job heads across Projects through one physical capacity frontier", async () => {
    await using firstProject = await memoryProject()
    await using secondProject = await memoryProject()
    const projects = [firstProject, secondProject]
    const jobs = (
      await Promise.all(
        projects.map((project, projectIndex) =>
          Instance.provide({
            directory: project.path,
            fn: () =>
              Promise.all(
                Array.from({ length: projectIndex === 0 ? 2 : 1 }, (_, jobIndex) =>
                  EventService.create({
                    name: `capacity job ${projectIndex}:${jobIndex}`,
                    eventType: TYPE,
                    prompt: `wake capacity job ${projectIndex}:${jobIndex}`,
                    projectId: Instance.project.id,
                  }),
                ),
              ),
          }),
        ),
      )
    ).flat()
    const firstStarted = Promise.withResolvers<void>()
    const releaseFirst = Promise.withResolvers<void>()
    let active = 0
    let maximumActive = 0
    let starts = 0
    const within = <T>(label: string, operation: Promise<T>) =>
      Promise.race([
        operation,
        Bun.sleep(15_000).then(() => {
          throw new Error(`${label} did not settle`)
        }),
      ])
    using _capacity = EventService.TestHooks.installExecutionCapacity(1)
    using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
      starts += 1
      const start = starts
      active += 1
      maximumActive = Math.max(maximumActive, active)
      if (start === 1) {
        firstStarted.resolve()
        await releaseFirst.promise
      }
      active -= 1
      return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
    })
    const executions = projects.map((project, index) =>
      Instance.provide({
        directory: project.path,
        fn: async () => {
          await EventService.TestHooks.acceptEnvelope({
            occurrenceID: `event:physical-capacity:${index}`,
            type: TYPE,
            properties: { capacity: index },
          })
          await EventService.TestHooks.waitForIdle()
          return EventService.TestHooks.fires(Instance.project.id)
        },
      }),
    )
    await within("first cross-Project Event fire", firstStarted.promise)
    await Bun.sleep(25)
    const readFires = (project: typeof firstProject) =>
      Instance.provide({
        directory: project.path,
        fn: () => EventService.TestHooks.fires(Instance.project.id),
      })
    const saturated = (await Promise.all(projects.map(readFires))).flat()
    expect({ active, starts, states: saturated.map((fire) => fire.status).toSorted() }).toEqual({
      active: 1,
      starts: 1,
      states: ["pending", "pending", "running"],
    })
    releaseFirst.resolve()
    const settled = (await within("cross-Project Event settlement", Promise.all(executions))).flat()
    expect({
      jobIDs: settled.map((fire) => fire.event_job_id).toSorted(),
      maximumActive,
      starts,
      states: settled.map((fire) => fire.status),
    }).toEqual({
      jobIDs: jobs.map((job) => job.id).toSorted(),
      maximumActive: 1,
      starts: 3,
      states: ["succeeded", "succeeded", "succeeded"],
    })
  }, 30_000)

  test("keeps an accepted Event fire pending when its owner is cancelled after permit grant", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const job = await EventService.create({
        name: "post-permit cancellation",
        eventType: TYPE,
        prompt: "do not claim after owner cancellation",
        projectId: Instance.project.id,
      })
      const reason = new DOMException("Event owner cancelled after permit grant", "AbortError")
      let wakeCalls = 0
      using _capacity = EventService.TestHooks.installExecutionCapacity(1)
      using _postPermit = EventService.TestHooks.installAfterExecutionPermit((cancel) => cancel(reason))
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
        wakeCalls += 1
        return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
      })

      await EventService.TestHooks.acceptEnvelope({
        occurrenceID: "event:post-permit-cancellation:1",
        type: TYPE,
        properties: { cancelled: true },
      })
      await EventService.TestHooks.waitForIdle()

      expect({ wakeCalls, fires: EventService.TestHooks.fires(Instance.project.id) }).toEqual({
        wakeCalls: 0,
        fires: [expect.objectContaining({ event_job_id: job.id, status: "pending", attempt: 0 })],
      })
    } })
  })

  test("definition removal appends a tombstone without erasing an already accepted fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const job = await EventService.create({ name: "removable", eventType: TYPE, prompt: "wake", projectId: Instance.project.id })
      let release!: () => void
      const gate = new Promise<void>((resolve) => { release = resolve })
      using _accepted = EventService.TestHooks.installFireAcceptedHook(async () => gate)
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({ sessionID: fire.target_session_id, messageID: `message:${fire.id}` }))
      const accepted = EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:remove:1", type: TYPE, properties: {} })
      while (EventService.TestHooks.fires(Instance.project.id).length === 0) await Bun.sleep(5)
      expect(EventService.remove(job.id, Instance.project.id)).toBe(true)
      release()
      await accepted
      await EventService.TestHooks.waitForIdle()
      expect(EventService.TestHooks.fires(Instance.project.id)[0]).toMatchObject({ event_job_id: job.id, status: "succeeded" })
      const revisions = Database.use((db) => db.select().from(EventJobTable).where(eq(EventJobTable.definition_id, job.id)).orderBy(EventJobTable.revision).all())
      expect(revisions).toHaveLength(1)
      expect(Database.use((db) => db.select().from(EventJobDefinitionTombstoneTable).where(eq(EventJobDefinitionTombstoneTable.definition_id, job.id)).get()))
        .toMatchObject({ definition_id: job.id, revision: 2 })
    } })
  })

  test("a retry keeps the same fire identity and appends ordered receipts", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const job = await EventService.create({ name: "retry", eventType: TYPE, prompt: "wake", projectId: Instance.project.id })
      let calls = 0
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
        calls += 1
        if (calls === 1) throw new Error("retryable")
        return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
      })
      await EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:retry:1", type: TYPE, properties: {} })
      while (EventService.TestHooks.fires(Instance.project.id)[0]?.status !== "retry_wait") await Bun.sleep(5)
      await Bun.sleep(1_050)
      EventService.TestHooks.recoverProjectFires()
      await EventService.TestHooks.waitForIdle()
      const fire = EventService.TestHooks.fires(Instance.project.id)[0]!
      expect({ calls, fire }).toMatchObject({ calls: 2, fire: { event_job_id: job.id, event_occurrence_id: "event:retry:1", status: "succeeded" } })
      expect(Database.use((db) => db.select().from(EventJobFireReceiptTable).where(eq(EventJobFireReceiptTable.fire_id, fire.id)).orderBy(EventJobFireReceiptTable.time_created).all()).map((row) => row.outcome)).toEqual(["retry_wait", "succeeded"])
    } })
  }, 10_000)

  test("duplicate acceptance is idempotent and preserves one fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      await EventService.create({ name: "dedupe", eventType: TYPE, prompt: "wake", projectId: Instance.project.id })
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({ sessionID: fire.target_session_id, messageID: `message:${fire.id}` }))
      const envelope = { occurrenceID: "event:dedupe:1", type: TYPE, properties: { exact: true } }
      await EventService.TestHooks.acceptEnvelope(envelope)
      await EventService.TestHooks.acceptEnvelope(envelope)
      await EventService.TestHooks.waitForIdle()
      expect(EventService.TestHooks.fires(Instance.project.id)).toHaveLength(1)
    } })
  })

  test("same occurrence identity rejects a different immutable input", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      await EventService.create({ name: "conflict", eventType: TYPE, prompt: "wake", projectId: Instance.project.id })
      using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({ sessionID: fire.target_session_id, messageID: `message:${fire.id}` }))
      await EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:conflict:1", type: TYPE, properties: { value: 1 } })
      await expect(EventService.TestHooks.acceptEnvelope({ occurrenceID: "event:conflict:1", type: TYPE, properties: { value: 2 } }))
        .rejects.toThrow("conflicts with its immutable input fact")
      await EventService.TestHooks.waitForIdle()
      expect(EventService.TestHooks.fires(Instance.project.id)).toHaveLength(1)
    } })
  })
})
