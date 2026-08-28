import { describe, expect, test } from "bun:test"
import { supervisedHostProcessFacade } from "../src/util/process-facade"
import { ProcessSupervisor } from "../src/shell/process-supervisor"

describe("Plugin structured process capability", () => {
  test("runs structured argv through the central supervisor and settles its owner", async () => {
    const owner = "plugin:test-process-capability"
    const processFacade = supervisedHostProcessFacade(owner)
    const result = await processFacade.run({
      command: {
        executable: process.execPath,
        args: ["-e", "process.stdin.pipe(process.stdout)", "argument with spaces"],
      },
      occurrenceID: "plugin-process-capability-normal",
      input: "streamed input",
    })

    expect(new TextDecoder().decode(result.stdout)).toBe("streamed input")
    expect(result.receipt).toMatchObject({
      occurrenceID: "plugin-process-capability-normal",
      reason: "exited",
      exitCode: 0,
    })
    expect(ProcessSupervisor.metricsSnapshot().owners[owner]).toBeUndefined()
  })

  test("projects the supervisor's exact signal terminal fact", async () => {
    const restore = ProcessSupervisor.setCommandFactoryForTest(async () => ({
      pid: 42_001,
      stdin: null,
      stdout: null,
      stderr: null,
      exited: Promise.resolve(1),
      terminalFact: Promise.resolve({ exitCode: null, signal: "SIGTERM" }),
      outputSettled: Promise.resolve(),
      settled: Promise.resolve(),
      async terminate() {},
      async dispose() {},
      unref() {},
    }))
    try {
      const handle = await supervisedHostProcessFacade("plugin:test-signal-fact").spawn({
        command: { executable: "signal-fact", args: [] },
        occurrenceID: "plugin-process-capability-signal",
        stdout: "ignore",
        stderr: "ignore",
      })

      expect(await handle.settled).toMatchObject({
        occurrenceID: "plugin-process-capability-signal",
        reason: "exited",
        exitCode: null,
        signal: "SIGTERM",
      })
    } finally {
      restore()
    }
  })
})
