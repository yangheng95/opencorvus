import { expect, test } from "bun:test"
import { ApiError, captureApiAuthority, configure } from "../src/services/api"
import { ArchiveRestoreUnconfirmedError, settleArchiveRestore } from "../src/services/archive-restore"
import { verifyWorkLedgerRestore } from "../src/services/work-ledger"
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
  expect(await settleArchiveRestore({
    authority: captureApiAuthority(),
    write: async () => receipt,
    readRestored: async () => ({ session: { id: "ses_other", title: "Other conversation" } }),
  })).toBe(receipt)
})

test("an interrupted Task restore receipt confirms the original Task through its exact project reader", async () => {
  const requests: Array<{ path: string; directory: string | null }> = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      requests.push({ path: url.pathname, directory: url.searchParams.get("directory") })
      return Response.json(restoredTask)
    },
  })
  configure({ serverUrl: server.url.origin })
  try {
    const authority = captureApiAuthority()
    const verified = await settleArchiveRestore({
      authority,
      write: async () => { throw new TypeError("Interrupted response body") },
      readRestored: () => verifyWorkLedgerRestore({ kind: "task", taskID, directory, authority }),
    })
    expect(verified).toBeUndefined()
    expect(requests).toEqual([{ path: "/work-ledger/selection/task/task_original", directory }])
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
  const error = await settleArchiveRestore({
    authority: captureApiAuthority(),
    write: async () => { throw receipt },
    readRestored: async () => { throw verification },
  }).catch((cause) => cause)
  expect(error).toBeInstanceOf(ArchiveRestoreUnconfirmedError)
  expect(error.errors).toEqual([receipt, verification])
  expect(formatErrorDetails(error)).toMatch(/Interrupted response body[\s\S]+HTTP GET 404[\s\S]+Request ID: restore-verification/)
})

test("a definitive restore conflict preserves the server error contract", async () => {
  const conflict = new ApiError(409, "mission/mission_original/archive", { name: "MissionArchiveConflictError" }, {
    "x-opencorvus-request-id": "restore-conflict",
  }, "PATCH")
  const error = await settleArchiveRestore({
    authority: captureApiAuthority(),
    write: async () => { throw conflict },
    readRestored: async () => true,
  }).catch((cause) => cause)
  expect(error).toBe(conflict)
  expect(error).toMatchObject({ status: 409, method: "PATCH", requestID: "restore-conflict" })
})
