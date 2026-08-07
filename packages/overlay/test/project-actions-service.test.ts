import { afterEach, beforeEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { promoteAnonymousProject, renameProjectRecord } from "../src/services/workspace"

const PROJECT_DIRECTORY = "D:/workspace/opencorvus"

function transport(body: unknown, capture: (request: TransportRequest) => void): HostTransport {
  return {
    kind: "tauri",
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      capture(request)
      return { status: 200, ok: true, headers: {}, body: body as T }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

beforeEach(() => {
  configure({ serverUrl: "http://127.0.0.1:7878", directory: "" })
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})

test("renameProjectRecord uses the canonical directory-scoped PATCH contract", async () => {
  let captured: TransportRequest | undefined
  __setHostTransportForTest(
    transport(
      { id: "project_123", worktree: PROJECT_DIRECTORY, name: "OpenCorvus" },
      (request) => (captured = request),
    ),
  )

  const result = await renameProjectRecord(` ${PROJECT_DIRECTORY} `, " OpenCorvus ")

  expect(result).toEqual({ id: "project_123", worktree: PROJECT_DIRECTORY, name: "OpenCorvus" })
  expect(captured?.path).toBe("project/current")
  expect(captured?.method).toBe("PATCH")
  expect(captured?.query?.directory).toBe(PROJECT_DIRECTORY)
  expect(captured?.headers).toEqual({ "Content-Type": "application/json" })
  expect(captured?.body).toEqual({ kind: "json", value: { name: "OpenCorvus" } })
})

test("promoteAnonymousProject preserves the canonical JSON transport contract", async () => {
  const destinationParent = "D:/workspace"
  let captured: TransportRequest | undefined
  __setHostTransportForTest(
    transport(
      {
        project: { id: "project_123", worktree: `${destinationParent}/OpenCorvus`, name: "OpenCorvus" },
        sourceDirectory: PROJECT_DIRECTORY,
        directory: `${destinationParent}/OpenCorvus`,
        cleanupPending: false,
      },
      (request) => (captured = request),
    ),
  )

  await promoteAnonymousProject(` ${PROJECT_DIRECTORY} `, ` ${destinationParent} `, " OpenCorvus ")

  expect(captured?.path).toBe("project/current/promote-anonymous")
  expect(captured?.method).toBe("POST")
  expect(captured?.query?.directory).toBe(PROJECT_DIRECTORY)
  expect(captured?.headers).toEqual({ "Content-Type": "application/json" })
  expect(captured?.body).toEqual({
    kind: "json",
    value: { destinationParent, name: "OpenCorvus" },
  })
})

test("renameProjectRecord rejects missing input before transport", async () => {
  __setHostTransportForTest(transport({}, () => {}))

  await expect(renameProjectRecord("", "OpenCorvus")).rejects.toThrow(
    "renameProjectRecord requires a project directory",
  )
  await expect(renameProjectRecord(PROJECT_DIRECTORY, "  ")).rejects.toThrow(
    "renameProjectRecord requires a project name",
  )
})

test("renameProjectRecord rejects malformed backend responses", async () => {
  __setHostTransportForTest(
    transport({ id: "project_123", worktree: PROJECT_DIRECTORY }, () => {}),
  )

  await expect(renameProjectRecord(PROJECT_DIRECTORY, "OpenCorvus")).rejects.toThrow(
    "PATCH project/current returned an invalid ProjectRenameResult",
  )
})
