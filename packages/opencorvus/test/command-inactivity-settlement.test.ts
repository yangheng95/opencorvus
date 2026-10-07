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
    stderr: (() => {
      const stream = new PassThrough()
      stream.end()
      return stream
    })(),
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
    expect(result).toMatchObject({ exitCode: 0, stdout: "tail-after-exit", settlementConfirmed: true })
  } finally {
    restore()
  }
})

test("returns a typed exit failure when supervisor settlement fails", async () => {
  const emptyOutput = () => {
    const stream = new PassThrough()
    stream.end()
    return stream
  }
  const restore = ProcessSupervisor.setCommandFactoryForTest(async () => ({
    pid: 991002,
    stdin: null,
    stdout: emptyOutput(),
    stderr: emptyOutput(),
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
    expect(result).toMatchObject({ settlementConfirmed: false, failure: { kind: "exit" } })
    expect(result.failure?.message).toContain("settlement proof unavailable")
  } finally {
    restore()
  }
})

test("deadline closes a real output-active native child tree while its parallel peer succeeds", async () => {
  const [deadline, peer] = await Promise.all([
    runHostCommandWithInactivity({
      executable: process.execPath,
      args: [
        "-e",
        `const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); process.stdout.write('child:'+child.pid+'\\n'); setInterval(()=>process.stdout.write('tick\\n'),30)`,
      ],
      cwd: process.cwd(),
      inactivityTimeoutMs: 300,
      deadlineAt: Date.now() + 1500,
    }),
    runHostCommandWithInactivity({
      executable: process.execPath,
      args: ["-e", "setTimeout(()=>process.stdout.write('parallel-result'),100)"],
      cwd: process.cwd(),
      inactivityTimeoutMs: 1000,
      deadlineAt: Date.now() + 3000,
    }),
  ])
  expect(deadline).toMatchObject({ settlementConfirmed: true, failure: { kind: "deadline" } })
  expect(deadline.stdout).toMatch(/child:[1-9][0-9]*\n(?:tick\n)+/)
  expect(peer).toMatchObject({ settlementConfirmed: true, exitCode: 0, stdout: "parallel-result" })
}, 15_000)

test("a failed byte observer returns actual retained bytes after native settlement", async () => {
  const result = await runHostCommandWithInactivity({
    executable: process.execPath,
    args: ["-e", "process.stdout.write('observer-bytes'); setInterval(()=>{},1000)"],
    cwd: process.cwd(),
    inactivityTimeoutMs: 1000,
    deadlineAt: Date.now() + 3000,
    onStdout() {
      throw new Error("controlled observer failure")
    },
  })
  expect(result).toMatchObject({ settlementConfirmed: true, stdout: "observer-bytes", failure: { kind: "output" } })
  expect([...result.stdoutBytes]).toEqual([...new TextEncoder().encode("observer-bytes")])
}, 15_000)

test("a failed byte source keeps its output stage, original error and actual bytes", async () => {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  stderr.end()
  const failure = new Error("controlled byte source failure")
  const restore = ProcessSupervisor.setCommandFactoryForTest(async () => ({
    pid: 991003,
    stdin: null,
    stdout,
    stderr,
    exited: Promise.resolve(0),
    outputSettled: Promise.resolve(),
    settled: Promise.resolve(),
    async terminate() {},
    async dispose() {},
    unref() {},
  }))
  try {
    setTimeout(() => {
      stdout.write("observed-prefix")
      setTimeout(() => stdout.destroy(failure), 10)
    }, 10)
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: [],
      cwd: process.cwd(),
      inactivityTimeoutMs: 1000,
      deadlineAt: Date.now() + 3000,
    })
    expect(result).toMatchObject({
      stdout: "observed-prefix",
      settlementConfirmed: false,
      failure: { kind: "output", message: "controlled byte source failure" },
    })
    expect([...result.stdoutBytes]).toEqual([...new TextEncoder().encode("observed-prefix")])
  } finally {
    restore()
  }
})
