import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { bootstrap } from "@/cli/bootstrap"
import { listenForAcp } from "@/cli/cmd/acp"
import { acquireServerRuntimeAfterRecovery, listenWithRecoveredServerRuntime } from "@/cli/server-runtime"
import {
  awaitTaskMessageProtocolBridgeIdle,
  TaskMessageProtocolBridgeTestHooks,
} from "@/orchestrator/protocol/message-bridge"
import { Scheduler } from "@/scheduler"
import { AutomationService } from "@/scheduler/automation-service"
import {
  RuntimeServerOwnership,
  RuntimeServerOwnershipConflictError,
} from "@/server/runtime-server-ownership"
import { Server } from "@/server/server"
import { Database } from "@/storage/db"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import * as IsolatedCheckWorkspace from "@/project/isolated-check-workspace"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("runtime startup recovery authority", () => {
  test("binds the ACP listener with the same recovered runtime ownership", async () => {
    const server = await listenForAcp({ hostname: "127.0.0.1", port: 0, randomPort: true })
    try {
      expect({
        url: server.url.toString(),
        ownership: RuntimeServerOwnership.currentOccurrenceID(Database.Path()),
      }).toEqual({
        url: expect.stringContaining(`:${server.port}`),
        ownership: expect.any(String),
      })
    } finally {
      await server.stop(true)
    }
  }, 60_000)

  test("completes started-Task recovery before binding a public listener", async () => {
    const order: string[] = []
    let releaseRecovery!: () => void
    const recoveryHeld = new Promise<void>((resolve) => (releaseRecovery = resolve))
    const originalListen = Server.listenWithOwnedRuntime
    let sharedOccurrenceObserver: unknown
    const listen = spyOn(Server, "listenWithOwnedRuntime").mockImplementation((options, ownership) => {
      order.push(`bind:${ownership.owner.occurrenceID}`)
      return originalListen(options, ownership)
    })
    const requests = spyOn(ProcessSupervisor, "recoverOrphanedWindowsRequests").mockImplementation(async (input) => {
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(input.currentOccurrenceID)
      expect(input.observeProcessOccurrence).toBeFunction()
      sharedOccurrenceObserver = input.observeProcessOccurrence
      order.push("orphan-requests-recovered")
      return { inspected: 0, removed: 0, retainedCurrent: 0, retainedLive: 0, retainedUnknown: 0 }
    })
    const workspaces = spyOn(
      IsolatedCheckWorkspace,
      "recoverOrphanedIsolatedCheckWorkspaces",
    ).mockImplementation(async (input) => {
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(input.currentOccurrenceID)
      expect(input.observeProcessOccurrence).toBe(sharedOccurrenceObserver)
      order.push("orphan-workspaces-recovered")
      return { inspected: 0, removed: 0, retainedCurrent: 0, retainedLive: 0, retainedUnknown: 0 }
    })
    const starting = listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        order.push("recovery-started")
        await recoveryHeld
        order.push("recovery-completed")
      },
      disposeInstances: async () => {},
    })
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 25))
      releaseRecovery()
      const prepared = await starting
      try {
        expect(order).toEqual([
          "orphan-requests-recovered",
          "orphan-workspaces-recovered",
          "recovery-started",
          "recovery-completed",
          `bind:${prepared.ownership.owner.occurrenceID}`,
        ])
      } finally {
        await prepared.server.stop(true)
      }
    } finally {
      releaseRecovery()
      listen.mockRestore()
      requests.mockRestore()
      workspaces.mockRestore()
    }
  }, 60_000)

  test("retries the exact failed rollback receipt before same-owner settlement continues", async () => {
    const ownership = RuntimeServerOwnership.acquire({ database: Database.Path() })
    const occurrenceID = ownership.owner.occurrenceID
    let releaseBridge!: () => void
    const bridgeOperation = new Promise<void>((resolve) => (releaseBridge = resolve))
    const trackedBridge = TaskMessageProtocolBridgeTestHooks.trackLifecycle(bridgeOperation)
    let attempts = 0
    using rollbackHook = Server.TestHooks.installRuntimeRollbackReceipt(async () => {
      attempts += 1
      if (attempts === 1) throw new Error("injected rollback receipt failure")
    })
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    try {
      await expect(
        Server.settleCurrentProcessExecution("failed rollback recovery receipt", { disposeInstances: async () => {} }),
      ).rejects.toMatchObject({ name: "AggregateError" })
      expect({ attempts, occurrenceID: RuntimeServerOwnership.currentOccurrenceID(Database.Path()) }).toEqual({
        attempts: 1,
        occurrenceID,
      })

      releaseBridge()
      await trackedBridge
      await awaitTaskMessageProtocolBridgeIdle()
      const retry = await Server.settleCurrentProcessExecution("retry failed rollback receipt", {
        disposeInstances: async () => {},
      })
      expect({ attempts, occurrenceID: RuntimeServerOwnership.currentOccurrenceID(Database.Path()) }).toEqual({
        attempts: 2,
        occurrenceID,
      })
      rollbackHook[Symbol.dispose]()
      await retry.releaseHandoff(false)
    } finally {
      releaseBridge()
      await trackedBridge.catch(() => undefined)
      await awaitTaskMessageProtocolBridgeIdle().catch(() => undefined)
      await RuntimeServerOwnership.releaseWithRetry(ownership)
    }
  }, 60_000)

  test("bounds rollback recovery receipts and joins the exact late receipt before same-owner retry", async () => {
    const ownership = RuntimeServerOwnership.acquire({ database: Database.Path() })
    const occurrenceID = ownership.owner.occurrenceID
    let releaseBridge!: () => void
    const bridgeOperation = new Promise<void>((resolve) => (releaseBridge = resolve))
    const trackedBridge = TaskMessageProtocolBridgeTestHooks.trackLifecycle(bridgeOperation)
    let releaseRollback!: () => void
    const rollbackReceipt = new Promise<void>((resolve) => (releaseRollback = resolve))
    using _rollback = Server.TestHooks.installRuntimeRollbackReceipt(() => rollbackReceipt)
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    try {
      await expect(
        Server.settleCurrentProcessExecution("held rollback recovery receipt", { disposeInstances: async () => {} }),
      ).rejects.toMatchObject({
        name: "AggregateError",
        errors: [
          expect.any(Database.EffectSettlementInactivityError),
          expect.any(Server.RuntimeRollbackRecoveryInactivityError),
        ],
      })
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(occurrenceID)

      releaseBridge()
      releaseRollback()
      await Promise.all([trackedBridge, rollbackReceipt])
      await awaitTaskMessageProtocolBridgeIdle()
      const retry = await Server.settleCurrentProcessExecution("late rollback receipt retry", {
        disposeInstances: async () => {},
      })
      await retry.releaseHandoff(false)
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toBe(occurrenceID)
    } finally {
      releaseBridge()
      releaseRollback()
      await Promise.all([trackedBridge.catch(() => undefined), rollbackReceipt])
      await awaitTaskMessageProtocolBridgeIdle().catch(() => undefined)
      await RuntimeServerOwnership.releaseWithRetry(ownership)
    }
  }, 60_000)

  test("retains keyed CLI ownership after settlement inactivity and reuses it after late bridge completion", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-cli-settlement-recovery-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let releaseBridge!: () => void
    const bridgeOperation = new Promise<void>((resolve) => (releaseBridge = resolve))
    const trackedBridge = TaskMessageProtocolBridgeTestHooks.trackLifecycle(bridgeOperation)
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    const otherDatabase = path.join(root, "other.db")
    try {
      await expect(bootstrap(project, async () => {
        await Scheduler.disposeGlobal()
        return "blocked settlement"
      })).rejects.toBeInstanceOf(
        Database.EffectSettlementInactivityError,
      )
      let conflict: unknown
      try {
        RuntimeServerOwnership.acquire({ database: otherDatabase })
      } catch (error) {
        conflict = error
      }
      expect(conflict).toMatchObject({ name: "RuntimeServerOwnershipConflictError" })
      releaseBridge()
      await trackedBridge
      await awaitTaskMessageProtocolBridgeIdle()
      const recoveredCLI = await bootstrap(project, async () => {
        await Scheduler.disposeGlobal()
        return "recovered CLI"
      })
      expect(recoveredCLI).toBe("recovered CLI")
      const successor = RuntimeServerOwnership.acquire({ database: otherDatabase })
      expect(successor.owner.database).toBe(path.resolve(otherDatabase))
      successor.release()
    } finally {
      releaseBridge()
      await trackedBridge.catch(() => undefined)
      await awaitTaskMessageProtocolBridgeIdle().catch(() => undefined)
      const retained = RuntimeServerOwnership.recoverRetained(Database.Path())
      if (retained) {
        await Scheduler.disposeGlobal()
        const terminated = await Server.settleCurrentProcessExecution("CLI settlement test cleanup", {
          disposeInstances: async () => {},
        })
        await RuntimeServerOwnership.releaseWithRetry(retained, () => terminated.releaseHandoff(true))
      }
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("preserves the CLI operation error beside settlement failure and releases ownership after exact retry", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-cli-dual-failure-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    const project = path.join(root, "project")
    await import("node:fs/promises").then((fs) => Promise.all([fs.mkdir(home), fs.mkdir(project)]))
    execFileSync("git", ["init"], { cwd: project, stdio: "ignore" })
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let releaseBridge!: () => void
    const bridgeOperation = new Promise<void>((resolve) => (releaseBridge = resolve))
    const trackedBridge = TaskMessageProtocolBridgeTestHooks.trackLifecycle(bridgeOperation)
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    const operationError = new Error("injected CLI operation failure")
    try {
      await expect(
        bootstrap(project, async () => {
          await Scheduler.disposeGlobal()
          throw operationError
        }),
      ).rejects.toMatchObject({
        name: "AggregateError",
        errors: [operationError, expect.any(Database.EffectSettlementInactivityError)],
      })
      expect(RuntimeServerOwnership.currentOccurrenceID(Database.Path())).toEqual(expect.any(String))

      releaseBridge()
      await trackedBridge
      await awaitTaskMessageProtocolBridgeIdle()
      await expect(
        bootstrap(project, async () => {
          await Scheduler.disposeGlobal()
          throw operationError
        }),
      ).rejects.toBe(operationError)
      const successor = RuntimeServerOwnership.acquire({ database: path.join(root, "successor.db") })
      successor.release()
    } finally {
      releaseBridge()
      await trackedBridge.catch(() => undefined)
      await awaitTaskMessageProtocolBridgeIdle().catch(() => undefined)
      const retained = RuntimeServerOwnership.recoverRetained(Database.Path())
      if (retained) {
        await Scheduler.disposeGlobal()
        const terminated = await Server.settleCurrentProcessExecution("CLI dual-failure test cleanup", {
          disposeInstances: async () => {},
        })
        await RuntimeServerOwnership.releaseWithRetry(retained, () => terminated.releaseHandoff(true))
      }
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("retains exact serve startup cleanup when recovery and settlement both fail", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-serve-recovery-cleanup-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let releaseBridge!: () => void
    const bridgeOperation = new Promise<void>((resolve) => (releaseBridge = resolve))
    const trackedBridge = TaskMessageProtocolBridgeTestHooks.trackLifecycle(bridgeOperation)
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    const otherDatabase = path.join(root, "other.db")
    try {
      await expect(
        acquireServerRuntimeAfterRecovery({
          recover: async () => {
            await Scheduler.disposeGlobal()
            throw new Error("injected started Task recovery failure")
          },
          disposeInstances: async () => {},
        }),
      ).rejects.toMatchObject({
        name: "AggregateError",
        errors: [
          expect.objectContaining({ message: "injected started Task recovery failure" }),
          expect.any(Database.EffectSettlementInactivityError),
        ],
      })
      let pendingCleanup: unknown
      try {
        RuntimeServerOwnership.acquire({ database: otherDatabase })
      } catch (error) {
        pendingCleanup = error
      }
      expect(pendingCleanup).toMatchObject({ name: "RuntimeServerStartupCleanupPendingError" })
      releaseBridge()
      await trackedBridge
      await awaitTaskMessageProtocolBridgeIdle()
      const recovered = await acquireServerRuntimeAfterRecovery({ recover: async () => {}, disposeInstances: async () => {} })
      const terminated = await Server.settleCurrentProcessExecution("recovered serve startup test completion", {
        disposeInstances: async () => {},
      })
      await RuntimeServerOwnership.releaseWithRetry(recovered.ownership, () => terminated.releaseHandoff(true))
      const successor = RuntimeServerOwnership.acquire({ database: otherDatabase })
      expect(successor.owner.database).toBe(path.resolve(otherDatabase))
      successor.release()
    } finally {
      releaseBridge()
      await trackedBridge.catch(() => undefined)
      await awaitTaskMessageProtocolBridgeIdle().catch(() => undefined)
      try {
        await RuntimeServerOwnership.TestHooks.completeRetainedStartupCleanup()
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "No retained runtime startup cleanup authority") throw error
      }
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)

  test("settles partial Automation startup registration through the retained cleanup authority", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-serve-automation-init-cleanup-"))
    temporaryDirectories.push(root)
    const home = path.join(root, "home")
    await import("node:fs/promises").then((fs) => fs.mkdir(home))
    const previousHome = process.env.OPENCORVUS_TEST_HOME
    process.env.OPENCORVUS_TEST_HOME = home
    let releaseActive!: () => void
    let activeStarted!: () => void
    const started = new Promise<void>((resolve) => (activeStarted = resolve))
    Scheduler.register({
      id: `startup-partial-active-${Date.now()}`,
      interval: 60_000,
      runAtStart: true,
      scope: "global",
      run: async () => {
        activeStarted()
        await new Promise<void>((resolve) => (releaseActive = resolve))
      },
    })
    await started
    const initialization = spyOn(AutomationService, "initGlobal").mockImplementation(() => {
      Scheduler.register({
        id: `startup-partial-registration-${Date.now()}`,
        interval: 60_000,
        runAtStart: false,
        scope: "global",
        run: async () => {},
      })
      throw new Error("injected Automation initialization failure")
    })
    using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
    try {
      await expect(
        acquireServerRuntimeAfterRecovery({ recover: async () => {}, disposeInstances: async () => {} }),
      ).rejects.toMatchObject({ name: "AggregateError" })
      releaseActive()
      await RuntimeServerOwnership.TestHooks.completeRetainedStartupCleanup()
      initialization.mockRestore()
      const successor = RuntimeServerOwnership.acquire({ database: path.join(root, "successor.db") })
      expect(successor.owner.occurrenceID).toEqual(expect.any(String))
      successor.release()
    } finally {
      releaseActive()
      initialization.mockRestore()
      if (previousHome === undefined) delete process.env.OPENCORVUS_TEST_HOME
      else process.env.OPENCORVUS_TEST_HOME = previousHome
    }
  }, 60_000)
})
