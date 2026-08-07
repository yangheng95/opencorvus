import { afterEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { projectComposerModelFromSession, selectComposerModel } from "../src/services/composer-model"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { appStore, setAppStore } from "../src/store/app"
import { setBoardStore } from "../src/store/board"

const DIRECTORY = "D:/composer-model/session-scope"
const SESSION_ID = "ses_composer_model_scope"
const TASK_ID = "tsk_composer_model_scope"

function fakeTransport(requests: TransportRequest[], model: string): HostTransport {
  return {
    kind: "tauri",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return {
        status: 200,
        ok: true,
        headers: {},
        body: {
          config: { model },
          origin: { model: "session" },
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
  setAppStore({ connected: false, composerModel: "" })
  setBoardStore({
    selectedSource: null,
    board: null,
    tasks: [],
  })
})

describe("Composer model root Session ownership", () => {
  test("projects each selected root Session model in sequence", async () => {
    const requests: TransportRequest[] = []
    setAppStore({ connected: true, composerModel: "" })
    __setHostTransportForTest({
      ...fakeTransport(requests, ""),
      async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
        requests.push(request)
        const model = request.path.includes("ses_task_a") ? "provider/task-a" : "provider/task-b"
        return {
          status: 200,
          ok: true,
          headers: {},
          body: {
            config: { model },
            origin: { model: "session" },
          } as T,
        }
      },
    })

    await projectComposerModelFromSession({ sessionID: "ses_task_a", directory: DIRECTORY }, () => true)
    expect(appStore.composerModel).toBe("provider/task-a")

    await projectComposerModelFromSession({ sessionID: "ses_task_b", directory: DIRECTORY }, () => true)
    expect(appStore.composerModel).toBe("provider/task-b")
    expect(requests.map((request) => request.path)).toEqual(["session/ses_task_a/config", "session/ses_task_b/config"])
  })

  test("projects the selected root Session effective model", async () => {
    const requests: TransportRequest[] = []
    setAppStore({ connected: true, composerModel: "provider/previous" })
    __setHostTransportForTest(fakeTransport(requests, "provider/session-a"))

    const model = await projectComposerModelFromSession({ sessionID: SESSION_ID, directory: DIRECTORY }, () => true)

    expect(model).toBe("provider/session-a")
    expect(appStore.composerModel).toBe("provider/session-a")
    expect(requests).toEqual([
      {
        path: `session/${SESSION_ID}/config`,
        query: { directory: DIRECTORY },
        method: "GET",
        body: undefined,
        headers: undefined,
        signal: undefined,
        timeoutMilliseconds: undefined,
        responseKind: "json",
      },
    ])
  })

  test("persists a Task selection through its root Session config", async () => {
    const requests: TransportRequest[] = []
    setAppStore({ connected: true, composerModel: "provider/session-a" })
    setBoardStore({
      selectedSource: { kind: "task", id: TASK_ID, directory: DIRECTORY },
      board: {
        task: {
          id: TASK_ID,
          sessionID: SESSION_ID,
          directory: DIRECTORY,
        },
      },
    })
    __setHostTransportForTest(fakeTransport(requests, "provider/session-b"))

    await selectComposerModel("provider/session-b")

    expect(appStore.composerModel).toBe("provider/session-b")
    expect(requests).toEqual([
      {
        path: `session/${SESSION_ID}/config`,
        query: { directory: DIRECTORY },
        method: "PATCH",
        body: {
          kind: "json",
          value: { model: "provider/session-b" },
        },
        headers: { "Content-Type": "application/json" },
        signal: undefined,
        timeoutMilliseconds: undefined,
        responseKind: "json",
      },
    ])
  })

  test("keeps a New Chat model in the draft projection", async () => {
    const requests: TransportRequest[] = []
    setAppStore({ connected: true, composerModel: "" })
    __setHostTransportForTest(fakeTransport(requests, "provider/draft"))

    await selectComposerModel("provider/draft")

    expect(appStore.composerModel).toBe("provider/draft")
    expect(requests).toEqual([])
  })
})
