import { afterEach, describe, expect, test } from "bun:test"
import { persistQueuedTask } from "@/engine/pipeline"
import {
  configureTaskLoopRunner,
  dispatchPersistedTaskLoop,
  persistQueuedTaskIntentInTransaction,
  persistQueuedTaskWaitWakeInTransaction,
  waitForQueueCompletionHooksForTest,
} from "@/engine/queue"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { QueuedTaskIngressSchema } from "@/engine/queued-task-ingress"
import { deriveTaskStatus } from "@/engine/task-status"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY } from "@/orchestrator/stateful-tool-names"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import type { Message } from "@/session/message"
import { Database, and, desc, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
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
  await waitForQueueCompletionHooksForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function completedTextPart(input: { sessionID: string; messageID: string; text: string }): Message.TextPart {
  return {
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "text",
    text: input.text,
  }
}

function completedToolPart(input: {
  sessionID: string
  messageID: string
  callID: string
  tool: string
  stateInput: Record<string, unknown>
  metadata?: Record<string, unknown>
}): Message.ToolPart {
  const start = Date.now()
  return {
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "tool",
    callID: input.callID,
    tool: input.tool,
    state: {
      status: "completed",
      input: input.stateInput,
      output: "ok",
      title: input.tool,
      metadata: input.metadata ?? {},
      time: { start, end: start + 1 },
    },
  }
}

async function createActiveTask(input: { title: string; request: string }) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({
    kind: "root",
    title: input.title,
    metadata: { configOverlay: { model: "openai/gpt-5.6-sol" } },
  })
  const now = Date.now()
  persistQueuedTask({
    taskID,
    sessionID: root.id,
    now,
    title: input.title,
    request: input.request,
    productPillar: "code",
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
  return { taskID, rootSessionID: root.id }
}

async function persistFinalAssistantMessage(input: {
  rootSessionID: string
  text: string
  parts?: (sessionID: string, messageID: string) => Message.Part[]
}) {
  const session = await Session.create({
    kind: "orchestrator",
    parentID: input.rootSessionID,
    title: "Operator wake settlement runner",
  })
  const now = Date.now()
  const messageID = Identifier.ascending("message")
  const info: Message.Assistant = {
    id: messageID,
    sessionID: session.id,
    parentID: Identifier.ascending("message"),
    role: "assistant",
    author: "orchestrator",
    time: { created: now, completed: now + 1 },
    agent: "orchestrator",
    providerID: "test",
    modelID: "settlement-runner",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  }
  await Session.persistMessage({
    info,
    parts: [completedTextPart({ sessionID: session.id, messageID, text: input.text }), ...(input.parts?.(session.id, messageID) ?? [])],
  })
  return messageID
}

async function persistAssistantInvocation(input: {
  rootSessionID: string
  sessionID?: string
  parentID?: string
  turns: {
    text: string
    parts?: (sessionID: string, messageID: string) => Message.Part[]
  }[]
}) {
  const session = input.sessionID
    ? await Session.get(input.sessionID)
    : await Session.create({
        kind: "orchestrator",
        parentID: input.rootSessionID,
        title: "Operator wake settlement runner",
      })
  const parentID = input.parentID ?? Identifier.ascending("message")
  let finalMessageID = ""
  for (const [index, turn] of input.turns.entries()) {
    const now = Date.now() + index * 10
    const messageID = Identifier.ascending("message")
    finalMessageID = messageID
    const info: Message.Assistant = {
      id: messageID,
      sessionID: session.id,
      parentID,
      role: "assistant",
      author: "orchestrator",
      time: { created: now, completed: now + 1 },
      agent: "orchestrator",
      providerID: "test",
      modelID: "settlement-runner",
      path: { cwd: Instance.directory, root: Instance.directory },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      finish: "stop",
    }
    await Session.persistMessage({
      info,
      parts: [
        completedTextPart({ sessionID: session.id, messageID, text: turn.text }),
        ...(turn.parts?.(session.id, messageID) ?? []),
      ],
    })
  }
  return finalMessageID
}

async function persistOperatorRootMessage(input: { taskID: string; rootSessionID: string; text: string }) {
  const now = Date.now()
  const messageID = Identifier.ascending("message")
  await Session.persistMessage({
    info: {
      id: messageID,
      sessionID: input.rootSessionID,
      role: "user",
      author: "operator",
      time: { created: now },
      agent: "orchestrator",
      model: { providerID: "openai", modelID: "gpt-5.6-sol" },
      extra: {
        task_root_message: {
          protocol: "task-root-message",
          taskID: input.taskID,
          kind: "operator",
          source: "operator.test",
        },
      },
    },
    parts: [completedTextPart({ sessionID: input.rootSessionID, messageID, text: input.text })],
  })
  return messageID
}

async function dispatchOperatorIntent(input: { taskID: string; supersededOperatorMessageIDs: string[] }) {
  Database.transaction((db) => {
    persistQueuedTaskIntentInTransaction(db, {
      task: requireTask(input.taskID),
      intent: "retry",
      supersededOperatorMessageIDs: input.supersededOperatorMessageIDs,
      now: Date.now(),
    })
  })
  return dispatchPersistedTaskLoop(input.taskID)
}

async function dispatchTaskWaitWake(input: { taskID: string; jobID: string }) {
  Database.transaction((db) => {
    persistQueuedTaskWaitWakeInTransaction(db, {
      taskID: input.taskID,
      projectID: Instance.project.id,
      jobID: input.jobID,
      fireID: `cal_task_wait_${input.jobID}`,
      dueAt: Date.now() - 1,
      note: "Resume from the exact durable Task wait wake",
      now: Date.now(),
    })
  })
  return dispatchPersistedTaskLoop(input.taskID)
}

function latestQueuedOperatorWake(taskID: string) {
  const row = Database.use((db) =>
    db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .get(),
  )
  if (!row) throw new Error(`Task ${taskID} has no queued_operator_wake artifact`)
  return { label: row.label, payload: QueuedTaskIngressSchema.parse(row.payload) }
}

describe("active operator wake settlement", () => {
  test("records delivery_failed when an active operator wake ends with prose only", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Prose-only operator wake",
          request: "Wait for an operator follow-up",
        })
        configureTaskLoopRunner(async () => ({
          finalMessageID: await persistFinalAssistantMessage({
            rootSessionID,
            text: "I will continue once runtime recovery is available.",
          }),
        }))

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up and dispatch the continuation.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          errorName: wake.payload.delivery_result?.status === "delivery_failed" ? wake.payload.delivery_result.error_name : undefined,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "delivery_failed",
          deliveryStatus: "delivery_failed",
          errorName: "QueuedWakeSettlementError",
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("drains an active operator wake after reading the exact message and making a scheduler decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Settled operator wake",
          request: "Wait for an operator follow-up",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              turns: [
                {
                  text: "Read the current follow-up.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_read_current_operator_message",
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Bind this scheduler decision to the exact current operator message.",
                      },
                    }),
                  ],
                },
                {
                  text: "Dispatched the continuation after reading the current follow-up.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_dispatch_continuation",
                      tool: "dispatch_agent",
                      stateInput: { dispatch: { target: "base-developer" } },
                      metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                    }),
                  ],
                },
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up and dispatch the continuation.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "operator_message",
        })
        expect(deriveTaskStatus(requireTask(taskID))).toBe("active")
      },
    })
  })

  test("records delivery_failed when read and scheduler decision are emitted in the same assistant turn", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Same-turn read and dispatch",
          request: "Wait for an operator follow-up",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              text: "Issued a read and dispatch in one tool batch.",
              parts: (sessionID, finalMessageID) => [
                completedToolPart({
                  sessionID,
                  messageID: finalMessageID,
                  callID: "call_read_current_operator_message",
                  tool: "read_task_message",
                  stateInput: {
                    message_id: messageID,
                    reason: "Read the current operator message.",
                  },
                }),
                completedToolPart({
                  sessionID,
                  messageID: finalMessageID,
                  callID: "call_dispatch_same_turn",
                  tool: "dispatch_agent",
                  stateInput: { dispatch: { target: "base-developer" } },
                  metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                }),
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up before dispatching the continuation.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          errorName:
            wake.payload.delivery_result?.status === "delivery_failed" ? wake.payload.delivery_result.error_name : undefined,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "delivery_failed",
          deliveryStatus: "delivery_failed",
          errorName: "QueuedWakeSettlementError",
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("drains an active operator wake when settlement tools span assistant turns", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Multi-turn settled operator wake",
          request: "Wait for an operator follow-up",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              turns: [
                {
                  text: "Read the current operator message.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_read_current_operator_message",
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Bind this scheduler decision to the exact current operator message.",
                      },
                    }),
                  ],
                },
                {
                  text: "Dispatch the continuation.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_dispatch_continuation",
                      tool: "dispatch_agent",
                      stateInput: { dispatch: { target: "base-developer" } },
                      metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                    }),
                  ],
                },
                {
                  text: "The current operator wake was read and scheduled.",
                },
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up and dispatch the continuation.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("records delivery_failed when only a prior wake made the scheduler decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Current wake cannot borrow prior decision",
          request: "Wait for operator follow-ups",
        })
        const session = await Session.create({
          kind: "orchestrator",
          parentID: rootSessionID,
          title: "Operator wake settlement runner",
        })
        const parentID = Identifier.ascending("message")
        await persistAssistantInvocation({
          rootSessionID,
          sessionID: session.id,
          parentID,
          turns: [
            {
              text: "A previous wake dispatched a continuation.",
              parts: (sessionID, turnMessageID) => [
                completedToolPart({
                  sessionID,
                  messageID: turnMessageID,
                  callID: "call_prior_dispatch",
                  tool: "dispatch_agent",
                  stateInput: { dispatch: { target: "base-developer" } },
                  metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                }),
              ],
            },
          ],
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              sessionID: session.id,
              parentID,
              turns: [
                {
                  text: "Read the current operator message but made no scheduler decision.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_read_current_operator_message",
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Read the current operator message.",
                      },
                    }),
                  ],
                },
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up and make a fresh scheduler decision.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          errorName:
            wake.payload.delivery_result?.status === "delivery_failed" ? wake.payload.delivery_result.error_name : undefined,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "delivery_failed",
          deliveryStatus: "delivery_failed",
          errorName: "QueuedWakeSettlementError",
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("records delivery_failed when an operator intent wake ignores superseded messages and makes no decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Prose-only operator intent",
          request: "Wait for a retry intent",
        })
        const supersededMessageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Retry by reading this retired operator message before scheduling.",
        })
        configureTaskLoopRunner(async () => ({
          finalMessageID: await persistFinalAssistantMessage({
            rootSessionID,
            text: "Retry acknowledged; I will continue later.",
          }),
        }))

        await expect(
          dispatchOperatorIntent({ taskID, supersededOperatorMessageIDs: [supersededMessageID] }),
        ).resolves.toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          errorName:
            wake.payload.delivery_result?.status === "delivery_failed" ? wake.payload.delivery_result.error_name : undefined,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "delivery_failed",
          deliveryStatus: "delivery_failed",
          errorName: "QueuedWakeSettlementError",
          sourceKind: "operator_intent",
        })
      },
    })
  })

  test("drains an operator intent wake after reading superseded messages and making a scheduler decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Settled operator intent",
          request: "Wait for a retry intent",
        })
        const supersededMessageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Retry by reading this retired operator message before scheduling.",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const [messageID] = event?.taskIntent?.supersededOperatorMessageIDs ?? []
          if (!messageID) throw new Error("operator intent test expected a superseded operator message")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              turns: [
                {
                  text: "Read the retired operator message.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_read_superseded_operator_message",
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Bind this retry decision to the superseded operator message.",
                      },
                    }),
                  ],
                },
                {
                  text: "Dispatched the retry continuation after reading the retired operator message.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_dispatch_retry_continuation",
                      tool: "dispatch_agent",
                      stateInput: { dispatch: { target: "base-developer" } },
                      metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                    }),
                  ],
                },
              ],
            }),
          }
        })

        await expect(
          dispatchOperatorIntent({ taskID, supersededOperatorMessageIDs: [supersededMessageID] }),
        ).resolves.toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "operator_intent",
        })
      },
    })
  })

  test("drains a task wait wake with a scheduler decision and no root-message read", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Settled task wait wake",
          request: "Wait for a scheduled continuation",
        })
        configureTaskLoopRunner(async ({ event }) => {
          if (!event?.taskWaitWake?.jobID) throw new Error("task wait test expected a taskWaitWake event")
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              text: "Observed the scheduled wait wake and dispatched the continuation.",
              parts: (sessionID, finalMessageID) => [
                completedToolPart({
                  sessionID,
                  messageID: finalMessageID,
                  callID: "call_dispatch_wait_continuation",
                  tool: "dispatch_agent",
                  stateInput: { dispatch: { target: "base-developer" } },
                  metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                }),
              ],
            }),
          }
        })

        await expect(dispatchTaskWaitWake({ taskID, jobID: "wait_active_settlement" })).resolves.toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "task_wait_wake",
        })
      },
    })
  })
})
