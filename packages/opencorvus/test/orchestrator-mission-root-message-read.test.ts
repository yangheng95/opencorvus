import { afterEach, expect, test } from "bun:test"
import { persistQueuedTask } from "@/engine/pipeline"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { authorizedTaskRootMessagesForWake, createOrchestratorInteractionTools } from "@/orchestrator/interaction-tools"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { MessageTable, PartTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { deliverTaskRootMessageToOrchestratorSession } from "@/task-api/task-root-message"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("Mission acceptance wake reads its exact Mission-authored Task-root message", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = await Session.create({ kind: "root", title: "Mission acceptance root message" })
      const now = Date.now()
      persistQueuedTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Mission acceptance root message",
        request: "Repair the exact reviewed acceptance gap",
        productPillar: "work",
        source: "test",
        priority: "normal",
        metadata: {},
        projectID: Instance.project.id,
        queue: false,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: Instance.directory,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: now,
        }),
      })

      const messageID = Identifier.ascending("message")
      await Session.updateMessage({
        id: messageID,
        sessionID: root.id,
        role: "user",
        author: "mission",
        time: { created: now + 1 },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        extra: {
          task_root_message: {
            protocol: "task-root-message",
            taskID,
            kind: "mission",
            source: "mission.acceptance_resume",
          },
        },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: root.id,
        messageID,
        type: "text",
        text: "Update the report snapshot, then run the independent reviewer continuation.",
      })

      const allowedRootMessages = authorizedTaskRootMessagesForWake({
        missionAcceptanceResume: { messageID },
      })
      const readTool = createOrchestratorInteractionTools({
        taskID,
        agentSessionID: root.id,
        allowedRootMessages,
      }).read_task_message
      if (!readTool.execute) throw new Error("read_task_message is missing its executor")
      const output = await readTool.execute(
        {
          message_id: messageID,
          reason: "Bind the current Mission acceptance repair decision to the exact visible root message.",
        },
        {
          toolCallId: "call_mission_root_message",
          messages: [],
          abortSignal: new AbortController().signal,
        },
      )

      expect(output).toContain(`Task-root message ${messageID} (mission) is already recorded.`)
      expect(output).toContain("source=mission.acceptance_resume")
      expect(output).toContain("Update the report snapshot, then run the independent reviewer continuation.")

      const orchestrator = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Task Orchestrator",
      })
      await deliverTaskRootMessageToOrchestratorSession({
        task: { id: taskID, session_id: root.id, project_id: Instance.project.id },
        messageID,
        orchestratorSessionID: orchestrator.id,
      })
      const delivered = await MessageStore.get({ sessionID: orchestrator.id, messageID })
      const persistedPartSessions = Database.use((db) =>
        db.select({ sessionID: PartTable.session_id }).from(PartTable).where(eq(PartTable.message_id, messageID)).all(),
      )
      expect({
        delivered,
        messageCount: Database.use(
          (db) => db.select().from(MessageTable).where(eq(MessageTable.id, messageID)).all().length,
        ),
        persistedPartSessions,
      }).toMatchObject({
        delivered: {
          info: { id: messageID, sessionID: orchestrator.id, role: "user", author: "mission" },
          parts: [
            {
              messageID,
              sessionID: orchestrator.id,
              type: "text",
              text: "Update the report snapshot, then run the independent reviewer continuation.",
            },
          ],
        },
        messageCount: 1,
        persistedPartSessions: [{ sessionID: orchestrator.id }],
      })

      const deliveredOutput = await readTool.execute(
        {
          message_id: messageID,
          reason: "Consume the same durable Mission Message from the Orchestrator conversation.",
        },
        {
          toolCallId: "call_delivered_mission_root_message",
          messages: [],
          abortSignal: new AbortController().signal,
        },
      )
      expect(deliveredOutput).toContain("Update the report snapshot, then run the independent reviewer continuation.")

      const wrongSourceMessageID = Identifier.ascending("message")
      await Session.updateMessage({
        id: wrongSourceMessageID,
        sessionID: root.id,
        role: "user",
        author: "mission",
        time: { created: now + 2 },
        agent: "orchestrator",
        model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        extra: {
          task_root_message: {
            protocol: "task-root-message",
            taskID,
            kind: "mission",
            source: "mission.followup",
          },
        },
      })
      const wrongSourceTool = createOrchestratorInteractionTools({
        taskID,
        agentSessionID: root.id,
        allowedRootMessages: authorizedTaskRootMessagesForWake({
          missionAcceptanceResume: { messageID: wrongSourceMessageID },
        }),
      }).read_task_message
      if (!wrongSourceTool.execute) throw new Error("read_task_message is missing its executor")
      await expect(
        wrongSourceTool.execute(
          {
            message_id: wrongSourceMessageID,
            reason: "Reject a Mission message that was not produced by acceptance resume.",
          },
          {
            toolCallId: "call_wrong_mission_source",
            messages: [],
            abortSignal: new AbortController().signal,
          },
        ),
      ).rejects.toThrow(
        `Task-root message ${wrongSourceMessageID} provenance source=mission.followup, expected mission.acceptance_resume`,
      )
    },
  })
})
