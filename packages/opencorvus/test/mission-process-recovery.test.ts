import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { acquireControlLease, releaseControlLeaseOnErrorPath } from "@/engine/control-lease"
import { recoverMissionProcessSession } from "@/mission/process-recovery"
import { ensureMissionSession, listGlobalMissionProcessRecoveryCandidates } from "@/mission/session"
import {
  closeMissionExecutionOperation,
  currentMissionExecutionClosure,
  MissionExecutionClosingError,
  openMissionExecutionWithWake,
  resumeMissionExecutionClosure,
} from "@/mission/execution-closure"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Session } from "@/session"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { SessionWake } from "@/session/wake"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { resumeMissionDeleteRetention } from "@/mission/retention"
import "@/task-api"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function missionFixture(label: string) {
  const model = { providerID: "mission-recovery-test", modelID: "recovery-model" }
  await Config.updateProjectPatch({
    model: `${model.providerID}/${model.modelID}`,
    provider: {
      [model.providerID]: {
        name: "Mission process recovery test provider",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:1/v1",
        models: {
          [model.modelID]: {
            name: "Mission process recovery model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 32_000, output: 4_096 },
          },
        },
      },
    },
  })
  const mission = await ensureMissionSession({
    missionID: `mission-${label}`,
    defaultCwd: Instance.directory,
    productPillar: "code",
    heldExpertSquadIDs: ["base"],
  })
  using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  await openMissionExecutionWithWake({
    missionID: mission.missionID,
    sessionID: mission.id,
    source: "mission.dispatch",
    requestID: `${label}:open`,
    acceptedInput: {
      text: `Open Mission recovery fixture ${label}`,
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
        prompt: `Open Mission recovery fixture ${label}`,
        author: "user",
        agent: "mission",
        surface: "panel",
        userAuthored: true,
        reason: {
          source: "mission.operator",
          missionID: mission.missionID,
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
  const opened = currentMissionExecutionClosure(mission.id)
  if (!opened || opened.state !== "opened") throw new Error(`Mission ${mission.missionID} did not open`)
  return { mission, opened }
}

async function incompleteAssistant(sessionID: string, label: string) {
  const now = Date.now()
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "operator",
    time: { created: now },
    agent: "mission",
    model: { providerID: "test", modelID: "mission-recovery" },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "assistant",
    author: "mission",
    parentID: user.id,
    time: { created: now + 1 },
    agent: "mission",
    providerID: "test",
    modelID: "mission-recovery",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID,
    messageID: assistant.id,
    type: "tool",
    callID: `call_${label}`,
    tool: "glob",
    state: { status: "running", input: { pattern: "*" }, time: { start: now + 2 } },
  })
  return assistant
}

describe("canonical Mission close and process reconciliation", () => {
  test("scopes pending Mission delete recovery by Project while sibling cleanup remains actionable", async () => {
    await using firstProject = await memoryProject()
    await using secondProject = await memoryProject()
    const pending: Array<{ sessionID: string; missionID: string; projectID: string; directory: string }> = []
    for (const [index, directory] of [firstProject.path, secondProject.path].entries()) {
      await Instance.provide({
        directory,
        init: InstanceBootstrap,
        fn: async () => {
          const missionID = `delete-project-scope-${index}`
          const mission = await ensureMissionSession({
            missionID,
            defaultCwd: directory,
            productPillar: "code",
            heldExpertSquadIDs: ["base"],
          })
          await closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.delete",
            requestID: `delete-project-scope-${index}:request`,
            provenance: { kind: "request", surface: "api", reason: `Delete Project-scoped Mission ${index}` },
          })
          pending.push({ sessionID: mission.id, missionID, projectID: Instance.project.id, directory })
        },
      })
    }
    const [first, second] = pending
    expect({
      first: listGlobalMissionProcessRecoveryCandidates({ scopeProjectID: first!.projectID, limit: 4 }),
      second: listGlobalMissionProcessRecoveryCandidates({ scopeProjectID: second!.projectID, limit: 4 }),
    }).toEqual({
      first: [{ sessionID: first!.sessionID, directory: first!.directory }],
      second: [{ sessionID: second!.sessionID, directory: second!.directory }],
    })

    await Instance.provide({
      directory: first!.directory,
      init: InstanceBootstrap,
      fn: () => resumeMissionDeleteRetention({ sessionID: first!.sessionID, projectID: first!.projectID }),
    })
    expect({
      first: listGlobalMissionProcessRecoveryCandidates({ scopeProjectID: first!.projectID, limit: 4 }),
      second: listGlobalMissionProcessRecoveryCandidates({ scopeProjectID: second!.projectID, limit: 4 }),
    }).toEqual({
      first: [],
      second: [{ sessionID: second!.sessionID, directory: second!.directory }],
    })
    await Instance.provide({
      directory: second!.directory,
      init: InstanceBootstrap,
      fn: () => resumeMissionDeleteRetention({ sessionID: second!.sessionID, projectID: second!.projectID }),
    })
  }, 60_000)

  test("discovers one Project's Mission recovery candidates through fixed cursor pages", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const sessionIDs: string[] = []
        for (let index = 0; index < 9; index += 1) {
          const { mission } = await missionFixture(`paged-${index}`)
          await incompleteAssistant(mission.id, `paged_${index}`)
          sessionIDs.push(mission.id)
        }
        const first = listGlobalMissionProcessRecoveryCandidates({
          scopeProjectID: Instance.project.id,
          limit: 4,
        })
        const second = listGlobalMissionProcessRecoveryCandidates({
          scopeProjectID: Instance.project.id,
          afterSessionID: first.at(-1)!.sessionID,
          limit: 4,
        })
        const third = listGlobalMissionProcessRecoveryCandidates({
          scopeProjectID: Instance.project.id,
          afterSessionID: second.at(-1)!.sessionID,
          limit: 4,
        })
        expect({
          pageSizes: [first.length, second.length, third.length],
          sessionIDs: [...first, ...second, ...third].map((candidate) => candidate.sessionID),
        }).toEqual({
          pageSizes: [4, 4, 1],
          sessionIDs: sessionIDs.toSorted(),
        })
      },
    })
  }, 120_000)

  test("startup discovers one pure closing occurrence and resumes its original provenance", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const { mission } = await missionFixture("closing-takeover")
        const peerOwnerOccurrenceID = Identifier.ascending("call")
        const held = acquireControlLease({
          target: "lifecycle",
          targetID: `mission:${mission.id}`,
          ownerOccurrenceID: peerOwnerOccurrenceID,
          now: Date.now(),
          leaseMilliseconds: 30_000,
        })
        if (!held.acquired) throw new Error("closing takeover fixture did not acquire its peer lease")
        try {
          await expect(
            closeMissionExecutionOperation({
              missionID: mission.missionID,
              sessionID: mission.id,
              source: "mission.archive",
              requestID: "closing-takeover:archive",
              provenance: {
                kind: "request",
                surface: "overlay.archive_panel",
                reason: "Archive the Mission from the exact operator request",
              },
            }),
          ).rejects.toBeInstanceOf(MissionExecutionClosingError)
          const closing = currentMissionExecutionClosure(mission.id)
          expect({
            closing,
            candidates: listGlobalMissionProcessRecoveryCandidates({
              scopeProjectID: Instance.project.id,
              limit: 4,
            }),
          }).toMatchObject({
            closing: {
              state: "closing",
              source: "mission.archive",
              provenance: {
                kind: "request",
                surface: "overlay.archive_panel",
                reason: "Archive the Mission from the exact operator request",
              },
            },
            candidates: [{ sessionID: mission.id, directory: project.path }],
          })
        } finally {
          releaseControlLeaseOnErrorPath({
            target: "lifecycle",
            targetID: `mission:${mission.id}`,
            leaseID: held.lease.id,
            ownerOccurrenceID: peerOwnerOccurrenceID,
            now: Date.now(),
          })
        }

        const closed = await resumeMissionExecutionClosure({ sessionID: mission.id })
        expect(closed).toMatchObject({
          state: "closed",
          source: "mission.archive",
          requestID: "closing-takeover:archive",
          provenance: {
            kind: "request",
            surface: "overlay.archive_panel",
            reason: "Archive the Mission from the exact operator request",
          },
        })
      },
    })
  }, 30_000)

  test("preserves an exact live Prompt owner and its persisted assistant frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const { mission } = await missionFixture("live-owner")
        const assistant = await incompleteAssistant(mission.id, "live_owner")
        const admission = SessionPromptOwner.acquire({
          sessionID: mission.id,
          projectID: mission.projectID,
          directory: mission.directory,
        })
        if (!admission.acquired) throw new Error("live owner fixture did not acquire Prompt ownership")

        const live = await recoverMissionProcessSession(mission.id)
        const liveAssistant = (await Session.messages({ sessionID: mission.id })).find(
          (item) => item.info.id === assistant.id,
        )?.info
        expect({
          live,
          assistantState: liveAssistant?.time.completed === undefined ? "persisted_running" : "terminal",
        }).toEqual({
          live: { status: "live", sessionID: mission.id, ownerGeneration: admission.authority.generation },
          assistantState: "persisted_running",
        })
        expect(SessionPromptOwner.release(admission.authority)).toBe(true)
      },
    })
  }, 30_000)
})
