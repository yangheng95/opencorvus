import { expect, test } from "bun:test"
import type { SessionMessageResponse } from "@opencorvus-ai/sdk"
import { acpCompactionResponse, acpPromptResponse } from "@/acp/prompt-response"
import { Message } from "@/session/message"

const identity = { sessionID: "ses_acp_contract", inputMessageID: "msg_acp_input" }
function reply(): SessionMessageResponse {
  return {
    info: {
      id: "msg_acp_final",
      sessionID: identity.sessionID,
      parentID: identity.inputMessageID,
      acceptedInputMessageIDs: [identity.inputMessageID],
      role: "assistant",
      author: "coding",
      agent: "coding",
      providerID: "owned",
      modelID: "model",
      path: { cwd: "/owned", root: "/owned" },
      time: { created: 1, completed: 2 },
      finish: "stop",
      cost: 0,
      orderKey: "owned-order",
      tokens: { total: 101, input: 10, output: 5, reasoning: 2, cache: { read: 3, write: 4 } },
    },
    parts: [],
  }
}
function convert(data = reply()) {
  return acpPromptResponse({ ...identity, response: { data } })
}
function errorOf(run: () => unknown) {
  try {
    return run()
  } catch (error) {
    return error
  }
}

test("ACP returns the canonical usage total with explicit components", () => {
  expect(convert()).toEqual({
    stopReason: "end_turn",
    _meta: {},
    usage: {
      totalTokens: 101,
      inputTokens: 10,
      outputTokens: 5,
      thoughtTokens: 2,
      cachedReadTokens: 3,
      cachedWriteTokens: 4,
    },
  })
})

test.each([
  { error: new Message.AbortedError({ message: "User cancelled" }).toObject(), stopReason: "cancelled" },
  {
    error: new Message.OutputLengthError({ message: "Output limit", effectiveOutputLimit: 10 }).toObject(),
    stopReason: "max_tokens",
  },
])("ACP projects canonical $stopReason errors as stop reasons", ({ error, stopReason }) => {
  const data = reply()
  if (data.info.role !== "assistant") throw Error("Assistant fixture required")
  data.info.error = error
  data.info.finish = "error"
  expect(convert(data)).toMatchObject({ stopReason, usage: { totalTokens: 101 } })
})

test("a hard failure retains precedence over the stream's output limit", () => {
  const data = reply()
  if (data.info.role !== "assistant") throw Error("Assistant fixture required")
  data.info.error = new Message.APIError({ message: "Actual provider failure", isRetryable: false }).toObject()
  data.info.finish = "length"
  expect(errorOf(() => convert(data))).toMatchObject({
    code: -32603,
    data: { ...identity, finalMessageID: data.info.id, error: data.info.error },
  })
})

test.each([
  {
    name: "another session",
    apply: (data: SessionMessageResponse) => {
      data.info.sessionID = "ses_peer"
    },
  },
  {
    name: "another input",
    apply: (data: SessionMessageResponse) => {
      if (data.info.role === "assistant") data.info.acceptedInputMessageIDs = ["msg_peer"]
    },
  },
  {
    name: "an open reply",
    apply: (data: SessionMessageResponse) => {
      if (data.info.role === "assistant") data.info.time.completed = undefined
    },
  },
])("ACP returns a concrete integrity error for $name", ({ apply }) => {
  const data = reply()
  apply(data)
  expect(errorOf(() => convert(data))).toMatchObject({
    code: -32603,
    data: identity,
    message: expect.stringContaining("no settled assistant reply"),
  })
})

test("ACP accepts a reply owned by a canonical batched input", () => {
  const data = reply()
  if (data.info.role !== "assistant") throw Error("Assistant fixture required")
  data.info.parentID = "msg_batch_tail"
  data.info.acceptedInputMessageIDs = [identity.inputMessageID, "msg_batch_tail"]
  expect(convert(data)).toMatchObject({ stopReason: "end_turn" })
})

test("an error finish with missing diagnostics remains an explicit failure", () => {
  const data = reply()
  if (data.info.role !== "assistant") throw Error("Assistant fixture required")
  data.info.finish = "error"
  expect(errorOf(() => convert(data))).toMatchObject({
    code: -32603,
    message: expect.stringContaining("error finish has no recorded diagnostic"),
  })
})

test("SDK HTTP errors retain the original error body and exact input", () => {
  const error = { name: "PublicSessionExecutionBusyError", data: { message: "Exact session is busy" } }
  expect(errorOf(() => acpPromptResponse({ ...identity, response: { error } }))).toMatchObject({
    code: -32603,
    data: { ...identity, error },
  })
})

test("missing SDK response data has a concrete integrity error", () => {
  expect(errorOf(() => acpPromptResponse({ ...identity, response: {} }))).toMatchObject({
    code: -32603,
    data: identity,
  })
})

test("ACP compaction completion comes from the public boolean result", () => {
  expect(acpCompactionResponse({ sessionID: identity.sessionID, response: { data: true } })).toEqual({
    stopReason: "end_turn",
    _meta: {},
  })
  expect(
    errorOf(() => acpCompactionResponse({ sessionID: identity.sessionID, response: { data: false } })),
  ).toMatchObject({
    code: -32603,
    data: { sessionID: identity.sessionID },
    message: expect.stringContaining("compaction did not complete"),
  })
})
