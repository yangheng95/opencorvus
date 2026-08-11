import { describe, expect, test } from "bun:test"
import { classifyClipboardApiKey } from "../src/services/clipboard-api-key-prompt"

describe("clipboard API-key candidate classification", () => {
  test("classifies representative Provider key structures without returning secret text", () => {
    const prefixed = classifyClipboardApiKey("sk-proj-7GmP4vN8qR2xT6zW9cK3sH5jL1aF0dB")
    const assignment = classifyClipboardApiKey("OPENAI_API_KEY=sk-proj-3Wr9Yp6Ks2Hd8Qm5Zx1Vb7Nc4Ta0LfG")
    const opaque = classifyClipboardApiKey("Aq7_wE9-rT2.yU4+iO6=pL8-kJ1_hG3.fD5+sZ0")

    expect(prefixed).toEqual({ kind: "candidate", evidence: "provider-prefix" })
    expect(assignment).toEqual({ kind: "candidate", evidence: "credential-assignment" })
    expect(opaque).toEqual({ kind: "candidate", evidence: "opaque-token" })
  })

  test("maps structured non-key clipboard values to explicit classifications", () => {
    expect(classifyClipboardApiKey("https://console.example.com/account/api-keys")).toEqual({
      kind: "not-candidate",
      reason: "structured-text",
    })
    expect(classifyClipboardApiKey("550e8400-e29b-41d4-a716-446655440000")).toEqual({
      kind: "not-candidate",
      reason: "identifier",
    })
    expect(classifyClipboardApiKey("Copy this ordinary sentence into the chat composer.")).toEqual({
      kind: "not-candidate",
      reason: "insufficient-structure",
    })
  })
})
