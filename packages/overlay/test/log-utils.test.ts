import { describe, expect, test } from "bun:test"
import { matchesLogEntrySearch, parseServerLogLine, readServerRequestLog } from "../src/utils/log"

describe("parseServerLogLine", () => {
  test("parses Pino JSONL server records", () => {
    const entry = parseServerLogLine(
      JSON.stringify({
        level: "error",
        time: "2026-06-03T10:00:00.123Z",
        service: "server",
        message: "provider refresh failed",
        logDomain: "session",
        sessionID: "ses_actual",
        data: {
          duration: 1250,
          path: "/provider/refresh",
          status: "failed",
          time: { created: 100, updated: 200 },
          level: "info",
          service: "subject-service",
          error: { type: "ProviderCatalogRefreshError", message: "models.dev unavailable" },
        },
      }),
    )

    expect(entry).toMatchObject({
      level: "error",
      ts: "2026-06-03T10:00:00",
      service: "server",
      message: "provider refresh failed",
      delta: "1.3s",
    })
    expect(entry.fields).toMatchObject({
      service: "server",
      logDomain: "session",
      sessionID: "ses_actual",
      data: {
        duration: 1250,
        path: "/provider/refresh",
        status: "failed",
        time: { created: 100, updated: 200 },
        level: "info",
        service: "subject-service",
        error: { type: "ProviderCatalogRefreshError", message: "models.dev unavailable" },
      },
    })
  })

  test("historic non-string time remains unknown and its original lifecycle details remain visible", () => {
    const raw = JSON.stringify({
      level: "info",
      time: { created: 100, updated: 200 },
      timestamp: "subject-date",
      ts: "subject-ts",
      service: "session",
      message: "created",
      duration: 800,
    })
    expect(parseServerLogLine(raw)).toEqual({
      level: "info",
      ts: "",
      delta: "",
      service: "session",
      message: "created",
      fields: {
        time: { created: 100, updated: 200 },
        timestamp: "subject-date",
        ts: "subject-ts",
        service: "session",
        duration: 800,
      },
      raw,
    })
  })

  test("unparsed diagnostic line is preserved as the actual raw output", () => {
    const raw = "unparsed owned diagnostic output"
    expect(parseServerLogLine(raw)).toEqual({
      level: "info",
      ts: "",
      delta: "",
      service: "",
      message: raw,
      fields: {},
      raw,
    })
  })
})

test("projects the actual HTTP method, path and phase from a structured server request", () => {
  const request = { requestID: "request-a", method: "GET", path: "/file/content" }
  const parse = (data: object) => ({
    ...parseServerLogLine(JSON.stringify({ level: "info", service: "server", message: "request", data })),
    source: "server" as const,
  })
  const started = parse({ ...request, status: "started" })
  const completed = parse({ ...request, status: "completed", statusCode: 404 })
  const failed = parse({ ...request, status: "failed", error: { message: "reader failed" } })
  expect(readServerRequestLog(started)).toEqual({ method: "GET", path: "/file/content", status: "started" })
  expect(readServerRequestLog(completed)).toEqual({ method: "GET", path: "/file/content", status: "completed", statusCode: 404 })
  expect(readServerRequestLog(failed)).toEqual({ method: "GET", path: "/file/content", status: "failed" })
  expect(completed.fields.data).toEqual({ ...request, status: "completed", statusCode: 404 })
})

describe("loaded log literal search", () => {
  const raw =
    '{"level":"warn","time":"2026-10-07T09:11:58.030Z","service":"logger-observation","message":"Subject chronology","data":{"sessionID":"ses_actual","duration":333,"path":"/session?directory=C:/owned"},"retained":"RAW.[token]"}'
  const actual = { ...parseServerLogLine(raw), source: "server" }
  const other = { ...parseServerLogLine('{"level":"info","service":"session","message":"created"}'), source: "server" }
  const selected = [actual, other]

  test("matches actual header, nested values, keys and literal raw punctuation", () => {
    for (const query of [
      "LOGGER-OBSERVATION",
      "subject CHRONOLOGY",
      "09:11:58",
      "0.3s",
      "WARN",
      "ses_actual",
      "duration",
      "333",
      "C:/owned",
      "RAW.[token]",
    ]) {
      expect(selected.filter((entry) => matchesLogEntrySearch(entry, query))).toEqual([actual])
    }
    expect(selected.filter((entry) => matchesLogEntrySearch(entry, "SERVER"))).toEqual(selected)
    expect(actual.raw).toBe(raw)
    expect(actual.fields.data).toEqual({ sessionID: "ses_actual", duration: 333, path: "/session?directory=C:/owned" })
  })

  test("empty query preserves the current level-selected sequence and identities", () => {
    for (const query of ["", "  "]) {
      const result = selected.filter((entry) => matchesLogEntrySearch(entry, query))
      expect(result).toEqual(selected)
      expect(result[0]).toBe(actual)
      expect(result[1]).toBe(other)
    }
    const warnSelected = [actual]
    expect(warnSelected.filter((entry) => matchesLogEntrySearch(entry, "subject"))).toEqual(warnSelected)
  })

  test("finds the same original log by its displayed source and canonical source", () => {
    const rows = [
      { entry: actual, label: "服务端" },
      { entry: { ...other, source: "overlay" }, label: "Overlay 前端" },
    ]
    const find = (query: string) => rows
      .filter(({ entry, label }) => matchesLogEntrySearch(entry, query, label))
      .map(({ entry }) => entry)
    expect(find("服务端")).toEqual([actual])
    expect(find("SERVER")).toEqual([actual])
    expect(find("前端")).toEqual([rows[1].entry])
    expect(find("服务端")[0]).toBe(actual)
  })

  test("finds the same original request by its displayed summary and canonical fields", () => {
    const raw = '{"service":"server","message":"request","data":{"requestID":"request-b","method":"GET","path":"/file/status","status":"completed","statusCode":200}}'
    const entry = { ...parseServerLogLine(raw), source: "server" }
    const summary = "GET /file/status · 已响应 200"
    const find = (query: string) => [entry].filter((item) => matchesLogEntrySearch(item, query, "服务端", summary))
    expect(find("GET /file/status")).toEqual([entry])
    expect(find("已响应 200")).toEqual([entry])
    expect(find("request-b")).toEqual([entry])
    expect(find("已响应 200")[0].raw).toBe(raw)
  })

  test("filters a bounded 500-entry loaded set in actual input order", () => {
    const loaded = Array.from({ length: 500 }, (_, index) => ({
      ...other,
      message: `loaded row ${index}`,
      fields: { ordinal: index, group: index % 100 === 0 ? "retrieval-target" : "ordinary" },
    }))
    const result = loaded.filter((entry) => matchesLogEntrySearch(entry, "RETRIEVAL-TARGET"))
    expect(result.map((entry) => entry.fields.ordinal)).toEqual([0, 100, 200, 300, 400])
    expect(result).toEqual([loaded[0], loaded[100], loaded[200], loaded[300], loaded[400]])
  })
})
