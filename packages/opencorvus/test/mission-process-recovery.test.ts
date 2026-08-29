import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Identifier } from "@/id/id"
import { recoverMissionProcessSession } from "@/mission/process-recovery"
import {
  ensureMissionSession,
  listGlobalMissionProcessRecoveryCandidates,
  listMissionSessions,
} from "@/mission/session"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionControl } from "@/session/control"
import { SessionWake } from "@/session/wake"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import {
  closeMissionExecutionOperation,
  currentMissionExecutionClosure,
  admitMissionExecutionWake,
  MissionExecutionWakeClosedError,
  MissionExecutionCancellationProvenanceRequiredError,
  MissionExecutionClosureTestHooks,
  openMissionExecution,
  resumeMissionExecutionClosingOperation,
} from "@/mission/execution-closure"
import { Database, eq } from "@/storage/db"
import { SessionControlEventTable } from "@/session/session.sql"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { createRightSidebarConversationSession } from "@/chat/session"
import { Question } from "@/question"
import { PanelTool, PanelToolTestHooks } from "@/tool/panel"
import { Tool } from "@/tool/tool"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("standalone Mission process recovery", () => {
  const activation = () => Promise.resolve({ owner: new AbortController().signal })

  test("Session control failure stores only its outcome delta and reduces the complete public payload", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const session = await Session.create({ kind: "root", title: "control failure reduction" })
      const created = SessionControl.create({ sessionID: session.id, kind: "wake_reason", payload: { reason: "operator", attempt: 1 } })
      const failed = SessionControl.fail({ id: created.id, sessionID: session.id, error: "provider unavailable" })
      const event = Database.use((db) => db.select().from(SessionControlEventTable).where(eq(SessionControlEventTable.control_id, created.id)).get())
      expect(event).toMatchObject({ kind: "failed", payload: { error: "provider unavailable" } })
      expect(failed).toMatchObject({ status: "failed", payload: { reason: "operator", attempt: 1, error: "provider unavailable" } })
    } })
  })

  test("distinct wake requests continue the one opened Mission occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const mission = await ensureMissionSession({
        missionID: "mission-open-fence",
        defaultCwd: project.path,
        productPillar: "code",
        heldExpertSquadIDs: ["base"],
      })
      const first = await openMissionExecution({ missionID: "mission-open-fence", sessionID: mission.id, source: "mission.dispatch", requestID: "dispatch:1" })
      const second = await openMissionExecution({ missionID: "mission-open-fence", sessionID: mission.id, source: "mission.wake", requestID: "wake:2" })
      const opened = Database.use((db) => db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.aggregate_id, mission.id)).all()
        .filter((event) => event.type === "mission.execution.opened"))
      expect({ first, second, count: opened.length }).toMatchObject({
        first: { state: "opened" },
        second: { state: "opened", operationID: first.operationID, eventID: first.eventID },
        count: 1,
      })
    } })
  })

  test("fences a non-operator wake against the exact Mission occurrence inside Message commit", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-wake-commit-fence"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const opened = await openMissionExecution({
          missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "mission-wake-commit-fence-open",
        })
        let closingEventID = ""
        await expect(
          admitMissionExecutionWake({
            missionID,
            sessionID: mission.id,
            wake: async (persistence) => {
              const closing = await ProtocolStore.appendEvent({
                kind: "event",
                type: "mission.execution.closing",
                aggregate: "session",
                aggregate_id: mission.id,
                session_id: null,
                source: "mission.abort",
                correlation_id: opened.operationID,
                payload: {
                  missionID,
                  requestID: "mission-wake-commit-fence-close",
                  cancellation: { surface: "api", reason: "Close before wake Message commit" },
                },
              })
              closingEventID = closing.id
              Database.immediateTransaction(() => persistence.preflightBundle())
              throw new Error("Expected Mission wake commit fence rejection")
            },
          }),
        ).rejects.toMatchObject({
          name: MissionExecutionWakeClosedError.name,
          data: { missionID, sessionID: mission.id, state: "closing" },
        })
        expect(currentMissionExecutionClosure(mission.id)).toMatchObject({
          state: "closing",
          eventID: closingEventID,
          operationID: opened.operationID,
        })
      },
    })
  })

  test("fences concurrent process owners to one physical Mission close and one terminal fact", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-close-fence"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const opened = await openMissionExecution({
          missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "mission-close-fence-open",
        })
        expect(opened.state).toBe("opened")

        let closeCalls = 0
        let enterFirst!: () => void
        let releaseFirst!: () => void
        const entered = new Promise<void>((resolve) => (enterFirst = resolve))
        const release = new Promise<void>((resolve) => (releaseFirst = resolve))
        const first = closeMissionExecutionOperation({
          missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "mission-close-fence-request",
          provenance: { surface: "api", reason: "Fence Mission close owners" },
          close: async () => {
            closeCalls++
            enterFirst()
            await release
          },
        })
        await entered
        MissionExecutionClosureTestHooks.forgetLocalCloseOwner(mission.id)
        const second = closeMissionExecutionOperation({
          missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "mission-close-fence-request",
          provenance: { surface: "api", reason: "Fence Mission close owners" },
          close: async () => {
            closeCalls++
          },
        })
        releaseFirst()
        const [firstResult, secondResult] = await Promise.all([first, second])
        expect({ closeCalls, firstResult, secondResult, current: currentMissionExecutionClosure(mission.id) }).toMatchObject({
          closeCalls: 1,
          firstResult: { state: "closed" },
          secondResult: { state: "closed", operationID: firstResult.operationID },
          current: { state: "closed", operationID: firstResult.operationID },
        })
      },
    })
  })

  test("keeps historical Mission closure provenance fail-closed until the matching operator supplies it", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "mission-historical-closing-provenance"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const opened = await openMissionExecution({
          missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "historical-closing-open",
        })
        const historicalClosing = await ProtocolStore.appendEvent({
          kind: "event",
          type: "mission.execution.closing",
          aggregate: "session",
          aggregate_id: mission.id,
          session_id: null,
          source: "mission.archive",
          correlation_id: opened.operationID,
          payload: { missionID, requestID: "historical-archive-request" },
        })
        const authority = await ProtocolStore.appendEvent({
          kind: "event",
          type: "mission.execution.cancellation_provenance.required",
          aggregate: "session",
          aggregate_id: mission.id,
          session_id: null,
          source: "storage.mission-closure-provenance-migration",
          causation_id: historicalClosing.id,
          correlation_id: opened.operationID,
          payload: {
            version: 1,
            missionID,
            requestID: "historical-archive-request",
            requiredSource: "mission.archive",
          },
        })
        let physicalCloseCalls = 0
        const blockedRecovery = await resumeMissionExecutionClosingOperation({
          sessionID: mission.id,
          close: async () => {
            physicalCloseCalls += 1
          },
        })
        await expect(
          closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "wrong-source-repair",
            provenance: { surface: "api", reason: "Wrong operator source" },
            close: async () => {
              physicalCloseCalls += 1
            },
          }),
        ).rejects.toMatchObject({
          name: MissionExecutionCancellationProvenanceRequiredError.name,
          data: {
            missionID,
            operationID: opened.operationID,
            closureEventID: historicalClosing.id,
            authorityEventID: authority.id,
            requiredSource: "mission.archive",
          },
        })
        const repaired = await closeMissionExecutionOperation({
          missionID,
          sessionID: mission.id,
          source: "mission.archive",
          requestID: "matching-archive-repair",
          provenance: { surface: "api", reason: "Supply real operator provenance" },
          close: async () => {
            physicalCloseCalls += 1
          },
        })
        const supplied = Database.use((db) =>
          db
            .select()
            .from(ProtocolEventTable)
            .where(eq(ProtocolEventTable.aggregate_id, mission.id))
            .all()
            .filter((event) => event.type === "mission.execution.cancellation_provenance.supplied"),
        )
        const terminalMissionID = "mission-historical-closed-provenance"
        const terminalMission = await ensureMissionSession({
          missionID: terminalMissionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const terminalOperationID = "55555555-5555-4555-8555-555555555555"
        const historicalClosed = await ProtocolStore.appendEvent({
          kind: "event",
          type: "mission.execution.closed",
          aggregate: "session",
          aggregate_id: terminalMission.id,
          session_id: null,
          source: "mission.abort",
          correlation_id: terminalOperationID,
          payload: { missionID: terminalMissionID, requestID: "historical-abort-request" },
        })
        await ProtocolStore.appendEvent({
          kind: "event",
          type: "mission.execution.cancellation_provenance.unavailable_terminal",
          aggregate: "session",
          aggregate_id: terminalMission.id,
          session_id: null,
          source: "storage.mission-closure-provenance-migration",
          causation_id: historicalClosed.id,
          correlation_id: terminalOperationID,
          payload: {
            version: 1,
            missionID: terminalMissionID,
            requestID: "historical-abort-request",
            requiredSource: "mission.abort",
          },
        })
        expect({
          blocked: currentMissionExecutionClosure(mission.id),
          blockedRecovery,
          repaired,
          physicalCloseCalls,
          supplied,
          historicalClosed: currentMissionExecutionClosure(terminalMission.id),
        }).toMatchObject({
          blocked: { state: "closed", operationID: opened.operationID },
          blockedRecovery: { status: "not_closing", closure: { state: "recovery_blocked" } },
          repaired: { state: "closed", operationID: opened.operationID },
          physicalCloseCalls: 1,
          supplied: [{ causation_id: historicalClosing.id, correlation_id: opened.operationID }],
          historicalClosed: { state: "closed", eventID: historicalClosed.id, operationID: terminalOperationID },
        })
      },
    })
  })

  test("holds panel Mission handoff admission until its exact wake activation is published", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const createdCaller = await createRightSidebarConversationSession("work")
        const caller = await Session.mergeMetadata({
          sessionID: createdCaller.id,
          patch: { configOverlay: { model: "test/panel-mission-activation" } },
        })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: caller.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "work",
          model: { providerID: "test", modelID: "panel-mission-activation" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: caller.id,
          role: "assistant",
          author: "work",
          parentID: user.id,
          time: { created: now + 1 },
          agent: "work",
          providerID: "test",
          modelID: "panel-mission-activation",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const question = spyOn(Question, "askAndFormat").mockResolvedValue({
          status: "answered",
          output: "User answered yes",
          answers: [["yes"]],
        })
        const events: string[] = []
        let markActivationWaiting!: () => void
        let releaseActivation!: () => void
        const activationWaiting = new Promise<void>((resolve) => (markActivationWaiting = resolve))
        const activationGate = new Promise<void>((resolve) => (releaseActivation = resolve))
        using _wake = PanelToolTestHooks.installMissionWakeExecutor(async (input) => {
          events.push("panel_wake_waiting")
          markActivationWaiting()
          return {
            sessionID: input.sessionID!,
            messageID: Identifier.ascending("message"),
            activation: activationGate.then(() => {
              events.push("panel_wake_activated")
              return { owner: new AbortController().signal }
            }),
            completion: Promise.resolve({ ok: true as const }),
          }
        })
        try {
          const panel = await PanelTool.init({ agentID: "work" })
          const execution = panel.execute(
            {
              action: "wake_mission",
              request: "Run a durable activation-fenced Mission",
              reason: "This request needs a durable Mission. Continue?",
            },
            {
              sessionID: caller.id,
              messageID: assistant.id,
              callID: "call_panel_mission_activation",
              agent: "work",
              abort: new AbortController().signal,
              messages: [],
              executionSurface: Tool.executionSurface(["panel"], []),
              extra: { surface: "right-sidebar" },
              metadata() {},
            },
          )
          await activationWaiting
          const missions = []
          for await (const mission of listMissionSessions()) missions.push(mission)
          const mission = missions[0]
          if (!mission) throw new Error("Panel Mission activation fixture did not create its Mission")
          const closing = closeMissionExecutionOperation({
            missionID: mission.missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "panel-mission-activation-close",
            provenance: { surface: "api", reason: "Close the Mission activation fixture" },
            close: async () => {
              events.push(`close_${currentMissionExecutionClosure(mission.id)?.state}`)
            },
          })
          releaseActivation()
          const [result, closure] = await Promise.all([execution, closing])
          expect({ result: JSON.parse(result.output), events, closure }).toMatchObject({
            result: { kind: "mission_wake", mission_id: mission.missionID, session_id: mission.id },
            events: ["panel_wake_waiting", "panel_wake_activated", "close_closing"],
            closure: { missionID: mission.missionID, sessionID: mission.id, state: "closed" },
          })
        } finally {
          question.mockRestore()
        }
      },
    })
  }, 30_000)

  test("settles a pending recovery occurrence against the active Mission closing event", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "process-recovery-closure"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "operator",
          time: { created: now },
          agent: "mission",
          model: { providerID: "test", modelID: "test-model" },
        })
        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 1 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const activationEvents: string[] = []
        let markWakePrepared!: () => void
        let releaseActivation!: () => void
        const wakePrepared = new Promise<void>((resolve) => {
          markWakePrepared = resolve
        })
        const activationGate = new Promise<void>((resolve) => {
          releaseActivation = resolve
        })
        const firstRecovery = recoverMissionProcessSession(mission.id, {
          wake: async (input) => {
            activationEvents.push("wake_prepared")
            markWakePrepared()
            return {
              sessionID: mission.id,
              messageID: input.messageID!,
              activation: activationGate.then(() => {
                activationEvents.push("prompt_owner_published")
                return { owner: new AbortController().signal }
              }),
            }
          },
        })
        await wakePrepared
        releaseActivation()
        const first = await firstRecovery
        activationEvents.push(`result_${first.status}`)
        expect(activationEvents).toEqual(["wake_prepared", "prompt_owner_published", "result_woken"])
        expect(first).toMatchObject({ status: "woken", sessionID: mission.id })
        if (first.status !== "woken") throw new Error("expected Mission recovery wake")
        const interruptedRecovery = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: first.wakeMessageID,
          time: { created: now + 2 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        let settled: Awaited<ReturnType<typeof recoverMissionProcessSession>> | undefined
        let closingEventID: string | undefined
        await closeMissionExecutionOperation({
          missionID,
          sessionID: mission.id,
          source: "mission.abort",
          requestID: "request-process-recovery-close",
          provenance: { surface: "api", reason: "Settle Mission process recovery" },
          close: async () => {
            const closing = currentMissionExecutionClosure(mission.id)!
            expect(closing.state).toBe("closing")
            closingEventID = closing.eventID
            settled = await recoverMissionProcessSession(mission.id, {
              wake: async (input) => ({
                sessionID: mission.id,
                messageID: input.messageID!,
                activation: activation(),
              }),
            })
          },
        })
        const closure = currentMissionExecutionClosure(mission.id)!
        expect({ settled, closingEventID, closedState: closure.state }).toEqual({
          settled: {
            status: "closure_settled",
            sessionID: mission.id,
            closureEventID: closingEventID,
            occurrenceID: first.occurrenceID,
          },
          closingEventID: expect.any(String),
          closedState: "closed",
        })
        expect(
          (await Session.messages({ sessionID: mission.id })).find(
            (message) => message.info.id === interruptedRecovery.id,
          )?.info,
        ).toMatchObject({ finish: "error" })
        const marker = Database.use((db) =>
          db
            .select({ status: SessionControlEventTable.kind, payload: SessionControlEventTable.payload })
            .from(SessionControlEventTable)
            .where(eq(SessionControlEventTable.control_id, first.occurrenceID))
            .get(),
        )
        expect(marker).toMatchObject({
          status: "failed",
          payload: {
            terminal: { kind: "mission_closed", closureEventID: closingEventID },
            error: expect.stringContaining(closingEventID!),
          },
        })
      },
    })
  }, 30_000)

  test("recovers one exact persisted closing occurrence without applying archive storage effects", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "persisted-closing-host-recovery"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        await openMissionExecution({
          missionID,
          sessionID: mission.id,
          source: "mission.dispatch",
          requestID: "persisted-closing-host-recovery-open",
        })
        await expect(
          closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.archive",
            requestID: "persisted-closing-host-recovery-close",
            provenance: { surface: "api", reason: "Persist closing before simulated host loss" },
            close: async () => {
              throw new Error("simulated host loss after closing commit")
            },
          }),
        ).rejects.toThrow("simulated host loss after closing commit")
        MissionExecutionClosureTestHooks.forgetLocalCloseOwner(mission.id)
        const durableClosing = currentMissionExecutionClosure(mission.id)
        expect(durableClosing).toMatchObject({ state: "closing", source: "mission.archive" })

        const before = listGlobalMissionProcessRecoveryCandidates().map((candidate) => candidate.sessionID)
        expect(before).toContain(mission.id)
        const [first, second] = await Promise.all([
          recoverMissionProcessSession(mission.id),
          recoverMissionProcessSession(mission.id),
        ])
        const closureEvents = Database.use((db) =>
          db
            .select()
            .from(ProtocolEventTable)
            .where(eq(ProtocolEventTable.aggregate_id, mission.id))
            .all()
            .filter((event) => event.type.startsWith("mission.execution.")),
        )
        const current = currentMissionExecutionClosure(mission.id)
        const persistedSession = await Session.get(mission.id)
        expect({ first, second, current, closureEvents, archivedAt: persistedSession.time.archived }).toMatchObject({
          first: { status: "not_needed", sessionID: mission.id },
          second: { status: "not_needed", sessionID: mission.id },
          current: { state: "closed", operationID: durableClosing!.operationID, source: "mission.archive" },
          archivedAt: undefined,
        })
        expect(closureEvents.filter((event) => event.type === "mission.execution.closed")).toHaveLength(1)
        expect(listGlobalMissionProcessRecoveryCandidates().map((candidate) => candidate.sessionID)).not.toContain(
          mission.id,
        )

        const openedOnly = await ensureMissionSession({
          missionID: "opened-only-not-a-close-recovery",
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        await openMissionExecution({
          missionID: "opened-only-not-a-close-recovery",
          sessionID: openedOnly.id,
          source: "mission.dispatch",
          requestID: "opened-only-not-a-close-recovery-open",
        })
        expect(listGlobalMissionProcessRecoveryCandidates().map((candidate) => candidate.sessionID)).not.toContain(
          openedOnly.id,
        )
      },
    })
  }, 30_000)

  test("terminalizes interrupted tools, reuses a reply-free attempt, and rotates interrupted or failed replies", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "process-recovery-test",
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const stableControlID = Identifier.ascending("session_control")
        const stableControl = {
          id: stableControlID,
          sessionID: mission.id,
          kind: "wake_reason" as const,
          status: "consumed" as const,
          owner: "recovery-test",
          payload: { messageID: "stable-wake", attempt: 1 },
        }
        expect(SessionControl.create(stableControl).id).toBe(stableControlID)
        expect(SessionControl.create(stableControl).id).toBe(stableControlID)
        expect(() => SessionControl.create({ ...stableControl, payload: { messageID: "changed" } })).toThrow(
          "different persisted semantics",
        )
        const now = Date.now()
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "operator",
          time: { created: now },
          agent: "mission",
          model: { providerID: "test", modelID: "test-model" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 1 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const tool = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_interrupted_glob",
          tool: "glob",
          state: { status: "running", input: { pattern: "*" }, time: { start: now + 2 } },
        })

        expect(listGlobalMissionProcessRecoveryCandidates()).toEqual([
          { sessionID: mission.id, directory: project.path },
        ])
        expect(listGlobalMissionProcessRecoveryCandidates({ scopeProjectWorktree: `${project.path}-other` })).toEqual(
          [],
        )
        const wakes: SessionWake.WakeInput[] = []
        const wake = async (input: SessionWake.WakeInput) => {
          wakes.push(input)
          return { sessionID: mission.id, messageID: input.messageID!, activation: activation() }
        }
        let recoveryControlWakeCount = 0
        const unsubscribeControlWake = SessionControl.subscribeWake(mission.id, () => {
          recoveryControlWakeCount += 1
        })
        const first = await recoverMissionProcessSession(mission.id, { wake })
        unsubscribeControlWake()
        expect(recoveryControlWakeCount).toBe(0)
        const second = await recoverMissionProcessSession(mission.id, { wake })
        expect(first).toMatchObject({ status: "woken", sessionID: mission.id })
        expect(second).toEqual(first)
        expect(
          SessionControl.pending(mission.id).filter((control) => control.kind === "mission_process_recovery"),
        ).toHaveLength(1)
        expect(wakes).toHaveLength(2)
        expect(wakes[1]).toMatchObject({
          messageID: wakes[0]!.messageID,
          textPartID: wakes[0]!.textPartID,
          controlID: wakes[0]!.controlID,
          reason: {
            source: "mission.process_recovery",
            interruptedAssistantMessageIDs: [assistant.id],
          },
        })

        const persisted = await Session.messages({ sessionID: mission.id })
        const failedTool = persisted.flatMap((message) => message.parts).find((part) => part.id === tool.id)
        expect(failedTool).toMatchObject({
          type: "tool",
          state: { status: "error", failure: { kind: "process-execution-interrupted" } },
        })
        const failedAssistant = persisted.find((message) => message.info.id === assistant.id)?.info
        expect(failedAssistant).toMatchObject({
          role: "assistant",
          finish: "error",
          error: {
            name: "UnknownError",
            data: { message: expect.stringContaining("ProcessExecutionInterruptedError") },
          },
        })

        const interruptedRecovery = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: first.status === "woken" ? first.wakeMessageID : "unreachable",
          time: { created: now + 3 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const third = await recoverMissionProcessSession(mission.id, { wake })
        expect(third).toMatchObject({
          status: "woken",
          sessionID: mission.id,
          occurrenceID: first.status === "woken" ? first.occurrenceID : "unreachable",
          attempt: 2,
        })
        expect(third.status === "woken" && first.status === "woken" && third.wakeMessageID).not.toBe(
          first.status === "woken" ? first.wakeMessageID : "unreachable",
        )
        expect(
          (await Session.messages({ sessionID: mission.id })).find(
            (message) => message.info.id === interruptedRecovery.id,
          )?.info,
        ).toMatchObject({ finish: "error" })

        const failedRecoveryReply = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: third.status === "woken" ? third.wakeMessageID : "unreachable",
          time: { created: now + 4, completed: now + 5 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "error",
          error: { name: "UnknownError", data: { message: "provider failed during recovery" } },
        })
        const fourth = await recoverMissionProcessSession(mission.id, { wake })
        expect(fourth).toMatchObject({ status: "woken", attempt: 3 })
        expect(fourth.status === "woken" && third.status === "woken" && fourth.wakeMessageID).not.toBe(
          third.status === "woken" ? third.wakeMessageID : "unreachable",
        )
        expect(failedRecoveryReply.finish).toBe("error")

        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: fourth.status === "woken" ? fourth.wakeMessageID : "unreachable",
          time: { created: now + 6, completed: now + 7 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const nextUser = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "operator",
          time: { created: now + 8 },
          agent: "mission",
          model: { providerID: "test", modelID: "test-model" },
        })
        const nextInterrupted = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: nextUser.id,
          time: { created: now + 9 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const nextOccurrence = await recoverMissionProcessSession(mission.id, { wake })
        expect(nextOccurrence).toMatchObject({ status: "woken", attempt: 1 })
        expect(
          nextOccurrence.status === "woken" && first.status === "woken" && nextOccurrence.occurrenceID,
        ).not.toBe(first.status === "woken" ? first.occurrenceID : "unreachable")
        expect(
          (await Session.messages({ sessionID: mission.id })).find(
            (message) => message.info.id === nextInterrupted.id,
          )?.info,
        ).toMatchObject({ finish: "error" })

        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: nextOccurrence.status === "woken" ? nextOccurrence.wakeMessageID : "unreachable",
          time: { created: now + 10, completed: now + 11 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const completed = await recoverMissionProcessSession(mission.id, {
          wake: async () => {
            throw new Error("completed recovery must not wake again")
          },
        })
        expect(completed).toMatchObject({ status: "already_completed", sessionID: mission.id })
        expect(
          SessionControl.pending(mission.id).filter((control) => control.kind === "mission_process_recovery"),
        ).toEqual([])
        expect(listGlobalMissionProcessRecoveryCandidates()).toEqual([])

        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "assistant",
          author: "mission",
          parentID: user.id,
          time: { created: now + 12 },
          agent: "mission",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "operator",
          time: { created: now + 13 },
          agent: "mission",
          model: { providerID: "test", modelID: "test-model" },
        })
        expect(listGlobalMissionProcessRecoveryCandidates()).toEqual([])
        expect(await recoverMissionProcessSession(mission.id, { wake })).toEqual({
          status: "not_needed",
          sessionID: mission.id,
        })
      },
    })
  }, 30_000)
})
