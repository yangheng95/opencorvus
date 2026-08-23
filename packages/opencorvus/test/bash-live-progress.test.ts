import { describe, expect, test } from "bun:test"
import {
  BASH_LIVE_PREVIEW_LENGTH,
  BASH_LIVE_PROGRESS_MIN_BYTES,
  BASH_LIVE_PROGRESS_MIN_INTERVAL_MS,
  BashLiveOutputAccumulator,
  bashLiveProgressMetadata,
  shouldPublishBashLiveProgress,
} from "../src/tool/bash"

describe("Bash live durable progress", () => {
  test("keeps a monotone real byte coordinate after the visible preview truncates", () => {
    const preview = "x".repeat(BASH_LIVE_PREVIEW_LENGTH + 1)
    const boundedPrefix = "x".repeat(BASH_LIVE_PREVIEW_LENGTH - Buffer.byteLength("\n\n...", "utf8"))
    const first = bashLiveProgressMetadata(preview, 30_001, "CUDA training")
    const second = bashLiveProgressMetadata(preview, 30_007, "CUDA training")

    expect({ first, second }).toEqual({
      first: {
        output: boundedPrefix + "\n\n...",
        output_bytes: 30_001,
        description: "CUDA training",
      },
      second: {
        output: boundedPrefix + "\n\n...",
        output_bytes: 30_007,
        description: "CUDA training",
      },
    })
  })

  test("bounds durable sample frequency by real elapsed output or real byte growth", () => {
    expect([
      shouldPublishBashLiveProgress({
        now: BASH_LIVE_PROGRESS_MIN_INTERVAL_MS - 1,
        lastPublishedAt: 0,
        outputBytes: BASH_LIVE_PROGRESS_MIN_BYTES - 1,
        lastPublishedBytes: 0,
      }),
      shouldPublishBashLiveProgress({
        now: BASH_LIVE_PROGRESS_MIN_INTERVAL_MS,
        lastPublishedAt: 0,
        outputBytes: 1,
        lastPublishedBytes: 0,
      }),
      shouldPublishBashLiveProgress({
        now: 1,
        lastPublishedAt: 0,
        outputBytes: BASH_LIVE_PROGRESS_MIN_BYTES,
        lastPublishedBytes: 0,
      }),
    ]).toEqual([false, true, true])
  })

  test("keeps raw byte identity across split UTF-8 chunks and bounds CJK preview bytes", () => {
    const encoded = Buffer.from("训练", "utf8")
    const accumulator = new BashLiveOutputAccumulator()
    const decoded =
      accumulator.append("stdout", encoded.subarray(0, 2)) +
      accumulator.append("stdout", encoded.subarray(2, 4)) +
      accumulator.append("stdout", encoded.subarray(4)) +
      accumulator.end()
    const cjk = "训".repeat(BASH_LIVE_PREVIEW_LENGTH)
    const bounded = bashLiveProgressMetadata(cjk, Buffer.byteLength(cjk, "utf8"), "CJK")

    expect({ decoded, bytes: accumulator.outputBytes, metadata: accumulator.metadata("split"), bounded }).toEqual({
      decoded: "训练",
      bytes: encoded.length,
      metadata: { output: "训练", output_bytes: encoded.length, description: "split" },
      bounded: {
        output: expect.any(String),
        output_bytes: Buffer.byteLength(cjk, "utf8"),
        description: "CJK",
      },
    })
    expect(Buffer.byteLength(bounded.output, "utf8")).toBeLessThanOrEqual(BASH_LIVE_PREVIEW_LENGTH)
  })
})
