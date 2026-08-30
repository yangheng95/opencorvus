import { afterAll, describe, expect, test } from "bun:test"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import {
  closeMissionExecutionOperation,
  currentMissionExecutionClosure,
  missionOperatorWakeReason,
  MissionExecutionClosureTestHooks,
  MissionExecutionWakeClosedError,
  MissionExecutionWakeInputConflictError,
  openMissionExecutionWithWake,
} from "@/mission/execution-closure"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { provideInitializedProjectExecution } from "@/project/independent-project-owner"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { serverErrorResponse } from "@/server/error-handler"
import { MissionRoutes } from "@/server/routes/mission"
import { Database, and, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Hono } from "hono"
import { Provider } from "@/provider/provider"

afterAll(resetMemoryDatabase)

describe("Mission operator wake occurrence", () => {
  test("commits an explicit model overlay with its accepted Message bundle", async () => {
    await using project = await memoryProject()
    const providerID = "mission-atomic-config"
    await Instance.provide({
      directory: project.path,
      fn: () =>
        Config.updateProjectPatch({
          model: `${providerID}/base-model`,
          provider: {
            [providerID]: {
              name: "Mission atomic config test provider",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: Object.fromEntries(
                ["base-model", "accepted-model"].map((modelID) => [
                  modelID,
                  {
                    name: modelID,
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
    await provideInitializedProjectExecution({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "operator-atomic-config",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        let overlayBeforeBundle: unknown
        using _beforeBundle = MissionExecutionClosureTestHooks.installBeforeOperatorWakeBundleCommit(async () => {
          overlayBeforeBundle = (await Session.get(mission.id)).metadata?.configOverlay
        })
        using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
        const model = `${providerID}/accepted-model`
        const receipt = await openMissionExecutionWithWake({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.wake",
          requestID: "operator-atomic-config-request",
          acceptedInput: {
            text: "Commit this Message and explicit model together.",
            model,
            attachments: [],
            configPatch: { model },
            context: { surface: "test.atomic-config" },
          },
          wake: (admission) =>
            SessionWake.wakeWithReceipt({
              sessionID: mission.id,
              messageID: admission.messageID,
              textPartID: admission.textPartID,
              controlID: admission.controlID,
              prompt: "Commit this Message and explicit model together.",
              author: "user",
              agent: "mission",
              model: Provider.parseModel(model),
              reason: missionOperatorWakeReason(admission, mission.missionID),
              commitBundle: admission.commitBundle,
              preflightBundle: admission.preflightBundle,
              ownerPreflight: admission.ownerPreflight,
              ownerLifecycle: admission.ownerLifecycle,
            }),
        })
        const persisted = (await Session.messages({ sessionID: mission.id })).find(
          (entry) => entry.info.id === receipt.messageID,
        )
        expect({
          overlayBeforeBundle,
          overlayAfterBundle: (await Session.get(mission.id)).metadata?.configOverlay,
          messageModel: persisted?.info.role === "user" ? persisted.info.model : undefined,
        }).toEqual({
          overlayBeforeBundle: undefined,
          overlayAfterBundle: { model },
          messageModel: { providerID, modelID: "accepted-model" },
        })
      },
    })
  }, 60_000)

  test("persists one opened boundary and deterministic real Messages for exact operator requests", async () => {
    await using project = await memoryProject()
    const model = { providerID: "mission-wake-test", modelID: "wake-model" }
    await Instance.provide({
      directory: project.path,
      fn: () =>
        Config.updateProjectPatch({
          model: `${model.providerID}/${model.modelID}`,
          provider: {
            [model.providerID]: {
              name: "Mission wake occurrence test provider",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: {
                [model.modelID]: {
                  name: "Mission wake occurrence model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 32_000, output: 4_096 },
                },
              },
            },
          },
        }),
    })
    await provideInitializedProjectExecution({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "operator-wake-occurrence",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const activated: string[] = []
        using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async ({ messageID }) => {
          activated.push(messageID)
        })
        const wake = (requestID: string, prompt: string) =>
          openMissionExecutionWithWake({
            missionID: mission.missionID,
            sessionID: mission.id,
            source: "mission.wake",
            requestID,
            acceptedInput: {
              text: prompt,
              model: null,
              attachments: [],
              configPatch: {},
              context: { surface: "test.operator-wake" },
            },
            wake: (admission) =>
              SessionWake.wakeWithReceipt({
                sessionID: mission.id,
                messageID: admission.messageID,
                textPartID: admission.textPartID,
                controlID: admission.controlID,
                prompt,
                author: "user",
                agent: "mission",
                surface: "panel",
                userAuthored: true,
                reason: missionOperatorWakeReason(admission, mission.missionID),
                commitBundle: admission.commitBundle,
                preflightBundle: admission.preflightBundle,
                ownerPreflight: admission.ownerPreflight,
                ownerLifecycle: admission.ownerLifecycle,
              }),
          })

        const first = await wake("operator-request-1", "First exact operator request")
        const replay = await wake("operator-request-1", "First exact operator request")
        let drift: ReturnType<InstanceType<typeof MissionExecutionWakeInputConflictError>["toObject"]> | undefined
        try {
          await wake("operator-request-1", "Changed text under the same request identity")
        } catch (error) {
          if (!MissionExecutionWakeInputConflictError.isInstance(error)) throw error
          drift = error.toObject()
        }
        const second = await wake("operator-request-2", "Second request in the same opened occurrence")
        const closure = currentMissionExecutionClosure(mission.id)
        const openedEvents = Database.use((db) =>
          db
            .select({ id: ProtocolEventTable.id })
            .from(ProtocolEventTable)
            .where(
              and(
                eq(ProtocolEventTable.aggregate_type, "session"),
                eq(ProtocolEventTable.aggregate_id, mission.id),
                eq(ProtocolEventTable.type, "mission.execution.opened"),
              ),
            )
            .all(),
        )
        const userMessages = (await Session.messages({ sessionID: mission.id })).filter(
          (message) => message.info.role === "user",
        )

        expect({
          closure,
          openedEvents,
          firstMessageID: first.messageID,
          replayMessageID: replay.messageID,
          secondMessageID: second.messageID,
          persistedMessages: userMessages.map((message) => ({
            id: message.info.id,
            reason: message.info.extra?.wake_reason,
          })),
          activated,
          drift,
        }).toEqual({
          closure: expect.objectContaining({
            state: "opened",
            missionID: mission.missionID,
            eventID: openedEvents[0]!.id,
          }),
          openedEvents: [{ id: openedEvents[0]!.id }],
          firstMessageID: first.messageID,
          replayMessageID: first.messageID,
          secondMessageID: second.messageID,
          persistedMessages: [
            {
              id: first.messageID,
              reason: expect.objectContaining({ source: "mission.operator", missionID: mission.missionID }),
            },
            {
              id: second.messageID,
              reason: expect.objectContaining({ source: "mission.operator", missionID: mission.missionID }),
            },
          ],
          activated: [first.messageID, first.messageID, second.messageID],
          drift: expect.objectContaining({
            name: "MissionExecutionWakeInputConflictError",
            data: expect.objectContaining({
              requestID: "operator-request-1",
              acceptedFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
              receivedFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
              closureEventID: openedEvents[0]!.id,
            }),
          }),
        })
        expect(second.messageID).not.toBe(first.messageID)

        const closed = await closeMissionExecutionOperation({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "close-first-operator-occurrence",
          provenance: {
            kind: "request",
            surface: "api",
            reason: "Close the first operator occurrence before explicit reopen",
          },
          signal: AbortSignal.timeout(20_000),
        })
        const reopened = await wake("operator-request-3", "Open the next explicit operator occurrence")
        let oldRequestTerminal: ReturnType<InstanceType<typeof MissionExecutionWakeClosedError>["toObject"]> | undefined
        try {
          await wake("operator-request-1", "First exact operator request")
        } catch (error) {
          if (!MissionExecutionWakeClosedError.isInstance(error)) throw error
          oldRequestTerminal = error.toObject()
        }
        const reopenedClosure = currentMissionExecutionClosure(mission.id)
        const allOpenedEvents = Database.use((db) =>
          db
            .select({ id: ProtocolEventTable.id })
            .from(ProtocolEventTable)
            .where(
              and(
                eq(ProtocolEventTable.aggregate_type, "session"),
                eq(ProtocolEventTable.aggregate_id, mission.id),
                eq(ProtocolEventTable.type, "mission.execution.opened"),
              ),
            )
            .all(),
        )
        expect({
          closed,
          reopenedMessageID: reopened.messageID,
          reopenedClosure,
          allOpenedEvents,
          oldRequestTerminal,
        }).toMatchObject({
          closed: { state: "closed" },
          reopenedMessageID: expect.any(String),
          reopenedClosure: { state: "opened", eventID: allOpenedEvents[1]!.id },
          allOpenedEvents: [{ id: openedEvents[0]!.id }, { id: allOpenedEvents[1]!.id }],
          oldRequestTerminal: {
            name: "MissionExecutionWakeClosedError",
            data: {
              state: "closed",
              operationID: closed.operationID,
              closureEventID: closed.eventID,
            },
          },
        })
      },
    })
  }, 60_000)

  test("returns the typed closure outcome when close wins after Message commit and before Prompt ownership", async () => {
    await using project = await memoryProject()
    const model = { providerID: "mission-wake-race", modelID: "wake-model" }
    await Instance.provide({
      directory: project.path,
      fn: () =>
        Config.updateProjectPatch({
          model: `${model.providerID}/${model.modelID}`,
          provider: {
            [model.providerID]: {
              name: "Mission wake close-race provider",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: {
                [model.modelID]: {
                  name: "Mission wake close-race model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 32_000, output: 4_096 },
                },
              },
            },
          },
        }),
    })
    await Auth.set(model.providerID, { type: "api", key: "mission-wake-race-key" })
    await provideInitializedProjectExecution({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "message-before-owner-close-race",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        let entered!: () => void
        const beforeOwner = new Promise<void>((resolve) => {
          entered = resolve
        })
        let release!: () => void
        const released = new Promise<void>((resolve) => {
          release = resolve
        })
        using _barrier = SessionWake.TestHooks.installBeforeWakeLoopActivation(async () => {
          entered()
          await released
        })
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)
        const responsePromise = app.fetch(
          new Request("http://opencorvus.test/mission/wake", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-opencorvus-request-id": "message-before-owner-request",
            },
            body: JSON.stringify({
              missionID: mission.missionID,
              productPillar: "work",
              text: "Persist this exact operator Message before Prompt ownership.",
            }),
          }),
        )
        await beforeOwner
        const message = (await Session.messages({ sessionID: mission.id })).find((entry) => entry.info.role === "user")
        const closed = await closeMissionExecutionOperation({
          missionID: mission.missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "close-after-message-before-owner",
          provenance: {
            kind: "request",
            surface: "api",
            reason: "Close after the real Message commit and before Prompt ownership",
          },
          signal: AbortSignal.timeout(20_000),
        })
        release()
        const response = await responsePromise

        expect({
          response: { status: response.status, body: await response.json() },
          closure: currentMissionExecutionClosure(mission.id),
          closed,
          message: message && {
            id: message.info.id,
            reason: message.info.extra?.wake_reason,
          },
        }).toMatchObject({
          response: {
            status: 409,
            body: {
              name: "MissionExecutionWakeClosedError",
              data: {
                missionID: mission.missionID,
                sessionID: mission.id,
                state: "closed",
                closureEventID: closed.eventID,
              },
            },
          },
          closure: { state: "closed", eventID: closed.eventID },
          closed: { state: "closed" },
          message: {
            id: expect.any(String),
            reason: expect.objectContaining({ source: "mission.operator", missionID: mission.missionID }),
          },
        })
      },
    })
  }, 60_000)
})
