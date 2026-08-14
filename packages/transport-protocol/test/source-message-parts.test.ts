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
        orderKey: "0001",
        type: "source-url",
        sourceId: "source-url-id",
        url: "https://example.com/source",
        title: "Web source",
      },
      {
        id: "source-document-part",
        orderKey: "0002",
        type: "source-document",
        sourceId: "source-document-id",
        mediaType: "application/pdf",
        title: "Document source",
        filename: "source.pdf",
      },
      {
        id: "source-file-part",
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
})
