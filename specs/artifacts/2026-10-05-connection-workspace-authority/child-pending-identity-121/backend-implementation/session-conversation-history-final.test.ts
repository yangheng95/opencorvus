import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { ensureMissionSession } from "../../src/mission/session"
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
  test.each(["assistant", "mission"] as const)(
    "cold %s history advances a bounded real control-only identity window",
    async (kind) => {
      await using project = await memoryProject(`control-only-history-${kind}`)
      const saved = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const session =
            kind === "mission"
              ? await ensureMissionSession({
                  missionID: "control-only-history",
                  defaultCwd: project.path,
                  productPillar: "code",
                  heldExpertSquadIDs: ["base"],
                })
              : await Session.create({ kind, title: "Control-only history" })
          const agent = kind === "mission" ? "mission" : "assistant"
          const inputID = Identifier.ascending("message")
          const started = Date.now() - 5000
          await Session.updateMessage({
            id: inputID,
            sessionID: session.id,
            role: "user",
            author: "user",
            agent,
            time: { created: started },
            model: { providerID: "historical", modelID: "historical" },
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: inputID,
            type: "text",
            text: "Read this bounded history",
          })
          const messageIDs: string[] = []
          const partIDs: string[] = []
          for (let index = 0; index < 2; index++) {
            const messageID = Identifier.ascending("message")
            await Session.updateMessage({
              id: messageID,
              parentID: inputID,
              sessionID: session.id,
              role: "assistant",
              author: agent,
              agent,
              providerID: "historical",
              modelID: "historical",
              time: { created: started + index + 1 },
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            })
            const partID = Identifier.ascending("part")
            await Session.updatePart({ id: partID, sessionID: session.id, messageID, type: "step-start" })
            messageIDs.push(messageID)
            partIDs.push(partID)
          }
          return { sessionID: session.id, inputID, messageIDs, partIDs }
        },
      })
      await Instance.disposeAll()
      Server.resetProjectRoutesAppForTest()
      const headers = { "x-opencorvus-directory": project.path }
      const tailResponse = await runOutsideInstanceContext(() =>
        Server.App().request(`/session/${saved.sessionID}/conversation?tail_limit=1`, { headers }),
      )
      expect(tailResponse.status).toBe(200)
      const tail = await tailResponse.json()
      expect(tail.transcript).toMatchObject([
        {
          info: { id: saved.messageIDs[1], sessionID: saved.sessionID },
          parts: [{ id: saved.partIDs[1], type: "step-start" }],
        },
      ])
      expect(tail.history).toMatchObject({ oldestMessageID: saved.messageIDs[1], hasMore: true, limit: 1 })
      expect(
        tail.view.sessions.find((session: { sessionID: string }) => session.sessionID === saved.sessionID).messageIDs,
      ).toEqual([saved.messageIDs[1]])
      const pageQuery = new URLSearchParams({
        before: String(tail.history.oldestTimestamp),
        before_order_key: tail.history.oldestOrderKey,
        before_id: tail.history.oldestMessageID,
        limit: "1",
      })
      const pageResponse = await runOutsideInstanceContext(() =>
        Server.App().request(`/session/${saved.sessionID}/conversation/history?${pageQuery}`, { headers }),
      )
      expect(pageResponse.status).toBe(200)
      const page = await pageResponse.json()
      expect(page.transcript).toMatchObject([
        { info: { id: saved.messageIDs[0] }, parts: [{ id: saved.partIDs[0], type: "step-start" }] },
      ])
      expect(page.history).toMatchObject({ oldestMessageID: saved.messageIDs[0], hasMore: true, limit: 1 })
      const inputQuery = new URLSearchParams({
        before: String(page.history.oldestTimestamp),
        before_order_key: page.history.oldestOrderKey,
        before_id: page.history.oldestMessageID,
        limit: "1",
      })
      const inputResponse = await runOutsideInstanceContext(() =>
        Server.App().request(`/session/${saved.sessionID}/conversation/history?${inputQuery}`, { headers }),
      )
      expect(inputResponse.status).toBe(200)
      const input = await inputResponse.json()
      expect(input.transcript).toMatchObject([
        { info: { id: saved.inputID }, parts: [{ type: "text", text: "Read this bounded history" }] },
      ])
      expect(input.view.messages.map((message: { messageID: string }) => message.messageID)).toEqual([saved.inputID])
      expect(input.history).toMatchObject({ oldestMessageID: saved.inputID, hasMore: false, limit: 1 })
    },
    30_000,
  )

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
