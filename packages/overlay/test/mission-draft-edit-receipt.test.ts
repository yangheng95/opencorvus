import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiError, configure } from "../src/services/api"
import { editMissionDraft, MissionDraftEditUnconfirmedError } from "../src/services/mission"

const target = {
  missionID: "draft-owned",
  sessionID: "ses_owned",
  directory: "D:/projects/owned",
  request: "Keep the exact revised request.",
  expectedRequest: "Keep the original request.",
}
const selectedRow = {
  kind: "mission",
  id: target.missionID,
  missionID: target.missionID,
  sessionID: target.sessionID,
  directory: target.directory,
  title: "Original draft identity",
  pendingPromptText: target.request,
  created: 1,
  started: 1,
  updated: 2,
  pinned: false,
  interruptible: false,
  outcome: null,
  productPillar: "work",
  taskStats: { total: 0, running: 0, inactive: 0 },
  pendingInteractions: 0,
  tasks: [],
}
const conflict = {
  name: "MissionDraftEditConflictError",
  data: { missionID: target.missionID, sessionID: target.sessionID, reason: "changed" },
}

let receiptStatus: number
let pendingPromptText: string
let server: ReturnType<typeof Bun.serve>
let operations: Array<{ method: string; path: string; directory: string | null; body?: unknown }>

beforeEach(() => {
  receiptStatus = 503
  pendingPromptText = target.request
  operations = []
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      operations.push({
        method: request.method,
        path: url.pathname,
        directory: url.searchParams.get("directory"),
        ...(request.method === "PATCH" ? { body: await request.json() } : {}),
      })
      if (request.method === "PATCH") {
        return Response.json(receiptStatus === 409 ? conflict : { message: "Receipt interrupted" }, {
          status: receiptStatus, headers: { "x-opencorvus-request-id": "draft-edit" },
        })
      }
      return Response.json({ ...selectedRow, pendingPromptText })
    },
  })
  configure({ serverUrl: server.url.origin })
})

afterEach(async () => {
  await server.stop(true)
  configure({ serverUrl: "http://127.0.0.1:7878" })
})

test("an uncertain draft edit receipt settles from its exact persisted Mission request", async () => {
  expect(await editMissionDraft(target)).toBeUndefined()
  expect(operations).toEqual([
    {
      method: "PATCH", path: "/mission/draft-owned/draft", directory: target.directory,
      body: { request: target.request, expectedRequest: target.expectedRequest },
    },
    { method: "GET", path: "/work-ledger/selection/session/ses_owned", directory: target.directory },
  ])
})

test("a changed persisted draft yields an unconfirmed result with both causes", async () => {
  pendingPromptText = "Another editor saved this request."
  const error = await editMissionDraft(target).catch((cause) => cause)
  expect(error).toBeInstanceOf(MissionDraftEditUnconfirmedError)
  expect(error.errors).toEqual([
    expect.objectContaining({ status: 503, requestID: "draft-edit" }),
    expect.objectContaining({ message: "The current Mission draft does not contain the submitted request." }),
  ])
})

test("a definitive draft edit conflict preserves the server contract", async () => {
  receiptStatus = 409
  const error = await editMissionDraft(target).catch((cause) => cause)
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status: 409, requestID: "draft-edit", body: conflict })
})
