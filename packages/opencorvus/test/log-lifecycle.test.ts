import { describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs"
import { TextWriter, Uint8ArrayReader, ZipReader } from "@zip.js/zip.js"
import { Log } from "../src/util/log"
import { buildLogSupportBundle } from "../src/util/log-support-bundle"
import { APICallError } from "ai"
import path from "node:path"
import { NodeProcess } from "@opencorvus-ai/util/process-node"

describe("Log lifecycle", () => {
  test("DEBUG policy reaches the real print-mode file and stderr destinations", async () => {
    const result = await NodeProcess.run({
      command: { executable: process.execPath, args: [path.join(import.meta.dir, "fixture/log-debug-child.ts")] },
      ownership: "owned_tree",
      windowsHide: true,
      timeoutMs: 30_000,
    })
    expect(result.receipt.reason).toBe("exited")
    expect(result.receipt.exitCode).toBe(0)
    const file = JSON.parse(new TextDecoder().decode(result.stdout).trim()).fileRecords
    const stderr = new TextDecoder()
      .decode(result.stderr)
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line))
      .filter((row) => row.service === "log-debug-real-child")
    const projection = (rows: Array<Record<string, unknown>>) =>
      rows.map((row) => {
        const data = row.data && typeof row.data === "object" ? row.data : undefined
        return {
          level: row.level,
          message: row.message,
          status: data && "status" in data ? data.status : null,
          count: data && "count" in data ? data.count : null,
        }
      })
    const expected = [
      { level: "debug", message: "actual debug payload", status: null, count: 7 },
      { level: "debug", message: "actual debug timer", status: "started", count: null },
      { level: "debug", message: "actual debug timer", status: "completed", count: null },
    ]
    expect(projection(file)).toEqual(expected)
    expect(projection(stderr)).toEqual(expected)
  })

  test.each([false, true])("flush joins the actual in-flight file write with print=%s", async (print) => {
    await Log.init({ print, dev: true })
    const marker = `in-flight-file-write-${print}`
    const order: string[] = []
    const write = fs.write.bind(fs) as (...args: any[]) => void
    let complete!: () => void
    const completed = new Promise<void>((resolve) => {
      complete = resolve
    })
    let intercepted = false
    const interceptedWrite = (...args: any[]) => {
      if (args[0] !== 2 && typeof args[1] === "string" && args[1].includes(marker) && !intercepted) {
        intercepted = true
        const callback = args.at(-1)
        args[args.length - 1] = (...result: any[]) => {
          order.push("file-write-completed")
          callback(...result)
          complete()
        }
        setTimeout(() => write(...args), 20)
        return
      }
      write(...args)
    }
    using _write = spyOn(fs, "write").mockImplementation(interceptedWrite as typeof fs.write)
    try {
      Log.create({ service: "log-flush-order" }).info(marker)
      await Log.flush()
      order.push("flush-resolved")
      expect(order).toEqual(["file-write-completed", "flush-resolved"])
      const records = (await Log.read({ lines: 20 })).lines.map((line) => JSON.parse(line))
      expect(records.find((record) => record.message === marker)).toMatchObject({
        service: "log-flush-order",
        message: marker,
        level: "info",
      })
    } finally {
      if (intercepted) await completed
    }
  })

  test("cached logger writes survive repeated real asynchronous close and reinitialization", async () => {
    const logger = Log.create({ service: "log-reinit-sequence" })
    const actual: number[] = []
    for (let iteration = 0; iteration < 20; iteration += 1) {
      await Log.close()
      await Log.init({ print: false, dev: true })
      logger.info("reinitialized", { iteration })
      await Log.flush()
      const records = (await Log.read({ lines: 20 })).lines.map((line) => JSON.parse(line))
      actual.push(records.find((record) => record.service === "log-reinit-sequence")?.data.iteration)
    }
    expect(actual).toEqual(Array.from({ length: 20 }, (_, index) => index))
  })

  test("support export contains the newly written record in its real raw log entry", async () => {
    await Log.close()
    await Log.init({ print: true, dev: true })
    const marker = "support-export-current-record"
    Log.create({ service: "log-export-test" }).info(marker)
    const bundle = await buildLogSupportBundle()
    const current = bundle.manifest.files.find((file) => file.current)
    if (!current) throw new Error("Expected the current log in the support manifest")
    const zip = new ZipReader(new Uint8ArrayReader(bundle.bytes))
    try {
      const entry = (await zip.getEntries()).find((entry) => entry.filename === current.rawPath)
      if (!entry || !("getData" in entry) || typeof entry.getData !== "function")
        throw new Error("Expected the exported raw log entry")
      const raw = await entry.getData(new TextWriter())
      const records = raw
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
      expect(records.find((record) => record.message === marker)).toMatchObject({
        service: "log-export-test",
        message: marker,
        level: "info",
      })
    } finally {
      await zip.close()
    }
  })

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
    expect(logger.enabled("INFO")).toBe(true)
    logger.info("after close")

    await Log.init({ print: false, dev: true })
    logger.info("after reinit")
    await Log.flush()

    const current = await Log.read({ lines: 20 })
    expect(current.lines.join("\n")).toContain("after reinit")
  })
})
