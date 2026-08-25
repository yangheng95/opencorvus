import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { inSecureContext, secureContextFailure } from "../src/utils/secure-context"
import { setLocaleData } from "../src/utils/i18n"

// What this pins
// ----------------
// The wording an operator gets when a capability is missing. Two conditions
// look identical at the call site — the browser never had the feature, or this
// origin is not a secure context — and only the second has a remedy the
// operator can act on. Both messages are localised: the failure path is the one
// a user actually hits, and it used to be the only one still in English.

const original = Object.getOwnPropertyDescriptor(globalThis, "isSecureContext")

function withSecureContext(value: unknown): void {
  Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value })
}

beforeEach(() => {
  setLocaleData("en-US", {
    "secure_context.needs_https": "{{subject}} needs a secure context: open OpenCorvus over HTTPS, or from localhost",
    "secure_context.unsupported": "{{subject}} is unavailable in this browser",
    "secure_context.subject.clipboard": "The clipboard",
  })
})

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "isSecureContext", original)
  else delete (globalThis as Record<string, unknown>).isSecureContext
})

describe("secure context reporting", () => {
  test("names the remedy when the origin is the reason", () => {
    withSecureContext(false)

    expect(inSecureContext()).toBe(false)
    expect(secureContextFailure("secure_context.subject.clipboard")).toBe(
      "The clipboard needs a secure context: open OpenCorvus over HTTPS, or from localhost",
    )
  })

  test("blames the browser when the origin is already secure", () => {
    withSecureContext(true)

    expect(inSecureContext()).toBe(true)
    expect(secureContextFailure("secure_context.subject.clipboard")).toBe(
      "The clipboard is unavailable in this browser",
    )
  })

  test("treats an environment that cannot answer as secure", () => {
    withSecureContext(undefined)

    // Claiming an insecure origin without evidence would state a cause that may
    // be false, and would show the Settings notice on every non-browser render.
    expect(inSecureContext()).toBe(true)
  })

  test("resolves the subject through the catalogue rather than emitting a key", () => {
    withSecureContext(false)

    expect(secureContextFailure("secure_context.subject.clipboard")).toContain("The clipboard")
  })
})
