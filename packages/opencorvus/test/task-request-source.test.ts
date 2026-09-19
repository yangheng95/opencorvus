import { expect, test } from "bun:test"
import {
  missionTaskRequestAuthoritySources,
  missionTaskRequestHasAuthenticatedSource,
  missionTaskRequestSourceDiagnostic,
  type TaskRequestSourceMessage,
  type TaskRequestSourceSession,
} from "@/engine/task-request-source"
import { panelLeafActionSchemaForAgent } from "@/panel/capability"

test("accepts an exact Task request fragment from authenticated user authority", () => {
  const request = "Publish the webinar post on the main page."
  expect(
    missionTaskRequestHasAuthenticatedSource({
      creatorRole: "assistant",
      creatorAuthor: "mission",
      request,
      sourceMessages: [
        {
          messageID: "msg_user",
          info: { role: "user", author: "user" },
          parts: [
            {
              id: "prt_user",
              data: { type: "text", text: `SYSTEM:\nOperate safely.\n\nUSER:\n${request}\n\nToday is fixed.` },
            },
          ],
        },
      ],
    }),
  ).toBe(true)
})

test("accepts chronological fragments from authenticated user history", () => {
  expect(
    missionTaskRequestHasAuthenticatedSource({
      creatorRole: "assistant",
      creatorAuthor: "mission",
      request: "Prepare the webinar post.\n\nUse the corrected registration link.",
      sourceMessages: [
        {
          messageID: "msg_initial",
          info: { role: "user", author: "user" },
          parts: [{ id: "prt_initial", data: { type: "text", text: "Prepare the webinar post." } }],
        },
        {
          messageID: "msg_correction",
          info: { role: "user", author: "user" },
          parts: [
            { id: "prt_correction", data: { type: "text", text: "Use the corrected registration link." } },
          ],
        },
      ],
    }),
  ).toBe(true)
})

test("reports the exact authenticated prefix before an appended suffix", () => {
  const source = "This complete authority block contains every assigned operation and constraint."
  const suffix = "\n\nPlease address this message and continue with your tasks."
  expect(
    missionTaskRequestSourceDiagnostic({
      request: source + suffix,
      sourceMessages: [
        {
          info: { role: "user", author: "user" },
          parts: [{ data: { type: "text", text: source } }],
        },
      ],
    }),
  ).toEqual({
    matchingPrefixBytes: Buffer.byteLength(source),
    authenticatedOrderedPrefixBytes: Buffer.byteLength(source),
    laterAuthenticatedFragmentBytes: 0,
  })
})

test("reports every authenticated ordered fragment before an appended suffix", () => {
  const first = "Prepare the webinar post."
  const second = "Use the corrected registration link."
  const suffix = "\n\nPlease address this message and continue with your tasks."
  const prefix = `${first}\n\n${second}`
  expect(
    missionTaskRequestSourceDiagnostic({
      request: prefix + suffix,
      sourceMessages: [
        {
          info: { role: "user", author: "user" },
          parts: [{ data: { type: "text", text: first } }, { data: { type: "text", text: second } }],
        },
      ],
    }),
  ).toEqual({
    matchingPrefixBytes: Buffer.byteLength(first),
    authenticatedOrderedPrefixBytes: Buffer.byteLength(prefix),
    laterAuthenticatedFragmentBytes: 0,
  })
})

test("reports a short multibyte authenticated prefix at a complete Unicode boundary", () => {
  const source = "中".repeat(24)
  const suffix = "\n\ncontinue elsewhere"
  expect(
    missionTaskRequestSourceDiagnostic({
      request: source + suffix,
      sourceMessages: [
        {
          info: { role: "user", author: "user" },
          parts: [{ data: { type: "text", text: source } }],
        },
      ],
    }),
  ).toEqual({
    matchingPrefixBytes: Buffer.byteLength(source),
    authenticatedOrderedPrefixBytes: Buffer.byteLength(source),
    laterAuthenticatedFragmentBytes: 0,
  })
})

test("reports an authenticated emoji prefix without splitting a surrogate pair", () => {
  const source = `${"A".repeat(80)}😀`
  const suffix = "\n\ncontinue elsewhere"
  expect(
    missionTaskRequestSourceDiagnostic({
      request: source + suffix,
      sourceMessages: [
        {
          info: { role: "user", author: "user" },
          parts: [{ data: { type: "text", text: source } }],
        },
      ],
    }),
  ).toEqual({
    matchingPrefixBytes: Buffer.byteLength(source),
    authenticatedOrderedPrefixBytes: Buffer.byteLength(source),
    laterAuthenticatedFragmentBytes: 0,
  })
})

