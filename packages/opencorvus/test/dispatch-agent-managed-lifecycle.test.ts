import fs from "node:fs/promises"
import { afterEach, expect, spyOn, test } from "bun:test"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { WorkerTurnSettlementError } from "@/agent/runner"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { DelegatedWorkerAgent } from "@/delegated-worker/agent"
import { createDispatchLineageOrigin, listDispatchLineage, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { expertSquadPackageRevisionBinding } from "@/engine/expert-squad-package-revision-binding"
import { EngineArtifactTable, EngineTaskCancellationAuthorityTable, EngineTaskTable } from "@/engine/engine.sql"
import { EngineGit } from "@/engine/git"
import { Event } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { recordTaskInfrastructureError } from "@/engine/persist"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { TaskRootIngressSchema } from "@/engine/task-root-ingress"
import {
  dispatchTaskLoop,
  reconcileFailedExactTerminalIngressDeliveries,
  reconcileTerminalAgentLifecycleDelivery,
  reconcileTerminalAgentLifecycleDeliveries,
  reconcileUndeliveredDispatchInfrastructureFacts,
  TestHooks as IngressTestHooks,
  waitForIngressDeliveryHooksForTest,
} from "@/engine/task-root-ingress-delivery"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { terminalTask } from "@/engine/state"
import { requireTask } from "@/engine/store"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { taskOrchestratorSession } from "@/orchestrator/task-session"
import { createOrchestratorTools } from "@/orchestrator/tools"
import {
  createDispatchAgentTool,
  acquireDetachedDispatchSettlementGate,
  detachDispatchExecution,
  waitForDetachedDispatchPipelinesForTest,
  type DispatchAdapterExecutors,
} from "@/orchestrator/dispatch-agent-tool"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"
import { Instance } from "@/project/instance"
import {
  runWithIndependentProjectIdentity,
  runWithInitializedIndependentProject,
} from "@/project/independent-project-owner"
import * as OrchestratorLoop from "@/orchestrator/loop"
import type { OrchestratorEvent } from "@/orchestrator/event"
import { ProtocolStore } from "@/protocol/store"
import { Provider } from "@/provider/provider"
import type { Provider as ProviderType } from "@/provider/provider"
import { RuntimeExecutionSettlement, RuntimeExecutionSettlementInactivityError } from "@/runtime/execution-settlement"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionPromptState } from "@/session/prompt/state"
import { isExecutionCancellationError } from "@/session/prompt/cancellation"
import { SessionProcessor } from "@/session/processor"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { Database, and, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { Worktree } from "@/worktree"
import { ProjectGitLock } from "@/worktree/git-lock"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const model = { providerID: "test", modelID: "managed-dispatch-lifecycle" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Managed Dispatch Lifecycle Test",
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
    api: { id: model.modelID, url: "https://managed-dispatch.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-10",
  } as ProviderType.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("projects durable Task cancellation as the dispatch_agent preparation result", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const packageRevision = {
        scope: "built_in" as const,
        projectID: null,
        namespace: "builtin",
        id: "base",
        version: "2026.08.09.1",
        packageDigest: "a".repeat(64),
      }
      const root = await Session.create({
        kind: "root",
        title: "Cancelled dispatch authority",
        metadata: { configOverlay: { model: "openai/gpt-5.6-sol" } },
      })
      const taskID = Identifier.ascending("task")
      const now = Date.now()
      persistTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Cancelled dispatch authority",
        request: "Converge cancellation before any later worker dispatch",
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
      const requested = await EngineProtocol.emit(
        Event.TaskCancellationRequested,
        {
          taskID,
          actor: "user",
          surface: "overlay.work_ledger",
          reason: "Stop the exact Task before another worker dispatch",
          summary: "Cancellation requested before dispatch",
        },
        { source: "task.cancel", correlationID: "cancel-before-dispatch" },
      )
      const projectedWorkerIdentity = {
        agentID: "base-developer",
        baseRole: "build",
        sessionKind: "build",
        dispatchAdapterID: "build",
        runtimeTemplateABIVersion: 1,
        dispatchAdapterABIVersion: 1,
        projectionHash: "b".repeat(64),
      } as const
      const preparedBeforeCancellation = createDispatchLineageOrigin({
        taskID,
        orchestratorSessionID: root.id,
        orchestratorMessageID: Identifier.ascending("message"),
        toolPartID: Identifier.ascending("part"),
        toolCallID: "call_racing_cancelled_dispatch",
        targetAgentID: projectedWorkerIdentity.agentID,
        projectedWorkerIdentity,
        workScope: { kind: "task" },
        workflowBinding: {
          kind: "direct",
          package_revision: expertSquadPackageRevisionBinding(packageRevision),
        },
        workflowNodeID: null,
        adapterInput: {
          goal_ids: [],
          request: "Do not commit after cancellation wins the race",
          reason: "Exercise the durable lineage transaction fence.",
        },
      })
      Database.use((db) =>
        db
          .insert(EngineTaskCancellationAuthorityTable)
          .values({ task_id: taskID, request_event_id: requested.id })
          .run(),
      )
      let racedLineageFailure: unknown
      try {
        recordDispatchLineage({
          origin: preparedBeforeCancellation,
          childSessionID: Identifier.ascending("session"),
        })
      } catch (error) {
        racedLineageFailure = error
      }
      if (!isExecutionCancellationError(racedLineageFailure)) throw racedLineageFailure
      expect({
        failure: racedLineageFailure,
        lineages: listDispatchLineage(taskID),
      }).toMatchObject({
        failure: {
          source: "dispatch_preparation",
          origin: {
            requestID: "cancel-before-dispatch",
            causationEventID: requested.id,
          },
        },
        lineages: [],
      })
      const targetAgentID = "base-developer"
      const projectedAgent = {
        identity: projectedWorkerIdentity,
        packageRevision,
        virtualWorkflows: {},
        capabilityOwner: "platform",
        label: "cancelled-dispatch-test",
        builtInToolIDs: [],
        projectedToolIDs: [],
      } as never
      const executors = Object.fromEntries(
        DispatchAdapterContractRegistry.ids.map((id) => [
          id,
          async () => {
            throw new Error(`unexpected ${id} execution`)
          },
        ]),
      ) as Record<AgentDispatchAdapterID, DispatchAdapterExecutors[AgentDispatchAdapterID]>
      const dispatchTool = createDispatchAgentTool({
        taskID,
        projectedAgents: [projectedAgent],
        executors,
        runDetached: async (run) => await run(),
        runDetachedRecovery: async (run) => await run(),
        runInWorktree: async ({ run }) => await run(),
        openLineage() {
          throw new Error("dispatch lineage opened after cancellation authority")
        },
      })
      let failure: unknown
      try {
        await (dispatchTool.execute as any)(
          {
            dispatch: {
              target: targetAgentID,
              work_scope: { kind: "task" },
              use_worktree: false,
              turn: {
                kind: "initial",
                workflow_subject: { kind: "direct" },
                input: {
                  goal_ids: [],
                  request: "Do not start after cancellation",
                  reason: "The durable cancellation authority is the expected dispatch result.",
                },
              },
            },
          },
          { toolCallId: "call_cancelled_dispatch", messages: [] },
        )
      } catch (error) {
        failure = error
      }
      if (!isExecutionCancellationError(failure)) throw failure
      expect(failure).toMatchObject({
        name: "ExecutionCancellationError",
        source: "dispatch_preparation",
        origin: {
          source: "task.cancel",
          requestID: "cancel-before-dispatch",
          causationEventID: requested.id,
          taskID,
        },
      })
      await terminalTask(
        requireTask(taskID),
        { status: "cancelled", error: "task cancelled", time_completed: Date.now() },
        "Commit the exact cancellation before a later dispatch attempt",
        { cancellationRequest: { eventID: requested.id } },
      )
      let terminalFailure: unknown
      try {
        await (dispatchTool.execute as any)(
          {
            dispatch: {
              target: targetAgentID,
              work_scope: { kind: "task" },
              use_worktree: false,
              turn: {
                kind: "initial",
                workflow_subject: { kind: "direct" },
                input: {
                  goal_ids: [],
                  request: "Do not start after terminal cancellation",
                  reason: "The completed cancellation authority remains the dispatch result.",
                },
              },
            },
          },
          { toolCallId: "call_terminal_cancelled_dispatch", messages: [] },
        )
      } catch (error) {
        terminalFailure = error
      }
      if (!isExecutionCancellationError(terminalFailure)) throw terminalFailure
      expect(terminalFailure).toMatchObject({
        source: "dispatch_preparation",
        origin: {
          requestID: "cancel-before-dispatch",
          causationEventID: requested.id,
          taskID,
        },
      })
    },
  })
}, 0)

