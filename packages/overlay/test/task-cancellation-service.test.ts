import { expect, test } from "bun:test"
import { captureApiAuthority, configure } from "../src/services/api"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest, getHostTransport } from "../src/services/host-transport-runtime"
import { cancelTask } from "../src/services/task"

test("sidebar cancellation sends the confirmed Task and project directory on the captured connection", async () => {
  const received: TransportRequest[] = []
  const transport: HostTransport = {
    kind: "browser",
    capabilities: getHostTransport().capabilities,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      received.push(request)
      return {
        status: 202,
        ok: true,
        headers: {},
        body: { status: "cancelling" } as T,
      }
    },
    openStream() { throw new Error("Unexpected stream request") },
    async native() { throw new Error("Unexpected native request") },
  }
  configure({ directory: "D:/projects/current-workspace" })
  const authority = captureApiAuthority()
  __setHostTransportForTest(transport)
  const taskID = "tsk_older"
  const directory = "D:/projects/other/project"
  const body = { surface: "overlay.work_ledger", reason: "Operator cancelled the confirmed Task" } as const
  try {
    expect(await cancelTask({ taskID, directory, authority }, body)).toBeUndefined()
    expect(received.map(({ authority, path, query, method, body }) => ({ authority, path, query, method, body }))).toEqual([{
      authority,
      method: "POST",
      path: `task/${taskID}/cancel`,
      query: { directory },
      body: { kind: "json", value: body },
    }])
  } finally {
    __setHostTransportForTest(undefined)
    configure({ directory: "" })
  }
})
