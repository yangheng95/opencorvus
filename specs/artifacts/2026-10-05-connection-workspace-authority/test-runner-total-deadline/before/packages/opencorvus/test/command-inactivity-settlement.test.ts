import { expect, test } from "bun:test"
import { PassThrough } from "node:stream"
import { runHostCommandWithInactivity } from "../src/shell/command-inactivity"
import { ProcessSupervisor } from "../src/shell/process-supervisor"

test("waits for supervisor settlement and returns output delivered after physical exit", async () => {
  const stdout = new PassThrough()
  let settle!: () => void
  const settled = new Promise<void>((resolve) => (settle = resolve))
  const restore = ProcessSupervisor.setCommandFactoryForTest(async () => ({
    pid: 991001,
    stdin: null,
    stdout,
    stderr: null,
    exited: Promise.resolve(0),
    outputSettled: settled,
    settled,
    async terminate() {},
    async dispose() {},
    unref() {},
  }))
  try {
    setTimeout(() => {
      stdout.end("tail-after-exit")
      settle()
    }, 20)
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: [],
      cwd: process.cwd(),
      inactivityTimeoutMs: 1_000,
    })
    expect(result).toMatchObject({ exitCode: 0, stdout: "tail-after-exit", failure: undefined })
  } finally {
    restore()
  }
})

test("returns a typed exit failure when supervisor settlement fails", async () => {
  const restore = ProcessSupervisor.setCommandFactoryForTest(async () => ({
    pid: 991002,
    stdin: null,
    stdout: null,
    stderr: null,
    exited: Promise.resolve(0),
    outputSettled: Promise.resolve(),
    settled: Promise.reject(new Error("settlement proof unavailable")),
    async terminate() {},
    async dispose() {},
    unref() {},
  }))
  try {
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: [],
      cwd: process.cwd(),
      inactivityTimeoutMs: 1_000,
    })
    expect(result.failure).toEqual({
      kind: "exit",
      message: "Process supervisor settlement failed: settlement proof unavailable",
    })
  } finally {
    restore()
  }
})