async function verifyDetachedDispatchLifecycle(input: {
  useWorktree: boolean
  retryRootFailure: boolean
  workerFailureUnderCancellation?: boolean
  closeRuntimeResourcesFailure?: boolean
  exhaustRootFailure?: boolean
  pipelineOwnerCleanupFailure?: boolean
  deliveryOwnerInitializationFailures?: number
  recoverAfterRuntimeRestart?: boolean
  recoverMissingInfrastructureWake?: boolean
}) {
  const project = await memoryProject()
  let worktreeDirectory = ""
  let projectID = ""
  let taskID = ""
  let workerSessionID = ""
  let dispatchStage = "setup"
  let projectedAgentID = ""
  let rootAttempts = 0
  const rootEvents: Array<OrchestratorEvent | undefined> = []
  const terminalSettlementSnapshots: Array<{
    reason?: string
    resources: ReturnType<typeof SessionPromptState.TestHooks.promptResourceSnapshot>
  }> = []
  const replacementAdmissionErrors: string[] = []
  let managedTool: ReturnType<typeof createDispatchAgentTool> | undefined
  let loopSpy: ReturnType<typeof spyOn> | undefined
  let mcpCloseSpy: ReturnType<typeof spyOn> | undefined
  const detachedRuns = new Set<Promise<unknown>>()
  let detachedOwnerSequence = 0
  const trackDetached = <T>(execution: Promise<T>): Promise<T> => {
    detachedRuns.add(execution)
    void execution.then(
      () => detachedRuns.delete(execution),
      () => detachedRuns.delete(execution),
    )
    return execution
  }
  const runDetached = <T>(run: () => Promise<T>): Promise<T> => {
    detachedOwnerSequence += 1
    const ownerSequence = detachedOwnerSequence
    if (ownerSequence >= 2 && ownerSequence < 2 + (input.deliveryOwnerInitializationFailures ?? 0)) {
      return trackDetached(Promise.reject(new Error(`injected delivery owner ${ownerSequence} initialization failure`)))
    }
    const initializedExecution = runWithInitializedIndependentProject({ directory: project.path, fn: run })
    const execution =
      input.pipelineOwnerCleanupFailure && ownerSequence === 2
        ? initializedExecution.then(() => {
            throw new Error("injected detached pipeline owner cleanup failure")
          })
        : initializedExecution
    return trackDetached(execution)
  }
  const runDetachedRecovery = <T>(run: () => Promise<T>): Promise<T> =>
    trackDetached(runWithIndependentProjectIdentity({ directory: project.path, fn: run }))
  const awaitDetachedRuns = async () => {
    await Promise.resolve()
    while (detachedRuns.size > 0) await Promise.allSettled([...detachedRuns])
    await waitForDetachedDispatchPipelinesForTest()
  }
  const taskRequest = "Complete one managed-worktree worker Turn"
  let releaseWorker!: () => void
  const workerReleased = new Promise<void>((resolve) => (releaseWorker = resolve))
  let resolveWorkerSettlement!: () => void
  let rejectWorkerSettlement!: (error: unknown) => void
  const workerSettlement = new Promise<void>((resolve, reject) => {
    resolveWorkerSettlement = resolve
    rejectWorkerSettlement = reject
  })
  const providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
  const appendEvent = ProtocolStore.appendEvent
  const appendEventSpy = spyOn(ProtocolStore, "appendEvent").mockImplementation(async (event) => {
    const isWorkerTerminal =
      event.type === "agent.execution.lifecycle" &&
      event.session_id === workerSessionID &&
      (event.payload?.status as { type?: string } | undefined)?.type === "terminal"
    if (isWorkerTerminal) {
      try {
        SessionPromptState.start(workerSessionID, input.useWorktree ? worktreeDirectory : project.path)
      } catch (error) {
        replacementAdmissionErrors.push(error instanceof Error ? error.name : String(error))
      }
    }
    const persisted = await appendEvent(event)
    if (isWorkerTerminal) {
      terminalSettlementSnapshots.push({
        reason: (event.payload?.status as { reason?: string }).reason,
        resources: SessionPromptState.TestHooks.promptResourceSnapshot(workerSessionID),
      })
    }
    return persisted
  })
  const processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
    const assistant = input.assistantMessage
    return {
      message: assistant,
      partFromToolCall() {
        return undefined
      },
      async process() {
        await workerReleased
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: assistant.sessionID,
          messageID: assistant.id,
          type: "text",
          text: "managed worktree dispatch complete",
        })
        assistant.finish = "stop"
        assistant.time.completed = Date.now()
        await Session.updateMessage(assistant)
        return "stop"
      },
    } as any
  })

  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        projectID = Instance.project.id
        const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
          prompt_profile: { active: "base" },
        })
        const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: Instance.project.worktree,
          config,
        })
        const skillProjection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: Instance.project.worktree,
          config,
          packageRevision,
        })
        const projectedAgent = skillProjection.projectedAgents.find(
          (candidate) => candidate.identity.agentID === "base-planner",
        )!
        projectedAgentID = projectedAgent.identity.agentID
        taskID = Identifier.ascending("task")
        const root = await Session.create({
          kind: "root",
          title: "Managed dispatch lifecycle root",
          metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          sessionID: root.id,
          now,
          title: "Managed dispatch lifecycle",
          request: taskRequest,
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const baseline = await EngineGit.prepare(requireTask(taskID))
        if (baseline.error) throw new Error(`managed lifecycle baseline failed: ${baseline.error}`)
        loopSpy = spyOn(OrchestratorLoop, "runTaskLoop").mockImplementation(async (loopInput) => {
          rootAttempts += 1
          rootEvents.push(loopInput.event)
          if (
            (input.exhaustRootFailure && (!input.recoverAfterRuntimeRestart || rootAttempts <= 2)) ||
            (input.retryRootFailure && rootAttempts === 1)
          ) {
            throw new Error("transient root lifecycle delivery failure")
          }
          if (!loopInput.wakeID || !loopInput.event) {
            throw new Error("managed lifecycle root delivery has no durable ingress identity")
          }
          const orchestrator = await taskOrchestratorSession(requireTask(taskID))
          const control = currentOrchestratorControlMessage(loopInput.event, taskID, loopInput.wakeID)
          if (!control) throw new Error(`managed lifecycle wake ${loopInput.wakeID} has no control occurrence`)
          const now = Date.now()
          await Session.persistMessage({
            info: {
              id: control.messageID,
              sessionID: orchestrator.id,
              role: "user",
              author: "orchestrator",
              time: { created: now },
              agent: "orchestrator",
              model,
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
                metadata: control.partMetadata,
              },
            ],
          })
          const finalMessageID = Identifier.ascending("message")
          const stepStartPartID = Identifier.ascending("part")
          const toolPartID = Identifier.ascending("part")
          const toolCallID = Identifier.ascending("call")
          const manageTaskInput = {
            action: "complete_task",
            summary: `Accepted exact ${control.partMetadata.source_kind} settlement ${loopInput.wakeID}`,
            evidence_locators: [],
            deliverable_artifact_locators: [],
            accepted_delivery_slice_revision_ids: [],
            workflow_id: null,
          }
          const assistant: Message.Assistant = {
            id: finalMessageID,
            sessionID: orchestrator.id,
            parentID: control.messageID,
            role: "assistant",
            author: "orchestrator",
            time: { created: now },
            agent: "orchestrator",
            providerID: model.providerID,
            modelID: model.modelID,
            path: { cwd: Instance.directory, root: Instance.project.worktree },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
            taskIngress: { id: loopInput.wakeID, kind: control.partMetadata.source_kind },
          }
          await Session.persistMessage({
            info: assistant,
            parts: [
              {
                id: stepStartPartID,
                sessionID: orchestrator.id,
                messageID: finalMessageID,
                type: "step-start",
              },
              {
                id: toolPartID,
                sessionID: orchestrator.id,
                messageID: finalMessageID,
                type: "tool",
                callID: toolCallID,
                tool: "manage_task",
                state: { status: "running", input: manageTaskInput, time: { start: now } },
              },
            ],
          })
          const manageTask = (
            createOrchestratorTools({
              taskID,
              agentSessionID: orchestrator.id,
              dispatchAgents: skillProjection.projectedAgents,
            }).tools as Record<string, { execute?: (args: unknown, options: unknown) => Promise<unknown> }>
          ).manage_task
          if (!manageTask?.execute) throw new Error("Managed lifecycle manage_task producer has no executor")
          const decision = await manageTask.execute(manageTaskInput, {
            toolCallId: toolCallID,
            opencorvus: {
              sessionID: orchestrator.id,
              messageID: finalMessageID,
              toolCallID,
              toolPartID,
              visibleToolName: "manage_task",
            },
          } as never)
          await Session.updatePart({
            id: toolPartID,
            sessionID: orchestrator.id,
            messageID: finalMessageID,
            type: "tool",
            callID: toolCallID,
            tool: "manage_task",
            state: {
              status: "completed",
              input: manageTaskInput,
              output: JSON.stringify(decision),
              title: "Task completed",
              metadata: {},
              time: { start: now, end: Date.now() },
            },
          })
          assistant.finish = "stop"
          assistant.time.completed = Date.now()
          await Session.updateMessage(assistant)
          await Database.awaitEffectIdle(30_000)
          return { finalMessageID }
        })
        const executors = Object.fromEntries(
          DispatchAdapterContractRegistry.ids.map((id) => [
            id,
            id === "delegated_worker"
              ? async (args: any, context: any) => {
                  try {
                    const outcome = await DelegatedWorkerAgent.run({
                      agentID: context.agentID,
                      packageRevision: context.projectedAgent.packageRevision,
                      instruction: args.instruction,
                      newSessionID: context.newSessionID,
                      sessionTitle: "Managed planner",
                      taskID,
                      workScope: context.workScope,
                      parentSessionID: root.id,
                      dispatchTurn: context.dispatch.turn,
                      model,
                      onDispatchAuthorityCommit(sessionID, descriptor) {
                        dispatchStage = "descriptor committed"
                        context.dispatch.commitSession(sessionID, descriptor)
                      },
                      onSessionCreated(sessionID) {
                        workerSessionID = sessionID
                      },
                    })
                    if (input.workerFailureUnderCancellation) {
                      throw new Error("injected worker abort under durable Task cancellation")
                    }
                    resolveWorkerSettlement()
                    if ("coordinationRequest" in outcome) {
                      throw new Error("Managed lifecycle fixture unexpectedly requested coordination")
                    }
                    return DispatchOutcome.terminal({
                      sessionID: outcome.sessionID,
                      finalMessageID: outcome.finalMessageID,
                    })
                  } catch (error) {
                    rejectWorkerSettlement(error)
                    throw error
                  }
                }
              : async () => {
                  throw new Error(`unexpected ${id} provider execution`)
                },
          ]),
        ) as Record<AgentDispatchAdapterID, DispatchAdapterExecutors[AgentDispatchAdapterID]>

        managedTool = createDispatchAgentTool({
          taskID,
          projectedAgents: skillProjection.projectedAgents,
          executors,
          runDetached,
          runDetachedRecovery,
          async runInWorktree({ taskID: ownerTaskID, sessionID, dispatchID, run }) {
            dispatchStage = "creating worktree"
            const workspace = await Worktree.create({
              name: `managed-lifecycle-${dispatchID.slice(-8)}`,
              taskID: ownerTaskID,
              sessionID,
            })
            worktreeDirectory = await fs.realpath(workspace.directory)
            dispatchStage = "running in worktree"
            return await Instance.provide({ directory: worktreeDirectory, fn: run })
          },
          openLineage({ workflowBinding, workflowNodeID, adapterInput, workScope, targetAgentID }) {
            dispatchStage = "opening lineage"
            const origin = createDispatchLineageOrigin({
              taskID,
              orchestratorSessionID: root.id,
              orchestratorMessageID: Identifier.ascending("message"),
              toolPartID: Identifier.ascending("part"),
              toolCallID: "call_managed_dispatch_lifecycle",
              targetAgentID,
              projectedWorkerIdentity: projectedAgent.identity,
              workScope,
              workflowBinding: workflowBinding!,
              workflowNodeID,
              adapterInput,
            })
            dispatchStage = "lineage prepared"
            return {
              dispatchID: origin.dispatchID,
              deliverySliceRevisionIDs: [],
              turn: {
                kind: "initial",
                current_dispatch_id: origin.dispatchID,
                workflow_binding: origin.workflowBinding,
                workflow_node_id: origin.workflowNodeID,
                workflow_occurrence_id: origin.workflowOccurrenceID,
                delivery_slice_revision_ids: [],
                evidence_locators: [],
                task_authority: {
                  task_id: taskID,
                  root_session_id: root.id,
                  request_sha256: taskRequestSHA256(taskRequest),
                  initial_control_text_parts: [],
                },
              },
              adapterInput,
              observeSession() {},
              commitSession(sessionID, descriptor: WorkerTurnDescriptor.Info) {
                dispatchStage = "recording lineage"
                expect(WorkerTurnDescriptor.get({ id: descriptor.id, sessionID })).toEqual(descriptor)
                const lineage = recordDispatchLineage({ origin, childSessionID: sessionID })
                return { artifactID: lineage.artifactID }
              },
            }
          },
        })
      },
    })

    dispatchStage = "calling tool"
    const receipt = await (managedTool!.execute as any)(
      {
        dispatch: {
          target: projectedAgentID,
          work_scope: { kind: "task" },
          use_worktree: input.useWorktree,
          turn: {
            kind: "initial",
            workflow_subject: { kind: "direct" },
            input: {
              goal_ids: [],
              instruction: taskRequest,
              reason: `exercise the real ${input.useWorktree ? "managed-worktree" : "current-project"} lifecycle path`,
            },
          },
        },
      },
      {},
    )
    expect(receipt).toMatchObject({ kind: "accepted", session_id: workerSessionID })
    if (input.workerFailureUnderCancellation) {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const requested = await EngineProtocol.emit(
            Event.TaskCancellationRequested,
            {
              taskID,
              actor: "user",
              surface: "overlay.work_ledger",
              reason: "Cancel the accepted detached worker",
              summary: "Cancellation requested while detached worker execution is accepted",
            },
            { source: "task.cancel", correlationID: "cancel-accepted-detached-worker" },
          )
          Database.use((db) =>
            db
              .insert(EngineTaskCancellationAuthorityTable)
              .values({ task_id: taskID, request_event_id: requested.id })
              .run(),
          )
        },
      })
    }
    if (input.closeRuntimeResourcesFailure) {
      const mcp = SessionRuntimeContractStore.get(workerSessionID)?.resources?.mcp
      if (!mcp) throw new Error(`Worker Session ${workerSessionID} has no MCP runtime resource`)
      mcpCloseSpy = spyOn(mcp, "close").mockRejectedValueOnce(new Error("injected worker MCP close failure"))
    }
    releaseWorker()
    if (input.workerFailureUnderCancellation) {
      let workerFailure: unknown
      try {
        await workerSettlement
      } catch (error) {
        workerFailure = error
      }
      expect(workerFailure).toMatchObject({ message: "injected worker abort under durable Task cancellation" })
      await awaitDetachedRuns()
      const gate = acquireDetachedDispatchSettlementGate()
      try {
        await expect(gate.waitForIdle()).resolves.toBeUndefined()
      } finally {
        gate[Symbol.dispose]()
      }
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const artifacts = Database.use((db) =>
            db
              .select({ kind: EngineArtifactTable.kind, label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.task_id, taskID))
              .all(),
          )
          expect(artifacts.filter((artifact) => artifact.kind === "task-infrastructure-error")).toHaveLength(1)
          expect(
            artifacts.filter(
              (artifact) => artifact.kind === "task_root_ingress" && artifact.label === "terminal_inapplicable",
            ),
          ).toHaveLength(1)
        },
      })
      return
    }
    if (input.closeRuntimeResourcesFailure) {
      let settlementError: unknown
      try {
        await workerSettlement
      } catch (error) {
        settlementError = error
      }
      await awaitDetachedRuns()
      await waitForIngressDeliveryHooksForTest()
      expect(settlementError).toBeInstanceOf(WorkerTurnSettlementError)
      const typedError = settlementError as WorkerTurnSettlementError
      expect(settlementError).toMatchObject({
        operation: "close-runtime-resources",
        causeErrorName: "Error",
        causeMessage: "injected worker MCP close failure",
        infrastructureArtifactID: typedError.infrastructureArtifactID,
        evidence: {
          descriptorID: typedError.evidence!.descriptorID,
          descriptorHash: typedError.evidence!.descriptorHash,
          inputMessageID: typedError.evidence!.inputMessageID,
        },
      })
      expect(typeof typedError.infrastructureArtifactID).toBe("string")
      const exactInfrastructureEvent = expect.objectContaining({
        dispatchInfrastructureFailure: {
          infrastructureFactID: typedError.infrastructureArtifactID,
          outcome: expect.objectContaining({
            kind: "infrastructure_failure",
            operation: "close-runtime-resources",
            session_id: workerSessionID,
            infrastructure_error: expect.objectContaining({ artifact_id: typedError.infrastructureArtifactID }),
            worker_turn: expect.objectContaining({
              descriptor_id: typedError.evidence!.descriptorID,
              descriptor_hash: typedError.evidence!.descriptorHash,
              input_message_id: typedError.evidence!.inputMessageID,
            }),
            recovery_authority: expect.objectContaining({ occurrence_status: "occurrence_committed" }),
          }),
        },
      })
      const expectedInfrastructureAttempts = input.retryRootFailure || input.exhaustRootFailure ? 2 : 1
      expect(rootEvents).toEqual(Array.from({ length: expectedInfrastructureAttempts }, () => exactInfrastructureEvent))
      expect(rootAttempts).toBe(expectedInfrastructureAttempts)
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const descriptor = WorkerTurnDescriptor.latestForSession(workerSessionID)!
          expect(
            ProtocolStore.latestSessionOccurrenceEvent(
              workerSessionID,
              "agent.execution.lifecycle",
              descriptor.payload.messageAuthority.user_message_id,
            ),
          ).toMatchObject({ payload: { status: { type: "idle" } } })
          expect(
            Database.use((db) =>
              db
                .select({
                  id: EngineArtifactTable.id,
                  kind: EngineArtifactTable.kind,
                  label: EngineArtifactTable.label,
                  payload: EngineArtifactTable.payload,
                })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.task_id, taskID))
                .all(),
            ).filter(
              (artifact) => artifact.kind === "task-infrastructure-error" && artifact.label === "worker-runtime",
            ),
          ).toEqual([
            {
              id: typedError.infrastructureArtifactID,
              kind: "task-infrastructure-error",
              label: "worker-runtime",
              payload: expect.objectContaining({
                component: "worker-runtime",
                operation: "close-runtime-resources",
                sessionID: workerSessionID,
              }),
            },
          ])
          expect(
            Database.use((db) =>
              db
                .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_root_ingress")))
                .all(),
            )
              .map((wake) => ({ ...wake, ingress: TaskRootIngressSchema.parse(wake.payload) }))
              .filter((wake) => wake.ingress.source_kind === "dispatch_infrastructure_failure"),
          ).toEqual([
            expect.objectContaining({
              label: input.exhaustRootFailure ? "delivery_failed" : "delivered",
              ingress: expect.objectContaining({
                infrastructure_fact_id: typedError.infrastructureArtifactID,
                delivery_attempt: expectedInfrastructureAttempts,
                event: expect.objectContaining({
                  dispatchInfrastructureFailure: expect.objectContaining({
                    infrastructureFactID: typedError.infrastructureArtifactID,
                  }),
                }),
              }),
            }),
          ])
          if (input.exhaustRootFailure) {
            expect(await dispatchTaskLoop({ taskID, event: rootEvents[0] })).toBe("ignored")
            expect(rootAttempts).toBe(2)
            if (input.recoverAfterRuntimeRestart) {
              using _successorRuntime = IngressTestHooks.replaceTerminalIngressDeliveryRuntime("successor-runtime")
              expect(await reconcileFailedExactTerminalIngressDeliveries()).toBe(1)
              await waitForIngressDeliveryHooksForTest()
              const recovered = Database.use((db) =>
                db
                  .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
                  .from(EngineArtifactTable)
                  .where(
                    and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_root_ingress")),
                  )
                  .all(),
              )
                .map((wake) => ({ ...wake, ingress: TaskRootIngressSchema.parse(wake.payload) }))
                .find((wake) => wake.ingress.infrastructure_fact_id === typedError.infrastructureArtifactID)!
              expect({
                label: recovered.label,
                ingress: recovered.ingress,
              }).toMatchObject({
                label: "delivered",
                ingress: {
                  delivery_attempt: 3,
                  delivery_runtime_id: "successor-runtime",
                  delivery_runtime_attempt: 1,
                  delivery_result: { status: "completed" },
                },
              })
              expect(rootAttempts).toBe(3)
              return
            }
            Database.use((db) =>
              db
                .update(EngineTaskTable)
                .set({ time_completed: Date.now() })
                .where(eq(EngineTaskTable.id, taskID))
                .run(),
            )
            expect(await dispatchTaskLoop({ taskID, event: rootEvents[0] })).toBe("ignored")
            expect(rootAttempts).toBe(2)
          }
          if (input.recoverMissingInfrastructureWake) {
            Database.use((db) =>
              db
                .delete(EngineArtifactTable)
                .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_root_ingress")))
                .run(),
            )
            expect(await reconcileUndeliveredDispatchInfrastructureFacts()).toBe(1)
            await waitForIngressDeliveryHooksForTest()
            const recoveredWake = Database.use((db) =>
              db
                .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_root_ingress")))
                .get(),
            )!
            expect({
              label: recoveredWake.label,
              ingress: TaskRootIngressSchema.parse(recoveredWake.payload),
            }).toMatchObject({
              label: "delivered",
              ingress: { infrastructure_fact_id: typedError.infrastructureArtifactID },
            })
          }
        },
      })
      await ProjectGitLock.waitForIdle()
      return
    }
    await workerSettlement
    await awaitDetachedRuns()
    await waitForIngressDeliveryHooksForTest()
    expect(
      terminalSettlementSnapshots.map(({ reason, resources }) => ({
        reason,
        promptOwners: resources.promptOwners,
        cancellationReceipts: resources.cancellationReceipts,
      })),
    ).toEqual([
      {
        reason: "completed",
        promptOwners: 0,
        cancellationReceipts: 0,
      },
    ])
    expect(replacementAdmissionErrors).toEqual(["BusyError"])

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        expect(await Session.get(workerSessionID)).toMatchObject({
          directory: input.useWorktree ? worktreeDirectory : await fs.realpath(project.path),
        })
        const deadline = Date.now() + 5_000
        let lifecycleWake:
          | { id: string; label: string; ingress: ReturnType<typeof TaskRootIngressSchema.parse> }
          | undefined
        while (Date.now() < deadline) {
          lifecycleWake = Database.use((db) =>
            db
              .select({
                id: EngineArtifactTable.id,
                label: EngineArtifactTable.label,
                payload: EngineArtifactTable.payload,
              })
              .from(EngineArtifactTable)
              .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_root_ingress")))
              .all(),
          )
            .map((row) => ({ ...row, ingress: TaskRootIngressSchema.parse(row.payload) }))
            .find((row) => row.ingress.event.agentLifecycleDelivery?.sessionID === workerSessionID)
          const expectedLabel = input.exhaustRootFailure ? "delivery_failed" : "delivered"
          if (lifecycleWake?.label === expectedLabel) break
          await Bun.sleep(20)
        }
        const descriptor = WorkerTurnDescriptor.latestForSession(workerSessionID)!
        const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
          workerSessionID,
          "agent.execution.lifecycle",
          descriptor.payload.messageAuthority.user_message_id,
        )!
        expect(lifecycleWake).toMatchObject({
          label: input.exhaustRootFailure ? "delivery_failed" : "delivered",
          ingress: {
            delivery_attempt: input.retryRootFailure || input.exhaustRootFailure ? 2 : 1,
            lifecycle_event_id: lifecycle.id,
            event: {
              agentLifecycleDelivery: {
                eventID: lifecycle.id,
                sessionID: workerSessionID,
                dispatchID: descriptor.payload.dispatchTurn!.current_dispatch_id,
              },
            },
          },
        })
        expect(rootAttempts).toBe(input.retryRootFailure || input.exhaustRootFailure ? 2 : 1)
        if (input.exhaustRootFailure) {
          expect(
            await reconcileTerminalAgentLifecycleDelivery({
              taskID,
              sessionID: workerSessionID,
              dispatchID: descriptor.payload.dispatchTurn!.current_dispatch_id,
            }),
          ).toBe("delivery_exhausted")
          expect(await reconcileTerminalAgentLifecycleDeliveries()).toBe(0)
          expect(
            await dispatchTaskLoop({
              taskID,
              event: {
                agentLifecycleDelivery: {
                  eventID: lifecycle.id,
                  sessionID: workerSessionID,
                  dispatchID: descriptor.payload.dispatchTurn!.current_dispatch_id,
                },
              },
            }),
          ).toBe("ignored")
          expect(rootAttempts).toBe(2)
          if (input.recoverAfterRuntimeRestart) {
            using _successorRuntime =
              IngressTestHooks.replaceTerminalIngressDeliveryRuntime("successor-lifecycle-runtime")
            expect(await reconcileFailedExactTerminalIngressDeliveries()).toBe(1)
            await waitForIngressDeliveryHooksForTest()
            const recovered = Database.use((db) =>
              db
                .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.id, lifecycleWake!.id))
                .get(),
            )!
            expect({ label: recovered.label, ingress: TaskRootIngressSchema.parse(recovered.payload) }).toMatchObject({
              label: "delivered",
              ingress: {
                delivery_attempt: 3,
                delivery_runtime_id: "successor-lifecycle-runtime",
                delivery_runtime_attempt: 1,
                delivery_result: { status: "completed" },
              },
            })
            expect(rootAttempts).toBe(3)
            return
          }
          Database.use((db) =>
            db.update(EngineTaskTable).set({ time_completed: Date.now() }).where(eq(EngineTaskTable.id, taskID)).run(),
          )
          expect(
            await dispatchTaskLoop({
              taskID,
              event: {
                agentLifecycleDelivery: {
                  eventID: lifecycle.id,
                  sessionID: workerSessionID,
                  dispatchID: descriptor.payload.dispatchTurn!.current_dispatch_id,
                },
              },
            }),
          ).toBe("ignored")
          expect(rootAttempts).toBe(2)
        } else {
          expect(
            await reconcileTerminalAgentLifecycleDelivery({
              taskID,
              sessionID: workerSessionID,
              dispatchID: descriptor.payload.dispatchTurn!.current_dispatch_id,
            }),
          ).toBe("already_delivered")
        }
        if (input.pipelineOwnerCleanupFailure) {
          const cleanupWake = Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_root_ingress")))
              .all(),
          )
            .map((wake) => ({ ...wake, ingress: TaskRootIngressSchema.parse(wake.payload) }))
            .find(
              (wake) =>
                wake.ingress.event.dispatchInfrastructureFailure?.outcome.operation ===
                "settle-detached-pipeline-owner",
            )!
          expect({ label: cleanupWake.label, ingress: cleanupWake.ingress }).toMatchObject({
            label: "delivered",
            ingress: {
              delivery_result: {
                status: "terminal_inapplicable",
                reason: "dispatch_infrastructure_failure carries no terminal conversation authority",
              },
              event: {
                dispatchInfrastructureFailure: {
                  infrastructureFactID: expect.any(String),
                  outcome: {
                    kind: "infrastructure_failure",
                    operation: "settle-detached-pipeline-owner",
                    session_id: workerSessionID,
                    error_name: "Error",
                    message: "injected detached pipeline owner cleanup failure",
                    recovery_authority: expect.objectContaining({ occurrence_status: "occurrence_committed" }),
                    infrastructure_error: expect.objectContaining({ artifact_id: expect.any(String) }),
                  },
                },
              },
            },
          })
          expect(
            Database.use((db) =>
              db
                .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(
                  and(
                    eq(EngineArtifactTable.task_id, taskID),
                    eq(EngineArtifactTable.kind, "task-infrastructure-error"),
                    eq(EngineArtifactTable.label, "dispatch-agent"),
                  ),
                )
                .all(),
            ).filter(
              (artifact) => (artifact.payload as { operation?: string }).operation === "settle-detached-pipeline-owner",
            ),
          ).toEqual([
            expect.objectContaining({
              payload: expect.objectContaining({
                operation: "settle-detached-pipeline-owner",
                sessionID: workerSessionID,
              }),
            }),
          ])
        }
      },
    })
    await awaitDetachedRuns()
    await waitForIngressDeliveryHooksForTest()
    await ProjectGitLock.waitForIdle()
  } finally {
    releaseWorker()
    await awaitDetachedRuns()
    await waitForIngressDeliveryHooksForTest()
    {
      using runtimeGate = RuntimeExecutionSettlement.acquireSettlementGate()
      runtimeGate.closeAdmission(["protocol_publication", "task_root_ingress_delivery"])
      await runtimeGate.waitForIdle(["protocol_publication"])
      await runtimeGate.waitForIdle(["task_root_ingress_delivery"])
      runtimeGate.commit()
    }
    await ProjectGitLock.waitForIdle()
    processorSpy.mockRestore()
    providerSpy.mockRestore()
    mcpCloseSpy?.mockRestore()
    appendEventSpy.mockRestore()
    loopSpy?.mockRestore()
    if (worktreeDirectory) {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await Worktree.releaseManagedWorktreeSessionOwner({
            projectID,
            primaryWorktreeDir: Instance.project.worktree,
            directory: worktreeDirectory,
            sessionID: workerSessionID,
          })
          await Worktree.remove({ directory: worktreeDirectory })
        },
      })
    }
    await Database.awaitEffectIdle(60_000)
    await Bus.TestHooks.disposeOwnedState()
    await project[Symbol.asyncDispose]()
    using effectGate = await Database.acquireEffectSettlementGate(60_000)
  }
}

