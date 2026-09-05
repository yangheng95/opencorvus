import { afterAll, describe, expect, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { acquireControlLease, releaseControlLease } from "../src/engine/control-lease"
import { Instance } from "../src/project/instance"
import { AutomationRunningConflictError, AutomationService } from "../src/scheduler/automation-service"
import {
  ScheduledToolOccurrenceConflictError,
  scheduledToolInputDigest,
} from "../src/scheduler/tool-occurrence"
import { recoverScheduledToolPart } from "../src/scheduler/tool-recovery"
import { Session } from "../src/session"
import { SessionLoop } from "../src/session/loop"
import { MessageStore } from "../src/session/message-store"
import type { Message } from "../src/session/message"
import { SessionPromptOwner } from "../src/session/prompt/owner"
import {
  executeScheduleToolInput,
  ScheduleToolParameters,
  type ScheduleToolInput,
} from "../src/tool/schedule"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Tool } from "../src/tool/tool"
import { WaitTool } from "../src/tool/wait"

afterAll(resetMemoryDatabase)

async function persistedScheduleRequest(sessionID: string, raw: unknown) {
  const input = ScheduleToolParameters.parse(raw)
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent: "primary",
    model: { providerID: "test", modelID: "schedule-recovery" },
    time: { created: Date.now() },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: user.id,
    sessionID,
    role: "assistant",
    author: "primary",
    agent: "primary",
    providerID: "test",
    modelID: "schedule-recovery",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
  })
  const part = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID,
    messageID: assistant.id,
    type: "tool",
    callID: Identifier.ascending("call"),
    tool: "schedule",
    state: { status: "running", input, time: { start: Date.now() } },
  })
  return { input, part }
}

async function persistedWaitRequest(sessionID: string, input: { duration_ms: number; reason: string }) {
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent: "primary",
    model: { providerID: "test", modelID: "wait-recovery" },
    time: { created: Date.now() },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: user.id,
    sessionID,
    role: "assistant",
    author: "primary",
    agent: "primary",
    providerID: "test",
    modelID: "wait-recovery",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
  })
  const part = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID,
    messageID: assistant.id,
    type: "tool",
    callID: Identifier.ascending("call"),
    tool: "wait",
    state: { status: "running", input, time: { start: Date.now() } },
  })
  return { input, part }
}

async function executeAndRecover(
  sessionID: string,
  request: { input: ScheduleToolInput; part: Message.ToolPart },
) {
  const occurrence = {
    sessionID,
    messageID: request.part.messageID,
    toolPartID: request.part.id,
    toolCallID: request.part.callID,
    toolName: "schedule" as const,
  }
  const live = await executeScheduleToolInput(request.input, {
    sessionID,
    projectID: Instance.project.id,
    occurrence,
  })
  const recovered = await recoverScheduledToolPart(request.part)
  expect(recovered).toEqual(live)
  return live
}

