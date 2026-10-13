import { expect, test } from "bun:test"
import { ApiError } from "../src/services/api"
import {
  collectFileRefreshReceipts,
  type FileRefreshState,
  type FileRefreshTarget,
} from "../src/services/file-workbench"

function pendingRead() {
  let resolve!: (state: FileRefreshState) => void
  let reject!: (error: unknown) => void
  const result = new Promise<FileRefreshState>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { result, resolve, reject }
}

test("a failed directory and a later search both settle before the collected result", async () => {
  const events: string[] = []
  const directory = pendingRead()
  const search = pendingRead()
  const error = new ApiError(
    500,
    "file?path=source",
    { name: "UnknownError", data: { message: "directory read failed" } },
    { "x-opencorvus-request-id": "directory-500" },
    "GET",
  )
  const loaded: FileRefreshState = { status: "loaded" }
  const result = collectFileRefreshReceipts([
    {
      target: { kind: "directory", path: "source" },
      result: directory.result.catch((cause) => {
        events.push("directory failed")
        throw cause
      }),
    },
    {
      target: { kind: "search", query: "report" },
      result: search.result.then((state) => {
        events.push("search loaded")
        return state
      }),
    },
  ]).then((receipts) => {
    events.push("collected")
    return receipts
  })
  directory.reject(error)
  await Promise.resolve()
  search.resolve(loaded)
  expect(await result).toEqual([
    { target: { kind: "directory", path: "source" }, state: { status: "failed", error } },
    { target: { kind: "search", query: "report" }, state: loaded },
  ])
  expect(events).toEqual(["directory failed", "search loaded", "collected"])
})

test("reverse completion preserves input target order and original state identity", async () => {
  const first = pendingRead()
  const second = pendingRead()
  const firstTarget: FileRefreshTarget = { kind: "directory", path: "../目标" }
  const secondTarget: FileRefreshTarget = { kind: "search", query: "資料" }
  const firstState: FileRefreshState = { status: "loaded" }
  const secondState: FileRefreshState = { status: "retired", reason: "not-started" }
  const result = collectFileRefreshReceipts([
    { target: firstTarget, result: first.result },
    { target: secondTarget, result: second.result },
  ])
  second.resolve(secondState)
  first.resolve(firstState)
  const receipts = await result
  expect(receipts.map((receipt) => receipt.target)).toEqual([firstTarget, secondTarget])
  expect(receipts[0]!.target).toBe(firstTarget)
  expect(receipts[0]!.state).toBe(firstState)
  expect(receipts[1]!.target).toBe(secondTarget)
  expect(receipts[1]!.state).toBe(secondState)
})

test("every original rejection retains its API identity and an undefined thrown cause", async () => {
  const first = new ApiError(
    404,
    "file?path=first",
    { name: "FileNotFoundError", data: { path: "first" } },
    { "x-opencorvus-request-id": "first-404" },
    "GET",
  )
  const second = new ApiError(
    500,
    "find/file?query=second",
    { name: "UnknownError", data: { message: "scan failed" } },
    { "x-opencorvus-request-id": "second-500" },
    "GET",
  )
  const receipts = await collectFileRefreshReceipts([
    { target: { kind: "directory", path: "first" }, result: Promise.reject(first) },
    { target: { kind: "search", query: "second" }, result: Promise.reject(second) },
    { target: { kind: "directory", path: "third" }, result: Promise.reject(undefined) },
  ])
  expect(receipts.map((receipt) => receipt.state)).toEqual([
    { status: "failed", error: first },
    { status: "failed", error: second },
    { status: "failed", error: undefined },
  ])
  const errors = receipts.map((receipt) => (receipt.state.status === "failed" ? receipt.state.error : receipt.state))
  expect(errors[0]).toBe(first)
  expect(errors[1]).toBe(second)
  expect(first).toMatchObject({
    status: 404,
    requestID: "first-404",
    body: { name: "FileNotFoundError", data: { path: "first" } },
  })
  expect(second).toMatchObject({
    status: 500,
    requestID: "second-500",
    body: { name: "UnknownError", data: { message: "scan failed" } },
  })
})

test("retirement reasons and observed failure remain explicit original facts", async () => {
  const error = new Error("original retired read")
  const states: FileRefreshState[] = [
    { status: "retired", reason: "scope" },
    { status: "retired", reason: "superseded", observedFailure: { error } },
    { status: "retired", reason: "not-started" },
    { status: "retired", reason: "superseded", observedFailure: { error: undefined } },
  ]
  const receipts = await collectFileRefreshReceipts(
    states.map((state, index) => ({
      target: { kind: "directory" as const, path: `read-${index}` },
      result: Promise.resolve(state),
    })),
  )
  expect(receipts.map((receipt) => receipt.state)).toEqual(states)
  for (let index = 0; index < states.length; index += 1) expect(receipts[index]!.state).toBe(states[index])
})

test("independent refresh groups retain their own completed targets", async () => {
  const first = pendingRead()
  const second = pendingRead()
  const a = collectFileRefreshReceipts([{ target: { kind: "directory", path: "project-a" }, result: first.result }])
  const b = collectFileRefreshReceipts([{ target: { kind: "directory", path: "project-b" }, result: second.result }])
  second.resolve({ status: "loaded" })
  expect(await b).toEqual([{ target: { kind: "directory", path: "project-b" }, state: { status: "loaded" } }])
  first.resolve({ status: "retired", reason: "scope" })
  expect(await a).toEqual([
    { target: { kind: "directory", path: "project-a" }, state: { status: "retired", reason: "scope" } },
  ])
})

test("a group with no requested reads has an empty receipt list", async () => {
  expect(await collectFileRefreshReceipts([])).toEqual([])
})
