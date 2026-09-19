import { describe, expect, test } from "bun:test"
import { rename, writeFile } from "node:fs/promises"
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

  test("a listening receipt binds readiness to a positive safe-integer process identity", () => {
    expect(() =>
      parseStartupReceipt(
        JSON.stringify({
          schemaVersion: 1,
          occurrenceID: "launch-1",
          outcome: "listening",
          url: "http://127.0.0.1:4096",
          pid: 0,
        }),
        "launch-1",
      ),
    ).toThrow("positive safe-integer pid")
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
      parseStartupReceipt(
        JSON.stringify({ schemaVersion: 2, occurrenceID: "launch-1", outcome: "listening" }),
        "launch-1",
      ),
    ).toThrow("Unsupported server startup receipt schema")
  })

  test("the channel reads the published receipt", async () => {
    const channel = await createStartupReceiptChannel("launch-9")
    try {
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

  test("the channel observes a receipt published after waiting begins", async () => {
    const channel = await createStartupReceiptChannel("launch-10")
    const controller = new AbortController()
    try {
      const waiting = channel.wait(controller.signal)
      await writeFile(
        channel.path,
        JSON.stringify({
          schemaVersion: 1,
          occurrenceID: "launch-10",
          outcome: "listening",
          url: "http://127.0.0.1:5001",
          pid: 8,
        }),
      )
      expect(await waiting).toMatchObject({ outcome: "listening", url: "http://127.0.0.1:5001" })
    } finally {
      controller.abort()
      await channel.dispose()
    }
  })

  test("a receipt published before waiting settles with its exact launch identity", async () => {
    const channel = await createStartupReceiptChannel("prepublished")
    try {
      await writeFile(
        channel.path,
        JSON.stringify({
          schemaVersion: 1,
          occurrenceID: "prepublished",
          outcome: "listening",
          url: "http://127.0.0.1:5002",
          pid: 9,
        }),
      )
      expect(await channel.wait(AbortSignal.timeout(1_000))).toMatchObject({
        occurrenceID: "prepublished",
        outcome: "listening",
        url: "http://127.0.0.1:5002",
        pid: 9,
      })
    } finally {
      await channel.dispose()
    }
  })

  test("successive concurrent launch occurrences observe their atomic receipt publication", async () => {
    for (let round = 0; round < 4; round += 1) {
      await Promise.all(
        Array.from({ length: 4 }, async (_, index) => {
          const occurrenceID = `atomic-${round}-${index}`
          const channel = await createStartupReceiptChannel(occurrenceID)
          try {
            const waiting = channel.wait(AbortSignal.timeout(2_000))
            await new Promise((resolve) => setTimeout(resolve, 10))
            const temporary = `${channel.path}.tmp`
            await writeFile(
              temporary,
              JSON.stringify({
                schemaVersion: 1,
                occurrenceID,
                outcome: "listening",
                url: `http://127.0.0.1:${5100 + index}`,
                pid: 10 + index,
              }),
            )
            await rename(temporary, channel.path)
            expect(await waiting).toEqual({
              schemaVersion: 1,
              occurrenceID,
              outcome: "listening",
              url: `http://127.0.0.1:${5100 + index}`,
              pid: 10 + index,
            })
          } finally {
            await channel.dispose()
          }
        }),
      )
    }
  })

  test("an incomplete receipt settles when its complete failure fact is published", async () => {
    const channel = await createStartupReceiptChannel("partial")
    try {
      await writeFile(channel.path, '{"schemaVersion":1,')
      const waiting = channel.wait(AbortSignal.timeout(1_000))
      await new Promise((resolve) => setTimeout(resolve, 10))
      await writeFile(
        channel.path,
        JSON.stringify({
          schemaVersion: 1,
          occurrenceID: "partial",
          outcome: "failed",
          error: "port in use",
        }),
      )
      expect(await waiting).toEqual({
        schemaVersion: 1,
        occurrenceID: "partial",
        outcome: "failed",
        error: "port in use",
      })
    } finally {
      await channel.dispose()
    }
  })

  test("caller cancellation settles its own waiting launch with the exact reason", async () => {
    const channel = await createStartupReceiptChannel("cancelled")
    const controller = new AbortController()
    try {
      const waiting = channel.wait(controller.signal)
      controller.abort(new Error("launch cancelled"))
      await expect(waiting).rejects.toThrow("launch cancelled")
      await expect(channel.wait(controller.signal)).rejects.toThrow("launch cancelled")
    } finally {
      await channel.dispose()
    }
  })
})