test(
  "delivers one terminal lifecycle wake from a real current-project dispatch",
  () => verifyDetachedDispatchLifecycle({ useWorktree: false, retryRootFailure: false }),
  60_000,
)

test(
  "delivers one terminal lifecycle wake from a real managed-worktree dispatch",
  () => verifyDetachedDispatchLifecycle({ useWorktree: true, retryRootFailure: false }),
  60_000,
)

test(
  "automatically retries the same real lifecycle wake after its first root delivery fails",
  () => verifyDetachedDispatchLifecycle({ useWorktree: false, retryRootFailure: true }),
  60_000,
)

test(
  "returns typed settlement evidence when worker runtime resources fail to close",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      closeRuntimeResourcesFailure: true,
    }),
  60_000,
)

test(
  "preserves typed settlement evidence through two delivery-owner initialization failures",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      closeRuntimeResourcesFailure: true,
      deliveryOwnerInitializationFailures: 2,
    }),
  60_000,
)

test(
  "retries the same typed settlement ingress after its first root delivery fails",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: true,
      closeRuntimeResourcesFailure: true,
    }),
  60_000,
)

test(
  "keeps an exhausted typed settlement ingress at delivery attempt two",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      closeRuntimeResourcesFailure: true,
      exhaustRootFailure: true,
    }),
  60_000,
)

