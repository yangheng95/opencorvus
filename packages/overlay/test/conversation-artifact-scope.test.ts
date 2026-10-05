import { afterEach, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { loadConversationArtifactContent } from "../src/services/conversation-artifact"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { createTauriTransport } from "../src/services/tauri-transport"
import { setBoardStore } from "../src/store/board"
import { applySettings, DEFAULT_SETTINGS, setSettingsStore } from "../src/store/settings"

afterEach(() => {
  __setHostTransportForTest(undefined)
  applySettings({ ...DEFAULT_SETTINGS })
  setBoardStore({ selectedSource: null, board: null })
})

test("all exact resource chunks retain the initial directory while the selected project changes", async () => {
  setSettingsStore("directory", "D:/delivery")
  const text = "first\nsecond"
  const sha256 = createHash("sha256").update(text).digest("hex")
  const requests: TransportRequest[] = []
  __setHostTransportForTest({
    ...createTauriTransport("browser"),
    kind: "browser",
    async request(request) {
      requests.push(request)
      const first = requests.length === 1
      setSettingsStore("directory", "D:/other-project")
      return {
        ok: true,
        status: 206,
        headers: {
          "content-type": "text/plain",
          "content-disposition": "inline",
          etag: `"sha256:${sha256}"`,
          "content-range": first ? "bytes 0-5/12" : "bytes 6-11/12",
        },
        body: new TextEncoder().encode(first ? "first\n" : "second"),
      }
    },
  } as HostTransport)
  const locator = { source: "task_artifact_resource", ref: { path: "report.txt" } }
  expect(await loadConversationArtifactContent({ taskID: "tsk_delivery", locator })).toEqual({
    locator,
    mediaType: "text/plain",
    sha256,
    totalBytes: 12,
    text,
  })
  expect(requests.map((request) => request.query)).toEqual([{ directory: "D:/delivery" }, { directory: "D:/delivery" }])
})
