import { describe, expect, test } from "bun:test"
import { matchesLogEntrySearch, parseServerLogLine } from "../src/utils/log"

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
    expect(selected.filter((entry) => matchesLogEntrySearch(entry, "unmatched-owned-query"))).toEqual([])
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
