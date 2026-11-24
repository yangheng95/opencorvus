import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"

interface Captured {
  path: string
  query: Record<string, string | number | boolean> | undefined
  method: string
  body: unknown
}

type Responder = (req: TransportRequest) => TransportResponse<unknown>

globalThis.requestAnimationFrame = (callback) => {
  callback(performance.now())
  return 0
}

function fakeTransport(responder: Responder): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      return responder(req) as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  } as unknown as HostTransport
}

const { renameTask } = await import("../src/services/task")
const { boardStore, clearBoard, setTasksData } = await import("../src/store/board")

let captured: Captured[]
const TASK_DIRECTORY = "D:/repo/task-rename"
const WORKSPACE_DIRECTORY = "D:/repo/current-workspace"
const target = { taskID: "tsk_abc123", directory: TASK_DIRECTORY }

beforeEach(() => {
  captured = []
  configure({ directory: WORKSPACE_DIRECTORY })
  setTasksData([
    {
      task: {
        id: "tsk_current",
        directory: WORKSPACE_DIRECTORY,
        status: "active",
        time: { created: 1, updated: 1 },
      },
      updated_at: 1,
    },
  ])
})

afterEach(() => {
  clearBoard()
  configure({ directory: "" })
  __setHostTransportForTest(undefined)
})

function recordingTransport(patchStatus = 200, readStatus = 200): HostTransport {
  return fakeTransport((req) => {
    captured.push({
      path: req.path,
      query: req.query,
      method: req.method,
      body: req.body && (req.body as any).kind === "json" ? (req.body as any).value : req.body,
    })
    // PATCH renames return 200/true; GET tasks (loadTasks refresh) returns
    // an empty list so the refresh call is a no-op.
    if (req.method === "PATCH") {
      return { status: patchStatus, ok: patchStatus < 400, headers: {}, body: true }
    }
    return { status: readStatus, ok: readStatus < 400, headers: {}, body: { tasks: [] } }
  })
}

describe("renameTask service contract", () => {
  test("renames the Task in its own directory outside the current Board page", async () => {
    __setHostTransportForTest(recordingTransport())
    const ok = await renameTask(target, "  New name  ")
    expect(ok).toBe(true)
    const patches = captured.filter((c) => c.method === "PATCH")
    expect(patches).toEqual([{
      method: "PATCH",
      path: "task/tsk_abc123/title",
      query: { directory: TASK_DIRECTORY },
      body: { title: "New name" },
    }])
  })

  test("server error rejects with the API error", async () => {
    __setHostTransportForTest(recordingTransport(500))
    await expect(renameTask(target, "New name")).rejects.toThrow("API 500")
  })

  test("a confirmed rename returns success while a failed refresh keeps its original read error", async () => {
    __setHostTransportForTest(recordingTransport(200, 503))
    const ok = await renameTask(target, "Committed name")
    expect({ ok, readError: boardStore.tasksError }).toEqual({
      ok: true,
      readError: expect.stringContaining("API 503"),
    })
  })
})
