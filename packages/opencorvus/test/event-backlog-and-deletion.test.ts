import { afterAll, describe, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { EventService } from "@/scheduler/event-service"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { Session } from "@/session"
import { EngineService } from "@/task-api"
import { Database, NotFoundError } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)
const type = "test.event.razor"

describe("Event durable head admission", () => {
  test("cancels retry reentry queued behind teardown and recovers the same Fire after disposal", async () => {
    await using project = await memoryProject()
    let attempts = 0
    using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
      attempts += 1
      if (attempts === 1) throw new Error("transient execution failure")
      return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
    })
    const lateState = createInstanceState(
      () => ({}),
      async () => {
        await Bun.sleep(1_800)
      },
      "event-retry-teardown-order",
    )
    const saved = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await EventService.create({
          name: "Retry teardown",
          eventType: type,
          prompt: "wake",
          projectId: Instance.project.id,
        })
        await EventService.TestHooks.acceptEnvelope({ occurrenceID: "razor:retry-teardown", type, properties: {} })
        await EventService.TestHooks.waitForIdle()
        const fire = EventService.TestHooks.fires(Instance.project.id)[0]!
        expect(fire.status).toBe("retry_wait")
        lateState()
        const projectID = Instance.project.id
        await Instance.dispose()
        return { projectID, fireID: fire.id, status: "disposed" }
      },
    })
    expect(saved.status).toBe("disposed")
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EventService.TestHooks.recoverProjectFires()
        await EventService.TestHooks.waitForIdle()
        expect(EventService.TestHooks.fires(saved.projectID)[0]).toMatchObject({
          id: saved.fireID,
          status: "succeeded",
          attempt: 2,
        })
      },
    })
  }, 10_000)

  test("settles Event state disposal while discovery is awaiting its independent lease", async () => {
    await using project = await memoryProject()
    const lateState = createInstanceState(
      () => ({}),
      async () => {
        EventService.TestHooks.recoverProjectFires()
      },
      "event-discovery-during-exclusive-teardown",
    )
    const outcome = await Instance.provide({
      directory: project.path,
      fn: async () => {
        EventService.TestHooks.recoverProjectFires()
        await EventService.TestHooks.waitForIdle()
        lateState()
        await Instance.dispose()
        return "event state disposed"
      },
    })
    expect(outcome).toBe("event state disposed")
  }, 10_000)

  test("admits a newly accepted independent head into a free slot while an older head is still running", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const slow = await EventService.create({
          name: "Slow head",
          eventType: `${type}.slow`,
          prompt: "wake",
          projectId: Instance.project.id,
        })
        const fast = await EventService.create({
          name: "Fast head",
          eventType: `${type}.fast`,
          prompt: "wake",
          projectId: Instance.project.id,
        })
        const entered = Promise.withResolvers<void>()
        const release = Promise.withResolvers<void>()
        const fastStarted = Promise.withResolvers<string>()
        using _capacity = EventService.TestHooks.installExecutionCapacity(2)
        using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          if (fire.event_job_id === slow.id) {
            entered.resolve()
            await release.promise
          } else fastStarted.resolve(fire.event_job_id)
          return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
        })
        await EventService.TestHooks.acceptEnvelope({
          occurrenceID: "razor:slow",
          type: `${type}.slow`,
          properties: {},
        })
        await entered.promise
        try {
          await EventService.TestHooks.acceptEnvelope({
            occurrenceID: "razor:fast",
            type: `${type}.fast`,
            properties: {},
          })
          const started = await Promise.race([fastStarted.promise, Bun.sleep(3_000).then(() => "admission timed out")])
          expect(started).toBe(fast.id)
        } finally {
          release.resolve()
        }
        await EventService.TestHooks.waitForIdle()
        expect(EventService.TestHooks.fires(Instance.project.id).map((fire) => fire.status)).toEqual([
          "succeeded",
          "succeeded",
        ])
      },
    })
  }, 30_000)

  test("keeps a long accepted backlog durable while a bounded reservation owns its FIFO head", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "FIFO backlog",
          eventType: type,
          prompt: "wake",
          projectId: Instance.project.id,
        })
        const entered = Promise.withResolvers<void>()
        const release = Promise.withResolvers<void>()
        const positions: number[] = []
        using _capacity = EventService.TestHooks.installExecutionCapacity(1)
        using _wake = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          positions.push(fire.queue_position)
          if (positions.length === 1) {
            entered.resolve()
            await release.promise
          }
          return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
        })
        await EventService.TestHooks.acceptEnvelope({ occurrenceID: "razor:backlog:1", type, properties: {} })
        await entered.promise
        try {
          for (let index = 2; index <= 80; index += 1) {
            await EventService.TestHooks.acceptEnvelope({
              occurrenceID: `razor:backlog:${index}`,
              type,
              properties: {},
            })
          }
          expect(EventService.TestHooks.executionSnapshot()).toEqual({
            active: 1,
            pending: 0,
            limit: 1,
            reservations: 1,
            discovery: true,
          })
          expect(
            RuntimeExecutionSettlement.snapshot().filter((entry) => entry.kind === "scheduler_event_fire"),
          ).toHaveLength(1)
          expect(EventService.TestHooks.fires(Instance.project.id).map((fire) => fire.status)).toEqual([
            "running",
            ...Array(79).fill("pending"),
          ])
        } finally {
          release.resolve()
        }
        await EventService.TestHooks.waitForIdle()
        expect(positions).toEqual(Array.from({ length: 80 }, (_, index) => index + 1))
        expect(
          EventService.TestHooks.fires(Instance.project.id).map((fire) => ({
            job: fire.event_job_id,
            status: fire.status,
          })),
        ).toEqual(Array.from({ length: 80 }, () => ({ job: job.id, status: "succeeded" })))
      },
    })
  }, 60_000)

  test("settles a canonically deleted target and its recovered FIFO successor with target_deleted receipts", async () => {
    await using project = await memoryProject()
    const saved = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ title: "Event deletion target", kind: "assistant" })
        const job = await EventService.create({
          name: "Deleted target",
          eventType: type,
          prompt: "wake",
          projectId: Instance.project.id,
          sessionId: session.id,
        })
        using _accepted = EventService.TestHooks.installFireAcceptedHook(() => {
          throw new Error("acceptance stopped before dispatch")
        })
        for (let index = 1; index <= 2; index += 1) {
          await expect(
            EventService.TestHooks.acceptEnvelope({ occurrenceID: `razor:deleted:${index}`, type, properties: {} }),
          ).rejects.toThrow("acceptance stopped before dispatch")
        }
        await EngineService.deleteSession(session.id, { projectID: session.projectID })
        expect(Database.use((db) => Session.deletedInTransaction(db, session.id))).toBe(true)
        return { projectID: session.projectID, jobID: job.id, sessionID: session.id }
      },
    })
    await Instance.disposeAll()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EventService.TestHooks.recoverProjectFires()
        await EventService.TestHooks.waitForIdle()
        expect(
          EventService.TestHooks.fires(saved.projectID).map((fire) => ({
            queue: fire.queue_position,
            status: fire.status,
            disposition: fire.disposition,
            session: fire.target_session_id,
          })),
        ).toEqual(
          [1, 2].map((queue) => ({
            queue,
            status: "disposition",
            disposition: "target_deleted",
            session: saved.sessionID,
          })),
        )
        expect(EventService.TestHooks.executionSnapshot()).toMatchObject({ active: 0, reservations: 0 })
      },
    })
  }, 60_000)

  test.each([false, true])(
    "classifies a claimed target lookup failure using its canonical deletion fact: deleted=%s",
    async (deleted) => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.create({ title: "Event lookup boundary", kind: "assistant" })
          await EventService.create({
            name: "Lookup boundary",
            eventType: type,
            prompt: "wake",
            projectId: Instance.project.id,
            sessionId: session.id,
          })
          using _claim = EventService.TestHooks.installAfterEventFireClaim(async () => {
            if (deleted) await EngineService.deleteSession(session.id, { projectID: session.projectID })
            throw new NotFoundError({ message: "Lookup boundary unavailable" })
          })
          await EventService.TestHooks.acceptEnvelope({ occurrenceID: `razor:lookup:${deleted}`, type, properties: {} })
          await EventService.TestHooks.waitForIdle()
          const fire = EventService.TestHooks.fires(Instance.project.id)[0]!
          expect(Database.use((db) => Session.deletedInTransaction(db, session.id))).toBe(deleted)
          expect(fire).toMatchObject(
            deleted
              ? { status: "disposition", disposition: "target_deleted", attempt: 1 }
              : {
                  status: "retry_wait",
                  disposition: null,
                  attempt: 1,
                  error: "NotFoundError: Lookup boundary unavailable",
                },
          )
          if (!deleted) expect(fire.retry_at).toBeGreaterThan(fire.time_updated)
        },
      })
    },
    60_000,
  )
})