test(
  "revives the exact exhausted typed ingress once in a successor runtime",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      closeRuntimeResourcesFailure: true,
      exhaustRootFailure: true,
      recoverAfterRuntimeRestart: true,
    }),
  60_000,
)

test(
  "reconstructs a missing typed ingress from its accepted dispatch infrastructure fact",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      closeRuntimeResourcesFailure: true,
      recoverMissingInfrastructureWake: true,
    }),
  60_000,
)

test("startup reconstructs and delivers an accepted infrastructure fact for a terminal Task", async () => {
  await using project = await memoryProject()
  const recovery = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
        prompt_profile: { active: "base" },
      })
      const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
        projectDirectory: Instance.project.worktree,
        config,
      })
      const skillProjection = await PromptProfileResolver.resolveSkillProjection({
        projectDirectory: Instance.project.worktree,
        config,
        packageRevision,
      })
      const projectedAgent = skillProjection.projectedAgents.find(
        (candidate) => candidate.identity.agentID === "base-planner",
      )!
      const taskID = Identifier.ascending("task")
      const root = await Session.create({
        kind: "root",
        title: "Terminal infrastructure startup recovery",
        metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })
      const now = Date.now()
      persistTask({
        taskID,
        sessionID: root.id,
        now,
        title: "Terminal infrastructure startup recovery",
        request: "Deliver the exact durable infrastructure fact after startup",
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
      const dispatchID = Identifier.ascending("artifact")
      const lineage = recordDispatchLineage({
        origin: createDispatchLineageOrigin({
          dispatchID,
          taskID,
          orchestratorSessionID: root.id,
          orchestratorMessageID: Identifier.ascending("message"),
          toolPartID: Identifier.ascending("part"),
          toolCallID: "call_terminal_infrastructure_startup_recovery",
          targetAgentID: projectedAgent.identity.agentID,
          projectedWorkerIdentity: projectedAgent.identity,
          workScope: { kind: "task" },
          workflowBinding: {
            kind: "direct",
            package_revision: expertSquadPackageRevisionBinding(packageRevision),
          },
          workflowNodeID: null,
          adapterInput: { instruction: "Inspect the Task" },
        }),
        childSessionID: Identifier.ascending("session"),
      })
      const infrastructureFactID = recordTaskInfrastructureError({
        taskID,
        component: "worker-runtime",
        operation: "close-runtime-resources",
        reason: "The accepted dispatch completed physically but runtime cleanup failed",
        errorName: "RuntimeCleanupError",
        context: { current_dispatch_id: dispatchID },
      })
      await terminalTask(
        requireTask(taskID),
        { status: "failed", error: "Injected terminal state after the accepted infrastructure fact was committed" },
        "Terminalized after the accepted dispatch infrastructure fact",
      )
      expect(await reconcileUndeliveredDispatchInfrastructureFacts()).toBe(1)
      return { taskID, infrastructureFactID, dispatchID, lineageArtifactID: lineage.artifactID }
    },
  })
  // The recovered delivery owns a fresh initialized project lease. Release
  // the setup lease before joining its physical queue completion.
  await waitForIngressDeliveryHooksForTest()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const exactWake = Database.use((db) =>
        db
          .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
          .from(EngineArtifactTable)
          .where(
            and(eq(EngineArtifactTable.task_id, recovery.taskID), eq(EngineArtifactTable.kind, "task_root_ingress")),
          )
          .all(),
      )
        .map((wake) => ({ ...wake, ingress: TaskRootIngressSchema.parse(wake.payload) }))
        .find((wake) => wake.ingress.infrastructure_fact_id === recovery.infrastructureFactID)!
      expect({ label: exactWake.label, ingress: exactWake.ingress }).toMatchObject({
        label: "delivered",
        ingress: {
          source_kind: "dispatch_infrastructure_failure",
          infrastructure_fact_id: recovery.infrastructureFactID,
          delivery_result: {
            status: "terminal_inapplicable",
            reason: "dispatch_infrastructure_failure carries no terminal conversation authority",
          },
          event: {
            dispatchInfrastructureFailure: {
              infrastructureFactID: recovery.infrastructureFactID,
              outcome: {
                recovery_authority: {
                  occurrence_status: "occurrence_committed",
                  dispatch_lineage_id: recovery.lineageArtifactID,
                  dispatch_id: recovery.dispatchID,
                },
              },
            },
          },
        },
      })
    },
  })
}, 60_000)

