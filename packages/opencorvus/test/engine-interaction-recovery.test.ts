import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { sql } from "drizzle-orm"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { insertEngineArtifact } from "@/engine/artifact"
import { insertEngineInteractionRequest, resolveEngineInteractionRequest } from "@/engine/interaction-request"
import { EngineInteractionOutcomeTable, EngineInteractionRequestTable } from "@/engine/engine.sql"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import { agentCoordinationQuestionID } from "@/engine/agent-coordination"
import { EngineInteraction } from "@/engine/interaction"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { findInteractionByExternal, listInteractions, pendingInteractionCounts, requireTask } from "@/engine/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { createOrchestratorInteractionTools } from "@/orchestrator/interaction-tools"
import { createAnalyzeIntentTool } from "@/orchestrator/analyze-intent-tool"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { Question } from "@/question"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { EngineService } from "@/task-api"
import { IntentAnalysisAgent } from "@/intent-analysis/agent"
import z from "zod"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "interaction-recovery-test",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function createTaskFixture(title: string) {
  const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  persistTask({
    taskID,
    rootSession: root,
    now,
    title,
    request: `Exercise ${title}`,
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
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
  return { root, taskID, now }
}

async function waitForInteraction(externalID: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const interaction = findInteractionByExternal(externalID)
    if (interaction) return interaction
    await Bun.sleep(25)
  }
  throw new Error(`Interaction ${externalID} was not projected`)
}

async function waitForTaskInteraction(taskID: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const [interaction] = listInteractions(taskID)
    if (interaction) return interaction
    await Bun.sleep(25)
  }
  throw new Error(`Task ${taskID} interaction was not projected`)
}

