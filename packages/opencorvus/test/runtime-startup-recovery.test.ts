import { describe, expect, spyOn, test } from "bun:test"
import { listenForAcp } from "@/cli/cmd/acp"
import {
  listenWithRecoveredServerRuntime,
  prepareServerRuntimeForListener,
  requireRecoveredServerRuntime,
  settleRecoveringServerRuntime,
} from "@/cli/server-runtime"
import { currentRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { Server } from "@/server/server"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import * as IsolatedCheckWorkspace from "@/project/isolated-check-workspace"
import * as SchedulerMessage from "@/protocol/scheduler-message"
import { recoverStartedTaskProjects } from "@/engine/host-recovery"
import { restartReplacementEnvironment } from "@/server/restart-handoff"

describe("runtime startup recovery", () => {
  async function within<T>(promise: Promise<T>, label: string, milliseconds = 5_000): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error(`${label} made no progress for ${milliseconds}ms`)), milliseconds)
        }),
      ])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  test("projects application environment into a fresh restart process occurrence", () => {
    expect(
      restartReplacementEnvironment(
        {
          APPLICATION_VALUE: "current",
          OPENCORVUS_PROCESS_OCCURRENCE_ID: "old-occurrence",
          OPENCORVUS_PROCESS_OCCURRENCE_PATH: "old-envelope.json",
          OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH: "old-predecessor.json",
          OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH: "old-shutdown.json",
        },
        { APPLICATION_VALUE: "replacement", RESTART_VALUE: "fresh" },
      ),
    ).toEqual({ APPLICATION_VALUE: "replacement", RESTART_VALUE: "fresh" })
  })

  test("binds the ACP listener after preparing the current process occurrence", async () => {
    const server = await listenForAcp({ hostname: "127.0.0.1", port: 0, randomPort: true })
    try {
      expect({ url: server.url.toString(), occurrence: currentRuntimeProcessOccurrence() }).toEqual({
        url: expect.stringContaining(`:${server.port}`),
        occurrence: expect.objectContaining({ pid: process.pid, occurrenceID: expect.any(String) }),
      })
    } finally {
      await server.stop(true)
    }
  }, 60_000)

  test("serves health while the owned application recovery is still running", async () => {
    const order: string[] = []
    let releaseRecovery!: () => void
    const recoveryHeld = new Promise<void>((resolve) => (releaseRecovery = resolve))
    let reportRecoveryStarted!: () => void
    const recoveryStarted = new Promise<void>((resolve) => (reportRecoveryStarted = resolve))
    const originalListen = Server.listenPrepared
    const listen = spyOn(Server, "listenPrepared").mockImplementation((options) => {
      order.push("bind")
      return originalListen(options)
    })
    let sharedOccurrenceObserver: unknown
    const requests = spyOn(ProcessSupervisor, "recoverOrphanedWindowsRequests").mockImplementation(async (input) => {
      expect(input.currentOccurrenceID).toBe(currentRuntimeProcessOccurrence().occurrenceID)
      sharedOccurrenceObserver = input.observeProcessOccurrence
      order.push("orphan-requests-recovered")
      return {
        inspected: 0,
        removed: 0,
        retainedCurrent: 0,
        retainedLive: 0,
        retainedUnknown: 0,
        quarantined: 0,
        unreconciled: [],
      }
    })
    const workspaces = spyOn(
      IsolatedCheckWorkspace,
      "recoverOrphanedIsolatedCheckWorkspaces",
    ).mockImplementation(async (input) => {
      expect(input.currentOccurrenceID).toBe(currentRuntimeProcessOccurrence().occurrenceID)
      expect(input.observeProcessOccurrence).toBe(sharedOccurrenceObserver)
      order.push("orphan-workspaces-recovered")
      return {
        inspected: 0,
        removed: 0,
        retainedCurrent: 0,
        retainedLive: 0,
        retainedUnknown: 0,
        quarantined: 0,
        unreconciled: [],
      }
    })
    const scheduler = spyOn(SchedulerMessage.SchedulerMessageDeliveryService, "initGlobal").mockImplementation(() => {
      order.push("scheduler-poller-started")
    })
    const prepared = await listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        order.push("recovery-started")
        reportRecoveryStarted()
        await recoveryHeld
        order.push("recovery-completed")
      },
      disposeInstances: async () => {},
    })
    try {
      await within(recoveryStarted, "application recovery start")
      const response = await within(fetch(new URL("/global/health", prepared.server.url)), "health response")
      expect({ status: response.status, body: await response.json(), order: [...order] }).toEqual({
        status: 200,
        body: expect.objectContaining({ healthy: true }),
        order: [
          "orphan-requests-recovered",
          "orphan-workspaces-recovered",
          "bind",
          "scheduler-poller-started",
          "recovery-started",
        ],
      })
      releaseRecovery()
      await within(prepared.recovery, "application recovery completion")
      expect(order).toEqual([
        "orphan-requests-recovered",
        "orphan-workspaces-recovered",
        "bind",
        "scheduler-poller-started",
        "recovery-started",
        "recovery-completed",
      ])
    } finally {
      releaseRecovery()
      await prepared.server.stop(true)
      listen.mockRestore()
      requests.mockRestore()
      workspaces.mockRestore()
      scheduler.mockRestore()
    }
  }, 60_000)

  test("recovers a ready sibling project while another project remains held", async () => {
    const events: string[] = []
    let releaseHeldProject!: () => void
    const heldProject = new Promise<void>((resolve) => (releaseHeldProject = resolve))
    let reportReadyProject!: () => void
    const readyProject = new Promise<void>((resolve) => (reportReadyProject = resolve))

    const recovery = recoverStartedTaskProjects({
      directories: ["held-project", "ready-project"],
      initializeProject: async (directory) => {
        events.push(`${directory}:started`)
        if (directory === "held-project") await heldProject
        if (directory === "ready-project") reportReadyProject()
        events.push(`${directory}:completed`)
      },
    })
    await within(readyProject, "ready sibling project recovery")
    expect(events).toEqual(["held-project:started", "ready-project:started", "ready-project:completed"])

    releaseHeldProject()
    await expect(within(recovery, "multi-project recovery completion")).resolves.toEqual({
      attempted: 2,
      initialized: 2,
      missionAttempted: 0,
      missionWoken: 0,
      missionCompleted: 0,
      failures: [],
    })
  }, 60_000)

  test("settles failed foundational preparation and prepares the next attempt", async () => {
    const requests = spyOn(ProcessSupervisor, "recoverOrphanedWindowsRequests").mockRejectedValueOnce(
      new Error("injected foundational recovery failure"),
    )
    await expect(
      prepareServerRuntimeForListener({
        disposeInstances: async () => {},
      }),
    ).rejects.toThrow("injected foundational recovery failure")
    requests.mockRestore()

    const prepared = await prepareServerRuntimeForListener({ disposeInstances: async () => {} })
    expect(prepared.occurrence).toEqual(currentRuntimeProcessOccurrence())
    const terminated = await Server.settleCurrentProcessExecution("startup recovery test completion", {
      disposeInstances: async () => {},
    })
    await terminated.releaseHandoff(true)
  }, 60_000)

  test("keeps an application recovery failure observable after listener readiness", async () => {
    const prepared = await listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        throw new Error("injected application recovery failure")
      },
      disposeInstances: async () => {},
    })
    const recoveryFailure = expect(prepared.recovery).rejects.toThrow("injected application recovery failure")
    try {
      const response = await within(fetch(new URL("/global/health", prepared.server.url)), "health response")
      const health = (await response.json()) as { healthy: boolean }
      expect({ status: response.status, healthy: health.healthy }).toEqual({
        status: 200,
        healthy: true,
      })
      await recoveryFailure
    } finally {
      await prepared.server.stop(true)
    }
  }, 60_000)

  test("stops a published listener before propagating required recovery failure", async () => {
    const prepared = await listenWithRecoveredServerRuntime({
      options: { hostname: "127.0.0.1", port: 0, randomPort: true },
      recover: async () => {
        throw new Error("required application recovery failed")
      },
      disposeInstances: async () => {},
    })
    const listenerURL = new URL("/global/health", prepared.server.url)

    await expect(requireRecoveredServerRuntime(prepared)).rejects.toThrow("required application recovery failed")
    await expect(within(fetch(listenerURL), "stopped listener connection")).rejects.toThrow()
  }, 60_000)

  test("stops a published listener when post-bind poller initialization fails", async () => {
    const originalListen = Server.listenPrepared
    let listenerURL: URL | undefined
    const listen = spyOn(Server, "listenPrepared").mockImplementation((options) => {
      const server = originalListen(options)
      listenerURL = new URL("/global/health", server.url)
      return server
    })
    const scheduler = spyOn(SchedulerMessage.SchedulerMessageDeliveryService, "initGlobal").mockImplementationOnce(
      () => {
        throw new Error("scheduler poller initialization failed")
      },
    )
    try {
      await expect(
        listenWithRecoveredServerRuntime({
          options: { hostname: "127.0.0.1", port: 0, randomPort: true },
          recover: async () => {},
          disposeInstances: async () => {},
        }),
      ).rejects.toThrow("scheduler poller initialization failed")
      if (!listenerURL) throw new Error("listener was not bound before injected poller failure")
      await expect(within(fetch(listenerURL), "stopped listener connection")).rejects.toThrow()
    } finally {
      scheduler.mockRestore()
      listen.mockRestore()
    }
  }, 60_000)

  test("cancels held application recovery before joining it during settlement", async () => {
    const events: string[] = []
    const execution = RuntimeExecutionSettlement.reserve("session_wake_loop", "held-startup-application-recovery")
    const recovery = new Promise<void>((resolve) => {
      execution.signal.addEventListener(
        "abort",
        () => {
          events.push("recovery:cancelled")
          resolve()
        },
        { once: true },
      )
    })
    execution.settleWith(recovery)

    const terminated = await within(
      settleRecoveringServerRuntime({
        reason: "held startup recovery settlement contract",
        recovery,
        disposeInstances: async () => events.push("instances:disposed"),
      }),
      "held application recovery settlement",
    )
    await terminated.releaseHandoff(false)

    expect(events).toEqual(["recovery:cancelled", "instances:disposed"])
  }, 60_000)

  test("completes one graceful listener stop through a transient settlement cleanup failure", async () => {
    using _failure = Server.TestHooks.failNextRuntimeHandoffCommit(1)
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    const port = server.port
    await server.stop(true)
    expect(port).toBeGreaterThan(0)
  }, 60_000)

  test("continues the exact graceful-stop receipt after the commit decision", async () => {
    using _failure = Server.TestHooks.failNextRuntimeHandoffPostCommit(1)
    const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
    const port = server.port
    await server.stop(true)
    expect(port).toBeGreaterThan(0)
  }, 60_000)
})