test(
  "keeps an exhausted terminal lifecycle ingress at delivery attempt two",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      exhaustRootFailure: true,
    }),
  60_000,
)

test(
  "revives an exact exhausted lifecycle ingress in a successor runtime startup scan",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      exhaustRootFailure: true,
      recoverAfterRuntimeRestart: true,
    }),
  60_000,
)

test(
  "settles detached pipeline owner cleanup through its typed terminal-inapplicable result",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      pipelineOwnerCleanupFailure: true,
    }),
  60_000,
)

test(
  "settles a cancelled accepted detached worker through its terminal-inapplicable ingress",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      workerFailureUnderCancellation: true,
    }),
  60_000,
)

test("holds runtime settlement until an accepted detached delivery pipeline is durable", async () => {
  const settlementEvents: string[] = []
  let finishExecution!: () => void
  const executionReady = new Promise<void>((resolve) => (finishExecution = resolve))
  let finishDelivery!: () => void
  const deliveryReady = new Promise<void>((resolve) => (finishDelivery = resolve))
  const receipt = await detachDispatchExecution({
    execute: async () => {
      await executionReady
      settlementEvents.push("execution_completed")
      return DispatchOutcome.terminal({ sessionID: "session-detached-barrier", finalMessageID: "message-terminal" })
    },
    runDetached: async (run) => await run(),
    runDetachedRecovery: async (run) => await run(),
    committedLineage: Promise.resolve({
      sessionID: "session-detached-barrier",
      artifactID: "lineage-detached-barrier",
    }),
    deliver: async () => {
      await deliveryReady
      settlementEvents.push("delivery_completed")
    },
    onDeliveryFailure: async () => undefined,
    onPipelineOwnerCleanupFailure: async () => undefined,
  })
  expect(receipt).toMatchObject({ kind: "accepted", session_id: "session-detached-barrier" })
  const gate = acquireDetachedDispatchSettlementGate()
  const settlement = gate.waitForIdle().then(() => {
    settlementEvents.push("gate_settled")
  })
  finishExecution()
  finishDelivery()
  await settlement
  expect(settlementEvents).toEqual(["execution_completed", "delivery_completed", "gate_settled"])
  gate[Symbol.dispose]()
})

