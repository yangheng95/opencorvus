import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { recoverMissionProcessSession } from "@/mission/process-recovery"
import { ensureMissionSession, listGlobalMissionProcessRecoveryCandidates } from "@/mission/session"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionControl } from "@/session/control"
import type { SessionWake } from "@/session/wake"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { closeMissionExecutionOperation, currentMissionExecutionClosure } from "@/mission/execution-closure"
import { Database, eq } from "@/storage/db"
import { SessionControlRecordTable } from "@/session/session.sql"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("standalone Mission process recovery", () => {
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
        const first = await recoverMissionProcessSession(mission.id, {
          wake: async (input) => ({ sessionID: mission.id, messageID: input.messageID! }),
        })
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
          close: async () => {
            const closing = currentMissionExecutionClosure(mission.id)!
            expect(closing.state).toBe("closing")
            closingEventID = closing.eventID
            settled = await recoverMissionProcessSession(mission.id, {
              wake: async (input) => ({ sessionID: mission.id, messageID: input.messageID! }),
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
            .select({ status: SessionControlRecordTable.status, payload: SessionControlRecordTable.payload })
            .from(SessionControlRecordTable)
            .where(eq(SessionControlRecordTable.id, first.occurrenceID))
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
          return { sessionID: mission.id, messageID: input.messageID! }
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
