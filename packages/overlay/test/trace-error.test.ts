import { afterEach, expect, test } from "bun:test"
import { fetchTaskTrace } from "../src/services/trace"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"

const DIRECTORY = "D:/repo/trace"

function fakeTransport(responder: (req: TransportRequest) => TransportResponse<unknown>): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      return responder(req) as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used in trace tests")
    },
    async native() {
      throw new Error("native not used in trace tests")
    },
    onUiCommand() {
      return { unsubscribe() {} }
    },
  } as unknown as HostTransport
}

afterEach(() => __setHostTransportForTest(undefined))

test("fetchTaskTrace returns explicit error result on transport failure", async () => {
  __setHostTransportForTest(
    fakeTransport(() => {
      throw new Error("trace route down")
    }),
  )

  const result = await fetchTaskTrace({ taskID: "task_1", directory: DIRECTORY }, { force: true })
  expect(result.ok).toBe(false)
  expect(result.events).toEqual([])
  expect(result.ok === false ? result.error : "").toContain("trace route down")
})

test("fetchTaskTrace returns explicit error result on malformed response", async () => {
  let captured: TransportRequest | undefined
  __setHostTransportForTest(
    fakeTransport((req) => {
      captured = req
      return { status: 200, ok: true, headers: {}, body: { events: "not-array" } }
    }),
  )

  const result = await fetchTaskTrace({ taskID: "task_1", directory: DIRECTORY }, { force: true })
  expect(result.ok).toBe(false)
  expect(result.ok === false ? result.error : "").toContain("events must be an array")
  expect(captured?.path).toBe("task/task_1/trace")
  expect(captured?.query?.directory).toBe(DIRECTORY)
})
