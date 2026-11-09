import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { currentMissionExecutionClosure } from "@/mission/execution-closure"
import { Instance } from "@/project/instance"
import { provideInitializedProjectExecution } from "@/project/independent-project-owner"
import { serverErrorResponse } from "@/server/error-handler"
import { MissionRoutes } from "@/server/routes/mission"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("first Mission wakes join the same authored occurrence across concurrent requests and honor its closed boundary", async () => {
  await using project = await memoryProject("first-mission-wake-replay")
  await using other = await memoryProject("first-mission-wake-sibling")
  const model = "first-mission-replay/offline"
  for (const directory of [project.path, other.path]) {
    await Instance.provide({
      directory,
      fn: () => Config.updateProjectPatch({
        model,
        provider: {
          "first-mission-replay": {
            name: "Mission first wake local catalog",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:1/v1",
            models: Object.fromEntries(["offline", "replacement"].map((id) => [
              id, {
                name: id,
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 32_000, output: 4_096 },
              },
            ])),
          },
        },
      }),
    })
    await provideInitializedProjectExecution({ directory, fn: async () => undefined })
  }
  // This focused contract exercises the actual route and durable acceptance.
  // Provider execution is outside the scope of the assertion.
  using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  const app = new Hono().onError(serverErrorResponse).route("/mission", MissionRoutes())
  const call = async (directory: string, route: string, input: object) => {
    const response = await Instance.provide({
      directory,
      fn: () => app.request(route, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
    })
    return { status: response.status, body: await response.json() }
  }
  const input = {
    requestID: "same-first-launch",
    text: "Accept this Mission once.",
    productPillar: "work",
    expertSquadIDs: ["base"],
    model,
    attachments: [{ mime: "text/plain", filename: "scope.txt", data: "U2NvcGU=" }],
  }
  const wake = (directory: string, body = input) => call(directory, "/mission/wake", body)
  const [first, parallel] = await Promise.all([wake(project.path), wake(project.path)])
  expect(first).toMatchObject({ status: 200, body: { created: true, productPillar: "work" } })
  expect(parallel).toEqual(first)
  expect(await wake(project.path)).toEqual(first)
  expect(await call(project.path, "/mission/wake", { ...input, missionID: first.body.missionID })).toEqual({
    status: 200, body: { ...first.body, created: false },
  })
  const actual = await Instance.provide({
    directory: project.path,
    fn: async () => ({
      closure: currentMissionExecutionClosure(first.body.sessionID),
      messages: (await Session.messages({ sessionID: first.body.sessionID })).filter(({ info }) => info.role === "user"),
    }),
  })
  expect(actual.closure).toMatchObject({
    state: "opened", source: "mission.wake", requestID: input.requestID, missionID: first.body.missionID,
  })
  expect(actual.messages).toMatchObject([{ parts: [
    { type: "text", text: input.text },
    { type: "file", mime: "text/plain", filename: "scope.txt", presentation: "attachment-index" },
  ] }])
  const sibling = await wake(other.path)
  expect(sibling).toMatchObject({ status: 200, body: { created: true, productPillar: "work" } })
  expect(new Set([first.body.sessionID, sibling.body.sessionID]).size).toBe(2)
  await Instance.provide({
    directory: project.path,
    fn: () => Config.updateProjectPatch({
      model: "first-mission-replay/replacement",
      provider: { "first-mission-replay": { models: { offline: null } } },
    }),
  })
  expect(await Promise.all([wake(project.path), wake(project.path), wake(other.path)])).toEqual([first, first, sibling])
  const retained = (await Session.messages({ sessionID: first.body.sessionID })).filter(({ info }) => info.role === "user")
  expect(retained).toEqual(actual.messages)
  expect(await wake(project.path, { ...input, text: "A different author input." })).toMatchObject({
    status: 409, body: { name: "MissionExecutionWakeInputConflictError" },
  })
  expect(await call(project.path, `/mission/${first.body.missionID}/abort`, {
    surface: "api", reason: "Close the exact accepted first occurrence.",
  })).toEqual({ status: 200, body: true })
  expect(await wake(project.path)).toMatchObject({
    status: 409, body: { name: "MissionExecutionWakeClosedError", data: { sessionID: first.body.sessionID, state: "closed" } },
  })
}, 60_000)
