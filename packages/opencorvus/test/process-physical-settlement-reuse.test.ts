import { expect, test } from "bun:test"
import { ProcessSupervisor } from "../src/shell/process-supervisor"

test("concurrent terminal consumers retain one native exit and complete output", async () => {
  const handle = await ProcessSupervisor.spawnHostCommand({
    executable: process.execPath,
    args: [
      "-e",
      "process.stdout.write('original-native-output');process.stderr.write('original-native-diagnostic');process.exit(7)",
    ],
    owner: "physical-settlement-multiple-consumers",
  })
  const stdout = new Response(handle.stdout).text()
  const stderr = new Response(handle.stderr).text()
  try {
    expect(await handle.exited).toBe(7)
    const consumers = await Promise.all([handle.settled, handle.dispose(), handle.dispose()])
    expect(consumers).toEqual([undefined, undefined, undefined])
    expect(await handle.terminalFact).toEqual({ exitCode: 7, signal: null })
    expect(await stdout).toBe("original-native-output")
    expect(await stderr).toBe("original-native-diagnostic")
    await handle.outputSettled
    expect(await handle.exited).toBe(7)
  } finally {
    await ProcessSupervisor.disposeAndWaitForExit(handle, "physical settlement multiple consumers")
  }
}, 20_000)
