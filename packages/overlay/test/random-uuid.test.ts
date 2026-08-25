import { afterEach, describe, expect, test } from "bun:test"
import { randomUUID } from "../src/utils/random-id"

// What this pins
// ----------------
// `crypto.randomUUID` exists only in a secure context. Served over plain HTTP
// from a LAN address or a container, it is absent — and one call site sits on
// the stream-open path, so the overlay died at boot with a blank page.
// `crypto.getRandomValues` carries no such restriction, so an identifier can
// always be produced. Both paths are exercised here against the real global.

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const original = Object.getOwnPropertyDescriptor(globalThis, "crypto")

function withoutRandomUUID(): void {
  const real = globalThis.crypto
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues: (array: Uint8Array) => real.getRandomValues(array),
      // randomUUID deliberately absent, as on an insecure origin.
    },
  })
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "crypto", original)
})

describe("randomUUID", () => {
  test("returns a v4 UUID where crypto.randomUUID exists", () => {
    expect(typeof globalThis.crypto.randomUUID).toBe("function")
    expect(randomUUID()).toMatch(V4)
  })

  test("returns a v4 UUID where it does not", () => {
    withoutRandomUUID()
    expect(globalThis.crypto.randomUUID).toBeUndefined()

    expect(randomUUID()).toMatch(V4)
  })

  test("keeps producing distinct identifiers without crypto.randomUUID", () => {
    withoutRandomUUID()

    const seen = new Set(Array.from({ length: 500 }, () => randomUUID()))
    expect(seen.size).toBe(500)
  })
})
