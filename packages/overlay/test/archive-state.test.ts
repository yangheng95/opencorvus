import { expect, test } from "bun:test"
import { ApiError, captureApiAuthority, configure } from "../src/services/api"
import { ArchiveStateUnconfirmedError, settleArchiveState } from "../src/services/archive-state"
import { setMissionArchived } from "../src/services/mission"
import { verifyWorkLedgerArchiveState } from "../src/services/work-ledger"
import { formatErrorDetails } from "../src/utils/error-details"

const directory = "D:/projects/one/archive-receipt"
const taskID = "task_original"
const restoredTask = {
  kind: "task",
  id: taskID,
  title: "Retain original Task",
  description: "Read original Task after archive restore",
  directory,
  created: 1,
  started: 2,
  completed: 3,
  updated: 5,
  pinned: false,
  lifecycleStatus: "cancelled",
  cancellationStatus: "cancelled",
  activityStatus: "inactive",
  priority: "normal",
  source: "user",
  productPillar: "work",
  pendingInteractions: 0,
}

test("an intact restore receipt supplies the original server result", async () => {
  const receipt = { session: { id: "ses_original", title: "Keep the original conversation" } }
  expect(await settleArchiveState({
    authority: captureApiAuthority(),
    write: async () => receipt,
    verify: async () => ({ session: { id: "ses_other", title: "Other conversation" } }),
  })).toBe(receipt)
})

test.each([true, false])("an interrupted Task archive=%s confirms the original Task through its exact project reader", async (archived) => {
  const requests: Array<{ path: string; directory: string | null }> = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      requests.push({ path: url.pathname, directory: url.searchParams.get("directory") })
      return Response.json(archived ? { ...restoredTask, archived: 4 } : restoredTask)
    },
  })
  configure({ serverUrl: server.url.origin })
  try {
    const authority = captureApiAuthority()
    const verified = await settleArchiveState({
      authority,
      write: async () => { throw new TypeError("Interrupted response body") },
      verify: () => verifyWorkLedgerArchiveState({ kind: "task", taskID, directory, authority, archived }),
    })
    expect(verified).toBeUndefined()
    expect(requests).toEqual([{ path: "/work-ledger/selection/task/task_original", directory }])
  } finally {
    await server.stop(true)
    configure({ serverUrl: "http://127.0.0.1:7878" })
  }
})

test("a malformed Mission archive receipt settles from the original persisted Mission", async () => {
  const missionID = "draft-original"
  const sessionID = "ses_original"
  const operations: Array<{ method: string; path: string; directory: string | null; body?: unknown }> = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      const { method } = request
      operations.push({
        method,
        path: url.pathname,
        directory: url.searchParams.get("directory"),
        ...(method === "PATCH" ? { body: await request.json() } : {}),
      })
      if (method === "PATCH") return Response.json({ missionID, sessionID: "ses_other", directory, archived: 4 })
      return Response.json({
        kind: "mission", id: missionID, missionID, sessionID, directory, title: "Original Mission",
        pendingPromptText: "Retain the original request", productPillar: "work", created: 1, started: 1,
        updated: 4, archived: 4, pinned: false, interruptible: false, outcome: null, pendingInteractions: 0,
        tasks: [], taskStats: { total: 0, running: 0, inactive: 0 },
      })
    },
  })
  configure({ serverUrl: server.url.origin })
  try {
    const provenance = { surface: "overlay.work_ledger", reason: "Operator archived the selected Mission" }
    expect(await setMissionArchived({ missionID, sessionID, directory }, true, provenance)).toBeUndefined()
    expect(operations).toEqual([
      { method: "PATCH", path: `/mission/${missionID}/archive`, directory, body: { archived: true, ...provenance } },
      { method: "GET", path: `/work-ledger/selection/session/${sessionID}`, directory },
    ])
  } finally {
    await server.stop(true)
    configure({ serverUrl: "http://127.0.0.1:7878" })
  }
})

test("an unavailable verification preserves both the write and exact read diagnostics", async () => {
  const receipt = new TypeError("Interrupted response body")
  const verification = new ApiError(404, "work-ledger/selection/session/ses_original", { name: "NotFoundError" }, {
    "x-opencorvus-request-id": "restore-verification",
  }, "GET")
  const error = await settleArchiveState({
    authority: captureApiAuthority(),
    write: async () => { throw receipt },
    verify: async () => { throw verification },
  }).catch((cause) => cause)
  expect(error).toBeInstanceOf(ArchiveStateUnconfirmedError)
  expect(error.errors).toEqual([receipt, verification])
  expect(formatErrorDetails(error)).toMatch(/Interrupted response body[\s\S]+HTTP GET 404[\s\S]+Request ID: restore-verification/)
})

test("a definitive restore conflict preserves the server error contract", async () => {
  const conflict = new ApiError(409, "mission/mission_original/archive", { name: "MissionArchiveConflictError" }, {
    "x-opencorvus-request-id": "restore-conflict",
  }, "PATCH")
  const error = await settleArchiveState({
    authority: captureApiAuthority(),
    write: async () => { throw conflict },
    verify: async () => true,
  }).catch((cause) => cause)
  expect(error).toBe(conflict)
  expect(error).toMatchObject({ status: 409, method: "PATCH", requestID: "restore-conflict" })
})
