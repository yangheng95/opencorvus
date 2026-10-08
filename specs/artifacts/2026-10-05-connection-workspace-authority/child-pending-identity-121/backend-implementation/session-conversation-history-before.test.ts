import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import fs from "node:fs/promises"
import path from "node:path"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

describe("session conversation history", () => {
  test("cold persisted tail and preceding page retain real messages while current execution config has a missing model", async () => {
    await using project = await memoryProject("cold-history-missing-model")
    const saved = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Cold persisted history" })
        const messageIDs: string[] = []
        for (let index = 0; index < 4; index++) {
          const message = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "user",
            time: { created: Date.now() - 5000 + index },
            model: { providerID: "historical-provider", modelID: "historical-model" },
          })
          messageIDs.push(message.id)
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: message.id,
            type: "text",
            text: `Cold historical body ${index}`,
          })
        }
        return { sessionID: session.id, messageIDs }
      },
    })
    await fs.mkdir(path.join(project.path, ".opencorvus"), { recursive: true })
    await fs.writeFile(
      path.join(project.path, ".opencorvus", "opencorvus.jsonc"),
      JSON.stringify({ model: "missing-history-provider/missing-history-model" }),
    )
    await Instance.disposeAll()
    Server.resetProjectRoutesAppForTest()
    const headers = { "x-opencorvus-directory": project.path }
    const config = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.sessionID}/config`, { headers }),
    )
    expect({ status: config.status, body: await config.json() }).toMatchObject({
      status: 400,
      body: {
        name: "ProviderModelNotFoundError",
        data: { providerID: "missing-history-provider", modelID: "missing-history-model" },
      },
    })
    await Instance.disposeAll()
    const tailResponse = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.sessionID}/conversation?tail_limit=2`, { headers }),
    )
    expect(tailResponse.status).toBe(200)
    const tail = (await tailResponse.json()) as {
      transcript: Array<{ info: { id: string }; parts: Array<{ type: string; text?: string }> }>
      history: { oldestTimestamp: number; oldestOrderKey: string; oldestMessageID: string; hasMore: boolean }
    }
    expect(
      tail.transcript.map((message) => ({
        id: message.info.id,
        text: message.parts.filter((part) => part.type === "text").map((part) => part.text),
      })),
    ).toEqual(saved.messageIDs.slice(-2).map((id, index) => ({ id, text: [`Cold historical body ${index + 2}`] })))
    expect(tail.history).toMatchObject({ oldestMessageID: saved.messageIDs[2], hasMore: true })
    await Instance.disposeAll()
    const params = new URLSearchParams({
      before: String(tail.history.oldestTimestamp),
      before_order_key: tail.history.oldestOrderKey,
      before_id: tail.history.oldestMessageID,
      limit: "2",
    })
    const pageResponse = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.sessionID}/conversation/history?${params}`, { headers }),
    )
    const page = (await pageResponse.json()) as { transcript?: typeof tail.transcript; history?: { hasMore: boolean } }
    expect({ status: pageResponse.status, body: page }).toMatchObject({
      status: 200,
      body: { history: { hasMore: false } },
    })
    expect(
      page.transcript!.map((message) => ({
        id: message.info.id,
        text: message.parts.filter((part) => part.type === "text").map((part) => part.text),
      })),
    ).toEqual(saved.messageIDs.slice(0, 2).map((id, index) => ({ id, text: [`Cold historical body ${index}`] })))
  }, 30_000)

  test("cold historical reads reject another real Project's Session with the typed404 contract", async () => {
    await using owner = await memoryProject("history-owner-project")
    await using foreign = await memoryProject("history-foreign-project")
    const sessionID = await Instance.provide({
      directory: owner.path,
      fn: async () => (await Session.create({ kind: "assistant", title: "Owner-only historical Session" })).id,
    })
    await Instance.disposeAll()
    const response = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${sessionID}/conversation?tail_limit=2`, {
        headers: { "x-opencorvus-directory": foreign.path },
      }),
    )
    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 404,
      body: { name: "NotFoundError", data: { message: `Session not found: ${sessionID}` } },
    })
  }, 30_000)

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
        const hydrateResponse = await Server.App().request(`/session/${session.id}/conversation?tail_limit=3`, {
          headers,
        })
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