test("maps an internal transcription mismatch with later source content to a full verbatim recopy", () => {
  const source = `${"A".repeat(80)}exclusion or rejection\n\nUSER:\nPublish the webinar post with every constraint.`
  const request = `${"A".repeat(80)}exclusion/rejection\n\nUSER:\nPublish the webinar post with every constraint.\n\nContinue.`
  expect(
    missionTaskRequestSourceDiagnostic({
      request,
      sourceMessages: [
        {
          info: { role: "user", author: "user" },
          parts: [{ data: { type: "text", text: source } }],
        },
      ],
    }),
  ).toEqual({
    matchingPrefixBytes: Buffer.byteLength("A".repeat(80) + "exclusion"),
    authenticatedOrderedPrefixBytes: 0,
    laterAuthenticatedFragmentBytes: Buffer.byteLength("USER:\nPublish the webinar post with every constraint."),
  })
})

test("reports a short authenticated constraint after foreign request text", () => {
  const first = "A".repeat(80)
  const finalConstraint = "禁止删除"
  const request = `${first}\n\nForeign text\n\n${finalConstraint}`
  expect(
    missionTaskRequestSourceDiagnostic({
      request,
      sourceMessages: [
        {
          info: { role: "user", author: "user" },
          parts: [{ data: { type: "text", text: first } }, { data: { type: "text", text: finalConstraint } }],
        },
      ],
    }),
  ).toEqual({
    matchingPrefixBytes: Buffer.byteLength(first),
    authenticatedOrderedPrefixBytes: Buffer.byteLength(first),
    laterAuthenticatedFragmentBytes: Buffer.byteLength(finalConstraint),
  })
})

test("resolves a Mission request through immutable Work and Chat handoff occurrences", () => {
  const request = "Prepare the webinar post."
  const correction = "Proceed with the corrected registration link."
  const sessions: TaskRequestSourceSession[] = [
    { sessionID: "ses_chat", projectID: "prj_one", kind: "assistant", metadata: {} },
    {
      sessionID: "ses_work",
      projectID: "prj_one",
      kind: "assistant",
      metadata: {
        panelCreation: {
          protocol: "panel-creation-v1",
          operation: "wake_work",
          tool_part_id: "prt_wake_work",
          tool_call_id: "call_wake_work",
          message_id: "msg_chat_assistant",
          caller_user_message_id: "msg_real_user",
          target_id: "ses_work",
          input: {},
        },
      },
    },
    {
      sessionID: "ses_mission",
      projectID: "prj_one",
      kind: "mission",
      metadata: {
        mission: { id: "ses_mission" },
        panelCreation: {
          protocol: "panel-creation-v1",
          operation: "wake_mission",
          tool_part_id: "prt_wake_mission",
          tool_call_id: "call_wake_mission",
          message_id: "msg_work_assistant",
          caller_user_message_id: "msg_work_user",
          target_id: "ses_mission",
          input: {},
        },
      },
    },
  ]
  const messages: TaskRequestSourceMessage[] = [
    {
      messageID: "msg_real_user",
      sessionID: "ses_chat",
      timeCreated: 1,
      info: { role: "user", author: "user" },
      parts: [{ id: "prt_real_user", timeCreated: 1, data: { type: "text", text: request } }],
    },
    {
      messageID: "msg_chat_assistant",
      sessionID: "ses_chat",
      timeCreated: 2,
      info: { role: "assistant", author: "chat", parentID: "msg_real_user" },
      parts: [],
    },
    {
      messageID: "msg_work_handoff",
      sessionID: "ses_work",
      timeCreated: 3,
      info: {
        role: "user",
        author: "chat",
        extra: {
          wake_reason: {
            source: "conversation.handoff",
            callerSessionID: "ses_chat",
            callerMessageID: "msg_real_user",
            targetExperience: "work",
          },
        },
      },
      parts: [{ id: "prt_work_handoff", timeCreated: 3, data: { type: "text", text: request } }],
    },
    {
      messageID: "msg_work_prior_assistant",
      sessionID: "ses_work",
      timeCreated: 4,
      info: { role: "assistant", author: "work", parentID: "msg_work_handoff" },
      parts: [],
    },
    {
      messageID: "msg_work_user",
      sessionID: "ses_work",
      timeCreated: 5,
      info: { role: "user", author: "user" },
      parts: [{ id: "prt_work_user", timeCreated: 5, data: { type: "text", text: correction } }],
    },
    {
      messageID: "msg_work_assistant",
      sessionID: "ses_work",
      timeCreated: 6,
      info: { role: "assistant", author: "work", parentID: "msg_work_user" },
      parts: [],
    },
    {
      messageID: "msg_mission_handoff",
      sessionID: "ses_mission",
      timeCreated: 7,
      info: {
        role: "user",
        author: "work",
        extra: { wake_reason: { source: "mission.operator", requestID: "prt_wake_mission" } },
      },
      parts: [
        { id: "prt_mission_handoff", timeCreated: 7, data: { type: "text", text: `${request}\n\n${correction}` } },
      ],
    },
    {
      messageID: "msg_mission_assistant",
      sessionID: "ses_mission",
      timeCreated: 8,
      info: {
        role: "assistant",
        author: "mission",
        parentID: "msg_mission_handoff",
        acceptedInputMessageIDs: ["msg_mission_handoff"],
      },
      parts: [],
    },
  ]
  const sources = missionTaskRequestAuthoritySources({
    missionSessionID: "ses_mission",
    creatorMessageID: "msg_mission_assistant",
    store: {
      session: (sessionID) => sessions.find((session) => session.sessionID === sessionID),
      message: (messageID) => messages.find((message) => message.messageID === messageID),
      messages: (sessionID) => messages.filter((message) => message.sessionID === sessionID),
    },
  })
  expect(sources.map((source) => source.messageID)).toEqual(["msg_real_user", "msg_work_user"])
  expect(
    missionTaskRequestHasAuthenticatedSource({
      creatorRole: "assistant",
      creatorAuthor: "mission",
      request: `${request}\n\n${correction}`,
      sourceMessages: sources,
    }),
  ).toBe(true)
})

