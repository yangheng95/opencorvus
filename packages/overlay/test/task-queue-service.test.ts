import { afterEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { startQueuedTaskNow } from "../src/services/task-queue"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"

const SETTINGS_DIRECTORY = "D:/repo/from-settings"
const ROW_DIRECTORY = "D:/repo/from-task-row"

function fakeTransport(capture: (req: TransportRequest) => void): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      capture(req)
      return {
        status: 200,
        ok: true,
        headers: {},
        body: {
          task: { id: "tsk_queue", title: "Queued task" },
          directory: ROW_DIRECTORY,
          status: "active",
          started: true,
          queuedTaskIDs: [],
        } as T,
      }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})

test("startQueuedTaskNow sends the task row directory explicitly", async () => {
  let captured: TransportRequest | undefined
  configure({ serverUrl: "http://127.0.0.1:7878", directory: SETTINGS_DIRECTORY })
  __setHostTransportForTest(fakeTransport((req) => (captured = req)))

  const result = await startQueuedTaskNow({ taskID: "tsk_queue", directory: ROW_DIRECTORY })

  expect(result.started).toBe(true)
  expect(captured?.path).toBe("task/tsk_queue/start-now")
  expect(captured?.method).toBe("POST")
  expect(captured?.query?.directory).toBe(ROW_DIRECTORY)
})
