import { describe, expect, test } from "bun:test"
import type { Provider } from "../src/provider/provider"
import { ProviderTransform } from "../src/provider/transform"
import { Message } from "../src/session/message"
import { isDecodableText, MAX_TEXT_DECODE_BYTES } from "../src/session/text-mime"
import { Instance } from "../src/project/instance"
import { AttachmentStore } from "../src/storage/attachment-store"
import { tmpdir } from "./fixture/fixture"

const openAIModel = {
  id: "gpt-5",
  providerID: "openai",
  api: {
    id: "gpt-5",
    url: "https://api.openai.com/v1",
    npm: "@ai-sdk/openai",
  },
  name: "GPT-5",
  family: "gpt-5",
  capabilities: {
    temperature: true,
    reasoning: true,
    attachment: true,
    toolcall: true,
    input: { text: true, image: true, audio: false, video: false, pdf: true },
    output: { text: true, image: false, audio: false, video: false, pdf: false },
    interleaved: false,
  },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  limit: { context: 200_000, output: 100_000 },
  status: "active",
  options: {},
  headers: {},
  release_date: "2026-01-01",
} satisfies Provider.Model

describe("tool-result attachment provider projection", () => {
  test.each(["inline", "persisted"])(
    "projects the complete UTF-8 prefix of a large %s text attachment",
    async (storage) => {
      const body = "x" + "文".repeat(MAX_TEXT_DECODE_BYTES)
      const bytes = Buffer.from(body)
      const expected =
        "x" +
        "文".repeat(Math.floor((MAX_TEXT_DECODE_BYTES - 1) / 3)) +
        `\n\n[... truncated — file exceeds ${MAX_TEXT_DECODE_BYTES / 1024}KB limit ...]`
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const url =
            storage === "persisted"
              ? (await AttachmentStore.write(Instance.project.id, bytes, "text/plain", "long.txt")).url
              : `data:text/plain;base64,${bytes.toString("base64")}`
          const output = await Message.toolResultToModelOutput(
            { attachments: [{ mime: "text/plain", filename: "long.txt", url }] },
            openAIModel,
          )
          expect(output.type).toBe("text")
          if (output.type !== "text") throw new Error(`Expected text output, received ${output.type}`)
          const decoded = output.value.slice(output.value.indexOf("\n") + 1)
          console.log(
            "Attachment prefix observation",
            JSON.stringify({ storage, tail: decoded.slice(-90), bytes: Buffer.byteLength(decoded) }),
          )
          expect(Buffer.compare(Buffer.from(decoded), Buffer.from(expected))).toBe(0)
        },
      })
    },
  )

  test.each([
    ["application/schema+json", "schema.json"],
    ["application/problem+json; charset=utf-8", "problem.json"],
    ["application/atom+xml", "feed.xml"],
  ])("classifies structured text MIME %s as decodable", (mime, filename) => {
    expect(isDecodableText(mime, filename)).toBe(true)
  })

  test("replays a persisted structured JSON attachment as readable text", async () => {
    const schema = JSON.stringify({ type: "object", required: ["label"] })
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const reference = await AttachmentStore.write(
          Instance.project.id,
          Buffer.from(schema),
          "application/schema+json",
          "schema.json",
        )
        const output = await Message.toolResultToModelOutput(
          {
            toolCallId: "call_schema",
            output: {
              text: "Data audit completed.",
              attachments: [
                {
                  mime: "application/schema+json",
                  filename: "schema.json",
                  url: reference.url,
                },
              ],
            },
          },
          openAIModel,
        )

        expect(output.type).toBe("text")
        if (output.type !== "text") throw new Error(`Expected text output, received ${output.type}`)
        expect(output.value).toContain("Tool-result text attachment: schema.json")
        expect(output.value).toContain("mime=application/schema+json")
        expect(output.value).toContain(`ref=${reference.url}`)
        expect(output.value).toContain(`sha256=${reference.sha}`)
        expect(output.value).toContain(schema)
      },
    })
  })

  test.each(["application/csv", "application/x-iif", "application/vnd.google-apps.spreadsheet"])(
    "retains documented OpenAI typed-file transport for %s",
    (mime) => {
      expect(ProviderTransform.toolResultAttachmentTransport(openAIModel, mime)).toEqual({
        contentType: "file-data",
        adapter: "openai-responses",
      })
    },
  )

  test("projects an accepted PDF to the OpenAI Responses typed-file part", async () => {
    const bytes = Buffer.from("%PDF-1.7\nfixture")
    const output = await Message.toolResultToModelOutput(
      {
        text: "Report generated.",
        attachments: [
          {
            mime: "application/pdf",
            filename: "report.pdf",
            url: `data:application/pdf;base64,${bytes.toString("base64")}`,
          },
        ],
      },
      openAIModel,
    )

    expect(output).toEqual({
      type: "content",
      value: [
        { type: "text", text: "Report generated." },
        {
          type: "file-data",
          mediaType: "application/pdf",
          data: bytes.toString("base64"),
          filename: "report.pdf",
        },
      ],
    })
    expect(ProviderTransform.toolResultAttachmentTransport(openAIModel, "application/pdf")).toEqual({
      contentType: "file-data",
      adapter: "openai-responses",
    })
  })
})
