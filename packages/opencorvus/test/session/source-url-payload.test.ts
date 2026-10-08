import { describe, expect, test } from "bun:test"
import z from "zod"
import { Message } from "../../src/session/message"

describe("source URL payload validation", () => {
  test.each([
    "https://example.com/resource?lang=zh#section",
    "http://localhost:18105/resource",
    "http://127.0.0.1:18105/resource",
    "HTTPS://EXAMPLE.COM/resource?lang=zh#section",
  ])("preserves the complete HTTP source payload for %s", (url) => {
    const source = {
      type: "source-url" as const,
      sourceId: "source-payload-contract",
      url,
      title: "Source title",
      snippet: "Actual source excerpt",
      author: "Source author",
      publishedAt: "2026-10-08",
      provider: "source-provider",
      providerMetadata: { location: "resource" },
    }
    expect(Message.SourceUrlPayload.parse(source)).toEqual(source)
    expect(Message.SourcePayload.parse(source)).toEqual(source)
    const part = { ...source, id: "part-contract", sessionID: "session-contract", messageID: "message-contract" }
    expect(Message.SourceUrlPart.parse(part)).toEqual(part)
  })

  test.each(["not-http-url", "https://", "ftp://example.com/resource", "mailto:source@example.com"])(
    "returns the URL format error contract for %s",
    (url) => {
      const part = {
        type: "source-url", sourceId: "source-error-contract", url,
        id: "part-contract", sessionID: "session-contract", messageID: "message-contract",
      }
      for (const schema of [Message.SourcePayload, Message.SourceUrlPayload, Message.SourceUrlPart]) {
        const input = schema === Message.SourceUrlPart ? part : { type: part.type, sourceId: part.sourceId, url }
        const result = schema.safeParse(input)
        if (result.success) throw new Error("Expected the source URL validation error contract")
        expect(result.error).toBeInstanceOf(z.ZodError)
        expect(result.error.issues.map(({ code, path, message }) => ({ code, path, message }))).toEqual([
          { code: "invalid_format", path: ["url"], message: "Invalid URL" },
        ])
      }
    },
  )
})