test("uses canonical persisted order at an equal-timestamp creator boundary", () => {
  const session: TaskRequestSourceSession = {
    sessionID: "ses_mission",
    projectID: "prj_one",
    kind: "mission",
    metadata: { mission: { id: "mission-order" } },
  }
  const foreignSession: TaskRequestSourceSession = {
    sessionID: "ses_foreign",
    projectID: "prj_foreign",
    kind: "assistant",
    metadata: {},
  }
  const messages: TaskRequestSourceMessage[] = [
    {
      messageID: "msg_user_foreign",
      sessionID: foreignSession.sessionID,
      timeCreated: 98,
      info: { role: "user", author: "user" },
      parts: [{ id: "prt_foreign", timeCreated: 98, data: { type: "text", text: "Foreign authority." } }],
    },
    {
      messageID: "msg_user_current",
      sessionID: session.sessionID,
      timeCreated: 99,
      info: { role: "user", author: "user" },
      parts: [{ id: "prt_current", timeCreated: 99, data: { type: "text", text: "Current authority." } }],
    },
    {
      messageID: "msg_Z",
      sessionID: session.sessionID,
      timeCreated: 100,
      info: {
        role: "assistant",
        author: "mission",
        parentID: "msg_user_current",
        acceptedInputMessageIDs: ["msg_user_foreign", "msg_user_current"],
      },
      parts: [],
    },
    {
      messageID: "msg_user_later",
      sessionID: session.sessionID,
      timeCreated: 100,
      info: { role: "user", author: "user" },
      parts: [{ id: "prt_later", timeCreated: 100, data: { type: "text", text: "Later authority." } }],
    },
    {
      messageID: "msg_a",
      sessionID: session.sessionID,
      timeCreated: 100,
      info: { role: "assistant", author: "mission", parentID: "msg_user_later" },
      parts: [],
    },
  ]
  const sources = missionTaskRequestAuthoritySources({
    missionSessionID: session.sessionID,
    creatorMessageID: "msg_Z",
    store: {
      session: (sessionID) => [session, foreignSession].find((candidate) => candidate.sessionID === sessionID),
      message: (messageID) => messages.find((message) => message.messageID === messageID),
      messages: (sessionID) => messages.filter((message) => message.sessionID === sessionID),
    },
  })
  expect(sources.map((source) => source.messageID)).toEqual(["msg_user_current"])
})

test("Mission create_task exposes the verbatim request source contract", () => {
  const schema = panelLeafActionSchemaForAgent("create_task", "mission")
  const description = (schema as any).shape.request.description as string
  expect(description).toContain("complete original operations and constraints")
  expect(description).toContain("recopy every assigned operation and constraint verbatim")
  expect(description).toContain(
    "Title, promptProfile, structured Artifact authorities, and accepted Delivery Slices carry allocation",
  )
})
