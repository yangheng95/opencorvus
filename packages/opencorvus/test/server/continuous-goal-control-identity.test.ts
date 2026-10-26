import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "@/config/paths"
import { createRightSidebarConversationSession } from "@/chat/session"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { readContinuousGoal, resolveGoalOwner } from "@/continuous-goal/store"
import { Server } from "@/server/server"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("cold Goal controls persist decisions for Chat and Work with unavailable models", async () => {
  await using project = await memoryProject("goal-controls-owner")
  await using other = await memoryProject("goal-controls-other")
  const sessions = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => [
    await createRightSidebarConversationSession("chat", { title: "Goal Chat controls" }),
    await createRightSidebarConversationSession("work", { title: "Goal Work controls" }),
  ] })
  for (const directory of [project.path, other.path]) {
    const config = ConfigPaths.projectFile(directory)
    await fs.mkdir(path.dirname(config), { recursive: true })
    await fs.writeFile(config, JSON.stringify({ model: "goal-controls-unavailable/model" }))
  }
  const request = async (sessionID: string, method: string, body?: object, directory = project.path) => {
    await Instance.disposeAll()
    return runOutsideInstanceContext(() => Server.App().request(`/continuous-goal/chat/${sessionID}`, {
      method, headers: { "x-opencorvus-directory": directory, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }))
  }
  for (const session of sessions) {
    const created = await request(session.id, "POST", {
      requestID: `create-${session.id}`, objective: `Review ${session.title}`, turnBudget: 1,
    })
    expect(created.status).toBe(200)
    let current = await created.json()
    expect(current).toMatchObject({ owner: { kind: "chat", id: session.id }, status: "active", turnBudget: 1 })
    for (const [stage, values] of [
      ["pause", { status: "paused", reason: "Operator paused the goal" }],
      ["budget", { status: "paused", reason: "Reviewed explicit limits", tokenBudget: 65000, turnBudget: 3 }],
      ["complete", { status: "complete", reason: "Operator reviewed the recorded result" }],
    ] as const) {
      const input = { requestID: `${stage}-${session.id}`, goalID: current.id, expectedRevision: current.revision, ...values }
      const updated = await request(session.id, "PATCH", input)
      expect(updated.status).toBe(200)
      current = await updated.json()
      expect(current).toMatchObject({ id: input.goalID, owner: { kind: "chat", id: session.id }, ...values })
      const replay = await request(session.id, "PATCH", input)
      expect({ status: replay.status, goal: await replay.json() }).toEqual({ status: 200, goal: current })
    }
    const read = await request(session.id, "GET")
    expect({ status: read.status, goal: await read.json() }).toEqual({ status: 200, goal: current })
    const stored = await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
      readContinuousGoal(resolveGoalOwner({ kind: "chat", id: session.id })),
    })
    expect(stored).toEqual(current)
    const crossProject = await request(session.id, "GET", undefined, other.path)
    expect({ status: crossProject.status, body: await crossProject.json() }).toMatchObject({
      status: 409, body: { name: "ContinuousGoalError", data: { code: "owner_unavailable" } },
    })
    const execution = await runOutsideInstanceContext(() => Server.App().request(`/session/${session.id}/config`, {
      headers: { "x-opencorvus-directory": project.path },
    }))
    expect({ status: execution.status, body: await execution.json() }).toMatchObject({
      status: 400, body: { name: "ProviderModelNotFoundError", data: { providerID: "goal-controls-unavailable", modelID: "model" } },
    })
  }
}, 60_000)
