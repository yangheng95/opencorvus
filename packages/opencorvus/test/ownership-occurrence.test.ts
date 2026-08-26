import { describe, expect, test } from "bun:test"
import { Ownership } from "../src/engine/ownership"
import { currentRuntimeProcessOccurrence } from "../src/runtime/process-occurrence"

describe("worktree ownership observes an occurrence, not a process number", () => {
  test("this process's own marker is observed alive", () => {
    const own = currentRuntimeProcessOccurrence()
    expect(
      Ownership.observeOwner({
        ownerPid: own.pid,
        ownerProcessInstanceID: own.processInstanceID,
      }),
    ).toEqual({ status: "alive" })
  })

  test("a reused process number is dead, so its worktree becomes releasable", () => {
    // The audited shape: the owner exited and the operating system handed its
    // number to something unrelated. A number-only probe answers "alive"
    // forever and the worktree can never be released.
    const own = currentRuntimeProcessOccurrence()
    expect(
      Ownership.observeOwner({
        ownerPid: own.pid,
        ownerProcessInstanceID: "a-different-process-that-once-held-this-number",
      }),
    ).toEqual({ status: "dead" })
  })

  test("a marker with no fingerprint keeps the weaker number-only answer", () => {
    const own = currentRuntimeProcessOccurrence()
    expect(Ownership.observeOwner({ ownerPid: own.pid })).toEqual({ status: "alive" })
    expect(
      Ownership.observeOwner({ ownerPid: own.pid }, () => {
        const error = new Error("no such process") as NodeJS.ErrnoException
        error.code = "ESRCH"
        throw error
      }),
    ).toEqual({ status: "dead" })
  })

  test("an unobservable process number is neither alive nor dead", () => {
    expect(
      Ownership.observeOwner({ ownerPid: -1 }),
    ).toMatchObject({ status: "unobservable" })
  })
})
