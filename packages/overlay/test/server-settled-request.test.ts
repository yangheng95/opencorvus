import { expect, test } from "bun:test"
import { serverSettledRequest } from "../src/services/api"

test("serverSettledRequest removes only the wall-clock timeout and preserves caller cancellation", () => {
  const controller = new AbortController()
  const request = serverSettledRequest({
    method: "DELETE",
    headers: { "x-test": "server-settled" },
    signal: controller.signal,
  })

  expect(request.timeoutMilliseconds).toBeNull()
  expect(request.signal).toBe(controller.signal)
  expect(request.method).toBe("DELETE")
  expect(request.headers).toEqual({ "x-test": "server-settled" })
})
