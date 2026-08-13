import { describe, expect, test } from "bun:test"
import { conversationEventOwner, isRouterConsumedNoopEventType } from "../src/services/event-policy"

describe("conversation event projection policy", () => {
  test("routes durable scheduler notifications through the control-plane no-op owner", () => {
    expect(conversationEventOwner("scheduler.message")).toBe("tree-writer")
    expect(isRouterConsumedNoopEventType("scheduler.message")).toBe(true)
  })
})
