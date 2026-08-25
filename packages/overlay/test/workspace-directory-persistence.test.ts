import { afterAll, afterEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { applyDirectory } from "../src/services/workspace"
import { setSettingsStore, settingsStore } from "../src/store/settings"

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

    await applyDirectory(NEXT_DIRECTORY, { save: true })

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

    await expect(applyDirectory(NEXT_DIRECTORY, { save: true })).rejects.toThrow("settings store is read-only")
    expect(saves).toHaveLength(1)
  })
})
