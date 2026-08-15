import { describe, expect, spyOn, test } from "bun:test"
import { listenForAcp } from "@/cli/cmd/acp"
import { listenWithRecoveredServerRuntime, prepareServerRuntimeAfterRecovery } from "@/cli/server-runtime"
import { currentRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { Server } from "@/server/server"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import * as IsolatedCheckWorkspace from "@/project/isolated-check-workspace"
import { restartReplacementEnvironment } from "@/server/restart-handoff"

describe("runtime startup recovery", () => {
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

  test("completes process and Task recovery before binding a public listener", async () => {
    const order: string[] = []
    let releaseRecovery!: () => void
    const recoveryHeld = new Promise<void>((resolve) => (releaseRecovery = resolve))
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
      return { inspected: 0, removed: 0, retainedCurrent: 0, retainedLive: 0, retainedUnknown: 0 }
    })
    const workspaces = spyOn(
      IsolatedCheckWorkspace,
      "recoverOrphanedIsolatedCheckWorkspaces",
    ).mockImplementation(async (input) => {
      expect(input.currentOccurrenceID).toBe(currentRuntimeProcessOccurrence().occurrenceID)
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
      await Bun.sleep(25)
      releaseRecovery()
      const prepared = await starting
      try {
        expect(order).toEqual([
          "orphan-requests-recovered",
          "orphan-workspaces-recovered",
          "recovery-started",
          "recovery-completed",
          "bind",
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

  test("settles a failed pre-listener recovery and prepares the next attempt", async () => {
    await expect(
      prepareServerRuntimeAfterRecovery({
        recover: async () => {
          throw new Error("injected started Task recovery failure")
        },
        disposeInstances: async () => {},
      }),
    ).rejects.toThrow("injected started Task recovery failure")

    const prepared = await prepareServerRuntimeAfterRecovery({ recover: async () => {}, disposeInstances: async () => {} })
    expect(prepared.occurrence).toEqual(currentRuntimeProcessOccurrence())
    const terminated = await Server.settleCurrentProcessExecution("startup recovery test completion", {
      disposeInstances: async () => {},
    })
    await terminated.releaseHandoff(true)
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
