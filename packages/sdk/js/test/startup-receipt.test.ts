import { describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { createStartupReceiptChannel, parseStartupReceipt } from "../src/startup-receipt.js"

describe("server startup readiness is a framed receipt", () => {
  test("a listening receipt settles the launch with the bound url", () => {
    const parsed = parseStartupReceipt(
      JSON.stringify({
        schemaVersion: 1,
        occurrenceID: "launch-1",
        outcome: "listening",
        url: "http://127.0.0.1:4096",
        pid: 321,
      }),
      "launch-1",
    )
    expect(parsed).toEqual({
      schemaVersion: 1,
      occurrenceID: "launch-1",
      outcome: "listening",
      url: "http://127.0.0.1:4096",
      pid: 321,
    })
  })

  test("a failure receipt settles the launch with its exact error", () => {
    const parsed = parseStartupReceipt(
      JSON.stringify({ schemaVersion: 1, occurrenceID: "launch-1", outcome: "failed", error: "port in use" }),
      "launch-1",
    )
    expect(parsed).toMatchObject({ outcome: "failed", error: "port in use" })
  })

  test("a partially written receipt is simply not settled yet", () => {
    expect(parseStartupReceipt('{"schemaVersion":1,"occ', "launch-1")).toBeUndefined()
    expect(parseStartupReceipt("", "launch-1")).toBeUndefined()
  })

  test("a receipt from another launch occurrence is refused, not adopted", () => {
    expect(() =>
      parseStartupReceipt(
        JSON.stringify({ schemaVersion: 1, occurrenceID: "someone-else", outcome: "listening", url: "http://x" }),
        "launch-1",
      ),
    ).toThrow("different launch occurrence")
  })

  test("an unsupported schema is refused rather than guessed", () => {
    expect(() =>
      parseStartupReceipt(JSON.stringify({ schemaVersion: 2, occurrenceID: "launch-1", outcome: "listening" }), "launch-1"),
    ).toThrow("Unsupported server startup receipt schema")
  })

  test("the channel reads the published receipt and nothing before it", async () => {
    const channel = await createStartupReceiptChannel("launch-9")
    try {
      expect(await channel.read()).toBeUndefined()
      await writeFile(
        channel.path,
        JSON.stringify({
          schemaVersion: 1,
          occurrenceID: "launch-9",
          outcome: "listening",
          url: "http://127.0.0.1:5000",
          pid: 7,
        }),
      )
      expect(await channel.read()).toMatchObject({ outcome: "listening", url: "http://127.0.0.1:5000" })
    } finally {
      await channel.dispose()
    }
  })
})
