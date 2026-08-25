import { afterEach, describe, expect, test } from "bun:test"
import { randomUUID } from "../src/utils/random-id"

// What this pins
// ----------------
// `crypto.randomUUID` exists only in a secure context. Served over plain HTTP
// from a LAN address or a container it is absent, and one call site sits on the
// stream-open path, so the overlay died at boot with a blank page. The identifier
// is therefore derived from `crypto.getRandomValues`, which carries no such
// restriction — unconditionally, so the path every user runs is the path these
// tests cover.
//
// The assertions are exact strings rather than a shape check. A regex for the v4
// format plus a distinctness count is satisfied by a zero-entropy counter
// (`00000000-0000-4000-8000-{n}`), and these identifiers are request IDs.

const original = Object.getOwnPropertyDescriptor(globalThis, "crypto")

/** Install a generator yielding `bytes`, and record that it was consulted. */
function withBytes(bytes: number[]): { calls: number } {
  const real = globalThis.crypto
  const record = { calls: 0 }
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues: (array: Uint8Array) => {
        record.calls += 1
        array.set(bytes.slice(0, array.length))
        return array
      },
      // randomUUID deliberately absent, as on an insecure origin.
      subtle: real.subtle,
    },
  })
  return record
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, "crypto", original)
})

describe("randomUUID", () => {
  test("sets the version nibble and variant bits on known input", () => {
    withBytes(Array.from({ length: 16 }, (_, index) => index))

    // byte 6 = 0x06 -> 0x46 (version 4); byte 8 = 0x08 -> 0x88 (variant 10x).
    expect(randomUUID()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f")
  })

  test("forces those bits even when every input bit is low", () => {
    withBytes(Array.from({ length: 16 }, () => 0x00))

    expect(randomUUID()).toBe("00000000-0000-4000-8000-000000000000")
  })

  test("forces those bits even when every input bit is high", () => {
    withBytes(Array.from({ length: 16 }, () => 0xff))

    expect(randomUUID()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff")
  })

  test("draws from crypto.getRandomValues on every call", () => {
    const record = withBytes(Array.from({ length: 16 }, () => 0x01))

    randomUUID()
    randomUUID()

    expect(record.calls).toBe(2)
  })

  test("produces distinct identifiers against the real generator", () => {
    expect(typeof globalThis.crypto.getRandomValues).toBe("function")

    const seen = new Set(Array.from({ length: 500 }, () => randomUUID()))
    expect(seen.size).toBe(500)
  })
})
