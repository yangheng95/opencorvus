import { afterEach, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { InstanceLifecycleContext } from "@/project/instance-lifecycle-context"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { SessionTable } from "@/session/session.sql"
import { Database } from "@/storage/db"
import {
  awaitTaskMessageProtocolBridgeIdle,
  TaskMessageProtocolBridgeTestHooks,
} from "@/orchestrator/protocol/message-bridge"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a persistent watcher callback owns its complete database subscriber and GlobalBus publication", async () => {
  await using project = await memoryProject()
  const globalEvents: Array<{ directory?: string; payload: { type?: string } }> = []
  const onGlobalEvent = (event: { directory?: string; payload: { type?: string } }) => globalEvents.push(event)
  GlobalBus.on("event", onGlobalEvent)
  let unsubscribe = () => undefined
  let publication!: Promise<void>
  const subscriberProjects: string[] = []
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        unsubscribe = Bus.subscribe(FileWatcher.Event.Updated, async () => {
          await new Promise((resolve) => setTimeout(resolve, 25))
          Database.use((db) => db.select({ id: SessionTable.id }).from(SessionTable).limit(1).all())
          subscriberProjects.push(Instance.project.id)
        })
        const runPersistentCallback = FileWatcher.TestHooks.persistentCallbackRunner(InstanceLifecycleContext.use())
        publication = runPersistentCallback(project.path, "focused watcher publication", () =>
          Bus.publish(FileWatcher.Event.Updated, { file: `${project.path}\\owned.ts`, event: "change" }),
        )
        expect(projectID).toBe(Instance.project.id)
      },
    })

    await publication
    expect(subscriberProjects).toHaveLength(1)
    expect(
      globalEvents
        .filter((event) => event.payload.type === FileWatcher.Event.Updated.type)
        .map((event) => event.directory),
    ).toEqual([project.path])
  } finally {
    unsubscribe()
    GlobalBus.off("event", onGlobalEvent)
  }
})

test("a physical owner abort settles its in-flight Bus publication before successor work", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = new AbortController()
      let subscriberStarted!: () => void
      const started = new Promise<void>((resolve) => (subscriberStarted = resolve))
      let subscriberObservedAbort!: () => void
      const abortObserved = new Promise<void>((resolve) => (subscriberObservedAbort = resolve))
      let releaseSubscriber!: () => void
      const released = new Promise<void>((resolve) => (releaseSubscriber = resolve))
      let observedAbort: unknown
      const deliveryOrder: string[] = []
      const unsubscribe = Bus.subscribe(FileWatcher.Event.Updated, async (event) => {
        if (event.properties.file.endsWith("successor.ts")) {
          deliveryOrder.push("successor-delivered")
          return
        }
        subscriberStarted()
        await new Promise<void>((resolve, reject) => {
          const abort = async () => {
            observedAbort = event.signal?.reason
            subscriberObservedAbort()
            await released
            deliveryOrder.push("old-finished")
            reject(event.signal?.reason)
          }
          if (event.signal?.aborted) void abort()
          else event.signal?.addEventListener("abort", () => void abort(), { once: true })
        })
      })
      try {
        const reason = new Error("physical publication owner ended")
        const publication = Bus.publish(
          FileWatcher.Event.Updated,
          { file: `${project.path}\\owned.ts`, event: "change" },
          { signal: owner.signal },
        )
        await started
        owner.abort(reason)
        await abortObserved
        expect(RuntimeExecutionSettlement.snapshot()).toContainEqual({
          kind: "protocol_publication",
          label: `${FileWatcher.Event.Updated.type}:${publication.occurrenceID}`,
        })
        releaseSubscriber()
        await expect(publication).rejects.toBe(reason)
        expect(observedAbort).toBe(reason)
        expect(RuntimeExecutionSettlement.snapshot()).toEqual([])
        await Bus.publish(FileWatcher.Event.Updated, {
          file: `${project.path}\\successor.ts`,
          event: "change",
        })
        expect(deliveryOrder).toEqual(["old-finished", "successor-delivered"])
      } finally {
        unsubscribe()
      }
    },
  })
})

test("a GlobalBus publication retains its exact owner abort through physical listener settlement", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const owner = new AbortController()
      let listenerStarted!: () => void
      const started = new Promise<void>((resolve) => (listenerStarted = resolve))
      let listenerObservedAbort!: () => void
      const abortObserved = new Promise<void>((resolve) => (listenerObservedAbort = resolve))
      let releaseListener!: () => void
      const released = new Promise<void>((resolve) => (releaseListener = resolve))
      const onGlobalEvent = async (envelope: Parameters<typeof GlobalBus.emitAndWait>[1]) => {
        if (
          envelope.payload.type !== FileWatcher.Event.Updated.type ||
          !envelope.payload.properties.file.endsWith("global-owned.ts")
        ) {
          return
        }
        listenerStarted()
        await new Promise<void>((resolve) => {
          const abort = async () => {
            listenerObservedAbort()
            await released
            resolve()
          }
          if (envelope.payload.signal?.aborted) void abort()
          else envelope.payload.signal?.addEventListener("abort", () => void abort(), { once: true })
        })
      }
      GlobalBus.on("event", onGlobalEvent)
      try {
        const reason = new Error("GlobalBus owner ended")
        const publication = Bus.publish(
          FileWatcher.Event.Updated,
          { file: `${project.path}\\global-owned.ts`, event: "change" },
          { signal: owner.signal },
        )
        await started
        owner.abort(reason)
        await abortObserved
        expect(RuntimeExecutionSettlement.snapshot()).toContainEqual({
          kind: "protocol_publication",
          label: `${FileWatcher.Event.Updated.type}:${publication.occurrenceID}`,
        })
        releaseListener()
        await expect(publication).rejects.toBe(reason)
        expect(RuntimeExecutionSettlement.snapshot()).toEqual([])
      } finally {
        releaseListener()
        GlobalBus.off("event", onGlobalEvent)
      }
    },
  })
})

test("a cancelled queued relay preserves its physical predecessor before successor delivery", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const events: string[] = []
      let releasePredecessor!: () => void
      const predecessor = new Promise<void>((resolve) => (releasePredecessor = resolve)).then(() => {
        events.push("predecessor-finished")
      })
      const trackedPredecessor = TaskMessageProtocolBridgeTestHooks.trackLifecycle(predecessor)
      const cancelledOwner = new AbortController()
      const cancelledReason = new Error("queued relay owner ended")
      const cancelled = TaskMessageProtocolBridgeTestHooks.enqueueRelay({
        type: "test.cancelled-relay",
        hostDirectory: project.path,
        signal: cancelledOwner.signal,
        fn: async () => {
          events.push("cancelled-relay-started")
        },
      })
      cancelledOwner.abort(cancelledReason)
      await expect(cancelled).rejects.toBe(cancelledReason)
      const successor = TaskMessageProtocolBridgeTestHooks.enqueueRelay({
        type: "test.successor-relay",
        hostDirectory: project.path,
        fn: async () => {
          events.push("successor-delivered")
        },
      })
      try {
        releasePredecessor()
        await Promise.all([trackedPredecessor, successor])
        await awaitTaskMessageProtocolBridgeIdle()
        expect(events).toEqual(["predecessor-finished", "successor-delivered"])
      } finally {
        releasePredecessor()
        await Promise.allSettled([trackedPredecessor, successor])
        await awaitTaskMessageProtocolBridgeIdle().catch(() => undefined)
      }
    },
  })
})
