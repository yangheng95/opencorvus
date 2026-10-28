import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "@/config/paths"
import { GlobalBus } from "@/bus/global"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Project } from "@/project/project"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("Project rename persists canonical metadata with a serving lease and unavailable execution model", async () => {
  await using project = await memoryProject("project-rename-owner773")
  await using other = await memoryProject("project-rename-other773")
  const originals = await Promise.all([project, other].map((owner) =>
    Instance.provideProjectIdentity({ directory: owner.path, fn: () => Instance.project }),
  ))
  for (const owner of [project, other]) {
    const config = ConfigPaths.projectFile(owner.path)
    await fs.mkdir(path.dirname(config), { recursive: true })
    await fs.writeFile(config, JSON.stringify({ model: "rename-unavailable/model", small_model: "rename-unavailable/model" }))
  }
  const updates: Array<{ id: string; name?: string }> = []
  const onEvent = (event: any) => {
    if (event.payload.type === Project.Event.Updated.type) updates.push(event.payload.properties)
  }
  GlobalBus.on("event", onEvent)
  const request = (directory: string, name?: string) => Server.App().request("/project/current", {
    method: name === undefined ? "GET" : "PATCH",
    headers: { "x-opencorvus-directory": directory, "Content-Type": "application/json" },
    ...(name === undefined ? {} : { body: JSON.stringify({ name }) }),
  })
  try {
    await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
      expect(Instance.project.id).toBe(originals[0].id)
      await runOutsideInstanceContext(async () => {
        const renamed = await request(project.path, "项目体验773")
        expect({ status: renamed.status, project: await renamed.json() }).toMatchObject({
          status: 200, project: { id: originals[0].id, name: "项目体验773", worktree: originals[0].worktree },
        })
        const current = await request(project.path)
        expect({ status: current.status, project: await current.json() }).toMatchObject({
          status: 200, project: { id: originals[0].id, name: "项目体验773", worktree: originals[0].worktree },
        })
        const renamedOther = await request(other.path, "Comparison Project 773")
        expect({ status: renamedOther.status, project: await renamedOther.json() }).toMatchObject({
          status: 200, project: { id: originals[1].id, name: "Comparison Project 773", worktree: originals[1].worktree },
        })
        const invalid = await request(project.path, "   ")
        expect({ status: invalid.status, body: await invalid.json() }).toMatchObject({
          status: 400, body: { data: { message: "Request validation failed" }, success: false },
        })
      })
      expect(Project.get(Instance.project.id)).toMatchObject({ id: originals[0].id, name: "项目体验773" })
    } })
    expect(updates.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: originals[0].id, name: "项目体验773" },
      { id: originals[1].id, name: "Comparison Project 773" },
    ])
    await Instance.disposeAll()
    await runOutsideInstanceContext(async () => {
      const reopened = await request(project.path)
      expect({ status: reopened.status, project: await reopened.json() }).toMatchObject({
        status: 200, project: { id: originals[0].id, name: "项目体验773", worktree: originals[0].worktree },
      })
    })
  } finally {
    GlobalBus.off("event", onEvent)
  }
})
