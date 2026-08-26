import { describe, expect, test } from "bun:test"
import { ParentWatchdog } from "../src/server/parent-watchdog"
import type { RuntimeProcessOccurrenceInfo } from "../src/runtime/process-occurrence"

const PARENT: RuntimeProcessOccurrenceInfo = {
  pid: 4242,
  processInstanceID: "test:host-start-instant",
  occurrenceID: "occurrence-under-test",
}

function watch(
  observations: Array<"exact_live" | "dead_or_reused" | "unknown_live">,
  parent: { pid: number; processInstanceID?: string } = PARENT,
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

  test("a host this platform cannot fingerprint is not orphaned by identity", async () => {
    // "unknown_live" is the honest answer where no fingerprint exists; it must
    // never be read as reuse.
    const watched = watch(["unknown_live"])
    await settle()
    watched.handle.stop()
    expect(watched.reasons).toEqual([])
  })

  test("orphaning fires exactly once and stops the watch", async () => {
    const watched = watch(["dead_or_reused", "dead_or_reused", "dead_or_reused"])
    await settle()
    watched.handle.stop()
    expect(watched.reasons.length).toBe(1)
  })
})
