import { expect, test } from "bun:test"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { Process } from "@/util/process"

for (const kind of ["pid", "birth"] as const) {
  test(`native ${kind} owner refusal returns its original admission error and settles before the next command`, async () => {
    if (process.platform !== "win32") return
    const expected =
      kind === "pid"
        ? `Windows supervisor owner PID 0 does not match helper parent ${process.pid}`
        : "does not match requested win32:0"
    const restore = ProcessSupervisor.setWindowsRequestObserverForTest((value) => {
      const request = value as Record<string, unknown>
      if (kind === "pid") {
        request.owner_pid = 0
      } else {
        request.owner_process_instance_id = "win32:0"
      }
    })
    let failure: unknown
    try {
      failure = await ProcessSupervisor.spawnHostCommand({
        executable: process.execPath,
        args: ["-e", "process.exit(0)"],
        owner: `native-${kind}-admission-contract`,
      }).catch((error: unknown) => error)
    } finally {
      restore()
    }
    expect(failure).toMatchObject({ name: "Error", message: expect.stringContaining(expected) })
    const accepted = await Process.runHost([process.execPath, "-e", 'process.stdout.write("owner admitted")'], {
      inactivityTimeoutMs: 10_000,
    })
    expect({ code: accepted.code, output: accepted.stdout.toString() }).toEqual({ code: 0, output: "owner admitted" })
  })
}
