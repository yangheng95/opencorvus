import { describe, expect, test } from "bun:test"
import { conversationMessageDisplayStage, isDelegatedContextMessage } from "../src/utils/message-origin"

describe("message origin disclosure policy", () => {
  test("collapses non-human user-role context in delegated sessions", () => {
    const architect = { role: "user", author: "orchestrator", channel: "architect", source: "" }
    const build = { role: "user", author: "scheduler", channel: "build", source: "scheduler" }
    expect(isDelegatedContextMessage(architect)).toBe(true)
    expect(conversationMessageDisplayStage(architect)).toBe("architect")
    expect(isDelegatedContextMessage(build)).toBe(true)
    expect(conversationMessageDisplayStage(build)).toBe("build")
  })

  test("collapses the human request after it is delivered into an internal session", () => {
    expect(isDelegatedContextMessage({ role: "user", author: "user", channel: "orchestrator", source: "" })).toBe(true)
  })

  test("keeps right-sidebar Chat user prompts expanded", () => {
    expect(
      isDelegatedContextMessage({
        role: "user",
        author: "user",
        channel: "assistant",
        source: "right-sidebar-conversation",
      }),
    ).toBe(false)
  })

  test("keeps real user messages and assistant answers expanded", () => {
    expect(isDelegatedContextMessage({ role: "user", author: "user", channel: "main", source: "" })).toBe(false)
    expect(
      isDelegatedContextMessage({ role: "assistant", author: "orchestrator", channel: "architect", source: "" }),
    ).toBe(false)
  })
})
