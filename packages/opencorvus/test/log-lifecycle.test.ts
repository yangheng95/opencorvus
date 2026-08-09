import { describe, expect, test } from "bun:test"
import { Log } from "../src/util/log"

describe("Log lifecycle", () => {
  test("cached loggers remain usable across close and reinitialization", async () => {
    await Log.init({ print: false, dev: true })
    const logger = Log.create({ service: "log-lifecycle-test" })
    logger.info("before close")
    await Log.flush()

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
