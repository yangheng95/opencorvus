import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { provideInitializedProjectExecution } from "@/project/independent-project-owner"
import {
  editMissionPendingPrompt,
  ensureMissionSession,
  missionPendingPrompt,
  setMissionPendingPrompt,
} from "@/mission/session"
import { MissionExecutionClosureTestHooks } from "@/mission/execution-closure"
import { MissionRoutes } from "@/server/routes/mission"
import { serverErrorResponse } from "@/server/error-handler"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("HTTP Mission draft editing preserves exact values across concurrency, dispatch, archive and database reopen", async () => {
  await using project = await memoryProject("draft-edit-main")
  await using otherProject = await memoryProject("draft-edit-other")
  const model = "draft-edit/base"
  for (const directory of [project.path, otherProject.path]) {
    await Instance.provide({
      directory,
      fn: () =>
        Config.updateProjectPatch({
          model,
          provider: {
            "draft-edit": {
              name: "Draft admission contract",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: {
                base: {
                  name: "base",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 32_000, output: 4_096 },
                },
              },
            },
          },
        }),
    })
    await provideInitializedProjectExecution({ directory, fn: async () => undefined })
  }
  // HTTP and SQLite acceptance are real; model execution belongs to the separate live-provider checker.
  using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  const app = new Hono().onError(serverErrorResponse).route("/mission", MissionRoutes())
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) =>
      Instance.provide({
        directory: new URL(request.url).searchParams.get("directory") ?? project.path,
        fn: async () => app.fetch(request),
      }),
  })
  const request = async (method: string, route: string, body?: unknown, directory = project.path) => {
    const url = new URL(`/mission${route}`, server.url)
    url.searchParams.set("directory", directory)
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return { status: response.status, body: await response.json() }
  }
  const create = async (title: string, text: string) => {
    const result = await request("POST", "/draft", {
      title,
      request: text,
      productPillar: "work",
      expertSquadIDs: ["base"],
    })
    expect(result).toMatchObject({
      status: 200,
      body: { title, pendingPrompt: { text }, productPillar: "work", directory: project.path },
    })
    return { missionID: result.body.missionID as string, sessionID: result.body.sessionID as string, title }
  }
  const edit = (missionID: string, expectedRequest: string, text: string, directory = project.path) =>
    request("PATCH", `/${missionID}/draft`, { expectedRequest, request: text }, directory)
  const conflict = (mission: { missionID: string; sessionID: string }, reason: "changed" | "missing" | "archived") => ({
    status: 409,
    body: {
      name: "MissionDraftEditConflictError",
      data: { missionID: mission.missionID, sessionID: mission.sessionID, reason },
    },
  })
  try {
    const original = "Initial saved operator request."
    const savedText = "Edited operator request: 中文 → exact Unicode."
    const mission = await create("Editable draft", original)
    const before = await Session.get(mission.sessionID)
    await Instance.provide({
      directory: project.path,
      fn: () =>
        Session.mergeMetadata({
          sessionID: mission.sessionID,
          patch: {
            mission: { ...(before.metadata!.mission as object), description: "Preserve sibling metadata" },
            custom: { value: 42 },
          },
        }),
    })
    const saved = await edit(mission.missionID, original, `  ${savedText}\n`)
    expect(saved).toMatchObject({
      status: 200,
      body: { ...mission, pendingPrompt: { text: savedText }, boardLane: "backlog" },
    })
    expect((await Session.get(mission.sessionID)).metadata).toMatchObject({
      custom: { value: 42 },
      mission: {
        description: "Preserve sibling metadata",
        visibleExpertSquadIDs: ["base"],
        pendingPrompt: { text: savedText },
      },
    })
    expect(await edit(mission.missionID, original, savedText)).toEqual(saved)
    expect(
      await request("PATCH", `/${mission.missionID}/draft`, {
        expectedRequest: savedText,
        request: "Valid",
        extra: true,
      }),
    ).toMatchObject({ status: 400, body: { success: false, error: expect.any(Array) } })
    expect(await edit(mission.missionID, savedText, "   ")).toMatchObject({
      status: 400,
      body: { success: false, error: expect.any(Array) },
    })

    const parallel = await Promise.all([
      edit(mission.missionID, savedText, "Editor A exact replacement."),
      edit(mission.missionID, savedText, "Editor B exact replacement."),
    ])
    expect(parallel.map((result) => result.status).sort()).toEqual([200, 409])
    const winner = parallel.find((result) => result.status === 200)!
    expect(parallel.find((result) => result.status === 409)).toMatchObject(conflict(mission, "changed"))
    expect(missionPendingPrompt(await Session.get(mission.sessionID))).toEqual(winner.body.pendingPrompt)

    const other = await provideInitializedProjectExecution({
      directory: otherProject.path,
      fn: async () => {
        const session = await ensureMissionSession({
          missionID: mission.missionID,
          defaultCwd: otherProject.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        await setMissionPendingPrompt({ session, pendingPrompt: { text: "Other project original." } })
        return session
      },
    })
    expect(new Set([other.id, mission.sessionID]).size).toBe(2)
    expect(
      await edit(mission.missionID, "Other project original.", "Other project edited.", otherProject.path),
    ).toMatchObject({
      status: 200,
      body: { sessionID: other.id, directory: otherProject.path, pendingPrompt: { text: "Other project edited." } },
    })
    expect(missionPendingPrompt(await Session.get(mission.sessionID))).toEqual(winner.body.pendingPrompt)
    await expect(
      Instance.provide({
        directory: otherProject.path,
        fn: () =>
          editMissionPendingPrompt({
            sessionID: mission.sessionID,
            missionID: mission.missionID,
            expectedRequest: winner.body.pendingPrompt.text,
            request: "Wrong project edit",
          }),
      }),
    ).rejects.toMatchObject({ name: "NotFoundError" })
    await expect(
      Instance.provide({
        directory: project.path,
        fn: () =>
          editMissionPendingPrompt({
            sessionID: mission.sessionID,
            missionID: "wrong-mission",
            expectedRequest: winner.body.pendingPrompt.text,
            request: "Wrong identity edit",
          }),
      }),
    ).rejects.toMatchObject({ name: "NotFoundError" })
    expect(await edit("unallocated-mission", original, savedText)).toMatchObject({
      status: 404,
      body: { name: "NotFoundError" },
    })

    await Instance.disposeAll()
    await Database.awaitEffectIdle(20_000)
    Database.close()
    const reopened = await request("GET", "")
    expect(reopened.status).toBe(200)
    expect(reopened.body.find((row: { sessionID: string }) => row.sessionID === mission.sessionID)).toMatchObject({
      pendingPrompt: winner.body.pendingPrompt,
      title: mission.title,
      directory: project.path,
    })
    expect(await edit(mission.missionID, original, winner.body.pendingPrompt.text)).toEqual(winner)

    const archived = await request("PATCH", `/${mission.missionID}/archive`, {
      archived: true,
      surface: "api",
      reason: "Draft archive contract",
    })
    expect(archived).toMatchObject({
      status: 200,
      body: { archived: expect.any(Number), pendingPrompt: winner.body.pendingPrompt },
    })
    expect(await edit(mission.missionID, original, winner.body.pendingPrompt.text)).toMatchObject(
      conflict(mission, "archived"),
    )
    expect(await request("PATCH", `/${mission.missionID}/archive`, { archived: false })).toMatchObject({ status: 200 })
    expect(await edit(mission.missionID, winner.body.pendingPrompt.text, "Restored editable request.")).toMatchObject({
      status: 200,
      body: { pendingPrompt: { text: "Restored editable request." } },
    })

    const racing = await create("Edit wins before acceptance", "Captured dispatch input.")
    const requestID = "edit-wins-before-dispatch"
    {
      using _beforeBundle = MissionExecutionClosureTestHooks.installBeforeOperatorWakeBundleCommit(
        async (admission) => {
          if (admission.requestID !== requestID) return
          expect(await edit(racing.missionID, "Captured dispatch input.", "Winning edited input.")).toMatchObject({
            status: 200,
            body: { pendingPrompt: { text: "Winning edited input." } },
          })
        },
      )
      expect(await request("POST", `/${racing.missionID}/dispatch`, { requestID, model })).toMatchObject({
        status: 409,
        body: { name: "MissionDispatchDraftConflictError", data: { reason: "changed" } },
      })
    }
    const accepted = await request("POST", `/${racing.missionID}/dispatch`, { requestID, model })
    expect(accepted).toMatchObject({ status: 200, body: { missionID: racing.missionID, sessionID: racing.sessionID } })
    const acceptedMessages = (await Session.messages({ sessionID: racing.sessionID })).filter(
      (entry) => entry.info.role === "user",
    )
    expect(
      acceptedMessages.map((entry) => entry.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))),
    ).toEqual([["Winning edited input."]])
    expect(await edit(racing.missionID, "Captured dispatch input.", "Winning edited input.")).toMatchObject(
      conflict(racing, "missing"),
    )
    expect(await request("POST", `/${racing.missionID}/dispatch`, { requestID, model })).toEqual(accepted)
    console.log(
      "[mission-draft HTTP]",
      JSON.stringify({
        saved: saved.status,
        concurrent: parallel.map((result) => result.status),
        restored: "editable",
        editedDispatch: accepted.status,
      }),
    )
  } finally {
    await server.stop(true)
  }
}, 90_000)
