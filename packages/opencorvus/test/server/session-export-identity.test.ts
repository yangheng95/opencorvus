import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createRightSidebarConversationSession } from "@/chat/session"
import { ConfigPaths } from "@/config/paths"
import { Identifier } from "@/id/id"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function unavailableModel(directory: string) {
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ model: "export-unavailable/model", small_model: "export-unavailable/model" }))
}

async function read(directory: string, sessionID: string) {
  await Instance.disposeAll()
  const response = await runOutsideInstanceContext(() => Server.App().request(
    `/export/session/${sessionID}`,
    { headers: { "x-opencorvus-directory": directory } },
  ))
  return { status: response.status, body: await response.json() }
}

for (const experience of ["chat", "work"] as const) {
  test(`cold ${experience} export returns all original messages and parts beyond a history page`, async () => {
    await using project = await memoryProject(`export-${experience}`)
    const original = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
      const session = await createRightSidebarConversationSession(experience, { title: `原始 ${experience} 对话` })
      const ids: string[] = []
      const texts: string[] = []
      for (let index = 0; index < 120; index++) {
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"), sessionID: session.id, author: "user", role: "user",
          time: { created: index + 1 }, agent: experience,
          model: { providerID: "fixture", modelID: "retained-export" },
        })
        const text = `原文 ${index}\nJSON 特殊字符：" \\ < > &\n🙂`
        await Session.updatePart({ id: Identifier.ascending("part"), messageID: message.id, sessionID: session.id, type: "text", text })
        ids.push(message.id)
        texts.push(text)
      }
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"), sessionID: session.id, parentID: ids.at(-1)!, author: experience,
        role: "assistant", agent: experience, time: { created: 121 },
        providerID: "fixture", modelID: "retained-export", path: { cwd: project.path, root: project.path },
        cost: 0, tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const reply = "完整回复\n保留原始换行和 Unicode。"
      await Session.updatePart({ id: Identifier.ascending("part"), messageID: assistant.id, sessionID: session.id, type: "text", text: reply })
      await Session.updateMessage({ ...assistant, time: { created: 121, completed: 122 } })
      return { session, ids: [...ids, assistant.id], texts: [...texts, reply] }
    } })
    await unavailableModel(project.path)
    const result = await read(project.path, original.session.id)
    expect(result.status).toBe(200)
    expect(result.body.session).toEqual({ id: original.session.id, title: original.session.title, time: original.session.time })
    expect(result.body.messages.map((message: any) => message.info.id)).toEqual(original.ids)
    expect(result.body.messages.map((message: any) => message.parts.map((part: any) => part.text))).toEqual(original.texts.map(text => [text]))
    expect(result.body.messages.at(-1).info).toMatchObject({ role: "assistant", author: experience, time: { created: 121, completed: 122 } })
  }, 60_000)
}

test("session export returns the exact not-found contract for another Project and a missing Session", async () => {
  await using owner = await memoryProject("export-owner")
  await using other = await memoryProject("export-other")
  const session = await Instance.provideProjectIdentity({ directory: owner.path, fn: () =>
    createRightSidebarConversationSession("chat", { title: "Owned conversation" }),
  })
  await unavailableModel(owner.path)
  await unavailableModel(other.path)
  for (const target of [
    { directory: other.path, sessionID: session.id },
    { directory: owner.path, sessionID: Identifier.ascending("session") },
  ]) {
    expect(await read(target.directory, target.sessionID)).toEqual({
      status: 404,
      body: { name: "NotFoundError", data: { message: `Session not found: ${target.sessionID}` } },
    })
  }
  expect(await read(owner.path, session.id)).toEqual({
    status: 200, body: { session: { id: session.id, title: session.title, time: session.time }, messages: [] },
  })
}, 30_000)
