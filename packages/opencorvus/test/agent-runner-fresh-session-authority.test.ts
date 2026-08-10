import { afterEach, expect, spyOn, test } from "bun:test"
import { DelegatedWorkerAgent } from "@/delegated-worker/agent"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import { createDispatchLineageOrigin, listDispatchLineage, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { EngineArtifactTable, EngineWorkflowNodeOccurrenceTable } from "@/engine/engine.sql"
import { persistQueuedTask } from "@/engine/pipeline"
import { reconcileTerminalAgentLifecycleDelivery, waitForQueueCompletionHooksForTest } from "@/engine/queue"
import { QueuedTaskIngressSchema } from "@/engine/queued-task-ingress"
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
import { SessionProcessor } from "@/session/processor"
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

const model = { providerID: "test", modelID: "fresh-runner-authority" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Fresh Runner Authority Test",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
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
        workflowID: "composite-delivery",
      })
      const taskID = Identifier.ascending("task")
      const taskRequest = "Publish the bounded research charter"
      const root = await Session.create({
        kind: "root",
        title: "Fresh worker authority",
        metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })
      const now = Date.now()
      persistQueuedTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Fresh worker authority",
        request: taskRequest,
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

      const dispatchID = Identifier.ascending("artifact")
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

      let processorStarts = 0
      let committedSessionID: string | undefined
      let lineageArtifactID: string | undefined
      const providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
      const processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
        processorStarts++
        const assistant = input.assistantMessage
        return {
          message: assistant,
          partFromToolCall() {
            return undefined
          },
          async process() {
            await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: assistant.sessionID,
              messageID: assistant.id,
              type: "text",
              text: "charter complete",
            })
            assistant.finish = "stop"
            assistant.time.completed = Date.now()
            await Session.updateMessage(assistant)
            return "stop"
          },
        } as any
      })

      try {
        const result = await DelegatedWorkerAgent.run({
          agentID: projection.workerCapability.identity.agentID,
          packageRevision,
          instruction: taskRequest,
          sessionTitle: "Planner",
          taskID,
          workScope: { kind: "task" },
          parentSessionID: root.id,
          dispatchTurn: turn,
          model,
          onDispatchAuthorityCommit(sessionID, descriptor) {
            expect(WorkerTurnDescriptor.get({ id: descriptor.id, sessionID })).toEqual(descriptor)
            lineageArtifactID = recordDispatchLineage({ origin, childSessionID: sessionID }).artifactID
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
            expect(
              Database.use((db) =>
                db
                  .select()
                  .from(EngineWorkflowNodeOccurrenceTable)
                  .where(
                    and(
                      eq(EngineWorkflowNodeOccurrenceTable.task_id, taskID),
                      eq(EngineWorkflowNodeOccurrenceTable.workflow_node_id, "base-planner"),
                    ),
                  )
                  .get(),
              ),
            ).toMatchObject({
              state: "bound",
              workflow_occurrence_id: dispatchID,
              initial_dispatch_id: dispatchID,
              child_session_id: sessionID,
              dispatch_lineage_artifact_id: lineageArtifactID,
            })
          },
        })

        expect(result).toMatchObject({ sessionID: committedSessionID })
        expect(processorStarts).toBe(1)
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
          payload: { status: { type: "terminal", reason: "completed" } },
        })
        const blockerTaskID = Identifier.ascending("task")
        const blockerRoot = await Session.create({ kind: "root", title: "Occupied root queue owner" })
        persistQueuedTask({
          taskID: blockerTaskID,
          sessionID: blockerRoot.id,
          now: Date.now(),
          title: "Occupied root queue owner",
          request: "Keep the root queue occupied while lifecycle delivery is accepted",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          queue: false,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID: blockerTaskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: Date.now(),
          }),
        })
        expect(
          await reconcileTerminalAgentLifecycleDelivery({ taskID, sessionID: committedSessionID!, dispatchID }),
        ).toBe("delivered")
        await waitForQueueCompletionHooksForTest()
        expect(
          await reconcileTerminalAgentLifecycleDelivery({ taskID, sessionID: committedSessionID!, dispatchID }),
        ).toBe("already_delivered")
        const lifecycleWakes = Database.use((db) =>
          db
            .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
            .all(),
        )
          .map((row) => ({ label: row.label, ingress: QueuedTaskIngressSchema.parse(row.payload) }))
          .filter((row) => row.ingress.lifecycle_event_id === lifecycle!.id)
        expect(lifecycleWakes).toMatchObject([
          {
            label: "pending",
            ingress: {
              lifecycle_event_id: lifecycle!.id,
              event: {
                agentLifecycleDelivery: {
                  eventID: lifecycle!.id,
                  sessionID: committedSessionID,
                  dispatchID,
                },
              },
            },
          },
        ])
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
              use_worktree: false,
              turn: {
                kind: "initial",
                workflow_subject: { kind: "direct" },
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
        processorSpy.mockRestore()
        providerSpy.mockRestore()
      }
    },
  })
}, 60_000)
