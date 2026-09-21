import { expect, test } from "bun:test"
import { inProcessRunClientOptions, runRequest } from "../../src/cli/cmd/run-client"

test("in-process Run client carries the selected project directory", () => {
  const fetch = (async () => new Response()) as typeof globalThis.fetch
  const directory = "C:\\projects\\report-quality-e2e"

  expect(inProcessRunClientOptions(directory, fetch)).toEqual({
    baseUrl: "http://opencorvus.internal",
    directory,
    fetch,
  })
})

test("run request preserves an HTTP status with an empty server diagnostic", async () => {
  await expect(
    runRequest(
      "session.create",
      Promise.resolve({
        error: { name: "UnknownError", data: { message: "" } },
        response: new Response("", { status: 401, statusText: "Unauthorized" }),
      }),
    ),
  ).rejects.toEqual({
    name: "UnknownError",
    data: { operation: "session.create", statusCode: 401, message: "session.create failed: HTTP 401 Unauthorized" },
  })
})

test("run request returns the accepted session receipt", async () => {
  expect(
    await runRequest("session.create", Promise.resolve({ data: { id: "session" }, response: new Response() })),
  ).toEqual({ id: "session" })
})
