import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactTable, EngineControlActivationLeaseTable, EngineTaskTable } from "@/engine/engine.sql"
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
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { recordProviderActivityEvent } from "@/session/provider-activity-facts"
import { Database, asc, eq } from "@/storage/db"
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
        expect({
          activatedIngresses,
          firstProjection: projectTaskRootIngress(first.id, Date.now(), readTaskRootIngressEvidence),
          firstDecisions: firstEvidence.decisions.map((decision) => decision.command),
          firstTurns: firstEvidence.turns.map((turn) => turn.id),
          secondProjection: projectTaskRootIngress(second.id, Date.now(), readTaskRootIngressEvidence),
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
          surfacedGates: Database.use((db) =>
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