test("bounds Server settlement on a held detached pipeline and succeeds with the same owner after late settlement", async () => {
  let finishExecution!: () => void
  const executionReady = new Promise<void>((resolve) => (finishExecution = resolve))
  const receipt = await detachDispatchExecution({
    execute: async () => {
      await executionReady
      return DispatchOutcome.terminal({ sessionID: "session-detached-timeout", finalMessageID: "message-terminal" })
    },
    runDetached: async (run) => await run(),
    runDetachedRecovery: async (run) => await run(),
    committedLineage: Promise.resolve({
      sessionID: "session-detached-timeout",
      artifactID: "lineage-detached-timeout",
    }),
    deliver: async () => undefined,
    onDeliveryFailure: async () => undefined,
    onPipelineOwnerCleanupFailure: async () => undefined,
  })
  expect(receipt).toMatchObject({ kind: "accepted", dispatch_lineage_id: "lineage-detached-timeout" })
  using _timeout = Server.TestHooks.installRuntimeSettlementInactivityTimeout(50)
  await expect(
    Server.settleCurrentProcessExecution("held detached pipeline", { disposeInstances: async () => undefined }),
  ).rejects.toBeInstanceOf(RuntimeExecutionSettlementInactivityError)

  finishExecution()
  await waitForDetachedDispatchPipelinesForTest()
  const settled = await Server.settleCurrentProcessExecution("late detached pipeline settlement", {
    disposeInstances: async () => undefined,
  })
  await settled.releaseHandoff(false)
})

