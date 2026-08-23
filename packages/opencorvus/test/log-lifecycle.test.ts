import { describe, expect, test } from "bun:test"
import { Log } from "../src/util/log"
import { APICallError } from "ai"

describe("Log lifecycle", () => {
  test("cached loggers remain usable across close and reinitialization", async () => {
    await Log.init({ print: false, dev: true })
    const logger = Log.create({ service: "log-lifecycle-test" })
    logger.info("before close")
    logger.error("provider failure", {
      cause: new APICallError({
        message: "usage limit reached",
        url: "https://example.invalid/responses",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: {
          "set-cookie": "session=log-secret",
          "x-codex-turn-state": "turn-log-secret",
          "retry-after": "120",
        },
        responseBody: '{"error":{"message":"usage limit reached"}}',
        isRetryable: false,
      }),
    })
    await Log.flush()
    const protectedLog = (await Log.read({ lines: 20 })).lines.join("\n")
    expect(protectedLog).toContain('"set-cookie":"<redacted>"')
    expect(protectedLog).toContain('"x-codex-turn-state":"<redacted>"')
    expect(protectedLog).toContain('"retry-after":"120"')

    await Log.close()
    expect(Log.file()).toBe("")
    expect(logger.enabled("INFO")).toBe(true)
    logger.info("after close")

    await Log.init({ print: false, dev: true })
    logger.info("after reinit")
    await Log.flush()

    const current = await Log.read({ lines: 20 })
    expect(current.lines.join("\n")).toContain("after reinit")
  })
})
