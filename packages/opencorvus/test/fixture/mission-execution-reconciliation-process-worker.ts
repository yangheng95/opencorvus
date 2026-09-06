import fs from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import {
  currentMissionExecutionClosure,
  MissionExecutionClosureTestHooks,
  missionOperatorWakeReason,
  openMissionExecutionWithWake,
  resumeMissionExecutionClosure,
} from "@/mission/execution-closure"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { serverErrorResponse } from "@/server/error-handler"
import { MissionRoutes } from "@/server/routes/mission"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { Database } from "@/storage/db"
import { Hono } from "hono"
import { publishJSONBarrier } from "./json-barrier"

const [mode, projectDirectory, barrierDirectory, apiURL] = process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory) {
  throw new Error("Mission reconciliation process worker requires mode, project, and barrier")
}

declareNativeTaskProcessDeployment()
const missionID = "cross-process-mission-reconciliation"
const model = { providerID: "mission-process-test", modelID: "wake-model" }

async function waitFor(name: string): Promise<void> {
  const file = path.join(barrierDirectory, name)
  while (!(await fs.stat(file).catch(() => undefined))) await Bun.sleep(10)
}

function app() {
  const value = new Hono().route("/mission", MissionRoutes())
  value.onError(serverErrorResponse)
  return value
}

