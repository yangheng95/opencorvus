import { describe, expect, test } from "bun:test"
import { conversationHistoryPath } from "../src/services/conversation-history-path"

describe("conversation history path", () => {
  const cursor = {
    directory: "D:\\work trees\\OpenCorvus",
    before: 1_725_000_000_123,
    beforeOrderKey: "message:001:msg_before",
    beforeID: "msg_before",
    limit: 160,
  }

  test("projects the Task history route from the shared cursor", () => {
    expect(conversationHistoryPath({ kind: "task", id: "tsk/a" }, cursor)).toBe(
      "task/tsk%2Fa/conversation/history?directory=D%3A%5Cwork+trees%5COpenCorvus&before=1725000000123&before_order_key=message%3A001%3Amsg_before&before_id=msg_before&limit=160",
    )
  })

  test("projects the Session history route from the shared cursor", () => {
    expect(conversationHistoryPath({ kind: "session", id: "ses/a", sessionKind: "mission" }, cursor)).toBe(
      "session/ses%2Fa/conversation/history?directory=D%3A%5Cwork+trees%5COpenCorvus&before=1725000000123&before_order_key=message%3A001%3Amsg_before&before_id=msg_before&limit=160",
    )
  })
})
