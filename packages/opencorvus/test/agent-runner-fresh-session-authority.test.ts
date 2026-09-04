import { afterEach, expect, spyOn, test } from "bun:test"
import { DelegatedWorkerAgent } from "@/delegated-worker/agent"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import {
  commitDispatchLineageSession,
  createDispatchLineageOrigin,
  listDispatchLineage,
} from "@/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import {
  reconcileTerminalAgentLifecycleDelivery,
  TestHooks as IngressTestHooks,
  waitForIngressDeliveryHooksForTest,
} from "@/engine/task-root-ingress-delivery"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import {
  assertTaskWorkflowBindingInTransaction,
  TaskWorkflowBindingConflictError,
} from "@/engine/workflow-binding-facts"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Provider } from "@/provider/provider"
import type { Provider as ProviderType } from "@/provider/provider"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Message } from "@/session/message"
import { SessionProcessor } from "@/session/processor"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { resolveSessionMessageIdentity } from "@/session/message-identity"
import { materializeUserMessage, preparedUserMessageFromPreflight } from "@/session/prompt/parts"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { createDispatchAgentTool, type DispatchAdapterExecutors } from "@/orchestrator/dispatch-agent-tool"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { Database, and, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { requireTask } from "@/engine/store"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"

const model = { providerID: "test", modelID: "fresh-runner-authority" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Fresh Runner Authority Test",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    api: { id: model.modelID, url: "https://fresh-runner.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-09",
  } as ProviderType.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("fresh delegated worker commits Session, input authority, lineage, and occurrence before provider processing", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      using _ingressRunner = IngressTestHooks.replaceTaskIngressRunner({
        runner: async ({ taskID, wakeID, predecessorID }) => {
          if (!wakeID || !predecessorID) throw new Error("Lifecycle delivery requires its exact Task ingress identity")
          const task = requireTask(taskID)
          if (!task.session_id) throw new Error(`Task ${taskID} has no root Session`)
          const orchestrator = await Session.create({
            kind: "orchestrator",
            parentID: task.session_id,
            title: "Fresh worker lifecycle receiver",
          })
          const now = Date.now()
          const parentID = orchestratorControlOccurrenceIdentity(wakeID, predecessorID).messageID
          await Session.persistMessage({
            info: {
              id: parentID,
              sessionID: orchestrator.id,
              role: "user",
              author: "orchestrator",
              time: { created: now },
              agent: "orchestrator",
              model,
            },
            parts: [],
          })
          const finalMessageID = Identifier.ascending("message")
          const assistant: Message.Assistant = {
            id: finalMessageID,
            sessionID: orchestrator.id,
            parentID,
            role: "assistant",
            author: "orchestrator",
            time: { created: now, completed: now + 1 },
            agent: "orchestrator",
            providerID: model.providerID,
            modelID: model.modelID,
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
            finish: "stop",
            taskIngress: { id: wakeID, kind: "agent_lifecycle_delivery" },
          }
          await Session.persistMessage({ info: assistant, parts: [] })
          return { finalMessageID }
        },
      })
      const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
        prompt_profile: { active: "base" },
      })
      const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
        projectDirectory: Instance.project.worktree,
        config,
      })
      const projection = await PromptProfileResolver.resolveWorkerTurnProjection({
        projectDirectory: Instance.project.worktree,
        config,
        agentID: "base-planner",
        packageRevision,
      })
      const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
        projectDirectory: Instance.project.worktree,
        config,
        packageRevision,
      })
      const skillProjection = await PromptProfileResolver.resolveSkillProjection({
        projectDirectory: Instance.project.worktree,
        config,
        packageRevision,
      })
      const workflowBinding = selectedWorkflowBinding({
        projection: {
          packageRevision,
          virtualWorkflows: scheduler.virtualWorkflows,
        },
        workflowID: "planner-parallel-delivery",
      })
      const taskID = Identifier.ascending("task")
      const taskRequest = "Publish the bounded research charter"
      const root = Session.prepareRootNext({
        kind: "root",
        directory: Instance.directory,
        title: "Fresh worker authority",
        metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })
      const now = Date.now()
      persistTask({
        taskID,
        rootSession: root,
        now,
        title: "Fresh worker authority",
        request: taskRequest,
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

      const dispatchID = Identifier.ascending("artifact")
      const freshSessionID = Identifier.deterministic("session", `fresh-runner-authority\0${dispatchID}`)
      const turn = {
        kind: "initial" as const,
        current_dispatch_id: dispatchID,
        workflow_binding: workflowBinding,
        workflow_node_id: "base-planner",
        workflow_occurrence_id: dispatchID,
        delivery_slice_revision_ids: [],
        evidence_locators: [],
        task_authority: {
          task_id: taskID,
          root_session_id: root.id,
          request_sha256: taskRequestSHA256(taskRequest),
          initial_control_text_parts: [],
        },
      }
      const origin = createDispatchLineageOrigin({
        dispatchID,
        taskID,
        orchestratorSessionID: root.id,
        orchestratorMessageID: Identifier.ascending("message"),
        toolPartID: Identifier.ascending("part"),
        toolCallID: "call_fresh_runner_authority",
        targetAgentID: projection.workerCapability.identity.agentID,
        projectedWorkerIdentity: projection.workerCapability.identity,
        workScope: { kind: "task" },
        workflowBinding,
        workflowNodeID: "base-planner",
        workflowOccurrenceID: dispatchID,
        adapterInput: { instruction: taskRequest },
      })
      const lineage = recordTestDispatchLineage({ origin, childSessionID: freshSessionID })

      let processorStarts = 0
      let firstAssistantMessageID: string | undefined
      let canonicalFinalMessageID: string | undefined
      let committedSessionID: string | undefined
      let lineageArtifactID: string | undefined
      const providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
      const runtimeDisposeSpy = spyOn(SessionRuntimeContractStore, "dispose")
      const processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
        processorStarts++
        const assistant = input.assistantMessage
        return {
          message: assistant,
          partFromToolCall() {
            return undefined
          },
          async process() {
            const firstStep = processorStarts === 1
            if (firstStep) firstAssistantMessageID = assistant.id
            else canonicalFinalMessageID = assistant.id
            await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: assistant.sessionID,
              messageID: assistant.id,
              type: "text",
              text: firstStep ? "intermediate tool evidence" : "canonical charter complete",
            })
            assistant.finish = firstStep ? "tool-calls" : "stop"
            assistant.time.completed = Date.now()
            await Session.updateMessage(assistant)
            return firstStep ? "continue" : "stop"
          },
        } as any
      })

      try {
        const result = await DelegatedWorkerAgent.run({
          agentID: projection.workerCapability.identity.agentID,
          packageRevision,
          instruction: taskRequest,
          sessionTitle: "Planner",
          newSessionID: freshSessionID,
          taskID,
          workScope: { kind: "task" },
          parentSessionID: root.id,
          dispatchTurn: turn,
          model,
          onDispatchAuthorityCommit(sessionID, descriptor) {
            expect(WorkerTurnDescriptor.get({ id: descriptor.id, sessionID })).toEqual(descriptor)
            commitDispatchLineageSession(lineage)
            lineageArtifactID = lineage.artifactID
          },
          async onSessionCreated(sessionID) {
            committedSessionID = sessionID
            expect(processorStarts).toBe(0)
            const session = await Session.get(sessionID)
            const messages = await Session.messages({ sessionID })
            const descriptor = WorkerTurnDescriptor.latestForSession(sessionID)
            expect(SessionRuntimeContractStore.get(sessionID)).toMatchObject({
              identity: {
                identityKind: "projected-worker",
                sessionID,
                workerTurnDescriptorID: descriptor?.id,
                workerTurnDescriptorHash: descriptor?.hash,
              },
            })
            const mismatchPrompt = {
              sessionID,
              messageID: Identifier.ascending("message"),
              author: "orchestrator" as const,
              agent: projection.workerCapability.identity.agentID,
              model,
              parts: [{ type: "text" as const, text: "mismatched host authority" }],
            }
            const mismatchIdentity = await resolveSessionMessageIdentity({
              session,
              requestedAgentID: projection.workerCapability.identity.agentID,
              config,
            })
            const mismatchPrepared = preparedUserMessageFromPreflight({
              prompt: mismatchPrompt,
              config,
              session,
              identity: mismatchIdentity,
              modelPreflight: { model },
            })
            await expect(
              materializeUserMessage(mismatchPrompt, {
                prepared: mismatchPrepared,
                executionAuthorityResolution: {
                  expected: { kind: "conversation" },
                },
              }),
            ).rejects.toThrow(`User message execution authority does not match runtime Task ${taskID}`)
            expect({ session, messages, descriptor }).toMatchObject({
              session: { id: sessionID, parentID: root.id, kind: "delegated-worker" },
              messages: [
                {
                  info: { id: descriptor?.payload.messageAuthority.user_message_id, role: "user" },
                  parts: [{ type: "text" }],
                },
              ],
              descriptor: {
                payload: {
                  dispatchTurn: {
                    kind: "initial",
                    current_dispatch_id: dispatchID,
                    workflow_occurrence_id: dispatchID,
                  },
                },
              },
            })
            expect(listDispatchLineage(taskID)).toMatchObject([
              { dispatchID, payload: { child_session_id: sessionID, workflow_occurrence_id: dispatchID } },
            ])
          },
        })

        expect(result).toEqual({ sessionID: committedSessionID, finalMessageID: canonicalFinalMessageID })
        expect(processorStarts).toBe(2)
        expect(result.finalMessageID).not.toBe(firstAssistantMessageID)
        expect(await MessageStore.get({ sessionID: committedSessionID!, messageID: result.finalMessageID })).toMatchObject({
          info: { id: canonicalFinalMessageID, parentID: expect.any(String), finish: "stop" },
          parts: [{ type: "text", text: "canonical charter complete" }],
        })
        expect(runtimeDisposeSpy).toHaveBeenCalledTimes(1)
        expect(SessionPromptState.TestHooks.promptResourceSnapshot(committedSessionID!)).toEqual({
          promptOwners: 0,
          messageOwnerRegistries: 0,
          startReservations: 0,
          cancellationReceipts: 0,
        })
        const descriptor = WorkerTurnDescriptor.findForDispatch({
          sessionID: committedSessionID!,
          dispatchID,
        })
        const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
          committedSessionID!,
          "agent.execution.lifecycle",
          descriptor!.payload.messageAuthority.user_message_id,
        )
        expect(lifecycle).toMatchObject({
          sessionID: committedSessionID,
          payload: {
            status: {
              type: "terminal",
              reason: "completed",
              final_message_id: canonicalFinalMessageID,
            },
          },
        })
        expect(
          await reconcileTerminalAgentLifecycleDelivery({ taskID, sessionID: committedSessionID!, dispatchID }),
        ).toBe("already_delivered")
        expect(
          await reconcileTerminalAgentLifecycleDelivery({ taskID, sessionID: committedSessionID!, dispatchID }),
        ).toBe("already_delivered")
        const directBinding = selectedWorkflowBinding({
          projection: {
            packageRevision,
            virtualWorkflows: scheduler.virtualWorkflows,
          },
          workflowID: null,
        })
        try {
          Database.use((db) => assertTaskWorkflowBindingInTransaction({ db, taskID, workflowBinding: directBinding }))
          throw new Error("Expected immutable workflow binding conflict")
        } catch (error) {
          expect(error).toBeInstanceOf(TaskWorkflowBindingConflictError)
          expect(error).toMatchObject({
            code: "task_workflow_binding_conflict",
            taskID,
            artifactID: lineageArtifactID,
          })
        }
        const executors = Object.fromEntries(
          DispatchAdapterContractRegistry.ids.map((id) => [
            id,
            async () => {
              throw new Error(`unexpected ${id} provider execution`)
            },
          ]),
        ) as Record<AgentDispatchAdapterID, DispatchAdapterExecutors[AgentDispatchAdapterID]>
        const dispatchTool = createDispatchAgentTool({
          taskID,
          projectedAgents: skillProjection.projectedAgents,
          executors,
          openLineage({ workflowBinding: requestedBinding }) {
            return Database.use((db) =>
              assertTaskWorkflowBindingInTransaction({ db, taskID, workflowBinding: requestedBinding! }),
            ) as never
          },
          runInWorktree: async ({ run }) => await run(),
          runDetached: async (run) => await run(),
          runDetachedRecovery: async (run) => await run(),
        })
        const conflictOutcome = await (dispatchTool.execute as any)(
          {
            dispatch: {
              target: projection.workerCapability.identity.agentID,
              work_scope: { kind: "task" },
              turn: {
                kind: "initial",
                workflow_subject: { kind: "direct" },
                use_worktree: false,
                input: {
                  goal_ids: [],
                  instruction: "attempt an invalid direct dispatch after virtual workflow selection",
                  reason: "verify immutable binding is exposed by the public dispatch contract",
                },
              },
            },
          },
          {},
        )
        expect(conflictOutcome).toMatchObject({
          kind: "infrastructure_failure",
          operation: "workflow_binding_initial_claim",
          error_name: "TaskWorkflowBindingConflictError",
          recovery_authority: { occurrence_status: "occurrence_not_committed" },
          failure_issues: [
            {
              code: "task_workflow_binding_conflict",
              path: ["dispatch", "turn", "workflow_subject"],
            },
          ],
        })
      } finally {
        runtimeDisposeSpy.mockRestore()
        processorSpy.mockRestore()
        providerSpy.mockRestore()
      }
    },
  })
  // The accepted lifecycle delivery owns an independent project lease. Join
  // it only after the setup/contract assertion lease has been released.
  await waitForIngressDeliveryHooksForTest()
}, 60_000)
