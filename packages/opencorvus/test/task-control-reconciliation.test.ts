import { afterEach, describe, expect, test } from "bun:test"
import {
  EngineArtifactTable,
  EngineControlActivationLeaseTable,
  EngineInteractionRequestTable,
  EngineTaskTable,
} from "@/engine/engine.sql"
import { insertEngineArtifact } from "@/engine/artifact"
import { insertEngineInteractionRequest, resolveEngineInteractionRequest } from "@/engine/interaction-request"
import { recordTaskInfrastructureErrorInTransaction } from "@/engine/persist"
import {
  recordTaskRootIngressDispositionInTransaction,
  taskControlProjectFrontierSliceInTransaction,
  taskRootIngressReconciliationPageInTransaction,
  type TaskControlProjectFrontierCursor,
} from "@/engine/task-root-ingress-disposition"
import {
  reconcileTaskControlPlane,
  readTaskRootIngressEvidence,
  taskRootIngressDebugProjection,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import {
  acquireTaskRootIngressLease,
  acceptTaskRootIngressInTransaction,
  listTaskRootIngresses,
  projectTaskRootIngress,
} from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { writeTaskUpdateInTransaction } from "@/engine/state"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { createOrchestratorTools } from "@/orchestrator/tools"
import { sendSchedulerMessage } from "@/protocol/scheduler-message"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageTable, ToolPartOutcomeTable, ToolPartRequestTable } from "@/session/session.sql"
import { recordProviderActivityEvent } from "@/session/provider-activity-facts"
import { Database, and, asc, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function createExpiredDecisionGapFixture(input: {
  projectPath: string
  semanticTurnLimit: number
  label: string
}) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({ kind: "root", title: `${input.label} root` })
  const orchestrator = await Session.create({
    kind: "orchestrator",
    parentID: root.id,
    title: `${input.label} scheduler`,
  })
  const startedAt = Date.now() - 10_000
  const ingress = Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title: input.label,
        request: "Recover an exact decision gap after process loss",
        time_created: startedAt,
      })
      .run()
    appendTaskOpenedInTransaction({
      db,
      taskID,
      sessionID: root.id,
      now: startedAt,
      source: "test.expired-decision-gap",
    })
    return acceptTaskRootIngressInTransaction(db, {
      taskID,
      executionEpoch: 1,
      source: "inline",
      sourceID: `${input.label}-source`,
      inlinePayload: { note: "provider completed before assistant settlement" },
      semanticTurnLimit: input.semanticTurnLimit,
      activationLimit: 3,
      now: startedAt + 1,
    })
  })
  const lease = acquireTaskRootIngressLease({
    ingressID: ingress.id,
    ownerOccurrenceID: `${input.label}-dead-owner`,
    now: startedAt + 2,
    leaseMilliseconds: 60_000,
    assertControlOwnerInTransaction: () => undefined,
  })
  if (!lease.acquired) throw new Error("Expected an expired Task-root lease fixture")
  const control = currentOrchestratorControlMessage({ taskCreation: { taskID } }, taskID, ingress.id, ingress.id)
  if (!control) throw new Error("Expected an initial Task-root control occurrence")
  await Session.persistMessage({
    info: {
      id: control.messageID,
      sessionID: orchestrator.id,
      role: "user",
      author: "orchestrator",
      time: { created: startedAt + 3 },
      agent: "orchestrator",
      model: { providerID: "openai", modelID: "gpt-5.6-terra" },
      extra: control.extra,
    },
    parts: [
      {
        id: control.partID,
        sessionID: orchestrator.id,
        messageID: control.messageID,
        type: "text",
        text: control.text,
        kind: "control",
        source: "system",
      } satisfies Message.TextPart,
    ],
  })
  const assistantID = Identifier.deterministic("message", `task-root-assistant-v1\0${control.messageID}`)
  await Session.updateMessage({
    id: assistantID,
    sessionID: orchestrator.id,
    parentID: control.messageID,
    role: "assistant",
    author: "orchestrator",
    time: { created: startedAt + 4 },
    agent: "orchestrator",
    providerID: "openai",
    modelID: "gpt-5.6-terra",
    path: { cwd: input.projectPath, root: input.projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    activationID: lease.activationID,
  })
  const decisionGapStepID = Identifier.ascending("part")
  await Session.updatePart({
    id: decisionGapStepID,
    sessionID: orchestrator.id,
    messageID: assistantID,
    type: "step-finish",
    reason: "stop",
    cost: 0,
    tokens: { input: 1, output: 1, reasoning: 0, total: 2, cache: { read: 0, write: 0 } },
  })
  const providerRequestID = Identifier.ascending("part")
  recordProviderActivityEvent(assistantID, {
    type: "started",
    id: providerRequestID,
    ts: startedAt + 5,
    sessionID: orchestrator.id,
    provider: "openai",
    model: "gpt-5.6-terra",
  })
  recordProviderActivityEvent(assistantID, {
    type: "terminal",
    id: providerRequestID,
    ts: startedAt + 6,
    outcome: "done",
  })
  Database.use((db) =>
    db
      .update(EngineControlActivationLeaseTable)
      .set({ expires_at: startedAt + 1_000 })
      .where(eq(EngineControlActivationLeaseTable.id, lease.activationID))
      .run(),
  )
  return { taskID, orchestrator, ingress, lease, assistantID, providerRequestID, decisionGapStepID }
}

