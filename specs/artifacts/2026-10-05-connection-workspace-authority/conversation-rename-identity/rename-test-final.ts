import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Bus } from "@/bus"
import { ConfigPaths } from "@/config/paths"
import { createRightSidebarConversationSession } from "@/chat/session"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Session } from "@/session"
import { Server } from "@/server/server"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("cold Chat and Work rename persist real titles and publish updates without an executable model", async () => {
  await using project = await memoryProject("rename-owner70")
  await using other = await memoryProject("rename-other70")
  const updates: Array<{ id: string; title: string; projectID: string; directory: string; updated: number }> = []
  let stopUpdates = () => {}
  const fixture = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const chat = await createRightSidebarConversationSession("chat", { title: "Original Chat" })
      const work = await createRightSidebarConversationSession("work", { title: "Original Work" })
      stopUpdates = Bus.subscribe(Session.Event.Updated, (event) => {
        const info = event.properties.info
        if (info.id === chat.id || info.id === work.id) {
          updates.push({
            id: info.id,
            title: info.title,
            projectID: info.projectID,
            directory: info.directory,
            updated: info.time.updated,
          })
        }
      })
      return { chat, work, projectID: Instance.project.id }
    },
  })
  const config = ConfigPaths.projectFile(project.path)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(
    config,
    JSON.stringify({ model: "rename-unavailable/model", small_model: "rename-unavailable/model" }),
  )
  const patch = (experience: "chat" | "work", sessionID: string, directory: string, title: string) =>
    Server.App().request(`/coding/${experience}/session/${sessionID}`, {
      method: "PATCH",
      headers: { "x-opencorvus-directory": directory, "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
  try {
    await runOutsideInstanceContext(async () => {
      for (const [experience, original, title] of [
        ["chat", fixture.chat, "重命名 Chat 🙂"],
        ["work", fixture.work, "重命名 Work 文档"],
      ] as const) {
        const response = await patch(experience, original.id, project.path, `  ${title}  `)
        const body = await response.json()
        if (response.status !== 200) console.log("cold rename original response", response.status, body)
        expect({ status: response.status, session: body.session }).toMatchObject({
          status: 200,
          session: {
            id: original.id,
            title,
            projectID: fixture.projectID,
            directory: project.path,
            kind: "assistant",
            metadata: { conversation: { surface: "right-sidebar", experience } },
          },
        })
        const stored = await Session.get(original.id)
        expect({ title: stored.title, updated: stored.time.updated }).toEqual({
          title,
          updated: body.session.time.updated,
        })
        await Database.awaitEffectIdle(5_000)
        expect(updates.at(-1)).toEqual({
          id: original.id,
          title,
          projectID: fixture.projectID,
          directory: project.path,
          updated: stored.time.updated,
        })
      }
      const crossProject = await patch("work", fixture.work.id, other.path, "Other Project title")
      expect({ status: crossProject.status, body: await crossProject.json() }).toMatchObject({
        status: 404,
        body: { name: "NotFoundError" },
      })
      const wrongExperience = await patch("chat", fixture.work.id, project.path, "Wrong experience title")
      expect({ status: wrongExperience.status, body: await wrongExperience.json() }).toEqual({
        status: 404,
        body: { name: "NotFoundError", data: { message: `Chat session not found: ${fixture.work.id}` } },
      })
      for (const title of ["   ", "x".repeat(201)]) {
        const invalid = await patch("work", fixture.work.id, project.path, title)
        const body = await invalid.json()
        expect({
          status: invalid.status,
          message: body.data?.message,
          issuePaths: body.error?.map((issue: { path: string[] }) => issue.path),
        }).toEqual({ status: 400, message: "Request validation failed", issuePaths: [["title"]] })
      }
      const executionConfig = await Server.App().request(`/session/${fixture.work.id}/config`, {
        headers: { "x-opencorvus-directory": project.path },
      })
      expect({ status: executionConfig.status, body: await executionConfig.json() }).toMatchObject({
        status: 400,
        body: {
          name: "ProviderModelNotFoundError",
          data: { providerID: "rename-unavailable", modelID: "model", suggestions: [] },
        },
      })
      expect(updates.map(({ id, title }) => ({ id, title }))).toEqual([
        { id: fixture.chat.id, title: "重命名 Chat 🙂" },
        { id: fixture.work.id, title: "重命名 Work 文档" },
      ])
    })
  } finally {
    stopUpdates()
  }
})
