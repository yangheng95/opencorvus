import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import { Hono } from "hono"
import { MissionSessionTestHooks } from "@/mission/session"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { MissionRoutes } from "@/server/routes/mission"
import { serverErrorResponse } from "@/server/error-handler"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("a concurrent Mission draft replay joins the complete committed Session before runtime materialization", async () => {
  await using project = await memoryProject("mission-draft-creation-replay")
  await using other = await memoryProject("mission-draft-creation-other")
  const app = new Hono().onError(serverErrorResponse).route("/mission", MissionRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => Instance.provide({
      directory: new URL(request.url).searchParams.get("directory") ?? project.path,
      fn: async () => app.fetch(request),
    }),
  })
  const call = async (route: string, options: { method?: string; input?: unknown; directory?: string } = {}) => {
    const url = new URL(`/mission${route}`, server.url)
    url.searchParams.set("directory", options.directory ?? project.path)
    const response = await fetch(url, {
      method: options.method ?? "GET",
      ...(options.input === undefined ? {} : {
        headers: { "content-type": "application/json" },
        body: JSON.stringify(options.input),
      }),
    })
    return { status: response.status, body: await response.json() }
  }
  const input = {
    requestID: "one-manual-draft",
    title: "One backlog Mission",
    request: "Review the exact author request.",
    productPillar: "work",
    expertSquadIDs: ["base"],
  }
  const save = (options?: { input?: typeof input; directory?: string }) => call("/draft", {
    ...options, method: "POST", input: options?.input ?? input,
  })
  const cut = Promise.withResolvers<{ sessionID: string; missionID: string }>()
  const resume = Promise.withResolvers<void>()
  let held = false
  using _hook = MissionSessionTestHooks.installBeforeRuntimeMaterialization(async (target) => {
    if (held) return
    held = true
    cut.resolve(target)
    await resume.promise
  })
  const first = save()
  try {
    const target = await Promise.race([
      cut.promise,
      first.then((response) => { throw new Error(`Draft bypassed the materialization boundary: ${JSON.stringify(response)}`) }),
    ])
    expect(await Session.get(target.sessionID)).toMatchObject({
      title: input.title,
      metadata: { mission: {
        id: target.missionID,
        pendingPrompt: { text: input.request },
        draftCreation: { version: 1, requestID: input.requestID },
        visibleExpertSquadIDs: ["base"],
      } },
    })
    const replay = await save()
    expect(replay).toMatchObject({
      status: 200,
      body: { ...target, title: input.title, boardLane: "backlog", pendingPrompt: { text: input.request } },
    })
    expect((await fs.stat(ProjectRuntimePaths.missionRoot(project.path, target.missionID))).isDirectory()).toBe(true)
    resume.resolve()
    expect(await first).toEqual(replay)

    const edited = "Review the updated request in 中文."
    expect(await call(`/${target.missionID}/draft`, {
      method: "PATCH", input: { expectedRequest: input.request, request: edited },
    })).toMatchObject({ status: 200, body: { ...target, pendingPrompt: { text: edited } } })
    expect(await save()).toMatchObject({ status: 200, body: { ...target, pendingPrompt: { text: edited } } })
    expect(await save({ input: { ...input, request: edited } })).toMatchObject({
      status: 409,
      body: { name: "MissionDraftCreationConflictError", data: { ...target, reason: "identity" } },
    })

    const independent = await save({ input: { ...input, requestID: "a-separate-manual-draft" } })
    const elsewhere = await save({ directory: other.path })
    expect(independent).toMatchObject({ status: 200, body: { directory: project.path, title: input.title } })
    expect(elsewhere).toMatchObject({ status: 200, body: { directory: other.path, title: input.title } })
    expect(new Set([target, independent.body, elsewhere.body].map((row) => row.sessionID)).size).toBe(3)
    expect(new Set([target, independent.body, elsewhere.body].map((row) => row.missionID)).size).toBe(3)
  } finally {
    resume.resolve()
    await first.catch(() => undefined)
    await server.stop(true)
  }
})
