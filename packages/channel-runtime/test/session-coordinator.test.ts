import { describe, expect, test } from "bun:test"
import { SessionCoordinator } from "../src/session-coordinator"

describe("session coordinator", () => {
  test("binds and resolves sessions by thread/session id", () => {
    const coordinator = new SessionCoordinator<{ sessionId: string; channel: string }>()
    coordinator.bind("slack:C1:T1", { sessionId: "session_1", channel: "C1" })
    coordinator.bind("discord:C2:T2", { sessionId: "session_1", channel: "C2" })

    expect(coordinator.get("slack:C1:T1")?.sessionId).toBe("session_1")
    expect(coordinator.findSession("session_1")?.channel).toBe("C1")
    expect(coordinator.findSessions("session_1").map((item) => item.channel)).toEqual(["C1", "C2"])
  })
})
