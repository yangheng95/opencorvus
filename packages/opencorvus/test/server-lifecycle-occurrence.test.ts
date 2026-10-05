import { afterEach, describe, expect, test } from "bun:test"
import {
  ServerLifecycleTestHooks,
  admitServerRestart,
  admitServerShutdown,
  serverLifecycleOccurrence,
} from "../src/server/lifecycle-occurrence"
import { clearServerRestartHandler, registerServerRestartHandler } from "../src/server/restart"
import { clearServerShutdownHandler, registerServerShutdownHandler } from "../src/server/shutdown"

async function waitFor(predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("condition did not settle in time")
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

afterEach(() => {
  clearServerShutdownHandler()
  clearServerRestartHandler()
  ServerLifecycleTestHooks.reset()
})

describe("server lifecycle occurrence", () => {
  test("an admitted shutdown carries a stable identity and executes the registered handler", async () => {
    const requests: string[] = []
    registerServerShutdownHandler((request) => {
      requests.push(request.reason)
    })

    const admission = admitServerShutdown({ source: "http-client", reason: "http.shutdown" })
    if (!admission.admitted) throw new Error("shutdown was not admitted")
    expect(admission.occurrence).toMatchObject({ kind: "shutdown", state: "executing" })

    await waitFor(() => requests.length === 1)
    expect(requests).toEqual(["http.shutdown"])
    expect(serverLifecycleOccurrence(admission.occurrence.id)).toMatchObject({ state: "executing" })
  })

  test("admission without a registered handler returns unavailable", async () => {
    expect(admitServerShutdown({ source: "http-client", reason: "http.shutdown" })).toEqual({
      admitted: false,
      reason: "unavailable",
    })
    expect(await admitServerRestart("server.restart")).toEqual({ admitted: false, reason: "unavailable" })
  })

  test("a handler that fails after admission settles the occurrence as failed with the exact error", async () => {
    registerServerRestartHandler({ availability: async () => ({ available: true }), execute: async () => {
      throw new Error("replacement child exited before handoff")
    } })
    const admission = await admitServerRestart("server.restart")
    if (!admission.admitted) throw new Error("restart was not admitted")

    await waitFor(() => serverLifecycleOccurrence(admission.occurrence.id)?.state === "failed")
    expect(serverLifecycleOccurrence(admission.occurrence.id)).toMatchObject({
      kind: "restart",
      state: "failed",
      error: "replacement child exited before handoff",
    })
  })

  test("a handler cleared between admission and execution fails the occurrence instead of silently no-opping", async () => {
    registerServerShutdownHandler(() => {})
    const admission = admitServerShutdown({ source: "http-client", reason: "http.shutdown" })
    if (!admission.admitted) throw new Error("shutdown was not admitted")
    clearServerShutdownHandler()

    await waitFor(() => serverLifecycleOccurrence(admission.occurrence.id)?.state === "failed")
    expect(serverLifecycleOccurrence(admission.occurrence.id)).toMatchObject({
      state: "failed",
      error: "Server shutdown handler was cleared after admission",
    })
  })

  test("a repeated request converges on the live occurrence and a conflicting transition is refused with it", async () => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    registerServerShutdownHandler(() => held)
    registerServerRestartHandler({ availability: async () => ({ available: true }), execute: async () => {} })

    const first = admitServerShutdown({ source: "http-client", reason: "http.shutdown" })
    if (!first.admitted) throw new Error("shutdown was not admitted")
    const repeat = admitServerShutdown({ source: "http-client", reason: "http.shutdown" })
    if (!repeat.admitted) throw new Error("repeated shutdown was not admitted")
    expect(repeat.occurrence.id).toBe(first.occurrence.id)

    const conflicting = await admitServerRestart("server.restart")
    expect(conflicting).toEqual({
      admitted: false,
      reason: "conflicting_lifecycle",
      live: first.occurrence,
    })
    release()
  })

  test("restart captures its accepted handler while a concurrent shutdown owns availability", async () => {
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    registerServerRestartHandler({ availability: async () => { await held; return { available: true } }, execute: async () => {} })
    const pending = admitServerRestart("server.restart")
    registerServerShutdownHandler(async () => {})
    const shutdown = admitServerShutdown({ source: "http-client", reason: "test" })
    if (!shutdown.admitted) throw new Error("shutdown not admitted")
    release()
    expect(await pending).toEqual({ admitted: false, reason: "conflicting_lifecycle", live: shutdown.occurrence })
  })

  test("restart availability exposes the exact managed ownership refusal", async () => {
    registerServerRestartHandler({ availability: async () => ({ available: false, reason: "managed_parent", message: "Use launcher" }), execute: async () => {} })
    expect(await admitServerRestart("server.restart")).toEqual({ admitted: false, reason: "unavailable",
      detail: { reason: "managed_parent", message: "Use launcher" } })
  })

  test("accepted restart executes its captured owner after registry release", async () => {
    const events: string[] = []
    registerServerRestartHandler({ availability: async () => ({ available: true }), execute: async reason => { events.push(reason) } })
    const admission = await admitServerRestart("captured-owner")
    if (!admission.admitted) throw new Error("restart not admitted")
    clearServerRestartHandler()
    await waitFor(() => events.length === 1)
    expect(events).toEqual(["captured-owner"])
    expect(serverLifecycleOccurrence(admission.occurrence.id)?.state).toBe("executing")
  })
})
