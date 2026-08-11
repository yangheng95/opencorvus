import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { DurableBusSubscriptionIdentityConflictError, GlobalBus } from "@/bus/global"
import { Identifier } from "@/id/id"
import { EngineTaskTable } from "@/engine/engine.sql"
import { Event } from "@/engine/model"
import { Instance } from "@/project/instance"
import { EventService } from "@/scheduler/event-service"
import { SchedulerExecutionInactivityTestHooks } from "@/scheduler/execution-inactivity"
import { EventJobFireTable, EventJobTable } from "@/scheduler/event.sql"
import { Session } from "@/session"
import { MessageTable } from "@/session/session.sql"
import { SessionWake } from "@/session/wake"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const SourceEvent = BusEvent.define(
  "test.scheduler.event.durable-fire",
  z.object({
    info: z
      .object({
        id: z.string(),
        extra: z.object({ wake_reason: SessionWake.WakeReason }).optional(),
      })
      .optional(),
  }),
)

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Event Job durable fire authority", () => {
  test("durably accepts an occurrence and aggregates exact, wildcard, and strict Global relay failures", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "subscriber-failure-durable-acceptance",
          eventType: SourceEvent.type,
          prompt: "Persist the occurrence despite peer subscriber failures",
          projectId: Instance.project.id,
        })
        using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({
          sessionID: fire.target_session_id,
          messageID: `message:${fire.id}`,
        }))
        let occurrenceID = ""
        const removeExact = Bus.subscribe(SourceEvent, (event) => {
          occurrenceID = event.occurrenceID
          throw new Error("exact subscriber failed")
        })
        EventService.init()
        const removeWildcard = Bus.subscribeAll(() => {
          throw new Error("wildcard subscriber failed")
        })
        const failGlobal = () => {
          throw new Error("global relay failed")
        }
        GlobalBus.on("event", failGlobal)

        let dispatchError: unknown
        try {
          await Bus.publish(SourceEvent, { info: { id: "source:subscriber-failure" } })
        } catch (error) {
          dispatchError = error
        } finally {
          removeExact()
          removeWildcard()
          GlobalBus.off("event", failGlobal)
        }
        await EventService.TestHooks.waitForIdle()

        expect(dispatchError).toBeInstanceOf(AggregateError)
        const messages = (error: unknown): string[] =>
          error instanceof AggregateError
            ? error.errors.flatMap(messages)
            : [error instanceof Error ? error.message : String(error)]
        expect(messages(dispatchError)).toEqual([
          "exact subscriber failed",
          "wildcard subscriber failed",
          "global relay failed",
        ])
        expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
          expect.objectContaining({
            event_job_id: job.id,
            event_occurrence_id: occurrenceID,
            status: "succeeded",
            attempt: 1,
          }),
        ])
      },
    })
  })

  test("ordinary GlobalBus emission observes listener rejection without returning a rejected Promise", async () => {
    const failGlobal = () => {
      throw new Error("observed ordinary global listener failure")
    }
    GlobalBus.on("event", failGlobal)
    try {
      await expect(GlobalBus.emit("event", { payload: { type: "test.global.safe-emission" } })).resolves.toBe(true)
    } finally {
      GlobalBus.off("event", failGlobal)
    }
  })

  test("durably accepts a wildcard occurrence while an exact subscriber is still settling", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "hung-exact-durable-acceptance",
          eventType: SourceEvent.type,
          prompt: "Accept the occurrence independently of a slow exact subscriber",
          projectId: Instance.project.id,
        })
        using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({
          sessionID: fire.target_session_id,
          messageID: `message:${fire.id}`,
        }))
        let releaseExact!: () => void
        const exactReleased = new Promise<void>((resolve) => (releaseExact = resolve))
        const removeExact = Bus.subscribe(SourceEvent, () => exactReleased)
        EventService.init()
        const publication = Bus.publish(SourceEvent, { info: { id: "source:slow-exact" } })
        try {
          let fires = EventService.TestHooks.fires(Instance.project.id)
          for (let attempt = 0; fires.length === 0 && attempt < 100; attempt += 1) {
            await Bun.sleep(10)
            fires = EventService.TestHooks.fires(Instance.project.id)
          }
          expect(fires).toEqual([
            expect.objectContaining({
              event_job_id: job.id,
              status: expect.stringMatching(/^(pending|running|succeeded)$/),
              attempt: expect.any(Number),
            }),
          ])
        } finally {
          releaseExact()
          removeExact()
        }
        await publication
        await EventService.TestHooks.waitForIdle()
      },
    })
  })

  test("persists every matching fire atomically before acceptance callbacks run", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const first = await EventService.create({
          name: "atomic-fanout-first",
          eventType: SourceEvent.type,
          prompt: "Persist the first matching fire",
          projectId: Instance.project.id,
        })
        const second = await EventService.create({
          name: "atomic-fanout-second",
          eventType: SourceEvent.type,
          prompt: "Persist the second matching fire",
          projectId: Instance.project.id,
        })
        using acceptedHook = EventService.TestHooks.installFireAcceptedHook(() => {
          throw new Error("injected post-commit acceptance callback failure")
        })
        EventService.init()

        let publicationError: unknown
        try {
          await Bus.publish(SourceEvent, { info: { id: "source:atomic-fanout" } })
        } catch (error) {
          publicationError = error
        }

        expect(publicationError).toMatchObject({ message: "injected post-commit acceptance callback failure" })
        expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
          expect.objectContaining({ event_job_id: first.id, status: "pending", attempt: 0 }),
          expect.objectContaining({ event_job_id: second.id, status: "pending", attempt: 0 }),
        ])
      },
    })
  })

  test("publisher receipt settles after wildcard fire acceptance and asynchronous GlobalBus relay", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "publisher-dispatch-receipt",
          eventType: SourceEvent.type,
          prompt: "Bind publisher completion to durable acceptance",
          projectId: Instance.project.id,
        })
        using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({
          sessionID: fire.target_session_id,
          messageID: `message:${fire.id}`,
        }))
        const trace: string[] = []
        let releaseFireAcceptance!: () => void
        const holdFireAcceptance = new Promise<void>((resolve) => {
          releaseFireAcceptance = resolve
        })
        let acceptedFire!: (fire: (typeof EventJobFireTable)["$inferSelect"]) => void
        const fireAccepted = new Promise<(typeof EventJobFireTable)["$inferSelect"]>((resolve) => {
          acceptedFire = resolve
        })
        using acceptedHook = EventService.TestHooks.installFireAcceptedHook(async (fire) => {
          trace.push("event-fire:durable-accepted")
          acceptedFire(fire)
          await holdFireAcceptance
          trace.push("event-fire:wildcard-settled")
        })
        let releaseGlobalRelay!: () => void
        const holdGlobalRelay = new Promise<void>((resolve) => {
          releaseGlobalRelay = resolve
        })
        let globalEntered!: () => void
        const didEnterGlobal = new Promise<void>((resolve) => {
          globalEntered = resolve
        })
        const globalListener = async (envelope: { payload?: { type?: string } }) => {
          if (envelope.payload?.type !== SourceEvent.type) return
          trace.push("global-relay:entered")
          globalEntered()
          await holdGlobalRelay
          trace.push("global-relay:settled")
        }
        GlobalBus.on("event", globalListener)
        try {
          EventService.init()
          const publication = Bus.publish(SourceEvent, { info: { id: "source:dispatch-receipt" } }).then(() => {
            trace.push("publisher:completed")
          })
          const accepted = await fireAccepted
          expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
            expect.objectContaining({
              id: accepted.id,
              event_job_id: job.id,
              event_occurrence_id: accepted.event_occurrence_id,
              status: "pending",
              attempt: 0,
            }),
          ])
          releaseFireAcceptance()
          await didEnterGlobal
          releaseGlobalRelay()
          await publication
          await EventService.TestHooks.waitForIdle()
          expect(trace).toEqual([
            "event-fire:durable-accepted",
            "event-fire:wildcard-settled",
            "global-relay:entered",
            "global-relay:settled",
            "publisher:completed",
          ])
          expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
            expect.objectContaining({ id: accepted.id, status: "succeeded", attempt: 1 }),
          ])
        } finally {
          GlobalBus.off("event", globalListener)
        }
      },
    })
  })

  test("aborts the physical event fire owner when lease renewal throws", () => {
    const renewalFailure = new Error("injected renewal storage failure")
    const fence = EventService.TestHooks.createLeaseFence("event-fire:renew-throw", "event-owner:old", () => {
      throw renewalFailure
    })

    expect(fence.renewOrAbort()).toBe(false)
    expect(fence.lost).toBe(true)
    expect(fence.signal.aborted).toBe(true)
    expect(fence.signal.reason).toBe(renewalFailure)
  })

  test("fences a stale Event owner at the atomic wake commit and lets a successor reuse the deterministic identity", async () => {
    await using project = await memoryProject()
    await fs.mkdir(path.join(project.path, ".opencorvus"), { recursive: true })
    await fs.writeFile(
      path.join(project.path, ".opencorvus", "opencorvus.jsonc"),
      JSON.stringify({ model: "test/event-owner-fence" }),
    )
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Event wake owner fence" })
        const job = await EventService.create({
          name: "event-wake-owner-fence",
          eventType: SourceEvent.type,
          prompt: "Commit only under the live Event fire lease",
          projectId: Instance.project.id,
          sessionId: session.id,
        })
        const loopMessageIDs: string[] = []
        using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ messageID }) => {
          loopMessageIDs.push(messageID)
        })
        const stolenOwnerID = "event-owner:successor"
        const leaseLoss = EventService.TestHooks.installBeforeSessionWake(({ fire, ownerID, signal }) => {
          expect({ ownerID, aborted: signal.aborted }).toEqual({
            ownerID: expect.stringMatching(/^event-fire-owner:/),
            aborted: false,
          })
          Database.use((db) =>
            db
              .update(EventJobFireTable)
              .set({ owner_id: stolenOwnerID, lease_until: Date.now() + 30_000, time_updated: Date.now() })
              .where(eq(EventJobFireTable.id, fire.id))
              .run(),
          )
        })

        EventService.init()
        await Bus.publish(SourceEvent, { info: { id: "source:event-wake-owner-fence" } })
        await EventService.TestHooks.waitForIdle()
        const [interrupted] = EventService.TestHooks.fires(Instance.project.id)
        const messageID = EventService.TestHooks.messageID(interrupted!.id)
        expect({
          fire: interrupted,
          message: Database.use((db) => db.select().from(MessageTable).where(eq(MessageTable.id, messageID)).get()),
          loopMessageIDs,
        }).toMatchObject({
          fire: { event_job_id: job.id, status: "running", owner_id: stolenOwnerID, attempt: 1 },
          message: undefined,
          loopMessageIDs: [],
        })

        leaseLoss[Symbol.dispose]()
        Database.use((db) =>
          db
            .update(EventJobFireTable)
            .set({ lease_until: 0, time_updated: Date.now() })
            .where(eq(EventJobFireTable.id, interrupted!.id))
            .run(),
        )
        EventService.TestHooks.recoverProjectFires()
        await EventService.TestHooks.waitForIdle()

        expect({
          fire: EventService.TestHooks.fires(Instance.project.id)[0],
          messages: Database.use((db) =>
            db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, messageID)).all(),
          ),
          loopMessageIDs,
        }).toEqual({
          fire: expect.objectContaining({
            id: interrupted!.id,
            event_job_id: job.id,
            status: "succeeded",
            message_id: messageID,
            attempt: 2,
          }),
          messages: [{ id: messageID }],
          loopMessageIDs: [messageID],
        })
      },
    })
  })

  test("records a causal self-cycle as a terminal disposition with the complete ancestry", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "causal-cycle-benchmark",
          eventType: SourceEvent.type,
          prompt: "Run the causal cycle benchmark",
          projectId: Instance.project.id,
        })
        let executionCount = 0
        using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          executionCount += 1
          await Bus.publish(SourceEvent, {
            info: { id: `derived:${fire.id}` },
          })
          return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
        })

        EventService.init()
        const sourceOccurrenceIDs: string[] = []
        const duplicateDelivery = Bus.subscribe(SourceEvent, (event) => EventService.TestHooks.acceptEnvelope(event))
        const unsubscribe = Bus.subscribe(SourceEvent, (event) => sourceOccurrenceIDs.push(event.occurrenceID))
        await Bus.publish(SourceEvent, { info: { id: "source:root" } })
        await EventService.TestHooks.waitForIdle()
        unsubscribe()
        duplicateDelivery()

        const [root, cycle] = EventService.TestHooks.fires(Instance.project.id)
        expect(executionCount).toBe(1)
        expect(root).toMatchObject({
          event_job_id: job.id,
          event_type: SourceEvent.type,
          status: "succeeded",
          disposition: null,
          attempt: 1,
          causation_fire_id: null,
          causation_ancestry: [],
        })
        expect(root.event_occurrence_id).toMatch(/^bus-occurrence:/)
        expect(root.message_id).toBe(`message:${root.id}`)
        expect(cycle).toMatchObject({
          event_job_id: job.id,
          event_type: SourceEvent.type,
          status: "disposition",
          disposition: "causal_cycle",
          attempt: 0,
          causation_fire_id: root.id,
          causation_ancestry: [{ fireID: root.id, jobID: job.id }],
        })
        expect(cycle.event_occurrence_id).toMatch(/^bus-occurrence:/)
        expect(new Set([root.id, cycle.id]).size).toBe(2)
        expect(sourceOccurrenceIDs).toEqual([root.event_occurrence_id, cycle.event_occurrence_id])
      },
    })
  })

  test("serializes one-shot fire authority across independent database owners", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "cross-instance-one-shot",
          eventType: SourceEvent.type,
          prompt: "Execute this one-shot occurrence once",
          projectId: Instance.project.id,
          oneShot: true,
        })
        EventService.init()
        const gate = RuntimeExecutionSettlement.acquireSettlementGate()
        gate.closeAdmission(["scheduler_event_fire"])
        try {
          for (const suffix of ["first", "second"]) {
            try {
              await EventService.TestHooks.acceptEnvelope({
                occurrenceID: `event-occurrence:cross-owner-${suffix}`,
                type: SourceEvent.type,
                properties: { info: { id: `cross-owner-${suffix}` } },
              })
            } catch (error) {
              expect(error).toMatchObject({ name: "RuntimeExecutionAdmissionClosedError" })
            }
          }
          const [first, second] = EventService.TestHooks.fires(Instance.project.id)
          const firstClaim = EventService.TestHooks.claimFire(first!.id, "event-owner:first")
          const secondClaim = EventService.TestHooks.claimFire(second!.id, "event-owner:second")
          expect({ firstClaim, second: EventService.TestHooks.fires(Instance.project.id)[1] }).toMatchObject({
            firstClaim: { id: first!.id, status: "running", owner_id: "event-owner:first" },
            second: { id: second!.id, status: "pending", attempt: 0 },
          })

          Database.immediateTransaction((db) => {
            db.update(EventJobFireTable)
              .set({
                status: "succeeded",
                message_id: `message:${first!.id}`,
                owner_id: null,
                owner_process_id: null,
                lease_until: 0,
                time_completed: Date.now(),
                time_updated: Date.now(),
              })
              .where(eq(EventJobFireTable.id, first!.id))
              .run()
            db.update(EventJobFireTable)
              .set({ lease_until: 0, time_updated: Date.now() })
              .where(eq(EventJobFireTable.id, second!.id))
              .run()
            db.update(EventJobTable).set({ enabled: false, last_run: Date.now() }).where(eq(EventJobTable.id, job.id)).run()
          })
        } finally {
          gate[Symbol.dispose]()
        }
        EventService.TestHooks.recoverProjectFires()
        await EventService.TestHooks.waitForIdle()

        expect(EventService.TestHooks.fires(Instance.project.id)).toMatchObject([
          { event_job_id: job.id, status: "succeeded", attempt: 1 },
          { event_job_id: job.id, status: "disposition", disposition: "job_disabled", attempt: 1 },
        ])
      },
    })
  })

  test("recovers an expired running fire by reconciling its exact persisted wake Message", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        using loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        const session = await Session.create({ kind: "assistant", title: "Event recovery benchmark" })
        const job = await EventService.create({
          name: "message-recovery-benchmark",
          eventType: SourceEvent.type,
          prompt: "Recover the exact durable wake",
          projectId: Instance.project.id,
          sessionId: session.id,
          oneShot: true,
        })
        const fireID = Identifier.ascending("call")
        const messageID = EventService.TestHooks.messageID(fireID)
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EventJobFireTable)
            .values({
              id: fireID,
              event_job_id: job.id,
              project_id: Instance.project.id,
              event_occurrence_id: "event-occurrence:recovery-benchmark",
              event_type: SourceEvent.type,
              causation_ancestry: [],
              status: "running",
              target_session_id: session.id,
              creates_session: false,
              owner_id: "expired-owner",
              owner_process_id: 999_999,
              lease_until: now - 1,
              attempt: 1,
              time_started: now - 10,
              time_created: now - 10,
              time_updated: now - 1,
            })
            .run(),
        )
        await Session.updateMessage({
          id: messageID,
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: now },
          agent: "default",
          model: { providerID: "test", modelID: "event-recovery" },
          extra: {
            wake_reason: {
              source: "scheduler.event",
              jobID: job.id,
              jobName: job.name,
              fireID,
              eventType: SourceEvent.type,
              oneShot: true,
            },
          },
        })

        EventService.init()
        await EventService.TestHooks.waitForIdle()

        expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
          expect.objectContaining({
            id: fireID,
            event_job_id: job.id,
            status: "succeeded",
            message_id: messageID,
            target_session_id: session.id,
            attempt: 2,
            owner_id: null,
            owner_process_id: null,
            lease_until: 0,
          }),
        ])
        expect(EventService.list(Instance.project.id)).toEqual([
          expect.objectContaining({
            id: job.id,
            enabled: false,
            failureCount: 0,
            lastEvent: SourceEvent.type,
          }),
        ])
      },
    })
  })

  test("persists a matching occurrence during cooldown as an explicit terminal disposition", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "cooldown-disposition-benchmark",
          eventType: SourceEvent.type,
          prompt: "Record the cooldown disposition",
          projectId: Instance.project.id,
          cooldownMs: 60_000,
        })
        const lastRun = Date.now()
        Database.use((db) =>
          db.update(EventJobTable).set({ last_run: lastRun }).where(eq(EventJobTable.id, job.id)).run(),
        )

        EventService.init()
        await Bus.publish(SourceEvent, { info: { id: "source:cooldown" } })
        await EventService.TestHooks.waitForIdle()

        expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
          expect.objectContaining({
            event_job_id: job.id,
            event_type: SourceEvent.type,
            status: "disposition",
            disposition: "cooldown",
            attempt: 1,
            message_id: null,
            owner_id: null,
            lease_until: 0,
          }),
        ])
        expect(EventService.list(Instance.project.id)).toEqual([
          expect.objectContaining({ id: job.id, enabled: true, lastRun, failureCount: 0 }),
        ])
      },
    })
  })

  test("retries a transient wake failure on the same durable fire identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "retry-resume-benchmark",
          eventType: SourceEvent.type,
          prompt: "Resume the same fire after a transient failure",
          projectId: Instance.project.id,
        })
        let executionCount = 0
        let resumed!: () => void
        const didResume = new Promise<void>((resolve) => {
          resumed = resolve
        })
        using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          executionCount += 1
          if (executionCount === 1) throw new Error("injected transient wake failure")
          resumed()
          return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
        })

        EventService.init()
        await Bus.publish(SourceEvent, { info: { id: "source:retry" } })
        await didResume
        await EventService.TestHooks.waitForIdle()

        expect(executionCount).toBe(2)
        expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
          expect.objectContaining({
            event_job_id: job.id,
            status: "succeeded",
            attempt: 2,
            message_id: expect.stringMatching(/^message:/),
            owner_id: null,
            lease_until: 0,
          }),
        ])
      },
    })
  })

  test("recovers a claimed fire after a preamble failure with one deterministic wake Message", async () => {
    await using project = await memoryProject()
    await fs.mkdir(path.join(project.path, ".opencorvus"), { recursive: true })
    await fs.writeFile(
      path.join(project.path, ".opencorvus", "opencorvus.jsonc"),
      JSON.stringify({ model: "test/event-claimed-preamble-recovery" }),
    )
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Event claimed preamble recovery" })
        const job = await EventService.create({
          name: "claimed-preamble-recovery",
          eventType: SourceEvent.type,
          prompt: "Recover the same claimed fire after its preamble fails",
          projectId: Instance.project.id,
          sessionId: session.id,
        })
        const loopMessageIDs: string[] = []
        using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ messageID }) => {
          loopMessageIDs.push(messageID)
        })
        let claimCount = 0
        const claimedFireIDs: string[] = []
        let resumed!: () => void
        const didResume = new Promise<void>((resolve) => {
          resumed = resolve
        })
        using _preambleFailure = EventService.TestHooks.installAfterEventFireClaim(({ fire }) => {
          claimCount += 1
          claimedFireIDs.push(fire.id)
          if (claimCount === 1) throw new Error("injected claimed Event fire preamble failure")
          resumed()
        })

        EventService.init()
        await Bus.publish(SourceEvent, { info: { id: "source:claimed-preamble-recovery" } })
        await didResume
        await EventService.TestHooks.waitForIdle()

        const [fire] = EventService.TestHooks.fires(Instance.project.id)
        const messageID = EventService.TestHooks.messageID(fire!.id)
        expect({
          claimCount,
          claimedFireIDs,
          fire,
          messages: Database.use((db) =>
            db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, messageID)).all(),
          ),
          loopMessageIDs,
        }).toEqual({
          claimCount: 2,
          claimedFireIDs: [fire!.id, fire!.id],
          fire: expect.objectContaining({
            id: fire!.id,
            event_job_id: job.id,
            status: "succeeded",
            attempt: 2,
            message_id: messageID,
            owner_id: null,
            lease_until: 0,
          }),
          messages: [{ id: messageID }],
          loopMessageIDs: [messageID],
        })
      },
    })
  })

  test("defers a due recovery timer while Event fire admission is closed and resumes the same fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "recovery-timer-admission-close",
          eventType: SourceEvent.type,
          prompt: "Resume the same fire when runtime admission reopens",
          projectId: Instance.project.id,
        })
        EventService.init()
        const fireID = Identifier.ascending("call")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EventJobFireTable)
            .values({
              id: fireID,
              event_job_id: job.id,
              project_id: Instance.project.id,
              event_occurrence_id: "event-occurrence:recovery-timer-admission-close",
              event_type: SourceEvent.type,
              causation_ancestry: [],
              status: "pending",
              target_session_id: Identifier.ascending("session"),
              creates_session: true,
              lease_until: 0,
              attempt: 0,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        let resumed!: () => void
        const didResume = new Promise<void>((resolve) => {
          resumed = resolve
        })
        using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          resumed()
          return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
        })
        using gate = RuntimeExecutionSettlement.acquireSettlementGate()
        gate.closeAdmission(["scheduler_event_fire"])

        EventService.TestHooks.scheduleLeaseRecovery(fireID)
        const timerDeadline = Date.now() + 2_000
        while (EventService.TestHooks.recoveryTimerActive(fireID) && Date.now() < timerDeadline) {
          await Bun.sleep(10)
        }
        expect({
          recoveryTimerActive: EventService.TestHooks.recoveryTimerActive(fireID),
          fire: EventService.TestHooks.fires(Instance.project.id)[0],
        }).toEqual({
          recoveryTimerActive: false,
          fire: expect.objectContaining({ id: fireID, status: "pending", attempt: 0 }),
        })

        gate[Symbol.dispose]()
        await didResume
        await EventService.TestHooks.waitForIdle()
        expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
          expect.objectContaining({
            id: fireID,
            event_job_id: job.id,
            status: "succeeded",
            attempt: 1,
            message_id: `message:${fireID}`,
          }),
        ])
      },
    })
  })

  test("Instance disposal aborts and joins the owned fire before returning", async () => {
    await using project = await memoryProject()
    const trace: string[] = []
    let started!: () => void
    const didStart = new Promise<void>((resolve) => {
      started = resolve
    })
    using executor = EventService.TestHooks.installWakeExecutor(async ({ signal }) => {
      trace.push("started")
      started()
      await new Promise<void>((resolve) => {
        const observeAbort = () => {
          trace.push("aborted")
          resolve()
        }
        if (signal.aborted) observeAbort()
        else signal.addEventListener("abort", observeAbort, { once: true })
      })
      trace.push("settled")
      throw signal.reason
    })

    let fireID = ""
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await EventService.create({
          name: "disposal-join-benchmark",
          eventType: SourceEvent.type,
          prompt: "Observe disposer settlement",
          projectId: Instance.project.id,
        })
        EventService.init()
        await Bus.publish(SourceEvent, { info: { id: "source:dispose" } })
        fireID = EventService.TestHooks.fires(Instance.project.id)[0]!.id
        await didStart
      },
    })

    await Instance.disposeAll()
    trace.push("disposed")

    const fire = Database.use((db) => db.select().from(EventJobFireTable).where(eq(EventJobFireTable.id, fireID)).get())
    expect(trace).toEqual(["started", "aborted", "settled", "disposed"])
    expect(fire).toMatchObject({
      id: fireID,
      status: "pending",
      owner_id: null,
      owner_process_id: null,
      lease_until: 0,
      attempt: 1,
    })
  })

  test("turns real Event fire inactivity into a physically joined retry occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        using _timeout = SchedulerExecutionInactivityTestHooks.installTimeout(25)
        const trace: string[] = []
        let runtimeGate: ReturnType<typeof RuntimeExecutionSettlement.acquireSettlementGate> | undefined
        using _executor = EventService.TestHooks.installWakeExecutor(async ({ signal }) => {
          trace.push("wake-started")
          await new Promise<void>((resolve) => {
            const abort = () => resolve()
            if (signal.aborted) abort()
            else signal.addEventListener("abort", abort, { once: true })
          })
          trace.push("wake-aborted")
          runtimeGate = RuntimeExecutionSettlement.acquireSettlementGate()
          runtimeGate.closeAdmission(["scheduler_event_fire"])
          throw signal.reason
        })
        const job = await EventService.create({
          name: "event inactivity physical settlement",
          eventType: SourceEvent.type,
          prompt: "settle this inactive fire",
          projectId: Instance.project.id,
        })
        EventService.init()
        await Bus.publish(SourceEvent, { info: { id: "source:event-inactivity" } })
        await EventService.TestHooks.waitForIdle()

        try {
          expect({ trace, fire: EventService.TestHooks.fires(Instance.project.id)[0] }).toMatchObject({
            trace: ["wake-started", "wake-aborted"],
            fire: {
              event_job_id: job.id,
              status: "retry_wait",
              owner_id: null,
              owner_process_id: null,
              error: expect.stringContaining("SchedulerExecutionInactivityError"),
            },
          })
        } finally {
          runtimeGate?.[Symbol.dispose]()
        }
      },
    })
  })

  test("runtime admission reopen resumes the same pending durable fire", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "runtime-reopen-benchmark",
          eventType: SourceEvent.type,
          prompt: "Resume after the runtime gate reopens",
          projectId: Instance.project.id,
        })
        let resumed!: () => void
        const didResume = new Promise<void>((resolve) => {
          resumed = resolve
        })
        using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => {
          resumed()
          return { sessionID: fire.target_session_id, messageID: `message:${fire.id}` }
        })
        EventService.init()

        const gate = RuntimeExecutionSettlement.acquireSettlementGate()
        gate.closeAdmission(["scheduler_event_fire"])
        let admissionError: unknown
        try {
          await Bus.publish(SourceEvent, { info: { id: "source:runtime-reopen" } })
        } catch (error) {
          admissionError = error
        }
        expect(admissionError).toMatchObject({
          name: "RuntimeExecutionAdmissionClosedError",
          kind: "scheduler_event_fire",
        })
        expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
          expect.objectContaining({ event_job_id: job.id, status: "pending", attempt: 0 }),
        ])

        gate[Symbol.dispose]()
        await didResume
        await EventService.TestHooks.waitForIdle()
        expect(EventService.TestHooks.fires(Instance.project.id)).toEqual([
          expect.objectContaining({
            event_job_id: job.id,
            status: "succeeded",
            attempt: 1,
            message_id: expect.stringMatching(/^message:/),
          }),
        ])
      },
    })
  })

  test("captures a fire accepted after settlement starts and replays it after rollback", async () => {
    await using project = await memoryProject()
    let projectID = ""
    let jobID = ""
    let fireID = ""
    let eventGate!: ReturnType<typeof EventService.acquireProcessSettlementGate>
    let resumeEventProjects!: () => Promise<void>
    using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({
      sessionID: fire.target_session_id,
      messageID: `message:${fire.id}`,
    }))
    const runtimeGate = RuntimeExecutionSettlement.acquireSettlementGate()
    runtimeGate.closeAdmission(["scheduler_event_fire"])

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        projectID = Instance.project.id
        const job = await EventService.create({
          name: "partial-dispose-rollback",
          eventType: SourceEvent.type,
          prompt: "Restore the wildcard subscription before replay",
          projectId: projectID,
        })
        jobID = job.id
        EventService.init()
        eventGate = EventService.acquireProcessSettlementGate()
        resumeEventProjects = eventGate.rollback()
        await Bus.publish(SourceEvent, { info: { id: "source:partial-dispose" } }).catch(() => undefined)
        fireID = EventService.TestHooks.fires(projectID)[0]!.id
      },
    })
    await Instance.disposeAll()
    eventGate[Symbol.dispose]()
    let rollbackAttempts = 0
    using _rollbackFailure = EventService.TestHooks.installBeforeProcessRollbackRecovery(() => {
      rollbackAttempts += 1
      if (rollbackAttempts === 1) throw new Error("injected Event rollback recovery failure")
    })
    await expect(resumeEventProjects()).rejects.toThrow("injected Event rollback recovery failure")
    await resumeEventProjects()
    runtimeGate[Symbol.dispose]()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await EventService.TestHooks.waitForIdle()
        expect({ rollbackAttempts, fires: EventService.TestHooks.fires(projectID) }).toEqual({
          rollbackAttempts: 2,
          fires: [
          expect.objectContaining({
            id: fireID,
            event_job_id: jobID,
            status: "succeeded",
            attempt: 1,
          }),
          ],
        })
      },
    })
  })

  test("runtime publication settlement owns wildcard acceptance and the global relay", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let releaseWildcard!: () => void
        const wildcardHold = new Promise<void>((resolve) => {
          releaseWildcard = resolve
        })
        let wildcardEntered!: () => void
        const didEnterWildcard = new Promise<void>((resolve) => {
          wildcardEntered = resolve
        })
        const unsubscribe = Bus.subscribeAll(async (event) => {
          if (event.type !== SourceEvent.type) return
          wildcardEntered()
          await wildcardHold
        })
        let releaseRelay!: () => void
        const relayHold = new Promise<void>((resolve) => {
          releaseRelay = resolve
        })
        let relayEntered!: () => void
        const didEnterRelay = new Promise<void>((resolve) => {
          relayEntered = resolve
        })
        const relay = async (event: { payload?: { type?: string } }) => {
          if (event.payload?.type !== SourceEvent.type) return
          relayEntered()
          await relayHold
        }
        GlobalBus.on("event", relay)
        try {
          void Bus.publish(SourceEvent, { info: { id: "source:runtime-publication-owner" } })
          await didEnterWildcard
          using gate = RuntimeExecutionSettlement.acquireSettlementGate()
          gate.closeAdmission(["protocol_publication"])
          const settlement = gate.waitForIdle(["protocol_publication"])
          let settled = false
          void settlement.then(() => {
            settled = true
          })
          await Promise.resolve()
          expect({ settled, runtime: RuntimeExecutionSettlement.snapshot() }).toMatchObject({
            settled: false,
            runtime: [
              expect.objectContaining({
                kind: "protocol_publication",
                label: expect.stringContaining(SourceEvent.type),
              }),
            ],
          })

          releaseWildcard()
          await didEnterRelay
          await Promise.resolve()
          expect(settled).toBe(false)

          releaseRelay()
          await settlement
          expect({ settled, runtime: RuntimeExecutionSettlement.snapshot() }).toEqual({ settled: true, runtime: [] })
        } finally {
          unsubscribe()
          GlobalBus.off("event", relay)
        }
      },
    })
  })

  test("publication shutdown aborts a cooperating subscriber and waits for its physical finally", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let observedReason: unknown
        let physicalFinally = false
        let entered!: () => void
        const didEnter = new Promise<void>((resolve) => (entered = resolve))
        const unsubscribe = Bus.subscribeAll(async (event) => {
          if (event.type !== SourceEvent.type) return
          entered()
          try {
            await new Promise<void>((resolve) => {
              if (event.signal?.aborted) return resolve()
              event.signal?.addEventListener("abort", () => resolve(), { once: true })
            })
            observedReason = event.signal?.reason
          } finally {
            physicalFinally = true
          }
        })
        try {
          void Bus.publish(SourceEvent, { info: { id: "source:publication-abort" } })
          await didEnter
          using gate = RuntimeExecutionSettlement.acquireSettlementGate()
          gate.closeAdmission(["protocol_publication"])
          const reason = new Error("test publication shutdown")
          gate.requestCancellation(["protocol_publication"], reason)
          await gate.waitForIdle(["protocol_publication"])
          expect({ observedReason, physicalFinally, runtime: RuntimeExecutionSettlement.snapshot() }).toEqual({
            observedReason: reason,
            physicalFinally: true,
            runtime: [],
          })
        } finally {
          unsubscribe()
        }
      },
    })
  })

  test("retries one owned publication occurrence after settlement rollback and clears its failure authority", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrences: string[] = []
        let attempts = 0
        const unsubscribe = Bus.subscribe(
          SourceEvent,
          (event) => {
            attempts += 1
            occurrences.push(event.occurrenceID)
            if (attempts <= 2) throw new Error(`injected transient owned publication failure ${attempts}`)
          },
          { durableID: "test.owned-publication-retry" },
        )
        try {
          Bus.publishOwned(SourceEvent, { info: { id: "source:owned-publication-retry" } })
          const failureDeadline = Date.now() + 2_000
          while (!Bus.TestHooks.ownedPublications().some((entry) => entry.failed) && Date.now() < failureDeadline) {
            await Bun.sleep(10)
          }
          expect(Bus.TestHooks.ownedPublications()).toEqual([
            expect.objectContaining({ pending: false, failed: true }),
          ])
          await expect(Bus.TestHooks.disposeOwnedState()).rejects.toThrow("owned Bus publication(s) remain unresolved")

          const runtimeGate = RuntimeExecutionSettlement.acquireSettlementGate()
          runtimeGate.closeAdmission(["protocol_publication"])
          const busGate = Bus.acquireProcessSettlementGate()
          const resume = busGate.rollback()
          busGate[Symbol.dispose]()
          runtimeGate[Symbol.dispose]()
          await expect(resume()).rejects.toThrow("Failed to resume Bus publications after runtime rollback")
          await resume()

          expect({ occurrences, owned: Bus.TestHooks.ownedPublications() }).toEqual({
            occurrences: [expect.stringMatching(/^bus-occurrence:/), occurrences[0], occurrences[0]],
            owned: [],
          })
          await Bus.TestHooks.disposeOwnedState()
        } finally {
          unsubscribe()
        }
      },
    })
  })

  test("rebuilds Event subscribers before retrying an owned occurrence after partial Instance disposal", async () => {
    await using project = await memoryProject()
    let projectID = ""
    let jobID = ""
    let occurrenceID = ""
    let eventGate!: ReturnType<typeof EventService.acquireProcessSettlementGate>
    let resumeEventProjects!: () => Promise<void>
    using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({
      sessionID: fire.target_session_id,
      messageID: `message:${fire.id}`,
    }))
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        projectID = Instance.project.id
        const job = await EventService.create({
          name: "partial-dispose-owned-publication",
          eventType: SourceEvent.type,
          prompt: "Retry only after the Event subscriber is rebuilt",
          projectId: projectID,
        })
        jobID = job.id
        EventService.init()
        eventGate = EventService.acquireProcessSettlementGate()
        resumeEventProjects = eventGate.rollback()
        using _failure = EventService.TestHooks.failNextCreateFires()
        const publication = Bus.publishOwned(SourceEvent, { info: { id: "source:partial-dispose-retry" } })
        occurrenceID = publication.occurrenceID
        await publication
        const failureDeadline = Date.now() + 2_000
        while (!Bus.TestHooks.ownedPublications().some((entry) => entry.failed) && Date.now() < failureDeadline) {
          await Bun.sleep(10)
        }
      },
    })

    const runtimeGate = RuntimeExecutionSettlement.acquireSettlementGate()
    runtimeGate.closeAdmission(["protocol_publication"])
    runtimeGate.requestCancellation(["protocol_publication"], new Error("test durable publication handoff"))
    await runtimeGate.waitForIdle(["protocol_publication"], 2_000)
    await Instance.disposeAll().catch(() => undefined)
    eventGate[Symbol.dispose]()
    await resumeEventProjects()
    runtimeGate[Symbol.dispose]()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const deadline = Date.now() + 5_000
        while (Bus.TestHooks.ownedPublications().length > 0 && Date.now() < deadline) await Bun.sleep(10)
        await EventService.TestHooks.waitForIdle()
        expect({ owned: Bus.TestHooks.ownedPublications(), fires: EventService.TestHooks.fires(projectID) }).toEqual({
          owned: [],
          fires: [
            expect.objectContaining({
              event_job_id: jobID,
              event_occurrence_id: occurrenceID,
              status: "succeeded",
            }),
          ],
        })
        await Bus.TestHooks.disposeOwnedState()
      },
    })
  }, 30_000)

  test("replays one atomically staged task.updated occurrence after Event acceptance failure and process handoff", async () => {
    await using project = await memoryProject()
    let projectID = ""
    let jobID = ""
    let occurrenceID = ""
    using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({
      sessionID: fire.target_session_id,
      messageID: `message:${fire.id}`,
    }))

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        projectID = Instance.project.id
        const session = await Session.create({ kind: "root", title: "Durable Task update" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: projectID,
              session_id: session.id,
              source: "test",
              product_pillar: "code",
              title: "Before durable update",
              request: "Prove atomic Task mutation and durable Event ingress",
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        const job = await EventService.create({
          name: "durable-task-update-handoff",
          eventType: Event.TaskUpdated.type,
          match: { "properties.taskID": taskID },
          prompt: "Accept the exact durable Task update after handoff",
          projectId: projectID,
        })
        jobID = job.id
        EventService.init()
        using _failure = EventService.TestHooks.failNextCreateFires()
        await EngineService.updateTaskTitle(taskID, "After durable update")
        const staged = Bus.TestHooks.outbox().find((row) => row.event_type === Event.TaskUpdated.type)
        expect(staged).toMatchObject({
          project_id: projectID,
          properties: {
            taskID,
            status: "active",
            summary: "Task title updated",
          },
          wildcard_settled: false,
        })
        occurrenceID = staged!.occurrence_id
        const failureDeadline = Date.now() + 2_000
        while (!Bus.TestHooks.ownedPublications().some((entry) => entry.id === occurrenceID && entry.failed)) {
          if (Date.now() >= failureDeadline) throw new Error("task.updated durable acceptance failure was not observed")
          await Bun.sleep(10)
        }
        expect(Bus.TestHooks.deliveries(occurrenceID)).toContainEqual(
          expect.objectContaining({
            phase: "wildcard",
            subscriber_id: "scheduler.event-service",
            durable: true,
            settled: false,
          }),
        )
        expect(
          Database.use((db) =>
            db.select({ title: EngineTaskTable.title }).from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get(),
          ),
        ).toEqual({ title: "After durable update" })
      },
    })

    const runtimeGate = RuntimeExecutionSettlement.acquireSettlementGate()
    runtimeGate.closeAdmission(["protocol_publication"])
    runtimeGate.requestCancellation(["protocol_publication"], new Error("test task.updated publication handoff"))
    const busGate = Bus.acquireProcessSettlementGate()
    await runtimeGate.waitForIdle(["protocol_publication"], 2_000)
    await Instance.disposeAll().catch(() => undefined)
    const resumeBusPublications = busGate.rollback()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EventService.init()
        busGate[Symbol.dispose]()
        runtimeGate[Symbol.dispose]()
        await resumeBusPublications()
        const deadline = Date.now() + 5_000
        while (Bus.TestHooks.outbox().some((row) => row.occurrence_id === occurrenceID) && Date.now() < deadline) {
          await Bun.sleep(10)
        }
        await EventService.TestHooks.waitForIdle()
        expect(EventService.TestHooks.fires(projectID)).toEqual([
          expect.objectContaining({
            event_job_id: jobID,
            event_occurrence_id: occurrenceID,
            status: "succeeded",
          }),
        ])
      },
    })
  }, 30_000)

  test("automatically retries a durable owned occurrence outside its closed database effect context", async () => {
    await using project = await memoryProject()
    let jobID = ""
    let projectID = ""
    using executor = EventService.TestHooks.installWakeExecutor(async ({ fire }) => ({
      sessionID: fire.target_session_id,
      messageID: `message:${fire.id}`,
    }))
    using _failure = EventService.TestHooks.failNextCreateFires()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const job = await EventService.create({
          name: "automatic-outbox-retry",
          eventType: SourceEvent.type,
          prompt: "Retry the accepted outbox occurrence",
          projectId: Instance.project.id,
        })
        jobID = job.id
        projectID = Instance.project.id
        EventService.init()
        const accepted = Bus.publishOwned(SourceEvent, { info: { id: "source:automatic-outbox-retry" } })
        await accepted
      },
    })
    const deadline = Date.now() + 5_000
    while (Bus.TestHooks.ownedPublications().length > 0 && Date.now() < deadline) await Bun.sleep(10)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await EventService.TestHooks.waitForIdle()
        expect({ owners: Bus.TestHooks.ownedPublications(), outbox: Bus.TestHooks.outbox(), fires: EventService.TestHooks.fires(projectID) }).toEqual({
          owners: [],
          outbox: [],
          fires: [expect.objectContaining({ event_job_id: jobID, status: "succeeded" })],
        })
      },
    })
  }, 30_000)

  test("persists increasing retry delays and settles the same durable occurrence after recovery", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const attempts: Array<{ occurrenceID: string; time: number }> = []
        const unsubscribe = Bus.subscribe(
          SourceEvent,
          (event) => {
            attempts.push({ occurrenceID: event.occurrenceID, time: Date.now() })
            if (attempts.length <= 2) throw new Error(`durable backoff failure ${attempts.length}`)
          },
          { durableID: "test.durable-backoff-growth" },
        )
        try {
          const publication = Bus.publishOwned(SourceEvent, { info: { id: "source:durable-backoff-growth" } })
          const deadline = Date.now() + 5_000
          while (Bus.TestHooks.outbox().some((row) => row.occurrence_id === publication.occurrenceID)) {
            if (Date.now() >= deadline) throw new Error("durable backoff occurrence did not settle")
            await Bun.sleep(10)
          }
          expect({
            occurrences: attempts.map((attempt) => attempt.occurrenceID),
            firstDelay: attempts[1]!.time - attempts[0]!.time,
            secondDelay: attempts[2]!.time - attempts[1]!.time,
          }).toEqual({
            occurrences: [publication.occurrenceID, publication.occurrenceID, publication.occurrenceID],
            firstDelay: expect.any(Number),
            secondDelay: expect.any(Number),
          })
          expect(attempts[1]!.time - attempts[0]!.time).toBeGreaterThanOrEqual(200)
          expect(attempts[2]!.time - attempts[1]!.time).toBeGreaterThanOrEqual(400)
        } finally {
          unsubscribe()
        }
      },
    })
  }, 30_000)

  test("retains the retry owner when durable metadata read and write fail, then settles the same occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrences: string[] = []
        let attempts = 0
        const unsubscribe = Bus.subscribe(
          SourceEvent,
          (event) => {
            attempts += 1
            occurrences.push(event.occurrenceID)
            if (attempts === 1) throw new Error("durable metadata retry injection source failure")
          },
          { durableID: "test.durable-metadata-retry" },
        )
        using _metadataFailure = Bus.TestHooks.failNextDurableRetryMetadata({ reads: 1, writes: 1 })
        try {
          const publication = Bus.publishOwned(SourceEvent, { info: { id: "source:durable-metadata-retry" } })
          const ownerDeadline = Date.now() + 2_000
          while (
            !Bus.TestHooks.ownedPublications().some((owner) => owner.id === publication.occurrenceID && owner.failed) &&
            Date.now() < ownerDeadline
          ) {
            await Bun.sleep(10)
          }
          expect({
            owner: Bus.TestHooks.ownedPublications(),
            retryScheduled: Bus.TestHooks.ownedPublicationRetryScheduled(publication.occurrenceID),
            outbox: Bus.TestHooks.outbox().find((row) => row.occurrence_id === publication.occurrenceID),
          }).toMatchObject({
            owner: [expect.objectContaining({ id: publication.occurrenceID, failed: true, pending: false })],
            retryScheduled: true,
            outbox: { occurrence_id: publication.occurrenceID, attempt_count: 0 },
          })
          const settlementDeadline = Date.now() + 3_000
          while (Bus.TestHooks.outbox().some((row) => row.occurrence_id === publication.occurrenceID)) {
            if (Date.now() >= settlementDeadline) throw new Error("durable metadata retry did not settle")
            await Bun.sleep(10)
          }
          expect({ occurrences, owners: Bus.TestHooks.ownedPublications() }).toEqual({
            occurrences: [publication.occurrenceID, publication.occurrenceID],
            owners: [],
          })
        } finally {
          unsubscribe()
        }
      },
    })
  }, 30_000)

  test("settles a durable retry owner when its outbox authority is deleted", async () => {
    await using project = await memoryProject()
    let occurrenceID = ""
    using _failure = EventService.TestHooks.failNextCreateFires(100)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await EventService.create({
          name: "deleted-outbox-owner",
          eventType: SourceEvent.type,
          prompt: "Stop retrying after the durable authority is deleted",
          projectId: Instance.project.id,
        })
        EventService.init()
        const accepted = Bus.publishOwned(SourceEvent, { info: { id: "source:deleted-outbox" } })
        await accepted
        occurrenceID = accepted.occurrenceID
      },
    })
    const failureDeadline = Date.now() + 2_000
    while (!Bus.TestHooks.ownedPublications().some((entry) => entry.failed) && Date.now() < failureDeadline) {
      await Bun.sleep(10)
    }
    Database.use((db) =>
      db.delete(BusPublicationOutboxTable).where(eq(BusPublicationOutboxTable.occurrence_id, occurrenceID)).run(),
    )
    await Bun.sleep(350)
    expect({ owners: Bus.TestHooks.ownedPublications(), outbox: Bus.TestHooks.outbox() }).toEqual({
      owners: [],
      outbox: [],
    })
  }, 30_000)

  test("commits the old durable publication owner and lets one successor deliver the same occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let oldDeliveries = 0
        let successorDeliveries = 0
        let oldEntered!: () => void
        const oldStarted = new Promise<void>((resolve) => (oldEntered = resolve))
        const oldSubscriber = async (event: Bus.Envelope) => {
          oldDeliveries += 1
          oldEntered()
          await new Promise<void>((_, reject) => {
            event.signal!.addEventListener("abort", () => reject(event.signal!.reason), { once: true })
          })
        }
        const unsubscribeOld = Bus.subscribeAll(oldSubscriber, { durableID: "test.bus-process-successor" })
        const publication = Bus.publishOwned(SourceEvent, { info: { id: "source:bus-process-commit" } })
        await oldStarted

        const runtimeGate = RuntimeExecutionSettlement.acquireSettlementGate()
        runtimeGate.closeAdmission(["protocol_publication"])
        runtimeGate.requestCancellation(["protocol_publication"], new Error("test Bus process commit"))
        const busGate = Bus.acquireProcessSettlementGate()
        await runtimeGate.waitForIdle(["protocol_publication"], 2_000)
        unsubscribeOld()
        busGate.commit()
        runtimeGate.commit()
        busGate[Symbol.dispose]()
        runtimeGate[Symbol.dispose]()

        await Bun.sleep(300)
        expect(oldDeliveries).toBe(1)
        const unsubscribeSuccessor = Bus.subscribeAll(
          () => {
            successorDeliveries += 1
          },
          { durableID: "test.bus-process-successor" },
        )
        try {
          Bus.resumeDurablePublications()
          const deadline = Date.now() + 2_000
          while (Bus.TestHooks.outbox().some((row) => row.occurrence_id === publication.occurrenceID)) {
            if (Date.now() >= deadline) throw new Error("successor did not drain committed Bus occurrence")
            await Bun.sleep(10)
          }
          expect({ occurrenceID: publication.occurrenceID, oldDeliveries, successorDeliveries }).toEqual({
            occurrenceID: publication.occurrenceID,
            oldDeliveries: 1,
            successorDeliveries: 1,
          })
        } finally {
          unsubscribeSuccessor()
        }
      },
    })
  }, 30_000)

  test("rejects conflicting durable subscriber identities and delivers distinct identities once", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let first = 0
        let second = 0
        const firstSubscriber = () => {
          first += 1
        }
        const conflictingSubscriber = () => undefined
        const unsubscribeFirst = Bus.subscribe(SourceEvent, firstSubscriber, { durableID: "test.local.first" })
        expect(() =>
          Bus.subscribe(SourceEvent, conflictingSubscriber, { durableID: "test.local.first" }),
        ).toThrow(DurableBusSubscriptionIdentityConflictError)
        const unsubscribeSecond = Bus.subscribe(
          SourceEvent,
          () => {
            second += 1
          },
          { durableID: "test.local.second" },
        )
        const sharedLocal = () => undefined
        const unsubscribeSharedDurable = Bus.subscribe(SourceEvent, sharedLocal, {
          durableID: "test.local.shared",
        })
        const unsubscribeSharedTransient = Bus.subscribeAll(sharedLocal)
        unsubscribeSharedDurable()
        unsubscribeSharedTransient()
        const unsubscribeSharedReplacement = Bus.subscribe(SourceEvent, () => undefined, {
          durableID: "test.local.shared",
        })
        const globalFirst = () => undefined
        GlobalBus.on("event", globalFirst, { durableID: "test.global.first" })
        expect(() =>
          GlobalBus.on("event", () => undefined, { durableID: "test.global.first" }),
        ).toThrow(DurableBusSubscriptionIdentityConflictError)
        const sharedGlobal = () => undefined
        GlobalBus.on("event", sharedGlobal, { durableID: "test.global.shared" })
        GlobalBus.on("event", sharedGlobal)
        GlobalBus.off("event", sharedGlobal)
        const replacementGlobal = () => undefined
        GlobalBus.on("event", replacementGlobal, { durableID: "test.global.shared" })
        try {
          await Bus.publish(SourceEvent, { info: { id: "source:distinct-durable-subscribers" } })
          expect({ first, second }).toEqual({ first: 1, second: 1 })
        } finally {
          unsubscribeFirst()
          unsubscribeSecond()
          unsubscribeSharedReplacement()
          GlobalBus.off("event", globalFirst)
          GlobalBus.off("event", replacementGlobal)
        }
      },
    })
  })

  test("requires a real transaction and rolls back the source mutation with its durable occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Transactional Bus authority" })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        Database.use((db) =>
          db
            .insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: session.id,
              source: "test",
              product_pillar: "code",
              title: "Before rollback",
              request: "Prove durable Bus transaction authority",
              time_started: now,
              time_created: now,
              time_updated: now,
            })
            .run(),
        )
        expect(() =>
          Database.use(() =>
            Bus.publishOwnedInTransaction(Event.TaskUpdated, {
              taskID,
              status: "active",
              summary: "Invalid non-transactional publication",
            }),
          ),
        ).toThrow(Database.ActiveDatabaseTransactionRequiredError)
        expect(() =>
          Database.transaction((db) =>
            Database.savepoint(db, (() => Promise.resolve()) as unknown as () => void),
          ),
        ).toThrow("Database.savepoint callback must be synchronous")

        for (const nested of [false, true]) {
          expect(() =>
            Database.transaction((db) => {
              db.update(EngineTaskTable)
                .set({ title: nested ? "Nested rollback" : "Top-level rollback" })
                .where(eq(EngineTaskTable.id, taskID))
                .run()
              const stage = () =>
                Bus.publishOwnedInTransaction(Event.TaskUpdated, {
                  taskID,
                  status: "active",
                  summary: nested ? "Nested rollback" : "Top-level rollback",
                })
              if (nested) Database.transaction(() => void stage())
              else stage()
              throw new Error("injected source transaction rollback")
            }),
          ).toThrow("injected source transaction rollback")
          expect({
            task: Database.use((db) =>
              db.select({ title: EngineTaskTable.title }).from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get(),
            ),
            outbox: Bus.TestHooks.outbox().filter((row) => row.event_type === Event.TaskUpdated.type),
          }).toEqual({ task: { title: "Before rollback" }, outbox: [] })
        }
      },
    })
  })
})
