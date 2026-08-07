import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { ApiError, configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { ZIP_ARCHIVE_DOWNLOAD_TIMEOUT_MILLISECONDS } from "../src/services/project-archive"
import { downloadTaskProjectArchive } from "../src/services/task"
import { downloadMissionProjectArchive } from "../src/services/mission"
import { downloadLogSupportBundle } from "../src/services/log-export"

type AnchorRecord = { href: string; download: string; rel: string; clicked: boolean }

const originalDocument = globalThis.document
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

let requests: TransportRequest[]
let anchors: AnchorRecord[]

function fakeTransport(response: TransportResponse<Uint8Array>): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(req)
      return response as TransportResponse<T>
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  } as HostTransport
}

function installDownloadDom() {
  const documentStub = {
    body: {
      appendChild(anchor: AnchorRecord) {
        anchors.push(anchor)
      },
    },
    createElement(tag: string) {
      if (tag !== "a") throw new Error(`unexpected element: ${tag}`)
      const anchor: AnchorRecord & { click: () => void; remove: () => void } = {
        href: "",
        download: "",
        rel: "",
        clicked: false,
        click() {
          this.clicked = true
        },
        remove() {},
      }
      return anchor
    },
  }
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentStub,
  })
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:task-project-archive",
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => {},
  })
}

beforeEach(() => {
  requests = []
  anchors = []
  configure({ directory: "/repo/project" })
  installDownloadDom()
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument,
  })
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  })
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: originalRevokeObjectURL,
  })
})

describe("downloadTaskProjectArchive", () => {
  test("requests a binary task project archive and downloads the server filename", async () => {
    __setHostTransportForTest(
      fakeTransport({
        status: 200,
        ok: true,
        headers: { "content-disposition": 'attachment; filename="task-123-project.zip"' },
        body: new Uint8Array([80, 75, 3, 4]),
      }),
    )

    await expect(downloadTaskProjectArchive({ taskID: "task-123", directory: "/repo/project" })).resolves.toBe(true)

    expect(requests).toHaveLength(1)
    expect(requests[0]!.path).toBe("task/task-123/project-archive")
    expect(requests[0]!.query?.directory).toBe("/repo/project")
    expect(requests[0]!.responseKind).toBe("binary")
    expect(requests[0]!.timeoutMilliseconds).toBe(ZIP_ARCHIVE_DOWNLOAD_TIMEOUT_MILLISECONDS)
    expect(anchors).toHaveLength(1)
    expect(anchors[0]!.href).toBe("blob:task-project-archive")
    expect(anchors[0]!.download).toBe("task-123-project.zip")
    expect(anchors[0]!.rel).toBe("noopener")
    expect(anchors[0]!.clicked).toBe(true)
  })

  test("propagates server errors so the caller can show status and body details", async () => {
    __setHostTransportForTest(
      fakeTransport({
        status: 422,
        ok: false,
        headers: {},
        body: new TextEncoder().encode(JSON.stringify({ message: "not a Git worktree" })),
      }),
    )

    let caught: unknown
    try {
      await downloadTaskProjectArchive({ taskID: "task-123", directory: "/repo/project" })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect((caught as ApiError).status).toBe(422)
    expect((caught as ApiError).path).toBe("task/task-123/project-archive?directory=%2Frepo%2Fproject")
    expect((caught as ApiError).body).toEqual({ message: "not a Git worktree" })
    expect(anchors).toHaveLength(0)
  })

  test("rejects successful archive responses that omit the server filename", async () => {
    __setHostTransportForTest(
      fakeTransport({
        status: 200,
        ok: true,
        headers: {},
        body: new Uint8Array([80, 75, 3, 4]),
      }),
    )

    await expect(downloadTaskProjectArchive({ taskID: "task-123", directory: "/repo/project" })).rejects.toThrow(
      "missing a Content-Disposition filename",
    )

    expect(requests).toHaveLength(1)
    expect(requests[0]!.responseKind).toBe("binary")
    expect(anchors).toHaveLength(0)
  })
})

describe("downloadMissionProjectArchive", () => {
  test("requests a binary Mission project archive with the Mission row directory", async () => {
    __setHostTransportForTest(
      fakeTransport({
        status: 200,
        ok: true,
        headers: { "content-disposition": 'attachment; filename="mission-123-project.zip"' },
        body: new Uint8Array([80, 75, 3, 4]),
      }),
    )

    await expect(downloadMissionProjectArchive({ missionID: "mission-123", directory: "D:/repo" })).resolves.toBe(true)

    expect(requests).toHaveLength(1)
    expect(requests[0]!.path).toBe("mission/mission-123/project-archive")
    expect(requests[0]!.query?.directory).toBe("D:/repo")
    expect(requests[0]!.responseKind).toBe("binary")
    expect(requests[0]!.timeoutMilliseconds).toBe(ZIP_ARCHIVE_DOWNLOAD_TIMEOUT_MILLISECONDS)
    expect(anchors).toHaveLength(1)
    expect(anchors[0]!.download).toBe("mission-123-project.zip")
    expect(anchors[0]!.clicked).toBe(true)
  })
})

describe("downloadLogSupportBundle", () => {
  test("downloads the global log archive without project-directory injection", async () => {
    __setHostTransportForTest(
      fakeTransport({
        status: 200,
        ok: true,
        headers: { "content-disposition": 'attachment; filename="opencorvus-log-support-20260726T123456Z.zip"' },
        body: new Uint8Array([80, 75, 3, 4]),
      }),
    )

    await expect(downloadLogSupportBundle()).resolves.toBe(true)

    expect(requests).toHaveLength(1)
    expect(requests[0]!.path).toBe("log/export")
    expect(requests[0]!.query?.directory).toBeUndefined()
    expect(requests[0]!.responseKind).toBe("binary")
    expect(requests[0]!.timeoutMilliseconds).toBe(ZIP_ARCHIVE_DOWNLOAD_TIMEOUT_MILLISECONDS)
    expect(anchors).toHaveLength(1)
    expect(anchors[0]!.download).toBe("opencorvus-log-support-20260726T123456Z.zip")
    expect(anchors[0]!.clicked).toBe(true)
  })
})
