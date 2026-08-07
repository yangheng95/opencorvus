import { describe, expect, test } from "bun:test"
import z from "zod"
import { NamedError } from "../src/error"

/**
 * 2026-04-30 — generic serialization paths (`String(err)`, `err.message`,
 * AI-SDK tool error envelopes, JSON.stringify(plainError)) only see
 * `Error.message`. The prior `super(name, options)` made every NamedError
 * report just its class name — the structured `data` (including the
 * canonical `message` field on every error schema) was hidden behind
 * `.data`, so 16+ extraction sites in orchestrator/tools.ts produced
 * messages like "WorktreeCreateFailedError: WorktreeCreateFailedError"
 * instead of the actual diagnostic. Fix folds `data.message` (or the full
 * payload as JSON) into `Error.message` at construction time so all
 * generic consumers see the real cause.
 */

describe("NamedError", () => {
  const SampleError = NamedError.create("SampleError", z.object({ message: z.string() }))

  const MultiFieldError = NamedError.create("MultiFieldError", z.object({ code: z.number(), reason: z.string() }))

  test("Error.message includes data.message when schema has a message field", () => {
    const err = new SampleError({ message: "head missing" })
    expect(err.message).toContain("SampleError")
    expect(err.message).toContain("head missing")
    expect(String(err)).toContain("head missing")
  })

  test("Error.message serializes full payload when there is no message field", () => {
    const err = new MultiFieldError({ code: 42, reason: "denied" })
    expect(err.message).toContain("MultiFieldError")
    expect(err.message).toContain("denied")
    expect(err.message).toContain("42")
  })

  test("structured data still readable via .data", () => {
    const err = new SampleError({ message: "head missing" })
    expect(err.data.message).toBe("head missing")
    expect(err.name).toBe("SampleError")
    expect(SampleError.isInstance(err)).toBe(true)
  })

  test("err.message survives generic catch + rethrow envelopes", () => {
    let captured = ""
    try {
      throw new SampleError({ message: "concrete diagnostic" })
    } catch (e) {
      captured = e instanceof Error ? e.message : String(e)
    }
    expect(captured).toContain("concrete diagnostic")
  })
})
