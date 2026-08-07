import { describe, expect, test } from "bun:test"
import { SessionCoordinator } from "../src/session-coordinator"

describe("session coordinator", () => {
  test("binds and resolves sessions by thread/session id", () => {
    const coordinator = new SessionCoordinator<{ sessionId: string; channel: string }, { text: string }>()
    coordinator.bind("slack:C1:T1", { sessionId: "session_1", channel: "C1" })
    coordinator.bind("discord:C2:T2", { sessionId: "session_1", channel: "C2" })

    expect(coordinator.get("slack:C1:T1")?.sessionId).toBe("session_1")
    expect(coordinator.findSession("session_1")?.channel).toBe("C1")
    expect(coordinator.findSessions("session_1").map((item) => item.channel)).toEqual(["C1", "C2"])
  })

  test("enforces queue limit and preserves queue order", () => {
    const coordinator = new SessionCoordinator<{ sessionId: string }, { text: string }>()
    coordinator.bind("slack:C1:T1", { sessionId: "session_1" })

    expect(coordinator.enqueue("session_1", { msg: { text: "one" }, text: "one" }, 2).ok).toBe(true)
    expect(coordinator.enqueue("session_1", { msg: { text: "two" }, text: "two" }, 2).ok).toBe(true)
    expect(coordinator.enqueue("session_1", { msg: { text: "three" }, text: "three" }, 2).ok).toBe(false)

    expect(coordinator.dequeue("session_1").item?.text).toBe("one")
    expect(coordinator.dequeue("session_1").item?.text).toBe("two")
    expect(coordinator.dequeue("session_1").item).toBeUndefined()
  })

  test("tracks processing state", () => {
    const coordinator = new SessionCoordinator<{ sessionId: string }, { text: string }>()
    coordinator.start("session_1")
    expect(coordinator.processing("session_1")).toBe(true)
    coordinator.stop("session_1")
    expect(coordinator.processing("session_1")).toBe(false)
  })
})
