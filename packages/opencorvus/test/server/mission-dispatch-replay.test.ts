import { afterAll, expect, test } from "bun:test"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { provideInitializedProjectExecution } from "@/project/independent-project-owner"
import { ensureMissionSession, missionPendingPrompt, setMissionPendingPrompt } from "@/mission/session"
import { currentMissionExecutionClosure, MissionExecutionClosureTestHooks } from "@/mission/execution-closure"
import { MissionRoutes } from "@/server/routes/mission"
import { serverErrorResponse } from "@/server/error-handler"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { Database } from "@/storage/db"
import { configure, getServerUrl } from "../../../overlay/src/services/api"
import { dispatchMission, wakeMission } from "../../../overlay/src/services/mission"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("HTTP dispatch replays the accepted Message after draft consumption and retains exact terminal conflicts", async () => {
  await using project = await memoryProject("dispatch-main-project")
  await using otherProject = await memoryProject("dispatch-other-project")
  const model = "dispatch-replay/base"
  for (const directory of [project.path, otherProject.path]) {
    await Instance.provide({
      directory,
      fn: () =>
        Config.updateProjectPatch({
          model,
          provider: {
            "dispatch-replay": {
              name: "Dispatch admission contract",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: Object.fromEntries(
                ["base", "changed"].map((id) => [
                  id,
                  {
                    name: id,
                    tool_call: true,
                    modalities: { input: ["text"], output: ["text"] },
                    limit: { context: 32_000, output: 4_096 },
                  },
                ]),
              ),
            },
          },
        }),
    })
  }
  // This checker owns HTTP admission and durable facts. Provider execution is a separate acceptance boundary.
  using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  const mission = await provideInitializedProjectExecution({
    directory: project.path,
    fn: async () => {
      const mission = await ensureMissionSession({
        missionID: "dispatch-replay",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      await setMissionPendingPrompt({ session: mission, pendingPrompt: { text: "Execute the accepted draft." } })
      return mission
    },
  })
  const otherMission = await provideInitializedProjectExecution({
    directory: otherProject.path,
    fn: async () => {
      const mission = await ensureMissionSession({
        missionID: "dispatch-replay",
        defaultCwd: otherProject.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      await setMissionPendingPrompt({ session: mission, pendingPrompt: { text: "Execute the other project's draft." } })
      return mission
    },
  })
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
  const request = async (suffix: string, body: unknown, directory = project.path) => {
    const url = new URL(`/mission/${mission.missionID}/${suffix}`, server.url)
    url.searchParams.set("directory", directory)
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  }
  try {
    const input = { requestID: "dispatch-request", model }
    const first = await request("dispatch", input)
    const replay = await request("dispatch", input)
    console.log("[mission-dispatch HTTP]", JSON.stringify({ first, replay }))
    expect({ first: first.status, replay: replay.status, result: replay.body }).toEqual({
      first: 200,
      replay: 200,
      result: first.body,
    })
    const concurrent = await Promise.all([request("dispatch", input), request("dispatch", input)])
    expect(concurrent).toEqual([first, first])
    const parallelProjects = await Promise.all([
      request("dispatch", input),
      request("dispatch", input, otherProject.path),
    ])
    expect(parallelProjects).toEqual([
      first,
      {
        status: 200,
        body: {
          missionID: otherMission.missionID,
          sessionID: otherMission.id,
          created: false,
          productPillar: "work",
        },
      },
    ])
    expect(
      (await Session.messages({ sessionID: otherMission.id })).flatMap((entry) =>
        entry.parts.filter((part) => part.type === "text").map((part) => part.text),
      ),
    ).toEqual(["Execute the other project's draft."])
    const previousServerUrl = getServerUrl()
    configure({ serverUrl: server.url.toString() })
    try {
      const replayFromClient = await dispatchMission(
        { missionID: mission.missionID, directory: project.path },
        model,
        input.requestID,
      )
      expect(replayFromClient).toEqual(first.body)
      const wakeInput = {
        missionID: mission.missionID,
        directory: project.path,
        model,
        productPillar: "work" as const,
        requestID: "client-wake-request",
        text: "One accepted client follow-up.",
      }
      const wake = await wakeMission(wakeInput)
      const wakeReplay = await wakeMission(wakeInput)
      expect(wakeReplay).toEqual(wake)
    } finally {
      configure({ serverUrl: previousServerUrl })
    }
    const drift = await request("dispatch", { ...input, model: "dispatch-replay/changed" })
    expect(drift).toMatchObject({ status: 409, body: { name: "MissionExecutionWakeInputConflictError" } })
    const messages = (await Session.messages({ sessionID: mission.id })).filter((entry) => entry.info.role === "user")
    expect(
      messages.map((entry) => ({
        text: entry.parts.filter((part) => part.type === "text").map((part) => part.text),
        reason: entry.info.role === "user" ? entry.info.extra?.wake_reason : undefined,
      })),
    ).toEqual([
      {
        text: ["Execute the accepted draft."],
        reason: expect.objectContaining({ requestID: input.requestID, source: "mission.operator" }),
      },
      {
        text: ["One accepted client follow-up."],
        reason: expect.objectContaining({ requestID: "client-wake-request", source: "mission.operator" }),
      },
    ])
    const updateDraft = (text?: string) =>
      Instance.provide({
        directory: project.path,
        fn: async () =>
          setMissionPendingPrompt({
            session: await Session.get(mission.id),
            pendingPrompt: text ? { text } : undefined,
          }),
      })
    const nextDraft = "The later draft must remain exact after an older request is replayed."
    await updateDraft(nextDraft)
    expect({
      replay: await request("dispatch", input),
      draft: missionPendingPrompt(await Session.get(mission.id)),
    }).toEqual({ replay: first, draft: { text: nextDraft } })

    const staleSnapshot = await Session.get(mission.id)
    await Instance.provide({
      directory: project.path,
      fn: () =>
        Session.mergeMetadata({
          sessionID: mission.id,
          patch: {
            mission: { ...(staleSnapshot.metadata!.mission as object), description: "Latest sibling metadata" },
          },
        }),
    })
    await Instance.provide({
      directory: project.path,
      fn: () => setMissionPendingPrompt({ session: staleSnapshot, pendingPrompt: { text: nextDraft } }),
    })
    expect((await Session.get(mission.id)).metadata!.mission).toMatchObject({
      description: "Latest sibling metadata",
      pendingPrompt: { text: nextDraft },
    })

    for (const reason of ["changed", "missing"] as const) {
      await updateDraft(`Captured draft before ${reason} competition.`)
      const requestID = `draft-race-${reason}`
      const winningText = `Exact current draft after ${reason} competition.`
      const before = await Session.get(mission.id)
      {
        using _before = MissionExecutionClosureTestHooks.installBeforeOperatorWakeBundleCommit(async (admission) => {
          if (admission.requestID === requestID) await updateDraft(reason === "changed" ? winningText : undefined)
        })
        const conflict = await request("dispatch", { requestID, model: "dispatch-replay/changed" })
        expect(conflict).toMatchObject({
          status: 409,
          body: {
            name: "MissionDispatchDraftConflictError",
            data: { missionID: mission.missionID, sessionID: mission.id, requestID, reason },
          },
        })
      }
      expect((await Session.get(mission.id)).metadata!.configOverlay).toEqual(before.metadata!.configOverlay)
      if (reason === "missing") await updateDraft(winningText)
      const accepted = await request("dispatch", { requestID, model: "dispatch-replay/changed" })
      const acceptedMessages = (await Session.messages({ sessionID: mission.id })).filter(
        (entry) =>
          entry.info.role === "user" &&
          (entry.info.extra?.wake_reason as { requestID?: string })?.requestID === requestID,
      )
      expect({
        accepted,
        texts: acceptedMessages.map((entry) =>
          entry.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])),
        ),
      }).toEqual({ accepted: first, texts: [[winningText]] })
    }

    await updateDraft("Accepted before activation.")
    let activationFacts: unknown
    {
      using _activation = SessionWake.TestHooks.installBeforeWakeLoopActivation(async () => {
        const current = await Session.get(mission.id)
        activationFacts = {
          draftDisposition: missionPendingPrompt(current) ? "pending" : "consumed",
          closureState: currentMissionExecutionClosure(mission.id)?.state,
          acceptedTexts: (await Session.messages({ sessionID: mission.id })).flatMap((entry) =>
            entry.info.role === "user" &&
            (entry.info.extra?.wake_reason as { requestID?: string })?.requestID === "activation-race"
              ? entry.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))
              : [],
          ),
        }
        await updateDraft(nextDraft)
      })
      expect(await request("dispatch", { requestID: "activation-race", model })).toEqual(first)
    }
    expect({ activationFacts, draft: missionPendingPrompt(await Session.get(mission.id)) }).toEqual({
      activationFacts: {
        draftDisposition: "consumed",
        closureState: "opened",
        acceptedTexts: ["Accepted before activation."],
      },
      draft: { text: nextDraft },
    })
    // Release the initialized project and SQLite connection, then replay through
    // the same HTTP handler using only the retained database facts.
    await Instance.disposeAll()
    await Database.awaitEffectIdle(20_000)
    Database.close()
    const reopenedReplay = await request("dispatch", input)
    expect(reopenedReplay).toEqual(first)
    expect(missionPendingPrompt(await Session.get(mission.id))).toEqual({ text: nextDraft })
    expect(await request("dispatch", input, otherProject.path)).toEqual(parallelProjects[1]!)
    const abort = await request("abort", { surface: "api", reason: "Verify exact dispatch terminal replay" })
    const closedReplay = await request("dispatch", input)
    expect({ abort, closed: currentMissionExecutionClosure(mission.id)?.state, closedReplay }).toMatchObject({
      abort: { status: 200, body: true },
      closed: "closed",
      closedReplay: { status: 409, body: { name: "MissionExecutionWakeClosedError" } },
    })
  } finally {
    await server.stop(true)
  }
}, 60_000)
