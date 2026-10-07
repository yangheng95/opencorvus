import { afterEach, describe, expect, test } from "bun:test"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "../../src/config/paths"
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
  test("cold side-history list retains persisted references with missing current model and exact Project authority", async () => {
    await using project = await memoryProject("cold-side-history")
    await using other = await memoryProject("cold-side-history-other")
    const saved = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = await Session.create({ kind: "root", title: "Persisted main task" })
        const request = await input(source.id, "Original complete source question")
        await reply(source.id, request, "Original complete source answer")
        const first = await Session.fork({ sessionID: source.id, purpose: "side-chat" })
        const second = await Session.fork({ sessionID: source.id, purpose: "side-chat" })
        const emptySource = await Session.create({ kind: "assistant", title: "Empty side list source" })
        return { source, first, second, emptySource }
      },
    })
    const configPath = ConfigPaths.projectFile(project.path)
    await fs.mkdir(path.dirname(configPath), { recursive: true })
    await fs.writeFile(configPath, JSON.stringify({ model: "missing-side-provider/missing-side-model" }))
    await Instance.disposeAll()
    Server.resetProjectRoutesAppForTest()
    const headers = { "x-opencorvus-directory": project.path }
    const config = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.source.id}/config`, { headers }),
    )
    expect({ status: config.status, body: await config.json() }).toMatchObject({
      status: 400,
      body: {
        name: "ProviderModelNotFoundError",
        data: { providerID: "missing-side-provider", modelID: "missing-side-model" },
      },
    })
    await Instance.disposeAll()
    const list = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.source.id}/side-chat`, { headers }),
    )
    expect(list.status).toBe(200)
    const sides = (await list.json()) as Session.Info[]
    expect(
      sides
        .map((side) => ({
          id: side.id,
          projectID: side.projectID,
          kind: side.kind,
          source: SideChatIdentity.parse(side.metadata?.sideChat).sourceSessionID,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    ).toEqual(
      [saved.first, saved.second]
        .map((side) => ({ id: side.id, projectID: saved.source.projectID, kind: "assistant", source: saved.source.id }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    )
    const actualCreationTimes = sides.map((side) => side.time.created)
    expect(actualCreationTimes).toEqual([...actualCreationTimes].sort((left, right) => right - left))
    const conversation = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.second.id}/conversation`, { headers }),
    )
    expect(conversation.status).toBe(200)
    const body = (await conversation.json()) as { transcript: Array<{ parts: Array<{ type: string; text?: string }> }> }
    expect(
      body.transcript.map((message) => message.parts.filter((part) => part.type === "text").map((part) => part.text)),
    ).toEqual([["Original complete source question"], ["Original complete source answer"]])
    await Instance.disposeAll()
    const empty = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.emptySource.id}/side-chat`, { headers }),
    )
    expect({ status: empty.status, body: await empty.json() }).toEqual({ status: 200, body: [] })
    await Instance.disposeAll()
    const foreign = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.source.id}/side-chat`, {
        headers: { "x-opencorvus-directory": other.path },
      }),
    )
    expect({ status: foreign.status, body: await foreign.json() }).toMatchObject({
      status: 404,
      body: { name: "NotFoundError", data: { message: `Session not found: ${saved.source.id}` } },
    })
    await Instance.disposeAll()
    const create = await runOutsideInstanceContext(() =>
      Server.App().request(`/session/${saved.source.id}/side-chat`, { method: "POST", headers }),
    )
    expect({ status: create.status, body: await create.json() }).toMatchObject({
      status: 400,
      body: {
        name: "ProviderModelNotFoundError",
        data: { providerID: "missing-side-provider", modelID: "missing-side-model" },
      },
    })
  }, 60_000)

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
