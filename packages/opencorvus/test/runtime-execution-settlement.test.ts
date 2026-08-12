import { describe, expect, test } from "bun:test"
import os from "node:os"
import path from "node:path"
import { mkdtemp, rm } from "node:fs/promises"
import {
  acquireCancelledTaskSettlementGate,
  CancelledTaskSettlementInactivityError,
  CancelledTaskSettlementTestHooks,
} from "@/engine/state"
import {
  RuntimeExecutionAdmissionClosedError,
  RuntimeExecutionSettlement,
  RuntimeExecutionSettlementInactivityError,
} from "@/runtime/execution-settlement"
import { RuntimeServerOwnership } from "@/server/runtime-server-ownership"
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
import { TaskQueueTable } from "@/scheduler/task-queue.sql"
import {
  TaskQueueProcessRollbackRecoveryError,
  TaskQueueService,
} from "@/scheduler/task-queue-service"
import { Database, eq } from "@/storage/db"
import { ProjectGitLock } from "@/worktree/git-lock"
import { withKeyedLock } from "@/util/lock"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

async function prepareTaskQueueProcessRollback(directory: string) {
  return await Instance.provide({
    directory,
    fn: async () => {
      const session = await Session.createNext({ directory, kind: "assistant", title: "queue rollback receipt" })
      const taskID = Identifier.ascending("task")
      const now = Date.now()
      Database.use((db) =>
        db
          .insert(TaskQueueTable)
          .values({
            id: taskID,
            session_id: session.id,
            prompt: "queue rollback receipt",
            priority: "normal",
            status: "queued",
            source: "queue-rollback-receipt-contract",
            metadata: { kind: "invalid-after-claim" },
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      expect(await TaskQueueService.TestHooks.claimReadyTaskIDs({ limit: 1 })).toEqual([taskID])
      let releasePhysical!: () => void
      const physicalSettlement = new Promise<void>((resolve) => (releasePhysical = resolve))
      const disposition = TaskQueueService.TestHooks.trackRecoverableExecution({ taskID, physicalSettlement })
      const queueGate = TaskQueueService.acquireProcessSettlementGate()
      const runtimeGate = RuntimeExecutionSettlement.acquireSettlementGate()
      runtimeGate.closeAdmission(["task_queue"])
      runtimeGate.requestCancellation(["task_queue"], new Error("rollback receipt handoff"))
      await TaskQueueService.TestHooks.waitForRecoveryCancellation(taskID)
      releasePhysical()
      await disposition
      await runtimeGate.waitForIdle(["task_queue"])
      expect(TaskQueueService.getStatusByID(taskID)?.status).toBe("queued")
      const rollback = queueGate.rollback()
      await Instance.dispose()
      queueGate[Symbol.dispose]()
      runtimeGate[Symbol.dispose]()
      return { taskID, rollback }
    },
  })
}

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

    controller.abort(new Error("shutdown cancelled queued owner"))
    await expect(queued).rejects.toThrow("shutdown cancelled queued owner")
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

  test("cancels an active protocol publication before waiting for shutdown settlement", async () => {
    const publication = RuntimeExecutionSettlement.reserve("protocol_publication", "shutdown-cancelled-publication")
    let cancelled: unknown
    publication.onCancel((reason) => {
      cancelled = reason
      publication.settle()
    })

    const settled = await Server.settleCurrentProcessExecution("protocol publication shutdown contract", {
      disposeInstances: async () => undefined,
    })
    await settled.releaseHandoff(false)

    expect(cancelled).toBeInstanceOf(Error)
    expect((cancelled as Error).message).toBe("protocol publication shutdown contract")
  })

  test("bounds cancelled settlement inactivity and converges after the physical operation exits", async () => {
    const events: string[] = []
    let releaseOperation!: () => void
    const operation = new Promise<void>((resolve) => {
      releaseOperation = () => {
        events.push("operation:released")
        resolve()
      }
    })
    using _operation = CancelledTaskSettlementTestHooks.trackSettlementOperation(
      "cancelled-settlement-held-operation",
      operation,
    )
    const firstGate = acquireCancelledTaskSettlementGate()
    try {
      await expect(firstGate.waitForIdle(50)).rejects.toBeInstanceOf(CancelledTaskSettlementInactivityError)
      events.push("gate:timed-out")
      const resume = firstGate.rollback()
      firstGate[Symbol.dispose]()
      await resume()

      releaseOperation()
      await operation
      const retryGate = acquireCancelledTaskSettlementGate()
      await retryGate.waitForIdle(50)
      retryGate.commit()
      retryGate[Symbol.dispose]()
      events.push("gate:retried")

      expect(events).toEqual(["gate:timed-out", "operation:released", "gate:retried"])
    } finally {
      releaseOperation()
      try {
        firstGate.rollback()
      } catch {}
      try {
        firstGate[Symbol.dispose]()
      } catch {}
    }
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

  test("retains runtime ownership across protocol inactivity and converges after late settlement", async () => {
    const ownership = RuntimeServerOwnership.acquire({ database: Database.Path() })
    const occurrenceID = ownership.owner.occurrenceID
    const publication = RuntimeExecutionSettlement.reserve("protocol_publication", "late-protocol-subscriber")
    const firstGate = RuntimeExecutionSettlement.acquireSettlementGate()
    firstGate.closeAdmission(["protocol_publication"])
    try {
      await expect(firstGate.waitForIdle(["protocol_publication"], 50)).rejects.toBeInstanceOf(
        RuntimeExecutionSettlementInactivityError,
      )
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(occurrenceID)
      firstGate[Symbol.dispose]()

      publication.settle()
      const retryGate = RuntimeExecutionSettlement.acquireSettlementGate()
      retryGate.closeAdmission(["protocol_publication"])
      await retryGate.waitForIdle(["protocol_publication"], 50)
      retryGate.commit()
      retryGate[Symbol.dispose]()

      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(occurrenceID)
    } finally {
      firstGate[Symbol.dispose]()
      publication.settle()
      await RuntimeServerOwnership.releaseWithRetry(ownership)
    }
  })

  test("cancels the physical owner and settles the gate after the owner exits", async () => {
    const events: string[] = []
    let releaseOwner!: () => void
    const ownerSettlement = new Promise<void>((resolve) => {
      releaseOwner = resolve
    })
    const reservation = RuntimeExecutionSettlement.reserve("task_queue", "timing-contract")
    reservation.onCancel((reason) => {
      events.push(`cancel:${reason instanceof Error ? reason.message : String(reason)}`)
    })
    reservation.settleWith(
      ownerSettlement.then(() => {
        events.push("owner:settled")
      }),
    )

    using gate = RuntimeExecutionSettlement.acquireSettlementGate()
    gate.closeAdmission(["task_queue"])
    gate.requestCancellation(["task_queue"], new Error("runtime handoff"))
    const gateSettlement = gate.waitForIdle(["task_queue"]).then(() => {
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
    using _reopen = RuntimeExecutionSettlement.onAdmissionReopened("task_queue", () => {
      events.push("admission:reopened")
      RuntimeExecutionSettlement.reserve("task_queue", "durable-rescan").settle()
      events.push("rescan:accepted")
    })
    const gate = RuntimeExecutionSettlement.acquireSettlementGate()
    gate.closeAdmission(["task_queue"])
    events.push("admission:closed")
    gate[Symbol.dispose]()

    expect(events).toEqual(["admission:closed", "admission:reopened", "rescan:accepted"])
  })

  test("restores every owned admission and reports an aggregate when one reopen listener fails", () => {
    const events: string[] = []
    using _failing = RuntimeExecutionSettlement.onAdmissionReopened("task_queue", () => {
      events.push("task-queue:reopened")
      throw new Error("injected Task Queue rescan failure")
    })
    using _succeeding = RuntimeExecutionSettlement.onAdmissionReopened("task_cancellation", () => {
      events.push("task-cancellation:reopened")
    })
    const gate = RuntimeExecutionSettlement.acquireSettlementGate()
    gate.closeAdmission(["task_queue", "task_cancellation"])
    let releaseError: unknown
    try {
      gate[Symbol.dispose]()
    } catch (error) {
      releaseError = error
    }
    RuntimeExecutionSettlement.reserve("task_queue", "post-failure-queue-admission").settle()
    RuntimeExecutionSettlement.reserve("task_cancellation", "post-failure-cancellation-admission").settle()
    events.push("post-failure:admitted")

    expect({ events, releaseError }).toMatchObject({
      events: ["task-queue:reopened", "task-cancellation:reopened", "post-failure:admitted"],
      releaseError: {
        name: "AggregateError",
        message: "Runtime execution admission reopen listeners failed",
        errors: [expect.objectContaining({ message: "injected Task Queue rescan failure" })],
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
    const aggregateID = Identifier.ascending("task")
    const input = {
      kind: "event" as const,
      type: "runtime.database-settlement",
      aggregate: "task" as const,
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
          operation: "Database.use",
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

  test("cancels a claimed queue execution before Prompt owner capture and settles its runtime gate", async () => {
    const { TaskQueueService } = await import("@/scheduler/task-queue-service")
    const events: string[] = []
    let enteredPromptStart!: () => void
    const promptStartEntered = new Promise<void>((resolve) => {
      enteredPromptStart = resolve
    })
    using _promptStart = TaskQueueService.TestHooks.installBeforeQueuePromptStart(async (signal) => {
      events.push("prompt-start:entered")
      enteredPromptStart()
      await new Promise<void>((resolve) => {
        const cancelled = () => {
          events.push("prompt-start:cancelled")
          resolve()
        }
        if (signal.aborted) cancelled()
        else signal.addEventListener("abort", cancelled, { once: true })
      })
    })
    const execution = TaskQueueService.TestHooks.runClaimedPromptStart({
      taskID: "task_claim_time_contract",
      sessionID: "ses_claim_time_contract",
      directory: "D:/claim-time-contract",
    }).catch((error) => {
      events.push(`execution:${error instanceof Error ? error.message : String(error)}`)
    })
    await promptStartEntered

    using gate = RuntimeExecutionSettlement.acquireSettlementGate()
    gate.closeAdmission(["task_queue"])
    gate.requestCancellation(["task_queue"], new Error("claim-time runtime handoff"))
    const settlement = gate.waitForIdle(["task_queue"]).then(() => {
      events.push("gate:settled")
    })
    await Promise.all([execution, settlement])

    expect(events).toEqual([
      "prompt-start:entered",
      "prompt-start:cancelled",
      "execution:claim-time runtime handoff",
      "gate:settled",
    ])
  }, 30_000)

  test("closes Task Queue admission before claim and reclaims the same durable row after reopen", async () => {
    const [{ Instance }, { TaskQueueService }, { Session }, { TaskQueueTable }, { Database }, { Identifier }] =
      await Promise.all([
        import("@/project/instance"),
        import("@/scheduler/task-queue-service"),
        import("@/session"),
        import("@/scheduler/task-queue.sql"),
        import("@/storage/db"),
        import("@/id/id"),
      ])
    const [{ mkdtemp, rm }, { tmpdir }, path, { execFileSync }] = await Promise.all([
      import("node:fs/promises"),
      import("node:os"),
      import("node:path"),
      import("node:child_process"),
    ])
    const directory = await mkdtemp(path.default.join(tmpdir(), "opencorvus-queue-preclaim-"))
    execFileSync("git", ["init"], { cwd: directory, stdio: "ignore" })
    try {
      const handoff = await Instance.provide({
        directory,
        fn: async () => {
          const session = await Session.createNext({ directory, kind: "assistant", title: "preclaim authority" })
          const taskID = Identifier.ascending("task")
          const now = Date.now()
          Database.use((db) =>
            db.insert(TaskQueueTable).values({
              id: taskID,
              session_id: session.id,
              prompt: "preclaim authority",
              priority: "normal",
              status: "queued",
              source: "preclaim-authority-contract",
              metadata: { kind: "session_prompt", input: {} },
              time_created: now,
              time_updated: now,
            }).run(),
          )
          const events: string[] = []
          let continueClaim!: () => void
          let enteredClaim!: () => void
          const claimEntered = new Promise<void>((resolve) => (enteredClaim = resolve))
          using _claim = TaskQueueService.TestHooks.installBeforeQueueClaimReservation(async () => {
            events.push("claim:validated")
            enteredClaim()
            await new Promise<void>((resolve) => (continueClaim = resolve))
          })
          const execution = TaskQueueService.runNow().catch((error) => {
            events.push(`claim:${error instanceof Error ? error.name : String(error)}`)
          })
          await claimEntered
          const gate = RuntimeExecutionSettlement.acquireSettlementGate()
          gate.closeAdmission(["task_queue"])
          gate.requestCancellation(["task_queue"], new Error("preclaim handoff"))
          events.push("admission:closed")
          continueClaim()
          await Promise.all([execution, gate.waitForIdle(["task_queue"])])
          gate[Symbol.dispose]()
          events.push("admission:reopened")
          const claimed = await TaskQueueService.TestHooks.claimReadyTaskIDs({ limit: 1 })
          events.push(`claim:accepted:${claimed[0]}`)
          let releasePhysical!: () => void
          const physicalSettlement = new Promise<void>((resolve) => (releasePhysical = resolve))
          const disposition = TaskQueueService.TestHooks.trackRecoverableExecution({ taskID, physicalSettlement })
          const handoffGate = RuntimeExecutionSettlement.acquireSettlementGate()
          handoffGate.closeAdmission(["task_queue"])
          handoffGate.requestCancellation(["task_queue"], new Error("graceful runtime handoff"))
          const cancellation = await TaskQueueService.TestHooks.waitForRecoveryCancellation(taskID)
          events.push(`handoff:cancel:${cancellation}`)
          releasePhysical()
          const handoffDisposition = await disposition
          events.push(`handoff:${handoffDisposition?.name}`)
          await handoffGate.waitForIdle(["task_queue"])
          events.push(`handoff:${TaskQueueService.getStatusByID(taskID)?.status}`)
          await Instance.dispose()
          handoffGate[Symbol.dispose]()

          return { events, taskID, handoffDisposition }
        },
      })
      const resumed = await Instance.provide({
        directory,
        fn: async () => {
          const claimed = await TaskQueueService.TestHooks.claimReadyTaskIDs({ limit: 1 })
          return { claimed, row: TaskQueueService.getStatusByID(handoff.taskID) }
        },
      })
      expect({ ...handoff, resumed }).toMatchObject({
            events: [
              "claim:validated",
              "admission:closed",
              "claim:RuntimeExecutionAdmissionClosedError",
              "admission:reopened",
              `claim:accepted:${handoff.taskID}`,
              "handoff:cancel:graceful runtime handoff",
              "handoff:RuntimeExecutionHandoffCancellation",
              "handoff:queued",
            ],
            handoffDisposition: {
              name: "RuntimeExecutionHandoffCancellation",
              taskID: handoff.taskID,
              queueOccurrenceID: handoff.taskID,
              reason: "graceful runtime handoff",
            },
            resumed: {
              claimed: [handoff.taskID],
              row: { taskID: handoff.taskID, status: "running" },
            },
          })
    } finally {
      await Instance.disposeAll()
      await rm(directory, { recursive: true, force: true })
    }
  }, 30_000)

  test("awaits the exact held Task Queue drain before rollback settlement completes", async () => {
    await using project = await memoryProject()
    let releaseClaim!: () => void
    let claimEntered!: () => void
    const entered = new Promise<void>((resolve) => (claimEntered = resolve))
    const claimHook = TaskQueueService.TestHooks.installBeforeQueueClaimReservation(async () => {
      claimEntered()
      await new Promise<void>((resolve) => (releaseClaim = resolve))
    })
    try {
      const receipt = await prepareTaskQueueProcessRollback(project.path)
      let settled = false
      const rollback = receipt.rollback().then(() => {
        settled = true
      })
      await entered
      await Bun.sleep(20)
      expect(settled).toBe(false)
      releaseClaim()
      await rollback
      expect({ settled, row: TaskQueueService.getStatusByID(receipt.taskID) }).toMatchObject({
        settled: true,
        row: { taskID: receipt.taskID, status: "failed" },
      })
    } finally {
      claimHook[Symbol.dispose]()
      await Instance.disposeAll()
      await resetMemoryDatabase()
    }
  }, 30_000)

  test("returns typed aggregate recovery failure and retries the same Task Queue rollback receipt", async () => {
    await using project = await memoryProject()
    let releaseClaim!: () => void
    const claimHook = TaskQueueService.TestHooks.installBeforeQueueClaimReservation(
      async () => await new Promise<void>((resolve) => (releaseClaim = resolve)),
    )
    const recoveryHook = TaskQueueService.TestHooks.installBeforeProcessRollbackRecovery(({ directory, taskIDs }) => {
      throw new Error(`injected rollback recovery failure for ${directory}:${taskIDs.join(",")}`)
    })
    try {
      const receipt = await prepareTaskQueueProcessRollback(project.path)
      let failure: unknown
      try {
        await receipt.rollback()
      } catch (error) {
        failure = error
      }
      expect(failure).toMatchObject({
        name: "AggregateError",
        message: "Failed to resume Task Queue projects after runtime rollback",
        errors: [
          {
            name: "TaskQueueProcessRollbackRecoveryError",
            directory: project.path,
            taskIDs: [receipt.taskID],
          },
        ],
      })
      expect((failure as AggregateError).errors[0]).toBeInstanceOf(TaskQueueProcessRollbackRecoveryError)
      expect(TaskQueueService.getStatusByID(receipt.taskID)?.status).toBe("queued")
      recoveryHook[Symbol.dispose]()
      const retry = receipt.rollback()
      releaseClaim()
      await retry
      expect(TaskQueueService.getStatusByID(receipt.taskID)).toMatchObject({
        taskID: receipt.taskID,
        status: "failed",
      })
    } finally {
      recoveryHook[Symbol.dispose]()
      claimHook[Symbol.dispose]()
      await Instance.disposeAll()
      await resetMemoryDatabase()
    }
  }, 30_000)

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
          gate.requestCancellation(["session_wake_loop"], new Error("runtime ownership handoff"))
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

  test("bounds a held Message bridge lifecycle and restores the retained owner after late settlement", async () => {
    const ownership = RuntimeServerOwnership.acquire({ database: Database.Path() })
    const occurrenceID = ownership.owner.occurrenceID
    let releaseBridge!: () => void
    const bridgeOperation = new Promise<void>((resolve) => (releaseBridge = resolve))
    const trackedBridge = TaskMessageProtocolBridgeTestHooks.trackLifecycle(bridgeOperation)
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    try {
      await expect(
        Server.settleCurrentProcessExecution("held Message bridge lifecycle", { disposeInstances: async () => {} }),
      ).rejects.toBeInstanceOf(Database.EffectSettlementInactivityError)
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(occurrenceID)

      releaseBridge()
      await trackedBridge
      await awaitTaskMessageProtocolBridgeIdle()
      RuntimeExecutionSettlement.reserve("task_queue", "late-bridge-rollback-admission").settle()

      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(occurrenceID)
    } finally {
      releaseBridge()
      await trackedBridge.catch(() => undefined)
      await awaitTaskMessageProtocolBridgeIdle().catch(() => undefined)
      await RuntimeServerOwnership.releaseWithRetry(ownership)
    }
  })
})
