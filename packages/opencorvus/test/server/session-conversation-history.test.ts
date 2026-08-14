import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

describe("session conversation history", () => {
  test("hydrates a bounded persisted tail and pages the preceding messages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Bounded Mission transcript" })
        const messageIDs: string[] = []
        const started = Date.now() - 10_000
        for (let index = 0; index < 12; index += 1) {
          const message = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "user",
            time: { created: started + index },
            agent: "user",
            model: { providerID: "test", modelID: "test" },
          })
          messageIDs.push(message.id)
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: message.id,
            type: "text",
            text: `Persisted message ${index}`,
          })
        }

        const headers = { "x-opencorvus-directory": project.path }
        const hydrateResponse = await Server.App().request(
          `/session/${session.id}/conversation?tail_limit=3`,
          { headers },
        )
        expect(hydrateResponse.status).toBe(200)
        const hydrate = (await hydrateResponse.json()) as any
        expect({
          ids: hydrate.transcript.map((message: any) => message.info.id),
          history: hydrate.history,
        }).toEqual({
          ids: messageIDs.slice(-3),
          history: expect.objectContaining({
            oldestMessageID: messageIDs.at(-3),
            hasMore: true,
            limit: 3,
          }),
        })

        const historyResponse = await Server.App().request(
          `/session/${session.id}/conversation/history?before=${hydrate.history.oldestTimestamp}` +
            `&before_order_key=${encodeURIComponent(hydrate.history.oldestOrderKey)}` +
            `&before_id=${encodeURIComponent(hydrate.history.oldestMessageID)}` +
            `&limit=4`,
          { headers },
        )
        expect(historyResponse.status).toBe(200)
        const history = (await historyResponse.json()) as any
        expect({
          ids: history.transcript.map((message: any) => message.info.id),
          history: history.history,
        }).toEqual({
          ids: messageIDs.slice(5, 9),
          history: expect.objectContaining({
            oldestMessageID: messageIDs[5],
            hasMore: true,
            limit: 4,
          }),
        })
      },
    })
  }, 30_000)
})
