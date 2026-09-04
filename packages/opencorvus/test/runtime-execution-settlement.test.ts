import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import {
  RuntimeExecutionAdmissionClosedError,
  RuntimeExecutionSettlement,
  RuntimeExecutionSettlementInactivityError,
} from "@/runtime/execution-settlement"
import { currentRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { Server } from "@/server/server"
import {
  awaitTaskMessageProtocolBridgeIdle,
  TaskMessageProtocolBridgeTestHooks,
} from "@/orchestrator/protocol/message-bridge"
import { Identifier } from "@/id/id"
import { Instance, InstanceSettlementInactivityError } from "@/project/instance"
import { Session } from "@/session"
import { MessageTable } from "@/session/session.sql"
import { SessionWake } from "@/session/wake"
import { Database, eq } from "@/storage/db"
import { ProjectGitLock } from "@/worktree/git-lock"
import { withKeyedLock } from "@/util/lock"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

describe("runtime execution settlement authority", () => {
  test("returns shutdown cancellation and admits a successor after owner release", async () => {
    const locks = new Map<string, Promise<unknown>>()
    let releaseOwner!: () => void
    const held = new Promise<void>((resolve) => {
      releaseOwner = resolve
    })
    const owner = withKeyedLock(locks, "project-memory", () => held)
    await Promise.resolve()
    const controller = new AbortController()
    const queued = withKeyedLock(
      locks,
      "project-memory",
      async () => undefined,
      1_000,
      controller.signal,
    )

    controller.abort(new Error("shutdown cancelled pending owner"))
    await expect(queued).rejects.toThrow("shutdown cancelled pending owner")
    releaseOwner()
    await owner
    const successor = await withKeyedLock(locks, "project-memory", async () => "successor-acquired")
    expect(successor).toBe("successor-acquired")
  })

  test("reports the exact active Instance authority and converges on the same settlement gate", async () => {
    await using project = await memoryProject()
    let reportStarted!: () => void
    const started = new Promise<void>((resolve) => (reportStarted = resolve))
    let releaseActivity!: () => void
    const activityReleased = new Promise<void>((resolve) => (releaseActivity = resolve))
    const activity = Instance.provide({
      directory: project.path,
      fn: async () => {
        reportStarted()
        await activityReleased
      },
    })
    await started

    using gate = Instance.acquireProcessSettlementGate()
    const inactive = await gate.waitForIdle(25).catch((error) => error)
    expect(inactive).toMatchObject({
      name: "InstanceSettlementInactivityError",
      inactivityTimeoutMilliseconds: 25,
      labels: [expect.stringContaining("activities=0:closing=false")],
    } satisfies Partial<InstanceSettlementInactivityError>)

    releaseActivity()
    await activity
    await gate.waitForIdle(250)
    expect(Instance.current()).toBeUndefined()
  })

  test("publishes terminal protocol evidence while an owned execution is being terminated", async () => {
    const events: string[] = []
    const execution = RuntimeExecutionSettlement.reserve("session_wake_loop", "terminal-protocol-on-shutdown")
    execution.signal.addEventListener(
      "abort",
      () => {
        const publication = RuntimeExecutionSettlement.reserve(
          "protocol_publication",
          "terminal-protocol-on-shutdown",
        )
        events.push("terminal:published")
        publication.settle()
        execution.settle()
      },
      { once: true },
    )

    const settled = await Server.settleCurrentProcessExecution("terminal protocol shutdown contract", {
      disposeInstances: async () => events.push("instances:disposed"),
    })
    await settled.releaseHandoff(false)

    expect(events).toEqual(["terminal:published", "instances:disposed"])
    RuntimeExecutionSettlement.reserve("protocol_publication", "post-shutdown-rollback").settle()
  })

  test("classifies a wake rejected by the production server settlement reason", async () => {
    const execution = RuntimeExecutionSettlement.reserve("session_wake_loop", "shutdown-rejected-wake")
    const operation = new Promise<void>((_resolve, reject) => {
      execution.signal.addEventListener("abort", () => reject(execution.signal.reason), { once: true })
    })
    execution.settleWith(operation)
    const disposition = operation.catch((error) => SessionWake.loopFailureDisposition(error, execution.signal.reason))

    const settled = await Server.settleCurrentProcessExecution("exact wake shutdown contract", {
      disposeInstances: async () => {},
    })
    try {
      expect(await disposition).toBe("cancelled")
      expect(execution.signal.reason).toEqual(expect.objectContaining({ message: "exact wake shutdown contract" }))
    } finally {
      await settled.releaseHandoff(false)
    }
  })

  test("cancels an unfinished protocol subscriber after terminal facts are fenced", async () => {
    let observedReason = ""
    const publication = RuntimeExecutionSettlement.reserve(
      "protocol_publication",
      "blocked-durable-subscriber",
    )
    const operation = new Promise<void>((_resolve, reject) => {
      publication.signal.addEventListener(
        "abort",
        () => {
          observedReason = publication.signal.reason instanceof Error
            ? publication.signal.reason.message
            : String(publication.signal.reason)
          reject(publication.signal.reason)
        },
        { once: true },
      )
    })
    publication.settleWith(operation)

    const settled = await Server.settleCurrentProcessExecution("durable subscriber runtime handoff", {
      disposeInstances: async () => undefined,
    })
    await settled.releaseHandoff(false)

    expect(observedReason).toBe("durable subscriber runtime handoff")
  })

  test("bounds Project Git lock inactivity and admits settlement after the held lifecycle exits", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-git-settlement-"))
    const events: string[] = []
    let releaseOperation!: () => void
    let operationStarted!: () => void
    const started = new Promise<void>((resolve) => (operationStarted = resolve))
    const lifecycle = ProjectGitLock.withLease(
      { projectID: "project-git-settlement-contract", primaryWorktreeDir: directory },
      async () => {
        events.push("operation:started")
        operationStarted()
        await new Promise<void>((resolve) => (releaseOperation = resolve))
        events.push("operation:released")
      },
    )
    try {
      await started
      const firstGate = ProjectGitLock.acquireSettlementGate()
      await expect(firstGate.waitForIdle(50)).rejects.toBeInstanceOf(ProjectGitLock.SettlementInactivityError)
      events.push("gate:timed-out")
      firstGate[Symbol.dispose]()

      releaseOperation()
      await lifecycle
      using retryGate = ProjectGitLock.acquireSettlementGate()
      await retryGate.waitForIdle(50)
      events.push("gate:retried")

      expect(events).toEqual(["operation:started", "gate:timed-out", "operation:released", "gate:retried"])
    } finally {
      releaseOperation?.()
      await lifecycle.catch(() => undefined)
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("retains process occurrence across protocol inactivity and converges after late settlement", async () => {
    const occurrenceID = currentRuntimeProcessOccurrence().occurrenceID
    const publication = RuntimeExecutionSettlement.reserve("protocol_publication", "late-protocol-subscriber")
    const firstGate = RuntimeExecutionSettlement.acquireSettlementGate()
    firstGate.closeAdmission(["protocol_publication"])
    try {
      await expect(firstGate.waitForIdle(["protocol_publication"], 50)).rejects.toBeInstanceOf(
        RuntimeExecutionSettlementInactivityError,
      )
      expect(currentRuntimeProcessOccurrence().occurrenceID).toBe(occurrenceID)
      firstGate[Symbol.dispose]()

      publication.settle()
      const retryGate = RuntimeExecutionSettlement.acquireSettlementGate()
      retryGate.closeAdmission(["protocol_publication"])
      await retryGate.waitForIdle(["protocol_publication"], 50)
      retryGate.commit()
      retryGate[Symbol.dispose]()

      expect(currentRuntimeProcessOccurrence().occurrenceID).toBe(occurrenceID)
    } finally {
      firstGate[Symbol.dispose]()
      publication.settle()
    }
  })

  test("cancels the physical owner and settles the gate after the owner exits", async () => {
    const events: string[] = []
    let releaseOwner!: () => void
    const ownerSettlement = new Promise<void>((resolve) => {
      releaseOwner = resolve
    })
    const reservation = RuntimeExecutionSettlement.reserve("task_control_activation", "timing-contract")
    reservation.onCancel((reason) => {
      events.push(`cancel:${reason instanceof Error ? reason.message : String(reason)}`)
    })
    reservation.settleWith(
      ownerSettlement.then(() => {
        events.push("owner:settled")
      }),
    )

    using gate = RuntimeExecutionSettlement.acquireSettlementGate()
    gate.closeAdmission(["task_control_activation"])
    gate.requestCancellation(["task_control_activation"], new Error("runtime handoff"))
    const gateSettlement = gate.waitForIdle(["task_control_activation"]).then(() => {
      events.push("gate:settled")
    })
    releaseOwner()
    await gateSettlement

    expect(events).toEqual(["cancel:runtime handoff", "owner:settled", "gate:settled"])
  })

  test("returns the typed admission error while a settlement phase owns the kind", () => {
    using gate = RuntimeExecutionSettlement.acquireSettlementGate()
    gate.closeAdmission(["task_cancellation"])
    let admissionError: unknown
    try {
      RuntimeExecutionSettlement.reserve("task_cancellation", "closed-admission-contract")
    } catch (error) {
      admissionError = error
    }

    expect(admissionError).toMatchObject({
      name: "RuntimeExecutionAdmissionClosedError",
      kind: "task_cancellation",
      message: "Runtime execution admission is closed for task_cancellation",
    })
    expect(admissionError).toBeInstanceOf(RuntimeExecutionAdmissionClosedError)
  })

  test("reopens admission under the same gate token and starts the registered durable rescan", () => {
    const events: string[] = []
    using _reopen = RuntimeExecutionSettlement.onAdmissionReopened("task_control_activation", () => {
      events.push("admission:reopened")
      RuntimeExecutionSettlement.reserve("task_control_activation", "durable-rescan").settle()
      events.push("rescan:accepted")
    })
    const gate = RuntimeExecutionSettlement.acquireSettlementGate()
    gate.closeAdmission(["task_control_activation"])
    events.push("admission:closed")
    gate[Symbol.dispose]()

    expect(events).toEqual(["admission:closed", "admission:reopened", "rescan:accepted"])
  })

  test("restores every owned admission and reports an aggregate when one reopen listener fails", () => {
    const events: string[] = []
    using _failing = RuntimeExecutionSettlement.onAdmissionReopened("task_control_activation", () => {
      events.push("task-ingress:reopened")
      throw new Error("injected Task ingress rescan failure")
    })
    using _succeeding = RuntimeExecutionSettlement.onAdmissionReopened("task_cancellation", () => {
      events.push("task-cancellation:reopened")
    })
    const gate = RuntimeExecutionSettlement.acquireSettlementGate()
    gate.closeAdmission(["task_control_activation", "task_cancellation"])
    let releaseError: unknown
    try {
      gate[Symbol.dispose]()
    } catch (error) {
      releaseError = error
    }
    RuntimeExecutionSettlement.reserve("task_control_activation", "post-failure-ingress-admission").settle()
    RuntimeExecutionSettlement.reserve("task_cancellation", "post-failure-cancellation-admission").settle()
    events.push("post-failure:admitted")

    expect({ events, releaseError }).toMatchObject({
      events: ["task-ingress:reopened", "task-cancellation:reopened", "post-failure:admitted"],
      releaseError: {
        name: "AggregateError",
        message: "Runtime execution admission reopen listeners failed",
        errors: [expect.objectContaining({ message: "injected Task ingress rescan failure" })],
      },
    })
  })

  test("drains existing database lifecycle effects then returns a typed error until admission reopens", async () => {
    const { Database, DatabaseEffectAdmissionClosedError } = await import("@/storage/db")
    const events: string[] = []
    let releaseEffect!: () => void
    let effectStarted!: () => void
    const started = new Promise<void>((resolve) => {
      effectStarted = resolve
    })
    const effect = Database.runLifecycleActivity("runtime-settlement-contract", async () => {
      events.push("effect:started")
      effectStarted()
      await new Promise<void>((resolve) => {
        releaseEffect = resolve
      })
      events.push("effect:settled")
    })
    await started
    const acquisition = Database.acquireEffectSettlementGate(5_000).then((gate) => {
      events.push("gate:acquired")
      return gate
    })
    releaseEffect()
    const gate = await acquisition
    await effect
    let admissionError: unknown
    try {
      Database.effect(() => events.push("effect:closed-admission"))
    } catch (error) {
      admissionError = error
    }
    gate[Symbol.dispose]()
    Database.effect(() => events.push("effect:reopened"))
    await Database.awaitEffectIdle(5_000)

    expect({ events, admissionError }).toMatchObject({
      events: ["effect:started", "effect:settled", "gate:acquired", "effect:reopened"],
      admissionError: {
        name: "DatabaseEffectAdmissionClosedError",
        operation: "Database.effect",
        message: "Database.effect rejected because database effect admission is closed during runtime settlement",
      },
    })
    expect(admissionError).toBeInstanceOf(DatabaseEffectAdmissionClosedError)
  })

  test("rejects a Protocol append before insertion while database settlement owns new access", async () => {
    const { ProtocolStore } = await import("@/protocol/store")
    const { DatabaseEffectAdmissionClosedError } = await import("@/storage/db")
    await using project = await memoryProject()
    const session = await Instance.provide({
      directory: project.path,
      fn: () => Session.createNext({ directory: Instance.directory, kind: "assistant", title: "Protocol settlement" }),
    })
    const aggregateID = session.id
    const input = {
      kind: "event" as const,
      type: "runtime.database-settlement",
      aggregate: "session" as const,
      aggregate_id: aggregateID,
      source: "runtime-settlement-test",
      seq: 1,
      payload: { phase: "handoff" },
    }
    try {
      const gate = await Database.acquireEffectSettlementGate(5_000)
      let appendError: unknown
      try {
        await ProtocolStore.appendEvent(input)
      } catch (error) {
        appendError = error
      }
      gate[Symbol.dispose]()
      const appended = await ProtocolStore.appendEvent(input)

      expect({
        appendError: {
          name: appendError instanceof Error ? appendError.name : undefined,
          operation: appendError instanceof DatabaseEffectAdmissionClosedError ? appendError.operation : undefined,
        },
        appended,
      }).toMatchObject({
        appendError: {
          name: "DatabaseEffectAdmissionClosedError",
          operation: "Database.transaction",
        },
        appended: { aggregateID, sequence: 1, type: input.type },
      })
      expect(appendError).toBeInstanceOf(DatabaseEffectAdmissionClosedError)
    } finally {
      await Instance.disposeAll()
      await resetMemoryDatabase()
    }
  })

  test("blocks late Instance creation with a typed error and admits a fresh owner after handoff release", async () => {
    const { Instance, InstanceProcessAdmissionClosedError } = await import("@/project/instance")
    const [{ mkdtemp, rm }, { tmpdir }, path, { execFileSync }] = await Promise.all([
      import("node:fs/promises"),
      import("node:os"),
      import("node:path"),
      import("node:child_process"),
    ])
    const directory = await mkdtemp(path.default.join(tmpdir(), "opencorvus-instance-admission-"))
    execFileSync("git", ["init"], { cwd: directory, stdio: "ignore" })
    const events: string[] = []
    try {
      const gate = Instance.acquireProcessSettlementGate()
      const admissionErrors: unknown[] = []
      try {
        await Instance.provide({
          directory,
          fn: () => events.push("instance:closed-admission"),
        })
      } catch (error) {
        admissionErrors.push(error)
      }
      for (const operation of [
        () => Instance.provideProjectIdentity({ directory, fn: () => events.push("identity:closed-admission") }),
        () => Instance.tryProvideActive({ directory, fn: () => events.push("active:closed-admission") }),
        () => Instance.forEachActive({ fn: () => events.push("iteration:closed-admission") }),
        () => Instance.converge({ maximumRetained: 1 }),
      ]) {
        try {
          await operation()
        } catch (error) {
          admissionErrors.push(error)
        }
      }
      gate[Symbol.dispose]()
      await Instance.provide({
        directory,
        fn: () => events.push("instance:reopened"),
      })
      await Instance.disposeAll()

      expect({ events, admissionErrors }).toMatchObject({
        events: ["instance:reopened"],
        admissionErrors: Array.from({ length: 5 }, () => ({
          name: "InstanceProcessAdmissionClosedError",
          message: "Instance process admission is closed during runtime settlement",
        })),
      })
      expect(admissionErrors.every((error) => error instanceof InstanceProcessAdmissionClosedError)).toBe(true)
    } finally {
      await Instance.disposeAll()
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("settles a durable Session wake loop before the runtime gate releases ownership", async () => {
    await using project = await memoryProject()
    const events: string[] = []
    let loopStarted!: () => void
    const didStart = new Promise<void>((resolve) => {
      loopStarted = resolve
    })
    using loopExecutor = SessionWake.TestHooks.installWakeLoopExecutor(async ({ signal }) => {
      events.push("loop:registered")
      loopStarted()
      await new Promise<void>((resolve) => {
        const cancelled = () => {
          events.push("loop:cancelled")
          resolve()
        }
        if (signal.aborted) cancelled()
        else signal.addEventListener("abort", cancelled, { once: true })
      })
      events.push("loop:physically-settled")
    })

    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session = await Session.createNext({
            directory: Instance.directory,
            kind: "assistant",
            title: "Runtime wake settlement",
          })
          const messageID = Identifier.ascending("message")
          await Session.persistMessage({
            info: {
              id: messageID,
              sessionID: session.id,
              role: "user",
              author: "orchestrator",
              time: { created: Date.now() },
              agent: "default",
              model: { providerID: "test", modelID: "runtime-wake-settlement" },
            },
            parts: [
              {
                id: Identifier.ascending("part"),
                sessionID: session.id,
                messageID,
                type: "text",
                text: "settle this durable wake before ownership release",
              },
            ],
          })
          const durable = Database.use((db) =>
            db.select({ id: MessageTable.id }).from(MessageTable).where(eq(MessageTable.id, messageID)).get(),
          )
          expect(durable).toEqual({ id: messageID })
          events.push("message:durable")

          SessionWake.resumePersistedWake({ sessionID: session.id, messageID, directory: session.directory })
          await didStart
          expect(RuntimeExecutionSettlement.snapshot()).toContainEqual({
            kind: "session_wake_loop",
            label: `session-wake-loop:${session.id}:${messageID}`,
          })

          using gate = RuntimeExecutionSettlement.acquireSettlementGate()
          gate.closeAdmission(["session_wake_loop"])
          gate.requestCancellation(["session_wake_loop"], new Error("runtime process handoff"))
          await gate.waitForIdle(["session_wake_loop"])
          events.push("runtime-gate:settled")
        },
      })
    } finally {
      await Instance.disposeAll()
      await resetMemoryDatabase()
    }

    expect(events).toEqual([
      "message:durable",
      "loop:registered",
      "loop:cancelled",
      "loop:physically-settled",
      "runtime-gate:settled",
    ])
  })

  test("bounds a held Message bridge lifecycle and retains the process occurrence after late settlement", async () => {
    const occurrenceID = currentRuntimeProcessOccurrence().occurrenceID
    let releaseBridge!: () => void
    const bridgeOperation = new Promise<void>((resolve) => (releaseBridge = resolve))
    const trackedBridge = TaskMessageProtocolBridgeTestHooks.trackLifecycle(bridgeOperation)
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    try {
      await expect(
        Server.settleCurrentProcessExecution("held Message bridge lifecycle", { disposeInstances: async () => {} }),
      ).rejects.toBeInstanceOf(Database.EffectSettlementInactivityError)
      expect(currentRuntimeProcessOccurrence().occurrenceID).toBe(occurrenceID)

      releaseBridge()
      await trackedBridge
      await awaitTaskMessageProtocolBridgeIdle()
      RuntimeExecutionSettlement.reserve("task_control_activation", "late-bridge-rollback-admission").settle()

      expect(currentRuntimeProcessOccurrence().occurrenceID).toBe(occurrenceID)
    } finally {
      releaseBridge()
      await trackedBridge.catch(() => undefined)
      await awaitTaskMessageProtocolBridgeIdle().catch(() => undefined)
    }
  })
})
