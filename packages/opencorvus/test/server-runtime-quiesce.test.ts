import { describe, expect, test } from "bun:test"
import * as Lifecycle from "../src/server/stop"

describe("runtime cancellation and listener quiescence", () => {
  test("joins the actual listener and runtime after cancellation, returning the canonical handoff", async () => {
    const phases: string[] = []
    const finishRuntime = Promise.withResolvers<void>()
    const canonical = { sessions: 2, toolParts: 2, releaseHandoff(commit = true) { phases.push(`release:${commit}`) } }
    const result = await Lifecycle.settleRuntimeAndQuiesceListener({
      async settle(ready) {
        phases.push("settlement:start")
        ready()
        phases.push("cancellation:requested")
        await finishRuntime.promise
        phases.push("settlement:joined")
        return canonical
      },
      async quiesce() {
        phases.push("listener:drained")
        finishRuntime.resolve()
      },
    })
    expect(result).toBe(canonical)
    await result.releaseHandoff()
    expect(phases).toEqual(["settlement:start", "cancellation:requested", "listener:drained", "settlement:joined", "release:true"])
  })

  test("joins runtime after listener failure and rolls back the exact returned handoff", async () => {
    const phases: string[] = []
    const listenerFailed = Promise.withResolvers<void>()
    const finishRuntime = Promise.withResolvers<void>()
    const failure = new Error("listener failed")
    const operation = Lifecycle.settleRuntimeAndQuiesceListener({
      async settle(ready) {
        ready()
        await finishRuntime.promise
        phases.push("runtime:joined")
        return { releaseHandoff(commit = true) { phases.push(`release:${commit}`) } }
      },
      async quiesce() { phases.push("listener:failed"); listenerFailed.resolve(); throw failure },
    }).catch((error) => error)
    await listenerFailed.promise
    finishRuntime.resolve()
    expect(await operation).toBe(failure)
    expect(phases).toEqual(["listener:failed", "runtime:joined", "release:false"])
  })

  test("joins the listener when runtime settlement rejects after cancellation", async () => {
    const phases: string[] = []
    const entered = Promise.withResolvers<void>()
    const runtime = Promise.withResolvers<never>()
    const listener = Promise.withResolvers<void>()
    const failure = new Error("runtime failed")
    const operation = Lifecycle.settleRuntimeAndQuiesceListener({
      settle(ready) { ready(); return runtime.promise },
      async quiesce() { entered.resolve(); await listener.promise; phases.push("listener:joined") },
    }).catch((error) => error)
    await entered.promise
    runtime.reject(failure)
    listener.resolve()
    expect(await operation).toBe(failure)
    expect(phases).toEqual(["listener:joined"])
  })

  test("returns both listener and runtime failures after both owners settle", async () => {
    const listenerFailure = new Error("listener failed")
    const runtimeFailure = new Error("runtime failed")
    const runtime = Promise.withResolvers<never>()
    const result = await Lifecycle.settleRuntimeAndQuiesceListener({
      settle(ready) { ready(); return runtime.promise },
      async quiesce() { runtime.reject(runtimeFailure); throw listenerFailure },
    }).catch((error) => error)
    expect(result).toBeInstanceOf(AggregateError)
    expect(result.errors).toEqual([listenerFailure, runtimeFailure])
  })

  test("retains a rollback failure with the original listener failure", async () => {
    const failure = new Error("listener failed")
    const rollbackFailure = new Error("rollback failed")
    const commits: boolean[] = []
    const result = await Lifecycle.settleRuntimeAndQuiesceListener({
      async settle(ready) { ready(); return { async releaseHandoff(commit = true) { commits.push(commit); throw rollbackFailure } } },
      async quiesce() { throw failure },
    }).catch((error) => error)
    expect(result).toBeInstanceOf(AggregateError)
    expect(result.errors).toEqual([failure, rollbackFailure])
    expect(commits).toEqual([false])
  })

  test("returns the exact settlement failure before cancellation readiness", async () => {
    const failure = new Error("runtime admission failed")
    const result = await Lifecycle.settleRuntimeAndQuiesceListener({
      async settle() { throw failure },
      async quiesce() { return },
    }).catch((error) => error)
    expect(result).toBe(failure)
  })

  test("preserves the original timeout failure after joining the pending stop owner", async () => {
    const phases: string[] = []
    const timedOut = Promise.withResolvers<void>()
    const stop = Promise.withResolvers<void>()
    const result = Lifecycle.stopServerWithTimeout({
      async stop() { await stop.promise; phases.push("stop:joined") },
      timeoutMilliseconds: 10,
      onTimeout() { phases.push("timeout:detected"); timedOut.resolve() },
      onStopError(error) { throw error },
    }).catch((error) => { phases.push("caller:failed"); return error })
    await timedOut.promise
    stop.resolve()
    expect((await result).message).toBe("Server stop timed out after 10ms")
    expect(phases).toEqual(["timeout:detected", "stop:joined", "caller:failed"])
  })

  test("retains a late stop rejection alongside the original timeout", async () => {
    const timedOut = Promise.withResolvers<void>()
    const stop = Promise.withResolvers<void>()
    const failure = new Error("stop rejected after timeout")
    const errors: unknown[] = []
    const result = Lifecycle.stopServerWithTimeout({
      stop: () => stop.promise,
      timeoutMilliseconds: 10,
      onTimeout() { timedOut.resolve() },
      onStopError(error) { errors.push(error) },
    }).catch((error) => error)
    await timedOut.promise
    stop.reject(failure)
    const outcome = await result
    expect(outcome).toBeInstanceOf(AggregateError)
    expect(outcome.errors.map((error: Error) => error.message)).toEqual(["Server stop timed out after 10ms", failure.message])
    expect(errors).toEqual([failure])
  })

  test("returns the timeout callback error together with the original timeout after the stop joins", async () => {
    const stop = Promise.withResolvers<void>()
    const callbackFailure = new Error("timeout diagnostic failed")
    const phases: string[] = []
    const result = await Lifecycle.stopServerWithTimeout({
      async stop() { await stop.promise; phases.push("stop:joined") },
      timeoutMilliseconds: 10,
      onTimeout() { queueMicrotask(() => stop.resolve()); throw callbackFailure },
      onStopError(error) { throw error },
    }).catch((error) => error)
    expect(result).toBeInstanceOf(AggregateError)
    expect(result.errors.map((error: Error) => error.message)).toEqual(["Server stop timed out after 10ms", callbackFailure.message])
    expect(phases).toEqual(["stop:joined"])
  })
})
