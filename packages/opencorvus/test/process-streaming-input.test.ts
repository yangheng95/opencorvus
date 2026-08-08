import { createHash } from "node:crypto"
import { describe, expect, test } from "bun:test"
import { Process } from "../src/util/process"

describe("supervised Process binary input", () => {
  test("streams exact binary chunks through the owned stdin pipe", async () => {
    const chunks = Array.from({ length: 12 }, (_, index) => {
      const bytes = Buffer.alloc(256 * 1024, index)
      bytes.writeUInt32BE(index, 0)
      return bytes
    })
    const expectedBytes = chunks.reduce((total, chunk) => total + chunk.length, 0)
    const expectedSHA256 = createHash("sha256").update(Buffer.concat(chunks)).digest("hex")

    async function* input() {
      for (const chunk of chunks) yield chunk
    }

    const result = await Process.runHost(
      [
        process.execPath,
        "-e",
        [
          "const {createHash}=require('node:crypto');",
          "const hash=createHash('sha256');let bytes=0;",
          "process.stdin.on('data',(chunk)=>{bytes+=chunk.length;hash.update(chunk)});",
          "process.stdin.on('end',()=>process.stdout.write(JSON.stringify({bytes,sha256:hash.digest('hex')})));",
        ].join(""),
      ],
      { input: input(), inactivityTimeoutMs: 10_000 },
    )

    expect({ code: result.code, output: JSON.parse(result.stdout.toString()) }).toEqual({
      code: 0,
      output: { bytes: expectedBytes, sha256: expectedSHA256 },
    })
  })

  test("returns the inactivity-timeout contract when the input iterator stops producing bytes", async () => {
    async function* stalledInput() {
      yield Buffer.from("partial")
      await new Promise<never>(() => undefined)
    }

    const result = await Process.runHost([process.execPath, "-e", "process.stdin.resume()"], {
      input: stalledInput(),
      inactivityTimeoutMs: 100,
      inactivityTimeoutMessage: "streaming input inactivity timeout",
      nothrow: true,
    })

    expect({ code: result.code, stderr: result.stderr.toString() }).toEqual({
      code: expect.any(Number),
      stderr: "streaming input inactivity timeout",
    })
    expect(result.code).toBeGreaterThan(0)
  })

  test("disposes the supervised child before returning a spawn-observer error", async () => {
    const error = new Error("spawn observer contract")
    await expect(
      Process.runHost([process.execPath, "-e", "setInterval(() => undefined, 1000)"], {
        onSpawned: () => {
          throw error
        },
      }),
    ).rejects.toBe(error)
  })
})
