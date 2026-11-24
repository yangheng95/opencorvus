import { expect, test } from "bun:test"
import { ApiError, configure, getServerUrl } from "../src/services/api"
import { logExportOutcome, startLogSupportBundleExport } from "../src/services/log-export"

const errorBody = { name: "UnknownError", data: { message: "Support log could not be read" } }

function logExportError(requestID: string) {
  return Response.json(errorBody, { status: 500, headers: { "x-opencorvus-request-id": requestID } })
}

test("a busy log export converges on the original server receipt", async () => {
  const originalServer = getServerUrl()
  const release = Promise.withResolvers<void>()
  const requests: string[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`)
      await release.promise
      return logExportError("original-log-export")
    },
  })
  configure({ serverUrl: server.url.origin })
  try {
    const exportRequest = startLogSupportBundleExport()
    expect(logExportOutcome()).toEqual({ status: "pending" })
    const repeatedAction = startLogSupportBundleExport()
    release.resolve()
    await Promise.all([exportRequest, repeatedAction])

    expect(requests).toEqual(["GET /log/export"])
    expect(logExportOutcome()).toEqual({ status: "failed", error: expect.any(ApiError) })
    expect(logExportOutcome()).toMatchObject({
      error: { path: "log/export", status: 500, body: errorBody, requestID: "original-log-export" },
    })
  } finally {
    release.resolve()
    await server.stop(true)
    configure({ serverUrl: originalServer })
  }
})

test("a new server owns the log export outcome while an older receipt settles", async () => {
  const originalServer = getServerUrl()
  const received = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const previous = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      received.resolve()
      await release.promise
      return logExportError("previous-log-export")
    },
  })
  const current = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => logExportError("current-log-export"),
  })
  try {
    configure({ serverUrl: previous.url.origin })
    const oldRequest = startLogSupportBundleExport()
    await received.promise

    configure({ serverUrl: current.url.origin })
    const newRequest = startLogSupportBundleExport()
    expect(logExportOutcome()).toEqual({ status: "pending" })
    await newRequest
    release.resolve()
    await oldRequest

    expect(logExportOutcome()).toMatchObject({ status: "failed", error: { requestID: "current-log-export" } })
  } finally {
    release.resolve()
    await Promise.all([previous.stop(true), current.stop(true)])
    configure({ serverUrl: originalServer })
  }
})
