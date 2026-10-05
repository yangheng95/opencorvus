import { afterAll, afterEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { applyDirectory, beginWorkspaceSelection, setDirectory } from "../src/services/workspace"
import { setSettingsStore, settingsStore } from "../src/store/settings"
import { boardStore, setBoardStore } from "../src/store/board"
import { selectTask } from "../src/services/task"

const NEXT_DIRECTORY = "D:/workspace/next-project"

// Clearing the selected work item resets the conversation projection, which
// schedules its visibility flush on an animation frame. The unit runner has no
// browser frame clock, so supply one that runs the callback on the microtask
// queue for the duration of this file.
const originalRequestAnimationFrame = globalThis.requestAnimationFrame
globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
  queueMicrotask(() => callback(0))
  return 0
}) as typeof requestAnimationFrame

type SaveOutcome = { kind: "confirm" } | { kind: "reject"; error: Error }

function fakeTransport(input: {
  requests: TransportRequest[]
  saves: Record<string, unknown>[]
  save: SaveOutcome
}): HostTransport {
  return {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request(request) {
      input.requests.push(request)
      return { status: 200, ok: true, headers: {}, body: {} }
    },
    openStream() {
      return { close() {} }
    },
    async native(message: { kind: string; payload?: unknown }) {
      if (message.kind !== "settings.save") throw new Error(`unexpected native message ${message.kind}`)
      input.saves.push(message.payload as Record<string, unknown>)
      if (input.save.kind === "reject") throw input.save.error
      return true
    },
  } as unknown as HostTransport
}

describe("active directory persistence", () => {
  afterAll(() => {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame
  })

  afterEach(() => {
    __setHostTransportForTest(undefined)
    configure({ directory: "" })
    setSettingsStore({
      directory: "",
      savedDirectory: "",
      workspaceTaskID: "",
      workspaceDirectory: "",
      initGit: false,
    })
    setBoardStore({ selectedSource: null, board: null, taskSelectionError: null, taskSwitching: false })
  })

  test("switching the active directory persists the switched directory and cleared workspace memory", async () => {
    const requests: TransportRequest[] = []
    const saves: Record<string, unknown>[] = []
    __setHostTransportForTest(fakeTransport({ requests, saves, save: { kind: "confirm" } }))
    setSettingsStore({
      directory: "D:/workspace/previous",
      savedDirectory: "D:/workspace/previous",
      workspaceTaskID: "task_previous",
      workspaceDirectory: "D:/workspace/previous",
      initGit: false,
    })

    await applyDirectory(NEXT_DIRECTORY, { save: true, selectionEpoch: beginWorkspaceSelection() })

    // The persisted snapshot is what a cold start restores: the switched
    // directory, and workspace memory that belongs to no earlier project.
    expect(saves).toHaveLength(1)
    const persisted = saves[0] as { directory?: string; workspaceTaskID?: string; workspaceDirectory?: string }
    expect({
      directory: persisted.directory,
      workspaceTaskID: persisted.workspaceTaskID ?? "",
      workspaceDirectory: persisted.workspaceDirectory ?? "",
    }).toEqual({ directory: NEXT_DIRECTORY, workspaceTaskID: "", workspaceDirectory: "" })
    expect(settingsStore.directory).toBe(NEXT_DIRECTORY)
  })

  test("a rejected settings save fails the directory switch with the host error", async () => {
    const requests: TransportRequest[] = []
    const saves: Record<string, unknown>[] = []
    const error = new Error("settings store is read-only")
    __setHostTransportForTest(fakeTransport({ requests, saves, save: { kind: "reject", error } }))
    setSettingsStore({
      directory: "D:/workspace/previous",
      savedDirectory: "D:/workspace/previous",
      initGit: false,
    })

    await expect(
      applyDirectory(NEXT_DIRECTORY, { save: true, selectionEpoch: beginWorkspaceSelection() }),
    ).rejects.toThrow("settings store is read-only")
    expect(saves).toHaveLength(1)
  })

  test("a late connection result settles the old switch while retaining the newer directory", async () => {
    let release!: () => void
    const connected = new Promise<void>((resolve) => {
      release = resolve
    })
    __setHostTransportForTest({
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request() {
        await connected
        return { status: 200, ok: true, headers: {}, body: {} }
      },
    } as unknown as HostTransport)
    setSettingsStore("directory", "D:/workspace/original")
    const pending = applyDirectory(NEXT_DIRECTORY, { selectionEpoch: beginWorkspaceSelection() })
    beginWorkspaceSelection()
    setSettingsStore("directory", "D:/workspace/newer")
    release()
    expect(await pending).toBe(false)
    expect(settingsStore.directory).toBe("D:/workspace/newer")
  })

  test("a superseded user directory request reports AbortError to its action owner", async () => {
    let release!: () => void
    let entered!: () => void
    const connected = new Promise<void>((resolve) => {
      release = resolve
    })
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    __setHostTransportForTest({
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request() {
        entered()
        await connected
        return { status: 200, ok: true, headers: {}, body: {} }
      },
    } as unknown as HostTransport)
    setSettingsStore("directory", "D:/workspace/original")
    const pending = setDirectory(NEXT_DIRECTORY)
    await started
    beginWorkspaceSelection()
    setSettingsStore("directory", "D:/workspace/newer")
    release()
    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    expect(settingsStore.directory).toBe("D:/workspace/newer")
  })

  test("a new committed epoch takes over an in-flight same-Task hydrate and settles its current failure", async () => {
    __setHostTransportForTest({
      kind: "browser",
      capabilities: HOST_CAPABILITIES.browser,
      async request() {
        return { status: 503, ok: false, headers: {}, body: { message: "Task projection unavailable" } }
      },
    } as unknown as HostTransport)
    setSettingsStore("directory", NEXT_DIRECTORY)
    setBoardStore({
      selectedSource: { kind: "task", id: "task_pending", directory: NEXT_DIRECTORY },
      board: null,
      taskSwitching: true,
    })
    const epoch = beginWorkspaceSelection()
    await expect(selectTask("task_pending", { selectionEpoch: epoch })).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
    })
    expect({
      source: boardStore.selectedSource,
      epoch: boardStore.selectEpoch,
      switching: boardStore.taskSwitching,
      failureTask: boardStore.taskSelectionError?.taskID,
    }).toEqual({
      source: { kind: "task", id: "task_pending", directory: NEXT_DIRECTORY },
      epoch,
      switching: false,
      failureTask: "task_pending",
    })
  })
})