async function run() {
  return Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      if (mode === "seed") {
        await Config.updateProjectPatch({
          model: `${model.providerID}/${model.modelID}`,
          provider: {
            [model.providerID]: {
              name: "Mission process reconciliation provider",
              npm: "@ai-sdk/openai-compatible",
              api: apiURL ?? "http://127.0.0.1:1/v1",
              models: {
                [model.modelID]: {
                  name: "Mission process reconciliation model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4_096 },
                },
              },
            },
          },
        })
        await Auth.set(model.providerID, { type: "api", key: "mission-process-test-key" })
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: projectDirectory,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        using _seedLoop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        await openMissionExecutionWithWake({
          missionID,
          sessionID: mission.id,
          source: "mission.wake",
          requestID: "seed-opened-occurrence",
          acceptedInput: {
            text: "Seed the real cross-process Mission occurrence.",
            model: null,
            attachments: [],
            configPatch: {},
            context: { surface: "test.cross-process-seed" },
          },
          wake: (admission) =>
            SessionWake.wakeWithReceipt({
              sessionID: mission.id,
              messageID: admission.messageID,
              textPartID: admission.textPartID,
              controlID: admission.controlID,
              prompt: "Seed the real cross-process Mission occurrence.",
              author: "user",
              agent: "mission",
              surface: "panel",
              userAuthored: true,
              reason: missionOperatorWakeReason(admission, missionID),
              commitBundle: admission.commitBundle,
              preflightBundle: admission.preflightBundle,
              ownerPreflight: admission.ownerPreflight,
              ownerLifecycle: admission.ownerLifecycle,
            }),
        })
        const opened = currentMissionExecutionClosure(mission.id)
        if (!opened || opened.state !== "opened") throw new Error("Mission seed did not commit its opened occurrence")
        return { mode, missionID, sessionID: mission.id, openedEventID: opened.eventID }
      }

      const mission = await ensureMissionSession({
        missionID,
        defaultCwd: projectDirectory,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      if (mode === "close-blocked") {
        using _barrier = MissionExecutionClosureTestHooks.installAfterCloseLeaseAcquired(async (closure) => {
          await publishJSONBarrier(
            path.join(barrierDirectory, "close-ready.json"),
            {
              sessionID: mission.id,
              closureEventID: closure.eventID,
              operationID: closure.operationID,
              requestID: closure.requestID,
            },
          )
          await waitFor("close-release")
        })
        const response = await app().fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/abort`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-opencorvus-request-id": "close-owner-request" },
            body: JSON.stringify({ surface: "api", reason: "Cross-process close owner" }),
          }),
        )
        return { mode, status: response.status, body: await response.json() }
      }
      if (mode === "close-takeover") {
        const closed = await resumeMissionExecutionClosure({
          sessionID: mission.id,
          signal: AbortSignal.timeout(20_000),
        })
        return { mode, closed }
      }
      if (mode === "wake-before-bundle" || mode === "wake-blocked") {
        using _bundleBarrier =
          mode === "wake-before-bundle"
            ? MissionExecutionClosureTestHooks.installBeforeOperatorWakeBundleCommit(async ({ admission }) => {
                await publishJSONBarrier(
                  path.join(barrierDirectory, "wake-ready.json"),
                  {
                    sessionID: mission.id,
                    messageID: admission.messageID,
                    closureEventID: admission.closureEventID,
                    operationID: admission.operationID,
                  },
                )
                await waitFor("wake-release")
              })
            : undefined
        using _ownerBarrier =
          mode === "wake-blocked"
            ? SessionWake.TestHooks.installBeforeWakeLoopActivation(async () => {
                const message = (await Session.messages({ sessionID: mission.id })).find(
                  (entry) => entry.info.role === "user",
                )
                if (!message) throw new Error("Mission wake barrier reached without its real user Message")
                await publishJSONBarrier(
                  path.join(barrierDirectory, "wake-ready.json"),
                  { sessionID: mission.id, messageID: message.info.id },
                )
                await waitFor("wake-release")
              })
            : undefined
        const response = await app().fetch(
          new Request("http://opencorvus.test/mission/wake", {
            method: "POST",
            headers: { "content-type": "application/json", "x-opencorvus-request-id": "wake-owner-request" },
            body: JSON.stringify({
              missionID,
              productPillar: "work",
              text: "Persist the real cross-process Mission wake before Prompt ownership.",
            }),
          }),
        )
        return { mode, status: response.status, body: await response.json() }
      }
      if (
        mode === "operator-idempotent-blocked" ||
        mode === "operator-idempotent-peer" ||
        mode === "operator-drift-peer"
      ) {
        using _bundleBarrier =
          mode === "operator-idempotent-blocked"
            ? MissionExecutionClosureTestHooks.installBeforeOperatorWakeBundleCommit(async ({ admission }) => {
                await publishJSONBarrier(
                  path.join(barrierDirectory, "operator-idempotent-ready.json"),
                  {
                    sessionID: mission.id,
                    messageID: admission.messageID,
                    closureEventID: admission.closureEventID,
                  },
                )
                await waitFor("operator-idempotent-release")
              })
            : undefined
        const response = await app().fetch(
          new Request("http://opencorvus.test/mission/wake", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-opencorvus-request-id": "operator-idempotency-request",
            },
            body: JSON.stringify({
              requestID: "operator-idempotency-request",
              missionID,
              productPillar: "work",
              text:
                mode === "operator-drift-peer"
                  ? "Changed operator input under the same request identity."
                  : "One exact operator request shared by two backend processes.",
            }),
          }),
        )
        return { mode, status: response.status, body: await response.json() }
      }
      if (mode === "wake-live") {
        const response = await app().fetch(
          new Request("http://opencorvus.test/mission/wake", {
            method: "POST",
            headers: { "content-type": "application/json", "x-opencorvus-request-id": "wake-live-request" },
            body: JSON.stringify({
              missionID,
              productPillar: "work",
              text: "Hold one real streamed Mission Prompt while a peer closes the occurrence.",
            }),
          }),
        )
        await publishJSONBarrier(
          path.join(barrierDirectory, "live-ready.json"),
          { sessionID: mission.id, status: response.status, body: await response.json() },
        )
        await waitFor("live-exit")
        return { mode, sessionID: mission.id, status: response.status }
      }
      if (mode === "close-peer") {
        const response = await app().fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/abort`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-opencorvus-request-id": "close-peer-request" },
            body: JSON.stringify({ surface: "api", reason: "Peer close after Mission Message commit" }),
          }),
        )
        return {
          mode,
          status: response.status,
          body: await response.json(),
          closure: currentMissionExecutionClosure(mission.id),
        }
      }
      throw new Error(`Unknown Mission reconciliation worker mode: ${mode}`)
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