describe("recovered pending interaction ownership", () => {
  test("commits Interaction request and outcome with their canonical Protocol facts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { root, taskID, now } = await createTaskFixture("atomic interaction publication")
        const externalID = `atomic-interaction-${Identifier.ascending("artifact")}`
        const requestInput = {
          taskID,
          sessionID: root.id,
          externalID,
          requestType: "question" as const,
          title: "Atomic interaction",
          body: "Commit the request and event together",
          payload: { questions: [] },
          eventSource: "test.atomic-interaction",
          eventSummary: "Atomic interaction requested",
          timeCreated: now,
        }
        const footprint = () =>
          Database.use((db) => ({
            requests: db.select().from(EngineInteractionRequestTable).all().length,
            outcomes: db.select().from(EngineInteractionOutcomeTable).all().length,
            events: db
              .select({ type: ProtocolEventTable.type })
              .from(ProtocolEventTable)
              .all()
              .map((row) => row.type)
              .filter((type) => type.startsWith("interaction."))
              .sort(),
          }))
        const before = footprint()

        Database.use((db) =>
          db.run(
            sql.raw(`
              CREATE TEMP TRIGGER arc019_fail_interaction_requested
              BEFORE INSERT ON protocol_event
              WHEN NEW.type = 'interaction.requested'
              BEGIN SELECT RAISE(ABORT, 'injected interaction.requested commit failure'); END
            `),
          ),
        )
        try {
          expect(() => Database.transaction((db) => insertEngineInteractionRequest(db, requestInput))).toThrow(
            "injected interaction.requested commit failure",
          )
        } finally {
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc019_fail_interaction_requested")))
        }
        expect(footprint()).toEqual(before)

        const interactionID = Database.transaction((db) => insertEngineInteractionRequest(db, requestInput))
        const interaction = findInteractionByExternal(externalID)
        expect(interaction?.id).toBe(interactionID)
        Database.use((db) =>
          db.run(
            sql.raw(`
              CREATE TEMP TRIGGER arc019_fail_interaction_resolved
              BEFORE INSERT ON protocol_event
              WHEN NEW.type = 'interaction.resolved'
              BEGIN SELECT RAISE(ABORT, 'injected interaction.resolved commit failure'); END
            `),
          ),
        )
        try {
          expect(() =>
            Database.transaction((db) =>
              resolveEngineInteractionRequest(db, {
                row: interaction!,
                status: "answered",
                response: { answers: [["accepted"]] },
                eventSource: "test.atomic-interaction",
                timeResolved: now + 1,
              }),
            ),
          ).toThrow("injected interaction.resolved commit failure")
        } finally {
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc019_fail_interaction_resolved")))
        }
        expect(footprint()).toEqual({
          requests: before.requests + 1,
          outcomes: before.outcomes,
          events: ["interaction.requested"],
        })

        Database.transaction((db) =>
          resolveEngineInteractionRequest(db, {
            row: interaction!,
            status: "answered",
            response: { answers: [["accepted"]] },
            eventSource: "test.atomic-interaction",
            timeResolved: now + 1,
          }),
        )
        expect(footprint()).toEqual({
          requests: before.requests + 1,
          outcomes: before.outcomes + 1,
          events: ["interaction.requested", "interaction.resolved"],
        })
      },
    })
  }, 30_000)

  test("restores the exact ordinary durable Question and retains a durable Permission after restart", async () => {
    await using project = await memoryProject()
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const { root, taskID } = await createTaskFixture("ordinary recovered waiters")
        const questionID = Identifier.ascending("question")
        void Question.ask({
          sessionID: root.id,
          requestID: questionID,
          questions: [{ header: "Recovery", question: "Choose the recovery action", options: [] }],
          expireOnDeadline: false,
        })
        const question = await waitForInteraction(questionID)
        let resolvePermission!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolvePermission = resolve))
        const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) =>
          resolvePermission(properties),
        )
        const pendingExecution = PermissionAuthority.authorizeAndExecute(
          {
            projectID: Instance.project.id,
            sessionID: root.id,
            messageID: "msg_recovered_permission",
            toolCallID: "call_recovered_permission",
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "write",
            args: { filePath: "recovery.txt", content: "fixture" },
          },
          async () => undefined,
        ).catch((error) => error)
        const request = await asked
        stopAsked()
        const permission = await waitForInteraction(request.id)
        expect([question.status, permission.status]).toEqual(["pending", "pending"])
        return {
          projectID: Instance.project.id,
          taskID,
          questionID,
          questionInteractionID: question.id,
          permissionID: request.id,
          pendingExecution,
        }
      },
    })

    await Instance.disposeAll()
    expect(await created.pendingExecution).toBeInstanceOf(PermissionAuthority.PermissionPausedError)
    expect({
      permission: findInteractionByExternal(created.permissionID)?.status,
      question: findInteractionByExternal(created.questionID)?.status,
    }).toEqual({ permission: "pending", question: "pending" })

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const timeResolved = Date.now()
        expect(
          await EngineInteraction.reconcileRecoveredPendingWaiters({
            projectID: created.projectID,
            timeResolved,
          }),
        ).toEqual({
          abandoned: [],
          retainedRecoverableQuestions: [
            {
              interactionID: created.questionInteractionID,
              externalID: created.questionID,
            },
          ],
          retainedRecoverablePermissions: [
            {
              interactionID: findInteractionByExternal(created.permissionID)!.id,
              externalID: created.permissionID,
            },
          ],
          retainedControlPlaneGates: [],
          unreconciled: [],
        })
        expect((await Question.list()).map((item) => item.id)).toContain(created.questionID)
        expect({
          pendingCount: pendingInteractionCounts([created.taskID]).get(created.taskID) ?? 0,
          secondPass: await EngineInteraction.reconcileRecoveredPendingWaiters({
            projectID: created.projectID,
            timeResolved: timeResolved + 1,
          }),
        }).toEqual({
          pendingCount: 2,
          secondPass: {
            abandoned: [],
            retainedRecoverableQuestions: [
              {
                interactionID: created.questionInteractionID,
                externalID: created.questionID,
              },
            ],
            retainedRecoverablePermissions: [
              {
                interactionID: findInteractionByExternal(created.permissionID)!.id,
                externalID: created.permissionID,
              },
            ],
            retainedControlPlaneGates: [],
            unreconciled: [],
          },
        })
      },
    })
  }, 30_000)

  test("retains an exact durable A2A ask_user lineage and accepts its restored real reply", async () => {
    await using project = await memoryProject()
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const { root, taskID, now } = await createTaskFixture("recoverable A2A question")
        const worker = await Session.create({
          kind: "delegated-worker",
          parentID: root.id,
          title: "A2A question worker",
        })
        const callID = "call_recoverable_a2a_question"
        const parent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test-model" },
        })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "assistant",
          author: "orchestrator",
          parentID: parent.id,
          time: { created: now + 1 },
          agent: "orchestrator",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: root.id,
          messageID: message.id,
          type: "tool",
          callID,
          tool: "respond_agent_coordination",
          state: {
            status: "running",
            input: { decision: "ask_user" },
            time: { start: now + 1 },
          },
        })
        const actionID = Identifier.ascending("artifact")
        const questionID = agentCoordinationQuestionID(actionID)
        Database.transaction((db) =>
          insertEngineArtifact(db, {
            id: actionID,
            taskID,
            kind: "agent_coordination_action",
            label: "pending",
            payload: {
              action_id: actionID,
              request_id: Identifier.ascending("artifact"),
              response_id: Identifier.ascending("artifact"),
              task_id: taskID,
              orchestrator_session_id: root.id,
              orchestrator_message_id: message.id,
              orchestrator_tool_call_id: callID,
              orchestrator_tool_part_id: part.id,
              action: "ask_user",
              decision: "ask_user",
              target_session_id: worker.id,
              target_agent: "test-worker",
              reason: "Ask the operator for the exact recovery choice",
              status: "pending",
              created_at: now + 1,
            },
            timeCreated: now + 1,
          }),
        )
        void Question.ask({
          sessionID: root.id,
          requestID: questionID,
          tool: { messageID: message.id, callID },
          questions: [
            {
              header: "A2A recovery",
              question: "Resume the interrupted worker?",
              options: [{ value: "resume", label: "Resume", description: "Continue the same worker." }],
            },
          ],
          expireOnDeadline: false,
        })
        const interaction = await waitForInteraction(questionID)
        return {
          projectID: Instance.project.id,
          taskID,
          rootSessionID: root.id,
          actionID,
          questionID,
          interactionID: interaction.id,
          messageID: message.id,
          callID,
        }
      },
    })

    await Instance.disposeAll()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const receipt = await EngineInteraction.reconcileRecoveredPendingWaiters({
          projectID: created.projectID,
          timeResolved: Date.now(),
        })
        expect(receipt).toEqual({
          abandoned: [],
          retainedRecoverablePermissions: [],
          retainedRecoverableQuestions: [
            {
              interactionID: created.interactionID,
              externalID: created.questionID,
              actionID: created.actionID,
            },
          ],
          retainedControlPlaneGates: [],
          unreconciled: [],
        })
        const recoveredRequest = (await Question.list()).find((item) => item.id === created.questionID)!
        const restored = Question.ask({
          sessionID: recoveredRequest.sessionID,
          requestID: recoveredRequest.id,
          tool: recoveredRequest.tool,
          questions: recoveredRequest.questions,
          ...(recoveredRequest.automatic ? { automatic: recoveredRequest.automatic } : {}),
          expiry: recoveredRequest.expiry ?? null,
          timeCreated: recoveredRequest.timeCreated,
        })
        expect(
          await EngineService.replyInteraction(created.interactionID, {
            answers: [["resume"]],
            autoReply: false,
          }),
        ).toMatchObject({
          id: created.interactionID,
          taskID: created.taskID,
          externalID: created.questionID,
          type: "question",
          status: "answered",
          response: { answers: [["resume"]] },
        })
        expect(await restored).toEqual([["resume"]])
      },
    })
  }, 30_000)

  test("opens a project holding an activity-reconciliation gate and answers it after recovery", async () => {
    await using project = await memoryProject()
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const { root, taskID, now } = await createTaskFixture("activity reconciliation gate")
        // The Task-root control plane inserts this gate directly: its external
        // identity is a durable locator, never a Question ID.
        const externalID = `task-root-activity-reconciliation-v1:${Identifier.ascending("artifact")}`
        const interactionID = Database.transaction((db) =>
          insertEngineInteractionRequest(db, {
            taskID,
            sessionID: root.id,
            externalID,
            requestType: "question",
            title: "外部操作结果待确认",
            body: "外部操作已发出，但进程在结果收据落盘前中断。",
            payload: {
              activity_reconciliation: {
                ingress_id: Identifier.ascending("artifact"),
                request_id: Identifier.ascending("artifact"),
                assistant_message_id: Identifier.ascending("message"),
              },
              questions: [
                {
                  header: "结果确认",
                  question: "是否确认该外部操作的最终结果无法从权威来源确定？",
                  options: [
                    {
                      value: "acknowledge_unknown",
                      label: "确认结果未知",
                      description: "不会重放外部操作。",
                    },
                  ],
                },
              ],
            },
            eventSource: "task-control.activity-reconciliation",
            eventSummary: "External activity outcome requires operator reconciliation",
            timeCreated: now,
          }),
        )
        return { projectID: Instance.project.id, taskID, externalID, interactionID }
      },
    })

    await Instance.disposeAll()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        // Recovery must neither restore this as a Question nor fail the pass:
        // a poisoned pass is what made project open permanently unreachable.
        expect(
          await EngineInteraction.reconcileRecoveredPendingWaiters({
            projectID: created.projectID,
            timeResolved: Date.now(),
          }),
        ).toEqual({
          abandoned: [],
          retainedRecoverableQuestions: [],
          retainedRecoverablePermissions: [],
          retainedControlPlaneGates: [{ interactionID: created.interactionID, externalID: created.externalID }],
          unreconciled: [],
        })
        expect((await Question.list()).map((item) => item.id)).not.toContain(created.externalID)
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        expect(
          await EngineService.replyInteraction(created.interactionID, {
            answers: [["acknowledge_unknown"]],
            autoReply: false,
          }),
        ).toMatchObject({
          id: created.interactionID,
          externalID: created.externalID,
          type: "question",
          status: "answered",
        })
      },
    })
  }, 30_000)

  test("binds an ordinary Orchestrator question to its persisted physical ToolPart", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const { root, taskID, now } = await createTaskFixture("bound Orchestrator question")
        const callID = "call_bound_orchestrator_question"
        const parent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test-model" },
        })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "assistant",
          author: "orchestrator",
          parentID: parent.id,
          time: { created: now + 1 },
          agent: "orchestrator",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: root.id,
          messageID: message.id,
          type: "tool",
          callID,
          tool: "question",
          state: {
            status: "running",
            input: { questions: [{ header: "Scope", question: "Choose scope" }] },
            time: { start: now + 1 },
          },
        })
        const questionTool = createOrchestratorInteractionTools({
          taskID,
          agentSessionID: root.id,
          allowedRootMessages: [],
        }).question
        if (!questionTool.execute) throw new Error("question tool is missing its executor")
        const output = questionTool.execute(
          {
            questions: [
              {
                header: "Scope",
                question: "Choose the exact scope",
                options: [{ value: "bounded", label: "Bounded", description: "Use the bounded scope." }],
              },
            ],
          },
          {
            toolCallId: callID,
            messages: [],
            abortSignal: new AbortController().signal,
            opencorvus: {
              sessionID: root.id,
              messageID: message.id,
              toolCallID: callID,
              toolPartID: part.id,
              visibleToolName: "question",
            },
          } as never,
        )
        const interaction = await waitForTaskInteraction(taskID)
        expect(interaction.payload.tool).toEqual({ messageID: message.id, callID })
        await EngineService.replyInteraction(interaction.id, {
          answers: [["bounded"]],
          autoReply: false,
        })
        expect(await output).toBe('User answered:\n"Choose the exact scope" -> Bounded [bounded]')
      },
    })
  }, 30_000)

  test("binds an analyze_intent blocker clarification to the physical dispatch ToolPart", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        EngineService.init()
        const { root, taskID, now } = await createTaskFixture("bound intent clarification")
        const callID = "call_bound_intent_clarification"
        const parent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test-model" },
        })
        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "assistant",
          author: "orchestrator",
          parentID: parent.id,
          time: { created: now + 1 },
          agent: "orchestrator",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: root.id,
          messageID: message.id,
          type: "tool",
          callID,
          tool: "dispatch_agent",
          state: {
            status: "running",
            input: { dispatch: { target: "intent-fixture" } },
            time: { start: now + 1 },
          },
        })
        const analysisSession = await Session.create({
          kind: "intent-analysis",
          parentID: root.id,
          title: "Intent analysis fixture",
        })
        const analysisParent = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: analysisSession.id,
          role: "user",
          author: "orchestrator",
          time: { created: now + 2 },
          agent: "intent-fixture",
          model: { providerID: "test", modelID: "test-model" },
        })
        const analysisFinal = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: analysisSession.id,
          role: "assistant",
          author: "intent-fixture",
          parentID: analysisParent.id,
          time: { created: now + 3, completed: now + 4 },
          agent: "intent-fixture",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const analyze = spyOn(IntentAnalysisAgent, "analyze").mockImplementation(
          async () =>
            ({
              sessionID: analysisSession.id,
              finalMessageID: analysisFinal.id,
              facts: {
                slots: [],
                missing: ["scope"],
                clarifications: [
                  {
                    header: "Scope",
                    question: "Which scope should the implementation use?",
                    options: [
                      { value: "bounded", label: "Bounded", description: "Use the bounded implementation scope." },
                    ],
                    multiple: false,
                    custom: false,
                    why_needed: "The implementation boundary must be explicit.",
                    priority: "blocker",
                  },
                ],
              },
            }) as never,
        )
        try {
          const analyzeTool = createAnalyzeIntentTool({
            inputSchema: z.object({ reason: z.string(), attachment_refs: z.array(z.string()) }),
            taskID,
            agentSessionID: root.id,
            requireTask: () => requireTask(taskID),
          }).analyze_intent
          if (!analyzeTool.execute) throw new Error("analyze_intent is missing its executor")
          const dispatchSignal = new AbortController().signal
          const output = analyzeTool.execute({ reason: "Resolve the implementation scope", attachment_refs: [] }, {
            agentID: "intent-fixture",
            projectedAgent: {
              identity: { agentID: "intent-fixture" },
              packageRevision,
              virtualWorkflows: {},
              capabilityOwner: "package",
              label: "Intent fixture",
              builtInToolIDs: [],
              projectedToolIDs: [],
            },
            workScope: { kind: "task" },
            existingSessionID: analysisSession.id,
            signal: dispatchSignal,
            dispatch: {
              dispatchID: "dispatch_intent_fixture",
              existingSessionID: analysisSession.id,
              deliverySliceRevisionIDs: [],
              adapterInput: {},
              signal: dispatchSignal,
              turn: {
                kind: "initial",
                current_dispatch_id: "dispatch_intent_fixture",
                workflow_binding: {
                  kind: "direct",
                  package_revision: {
                    scope: packageRevision.scope,
                    project_id: packageRevision.projectID,
                    namespace: packageRevision.namespace,
                    id: packageRevision.id,
                    version: packageRevision.version,
                    package_digest: packageRevision.packageDigest,
                  },
                },
                workflow_node_id: null,
                workflow_occurrence_id: "occurrence_intent_fixture",
                delivery_slice_revision_ids: [],
                evidence_locators: [],
                task_authority: {
                  task_id: taskID,
                  root_session_id: root.id,
                  request_sha256: taskRequestSHA256(requireTask(taskID).request),
                  initial_control_text_parts: [],
                },
              },
              observeSession() {},
              commitSession() {},
            },
            toolOptions: {
              toolCallId: callID,
              opencorvus: {
                sessionID: root.id,
                messageID: message.id,
                toolCallID: callID,
                toolPartID: part.id,
                visibleToolName: "dispatch_agent",
              },
            },
          } as never)
          const interaction = await waitForTaskInteraction(taskID)
          expect(interaction.payload.tool).toEqual({ messageID: message.id, callID })
          await EngineService.replyInteraction(interaction.id, {
            answers: [["bounded"]],
            autoReply: false,
          })
          expect(await output).toEqual({
            kind: "terminal_success",
            session_id: analysisSession.id,
            final_message_id: analysisFinal.id,
          })
        } finally {
          analyze.mockRestore()
        }
      },
    })
  }, 30_000)
})
