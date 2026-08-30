import fs from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { recoverStartedTaskExecutions } from "@/engine/host-recovery"
import { currentMissionExecutionClosure, openMissionExecutionWithWake } from "@/mission/execution-closure"
import { MissionProcessRecoveryTestHooks, recoverMissionProcessSession } from "@/mission/process-recovery"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionWake } from "@/session/wake"
import { Database } from "@/storage/db"
import { MissionRoutes } from "@/server/routes/mission"
import { serverErrorResponse } from "@/server/error-handler"
import { Hono } from "hono"
import { MissionRetentionTestHooks } from "@/mission/retention"
import { PersistedProjectContext } from "@/server/persisted-project-context"
import "@/task-api"

const [
  mode,
  projectDirectory,
  barrierDirectory,
  apiURL,
  workerLabel = "first",
  deadlineMilliseconds,
  callerAbortMilliseconds,
] =
  process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory || !apiURL) {
  throw new Error("Mission recovery driver worker requires mode, project, barrier, and provider URL")
}

declareNativeTaskProcessDeployment()
const missionID = "mission-process-recovery-driver"
const model = { providerID: "mission-recovery-driver-test", modelID: "recovery-model" }

async function waitFor(name: string): Promise<void> {
  const file = path.join(barrierDirectory, name)
  while (!(await fs.stat(file).catch(() => undefined))) await Bun.sleep(10)
}

