import { afterEach, describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Identifier } from "../../src/id/id"
import { Server } from "../../src/server/server"
import { SideChatIdentity, sideChatInstructions } from "../../src/chat/side-chat-identity"
import { EffectiveConfig } from "../../src/config/effective"
import { ensureMissionSession } from "../../src/mission/session"
import { LLM } from "../../src/session/llm"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function input(sessionID: string, text: string) {
  const id = Identifier.ascending("message")
  await Session.persistMessage({
    info: {
      id,
      sessionID,
      role: "user",
      author: "user",
      agent: "chat",
      model: { providerID: "test", modelID: "side-chat" },
      time: { created: Date.now() },
    },
    parts: [{ id: Identifier.ascending("part"), sessionID, messageID: id, type: "text", text }],
  })
  return id
}

async function reply(sessionID: string, parentID: string, text: string, completed = true) {
  const id = Identifier.ascending("message")
  await Session.persistMessage({
    info: {
      id,
      sessionID,
      role: "assistant",
      author: "chat",
      agent: "chat",
      parentID,
      acceptedInputMessageIDs: [parentID],
      providerID: "test",
      modelID: "side-chat",
      cost: 0,
      path: { cwd: Instance.directory, root: Instance.worktree },
      tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      ...(completed ? { finish: "stop" } : {}),
      time: { created: Date.now(), ...(completed ? { completed: Date.now() } : {}) },
    },
    parts: [{ id: Identifier.ascending("part"), sessionID, messageID: id, type: "text", text }],
  })
  return id
}

describe("source-scoped side conversations", () => {
  for (const kind of ["assistant", "root", "mission"] as const) {
    test(`${kind} source creates an independent root from complete history through the real routes`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const source =
            kind === "mission"
              ? await ensureMissionSession({
                  missionID: "side-chat-source",
                  defaultCwd: project.path,
                  productPillar: "code",
                  heldExpertSquadIDs: ["base"],
                })
              : await Session.create({ kind, title: "Main work" })
          await Session.mergeMetadata({ sessionID: source.id, patch: { configOverlay: { model: "test/side-chat" } } })
          const first = await input(source.id, "Explain the design")
          await reply(source.id, first, "The design uses independent sessions.")
          const pending = await input(source.id, "Continue the main task")
          await reply(source.id, pending, "Still working", false)
          const headers = { "x-opencorvus-directory": project.path }
          const response = await Server.App().request(`/session/${source.id}/side-chat`, { method: "POST", headers })
          expect(response.status).toBe(200)
          const side = (await response.json()) as Session.Info
          const identity = SideChatIdentity.parse(side.metadata?.sideChat)
          const history = await Session.messages({ sessionID: side.id })
          expect({
            kind: side.kind,
            source: identity.sourceSessionID,
            ids: identity.inheritedMessageIDs,
            texts: history.map((message) =>
              message.parts.map((part) => (part.type === "text" ? part.text : "")).join(""),
            ),
            sideTree: await Session.treeInProject({ sessionID: side.id, projectID: side.projectID }),
            sourceTree: await Session.treeInProject({ sessionID: source.id, projectID: source.projectID }),
            overlay: await EffectiveConfig.overlay({ sessionID: side.id }),
          }).toEqual({
            kind: "assistant",
            source: source.id,
            ids: history.map((message) => message.info.id),
            texts: ["Explain the design", "The design uses independent sessions."],
            sideTree: [side.id],
            sourceTree: [source.id],
            overlay: { model: "test/side-chat" },
          })
          const copiedReply = history[1]!.info
          expect(copiedReply.role === "assistant" && copiedReply.acceptedInputMessageIDs).toEqual([history[0]!.info.id])
          const question = await input(side.id, "> independent sessions\n\nWhy?")
          await reply(side.id, question, "Each session owns its own execution.")
          const list = await Server.App().request(`/session/${source.id}/side-chat`, { headers })
          expect(((await list.json()) as Session.Info[]).map((item) => item.id)).toEqual([side.id])
          const view = await Server.App().request(`/session/${side.id}/conversation`, { headers })
          expect(view.status).toBe(200)
          const payload = (await view.json()) as any
          expect(payload.transcript.map((message: any) => message.parts[0]?.text)).toEqual([
            "Explain the design",
            "The design uses independent sessions.",
            "> independent sessions\n\nWhy?",
            "Each session owns its own execution.",
          ])
          expect((await Session.messages({ sessionID: source.id })).length).toBe(4)
          const system = await LLM.composeSystem({
            sessionID: side.id,
            agentID: "chat",
            agent: { options: {}, prompt: "Primary assistant" },
            model: {} as never,
            system: [],
          })
          expect(system.join("\n")).toContain(sideChatInstructions(identity))
          const nested = await Server.App().request(`/session/${side.id}/side-chat`, { method: "POST", headers })
          expect(nested.status).toBe(400)
          expect(await nested.json()).toMatchObject({
            name: "SideChatSourceError",
            data: { reason: "nested", sessionID: side.id },
          })
        },
      })
    }, 60_000)
  }

  test("project authority resolves an exact not-found response for a foreign source", async () => {
    await using first = await memoryProject("side-chat-source")
    await using second = await memoryProject("side-chat-other")
    const source = await Instance.provide({ directory: first.path, fn: () => Session.create({ kind: "assistant" }) })
    await Instance.provide({
      directory: second.path,
      fn: async () => {
        const response = await Server.App().request(`/session/${source.id}/side-chat`, {
          method: "POST",
          headers: { "x-opencorvus-directory": second.path },
        })
        expect(response.status).toBe(404)
        expect(await response.json()).toMatchObject({ name: "NotFoundError" })
      },
    })
  }, 60_000)
})
