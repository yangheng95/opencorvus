import { describe, expect, test } from "bun:test"
import {
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  createStatusCodeErrorResponseHandler,
  readResponseWithSizeLimit,
} from "@ai-sdk/provider-utils"
import { z } from "zod"
import { APICallError } from "@ai-sdk/provider"
import { createRequire } from "node:module"

const url = "https://provider.example/response"
const schema = z.object({ message: z.string() })
const request = { url, requestBodyValues: {} }

describe("provider response dependency", () => {
  test("decodes an ordinary JSON response through the installed handler", async () => {
    const result = await createJsonResponseHandler(schema)({
      ...request,
      response: Response.json({ message: "ready" }),
    })
    expect(result.value).toEqual({ message: "ready" })
  })

  test("maps a provider JSON error to the shared API call error contract", async () => {
    const { value } = await createJsonErrorResponseHandler({
      errorSchema: schema,
      errorToMessage: (error) => error.message,
    })({
      ...request,
      response: Response.json({ message: "quota exceeded" }, { status: 429 }),
    })
    expect(APICallError.isInstance(value)).toBe(true)
    expect(value).toMatchObject({
      name: "AI_APICallError",
      message: "quota exceeded",
      statusCode: 429,
      isRetryable: true,
      url,
    })
  })

  const handlers = [
    ["JSON success", createJsonResponseHandler(schema)],
    ["JSON error", createJsonErrorResponseHandler({ errorSchema: schema, errorToMessage: (error) => error.message })],
    ["status error", createStatusCodeErrorResponseHandler()],
  ] as const
  for (const [name, handler] of handlers) {
    test(`${name} maps an oversized Content-Length to AI_DownloadError`, async () => {
      const size = 2 * 1024 * 1024 * 1024
      await expect(
        handler({
          ...request,
          response: new Response("{}", { headers: { "Content-Length": String(size + 1) } }),
        }),
      ).rejects.toMatchObject({
        name: "AI_DownloadError",
        url,
        message: `Download of ${url} exceeded maximum size of ${size} bytes (Content-Length: ${size + 1}).`,
      })
    })
  }

  test("maps streamed bytes above a size budget to AI_DownloadError", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.enqueue(new Uint8Array([3, 4]))
        controller.close()
      },
    })
    await expect(readResponseWithSizeLimit({ response: new Response(body), url, maxBytes: 3 })).rejects.toMatchObject({
      name: "AI_DownloadError",
      url,
      message: `Download of ${url} exceeded maximum size of 3 bytes.`,
    })
  })

  test("decodes server-sent events into ordered streaming values", async () => {
    const encoder = new TextEncoder()
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const message of ["first", "second"]) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message })}\n\n`))
          }
          controller.close()
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    )
    const { value } = await createEventSourceResponseHandler(schema)({ ...request, response })
    const messages: unknown[] = []
    for await (const event of value) {
      if (!event.success) throw event.error
      messages.push(event.value)
    }
    expect(messages).toEqual([{ message: "first" }, { message: "second" }])
  })
})

// Resolve from real adapters, so a stale transitive install cannot pass solely
// because the product's direct provider-utils dependency has been patched.
const require = createRequire(import.meta.url)
for (const adapter of [
  "@ai-sdk/openai",
  "@ai-sdk/anthropic",
  "@ai-sdk/google",
  "@ai-sdk/google-vertex",
  "@ai-sdk/openai-compatible",
]) {
  test(`${adapter} response handler applies the size error contract`, async () => {
    const adapterRequire = createRequire(require.resolve(adapter))
    const utils = adapterRequire("@ai-sdk/provider-utils") as typeof import("@ai-sdk/provider-utils")
    const size = 2 * 1024 * 1024 * 1024
    await expect(
      utils.createJsonResponseHandler(schema)({
        ...request,
        response: new Response('{"message":"oversized"}', { headers: { "Content-Length": String(size + 1) } }),
      }),
    ).rejects.toMatchObject({
      name: "AI_DownloadError",
      url,
      message: `Download of ${url} exceeded maximum size of ${size} bytes (Content-Length: ${size + 1}).`,
    })
  })
}
