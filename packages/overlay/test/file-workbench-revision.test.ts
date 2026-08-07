import { afterEach, expect, test } from "bun:test"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  createFileItem,
  fileWorkbenchRevision,
} from "../src/services/file-workbench"

afterEach(() => __setHostTransportForTest(undefined))

test("a successful file mutation advances the exact workbench revision", async () => {
  const requests: TransportRequest[] = []
  __setHostTransportForTest({
    kind: "tauri",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return {
        status: 200,
        ok: true,
        headers: {},
        body: {
          name: "notes.md",
          path: "notes.md",
          absolute: "/repo/notes.md",
          type: "file",
          ignored: false,
        } as T,
      }
    },
    openStream() {
      throw new Error("openStream not used in file workbench contract")
    },
    async native() {
      throw new Error("native not used in file workbench contract")
    },
    onUiCommand() {
      return { unsubscribe() {} }
    },
  } as HostTransport)

  const before = fileWorkbenchRevision()
  const created = await createFileItem(
    { path: "notes.md", type: "file", content: "ready" },
    { directory: "/repo" },
  )

  expect(created.path).toBe("notes.md")
  expect(fileWorkbenchRevision()).toBe(before + 1)
  expect(requests).toHaveLength(1)
})
