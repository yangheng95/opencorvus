import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiError, configure } from "../src/services/api"
import { createTauriTransport } from "../src/services/tauri-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { downloadZipArchive } from "../src/services/project-archive"
import { loadTaskBrowserPreviewEvidenceCaptureObjectUrl } from "../src/services/browser-preview"
import { loadConversationArtifactContent } from "../src/services/conversation-artifact"
import { resolveDiff, type ChangeGroup } from "../src/services/diff"
import { setBoardStore } from "../src/store/board"

const directory = "D:/binary-error-contract"
const taskID = "tsk_binarycontract"
const originalFetch = globalThis.fetch
const groups: ChangeGroup[] = [{
  id: "artifact:art_binary", taskID, artifactID: "art_binary", additions: 1, deletions: 0,
  changes: [{ file: "report.txt", status: "added", additions: 1, deletions: 0, isText: true, beforeObject: null, afterObject: { oid: "blob-report", bytes: 6 } }],
}]

beforeEach(() => {
  configure({ serverUrl: "http://127.0.0.1:7878", directory })
  setBoardStore({ selectedSource: { kind: "task", id: taskID, directory }, board: null, tasks: [] })
  __setHostTransportForTest(createTauriTransport("browser"))
})
afterEach(() => {
  globalThis.fetch = originalFetch
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
  setBoardStore({ selectedSource: null, board: null, tasks: [] })
})

test.each([
  { name: "archive", path: "project/archive", route: "/project/archive", read: () => downloadZipArchive({ path: "project/archive" }) },
  { name: "preview capture", path: "task/tsk_binarycontract/browser-preview/evidence/art_capture/capture.png?directory=D%3A%2Fbinary-error-contract", route: "/task/tsk_binarycontract/browser-preview/evidence/art_capture/capture.png", read: () => loadTaskBrowserPreviewEvidenceCaptureObjectUrl({ taskID, directory, evidenceID: "art_capture" }) },
  { name: "conversation resource", path: "Conversation Artifact read", route: "/task/tsk_binarycontract/artifact-read", read: () => loadConversationArtifactContent({ taskID, locator: { source: "task_artifact_resource", ref: { path: "report.txt" } } }) },
  { name: "build observation", path: "build observation content", route: "/task/tsk_binarycontract/build-observation/art_binary/content", read: () => resolveDiff({ filePath: "report.txt", groupID: "artifact:art_binary" }, groups) },
])("$name projects local Response-fixture transport bytes through ApiError", async ({ path, route, read }) => {
  let actualRoute = ""
  const body = { name: "NotFoundError", data: { message: "原产物不可用" } }
  globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0]) => {
    actualRoute = new URL(String(input)).pathname
    return new Response(new TextEncoder().encode(JSON.stringify(body)), {
      status: 404, headers: { "content-type": "application/json", "x-opencorvus-request-id": "binary-service-response-1" },
    })
  }, { preconnect: originalFetch.preconnect })
  const result = await read().catch((error: unknown) => error)
  expect(result).toBeInstanceOf(ApiError)
  const error = result as ApiError
  expect(actualRoute).toBe(route)
  expect(error.status).toBe(404)
  expect(error.path).toBe(path)
  expect(error.body).toEqual(body)
  expect(error.requestID).toBe("binary-service-response-1")
  expect(error.summary).toBe("API 404: 原产物不可用")
  expect(error.message).toBe(`API 404 ${path}: 原产物不可用`)
})

test("successful binary transport preserves exact bytes and diff content", async () => {
  const bytes = new Uint8Array([0, 255, 1, 128, 13, 10])
  globalThis.fetch = Object.assign(async () => new Response(bytes, { status: 206, headers: { "content-type": "application/octet-stream" } }), { preconnect: originalFetch.preconnect })
  const response = await createTauriTransport("browser").request<Uint8Array>({ path: "global/health", responseKind: "binary" })
  expect(response.status).toBe(206)
  expect(response.body).toBeInstanceOf(Uint8Array)
  expect([...response.body]).toEqual([0, 255, 1, 128, 13, 10])
  globalThis.fetch = Object.assign(async () => new Response(new TextEncoder().encode("report"), { status: 200 }), { preconnect: originalFetch.preconnect })
  const change = await resolveDiff({ filePath: "report.txt", groupID: "artifact:art_binary" }, groups)
  expect(change).toEqual({ ...groups[0]!.changes[0], before: "", after: "report" })
})
