import { afterEach, expect, test } from "bun:test"
import type {
  HostTransport,
  StreamHandlers,
  StreamOpenRequest,
  TransportRequest,
  TransportResponse,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { rejectInteraction, replyInteraction } from "../src/services/interaction-reply"
import { configure } from "../src/services/api"

const PROJECT_DIRECTORY = "D:/overlay/question-project"
const WRONG_DIRECTORY = "D:/overlay/wrong-project"

function recordingTransport(requests: TransportRequest[]): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(req)
      return { status: 200, ok: true, headers: {}, body: true as T }
    },
    openStream(_input: StreamOpenRequest, _handlers: StreamHandlers) {
      throw new Error("openStream not used in interaction reply route tests")
    },
    async native() {
      throw new Error("native not used in interaction reply route tests")
    },
  }
}

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})

test("raw question replies use the question route", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest(recordingTransport(requests))
  configure({ directory: WRONG_DIRECTORY })

  await replyInteraction(
    { id: "que_route_answer", directory: PROJECT_DIRECTORY },
    "answer",
    false,
    {
      answers: [["Vite + React"]],
    },
    "question",
  )
  await rejectInteraction({ id: "que_route_reject", directory: PROJECT_DIRECTORY }, false, "question")

  expect(requests.map((req) => [req.method, req.path])).toEqual([
    ["POST", "question/que_route_answer/reply"],
    ["POST", "question/que_route_reject/reject"],
  ])
  expect(requests.map((req) => req.query?.directory)).toEqual([PROJECT_DIRECTORY, PROJECT_DIRECTORY])
  expect(requests[0]?.body).toEqual({
    kind: "json",
    value: { answers: [["Vite + React"]] },
  })
  expect(requests[1]?.body).toBeUndefined()
})

test("engine interactions keep using the interaction route", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest(recordingTransport(requests))
  configure({ directory: WRONG_DIRECTORY })

  await replyInteraction({ id: "interaction_route_answer", directory: PROJECT_DIRECTORY }, "answer", false, {
    answers: [["Mock data"]],
  })

  expect(requests.map((req) => [req.method, req.path])).toEqual([
    ["POST", "interaction/interaction_route_answer/reply"],
  ])
  expect(requests[0]?.query?.directory).toBe(PROJECT_DIRECTORY)
})

test("interaction replies reject missing explicit directories", async () => {
  await expect(
    replyInteraction({ id: "interaction_missing_dir", directory: "" }, "answer", false, {
      answers: [["Mock data"]],
    }),
  ).rejects.toThrow("directory is required")
})
