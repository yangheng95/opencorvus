import { expect, test } from "bun:test"
import { ProcessSupervisor } from "@/shell/process-supervisor"

test("a real native process settles inside the existing cleanup deadline after a legal slow disposal phase", async () => {
  const observations: string[] = []
  const actual = await ProcessSupervisor.spawnHostCommand({
    executable: process.execPath,
    args: ["-e", "await Bun.sleep(30000)"],
    owner: "slow-native-disposal-contract",
  })
  const handle: ProcessSupervisor.Handle = {
    ...actual,
    async dispose() {
      observations.push("dispose-started")
      await Bun.sleep(1200)
      await actual.dispose()
      observations.push("dispose-completed")
    },
  }
  try {
    const code = await ProcessSupervisor.disposeAndWaitForExit(handle, "real legal disposal")
    await Promise.all([actual.exited, actual.outputSettled, actual.settled])
    const terminal = await actual.terminalFact
    expect(code).toBe(terminal.exitCode ?? 1)
    expect({ code, observations, terminal }).toMatchObject({
      code: expect.any(Number),
      observations: ["dispose-started", "dispose-completed"],
      terminal: process.platform === "win32"
        ? { exitCode: expect.any(Number), signal: null }
        : { exitCode: null, signal: "SIGTERM" },
    })
    console.info(
      "native-disposal-proof",
      JSON.stringify({ pid: actual.pid, code, observations, physical: true, output: true, settled: true }),
    )
  } finally {
    await actual.dispose()
    await actual.settled
  }
}, 30000)

function phaseHandle(input: {
  exit: Promise<number>
  output: Promise<void>
  cleanup: Promise<void>
  settlement?: Promise<void>
}): ProcessSupervisor.Handle {
  const terminalFact = input.exit.then((exitCode) => ({ exitCode, signal: null }))
  void terminalFact.catch(() => undefined)
  return {
    pid: 12345,
    stdin: null,
    stdout: null,
    stderr: null,
    exited: input.exit,
    terminalFact,
    outputSettled: input.output,
    settled: input.settlement ?? Promise.all([input.exit, input.output, input.cleanup]).then(() => undefined),
    async dispose() {
      await input.cleanup
    },
    async terminate() {},
    unref() {},
  }
}

for (const phase of ["physical", "output", "request-cleanup"] as const) {
  test(`the original ${phase} settlement completes under one absolute disposal boundary`, async () => {
    const completed: string[] = []
    const slow = Bun.sleep(40).then(() => {
      completed.push(phase)
    })
    const handle = phaseHandle({
      exit: phase === "physical" ? slow.then(() => 7) : Promise.resolve(7),
      output: phase === "output" ? slow : Promise.resolve(),
      cleanup: phase === "request-cleanup" ? slow : Promise.resolve(),
    })
    expect({
      code: await ProcessSupervisor.disposeAndWaitForExit(handle, phase, { deadlineAt: Date.now() + 2000 }),
      completed,
    }).toEqual({ code: 7, completed: [phase] })
  })
}

test("disposal preserves each original physical, output and cleanup failure", async () => {
  const physical = Error("exact physical failure"),
    output = Error("exact output failure"),
    cleanup = Error("exact cleanup failure")
  const handle = phaseHandle({
    exit: Promise.reject(physical),
    output: Promise.reject(output),
    cleanup: Promise.reject(cleanup),
  })
  let failure: any
  try {
    await ProcessSupervisor.disposeAndWaitForExit(handle, "failed original facts")
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(AggregateError)
  expect(failure.errors).toEqual(expect.arrayContaining([physical, output, cleanup]))
})

test("an expired absolute deadline yields the precise incomplete output settlement error", async () => {
  const handle = phaseHandle({
    exit: Promise.resolve(0),
    output: new Promise(() => {}),
    cleanup: Promise.resolve(),
    settlement: Promise.resolve(),
  })
  await expect(
    ProcessSupervisor.disposeAndWaitForExit(handle, "exact deadline", { deadlineAt: Date.now() - 1 }),
  ).rejects.toThrow("exact deadline output did not settle within")
})
