import { afterEach, beforeEach, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import {
  deleteProjectWorktree,
  deleteProjectWorktrees,
  loadProjectWorktrees,
  ProjectWorktreeBulkDeleteError,
  PROJECT_WORKTREE_DELETE_TIMEOUT_MILLISECONDS,
} from "../src/services/worktree"

const SAVED_DIRECTORY = "D:/workspace/app"
const WORKTREE_DIRECTORY = "D:/workspace/app/.opencorvus/.r/w/goal-a/worktree"
const OLD_WORKTREE_DIRECTORY = "D:/workspace/app/.opencorvus/.r/w/old/worktree"

function transport(body: unknown, capture: (req: TransportRequest) => void): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      capture(req)
      return {
        status: 200,
        ok: true,
        headers: {},
        body: body as T,
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

beforeEach(() => {
  configure({ serverUrl: "http://127.0.0.1:7878", directory: SAVED_DIRECTORY })
})

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})

test("loadProjectWorktrees reads the project worktree route with directory context", async () => {
  let captured: TransportRequest | undefined
  __setHostTransportForTest(
    transport(
      [
        {
          name: "goal-a",
          branch: "opencorvus/goal-a",
          directory: WORKTREE_DIRECTORY,
          status: "managed",
          removable: true,
        },
      ],
      (req) => {
        captured = req
      },
    ),
  )

  const items = await loadProjectWorktrees(SAVED_DIRECTORY)

  expect(captured?.path).toBe("project/current/worktrees")
  expect(captured?.method).toBe("GET")
  expect(captured?.query?.directory).toBe(SAVED_DIRECTORY)
  expect(items).toEqual([
    {
      name: "goal-a",
      branch: "opencorvus/goal-a",
      directory: WORKTREE_DIRECTORY,
      status: "managed",
      removable: true,
    },
  ])
})

test("deleteProjectWorktree sends the target directory in the DELETE JSON body", async () => {
  let captured: TransportRequest | undefined
  __setHostTransportForTest(
    transport({ ok: true }, (req) => {
      captured = req
    }),
  )

  const ok = await deleteProjectWorktree(SAVED_DIRECTORY, OLD_WORKTREE_DIRECTORY)

  expect(ok).toBe(true)
  expect(captured?.path).toBe("project/current/worktrees")
  expect(captured?.method).toBe("DELETE")
  expect(captured?.query?.directory).toBe(SAVED_DIRECTORY)
  expect(captured?.timeoutMilliseconds).toBe(PROJECT_WORKTREE_DELETE_TIMEOUT_MILLISECONDS)
  expect(captured?.body).toEqual({
    kind: "json",
    value: {
      directory: OLD_WORKTREE_DIRECTORY,
    },
  })
})

test("deleteProjectWorktrees deletes each target through the same project route", async () => {
  const captured: TransportRequest[] = []
  __setHostTransportForTest(
    transport({ ok: true }, (req) => {
      captured.push(req)
    }),
  )

  const count = await deleteProjectWorktrees(SAVED_DIRECTORY, [OLD_WORKTREE_DIRECTORY, "", WORKTREE_DIRECTORY])

  expect(count).toBe(2)
  expect(captured).toHaveLength(2)
  expect(captured.map((req) => req.path)).toEqual(["project/current/worktrees", "project/current/worktrees"])
  expect(captured.map((req) => req.method)).toEqual(["DELETE", "DELETE"])
  expect(captured.map((req) => req.query?.directory)).toEqual([SAVED_DIRECTORY, SAVED_DIRECTORY])
  expect(captured.map((req) => req.timeoutMilliseconds)).toEqual([
    PROJECT_WORKTREE_DELETE_TIMEOUT_MILLISECONDS,
    PROJECT_WORKTREE_DELETE_TIMEOUT_MILLISECONDS,
  ])
  expect(captured.map((req) => req.body)).toEqual([
    {
      kind: "json",
      value: {
        directory: OLD_WORKTREE_DIRECTORY,
      },
    },
    {
      kind: "json",
      value: {
        directory: WORKTREE_DIRECTORY,
      },
    },
  ])
})

test("deleteProjectWorktrees continues after a target fails and reports aggregate failure", async () => {
  const captured: TransportRequest[] = []
  __setHostTransportForTest({
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      captured.push(req)
      const directory = (req.body?.kind === "json" ? (req.body.value as { directory?: string }).directory : "") ?? ""
      if (directory === OLD_WORKTREE_DIRECTORY) {
        return {
          status: 409,
          ok: false,
          headers: {},
          body: { message: "worktree is locked" } as T,
        }
      }
      return {
        status: 200,
        ok: true,
        headers: {},
        body: { ok: true } as T,
      }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  })

  let thrown: unknown
  try {
    await deleteProjectWorktrees(SAVED_DIRECTORY, [OLD_WORKTREE_DIRECTORY, WORKTREE_DIRECTORY])
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(ProjectWorktreeBulkDeleteError)
  const bulk = thrown as ProjectWorktreeBulkDeleteError
  expect(bulk.deleted).toBe(1)
  expect(bulk.message).toContain("Failed to delete 1 project worktree(s) after deleting 1.")
  expect(bulk.message).toContain("worktree is locked")
  expect(bulk.failures).toEqual([
    {
      directory: OLD_WORKTREE_DIRECTORY,
      error: "API 409 project/current/worktrees?directory=D%3A%2Fworkspace%2Fapp: worktree is locked",
    },
  ])
  expect(captured).toHaveLength(2)
  expect(captured.map((req) => req.body)).toEqual([
    {
      kind: "json",
      value: {
        directory: OLD_WORKTREE_DIRECTORY,
      },
    },
    {
      kind: "json",
      value: {
        directory: WORKTREE_DIRECTORY,
      },
    },
  ])
})

test("loadProjectWorktrees rejects every malformed field instead of silently degrading the contract", async () => {
  for (const malformed of [
    {
      name: "broken",
      directory: "D:/workspace/app/.opencorvus/.r/w/broken/worktree",
      status: "unknown",
      removable: true,
    },
    {
      name: "broken",
      branch: 42,
      directory: "D:/workspace/app/.opencorvus/.r/w/broken/worktree",
      status: "managed",
      removable: true,
    },
    {
      name: "broken",
      directory: "D:/workspace/app/.opencorvus/.r/w/broken/worktree",
      status: "managed",
      removable: "yes",
    },
  ]) {
    __setHostTransportForTest(transport([malformed], () => {}))
    await expect(loadProjectWorktrees(SAVED_DIRECTORY)).rejects.toThrow()
  }
})

test("deleteProjectWorktree requires the canonical success receipt", async () => {
  __setHostTransportForTest(transport({ ok: false }, () => {}))
  await expect(deleteProjectWorktree(SAVED_DIRECTORY, OLD_WORKTREE_DIRECTORY)).rejects.toThrow()
})

test("loadProjectWorktrees carries the explicit project directory when API context is empty", async () => {
  configure({ directory: "" })
  let captured: TransportRequest | undefined
  __setHostTransportForTest(
    transport([], (req) => {
      captured = req
    }),
  )

  await loadProjectWorktrees(SAVED_DIRECTORY)

  expect(captured?.path).toBe("project/current/worktrees")
  expect(captured?.method).toBe("GET")
  expect(captured?.query?.directory).toBe(SAVED_DIRECTORY)
})

test("loadProjectWorktrees rejects empty project directory before transport", async () => {
  __setHostTransportForTest(transport([], () => {}))

  await expect(loadProjectWorktrees("")).rejects.toThrow("project/current/worktrees requires a project directory")
})
