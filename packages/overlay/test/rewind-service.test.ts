import { afterEach, beforeEach, expect, test } from "bun:test"

import { configure } from "../src/services/api"
import { RewindRequestError, submitTaskRewind } from "../src/services/rewind"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"

const TASK_ID = "tsk_rewind_service"
const SAVED_DIRECTORY = "D:/workspace/rewind"

function rewindTransport(
  capture: (request: TransportRequest) => void,
  response: TransportResponse<string>,
): HostTransport {
  return {
    kind: "tauri",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      capture(request)
      return response as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

beforeEach(() => {
  configure({ serverUrl: "http://127.0.0.1:7878", directory: SAVED_DIRECTORY })
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})

test("submitTaskRewind sends the task-scoped rewind request through HostTransport", async () => {
  let captured: TransportRequest | undefined
  __setHostTransportForTest(
    rewindTransport(
      (request) => {
        captured = request
      },
      { status: 200, ok: true, headers: {}, body: "ok" },
    ),
  )

  await submitTaskRewind({
    taskID: TASK_ID,
    cursorTime: 12345,
    anchorID: "msg_anchor",
    resetWorktree: false,
  })

  expect(captured?.path).toBe(`task/${TASK_ID}/rewind`)
  expect(captured?.method).toBe("POST")
  expect(captured?.responseKind).toBe("text")
  expect(captured?.query?.directory).toBe(SAVED_DIRECTORY)
  expect(captured?.body).toEqual({
    kind: "json",
    value: {
      anchor: { kind: "cursorTime", cursorTime: 12345, anchorEventID: "msg_anchor" },
      resetWorktree: false,
      reason: "user rewind card",
    },
  })
})

test("submitTaskRewind rejects failed rewind responses with status, path, and body", async () => {
  let captured: TransportRequest | undefined
  __setHostTransportForTest(
    rewindTransport(
      (request) => {
        captured = request
      },
      { status: 503, ok: false, headers: {}, body: "rewind failed by fixture" },
    ),
  )

  let error: unknown
  try {
    await submitTaskRewind({
      taskID: TASK_ID,
      cursorTime: 67890,
      anchorID: "msg_failed_anchor",
      resetWorktree: true,
    })
  } catch (cause) {
    error = cause
  }

  expect(error).toBeInstanceOf(RewindRequestError)
  expect((error as RewindRequestError).status).toBe(503)
  expect((error as RewindRequestError).path).toBe(`task/${TASK_ID}/rewind`)
  expect((error as RewindRequestError).body).toBe("rewind failed by fixture")
  expect(String((error as Error).message)).toContain("rewind failed by fixture")
  expect(captured?.body).toEqual({
    kind: "json",
    value: {
      anchor: { kind: "cursorTime", cursorTime: 67890, anchorEventID: "msg_failed_anchor" },
      resetWorktree: true,
      reason: "user rewind card",
    },
  })
})
