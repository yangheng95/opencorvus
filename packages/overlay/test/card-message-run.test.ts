import { expect, test } from "bun:test"
import { messageIDsForCardRuns } from "../src/utils/card-message-run"

test("run identity projection retains persisted part messages in first producer order", () => {
  expect(messageIDsForCardRuns([
    { key: "a", messageID: "msg_a", collapsedContext: false, parts: [
      { type: "tool", messageID: "msg_a" },
      { type: "tool", messageID: "msg_b" },
      { type: "source-file", messageID: "msg_b" },
    ] },
    { key: "c", messageID: "msg_c", collapsedContext: false, parts: [
      { type: "source-file", messageID: "msg_c" },
    ] },
  ])).toEqual(["msg_a", "msg_b", "msg_c"])
})

test("projected artifact and failure messages retain identity with empty parts", () => {
  expect(messageIDsForCardRuns([
    { key: "artifact", messageID: "msg_artifact", collapsedContext: false, parts: [] },
    { key: "failure", messageID: "msg_failure", collapsedContext: true, parts: [] },
  ])).toEqual(["msg_artifact", "msg_failure"])
})
