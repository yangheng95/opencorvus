import { expect, test } from "bun:test"
import { APICallError } from "ai"
import { SessionProcessor } from "@/session/processor"
import { Message } from "@/session/message"

test("a replay refusal preserves its real wrapped transport cause and redacted trace through canonical serialization", () => {
  const physical = Object.assign(new TypeError("Socket closed; trace=TRACE-731; token=SYNTHETIC_PRIVATE"), {
    code: "ECONNRESET",
  })
  const sdk = new APICallError({
    message: "Failed to process successful response",
    url: "https://provider.example.invalid/stream",
    requestBodyValues: {},
    statusCode: 200,
    cause: physical,
  })
  const error = new SessionProcessor.ProcessorUnsafeRetryError(0, ["prt_committed"], sdk)
  expect(error.cause).toBe(sdk)
  expect(JSON.parse(JSON.stringify(Message.fromError(error, { providerID: "local" })))).toEqual({
    name: "UnknownError",
    data: {
      message:
        "ProcessorUnsafeRetryError: SessionProcessor cannot retry activity attempt 0 inside the same assistant message after tool execution started. Created parts: prt_committed. Retry cause: AI_APICallError: Failed to process successful response <- TypeError: Socket closed; trace=TRACE-731; token=<redacted> (code=ECONNRESET)",
    },
  })
})

test("a cyclic error cause retains the observed nodes and a finite explicit cycle marker", () => {
  const first = new Error("First failure")
  const second = new TypeError("Second failure", { cause: first })
  first.cause = second
  const error = new SessionProcessor.ProcessorUnsafeRetryError(2, ["prt_existing"], first)
  expect(error.message).toBe(
    "SessionProcessor cannot retry activity attempt 2 inside the same assistant message after tool execution started. Created parts: prt_existing. Retry cause: Error: First failure <- TypeError: Second failure <- [circular error cause]",
  )
})
