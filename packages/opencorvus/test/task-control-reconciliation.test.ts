import { afterEach, describe, expect, test } from "bun:test"
import { EngineControlActivationLeaseTable, EngineTaskTable } from "@/engine/engine.sql"
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
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { Database, asc, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Task-control reconciliation", () => {
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
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:test-no-action")
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
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:test-task-control")
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
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:test-parallel-decision")
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
        const noAction = tools.no_action
        if (!noAction?.execute) throw new Error("Expected terminal no_action Tool")
        let refusal: unknown
        try {
          await noAction.execute(
            { reason: "This coordination ingress does not authorize no_action." },
            { toolCallId: "call_rejected_no_action", messages: [], abortSignal: new AbortController().signal },
          )
        } catch (error) {
          refusal = error
        }
        expect(refusal).toMatchObject({
          name: "TerminalToolAuthorityError",
          code: "TERMINAL_TOOL_AUTHORITY_DENIED",
        })
        await Session.updatePart({
          ...rejectedRequest,
          state: {
            status: "error",
            input: { reason: "This coordination ingress does not authorize no_action." },
            failure: {
              kind: "terminal-tool-authority-denied",
              name: "TerminalToolAuthorityError",
              message: "Terminal conversation does not authorize no_action",
              originSite: "orchestrator.tools.terminalConversationToolRefusal",
              classification: "tool-execution",
              data: { code: "TERMINAL_TOOL_AUTHORITY_DENIED" },
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
