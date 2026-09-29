import { afterEach, expect, spyOn, test } from "bun:test"
import { Server } from "@/server/server"
import { Instance } from "@/project/instance"
import { currentRuntimeOccurrenceID } from "@/runtime/process-occurrence"
import { observeProcessLiveness } from "@/engine/process-liveness"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("serves initialized, reopened and new Projects over HTTP after an eight-hour wall-clock jump", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  await using third = await memoryProject()
  const app = Server.App()
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  const read = async (directory: string, route: string) => {
    const response = await fetch(new URL(route, server.url), { headers: { "x-opencorvus-directory": directory } })
    const body = await response.json()
    expect({ route, status: response.status }).toEqual({ route, status: 200 })
    return body
  }
  try {
    const prior = await read(first.path, "/project/current")
    await read(first.path, "/config")
    await read(second.path, "/config")
    const resumedNow = Date.now() + 8 * 60 * 60 * 1000
    const clock = spyOn(Date, "now").mockReturnValue(resumedNow)
    try {
      for (const project of [first, second, third]) {
        for (const route of ["/project/current", "/config", "/session", "/agent"]) await read(project.path, route)
      }
      await Instance.provide({ directory: first.path, fn: () => Instance.dispose() })
      expect((await read(first.path, "/project/current")).id).toBe(prior.id)
      await read(first.path, "/config")
      const response = await fetch(new URL("/session", server.url), {
        method: "POST",
        headers: { "x-opencorvus-directory": first.path, "content-type": "application/json" },
        body: JSON.stringify({ kind: "root", title: "Created after wake" }),
      })
      const created = (await response.json()) as { id: string; title: string }
      expect({ status: response.status, title: created.title }).toEqual({ status: 200, title: "Created after wake" })
      expect((await read(first.path, `/session/${created.id}`)).id).toBe(created.id)
      expect(await read(first.path, "/global/health")).toMatchObject({ healthy: true })
      expect(observeProcessLiveness(currentRuntimeOccurrenceID())).toBe("exact_live")
    } finally {
      clock.mockRestore()
    }
  } finally {
    await server.stop(true)
  }
}, 60_000)
