import { expect, test } from "bun:test"
import { inProcessRunClientOptions } from "../../src/cli/cmd/run-client"

test("in-process Run client carries the selected project directory", () => {
  const fetch = (async () => new Response()) as typeof globalThis.fetch
  const directory = "C:\\projects\\report-quality-e2e"

  expect(inProcessRunClientOptions(directory, fetch)).toEqual({
    baseUrl: "http://opencorvus.internal",
    directory,
    fetch,
  })
})