describe("schedule Tool exact lost-response recovery", () => {
  test("a paused manual Tool retries the same persisted occurrence at a later admission time", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Paused manual recovery" })
        const automation = await AutomationService.create({
          name: "paused exact Tool retry",
          target: { scope: "project", projectIds: [Instance.project.id] },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "retry exact manual input",
        })
        await AutomationService.update({ id: automation.id, status: "paused" })
        const request = await persistedScheduleRequest(session.id, { action: "run", automationId: automation.id })
        const context = {
          sessionID: session.id,
          projectID: Instance.project.id,
          occurrence: {
            sessionID: session.id,
            messageID: request.part.messageID,
            toolPartID: request.part.id,
            toolCallID: request.part.callID,
            toolName: "schedule" as const,
          },
        }
        {
          using _failure = AutomationService.TestHooks.installBeforeRunReservation(() => {
            throw new Error("temporary reservation failure")
          })
          await expect(executeScheduleToolInput(request.input, context)).rejects.toThrow(
            "temporary reservation failure",
          )
        }
        const retry = AutomationService.listFireHistory(automation.id).find((entry) => entry.origin === "manual_tool")!
        using _clock = AutomationService.TestHooks.installClaimClock(() => retry.retryAt!)
        using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
          sessionID: input.sessionID!,
          messageID: input.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: Promise.resolve({ ok: true as const }),
        }))
        const result = await executeScheduleToolInput(request.input, context)
        expect(await recoverScheduledToolPart(request.part)).toEqual(result)
        expect(
          AutomationService.listFireHistory(automation.id).find((entry) => entry.origin === "manual_tool"),
        ).toMatchObject({
          fireId: retry.fireId,
          scheduledDueAt: retry.scheduledDueAt,
          state: "succeeded",
          attemptCount: 2,
        })
        expect(AutomationService.list().find((entry) => entry.id === automation.id)).toMatchObject({ status: "paused" })
      },
    })
  }, 30_000)

  test("the real Session Wait Tool and outer recovery replay one exact result", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Session wait recovery" })
        const request = await persistedWaitRequest(session.id, {
          duration_ms: 60_000,
          reason: "recover exact Session wait",
        })
        const wait = await WaitTool.init()
        const live = await wait.execute(request.input, {
          sessionID: session.id,
          messageID: request.part.messageID,
          callID: request.part.callID,
          agent: "primary",
          abort: new AbortController().signal,
          extra: { toolPartID: request.part.id, projectID: Instance.project.id },
          messages: [],
          executionAuthority: {
            kind: "conversation",
            sessionID: session.id,
            projectID: Instance.project.id,
            directory: project.path,
          },
          executionSurface: Tool.executionSurface(["wait"], []),
          metadata() {},
        })
        expect(await recoverScheduledToolPart(request.part)).toEqual(live)
        const completedAt = Date.now() + 1
        expect(
          await SessionLoop.terminalizeRecoveredIncompleteAssistant(session.id, undefined, [
            { messageID: request.part.messageID, completedAt },
          ]),
        ).toBe(true)
        const persisted = await MessageStore.get({ sessionID: session.id, messageID: request.part.messageID })
        expect(persisted.parts.find((candidate) => candidate.id === request.part.id)).toMatchObject({
          type: "tool",
          state: { status: "completed", title: live.title, output: live.output, metadata: live.metadata },
        })
        expect(
          await SessionLoop.terminalizeRecoveredIncompleteAssistant(session.id, undefined, [
            { messageID: request.part.messageID, completedAt: completedAt + 1 },
          ]),
        ).toBe(false)
      },
    })
  }, 60_000)

  test("replays Automation definition, manual run, update and deletion with the live action result", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Schedule recovery" })
        const create = await persistedScheduleRequest(session.id, {
          action: "create",
          name: "Recovery automation",
          scope: "session",
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "Resume exact recovery",
        })
        const created = await executeAndRecover(session.id, create)
        const automationID = JSON.parse(created.output).automationId as string

        const update = await persistedScheduleRequest(session.id, {
          action: "update",
          automationId: automationID,
          prompt: "Resume updated recovery",
        })
        await executeAndRecover(session.id, update)

        using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
          sessionID: input.sessionID!,
          messageID: input.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: Promise.resolve({ ok: true as const }),
        }))
        const run = await persistedScheduleRequest(session.id, { action: "run", automationId: automationID })
        await executeAndRecover(session.id, run)

        const deletion = await persistedScheduleRequest(session.id, {
          action: "delete",
          automationId: automationID,
        })
        await executeAndRecover(session.id, deletion)
      },
    })
  }, 60_000)

  test("manual Tool run preserves durable busy and delay owners before one terminal replay", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const target = await Session.create({ kind: "assistant", title: "Manual Tool busy target" })
        const automation = await AutomationService.create({
          name: "Manual Tool busy authority",
          target: { scope: "session", sessionId: target.id },
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "run only after the exact target is available",
        })
        const targetInput = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: target.id,
          role: "user",
          author: "user",
          agent: "assistant",
          model: { providerID: "test", modelID: "manual-tool-busy" },
          time: { created: Date.now() },
        })
        const promptOwner = SessionPromptOwner.acquire({
          sessionID: target.id,
          projectID: Instance.project.id,
          directory: Instance.directory,
        })
        if (!promptOwner.acquired) throw new Error("Manual Tool fixture did not acquire the target Prompt owner")
        const targetAssistant = await Session.beginAssistantReply({
          id: Identifier.ascending("message"),
          sessionID: target.id,
          role: "assistant",
          author: "assistant",
          parentID: targetInput.id,
          acceptedInputMessageIDs: [targetInput.id],
          agent: "assistant",
          providerID: "test",
          modelID: "manual-tool-busy",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        let promptOwnerReleased = false
        try {
          const caller = await Session.create({ kind: "root", title: "Manual Tool caller" })
          const request = await persistedScheduleRequest(caller.id, {
            action: "run",
            automationId: automation.id,
          })
          const occurrence = {
            sessionID: caller.id,
            messageID: request.part.messageID,
            toolPartID: request.part.id,
            toolCallID: request.part.callID,
            toolName: "schedule" as const,
          }
          await expect(
            executeScheduleToolInput(request.input, {
              sessionID: caller.id,
              projectID: Instance.project.id,
              occurrence,
            }),
          ).rejects.toBeInstanceOf(AutomationRunningConflictError)

          targetAssistant.finish = "stop"
          targetAssistant.time.completed = Date.now()
          await Session.updateMessage(targetAssistant)
          promptOwnerReleased = SessionPromptOwner.release(promptOwner.authority)
          expect(promptOwnerReleased).toBe(true)

          const delayOwner = acquireControlLease({
            target: "automation",
            targetID: automation.id,
            ownerOccurrenceID: "manual-tool-delay-owner",
            now: Date.now(),
            leaseMilliseconds: 30_000,
          })
          if (!delayOwner.acquired) throw new Error("Manual Tool fixture did not acquire the delay lease")
          await expect(
            executeScheduleToolInput(request.input, {
              sessionID: caller.id,
              projectID: Instance.project.id,
              occurrence,
            }),
          ).rejects.toBeInstanceOf(AutomationRunningConflictError)
          expect(
            releaseControlLease({
              target: "automation",
              targetID: automation.id,
              leaseID: delayOwner.lease.id,
              ownerOccurrenceID: delayOwner.lease.owner_occurrence_id,
              now: Date.now(),
            }),
          ).toBe(true)

          using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
            sessionID: input.sessionID!,
            messageID: input.messageID!,
            activation: Promise.resolve({ owner: new AbortController().signal }),
            completion: Promise.resolve({ ok: true as const }),
          }))
          const completed = await executeScheduleToolInput(request.input, {
            sessionID: caller.id,
            projectID: Instance.project.id,
            occurrence,
          })
          const replayed = await executeScheduleToolInput(request.input, {
            sessionID: caller.id,
            projectID: Instance.project.id,
            occurrence,
          })
          expect(replayed).toEqual(completed)
          expect(AutomationService.listFireHistory(automation.id).find((fire) => fire.origin === "manual_tool"))
            .toMatchObject({ origin: "manual_tool", state: "succeeded", attemptCount: 1 })
        } finally {
          if (!promptOwnerReleased) SessionPromptOwner.release(promptOwner.authority)
        }
      },
    })
  }, 60_000)

  test("replays Event creation and cancellation with the live action result", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Event recovery" })
        const create = await persistedScheduleRequest(session.id, {
          action: "create_event",
          name: "Recovery event",
          eventType: "session.updated",
          prompt: "Handle exact event",
          oneShot: true,
        })
        const created = await executeAndRecover(session.id, create)
        const jobID = JSON.parse(created.output).jobId as string
        const cancel = await persistedScheduleRequest(session.id, { action: "cancel_event", jobId: jobID })
        await executeAndRecover(session.id, cancel)
      },
    })
  }, 60_000)

  test("replays exact immutable definition and Fire receipts after later external mutations", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Immutable schedule receipts" })
        const create = await persistedScheduleRequest(session.id, {
          action: "create",
          name: "Immutable receipt",
          scope: "session",
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "Original prompt",
        })
        const occurrence = {
          sessionID: session.id,
          messageID: create.part.messageID,
          toolPartID: create.part.id,
          toolCallID: create.part.callID,
          toolName: "schedule" as const,
        }
        const liveCreate = await executeScheduleToolInput(create.input, {
          sessionID: session.id,
          projectID: Instance.project.id,
          occurrence,
        })
        const automationID = JSON.parse(liveCreate.output).automationId as string
        await AutomationService.update({ id: automationID, name: "Later external name", prompt: "Later prompt" })
        expect(await recoverScheduledToolPart(create.part)).toEqual(liveCreate)

        const update = await persistedScheduleRequest(session.id, {
          action: "update",
          automationId: automationID,
          prompt: "Tool revision prompt",
        })
        const updateOccurrence = {
          sessionID: session.id,
          messageID: update.part.messageID,
          toolPartID: update.part.id,
          toolCallID: update.part.callID,
          toolName: "schedule" as const,
        }
        const liveUpdate = await executeScheduleToolInput(update.input, {
          sessionID: session.id,
          projectID: Instance.project.id,
          occurrence: updateOccurrence,
        })
        await AutomationService.update({ id: automationID, name: "Newest external name" })
        expect(await recoverScheduledToolPart(update.part)).toEqual(liveUpdate)
      },
    })
  }, 60_000)

  test("surfaces a zero-run terminal Fire and replays its lost manual Tool response", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Zero-run Fire" })
        const create = await persistedScheduleRequest(session.id, {
          action: "create",
          name: "Zero-run terminal",
          scope: "project",
          projectIds: [Instance.project.id],
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "Never reserve a target",
        })
        const created = await executeAndRecover(session.id, create)
        const automationID = JSON.parse(created.output).automationId as string
        const run = await persistedScheduleRequest(session.id, { action: "run", automationId: automationID })
        const occurrence = {
          sessionID: session.id,
          messageID: run.part.messageID,
          toolPartID: run.part.id,
          toolCallID: run.part.callID,
          toolName: "schedule" as const,
        }
        let now = Date.now()
        using _clock = AutomationService.TestHooks.installClaimClock(() => now)
        using _beforeReservation = AutomationService.TestHooks.installBeforeRunReservation(() => {
          throw new Error("target resolution refused before reservation")
        })
        for (let attempt = 1; attempt < 5; attempt++) {
          await expect(
            executeScheduleToolInput(run.input, {
              sessionID: session.id,
              projectID: Instance.project.id,
              occurrence,
            }),
          ).rejects.toThrow("target resolution refused before reservation")
          const fire = AutomationService.listFireHistory(automationID).find((entry) => entry.origin === "manual_tool")
          expect(fire).toMatchObject({ state: "retry_wait", attemptCount: attempt, runs: [] })
          now = fire!.retryAt!
        }
        const terminal = await executeScheduleToolInput(run.input, {
          sessionID: session.id,
          projectID: Instance.project.id,
          occurrence,
        })
        const fire = AutomationService.listFireHistory(automationID).find((entry) => entry.origin === "manual_tool")
        expect(fire).toMatchObject({ state: "failed", attemptCount: 5, runs: [], error: "target resolution refused before reservation" })
        expect(JSON.parse(terminal.output)).toEqual(fire)
        expect(await recoverScheduledToolPart(run.part)).toEqual(terminal)
      },
    })
  }, 60_000)

  test("returns a typed conflict when one persisted schedule occurrence changes input", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Typed schedule conflict" })
        const create = await persistedScheduleRequest(session.id, {
          action: "create",
          name: "Typed conflict",
          scope: "session",
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "Original",
        })
        const occurrence = {
          sessionID: session.id,
          messageID: create.part.messageID,
          toolPartID: create.part.id,
          toolCallID: create.part.callID,
          toolName: "schedule" as const,
        }
        await executeScheduleToolInput(create.input, {
          sessionID: session.id,
          projectID: Instance.project.id,
          occurrence,
        })
        await expect(
          AutomationService.createFromTool(
            {
              name: "Changed",
              target: { scope: "session", sessionId: session.id },
              recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
              prompt: "Changed",
            },
            { occurrence, inputDigest: scheduledToolInputDigest("schedule", { action: "create", changed: true }) },
          ),
        ).rejects.toBeInstanceOf(ScheduledToolOccurrenceConflictError)
      },
    })
  })

  test("the outer Session recovery writer persists the exact schedule receipt once", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Outer schedule recovery" })
        const create = await persistedScheduleRequest(session.id, {
          action: "create",
          name: "Outer recovered definition",
          scope: "session",
          recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
          prompt: "Persist through the outer writer",
        })
        const occurrence = {
          sessionID: session.id,
          messageID: create.part.messageID,
          toolPartID: create.part.id,
          toolCallID: create.part.callID,
          toolName: "schedule" as const,
        }
        const live = await executeScheduleToolInput(create.input, {
          sessionID: session.id,
          projectID: Instance.project.id,
          occurrence,
        })
        const automationID = JSON.parse(live.output).automationId as string
        await AutomationService.update({ id: automationID, name: "External later revision" })
        const completedAt = Date.now() + 1
        expect(
          await SessionLoop.terminalizeRecoveredIncompleteAssistant(session.id, undefined, [
            { messageID: create.part.messageID, completedAt },
          ]),
        ).toBe(true)
        const persisted = await MessageStore.get({ sessionID: session.id, messageID: create.part.messageID })
        const part = persisted.parts.find((candidate) => candidate.id === create.part.id)
        expect(part).toMatchObject({
          type: "tool",
          state: {
            status: "completed",
            title: live.title,
            output: live.output,
            metadata: live.metadata,
          },
        })
        expect(
          await SessionLoop.terminalizeRecoveredIncompleteAssistant(session.id, undefined, [
            { messageID: create.part.messageID, completedAt: completedAt + 1 },
          ]),
        ).toBe(false)
      },
    })
  }, 60_000)
})
