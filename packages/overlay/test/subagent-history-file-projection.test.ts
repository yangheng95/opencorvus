import { expect, test } from "bun:test"
import { DIRECTORY_REFERENCE_MIME } from "@opencorvus-ai/transport-protocol"
import {
  projectSubagentConversationCard,
  type SubagentTranscriptMessage,
} from "../src/services/subagent-conversation"
import { loadLocale } from "../src/utils/i18n"
import { testMessageOrderKey, testPartOrderKey } from "./fixtures/timeline-order"

const sessionID = "ses_member_history"

function messageWithFile(input: {
  messageID: string
  partID: string
  role: "user" | "assistant"
  time: number
  url: string
  filename: string
  mime: string
}): SubagentTranscriptMessage {
  return {
    messageID: input.messageID,
    sessionID,
    agentID: input.role === "user" ? "user" : "coding",
    stage: input.role === "user" ? "user" : "coding",
    time: input.time,
    orderKey: testMessageOrderKey(input.messageID, input.time),
    info: { role: input.role, author: input.role === "user" ? "user" : "coding" },
    parts: [{
      type: "file",
      id: input.partID,
      messageID: input.messageID,
      sessionID,
      orderKey: testPartOrderKey(input.partID, input.time),
      url: input.url,
      filename: input.filename,
      mime: input.mime,
    }],
  }
}

test("member transcript file parts keep their own persisted message role", async () => {
  await loadLocale("en-US")
  const first = messageWithFile({
    messageID: "msg_user_first",
    partID: "prt_user_text",
    role: "user",
    time: 1_000,
    url: "file:///C:/project/inspection%20notes.txt?start=2&end=3",
    filename: "inspection notes.txt",
    mime: "text/plain",
  })
  const assistant = messageWithFile({
    messageID: "msg_assistant",
    partID: "prt_assistant_file",
    role: "assistant",
    time: 1_100,
    url: "/attachment/prj_owned/assistant.txt",
    filename: "assistant.txt",
    mime: "text/plain",
  })
  const later = messageWithFile({
    messageID: "msg_user_later",
    partID: "prt_user_directory",
    role: "user",
    time: 1_200,
    url: "/attachment/prj_owned/archive.directory.json",
    filename: "notes archive",
    mime: DIRECTORY_REFERENCE_MIME,
  })

  const card = projectSubagentConversationCard({
    targetKey: "member-history",
    sessionID,
    messages: [first, assistant, later],
    lastLiveSequence: 0,
    liveEpoch: 0,
    transcriptMode: "snapshot",
    removedMessageIDs: [],
  }, "completed")
  expect(card?.parts.filter((part) => part.type === "file")).toEqual([
    { ...first.parts[0], fileMessageRole: "user" },
    { ...assistant.parts[0], fileMessageRole: "assistant" },
    { ...later.parts[0], fileMessageRole: "user" },
  ])
})
