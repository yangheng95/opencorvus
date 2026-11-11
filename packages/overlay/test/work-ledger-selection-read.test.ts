import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiError, captureApiAuthority, configure } from "../src/services/api"
import { readWorkLedgerSelection } from "../src/services/work-ledger"

const directory = "D:/projects/selection"
const row = {
  kind: "chat",
  experience: "chat",
  id: "ses_selection",
  sessionID: "ses_selection",
  title: "Previously loaded title",
  directory,
  created: 1,
  started: 1,
  updated: 2,
  pinned: false,
  status: "idle",
}

let status: number
let title: string
let server: ReturnType<typeof Bun.serve>

beforeEach(() => {
  status = 200
  title = row.title
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      const body = status === 200 ? { ...row, title } : { message: "Selection could not be read" }
      return Response.json(body, { status, headers: { "x-opencorvus-request-id": "selection-read" } })
    },
  })
  configure({ serverUrl: server.url.origin })
})

afterEach(async () => {
  await server.stop(true)
  configure({ serverUrl: "http://127.0.0.1:7878" })
})

function selectionTarget() {
  return { kind: "session" as const, id: row.id, directory, key: "selected-session", authority: captureApiAuthority() }
}

test("a temporary same-owner failure retains the last read and a successful retry accepts the latest row", async () => {
  const target = selectionTarget()
  const first = await readWorkLedgerSelection(target, undefined)
  expect(first).toEqual({ kind: "current", key: target.key, row })

  status = 503
  const failure = await readWorkLedgerSelection(target, first)
  expect(failure).toEqual({ kind: "unavailable", key: target.key, row, cause: expect.any(ApiError) })
  if (failure.kind !== "unavailable") throw new Error("Expected an unavailable selection")
  expect(failure.cause).toMatchObject({ status: 503, requestID: "selection-read" })

  status = 200
  title = "Latest selected title"
  expect(await readWorkLedgerSelection(target, failure)).toEqual({
    kind: "current",
    key: target.key,
    row: { ...row, title },
  })
})

test("a cold read failure for a different owner reports its own unavailable state", async () => {
  const target = selectionTarget()
  const previous = await readWorkLedgerSelection(target, undefined)
  status = 503
  expect(await readWorkLedgerSelection({
    ...target, id: "ses_other", directory: "D:/projects/other", key: "other-selection",
  }, previous)).toEqual({
    kind: "unavailable",
    key: "other-selection",
    row: null,
    cause: expect.any(ApiError),
  })
})

test("an explicit owner rejection reports its public error and an unavailable selection", async () => {
  const target = selectionTarget()
  const previous = await readWorkLedgerSelection(target, undefined)
  status = 404
  const result = await readWorkLedgerSelection(target, previous)
  expect(result).toMatchObject({
    kind: "unavailable",
    key: target.key,
    row: null,
    cause: { status: 404, requestID: "selection-read" },
  })
})