describe("Task-control reconciliation", () => {
  test("pages only current Project control candidates across retained terminal Task history", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Project Task frontier root" })
        const startedAt = Date.now()
        const candidateIDs = Database.immediateTransaction((db) => {
          for (let index = 0; index < 70; index += 1) {
            const taskID = Identifier.ascending("task")
            db.insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: Instance.project.id,
                session_id: root.id,
                source: "test",
                product_pillar: "code",
                title: `retained terminal ${index}`,
                request: "retained history",
                metadata: { actor: "user" },
                time_created: startedAt + index,
              })
              .run()
            appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now: startedAt + index, source: "test" })
            writeTaskUpdateInTransaction({
              db,
              taskID,
              values: { status: "completed" },
              summary: "retained terminal history",
              now: startedAt + index + 1,
            })
          }
          return Array.from({ length: 33 }, (_, index) => {
            const taskID = Identifier.ascending("task")
            db.insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: Instance.project.id,
                session_id: root.id,
                source: "test",
                product_pillar: "code",
                title: `live candidate ${index}`,
                request: "bounded candidate",
                metadata: { actor: "user" },
                time_created: startedAt + 100 + index,
              })
              .run()
            appendTaskOpenedInTransaction({
              db,
              taskID,
              sessionID: root.id,
              now: startedAt + 100 + index,
              source: "test",
            })
            acceptTaskRootIngressInTransaction(db, {
              taskID,
              executionEpoch: 1,
              source: "inline",
              sourceID: `project-frontier-${index}`,
              inlinePayload: { index },
              semanticTurnLimit: 2,
              activationLimit: 2,
              now: startedAt + 101 + index,
            })
            return taskID
          })
        })
        const pages: Array<ReturnType<typeof taskControlProjectFrontierSliceInTransaction>> = []
        let cursor: TaskControlProjectFrontierCursor | undefined
        do {
          const page = Database.use((db) =>
            taskControlProjectFrontierSliceInTransaction(db, {
              projectID: Instance.project.id,
              ...(cursor ? { cursor } : {}),
              perSourceLimit: 8,
            }),
          )
          pages.push(page)
          cursor = page.next
        } while (cursor)
        const restartedFirst = Database.use((db) =>
          taskControlProjectFrontierSliceInTransaction(db, {
            projectID: Instance.project.id,
            perSourceLimit: 8,
          }),
        )
        expect({
          scannedPageSizes: pages.map((page) => page.scannedCount),
          candidatePageSizes: pages.map((page) => page.taskIDs.length),
          candidates: pages.flatMap((page) => page.taskIDs),
          restartedFirst: restartedFirst.taskIDs,
        }).toEqual({
          scannedPageSizes: [8, 8, 8, 8, 1],
          candidatePageSizes: [8, 8, 8, 8, 1],
          candidates: candidateIDs,
          restartedFirst: candidateIDs.slice(0, 8),
        })
      },
    })
  })

  test("acquires with one bounded current-frontier read across retained released ingress history", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Bounded ingress frontier root" })
        const now = Date.now()
        const history = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Bounded ingress frontier",
              request: "Do not reduce settled history while acquiring the next ingress",
              metadata: { actor: "user" },
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.bounded-frontier" })
          return Array.from({ length: 257 }, (_, index) =>
            acceptTaskRootIngressInTransaction(db, {
              taskID,
              executionEpoch: 1,
              source: "inline",
              sourceID: `settled-${index}`,
              inlinePayload: { index },
              semanticTurnLimit: 2,
              activationLimit: 2,
              now: now + index + 1,
            }),
          )
        })
        const target = Database.immediateTransaction((db) => {
          for (const ingress of history) {
            const reason = "evidence_violation"
            const gateID = Identifier.deterministic(
              "artifact",
              `task-control-operator-gate-v2\0${ingress.id}\0host_fault\0${reason}`,
            )
            recordTaskInfrastructureErrorInTransaction(db, {
              id: gateID,
              taskID,
              component: "task-control",
              operation: "surface-operator-gated-ingress",
              reason: `Task-root ingress ${ingress.id} rests in host_fault (${reason})`,
              context: { ingressID: ingress.id, state: "host_fault", gateReason: reason },
              now: now + 100,
            })
            recordTaskRootIngressDispositionInTransaction(db, {
              taskID,
              ingressID: ingress.id,
              executionEpoch: 1,
              disposition: "operator_abandoned",
              evidenceIDs: [gateID],
              now: now + 101,
            })
          }
          return acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "post-host-fault-target",
            inlinePayload: { kind: "operator_message" },
            semanticTurnLimit: 2,
            activationLimit: 2,
            now: now + 102,
          })
        })
        const currentPriorFrontier = Database.use((db) =>
          taskRootIngressReconciliationPageInTransaction(db, {
            taskID,
            executionEpoch: 1,
            beforeSequence: target.sequence,
            limit: 32,
          }),
        )
        expect(currentPriorFrontier).toEqual({ ingresses: [], scannedCount: 0, next: undefined })
        let evidenceReads = 0
        const acquired = acquireTaskRootIngressLease({
          ingressID: target.id,
          ownerOccurrenceID: "bounded-frontier-owner",
          now: now + 103,
          leaseMilliseconds: 60_000,
          readEvidence: () => {
            evidenceReads += 1
            return {
              turns: [],
              decisions: [],
              decisionGaps: [],
              interactions: [],
              activityRequests: [],
              activityOutcomes: [],
            }
          },
          assertControlOwnerInTransaction: () => undefined,
        })
        expect({ acquired: acquired.acquired, evidenceReads }).toEqual({ acquired: true, evidenceReads: 1 })
      },
    })
  })

  test("rejects a Task-root disposition without exact immutable release evidence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createExpiredDecisionGapFixture({
          projectPath: project.path,
          semanticTurnLimit: 2,
          label: "invalid-ingress-disposition",
        })
        Database.use((db) =>
          db
            .update(EngineControlActivationLeaseTable)
            .set({ expires_at: Date.now() + 60_000 })
            .where(eq(EngineControlActivationLeaseTable.id, fixture.lease.activationID))
            .run(),
        )
        const completedTool = async (tool: string, input: Record<string, unknown>) => {
          const request = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: fixture.orchestrator.id,
            messageID: fixture.assistantID,
            type: "tool",
            callID: `call_${tool}_${Identifier.ascending("part")}`,
            tool,
            state: { status: "running", input, time: { start: Date.now() } },
          })
          await Session.updatePart({
            ...request,
            state: {
              status: "completed",
              input,
              output: "completed",
              title: tool,
              metadata: {},
              time: { start: request.state.time.start, end: Date.now() },
            },
          })
          return request.id
        }
        const ordinary = await completedTool("read_task_message", {})
        const question = await completedTool("question", { questions: [{ question: "Continue?" }] })
        const mutation = await completedTool("manage_task", { action: "add_goal", goal: { title: "More" } })
        const firstDispatch = await completedTool("dispatch_agent", { agent: "base-researcher" })
        const secondDispatch = await completedTool("dispatch_agent", { agent: "base-developer" })
        const assistant = (await Session.messages({ sessionID: fixture.orchestrator.id })).find(
          (message) => message.info.id === fixture.assistantID,
        )
        if (!assistant || assistant.info.role !== "assistant") throw new Error("Expected disposition assistant")
        await Session.updateMessage({
          ...assistant.info,
          time: { ...assistant.info.time, completed: Date.now() },
        })
        const control = currentOrchestratorControlMessage(
          { taskCreation: { taskID: fixture.taskID } },
          fixture.taskID,
          fixture.ingress.id,
          fixture.ingress.id,
        )!
        const exactOccurrence = {
          assistant_message_id: fixture.assistantID,
          control_message_id: control.messageID,
          predecessor_id: fixture.ingress.id,
          activation_id: fixture.lease.activationID,
        }
        const persistedControl = (await Session.messages({ sessionID: fixture.orchestrator.id })).find(
          (message) => message.info.id === control.messageID,
        )
        if (!persistedControl || persistedControl.info.role !== "user") {
          throw new Error("Expected the exact persisted Task-root control Message")
        }
        const arbitraryControlID = Identifier.ascending("message")
        const { id: _controlID, orderKey: _controlOrder, ...controlPayload } = persistedControl.info
        await Session.updateMessage({
          ...controlPayload,
          id: arbitraryControlID,
          time: { ...controlPayload.time, created: controlPayload.time.created + 1 },
        })
        const insertDisposition = (
          evidenceIDs: string[],
          options?: {
            decisionOccurrence?: Record<string, unknown>
            executionEpoch?: number
            ingressID?: string
            timeCreated?: number
          },
        ) =>
          Database.immediateTransaction((db) =>
            insertEngineArtifact(db, {
              id: Identifier.ascending("artifact"),
              taskID: fixture.taskID,
              kind: "task_root_ingress_disposition",
              label: "invalid-ingress-disposition",
              payload: {
                task_id: fixture.taskID,
                ingress_id: options?.ingressID ?? fixture.ingress.id,
                execution_epoch: options?.executionEpoch ?? 1,
                disposition: "resolved",
                evidence_ids: evidenceIDs,
                decision_occurrence: options?.decisionOccurrence ?? exactOccurrence,
                time_created: options?.timeCreated ?? Date.now(),
              },
              timeCreated: Date.now(),
            }),
          )
        for (const invalidEvidence of [["missing_tool_part"], [ordinary], [question], [mutation], [firstDispatch]]) {
          expect(() => insertDisposition(invalidEvidence)).toThrow(
            "engine_artifact: Task-root ingress disposition requires exact immutable release evidence",
          )
        }
        for (const invalidOccurrence of [
          { ...exactOccurrence, assistant_message_id: "msg_wrong_assistant" },
          { ...exactOccurrence, control_message_id: "msg_wrong_control" },
          { ...exactOccurrence, control_message_id: arbitraryControlID },
          { ...exactOccurrence, predecessor_id: "ingress_wrong_predecessor" },
          { ...exactOccurrence, predecessor_id: `${fixture.ingress.id}\u00a0` },
          { ...exactOccurrence, predecessor_id: `${fixture.ingress.id}\t` },
          { ...exactOccurrence, predecessor_id: `${fixture.ingress.id}\r\n` },
          { ...exactOccurrence, predecessor_id: fixture.ingress.id.replace("_h", "__") },
          { ...exactOccurrence, activation_id: "activation_wrong" },
          {
            assistant_message_id: exactOccurrence.assistant_message_id,
            control_message_id: exactOccurrence.control_message_id,
            activation_id: exactOccurrence.activation_id,
          },
        ]) {
          expect(() =>
            insertDisposition([firstDispatch, secondDispatch], { decisionOccurrence: invalidOccurrence }),
          ).toThrow("engine_artifact: Task-root ingress disposition requires exact immutable release evidence")
        }
        expect(() => insertDisposition([firstDispatch, secondDispatch], { timeCreated: 1.5 })).toThrow(
          "engine_artifact: Task-root ingress disposition requires exact immutable release evidence",
        )
        expect(() =>
          insertDisposition([firstDispatch, secondDispatch], {
            timeCreated: Number.MAX_SAFE_INTEGER + 1,
          }),
        ).toThrow("engine_artifact: Task-root ingress disposition requires exact immutable release evidence")
        expect(() =>
          insertDisposition([firstDispatch, secondDispatch], {
            executionEpoch: Number.MAX_SAFE_INTEGER + 1,
          }),
        ).toThrow("engine_artifact: Task-root ingress disposition requires exact immutable release evidence")
        for (const ingressID of [
          `${fixture.ingress.id}\u00a0`,
          `${fixture.ingress.id}\t`,
          `${fixture.ingress.id}\r\n`,
          fixture.ingress.id.replace("_h", "__"),
        ]) {
          expect(() => insertDisposition([firstDispatch, secondDispatch], { ingressID })).toThrow(
            "engine_artifact: Task-root ingress disposition requires exact immutable release evidence",
          )
        }
        expect(() =>
          insertDisposition([firstDispatch, secondDispatch], {
            timeCreated: Number.MAX_SAFE_INTEGER,
          }),
        ).not.toThrow()
        const disposition = Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.kind, "task_root_ingress_disposition"))
            .get(),
        )!
        expect(() =>
          Database.use((db) => db.delete(EngineArtifactTable).where(eq(EngineArtifactTable.id, disposition.id)).run()),
        ).toThrow("engine_artifact: scheduling settlement or disposition is immutable until Task retention")
        expect(() =>
          Database.use((db) =>
            db
              .update(MessageTable)
              .set({ data: { ...control.extra, author: "drift" } })
              .where(eq(MessageTable.id, control.messageID))
              .run(),
          ),
        ).toThrow("message: Task-root disposition control lineage is immutable")
        expect(() =>
          Database.use((db) =>
            db
              .delete(EngineControlActivationLeaseTable)
              .where(eq(EngineControlActivationLeaseTable.id, fixture.lease.activationID))
              .run(),
          ),
        ).toThrow("engine_control_activation_lease: disposition causal identity is immutable until Task retention")
        Database.immediateTransaction((db) =>
          db.delete(EngineTaskTable).where(eq(EngineTaskTable.id, fixture.taskID)).run(),
        )
        expect(
          Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, disposition.id))
              .get(),
          ),
        ).toBeUndefined()
      },
    })
  })

  test("rejects a self-consistent Task-root control occurrence with non-canonical identity bytes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createExpiredDecisionGapFixture({
          projectPath: project.path,
          semanticTurnLimit: 2,
          label: "non-canonical-control-identity",
        })
        const occurrence = Database.immediateTransaction((db) => {
          const ingress = acceptTaskRootIngressInTransaction(db, {
            taskID: fixture.taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "non-canonical-control-ingress",
            inlinePayload: { purpose: "prove exact control identity bytes" },
            semanticTurnLimit: 2,
            activationLimit: 2,
            now: Date.now(),
          })
          const activationID = Identifier.ascending("activity")
          db.insert(EngineControlActivationLeaseTable)
            .values({
              id: activationID,
              target: "task_root_ingress",
              target_id: ingress.id,
              owner_occurrence_id: "runtime:non-canonical-control",
              time_activated: Date.now(),
              expires_at: Date.now() + 60_000,
            })
            .run()
          return { ingress, activationID }
        })
        const canonical = currentOrchestratorControlMessage(
          { taskCreation: { taskID: fixture.taskID } },
          fixture.taskID,
          occurrence.ingress.id,
          occurrence.ingress.id,
        )!
        const predecessorID = `${occurrence.ingress.id} `
        const controlMessageID = `msg_task-root-control_${occurrence.ingress.id}_${predecessorID}`
        await Session.persistMessage({
          info: {
            id: controlMessageID,
            sessionID: fixture.orchestrator.id,
            role: "user",
            author: "orchestrator",
            agent: "orchestrator",
            model: { providerID: "test", modelID: "test" },
            time: { created: Date.now() },
            extra: {
              ...canonical.extra,
              orchestrator_control_ingress: {
                ...canonical.extra.orchestrator_control_ingress,
                predecessor_id: predecessorID,
              },
            },
          },
          parts: [],
        })
        const assistantID = Identifier.ascending("message")
        const assistantData = {
          parentID: controlMessageID,
          role: "assistant",
          author: "orchestrator",
          agent: "orchestrator",
          providerID: "test",
          modelID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
          activationID: occurrence.activationID,
        } as const
        Database.immediateTransaction((db) =>
          db
            .insert(MessageTable)
            .values({
              id: assistantID,
              session_id: fixture.orchestrator.id,
              time_created: assistantData.time.created,
              data: assistantData,
            })
            .run(),
        )
        const requestID = Identifier.ascending("part")
        const requestStartedAt = Date.now()
        Database.immediateTransaction((db) => {
          db.insert(ToolPartRequestTable)
            .values({
              id: requestID,
              message_id: assistantID,
              data: {
                type: "tool-request",
                callID: Identifier.ascending("call"),
                tool: "dispatch_agent",
                input: { target: "base-developer" },
                time: { start: requestStartedAt },
              },
              time_created: requestStartedAt,
            })
            .run()
          db.insert(ToolPartOutcomeTable)
            .values({
              id: Identifier.ascending("part"),
              request_part_id: requestID,
              data: {
                type: "tool-outcome",
                outcome: "completed",
                output: "accepted",
                title: "Dispatch Agent",
                metadata: {},
                time: { end: Date.now() },
              },
              time_created: Date.now(),
            })
            .run()
        })
        Database.immediateTransaction((db) =>
          db
            .update(MessageTable)
            .set({ data: { ...assistantData, time: { ...assistantData.time, completed: Date.now() } } })
            .where(eq(MessageTable.id, assistantID))
            .run(),
        )
        expect(() =>
          Database.immediateTransaction((db) =>
            insertEngineArtifact(db, {
              id: Identifier.ascending("artifact"),
              taskID: fixture.taskID,
              kind: "task_root_ingress_disposition",
              label: "non-canonical-control-identity",
              payload: {
                task_id: fixture.taskID,
                ingress_id: occurrence.ingress.id,
                execution_epoch: 1,
                disposition: "resolved",
                evidence_ids: [requestID],
                decision_occurrence: {
                  assistant_message_id: assistantID,
                  control_message_id: controlMessageID,
                  predecessor_id: predecessorID,
                  activation_id: occurrence.activationID,
                },
                time_created: Date.now(),
              },
              timeCreated: Date.now(),
            }),
          ),
        ).toThrow("engine_artifact: Task-root ingress disposition requires exact immutable release evidence")
      },
    })
  })

  test("rejects a resolved receipt when a completed decision sibling has malformed input", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createExpiredDecisionGapFixture({
          projectPath: project.path,
          semanticTurnLimit: 2,
          label: "malformed-decision-sibling",
        })
        Database.use((db) =>
          db
            .update(EngineControlActivationLeaseTable)
            .set({ expires_at: Date.now() + 60_000 })
            .where(eq(EngineControlActivationLeaseTable.id, fixture.lease.activationID))
            .run(),
        )
        const completedTool = async (tool: string, input: unknown) => {
          const request = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: fixture.orchestrator.id,
            messageID: fixture.assistantID,
            type: "tool",
            callID: Identifier.ascending("call"),
            tool,
            state: { status: "running", input, time: { start: Date.now() } },
          })
          await Session.updatePart({
            ...request,
            state: {
              status: "completed",
              input,
              output: "completed",
              title: tool,
              metadata: {},
              time: { start: request.state.time.start, end: Date.now() },
            },
          })
          return request.id
        }
        const valid = await completedTool("dispatch_agent", { agent: "base-researcher" })
        await completedTool("respond_agent_coordination", { decision: "not-a-decision" })
        const assistant = (await Session.messages({ sessionID: fixture.orchestrator.id })).find(
          (message) => message.info.id === fixture.assistantID,
        )
        if (!assistant || assistant.info.role !== "assistant") throw new Error("Expected malformed sibling assistant")
        await Session.updateMessage({ ...assistant.info, time: { ...assistant.info.time, completed: Date.now() } })
        const control = currentOrchestratorControlMessage(
          { taskCreation: { taskID: fixture.taskID } },
          fixture.taskID,
          fixture.ingress.id,
          fixture.ingress.id,
        )!
        expect(() =>
          Database.immediateTransaction((db) =>
            insertEngineArtifact(db, {
              id: Identifier.ascending("artifact"),
              taskID: fixture.taskID,
              kind: "task_root_ingress_disposition",
              label: "malformed-decision-sibling",
              payload: {
                task_id: fixture.taskID,
                ingress_id: fixture.ingress.id,
                execution_epoch: 1,
                disposition: "resolved",
                evidence_ids: [valid],
                decision_occurrence: {
                  assistant_message_id: fixture.assistantID,
                  control_message_id: control.messageID,
                  predecessor_id: fixture.ingress.id,
                  activation_id: fixture.lease.activationID,
                },
                time_created: Date.now(),
              },
              timeCreated: Date.now(),
            }),
          ),
        ).toThrow("engine_artifact: Task-root ingress disposition requires exact immutable release evidence")
      },
    })
  })

  test("abandons a surfaced Host fault so repaired old evidence cannot execute after its successor", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createExpiredDecisionGapFixture({
          projectPath: project.path,
          semanticTurnLimit: 2,
          label: "host-fault-ordering",
        })
        const assistant = (await Session.messages({ sessionID: fixture.orchestrator.id })).find(
          (message) => message.info.id === fixture.assistantID,
        )
        if (!assistant || assistant.info.role !== "assistant") throw new Error("Expected Host-fault assistant")
        await Session.updateMessage({ ...assistant.info, time: { ...assistant.info.time, completed: Date.now() } })
        const interactionIDs = Database.immediateTransaction((db) =>
          ["first", "second"].map((label) =>
            insertEngineInteractionRequest(db, {
              taskID: fixture.taskID,
              sessionID: fixture.orchestrator.id,
              externalID: `host-fault-ordering-${label}`,
              requestType: "question",
              title: label,
              body: label,
              payload: { tool: { messageID: fixture.assistantID } },
              eventSource: "test.host-fault-ordering",
              eventSummary: label,
              timeCreated: Date.now(),
            }),
          ),
        )
        const successor = Database.immediateTransaction((db) =>
          acceptTaskRootIngressInTransaction(db, {
            taskID: fixture.taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "host-fault-successor",
            inlinePayload: { note: "successor" },
            semanticTurnLimit: 2,
            activationLimit: 2,
            now: Date.now(),
          }),
        )
        const activated: string[] = []
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID }) => {
            if (wakeID) activated.push(wakeID)
            return {}
          },
        })
        await reconcileTaskControlPlane(fixture.taskID)
        const abandoned = Database.use((db) =>
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, fixture.taskID),
                eq(EngineArtifactTable.kind, "task_root_ingress_disposition"),
              ),
            )
            .get(),
        )
        Database.immediateTransaction((db) => {
          for (const interactionID of interactionIDs) {
            const row = db
              .select()
              .from(EngineInteractionRequestTable)
              .where(eq(EngineInteractionRequestTable.id, interactionID))
              .get()!
            resolveEngineInteractionRequest(db, {
              row,
              status: "answered",
              response: { answer: "repaired" },
              eventSource: "test.host-fault-ordering",
              timeResolved: Date.now(),
            })
          }
        })
        const repairedProjection = projectTaskRootIngress(fixture.ingress.id, Date.now(), readTaskRootIngressEvidence)
        const stalePageAcquire = acquireTaskRootIngressLease({
          ingressID: fixture.ingress.id,
          ownerOccurrenceID: "runtime:stale-page-owner",
          now: Date.now(),
          leaseMilliseconds: 1_000,
          readEvidence: readTaskRootIngressEvidence,
          assertControlOwnerInTransaction: () => undefined,
        })
        await reconcileTaskControlPlane(fixture.taskID)
        expect({ abandoned: abandoned?.payload, activated, repairedProjection, stalePageAcquire }).toMatchObject({
          abandoned: {
            ingress_id: fixture.ingress.id,
            disposition: "operator_abandoned",
          },
          activated: [successor.id],
          repairedProjection: { state: "operator_abandoned" },
          stalePageAcquire: { acquired: false, projection: { state: "operator_abandoned" } },
        })
      },
    })
  })

  test("replays a Delivery Slice mutation followed by a dispatch fan-out as the scheduling decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createExpiredDecisionGapFixture({
          projectPath: project.path,
          semanticTurnLimit: 3,
          label: "goal-mutation-then-dispatch",
        })
        Database.use((db) =>
          db
            .update(EngineControlActivationLeaseTable)
            .set({ expires_at: Date.now() + 60_000 })
            .where(eq(EngineControlActivationLeaseTable.id, fixture.lease.activationID))
            .run(),
        )
        const persistCompletedTool = async (tool: string, input: Record<string, unknown>, output: unknown) => {
          const request = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: fixture.orchestrator.id,
            messageID: fixture.assistantID,
            type: "tool",
            callID: `call_${tool}_${Identifier.ascending("part")}`,
            tool,
            state: { status: "running", input, time: { start: Date.now() } },
          })
          await Session.updatePart({
            ...request,
            state: {
              status: "completed",
              input,
              output: JSON.stringify(output),
              title: tool,
              metadata: {},
              time: { start: request.state.time.start, end: Date.now() },
            },
          })
          return request.id
        }
        await persistCompletedTool(
          "manage_task",
          { goal: { title: "New delivery scope" }, reason: "accepted evidence" },
          {
            status: "applied",
          },
        )
        const dispatchIDs = await Promise.all([
          persistCompletedTool(
            "dispatch_agent",
            { dispatch: { target: "implementation-engineer" } },
            { kind: "accepted" },
          ),
          persistCompletedTool("dispatch_agent", { dispatch: { target: "workload-reviewer" } }, { kind: "accepted" }),
        ])
        const assistant = (await Session.messages({ sessionID: fixture.orchestrator.id })).find(
          (message) => message.info.id === fixture.assistantID,
        )
        if (!assistant || assistant.info.role !== "assistant")
          throw new Error("Expected persisted Orchestrator assistant")
        await Session.updateMessage({
          ...assistant.info,
          finish: "tool-calls",
          time: { ...assistant.info.time, completed: Date.now() },
        })

        // Re-open the same SQLite facts before reconciliation: no process-local
        // Tool coordinator state participates in the durable decision replay.
        Database.close()
        Database.Client()
        const reconciled = await reconcileTaskControlPlane(fixture.taskID)
        const evidence = Database.use((db) => readTaskRootIngressEvidence(db, fixture.ingress))
        const expectedDispatchIDs = dispatchIDs.toSorted((left, right) => left.localeCompare(right))

        expect({
          reconciled,
          decisions: evidence.decisions
            .toSorted((left, right) => left.id.localeCompare(right.id))
            .map((decision) => ({ id: decision.id, command: decision.command })),
          projection: projectTaskRootIngress(fixture.ingress.id, Date.now(), readTaskRootIngressEvidence),
        }).toEqual({
          reconciled: 0,
          decisions: expectedDispatchIDs.map((id) => ({ id, command: "dispatch_agent" })),
          projection: { state: "resolved", decisionIDs: expectedDispatchIDs },
        })
      },
    })
  })

  test("resolves a visible no-action answer once and advances the FIFO to the next ingress", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "No-action reconciliation" })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "No-action scheduler",
        })
        const now = Date.now()
        const [first, second] = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "No-action FIFO",
              request: "Answer status, settle, then process the next ingress",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.no-action" })
          return ["status", "next"].map((sourceID, index) =>
            acceptTaskRootIngressInTransaction(db, {
              taskID,
              executionEpoch: 1,
              source: "inline",
              sourceID,
              inlinePayload: { note: sourceID },
              semanticTurnLimit: 3,
              activationLimit: 4,
              now: now + index + 1,
            }),
          )
        })

        const activatedIngresses: string[] = []
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ event, wakeID, activationID, predecessorID }) => {
            if (!event || !wakeID || !activationID || !predecessorID)
              throw new Error("Missing exact activation identity")
            activatedIngresses.push(wakeID)
            const control = currentOrchestratorControlMessage(event, taskID, wakeID, predecessorID)
            if (!control) throw new Error("Expected an Orchestrator control occurrence")
            await Session.persistMessage({
              info: {
                id: control.messageID,
                sessionID: orchestrator.id,
                role: "user",
                author: "orchestrator",
                time: { created: Date.now() },
                agent: "orchestrator",
                model: { providerID: "openai", modelID: "gpt-5.6-terra" },
                extra: control.extra,
              },
              parts: [
                {
                  id: control.partID,
                  sessionID: orchestrator.id,
                  messageID: control.messageID,
                  type: "text",
                  text: control.text,
                  kind: "control",
                  source: "system",
                } satisfies Message.TextPart,
              ],
            })
            let assistant = await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: orchestrator.id,
              parentID: control.messageID,
              role: "assistant",
              author: "orchestrator",
              time: { created: Date.now() },
              agent: "orchestrator",
              providerID: "openai",
              modelID: "gpt-5.6-terra",
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: "tool-calls",
              activationID,
            })
            if (wakeID === first.id) {
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: orchestrator.id,
                messageID: assistant.id,
                type: "text",
                text: "The current workers are healthy; no new frontier is ready.",
                time: { start: Date.now(), end: Date.now() },
              })
            }
            const toolName = wakeID === first.id ? "no_action" : "manage_task"
            const stateInput =
              wakeID === first.id ? { reason: "Current evidence requires no scheduler action." } : { action: "inspect" }
            const request = await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: orchestrator.id,
              messageID: assistant.id,
              type: "tool",
              callID: `call_${toolName}`,
              tool: toolName,
              state: { status: "running", input: stateInput, time: { start: Date.now() } },
            })
            await Session.updatePart({
              ...request,
              state: {
                status: "completed",
                input: stateInput,
                output: "decision committed",
                title: toolName === "no_action" ? "Current Ingress Reconciled" : "Manage Task",
                metadata: {},
                time: { start: request.state.time.start, end: Date.now() },
              },
            })
            assistant = await Session.updateMessage({
              ...assistant,
              time: { ...assistant.time, completed: Date.now() },
            })
            return { finalMessageID: assistant.id }
          },
        })

        expect(await reconcileTaskControlPlane(taskID)).toBe(2)
        expect(await reconcileTaskControlPlane(taskID)).toBe(0)
        const firstEvidence = Database.use((db) => readTaskRootIngressEvidence(db, first))
        const debug = taskRootIngressDebugProjection(taskID)
        const dispositions = Database.use((db) =>
          db
            .select()
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.kind, "task_root_ingress_disposition"))
            .all(),
        )
        expect({
          activatedIngresses,
          firstProjection: projectTaskRootIngress(first.id, Date.now(), readTaskRootIngressEvidence),
          firstDecisions: firstEvidence.decisions.map((decision) => decision.command),
          firstTurns: firstEvidence.turns.map((turn) => turn.id),
          secondProjection: projectTaskRootIngress(second.id, Date.now(), readTaskRootIngressEvidence),
          dispositions: dispositions.map((artifact) => artifact.payload),
          debug: debug.map((entry) => ({
            ingressID: entry.ingressID,
            source: entry.source,
            activationCount: entry.activations.length,
            semanticTurnCount: entry.semanticTurnIDs.length,
            commands: entry.decisions.map((decision) => decision.command),
            state: entry.projection.state,
          })),
        }).toEqual({
          activatedIngresses: [first.id, second.id],
          firstProjection: { state: "resolved", decisionIDs: [expect.any(String)] },
          firstDecisions: ["no_action"],
          firstTurns: [expect.any(String)],
          secondProjection: { state: "resolved", decisionIDs: [expect.any(String)] },
          dispositions: expect.arrayContaining([
            expect.objectContaining({ ingress_id: first.id, disposition: "resolved" }),
            expect.objectContaining({ ingress_id: second.id, disposition: "resolved" }),
          ]),
          debug: [
            {
              ingressID: first.id,
              source: "inline",
              activationCount: 1,
              semanticTurnCount: 0,
              commands: ["no_action"],
              state: "resolved",
            },
            {
              ingressID: second.id,
              source: "inline",
              activationCount: 1,
              semanticTurnCount: 0,
              commands: ["manage_task"],
              state: "resolved",
            },
          ],
        })
      },
    })
  })

  test("continues one prose-only ingress and resolves it from a later exact decision receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Fact-reduced continuation" })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Fact-reduced continuation scheduler",
        })
        const now = Date.now()
        const ingress = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Fact-reduced continuation",
              request: "Continue the same ingress until a decision exists",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.task-control" })
          return acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "continuation-source",
            inlinePayload: { note: "decide once" },
            semanticTurnLimit: 3,
            activationLimit: 4,
            now,
          })
        })

        const calls: Array<{ activationID: string; predecessorID: string; assistantID: string }> = []
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ event, wakeID, activationID, predecessorID }) => {
            if (!event || !wakeID || !activationID || !predecessorID)
              throw new Error("Missing exact activation identity")
            const control = currentOrchestratorControlMessage(event, taskID, wakeID, predecessorID)
            if (!control) throw new Error("Expected an Orchestrator control occurrence")
            await Session.persistMessage({
              info: {
                id: control.messageID,
                sessionID: orchestrator.id,
                role: "user",
                author: "orchestrator",
                time: { created: Date.now() },
                agent: "orchestrator",
                model: { providerID: "openai", modelID: "gpt-5.6-terra" },
                extra: control.extra,
              },
              parts: [
                {
                  id: control.partID,
                  sessionID: orchestrator.id,
                  messageID: control.messageID,
                  type: "text",
                  text: control.text,
                  kind: "control",
                  source: "system",
                } satisfies Message.TextPart,
              ],
            })
            const assistantInput: Message.Assistant = {
              id: Identifier.ascending("message"),
              sessionID: orchestrator.id,
              parentID: control.messageID,
              role: "assistant",
              author: "orchestrator",
              time: calls.length === 0 ? { created: Date.now(), completed: Date.now() + 1 } : { created: Date.now() },
              agent: "orchestrator",
              providerID: "openai",
              modelID: "gpt-5.6-terra",
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: calls.length === 0 ? "stop" : "tool-calls",
              activationID,
            }
            let assistant = await Session.updateMessage(assistantInput)
            calls.push({ activationID, predecessorID, assistantID: assistant.id })
            if (calls.length === 1) return { finalMessageID: assistant.id }
            const request = await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: orchestrator.id,
              messageID: assistant.id,
              type: "tool",
              callID: "call_manage_task_decision",
              tool: "manage_task",
              state: { status: "running", input: { action: "inspect" }, time: { start: Date.now() } },
            })
            await Session.updatePart({
              ...request,
              state: {
                status: "completed",
                input: { action: "inspect" },
                output: "decision committed",
                title: "Manage Task",
                metadata: {},
                time: { start: request.state.time.start, end: Date.now() },
              },
            })
            assistant = await Session.updateMessage({
              ...assistant,
              time: { ...assistant.time, completed: Date.now() },
            })
            return { finalMessageID: assistant.id }
          },
        })

        expect(await reconcileTaskControlPlane(taskID)).toBe(2)

        const leases = Database.use((db) =>
          db
            .select()
            .from(EngineControlActivationLeaseTable)
            .where(eq(EngineControlActivationLeaseTable.target_id, ingress.id))
            .orderBy(asc(EngineControlActivationLeaseTable.time_activated), asc(EngineControlActivationLeaseTable.id))
            .all(),
        )
        expect({
          ingresses: listTaskRootIngresses(taskID, 1).map((row) => row.id),
          predecessors: calls.map((call) => call.predecessorID),
          activations: calls.map((call) => call.activationID),
          leaseIDs: leases.map((lease) => lease.id),
          projection: projectTaskRootIngress(ingress.id, Date.now(), readTaskRootIngressEvidence),
        }).toEqual({
          ingresses: [ingress.id],
          predecessors: [ingress.id, calls[0]!.assistantID],
          activations: leases.map((lease) => lease.id),
          leaseIDs: leases.map((lease) => lease.id),
          projection: { state: "resolved", decisionIDs: [expect.any(String)] },
        })
      },
    })
  })

  test("advances the FIFO after one assistant Turn atomically dispatches parallel agents", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Parallel decision root" })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Parallel decision scheduler",
        })
        const now = Date.now()
        const [first, second] = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Parallel decision convergence",
              request: "Dispatch sibling agents, then advance the FIFO",
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.parallel-decision" })
          return ["first", "second"].map((sourceID, index) =>
            acceptTaskRootIngressInTransaction(db, {
              taskID,
              executionEpoch: 1,
              source: "inline",
              sourceID,
              inlinePayload: { note: `ingress ${index + 1}` },
              semanticTurnLimit: 2,
              activationLimit: 2,
              now: now + index + 1,
            }),
          )
        })

        const activatedIngresses: string[] = []
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ event, wakeID, activationID, predecessorID }) => {
            if (!event || !wakeID || !activationID || !predecessorID)
              throw new Error("Missing exact activation identity")
            activatedIngresses.push(wakeID)
            const control = currentOrchestratorControlMessage(event, taskID, wakeID, predecessorID)
            if (!control) throw new Error("Expected an Orchestrator control occurrence")
            await Session.persistMessage({
              info: {
                id: control.messageID,
                sessionID: orchestrator.id,
                role: "user",
                author: "orchestrator",
                time: { created: Date.now() },
                agent: "orchestrator",
                model: { providerID: "openai", modelID: "gpt-5.6-terra" },
                extra: control.extra,
              },
              parts: [
                {
                  id: control.partID,
                  sessionID: orchestrator.id,
                  messageID: control.messageID,
                  type: "text",
                  text: control.text,
                  kind: "control",
                  source: "system",
                } satisfies Message.TextPart,
              ],
            })
            let assistant = await Session.updateMessage({
              id: Identifier.ascending("message"),
              sessionID: orchestrator.id,
              parentID: control.messageID,
              role: "assistant",
              author: "orchestrator",
              time: { created: Date.now() },
              agent: "orchestrator",
              providerID: "openai",
              modelID: "gpt-5.6-terra",
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: "tool-calls",
              activationID,
            })
            const commands = wakeID === first.id ? ["one", "two", "three"] : ["next"]
            for (const name of commands) {
              const request = await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: orchestrator.id,
                messageID: assistant.id,
                type: "tool",
                callID: `call_dispatch_${name}`,
                tool: "dispatch_agent",
                state: { status: "running", input: { agent: name }, time: { start: Date.now() } },
              })
              await Session.updatePart({
                ...request,
                state: {
                  status: "completed",
                  input: { agent: name },
                  output: `dispatched ${name}`,
                  title: "Dispatch Agent",
                  metadata: {},
                  time: { start: request.state.time.start, end: Date.now() },
                },
              })
            }
            assistant = await Session.updateMessage({
              ...assistant,
              time: { ...assistant.time, completed: Date.now() },
            })
            return { finalMessageID: assistant.id }
          },
        })

        expect(await reconcileTaskControlPlane(taskID)).toBe(2)
        expect({
          activatedIngresses,
          first: projectTaskRootIngress(first.id, Date.now(), readTaskRootIngressEvidence),
          second: projectTaskRootIngress(second.id, Date.now(), readTaskRootIngressEvidence),
        }).toEqual({
          activatedIngresses: [first.id, second.id],
          first: { state: "resolved", decisionIDs: [expect.any(String), expect.any(String), expect.any(String)] },
          second: { state: "resolved", decisionIDs: [expect.any(String)] },
        })
      },
    })
  })

  test("concurrent reconcilers terminalize one crashed assistant before one successor physical activation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createExpiredDecisionGapFixture({
          projectPath: project.path,
          semanticTurnLimit: 2,
          label: "recover-below-limit",
        })
        let successor:
          | { activationID: string; predecessorID: string; controlID: string; assistantID: string }
          | undefined
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ event, wakeID, activationID, predecessorID }) => {
            if (!event || !wakeID || !activationID || !predecessorID) {
              throw new Error("Missing recovered activation identity")
            }
            const control = currentOrchestratorControlMessage(event, fixture.taskID, wakeID, predecessorID)
            if (!control) throw new Error("Expected a successor Task-root control occurrence")
            await Session.persistMessage({
              info: {
                id: control.messageID,
                sessionID: fixture.orchestrator.id,
                role: "user",
                author: "orchestrator",
                time: { created: Date.now() },
                agent: "orchestrator",
                model: { providerID: "openai", modelID: "gpt-5.6-terra" },
                extra: control.extra,
              },
              parts: [
                {
                  id: control.partID,
                  sessionID: fixture.orchestrator.id,
                  messageID: control.messageID,
                  type: "text",
                  text: control.text,
                  kind: "control",
                  source: "system",
                } satisfies Message.TextPart,
              ],
            })
            const assistantID = Identifier.deterministic("message", `task-root-assistant-v1\0${control.messageID}`)
            let assistant = await Session.updateMessage({
              id: assistantID,
              sessionID: fixture.orchestrator.id,
              parentID: control.messageID,
              role: "assistant",
              author: "orchestrator",
              time: { created: Date.now() },
              agent: "orchestrator",
              providerID: "openai",
              modelID: "gpt-5.6-terra",
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: "tool-calls",
              activationID,
            })
            const request = await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: fixture.orchestrator.id,
              messageID: assistant.id,
              type: "tool",
              callID: "call_recovered_manage_task",
              tool: "manage_task",
              state: { status: "running", input: { action: "inspect" }, time: { start: Date.now() } },
            })
            await Session.updatePart({
              ...request,
              state: {
                status: "completed",
                input: { action: "inspect" },
                output: "recovered decision committed",
                title: "Manage Task",
                metadata: {},
                time: { start: request.state.time.start, end: Date.now() },
              },
            })
            assistant = await Session.updateMessage({
              ...assistant,
              time: { ...assistant.time, completed: Date.now() },
            })
            successor = { activationID, predecessorID, controlID: control.messageID, assistantID }
            return { finalMessageID: assistant.id }
          },
        })

        const recoveryResults = await Promise.all([
          reconcileTaskControlPlane(fixture.taskID),
          reconcileTaskControlPlane(fixture.taskID),
        ])
        const sessionMessages = await Session.messages({ sessionID: fixture.orchestrator.id })
        const oldAssistant = sessionMessages.find((message) => message.info.id === fixture.assistantID)
        const assistantIDs = sessionMessages.flatMap((message) =>
          message.info.role === "assistant" ? [message.info.id] : [],
        )
        const controlIDs = sessionMessages.flatMap((message) => {
          if (message.info.role !== "user") return []
          const control = message.info.extra?.orchestrator_control_ingress
          return control?.ingress_id === fixture.ingress.id ? [message.info.id] : []
        })
        const evidence = Database.use((db) => readTaskRootIngressEvidence(db, fixture.ingress))
        const leases = Database.use((db) =>
          db
            .select()
            .from(EngineControlActivationLeaseTable)
            .where(eq(EngineControlActivationLeaseTable.target_id, fixture.ingress.id))
            .orderBy(asc(EngineControlActivationLeaseTable.time_activated), asc(EngineControlActivationLeaseTable.id))
            .all(),
        )
        const expectedSuccessorControl = currentOrchestratorControlMessage(
          { taskCreation: { taskID: fixture.taskID } },
          fixture.taskID,
          fixture.ingress.id,
          fixture.assistantID,
        )!
        expect({
          recoveryResults: recoveryResults.toSorted(),
          oldBoundary: oldAssistant?.info.role === "assistant" ? oldAssistant.info.finish : undefined,
          oldError: oldAssistant?.info.role === "assistant" ? oldAssistant.info.error?.name : undefined,
          oldErrorMessage:
            oldAssistant?.info.role === "assistant" && oldAssistant.info.error?.name === "UnknownError"
              ? oldAssistant.info.error.data.message
              : undefined,
          oldCompleted: oldAssistant?.info.time.completed,
          successor,
          assistantIDs,
          controlIDs,
          leaseIDs: leases.map((lease) => lease.id),
          activity: {
            requestCount: evidence.activityRequests.length,
            outcomes: evidence.activityOutcomes.map((outcome) => outcome.outcome).toSorted(),
          },
          projection: projectTaskRootIngress(fixture.ingress.id, Date.now(), readTaskRootIngressEvidence),
        }).toEqual({
          recoveryResults: [0, 1],
          oldBoundary: "error",
          oldError: "ProcessExecutionInterruptedError",
          oldErrorMessage: undefined,
          oldCompleted: expect.any(Number),
          successor: {
            activationID: leases[1]!.id,
            predecessorID: fixture.assistantID,
            controlID: expectedSuccessorControl.messageID,
            assistantID: Identifier.deterministic(
              "message",
              `task-root-assistant-v1\0${expectedSuccessorControl.messageID}`,
            ),
          },
          assistantIDs: [
            fixture.assistantID,
            Identifier.deterministic("message", `task-root-assistant-v1\0${expectedSuccessorControl.messageID}`),
          ],
          controlIDs: [
            currentOrchestratorControlMessage(
              { taskCreation: { taskID: fixture.taskID } },
              fixture.taskID,
              fixture.ingress.id,
              fixture.ingress.id,
            )!.messageID,
            expectedSuccessorControl.messageID,
          ],
          leaseIDs: [fixture.lease.activationID, leases[1]!.id],
          activity: { requestCount: 2, outcomes: ["completed", "completed"] },
          projection: { state: "resolved", decisionIDs: [expect.any(String)] },
        })
      },
    })
  })

  test("terminalizes a crashed decision-gap assistant at the semantic limit and converges exhausted", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createExpiredDecisionGapFixture({
          projectPath: project.path,
          semanticTurnLimit: 1,
          label: "recover-at-limit",
        })
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async () => {
            throw new Error("An exhausted crash recovery must not start another Provider activation")
          },
        })

        {
          using _failedSurface = TaskControlTestHooks.replaceOperatorGateWriter(() => {
            throw new Error("injected operator-gate persistence failure")
          })
          expect(await reconcileTaskControlPlane(fixture.taskID)).toBe(0)
        }
        expect(
          Database.use((db) =>
            db
              .select()
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.task_id, fixture.taskID))
              .all()
              .filter(
                (artifact) =>
                  artifact.kind === "task-infrastructure-error" &&
                  (artifact.payload as { operation?: string }).operation === "surface-operator-gated-ingress",
              ),
          ),
        ).toHaveLength(0)
        expect(await reconcileTaskControlPlane(fixture.taskID)).toBe(0)
        const oldAssistant = (await Session.messages({ sessionID: fixture.orchestrator.id })).find(
          (message) => message.info.id === fixture.assistantID,
        )
        const evidence = Database.use((db) => readTaskRootIngressEvidence(db, fixture.ingress))
        const debug = taskRootIngressDebugProjection(fixture.taskID)[0]
        const leases = Database.use((db) =>
          db
            .select()
            .from(EngineControlActivationLeaseTable)
            .where(eq(EngineControlActivationLeaseTable.target_id, fixture.ingress.id))
            .all(),
        )
        const exhaustedDisposition = Database.use((db) =>
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.kind, "task_root_ingress_disposition"))
            .get(),
        )
        const gateID = (exhaustedDisposition?.payload as { evidence_ids?: string[] } | undefined)?.evidence_ids?.[0]
        if (!gateID) throw new Error("Expected exhausted disposition gate evidence")
        expect(() =>
          Database.use((db) =>
            db.update(EngineArtifactTable).set({ label: "drift" }).where(eq(EngineArtifactTable.id, gateID)).run(),
          ),
        ).toThrow()
        expect(() =>
          Database.use((db) => db.delete(EngineArtifactTable).where(eq(EngineArtifactTable.id, gateID)).run()),
        ).toThrow("engine_artifact: scheduling disposition evidence is immutable until Task retention")
        expect({
          oldBoundary: oldAssistant?.info.role === "assistant" ? oldAssistant.info.finish : undefined,
          oldError: oldAssistant?.info.role === "assistant" ? oldAssistant.info.error?.name : undefined,
          oldErrorMessage:
            oldAssistant?.info.role === "assistant" && oldAssistant.info.error?.name === "UnknownError"
              ? oldAssistant.info.error.data.message
              : undefined,
          oldCompleted: oldAssistant?.info.time.completed,
          leaseIDs: leases.map((lease) => lease.id),
          providerActivity: {
            requests: evidence.activityRequests.map((request) => request.id),
            outcomes: evidence.activityOutcomes.map((outcome) => outcome.outcome),
          },
          semanticAttemptIDs: debug?.semanticAttemptIDs,
          projection: projectTaskRootIngress(fixture.ingress.id, Date.now(), readTaskRootIngressEvidence),
          surfacedGates: Database.use(
            (db) =>
              db
                .select()
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.task_id, fixture.taskID))
                .all()
                .filter(
                  (artifact) =>
                    artifact.kind === "task-infrastructure-error" &&
                    (artifact.payload as { operation?: string }).operation === "surface-operator-gated-ingress",
                ).length,
          ),
          dispositions: Database.use((db) =>
            db
              .select()
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.kind, "task_root_ingress_disposition"))
              .all()
              .map((artifact) => artifact.payload),
          ),
        }).toEqual({
          oldBoundary: "error",
          oldError: "ProcessExecutionInterruptedError",
          oldErrorMessage: undefined,
          oldCompleted: expect.any(Number),
          leaseIDs: [fixture.lease.activationID],
          providerActivity: { requests: [fixture.providerRequestID], outcomes: ["completed"] },
          semanticAttemptIDs: [fixture.decisionGapStepID],
          projection: { state: "exhausted", reason: "semantic_limit" },
          surfacedGates: 1,
          dispositions: [expect.objectContaining({ ingress_id: fixture.ingress.id, disposition: "exhausted" })],
        })
      },
    })
  })

  test("settles the accepted assistant activity after its Task terminal fact commits", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Terminal settlement root" })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: root.id,
          title: "Terminal settlement scheduler",
        })
        const now = Date.now()
        const ingress = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable)
            .values({
              id: taskID,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Terminal settlement",
              request: "Commit one terminal decision and its exact assistant boundary",
              metadata: { actor: "user" },
              time_created: now,
            })
            .run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.terminal-settlement" })
          return acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "terminal-settlement-source",
            inlinePayload: { note: "complete exactly once" },
            semanticTurnLimit: 2,
            activationLimit: 2,
            now: now + 1,
          })
        })
        const lease = acquireTaskRootIngressLease({
          ingressID: ingress.id,
          ownerOccurrenceID: "terminal-settlement-owner",
          now: now + 2,
          leaseMilliseconds: 60_000,
          assertControlOwnerInTransaction: () => undefined,
        })
        if (!lease.acquired) throw new Error("Expected terminal-settlement activation lease")
        const control = currentOrchestratorControlMessage({ taskCreation: { taskID } }, taskID, ingress.id, ingress.id)
        if (!control) throw new Error("Expected terminal-settlement control occurrence")
        await Session.persistMessage({
          info: {
            id: control.messageID,
            sessionID: orchestrator.id,
            role: "user",
            author: "orchestrator",
            time: { created: now + 3 },
            agent: "orchestrator",
            model: { providerID: "openai", modelID: "gpt-5.6-terra" },
            extra: control.extra,
          },
          parts: [
            {
              id: control.partID,
              sessionID: orchestrator.id,
              messageID: control.messageID,
              type: "text",
              text: control.text,
              kind: "control",
              source: "system",
            } satisfies Message.TextPart,
          ],
        })
        let assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: orchestrator.id,
          parentID: control.messageID,
          role: "assistant",
          author: "orchestrator",
          time: { created: now + 4 },
          agent: "orchestrator",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
          activationID: lease.activationID,
        })
        const request = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_complete_terminal_settlement",
          tool: "manage_task",
          state: { status: "running", input: { action: "complete_task" }, time: { start: now + 5 } },
        })
        await Session.updatePart({
          ...request,
          state: {
            status: "completed",
            input: { action: "complete_task" },
            output: "Task completed from accepted activity",
            title: "Task Completed",
            metadata: {},
            time: { start: request.state.time.start, end: now + 6 },
          },
        })
        const rejectedRequest = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_rejected_no_action",
          tool: "no_action",
          state: {
            status: "running",
            input: { reason: "This coordination ingress does not authorize no_action." },
            time: { start: now + 6 },
          },
        })
        Database.transaction((db) =>
          writeTaskUpdateInTransaction({
            db,
            taskID,
            values: { status: "completed" },
            summary: "Terminal settlement committed",
            now: now + 7,
          }),
        )
        const { tools } = createOrchestratorTools({
          taskID,
          agentSessionID: orchestrator.id,
          sendSchedulerMessage,
          dispatchAgents: [
            {
              identity: {
                agentID: "base-developer",
                baseRole: "build",
                sessionKind: "build",
                dispatchAdapterID: "build",
                runtimeTemplateABIVersion: 1,
                dispatchAdapterABIVersion: 1,
                projectionHash: "b".repeat(64),
              },
              packageRevision: {
                scope: "built_in",
                projectID: null,
                namespace: "opencorvus",
                id: "base",
                version: "1.0.0",
                packageDigest: "a".repeat(64),
              },
              virtualWorkflows: {},
              capabilityOwner: "platform",
              label: "terminal-refusal-evidence",
              builtInToolIDs: [],
              projectedToolIDs: [],
            } as never,
          ],
          terminalConversationAuthority: {
            taskID,
            ingressID: ingress.id,
            ingressKind: "coordination_request",
            coordinationRequestID: Identifier.ascending("artifact"),
            terminalLifecycleReference: requireCurrentTerminalLifecycleReference(taskID),
          },
        })
        // Tool availability follows the real environment, not the Task's
        // terminal color; the recorded refusal below is an assistant-authored
        // Tool failure, which is what this reconciliation actually settles.
        expect(tools.no_action).toBeDefined()
        expect(tools.dispatch_agent).toBeDefined()
        if (!tools.respond_agent_coordination) throw new Error("Expected terminal respond_agent_coordination Tool")
        await Session.updatePart({
          ...rejectedRequest,
          state: {
            status: "error",
            input: { reason: "This coordination ingress does not authorize no_action." },
            failure: {
              kind: "tool-execution",
              name: "Error",
              message: "no_action is absent from a coordination-only terminal conversation table",
              originSite: "test.terminal-settlement",
              classification: "tool-execution",
              data: {},
            },
            time: { start: rejectedRequest.state.time.start, end: now + 9 },
          },
        })
        assistant = await Session.updateMessage({
          ...assistant,
          time: { ...assistant.time, completed: now + 10 },
        })
        const evidence = Database.use((db) => readTaskRootIngressEvidence(db, ingress))
        expect({
          completed: assistant.time.completed,
          outcome: evidence.activityOutcomes[0]?.outcome,
          decisions: evidence.decisions.map((decision) => decision.command),
        }).toEqual({ completed: now + 10, outcome: "completed", decisions: ["manage_task"] })
      },
    })
  })
})