test("replaces one exact failed detached pipeline authority after its durable recovery settles", async () => {
  const dispatchLineageID = "lineage-detached-recovery"
  let finishFailedExecution!: () => void
  const failedExecutionReady = new Promise<void>((resolve) => (finishFailedExecution = resolve))
  const failedReceipt = await detachDispatchExecution({
    execute: async () => {
      await failedExecutionReady
      return DispatchOutcome.terminal({ sessionID: "session-detached-recovery", finalMessageID: "message-failed" })
    },
    runDetached: async (run) => await run(),
    runDetachedRecovery: async (run) => await run(),
    committedLineage: Promise.resolve({ sessionID: "session-detached-recovery", artifactID: dispatchLineageID }),
    deliver: async () => {
      throw new Error("injected detached delivery failure")
    },
    onDeliveryFailure: async () => {
      throw new Error("injected durable recovery failure")
    },
    onPipelineOwnerCleanupFailure: async () => undefined,
  })
  expect(failedReceipt).toMatchObject({ kind: "accepted", dispatch_lineage_id: dispatchLineageID })
  finishFailedExecution()

  const failedGate = acquireDetachedDispatchSettlementGate()
  try {
    await expect(failedGate.waitForIdle()).rejects.toMatchObject({
      name: "AggregateError",
      errors: [expect.objectContaining({ message: expect.stringContaining(dispatchLineageID) })],
    })
  } finally {
    failedGate[Symbol.dispose]()
  }

  let finishRecoveredExecution!: () => void
  const recoveredExecutionReady = new Promise<void>((resolve) => (finishRecoveredExecution = resolve))
  const recoveryEvents: string[] = []
  const recoveredReceipt = await detachDispatchExecution({
    execute: async () => {
      await recoveredExecutionReady
      recoveryEvents.push("execution_recovered")
      return DispatchOutcome.terminal({ sessionID: "session-detached-recovery", finalMessageID: "message-recovered" })
    },
    runDetached: async (run) => await run(),
    runDetachedRecovery: async (run) => await run(),
    committedLineage: Promise.resolve({ sessionID: "session-detached-recovery", artifactID: dispatchLineageID }),
    deliver: async () => {
      recoveryEvents.push("delivery_recovered")
    },
    onDeliveryFailure: async () => undefined,
    onPipelineOwnerCleanupFailure: async () => undefined,
  })
  expect(recoveredReceipt).toMatchObject({ kind: "accepted", dispatch_lineage_id: dispatchLineageID })
  const recoveredGate = acquireDetachedDispatchSettlementGate()
  try {
    const settled = recoveredGate.waitForIdle().then(() => recoveryEvents.push("gate_settled"))
    finishRecoveredExecution()
    await settled
    expect(recoveryEvents).toEqual(["execution_recovered", "delivery_recovered", "gate_settled"])
  } finally {
    recoveredGate[Symbol.dispose]()
  }
})