async function configure() {
  await Config.updateProjectPatch({
    model: `${model.providerID}/${model.modelID}`,
    provider: {
      [model.providerID]: {
        name: "Mission recovery driver provider",
        npm: "@ai-sdk/openai-compatible",
        api: apiURL,
        models: {
          [model.modelID]: {
            name: "Mission recovery driver model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
        },
      },
    },
  })
  await Auth.set(model.providerID, { type: "api", key: "mission-recovery-driver-key" })
}

async function ensureOpenedMission() {
  const mission = await ensureMissionSession({
    missionID,
    defaultCwd: projectDirectory,
    productPillar: "work",
    heldExpertSquadIDs: ["base"],
  })
  if (!currentMissionExecutionClosure(mission.id)) {
    using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
    await openMissionExecutionWithWake({
      missionID,
      sessionID: mission.id,
      source: "mission.wake",
      requestID: "mission-recovery-driver-open",
      acceptedInput: {
        text: "Open the Mission process-recovery driver occurrence.",
        model: null,
        attachments: [],
        configPatch: {},
        context: {},
      },
      wake: (admission) => {
        if (!admission.operatorRequest) throw new Error("Mission operator admission is missing request authority")
        return SessionWake.wakeWithReceipt({
          sessionID: mission.id,
          messageID: admission.messageID,
          textPartID: admission.textPartID,
          controlID: admission.controlID,
          prompt: "Open the Mission process-recovery driver occurrence.",
          author: "user",
          agent: "mission",
          surface: "panel",
          userAuthored: true,
          reason: {
            source: "mission.operator",
            missionID,
            requestID: admission.operatorRequest.requestID,
            requestFingerprint: admission.operatorRequest.requestFingerprint,
            openedEventID: admission.closureEventID,
          },
          commitBundle: admission.commitBundle,
          preflightBundle: admission.preflightBundle,
          ownerPreflight: admission.ownerPreflight,
          ownerLifecycle: admission.ownerLifecycle,
        })
      },
    })
  }
  return mission
}

async function run() {
  return Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      await configure()
      const mission = await ensureOpenedMission()
      if (mode === "live-owner") {
        const receipt = await openMissionExecutionWithWake({
          missionID,
          sessionID: mission.id,
          source: "mission.wake",
          requestID: `mission-recovery-driver-live-owner:${workerLabel}`,
          acceptedInput: {
            text: `Hold real streamed Mission turn ${workerLabel} until this backend process exits.`,
            model: null,
            attachments: [],
            configPatch: {},
            context: {},
          },
          wake: (admission) => {
            if (!admission.operatorRequest) throw new Error("Mission operator admission is missing request authority")
            return SessionWake.wakeWithReceipt({
              sessionID: mission.id,
              messageID: admission.messageID,
              textPartID: admission.textPartID,
              controlID: admission.controlID,
              prompt: `Hold real streamed Mission turn ${workerLabel} until this backend process exits.`,
              author: "user",
              agent: "mission",
              surface: "panel",
              userAuthored: true,
              reason: {
                source: "mission.operator",
                missionID,
                requestID: admission.operatorRequest.requestID,
                requestFingerprint: admission.operatorRequest.requestFingerprint,
                openedEventID: admission.closureEventID,
              },
              commitBundle: admission.commitBundle,
              preflightBundle: admission.preflightBundle,
              ownerPreflight: admission.ownerPreflight,
              ownerLifecycle: admission.ownerLifecycle,
            })
          },
        })
        await fs.writeFile(
          path.join(barrierDirectory, "owner-ready.json"),
          JSON.stringify({ sessionID: mission.id, messageID: receipt.messageID }),
        )
        await waitFor("owner-exit")
        return { mode, sessionID: mission.id, messageID: receipt.messageID }
      }
      if (mode === "writeahead-blocked") {
        using _hook = MissionProcessRecoveryTestHooks.installAfterWriteAhead(async (input) => {
          await fs.writeFile(path.join(barrierDirectory, "writeahead-ready.json"), JSON.stringify(input))
          await waitFor("writeahead-release")
        })
        const caller = new AbortController()
        const callerAbortDelay = Number.parseInt(callerAbortMilliseconds ?? "0", 10)
        const callerAbort =
          callerAbortDelay > 0
            ? setTimeout(() => caller.abort(new Error("Mission recovery fixture caller aborted")), callerAbortDelay)
            : undefined
        try {
          const deadlineDelay = Number.parseInt(deadlineMilliseconds ?? "0", 10)
          const recovered = await recoverMissionProcessSession(mission.id, {
            signal: caller.signal,
            ...(deadlineDelay > 0 ? { deadlineAt: Date.now() + deadlineDelay } : {}),
          })
          return { mode, recovered }
        } finally {
          if (callerAbort) clearTimeout(callerAbort)
        }
      }
      if (mode === "recovery-run") {
        const recovered = await recoverMissionProcessSession(mission.id)
        await fs.writeFile(path.join(barrierDirectory, "recovery-ready.json"), JSON.stringify(recovered))
        await waitFor("recovery-exit")
        await SessionPromptState.release(mission.id, mission.directory)
        return { mode, recovered }
      }
      if (mode === "close-route") {
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)
        const response = await app.fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/abort`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-opencorvus-request-id": "close-after-recovery-writeahead-owner-death",
            },
            body: JSON.stringify({
              surface: "api",
              reason: "Close takes over the dead recovery write-ahead owner",
            }),
          }),
        )
        return {
          mode,
          status: response.status,
          body: await response.json(),
          closure: currentMissionExecutionClosure(mission.id),
        }
      }
      if (mode === "delete-route-blocked") {
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)
        const abort = await app.fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/abort`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              surface: "api",
              reason: "Close before accepting the cross-process delete request",
            }),
          }),
        )
        if (abort.status !== 200) throw new Error(`Mission abort failed before delete: ${await abort.text()}`)
        using _deleteIntent = MissionRetentionTestHooks.installAfterDeleteIntentCommitted(async (intent) => {
          await fs.writeFile(path.join(barrierDirectory, "delete-intent-ready.json"), JSON.stringify(intent))
          await waitFor("delete-intent-release")
        })
        const response = await PersistedProjectContext.provide({
          directory: projectDirectory,
          fn: () =>
            app.fetch(
              new Request(`http://opencorvus.test/mission/${missionID}`, {
                method: "DELETE",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  surface: "api",
                  reason: "Accept delete before the route owner is killed",
                }),
              }),
            ),
        })
        return { mode, status: response.status, body: await response.json() }
      }
      if (mode === "host-driver") {
        const result = await recoverStartedTaskExecutions({ scopeProjectWorktree: projectDirectory })
        await fs.writeFile(
          path.join(barrierDirectory, "driver-ready.json"),
          JSON.stringify({ sessionID: mission.id, result }),
        )
        await waitFor("driver-exit")
        await SessionPromptState.release(mission.id, mission.directory)
        return { mode, sessionID: mission.id, result }
      }
      throw new Error(`Unknown Mission recovery driver mode: ${mode}`)
    },
  })
}

try {
  const result = await run()
  await Instance.disposeAll()
  console.log(JSON.stringify(result))
  Database.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
