import { isDecodableText } from "@opencorvus-ai/util/text-mime"
import { describe, expect, test } from "bun:test"
import type { Provider } from "../src/provider/provider"
import { ProviderTransform } from "../src/provider/transform"
import { Message } from "../src/session/message"
import { MAX_TEXT_DECODE_BYTES } from "../src/session/text-mime"
import { Instance } from "../src/project/instance"
import { AttachmentStore } from "../src/storage/attachment-store"
import { tmpdir } from "./fixture/fixture"
import sharp from "sharp"
import { Identifier } from "../src/id/id"

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
  test("projects declared image resources as prepared user and tool image pixels", async () => {
    const vector = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="#1f61b7"/></svg>')
    const png = await sharp(vector).png().toBuffer()
    const mimes = ["image/png", "IMAGE/PNG", "image/png; profile=srgb", "image/svg+xml", "Image/SVG+XML; charset=utf-8"]
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({ directory: tmp.path, fn: async () => {
      const sessionID = Identifier.ascending("session"), messageID = Identifier.ascending("message")
      const parts: Message.FilePart[] = []
      for (let index = 0; index < mimes.length; index++) {
        const mime = mimes[index], bytes = index < 3 ? png : vector, filename = `declared.image${index}`
        const reference = await AttachmentStore.write(Instance.project.id, bytes, mime, filename)
        parts.push({ id: Identifier.ascending("part"), sessionID, messageID, type: "file", mime, filename, url: reference.url })
        const output = await Message.toolResultToModelOutput({ attachments: [{ mime, filename, url: reference.url }] }, openAIModel)
        expect(output.type).toBe("content")
        if (output.type !== "content") throw new Error(`Expected typed tool content, received ${output.type}`)
        const image = output.value.find((part) => part.type === "image-data")
        expect(image).toMatchObject({ type: "image-data", mediaType: "image/png" })
        if (image?.type !== "image-data") throw new Error("Expected prepared tool image")
        expect(await sharp(Buffer.from(image.data, "base64")).removeAlpha().raw().toBuffer()).toEqual(Buffer.from([31,97,183,31,97,183,31,97,183,31,97,183]))
        expect((await AttachmentStore.readVerifiedReference({ projectID: Instance.project.id, url: reference.url, mime })).bytes).toEqual(bytes)
      }
      const input = await Message.toModelMessages([{ info: {
        id: messageID, sessionID, role: "user", author: "user", time: { created: Date.now() }, agent: "coding",
        model: { providerID: openAIModel.providerID, modelID: openAIModel.id },
      }, parts }], openAIModel)
      expect(input[0].role).toBe("user")
      if (typeof input[0].content === "string") throw new Error("Expected typed user content")
      const files = input[0].content.filter((part) => part.type === "file")
      expect(files.map((file) => ({ mediaType: file.mediaType, filename: file.filename }))).toEqual(
        parts.map((part) => ({ mediaType: "image/png", filename: part.filename })),
      )
      for (const file of files) {
        const dataUrl = String((file.data as { type: "url"; url: URL }).url)
        expect(file.data).toMatchObject({ type: "url" })
        expect(dataUrl.slice(0, dataUrl.indexOf(","))).toBe("data:image/png;base64")
        const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64")
        expect(await sharp(bytes).removeAlpha().raw().toBuffer()).toEqual(Buffer.from([31,97,183,31,97,183,31,97,183,31,97,183]))
      }
    } })
  })

  test.each([
    ["IMAGE/PNG; profile=srgb", "declared.png", "image"],
    ["APPLICATION/PDF; version=1.7", "declared.pdf", "pdf"],
    ["Audio/WAV; codecs=1", "declared.wav", "audio"],
    ["VIDEO/MP4; codecs=avc1", "declared.mp4", "video"],
  ])("projects unsupported %s input as the explicit capability error", async (mediaType, filename, modality) => {
    const model = { ...openAIModel, capabilities: { ...openAIModel.capabilities, input: { text: true, image: false, pdf: false, audio: false, video: false } } }
    const output = await ProviderTransform.message([{ role: "user", content: [{ type: "file", mediaType, data: Buffer.from([1]), filename }] }], model, {})
    expect(output).toEqual([{ role: "user", content: [{ type: "text", text: `ERROR: Cannot read "${filename}" (this model does not support ${modality} input). Inform the user.` }] }])
  })

  test("reports the declared unsupported charset as the explicit decoding error", async () => {
    const mime = "text/plain; charset=x-owned-unsupported"
    const url = `data:${mime};base64,${Buffer.from("Original source").toString("base64")}`
    await expect(Message.toolResultToModelOutput({ attachments: [{ mime, url }] }, openAIModel))
      .rejects.toMatchObject({ name: "TextDecodingError", code: "INVALID_TEXT_ENCODING", encoding: "x-owned-unsupported" })
  })

  test.each(["inline", "persisted"])("projects declared encodings from %s original tool resources", async (storage) => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({ directory: tmp.path, fn: async () => {
      for (const [mime, bytes, expected] of [
        ['text/plain; charset="windows-1252"', Buffer.from([0x43, 0x61, 0x66, 0xe9, 0x20, 0x80]), "Café €"],
        ["text/plain; charset=gb18030", Buffer.from([0xd6, 0xd0, 0xce, 0xc4]), "中文"],
        ["application/schema+json; charset=utf-16be", Buffer.from('{"note":"中文"}', "utf16le").swap16(), '{"note":"中文"}'],
      ] as const) {
        const filename = "declared.txt"
        const url = storage === "persisted"
          ? (await AttachmentStore.write(Instance.project.id, bytes, mime, filename)).url
          : `data:${mime};base64,${bytes.toString("base64")}`
        const output = await Message.toolResultToModelOutput({ attachments: [{ mime, filename, url }] }, openAIModel)
        expect(output.type).toBe("text")
        if (output.type !== "text") throw new Error(`Expected text output, received ${output.type}`)
        expect(output.value.slice(output.value.indexOf("\n") + 1)).toBe(expected)
      }
    } })
  })

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

  test.each(["application/pdf", "APPLICATION/PDF; version=1.7"])("projects %s bytes through the typed-file transport", async (mime) => {
    const bytes = Buffer.from("%PDF-1.7\nfixture")
    const output = await Message.toolResultToModelOutput(
      {
        text: "Report generated.",
        attachments: [
          {
            mime,
            filename: "report.pdf",
            url: `data:${mime};base64,${bytes.toString("base64")}`,
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
    expect(ProviderTransform.toolResultAttachmentTransport(openAIModel, mime)).toEqual({
      contentType: "file-data",
      adapter: "openai-responses",
    })
  })

  test("projects a real zero-byte CSV attachment with its exact byte count and original result", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const reference = await AttachmentStore.write(Instance.project.id, Buffer.alloc(0), "text/csv", "empty.csv")
        const output = await Message.toolResultToModelOutput(
          { text: "Zero-row export completed.", attachments: [reference] },
          openAIModel,
        )
        expect(output).toEqual({
          type: "text",
          value: `Zero-row export completed.\n\n[Tool-result text attachment: empty.csv; mime=text/csv; ref=${reference.url}; sha256=${reference.sha}; bytes=0]\n`,
        })
      },
    })
  })

  test("projects a stored audio reference and the explicit Provider transport limitation", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const bytes = Buffer.from(
          "UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA",
          "base64",
        )
        const reference = await AttachmentStore.write(Instance.project.id, bytes, "audio/wav", "public.wav")
        const audioModel = {
          ...openAIModel,
          capabilities: { ...openAIModel.capabilities, input: { ...openAIModel.capabilities.input, audio: true } },
        }
        const reason = "provider openai adapter @ai-sdk/openai has no verified file-data transport for MIME audio/wav"
        expect(ProviderTransform.toolResultAttachmentTransport(audioModel, "audio/wav")).toEqual({
          contentType: "unsupported",
          reason,
        })
        expect(
          await Message.toolResultToModelOutput(
            { text: "Public audio generated.", attachments: [reference] },
            audioModel,
          ),
        ).toEqual({
          type: "text",
          value: `Public audio generated.\n\nAttachments remain tool-owned evidence because this provider transport cannot send them as typed tool results:\n- audio/wav; ref=${reference.url}; sha256=${reference.sha}; bytes=60; reason=${reason}`,
        })
      },
    })
  })
})
