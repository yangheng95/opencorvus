import { afterEach, describe, expect, test } from "bun:test"
import {
  captureComposerFile,
  uploadComposerDataUrl,
  uploadComposerBytes,
  uploadComposerDirectoryReference,
} from "../src/services/attachment-upload"
import { setProjectDirectoryContext } from "../src/services/project-directory"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"

const DIRECTORY = "D:/repo"
const REFERENCE = {
  sha: "a".repeat(64),
  url: `/attachment/project-alpha/${"a".repeat(64)}.bin`,
  mime: "application/octet-stream",
  size: 0,
  filename: "payload.bin",
}

function recordingTransport(requests: TransportRequest[]): HostTransport {
  return {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(input: TransportRequest) {
      requests.push(input)
      const body = input.body?.kind === "binary" ? input.body.value : new Uint8Array()
      return {
        status: 200,
        ok: true,
        headers: {},
        body: { ...REFERENCE, size: body.byteLength, filename: String(input.query?.filename) } as T,
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
  setProjectDirectoryContext("", false)
})

describe("composer attachment upload", () => {
  test("uploads a file as raw binary and returns only the canonical reference", async () => {
    const requests: TransportRequest[] = []
    setProjectDirectoryContext(DIRECTORY, false)
    __setHostTransportForTest(recordingTransport(requests))
    const file = new File([new Uint8Array([0, 1, 2, 3])], "payload.bin", {
      type: "application/octet-stream",
    })

    const captured = await captureComposerFile(file)
    const reference = await uploadComposerBytes({ ...captured, filename: file.name, directory: DIRECTORY })

    expect(reference.url).toStartWith("/attachment/project-alpha/")
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      path: "attachment",
      method: "POST",
      query: { directory: DIRECTORY, filename: "payload.bin" },
      headers: { "Content-Type": "application/octet-stream" },
      timeoutMilliseconds: null,
    })
    expect(requests[0]?.body).toEqual({ kind: "binary", value: new Uint8Array([0, 1, 2, 3]) })
  })

  test("uploads captured clipboard bytes after the transient source lifetime ends", async () => {
    const requests: TransportRequest[] = []
    setProjectDirectoryContext(DIRECTORY, false)
    __setHostTransportForTest(recordingTransport(requests))
    let readable = true
    const clipboardFile = {
      type: "image/png",
      async arrayBuffer() {
        if (!readable) throw new Error("clipboard item expired")
        return new Uint8Array([137, 80, 78, 71]).buffer
      },
    } as File

    const captured = await captureComposerFile(clipboardFile)
    readable = false
    const reference = await uploadComposerBytes({
      ...captured,
      filename: "image.png",
      directory: DIRECTORY,
    })

    expect(reference).toMatchObject({ mime: "application/octet-stream", size: 4, filename: "image.png" })
    expect(requests[0]).toMatchObject({
      path: "attachment",
      headers: { "Content-Type": "image/png" },
      body: { kind: "binary", value: new Uint8Array([137, 80, 78, 71]) },
    })
  })

  test("uploads payloads larger than the retired 10 MiB composer limit", async () => {
    const requests: TransportRequest[] = []
    setProjectDirectoryContext(DIRECTORY, false)
    __setHostTransportForTest(recordingTransport(requests))
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1)
    bytes[bytes.length - 1] = 7

    const reference = await uploadComposerDataUrl({
      dataUrl: `data:application/octet-stream;base64,${Buffer.from(bytes).toString("base64")}`,
      mime: "application/octet-stream",
      filename: "large.bin",
      directory: DIRECTORY,
    })

    expect(reference.size).toBe(bytes.byteLength)
    expect(requests[0]?.body).toMatchObject({ kind: "binary" })
    expect((requests[0]?.body as { kind: "binary"; value: Uint8Array }).value.byteLength).toBe(bytes.byteLength)
  })

  test("creates one directory reference request without reading child files", async () => {
    const requests: TransportRequest[] = []
    setProjectDirectoryContext(DIRECTORY, false)
    const transport = recordingTransport(requests)
    transport.request = async <T>(input: TransportRequest) => {
      requests.push(input)
      return {
        status: 200,
        ok: true,
        headers: {},
        body: {
          ...REFERENCE,
          kind: "folder",
          path: "D:/repo/design-system",
          filename: "design-system",
          mime: "application/vnd.opencorvus.directory-reference+json",
        } as T,
      }
    }
    __setHostTransportForTest(transport)

    const reference = await uploadComposerDirectoryReference("D:/repo/design-system", DIRECTORY)

    expect(reference.kind).toBe("folder")
    expect(reference.filename).toBe("design-system")
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      path: "attachment/directory-reference",
      method: "POST",
      query: { directory: DIRECTORY },
      headers: { "Content-Type": "application/json" },
      body: { kind: "json", value: { path: "D:/repo/design-system" } },
    })
  })
})
