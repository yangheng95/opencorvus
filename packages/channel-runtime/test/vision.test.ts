import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { VisionPipeline } from "../src/vision"

let oldFetch: typeof globalThis.fetch
let oldSslCertFile: string | undefined

beforeEach(() => {
  oldFetch = globalThis.fetch
  oldSslCertFile = process.env.SSL_CERT_FILE
})

afterEach(() => {
  globalThis.fetch = oldFetch
  if (oldSslCertFile === undefined) {
    delete process.env.SSL_CERT_FILE
  } else {
    process.env.SSL_CERT_FILE = oldSslCertFile
  }
})

describe("vision pipeline", () => {
  test("does not disable TLS verification when Windows has no SSL_CERT_FILE", async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform")
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    })
    delete process.env.SSL_CERT_FILE
    const calls: Array<RequestInit | undefined> = []
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init)
      return Response.json({
        model: "vision-model",
        choices: [{ message: { content: "screen" } }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      })
    }) as typeof globalThis.fetch

    const pipeline = new VisionPipeline({
      apiKey: "vision-key",
      baseURL: "https://vision.example.test",
      model: "vision-model",
    })

    try {
      await pipeline.analyze("aW1hZ2U=")
    } finally {
      if (platformDescriptor) Object.defineProperty(process, "platform", platformDescriptor)
    }

    expect(calls).toHaveLength(1)
    expect((calls[0] as RequestInit & { tls?: { rejectUnauthorized?: boolean } }).tls).toBeUndefined()
  })
})
