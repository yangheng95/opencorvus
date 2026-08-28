import { describe, expect, test } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { ParentWatchdog } from "../src/server/parent-watchdog"
import { ManagedServerLifecycle } from "../src/server/managed-server-lifecycle"
import { ProcessInstanceIDTestHooks, type RuntimeProcessOccurrenceInfo } from "../src/runtime/process-occurrence"

const PARENT: RuntimeProcessOccurrenceInfo = {
  pid: 4242,
  processInstanceID: "test:host-start-instant",
  occurrenceID: "occurrence-under-test",
}

function watch(
  observations: Array<"exact_live" | "dead_or_reused" | "unknown_live">,
  parent: RuntimeProcessOccurrenceInfo = PARENT,
) {
  const reasons: string[] = []
  const seen: Array<{ pid: number; processInstanceID: string }> = []
  let index = 0
  const handle = ParentWatchdog.start({
    parent,
    intervalMs: 1,
    onOrphan: (reason) => reasons.push(reason),
    observe: (owner) => {
      seen.push({ pid: owner.pid, processInstanceID: owner.processInstanceID })
      return observations[Math.min(index++, observations.length - 1)]!
    },
  })
  return { handle, reasons, seen }
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 25))
}

describe("managed parent watchdog binds an occurrence, not a process number", () => {
  test("shares exact process-instance golden vectors with the native launcher", () => {
    const contract = JSON.parse(
      fs.readFileSync(path.join(import.meta.dir, "fixture", "process-instance-id-contract.json"), "utf8"),
    ) as {
      schemaVersion: number
      windows: { filetimeTicks: string; expected: string }
      linux: { stat: string; expected: string }
      macos: { lstart: string; expected: string }
    }
    expect({
      schemaVersion: contract.schemaVersion,
      windows: ProcessInstanceIDTestHooks.windows(BigInt(contract.windows.filetimeTicks)),
      linux: ProcessInstanceIDTestHooks.linux(contract.linux.stat),
      macos: ProcessInstanceIDTestHooks.posix("darwin", contract.macos.lstart),
    }).toEqual({
      schemaVersion: 1,
      windows: contract.windows.expected,
      linux: contract.linux.expected,
      macos: contract.macos.expected,
    })
  })

  test("admits one complete launcher-minted parent occurrence", () => {
    expect(
      ManagedServerLifecycle.parentInput({
        pid: PARENT.pid,
        processInstanceID: `  ${PARENT.processInstanceID}  `,
        occurrenceID: PARENT.occurrenceID,
      }),
    ).toEqual({ parent: PARENT })
  })

  test("maps a partial managed-parent protocol to its exact validation error", () => {
    expect(() => ManagedServerLifecycle.parentInput({ pid: PARENT.pid })).toThrow(
      "Managed serve requires --parent-process-instance-id with --parent-pid",
    )
    expect(() => ManagedServerLifecycle.parentInput({ processInstanceID: PARENT.processInstanceID })).toThrow(
      "Managed serve requires a positive safe-integer --parent-pid",
    )
  })

  test("a reused parent process identifier is terminal, exactly like an exit", async () => {
    const watched = watch(["dead_or_reused"])
    await settle()
    watched.handle.stop()
    expect({
      orphaned: watched.reasons.length,
      reason: watched.reasons[0],
      observedIdentity: watched.seen[0],
    }).toEqual({
      orphaned: 1,
      reason: "parent-watchdog: parent process occurrence exited or its identifier was reused",
      observedIdentity: { pid: PARENT.pid, processInstanceID: PARENT.processInstanceID },
    })
  })

  test("the exact live host keeps the backend running", async () => {
    const watched = watch(["exact_live"])
    await settle()
    watched.handle.stop()
    expect(watched.reasons).toEqual([])
  })

  test("lost exact observability fails the managed lifetime closed", async () => {
    const watched = watch(["unknown_live"])
    await settle()
    watched.handle.stop()
    expect(watched.reasons).toEqual(["parent-watchdog: parent process occurrence can no longer be observed exactly"])
  })

  test("orphaning fires exactly once and stops the watch", async () => {
    const watched = watch(["dead_or_reused", "dead_or_reused", "dead_or_reused"])
    await settle()
    watched.handle.stop()
    expect(watched.reasons.length).toBe(1)
  })
})
