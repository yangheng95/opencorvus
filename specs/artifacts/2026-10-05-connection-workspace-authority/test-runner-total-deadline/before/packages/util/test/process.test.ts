import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { Readable } from "node:stream"
import {
  createProcessFacade,
  ProcessAbortedError,
  ProcessDeadlineExceededError,
  ProcessOutputLimitError,
  type ProcessByteSource,
  type ProcessSpawnedHandle,
} from "../src/process"
import { NodeProcess, nodeProcessByteSource } from "../src/process-node"

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

async function waitForFile(file: string, timeoutMs = 2_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(file)) return readFileSync(file, "utf8")
    await Bun.sleep(10)
  }
  throw new Error(`Process fixture did not publish ${file}`)
}

async function waitForExit(pid: number, timeoutMs = 4_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!processIsAlive(pid)) return true
    await Bun.sleep(20)
  }
  return !processIsAlive(pid)
}

describe("structured process facade", () => {
  test("settles a failed spawn before admitting the next occurrence", async () => {
    await expect(
      NodeProcess.spawn({
        command: { executable: `missing-opencorvus-process-${crypto.randomUUID()}`, args: [] },
        occurrenceID: "process-contract-spawn-failure",
      }),
    ).rejects.toThrow()

    const result = await NodeProcess.run({
      command: { executable: process.execPath, args: ["-e", "process.stdout.write('next-occurrence')"] },
      occurrenceID: "process-contract-after-spawn-failure",
    })
    expect(new TextDecoder().decode(result.stdout)).toBe("next-occurrence")
  })

  test("preserves argv and publishes one terminal receipt after streamed output closes", async () => {
    const occurrenceID = "process-contract-normal"
    const result = await NodeProcess.run({
      command: {
        executable: process.execPath,
        args: ["-e", "process.stdout.write(process.argv[1]); process.stderr.write('observed')", "value with spaces"],
      },
      occurrenceID,
    })

    expect(new TextDecoder().decode(result.stdout)).toBe("value with spaces")
    expect(new TextDecoder().decode(result.stderr)).toBe("observed")
    expect(result.receipt).toMatchObject({
      occurrenceID,
      reason: "exited",
      exitCode: 0,
      signal: null,
    })
    expect(result.receipt.pid).toBeGreaterThan(0)
  })

  test("deadline terminalizes the owned process under the same occurrence", async () => {
    await expect(
      NodeProcess.run({
        command: { executable: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"] },
        occurrenceID: "process-contract-deadline",
        timeoutMs: 500,
      }),
    ).rejects.toBeInstanceOf(ProcessDeadlineExceededError)
  })

  test("settles late combined output limits independently for concurrent process occurrences", async () => {
    const lateDrain = createProcessFacade(async (request) => {
      const handle = await NodeProcess.spawn({ ...request, signal: request.controlSignal })
      const afterExit = (source: ProcessByteSource | null): ProcessByteSource => ({
        async *[Symbol.asyncIterator]() {
          if (!source) throw new Error("Expected a real child output stream")
          for await (const chunk of source) {
            await handle.terminal
            yield chunk
          }
        },
      })
      return { ...handle, stdout: afterExit(handle.stdout), stderr: afterExit(handle.stderr) }
    })
    const outcomes = await Promise.allSettled(
      [512, 513, 4096].map((bytes, index) =>
        lateDrain.run({
          command: {
            executable: process.execPath,
            args: [
              "-e",
              `process.stdout.write('x'.repeat(${bytes})); process.stderr.write('y'.repeat(512)); setTimeout(() => {}, 50)`,
            ],
          },
          occurrenceID: `late-output-${index}`,
          maxOutputBytes: 1024,
          nothrow: true,
          timeoutMs: 5000,
        }),
      ),
    )
    expect(outcomes[0]?.status).toBe("fulfilled")
    if (outcomes[0]?.status !== "fulfilled") throw new Error("Expected exact-budget success")
    expect(outcomes[0].value.receipt).toMatchObject({ occurrenceID: "late-output-0", reason: "exited" })
    expect(outcomes[0].value.stdout.byteLength + outcomes[0].value.stderr.byteLength).toBe(1024)
    for (const [index, outcome] of outcomes.entries()) {
      if (index === 0) continue
      expect(outcome.status).toBe("rejected")
      if (outcome.status !== "rejected") throw new Error("Expected output limit rejection")
      expect(outcome.reason).toBeInstanceOf(ProcessOutputLimitError)
      const result = (outcome.reason as ProcessOutputLimitError).result
      expect(result.receipt).toMatchObject({
        occurrenceID: `late-output-${index}`,
        reason: "output_limit",
        exitCode: 0,
      })
      expect(result.stdout.byteLength + result.stderr.byteLength).toBe(1024)
    }
    const next = await NodeProcess.run({
      command: { executable: process.execPath, args: ["-e", "process.stdout.write('next')"] },
      occurrenceID: "after-late-output",
      maxOutputBytes: 4,
    })
    expect({ reason: next.receipt.reason, output: new TextDecoder().decode(next.stdout) }).toEqual({
      reason: "exited",
      output: "next",
    })
    const deadline = await lateDrain
      .run({
        command: {
          executable: process.execPath,
          args: ["-e", "process.stdout.write('x'.repeat(4096)); setInterval(() => {}, 1000)"],
        },
        occurrenceID: "late-output-after-deadline",
        maxOutputBytes: 1024,
        timeoutMs: 1000,
      })
      .catch((error: unknown) => error)
    expect(deadline).toBeInstanceOf(ProcessDeadlineExceededError)
    const deadlineResult = (deadline as ProcessDeadlineExceededError).result!
    expect(deadlineResult.receipt).toMatchObject({
      occurrenceID: "late-output-after-deadline",
      reason: "deadline_exceeded",
    })
    expect(deadlineResult.stdout.byteLength).toBe(1024)
  })

  test("a Windows admission deadline settles its identity probe before the next owned occurrence", async () => {
    if (process.platform !== "win32") return
    await expect(
      NodeProcess.spawn({
        command: { executable: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"] },
        occurrenceID: "process-contract-identity-probe-deadline",
        ownership: "owned_tree",
        deadlineAt: Date.now() + 5,
      }),
    ).rejects.toBeInstanceOf(ProcessDeadlineExceededError)

    const next = await NodeProcess.run({
      command: { executable: process.execPath, args: ["-e", "process.stdout.write('next-owned-occurrence')"] },
      occurrenceID: "process-contract-after-identity-probe-deadline",
      ownership: "owned_tree",
      timeoutMs: 5_000,
    })
    expect(new TextDecoder().decode(next.stdout)).toBe("next-owned-occurrence")
  })

  test("Windows controlled admissions settle concurrent physical occurrences before fresh work", async () => {
    if (process.platform !== "win32") return
    const outcomes = await Promise.allSettled(
      [5, 25, 50, 100, 150, 200].map((timeoutMs) =>
        NodeProcess.run({
          command: { executable: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"] },
          occurrenceID: `windows-admission-${timeoutMs}`,
          ownership: "owned_tree",
          timeoutMs,
        }),
      ),
    )
    for (const outcome of outcomes) {
      expect(outcome.status).toBe("rejected")
      if (outcome.status !== "rejected") throw new Error("Expected controlled process settlement")
      expect(outcome.reason).toBeInstanceOf(ProcessDeadlineExceededError)
    }
    const aborted = await Promise.allSettled(
      [5, 50, 150].map((delayMs) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), delayMs)
        return NodeProcess.run({
          command: { executable: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"] },
          occurrenceID: `windows-admission-abort-${delayMs}`,
          ownership: "owned_tree",
          signal: controller.signal,
        }).finally(() => clearTimeout(timer))
      }),
    )
    for (const outcome of aborted) {
      expect(outcome.status).toBe("rejected")
      if (outcome.status !== "rejected") throw new Error("Expected aborted process settlement")
      expect(outcome.reason).toBeInstanceOf(ProcessAbortedError)
    }
    const next = await NodeProcess.run({
      command: { executable: process.execPath, args: ["-e", "process.stdout.write('admitted-after-settlement')"] },
      occurrenceID: "windows-after-concurrent-admissions",
      ownership: "owned_tree",
      timeoutMs: 5000,
    })
    expect({ receipt: next.receipt, output: new TextDecoder().decode(next.stdout) }).toMatchObject({
      receipt: { occurrenceID: "windows-after-concurrent-admissions", reason: "exited", exitCode: 0 },
      output: "admitted-after-settlement",
    })
  })

  test("normal child exit settles while its input producer remains pending", async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => (release = resolve))
    const input = (async function* () {
      yield new TextEncoder().encode("first")
      await pending
    })()
    const result = await NodeProcess.run({
      command: { executable: process.execPath, args: ["-e", "process.exit(0)"] },
      occurrenceID: "process-contract-child-first",
      input,
      timeoutMs: 1_000,
    })
    release()
    expect(result.receipt).toMatchObject({ occurrenceID: "process-contract-child-first", exitCode: 0 })
  })

  test("an aborted request settles through the typed abort contract", async () => {
    const controller = new AbortController()
    const running = NodeProcess.run({
      command: { executable: process.execPath, args: ["-e", "setInterval(() => {}, 1000)"] },
      occurrenceID: "process-contract-abort",
      signal: controller.signal,
    })
    controller.abort()

    await expect(running).rejects.toBeInstanceOf(ProcessAbortedError)
  })

  test("deadline covers delayed spawn admission and disposes a late handle", async () => {
    let release!: (handle: ProcessSpawnedHandle) => void
    let disposed = false
    const lateHandle = new Promise<ProcessSpawnedHandle>((resolve) => (release = resolve))
    const facade = createProcessFacade(() => lateHandle)
    const spawning = facade.spawn({
      command: { executable: "delayed", args: [] },
      occurrenceID: "process-contract-delayed-admission",
      deadlineAt: Date.now() + 25,
    })
    const receipt = {
      occurrenceID: "process-contract-delayed-admission",
      pid: 7,
      reason: "exited" as const,
      exitCode: 0,
      signal: null,
    }
    setTimeout(
      () =>
        release({
          occurrenceID: receipt.occurrenceID,
          pid: receipt.pid,
          stdin: null,
          stdout: null,
          stderr: null,
          terminal: Promise.resolve(receipt),
          outputSettled: Promise.resolve(),
          settled: Promise.resolve(receipt),
          terminate: async () => receipt,
          dispose: async () => {
            disposed = true
            return receipt
          },
          unref() {},
        }),
      50,
    )
    await expect(spawning).rejects.toBeInstanceOf(ProcessDeadlineExceededError)
    expect(disposed).toBe(true)
  })

  test("admission cleanup preserves the typed control failure before a disposal failure", async () => {
    let release!: (handle: ProcessSpawnedHandle) => void
    const cleanupFailure = new Error("late handle cleanup failed")
    const lateHandle = new Promise<ProcessSpawnedHandle>((resolve) => (release = resolve))
    const facade = createProcessFacade(() => lateHandle)
    const spawning = facade.spawn({
      command: { executable: "delayed-cleanup-failure", args: [] },
      occurrenceID: "process-contract-delayed-cleanup-failure",
      deadlineAt: Date.now() + 25,
    })
    const receipt = {
      occurrenceID: "process-contract-delayed-cleanup-failure",
      pid: 9,
      reason: "exited" as const,
      exitCode: 0,
      signal: null,
    }
    setTimeout(
      () =>
        release({
          occurrenceID: receipt.occurrenceID,
          pid: receipt.pid,
          stdin: null,
          stdout: null,
          stderr: null,
          terminal: Promise.resolve(receipt),
          outputSettled: Promise.resolve(),
          settled: Promise.resolve(receipt),
          terminate: async () => receipt,
          dispose: async () => {
            throw cleanupFailure
          },
          unref() {},
        }),
      50,
    )

    try {
      await spawning
      throw new Error("expected admission cleanup failure")
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors[0]).toBeInstanceOf(ProcessDeadlineExceededError)
      expect((error as AggregateError).errors[1]).toBe(cleanupFailure)
    }
  })

  test("occurrence validation settles its process and preserves cleanup failure ordering", async () => {
    const cleanupFailure = new Error("mismatched occurrence cleanup failed")
    const receipt = {
      occurrenceID: "adapter-occurrence",
      pid: 10,
      reason: "exited" as const,
      exitCode: 0,
      signal: null,
    }
    const facade = createProcessFacade(async () => ({
      occurrenceID: receipt.occurrenceID,
      pid: receipt.pid,
      stdin: null,
      stdout: null,
      stderr: null,
      terminal: Promise.resolve(receipt),
      outputSettled: Promise.resolve(),
      settled: Promise.resolve(receipt),
      terminate: async () => receipt,
      dispose: async () => {
        throw cleanupFailure
      },
      unref() {},
    }))

    try {
      await facade.spawn({
        command: { executable: "mismatched-occurrence", args: [] },
        occurrenceID: "requested-occurrence",
      })
      throw new Error("expected occurrence validation failure")
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors[0]).toEqual(
        new Error("Process spawner returned a different occurrence identity"),
      )
      expect((error as AggregateError).errors[1]).toBe(cleanupFailure)
    }
  })

  test("publishes facade settlement only after the adapter's durable settlement", async () => {
    let durableState = "pending"
    const receipt = {
      occurrenceID: "process-contract-durable-settlement",
      pid: 11,
      reason: "exited" as const,
      exitCode: 0,
      signal: null,
    }
    let releaseDurableSettlement!: (value: typeof receipt) => void
    const durableSettlement = new Promise<typeof receipt>((resolve) => (releaseDurableSettlement = resolve))
    const facade = createProcessFacade(async () => ({
      occurrenceID: receipt.occurrenceID,
      pid: receipt.pid,
      stdin: null,
      stdout: null,
      stderr: null,
      terminal: Promise.resolve(receipt),
      outputSettled: Promise.resolve(),
      settled: durableSettlement,
      terminate: async () => receipt,
      dispose: async () => receipt,
      unref() {},
    }))
    const handle = await facade.spawn({
      command: { executable: "durable-settlement", args: [] },
      occurrenceID: receipt.occurrenceID,
    })
    setTimeout(() => {
      durableState = "settled"
      releaseDurableSettlement(receipt)
    }, 40)

    expect(await handle.settled).toEqual(receipt)
    expect(durableState).toBe("settled")
  })

  test("release observes an absolute deadline crossed while the event loop was blocked", async () => {
    const receipt = {
      occurrenceID: "process-contract-release-deadline",
      pid: 12,
      reason: "exited" as const,
      exitCode: 0,
      signal: null,
    }
    const delayedTerminal = new Promise<typeof receipt>((resolve) => setTimeout(() => resolve(receipt), 20))
    const facade = createProcessFacade(async () => ({
      occurrenceID: receipt.occurrenceID,
      pid: receipt.pid,
      stdin: null,
      stdout: null,
      stderr: null,
      terminal: delayedTerminal,
      outputSettled: Promise.resolve(),
      settled: delayedTerminal,
      terminate: async () => receipt,
      dispose: async () => receipt,
      unref() {},
    }))
    const handle = await facade.spawn({
      command: { executable: "blocked-release-deadline", args: [] },
      occurrenceID: receipt.occurrenceID,
      deadlineAt: Date.now() + 10,
    })
    Atomics.wait(new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)), 0, 0, 35)

    expect(handle.releaseControls()).toBe("deadline_exceeded")
    expect(await handle.settled).toMatchObject({ reason: "deadline_exceeded", occurrenceID: receipt.occurrenceID })
  })

  test("flattens and de-duplicates adapter settlement failures in occurrence order", async () => {
    const terminalFailure = new Error("terminal failed")
    const outputFailure = new Error("output failed")
    const cleanupFailure = new Error("request cleanup failed")
    const facade = createProcessFacade(async (request) => ({
      occurrenceID: request.occurrenceID,
      pid: 13,
      stdin: null,
      stdout: null,
      stderr: null,
      terminal: Promise.reject(terminalFailure),
      outputSettled: Promise.reject(outputFailure),
      settled: Promise.reject(
        new AggregateError([terminalFailure, outputFailure, cleanupFailure], "adapter settlement failed"),
      ),
      terminate: async () => {
        throw terminalFailure
      },
      dispose: async () => {
        throw terminalFailure
      },
      unref() {},
    }))
    const handle = await facade.spawn({
      command: { executable: "aggregate-settlement", args: [] },
      occurrenceID: "process-contract-aggregate-settlement",
    })

    try {
      await handle.settled
      throw new Error("expected aggregate settlement failure")
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors).toEqual([terminalFailure, outputFailure, cleanupFailure])
    }
  })

  test("disposes an admitted process when its adapter omits required output streams", async () => {
    let disposed = false
    const receipt = {
      occurrenceID: "process-contract-invalid-adapter",
      pid: 8,
      reason: "exited" as const,
      exitCode: 0,
      signal: null,
    }
    const facade = createProcessFacade(async () => ({
      occurrenceID: receipt.occurrenceID,
      pid: receipt.pid,
      stdin: null,
      stdout: null,
      stderr: null,
      terminal: Promise.resolve(receipt),
      outputSettled: Promise.resolve(),
      settled: Promise.resolve(receipt),
      terminate: async () => receipt,
      dispose: async () => {
        disposed = true
        return receipt
      },
      unref() {},
    }))

    await expect(
      facade.run({
        command: { executable: "invalid-adapter", args: [] },
        occurrenceID: receipt.occurrenceID,
      }),
    ).rejects.toThrow("Process output is unavailable")
    expect(disposed).toBe(true)
  })

  test("an asynchronous byte-source failure settles the physical occurrence before returning", async () => {
    const outputFailure = new Error("byte source failed")
    let releaseTerminal!: (receipt: {
      occurrenceID: string
      pid: number
      reason: "terminated"
      exitCode: number
      signal: null
    }) => void
    let cleanupState = "pending"
    const receipt = {
      occurrenceID: "process-contract-output-observer-failure",
      pid: 14,
      reason: "terminated" as const,
      exitCode: 1,
      signal: null,
    }
    const terminal = new Promise<typeof receipt>((resolve) => (releaseTerminal = resolve))
    const emptySource = {
      async *[Symbol.asyncIterator]() {},
    }
    const facade = createProcessFacade(async () => ({
      occurrenceID: receipt.occurrenceID,
      pid: receipt.pid,
      stdin: null,
      stdout: {
        async *[Symbol.asyncIterator]() {
          await Bun.sleep(10)
          throw outputFailure
        },
      },
      stderr: emptySource,
      terminal,
      outputSettled: Promise.resolve(),
      settled: terminal,
      terminate: async () => {
        cleanupState = "settled"
        releaseTerminal(receipt)
        return receipt
      },
      dispose: async () => {
        cleanupState = "settled"
        releaseTerminal(receipt)
        return receipt
      },
      unref() {},
    }))

    const error = await facade
      .run({
        command: { executable: "output-observer-failure", args: [] },
        occurrenceID: receipt.occurrenceID,
      })
      .catch((cause) => cause)
    expect({ error, cleanupState }).toEqual({ error: outputFailure, cleanupState: "settled" })
  })

  test("retains stream backpressure until the byte source is consumed", async () => {
    const chunk = Buffer.alloc(512, 1)
    let emitted = 0
    const stream = new Readable({
      highWaterMark: 1_024,
      read() {
        while (emitted < 32) {
          emitted += 1
          if (!this.push(chunk)) return
        }
        this.push(null)
      },
    })
    const source = nodeProcessByteSource(stream)!
    await Bun.sleep(25)
    expect(stream.readableLength).toBeLessThanOrEqual(stream.readableHighWaterMark)
    let received = 0
    for await (const value of source) received += value.byteLength
    expect(received).toBe(32 * chunk.byteLength)
  })

  test("settles an owned tree after the root exits first and disposal reclaims its descendant", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "opencorvus-process-root-first-"))
    const childPidFile = path.join(root, "child.pid")
    const script = path.join(root, "root.cjs")
    writeFileSync(
      script,
      [
        'const { spawn } = require("node:child_process")',
        'const fs = require("node:fs")',
        'const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" })',
        "child.unref()",
        `fs.writeFileSync(${JSON.stringify(childPidFile)}, String(child.pid))`,
        "process.exit(0)",
      ].join("\n"),
    )
    let childPID: number | undefined
    try {
      const handle = await NodeProcess.spawn({
        command: { executable: process.execPath, args: [script] },
        occurrenceID: "process-contract-root-first-tree",
        ownership: "owned_tree",
      })
      childPID = Number(await waitForFile(childPidFile))
      const receipt = await handle.dispose()
      expect(receipt).toMatchObject({
        occurrenceID: "process-contract-root-first-tree",
        pid: handle.pid,
        reason: "terminated",
      })
      expect(await waitForExit(childPID)).toBe(true)
    } finally {
      if (childPID && processIsAlive(childPID)) process.kill(childPID, "SIGKILL")
      rmSync(root, { recursive: true, force: true })
    }
  })
})
