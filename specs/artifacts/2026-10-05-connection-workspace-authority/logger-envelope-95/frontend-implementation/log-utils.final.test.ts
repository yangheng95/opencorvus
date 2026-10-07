import { describe, expect, test } from "bun:test"
import { parseServerLogLine } from "../src/utils/log"

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
