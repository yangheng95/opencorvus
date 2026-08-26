import { afterAll, describe, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { publishSettledSessionTerminalStatus } from "@/session/status-publication"
import { SessionStatus } from "@/session/status"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "settled-terminal",
  version: "2026.08.09.1",
  packageDigest: "c".repeat(64),
}

function userMessage(sessionID: string) {
  const id = Identifier.ascending("message")
  return {
    info: {
      id,
      sessionID,
      role: "user" as const,
      author: "user",
      agent: "assistant",
      model: { providerID: "test", modelID: "settled-terminal" },
      time: { created: Date.now() },
    },
    parts: [
      {
        id: Identifier.ascending("part"),
        messageID: id,
        sessionID,
        type: "text" as const,
        text: "settle me",
        kind: "user_content" as const,
        source: "user" as const,
      },
    ],
  }
}

describe("settled terminal publication", () => {
  test("the settled path's terminal reaches Bus subscribers through the same owner as the live path", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Settled terminal" })
        const now = Date.now()
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: "Settled terminal",
          request: "settle",
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
            timeCreated: now,
          }),
        })
        const message = userMessage(root.id)
        await Session.persistMessage(message)

        const observed: Array<{ inputMessageID: string; status: SessionStatus.Info }> = []
        const unsubscribe = Bus.subscribe(SessionStatus.Event.Status, async (event) => {
          if (event.properties.sessionID !== root.id) return
          observed.push({
            inputMessageID: event.properties.inputMessageID,
            status: event.properties.status,
          })
        })
        try {
          // The process latch is empty — exactly the restart-safe case the
          // settled path exists for. An attached client watching the Bus must
          // still receive the terminal lifecycle fact.
          const terminal = await publishSettledSessionTerminalStatus({
            session: root,
            taskID,
            inputMessageID: message.info.id,
            status: { type: "terminal", reason: "aborted", error: "task aborted" },
          })
          expect(terminal).toMatchObject({ type: "terminal", reason: "aborted" })
          expect(observed).toEqual([
            {
              inputMessageID: message.info.id,
              status: { type: "terminal", reason: "aborted", error: "task aborted" },
            },
          ])

          // Settling the same occurrence again converges on the latched
          // terminal instead of publishing a second lifecycle fact.
          const repeated = await publishSettledSessionTerminalStatus({
            session: root,
            taskID,
            inputMessageID: message.info.id,
            status: { type: "terminal", reason: "aborted", error: "task aborted" },
          })
          expect(repeated).toMatchObject({ type: "terminal", reason: "aborted" })
          expect(observed).toHaveLength(1)
        } finally {
          unsubscribe()
        }
      },
    })
  }, 30_000)

  test("a historical occurrence's settlement publishes without replacing the session's live occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Historical settlement" })
        const now = Date.now()
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: "Historical settlement",
          request: "settle",
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
            timeCreated: now,
          }),
        })
        const historical = userMessage(root.id)
        await Session.persistMessage(historical)
        const current = userMessage(root.id)
        await Session.persistMessage(current)
        SessionStatus.beginExecutionOccurrence(root.id, current.info.id)

        const observed: string[] = []
        const unsubscribe = Bus.subscribe(SessionStatus.Event.Status, async (event) => {
          if (event.properties.sessionID !== root.id) return
          observed.push(event.properties.inputMessageID)
        })
        try {
          await publishSettledSessionTerminalStatus({
            session: root,
            taskID,
            inputMessageID: historical.info.id,
            status: { type: "terminal", reason: "error", error: "orphaned turn" },
          })
          expect(observed).toEqual([historical.info.id])
          // The live occurrence is untouched by the historical settlement.
          expect(SessionStatus.executionOccurrence(root.id)?.inputMessageID).toBe(current.info.id)
        } finally {
          unsubscribe()
        }
      },
    })
  }, 30_000)
})
