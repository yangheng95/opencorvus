import { describe, expect, test } from "bun:test"
import { PackageToolCapsuleRpc } from "../src/expert-squad/package-tool-capsule"

describe("Package Tool Capsule RPC values", () => {
  test("round-trips nested binary values byte-for-byte", async () => {
    const original = {
      direct: Buffer.from([0, 1, 2, 127, 128, 255]),
      nested: [new Uint8Array([9, 8, 7])],
    }

    const decoded = PackageToolCapsuleRpc.decode(await PackageToolCapsuleRpc.encode(original)) as typeof original

    expect(Buffer.from(decoded.direct)).toEqual(original.direct)
    expect(Buffer.from(decoded.nested[0]!)).toEqual(Buffer.from(original.nested[0]!))
  })

  test("round-trips Stats fields and file-type methods", async () => {
    const modified = new Date("2026-08-07T01:02:03.004Z")
    const stats = {
      dev: 12n,
      size: 4096n,
      mtime: modified,
      mtimeMs: 1_786_064_523_004,
      mtimeNs: 1_786_064_523_004_000_000n,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isDirectory: () => false,
      isFIFO: () => false,
      isFile: () => true,
      isSocket: () => false,
      isSymbolicLink: () => false,
    }

    const decoded = PackageToolCapsuleRpc.decode(await PackageToolCapsuleRpc.encode(stats)) as typeof stats

    expect({
      dev: decoded.dev,
      size: decoded.size,
      mtime: decoded.mtime,
      mtimeMs: decoded.mtimeMs,
      mtimeNs: decoded.mtimeNs,
    }).toEqual({
      dev: 12n,
      size: 4096n,
      mtime: modified,
      mtimeMs: 1_786_064_523_004,
      mtimeNs: 1_786_064_523_004_000_000n,
    })
    expect({ file: decoded.isFile(), directory: decoded.isDirectory(), symbolicLink: decoded.isSymbolicLink() }).toEqual({
      file: true,
      directory: false,
      symbolicLink: false,
    })
  })

  test("round-trips an HTTP Response with exact status, headers, URL, and body", async () => {
    const response = new Response(Buffer.from([0, 16, 255, 42]), {
      status: 206,
      statusText: "Partial Content",
      headers: { "content-type": "application/octet-stream", "x-capsule": "task-42" },
    })
    Object.defineProperties(response, {
      url: { value: "https://benchmark.example.test/blob", enumerable: true },
      redirected: { value: true, enumerable: true },
      type: { value: "basic", enumerable: true },
    })

    const decoded = PackageToolCapsuleRpc.decode(await PackageToolCapsuleRpc.encode(response)) as Response

    expect({
      status: decoded.status,
      statusText: decoded.statusText,
      contentType: decoded.headers.get("content-type"),
      capsule: decoded.headers.get("x-capsule"),
      url: decoded.url,
      redirected: decoded.redirected,
      type: decoded.type,
      body: [...new Uint8Array(await decoded.arrayBuffer())],
    }).toEqual({
      status: 206,
      statusText: "Partial Content",
      contentType: "application/octet-stream",
      capsule: "task-42",
      url: "https://benchmark.example.test/blob",
      redirected: true,
      type: "basic",
      body: [0, 16, 255, 42],
    })
  })
})
