import { describe, expect, test } from "bun:test"
import {
  isConversationDisplayMessagePartType,
  isConversationRenderableMessagePartType,
  projectConversationAgentActivityPart,
} from "../src"

describe("conversation source message parts", () => {
  test("projects every persisted source family as renderable message content and compact activity", () => {
    const sourceParts = [
      {
        id: "source-url-part",
        messageID: "message_source",
        orderKey: "0001",
        type: "source-url",
        sourceId: "source-url-id",
        url: "https://example.com/source",
        title: "Web source",
      },
      {
        id: "source-document-part",
        messageID: "message_source",
        orderKey: "0002",
        type: "source-document",
        sourceId: "source-document-id",
        mediaType: "application/pdf",
        title: "Document source",
        filename: "source.pdf",
      },
      {
        id: "source-file-part",
        messageID: "message_source",
        orderKey: "0003",
        type: "source-file",
        sourceId: "source-file-id",
        path: "C:/project/src/source.ts",
        title: "src/source.ts",
        range: { startLine: 4, endLine: 12 },
      },
    ]
    expect(
      sourceParts.map((part) => ({
        type: part.type,
        display: isConversationDisplayMessagePartType(part.type),
        renderable: isConversationRenderableMessagePartType(part.type),
        activity: projectConversationAgentActivityPart(part),
      })),
    ).toEqual([
      {
        type: "source-url",
        display: true,
        renderable: true,
        activity: {
          id: "source-url-part",
          messageID: "message_source",
          orderKey: "0001",
          type: "source-url",
          sourceId: "source-url-id",
          url: "https://example.com/source",
          title: "Web source",
        },
      },
      {
        type: "source-document",
        display: true,
        renderable: true,
        activity: {
          id: "source-document-part",
          messageID: "message_source",
          orderKey: "0002",
          type: "source-document",
          sourceId: "source-document-id",
          mediaType: "application/pdf",
          title: "Document source",
          filename: "source.pdf",
        },
      },
      {
        type: "source-file",
        display: true,
        renderable: true,
        activity: {
          id: "source-file-part",
          messageID: "message_source",
          orderKey: "0003",
          type: "source-file",
          sourceId: "source-file-id",
          path: "C:/project/src/source.ts",
          title: "src/source.ts",
          range: { startLine: 4, endLine: 12 },
        },
      },
    ])
  })

  test("preserves distinct legal long URL identities and source IDs", () => {
    const prefix = `https://example.com/resource?value=${"a".repeat(2200)}`
    const urls = [`${prefix}&record=one`, `${prefix}&record=two`]
    const ids = [`source-${"x".repeat(180)}-one`, `source-${"x".repeat(180)}-two`]
    const projected = urls.map((url, index) =>
      projectConversationAgentActivityPart({
        id: `part-${index}`,
        messageID: "message",
        orderKey: `order-${index}`,
        type: "source-url",
        sourceId: ids[index],
        url,
        title: "Web source",
      }),
    )
    expect(projected).toEqual(
      urls.map((url, index) => ({
        id: `part-${index}`,
        messageID: "message",
        orderKey: `order-${index}`,
        type: "source-url",
        sourceId: ids[index],
        url,
        title: "Web source",
      })),
    )
    expect(new Set(projected.map((part) => (part?.type === "source-url" ? part.url : ""))).size).toBe(2)
  })

  test("preserves native file path whitespace and long identity with exact range", () => {
    const input = {
      id: "file-part",
      messageID: "message",
      orderKey: "order",
      type: "source-file" as const,
      sourceId: `file-${"f".repeat(180)}`,
      path: `C:/project/folder  with  spaces/${"directory/".repeat(120)}source.ts`,
      title: "source.ts",
      range: { startLine: 170, endLine: 200 },
    }
    expect(projectConversationAgentActivityPart(input)).toEqual(input)
  })

  test("preserves document source identity and descriptor metadata", () => {
    const input = {
      id: "document-part",
      messageID: "message",
      orderKey: "order",
      type: "source-document" as const,
      sourceId: `document-${"d".repeat(180)}`,
      mediaType: `application/vnd.example.${"m".repeat(170)}`,
      title: "Document source",
      filename: `reference  ${"long-name-".repeat(30)}.pdf`,
    }
    expect(projectConversationAgentActivityPart(input)).toEqual(input)
  })
})
