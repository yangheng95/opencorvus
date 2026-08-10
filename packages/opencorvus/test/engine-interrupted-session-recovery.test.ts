import { afterEach, describe, expect, test } from "bun:test"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { listInterruptedSessionEvidence } from "@/engine/queue"
import { persistQueuedTask } from "@/engine/pipeline"
import { findTask } from "@/engine/store"
import { publishTaskAgentCancellationStatusesAfterSettlement } from "@/engine/task-agent-lifecycle"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { controlTextSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { listTaskConversationAgentSessions } from "@/orchestrator/task-event"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "recovery-test",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("interrupted prepared Worker Turn recovery", () => {
  test("classifies a first descriptor without a prior lifecycle as prepared and terminalizes its real input", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Interrupted recovery root" })
        const worker = await Session.create({
          kind: "delegated-worker",
          parentID: root.id,
          title: "Interrupted prepared worker",
        })
        const taskID = Identifier.ascending("task")
        const now = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: root.id,
          now,
          title: "Interrupted prepared worker",
          request: "Recover the exact prepared Worker Turn",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          queue: true,
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
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: worker.id,
          role: "user",
          author: "recovery-worker",
          time: { created: now + 1 },
          agent: "recovery-worker",
          model: { providerID: "test", modelID: "recovery-model" },
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: worker.id,
          messageID: message.id,
          type: "text",
          text: "Execute the prepared recovery turn",
        })
        const descriptor = WorkerTurnDescriptor.create({
          sessionID: worker.id,
          payload: {
            identity: {
              agentID: "recovery-worker",
              baseRole: "delegated-worker",
              sessionKind: "delegated-worker",
              dispatchAdapterID: "delegated_worker",
              runtimeTemplateABIVersion: 1,
              dispatchAdapterABIVersion: 1,
              projectionHash: "b".repeat(64),
            },
            expertSquadID: packageRevision.id,
            packageRevision,
            model: { selection: "explicit", providerID: "test", modelID: "recovery-model" },
            prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
            tools: { enabled: [] },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" } },
            messageAuthority: {
              user_message_id: message.id,
              control_text_parts: [{ part_id: part.id, text_sha256: controlTextSHA256(part.text) }],
            },
          },
        })

        expect(
          listInterruptedSessionEvidence({ taskID, rootSessionID: root.id, ownedSessionIDs: new Set() }),
        ).toEqual([
          {
            session_id: worker.id,
            agent_id: "recovery-worker",
            session_kind: "delegated-worker",
            status: "prepared",
            status_event_id: `worker-turn-prepared:${descriptor.id}`,
            status_emitted_at: descriptor.time.created,
            input_message_id: message.id,
            worker_turn_descriptor_id: descriptor.id,
            worker_turn_descriptor_hash: descriptor.hash,
          },
        ])

        const task = findTask(taskID)
        if (!task) throw new Error(`Missing recovery test Task ${taskID}`)
        expect(
          await publishTaskAgentCancellationStatusesAfterSettlement({
            task,
            reason: "Previous backend process ended before the first lifecycle event",
          }),
        ).toEqual([worker.id])
        expect(listTaskConversationAgentSessions(taskID).find((session) => session.sessionID === worker.id)).toMatchObject(
          {
            latestStatus: {
              type: "terminal",
              reason: "aborted",
              error: "Previous backend process ended before the first lifecycle event",
            },
            latestInputMessageID: message.id,
          },
        )

        const continuationMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: worker.id,
          role: "user",
          author: "recovery-worker",
          time: { created: now + 2 },
          agent: "recovery-worker",
          model: { providerID: "test", modelID: "recovery-model" },
        })
        const continuationPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: worker.id,
          messageID: continuationMessage.id,
          type: "text",
          text: "Execute the continuation occurrence",
        })
        WorkerTurnDescriptor.create({
          sessionID: worker.id,
          payload: {
            ...descriptor.payload,
            messageAuthority: {
              user_message_id: continuationMessage.id,
              control_text_parts: [
                { part_id: continuationPart.id, text_sha256: controlTextSHA256(continuationPart.text) },
              ],
            },
          },
        })
        expect(
          await publishTaskAgentCancellationStatusesAfterSettlement({
            task,
            reason: "Cancel the exact continuation occurrence",
          }),
        ).toEqual([worker.id])
        expect(listTaskConversationAgentSessions(taskID).find((session) => session.sessionID === worker.id)).toMatchObject(
          {
            latestStatus: {
              type: "terminal",
              reason: "aborted",
              error: "Cancel the exact continuation occurrence",
            },
            latestInputMessageID: continuationMessage.id,
          },
        )
      },
    })
  }, 30_000)
})
