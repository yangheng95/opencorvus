import { afterAll, describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { persistMessageSources } from "../../src/session/source-persistence"
import { fileSource, urlSource } from "../../src/tool/source"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

describe("message source persistence", () => {
  test("persists URL and source-file evidence once with durable timeline identities", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Source persistence contract" })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "assistant",
          author: "build",
          time: { created: Date.now(), completed: Date.now() },
          parentID: Identifier.ascending("message"),
          modelID: "source-test",
          providerID: "test",
          agent: "build",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const sources = [
          urlSource({ url: "https://example.com/source#fragment", title: "Web source", provider: "exa" }),
          fileSource({
            path: `${project.path}/src/example.ts`,
            title: "src/example.ts",
            range: { startLine: 4, endLine: 12 },
            provider: "opencorvus-read",
          }),
        ]
        const first = await persistMessageSources({ sessionID: session.id, messageID: message.id, sources })
        const second = await persistMessageSources({ sessionID: session.id, messageID: message.id, sources })
        const persisted = (await MessageStore.parts(message.id)).filter((part) => part.type.startsWith("source-"))
        expect({
          createdTypes: first.map((part) => part.type),
          repeatedWriteCount: second.length,
          persisted: persisted.map((part) => ({
            type: part.type,
            orderKey: part.orderKey,
            sourceId: "sourceId" in part ? part.sourceId : "",
          })),
        }).toEqual({
          createdTypes: ["source-url", "source-file"],
          repeatedWriteCount: 0,
          persisted: [
            { type: "source-url", orderKey: expect.any(String), sourceId: expect.any(String) },
            { type: "source-file", orderKey: expect.any(String), sourceId: expect.any(String) },
          ],
        })
      },
    })
  })
})
