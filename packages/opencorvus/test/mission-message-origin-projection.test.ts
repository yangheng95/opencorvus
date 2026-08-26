import { afterEach, expect, test } from "bun:test"
import { applyRightSidebarConversationPromptOverlay } from "@/chat/session"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import {
  enrichMessageEventProperties,
  originSourceFromMessageExtra,
  projectPersistedSessionMessage,
} from "@/orchestrator/protocol/message-bridge"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { Message, Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.06.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("projects Mission operator and scheduler wake origins through one persisted and live contract", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const mission = await ensureMissionSession({
        missionID: "message-origin-projection",
        defaultCwd: project.path,
        productPillar: "code",
        heldExpertSquadIDs: ["base"],
      })
      const created = Date.now()
      const operator = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "user",
        author: "user",
        time: { created },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
        extra: SessionWake.reasonExtra({ source: "mission.operator", missionID: mission.missionID }),
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: operator.id,
        type: "text",
        text: "Build the requested storefront.",
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "assistant",
        author: "mission",
        parentID: operator.id,
        time: { created: created + 1 },
        agent: "mission",
        modelID: "test",
        providerID: "test",
        mode: "mission",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: assistant.id,
        type: "text",
        text: "I will coordinate the work.",
      })
      const scheduler = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "user",
        author: "orchestrator",
        time: { created: created + 2 },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
        extra: SessionWake.reasonExtra({
          source: "scheduler.event",
          jobID: "scheduler-event-job",
          jobName: "Task status event",
          fireID: "scheduler-event-fire",
          eventType: "task.status",
          oneShot: true,
        }),
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: scheduler.id,
        type: "text",
        text: "A child Task reported progress.",
      })
      const automation = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "user",
        author: "orchestrator",
        time: { created: created + 3 },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
        extra: SessionWake.reasonExtra({
          source: "scheduler.automation",
          jobID: "scheduler-automation-job",
          jobName: "Session wait",
          fireID: "scheduler-automation-fire",
          scope: "session",
          recurrence: null,
        }),
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: automation.id,
        type: "text",
        text: "Scheduled wait completed.",
      })

      const hydrateResponse = await Server.App().request(`/session/${mission.id}/conversation?tail_limit=10`, {
        headers: { "x-opencorvus-directory": project.path },
      })
      expect(hydrateResponse.status).toBe(200)
      const hydrate = (await hydrateResponse.json()) as any
      expect(
        hydrate.transcript.map((message: any) => ({
          id: message.info.id,
          source: message.info.originSource,
          channel: message.info.channel,
        })),
      ).toEqual([
        { id: operator.id, source: "mission.operator", channel: "mission" },
        { id: assistant.id, source: "", channel: "mission" },
        { id: scheduler.id, source: "scheduler.event", channel: "mission" },
        { id: automation.id, source: "scheduler.automation", channel: "mission" },
      ])
      expect(hydrate.view.messages.map(({ messageID, stage }: any) => ({ messageID, stage }))).toEqual([
        { messageID: operator.id, stage: "user" },
        { messageID: assistant.id, stage: "mission" },
        { messageID: scheduler.id, stage: "mission" },
        { messageID: automation.id, stage: "mission" },
      ])

      const persisted = await Session.messages({ sessionID: mission.id })
      const persistedOperator = persisted.find((message) => message.info.id === operator.id)!
      const projectedOperator = projectPersistedSessionMessage(persistedOperator)
      const liveOperator = enrichMessageEventProperties(
        Message.Event.Updated.type,
        { info: persistedOperator.info },
        mission.id,
      )
      expect({
        persisted: {
          source: projectedOperator.info.originSource,
          channel: projectedOperator.info.channel,
          agentID: projectedOperator.info.agentID,
          sessionAgentID: projectedOperator.info.sessionAgentID,
        },
        live: {
          source: (liveOperator.info as any).originSource,
          channel: (liveOperator.info as any).channel,
          agentID: (liveOperator.info as any).agentID,
          sessionAgentID: (liveOperator.info as any).sessionAgentID,
        },
      }).toEqual({
        persisted: {
          source: "mission.operator",
          channel: "mission",
          agentID: "mission",
          sessionAgentID: "mission",
        },
        live: {
          source: "mission.operator",
          channel: "mission",
          agentID: "mission",
          sessionAgentID: "mission",
        },
      })
    },
  })
})

test("keeps the right-sidebar display source authoritative over its retained wake reason", () => {
  const wakeExtra = SessionWake.reasonExtra({
    source: "conversation.handoff",
    callerSessionID: Identifier.ascending("session"),
    callerMessageID: Identifier.ascending("message"),
    targetExperience: "work",
  })
  const prompt = applyRightSidebarConversationPromptOverlay(
    {
      author: "orchestrator",
      extra: wakeExtra,
      parts: [{ type: "text" as const, text: "Continue the handed-off conversation." }],
    },
    { experience: "work" },
  )

  expect({
    source: originSourceFromMessageExtra(prompt.extra),
    wakeReason: prompt.extra?.wake_reason,
  }).toEqual({
    source: "right-sidebar-conversation",
    wakeReason: wakeExtra.wake_reason,
  })
})

test("hydrates nested wake provenance through the Task conversation route", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Task wake provenance" })
      const taskID = Identifier.ascending("task")
      const created = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now: created,
        title: "Task wake provenance",
        request: "Keep hydrate and live provenance equal",
        productPillar: "code",
        source: "test",
        priority: "normal",
        metadata: { actor: "user" },
        projectID: Instance.project.id,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: Instance.directory,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: created,
        }),
      })
      const wake = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: root.id,
        role: "user",
        author: "orchestrator",
        time: { created: created + 1 },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "test" },
        extra: SessionWake.reasonExtra({
          source: "scheduler.automation",
          jobID: "task-wake-job",
          jobName: "Task wait",
          fireID: "task-wake-fire",
          scope: "session",
          recurrence: null,
        }),
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: root.id,
        messageID: wake.id,
        type: "text",
        text: "Scheduled Task wait completed.",
      })

      const response = await Server.App().request(`/task/${taskID}/conversation/session/${root.id}`, {
        headers: { "x-opencorvus-directory": project.path },
      })
      const responseText = await response.text()
      expect(response.status, responseText).toBe(200)
      const body = JSON.parse(responseText) as any
      expect(
        body.transcript.map((message: any) => ({
          id: message.info.id,
          source: message.info.originSource,
          channel: message.info.channel,
        })),
      ).toEqual([{ id: wake.id, source: "scheduler.automation", channel: "main" }])
    },
  })
})
