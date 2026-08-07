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
        path: "/provider/refresh",
        status: "failed",
        error: {
          type: "ProviderCatalogRefreshError",
          message: "models.dev unavailable",
        },
      }),
    )

    expect(entry).toMatchObject({
      level: "error",
      ts: "2026-06-03T10:00:00",
      service: "server",
      message: "provider refresh failed",
    })
    expect(entry.fields).toMatchObject({
      service: "server",
      path: "/provider/refresh",
      status: "failed",
      error: {
        type: "ProviderCatalogRefreshError",
        message: "models.dev unavailable",
      },
    })
  })

  test("keeps old text logs readable for existing files", () => {
    const entry = parseServerLogLine("WARN  2026-03-10T10:00:01 +2ms service=server seeded warning")

    expect(entry).toMatchObject({
      level: "warn",
      ts: "2026-03-10T10:00:01",
      delta: "+2ms",
      service: "server",
      message: "seeded warning",
    })
  })
})
