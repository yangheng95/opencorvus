import fs from "node:fs/promises"
import { afterEach, expect, spyOn, test } from "bun:test"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "@/agent/dispatch-adapter-contract"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { WorkerTurnSettlementError } from "@/agent/runner"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { DelegatedWorkerAgent } from "@/delegated-worker/agent"
import { createDispatchLineageOrigin, recordDispatchLineage } from "@/engine/dispatch-lineage"
import { EngineArtifactTable, EngineTaskTable } from "@/engine/engine.sql"
import { persistQueuedTask } from "@/engine/pipeline"
import { QueuedTaskIngressSchema } from "@/engine/queued-task-ingress"
import {
  dispatchTaskLoop,
  reconcileTerminalAgentLifecycleDelivery,
  reconcileTerminalAgentLifecycleDeliveries,
  waitForQueueCompletionHooksForTest,
} from "@/engine/queue"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import {
  createDispatchAgentTool,
  waitForDetachedDispatchPipelinesForTest,
  type DispatchAdapterExecutors,
} from "@/orchestrator/dispatch-agent-tool"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"
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
import { Session } from "@/session"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionProcessor } from "@/session/processor"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { Database, and, eq } from "@/storage/db"
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

async function verifyDetachedDispatchLifecycle(input: {
  useWorktree: boolean
  retryRootFailure: boolean
  closeRuntimeResourcesFailure?: boolean
  exhaustRootFailure?: boolean
  pipelineOwnerCleanupFailure?: boolean
  deliveryOwnerInitializationFailures?: number
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
  const clearRuntimeContract = SessionRuntimeContractStore.clear
  const clearRuntimeContractSpy = spyOn(SessionRuntimeContractStore, "clear").mockImplementation((sessionID) => {
    const resources = clearRuntimeContract(sessionID)
    if (!input.closeRuntimeResourcesFailure || sessionID !== workerSessionID || !resources?.mcp) return resources
    const ownedMcp = resources.mcp
    return {
      mcp: {
        id: ownedMcp.id,
        async close() {
          await ownedMcp.close()
          throw new Error("injected worker MCP close failure")
        },
      },
    }
  })
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
        persistQueuedTask({
          taskID,
          sessionID: root.id,
          now,
          title: "Managed dispatch lifecycle",
          request: taskRequest,
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID,
          queue: true,
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
        loopSpy = spyOn(OrchestratorLoop, "runTaskLoop").mockImplementation(async (loopInput) => {
          rootAttempts += 1
          rootEvents.push(loopInput.event)
          if (input.exhaustRootFailure || (input.retryRootFailure && rootAttempts === 1)) {
            throw new Error("transient root lifecycle delivery failure")
          }
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
                    resolveWorkerSettlement()
                    return outcome
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
    const receipt = await Promise.race([
      (managedTool!.execute as any)(
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
      ),
      new Promise<never>((_resolve, reject) => {
        setTimeout(
          () => reject(new Error(`managed dispatch did not commit within ten seconds; stage=${dispatchStage}`)),
          10_000,
        )
      }),
    ])
    expect(receipt).toMatchObject({ kind: "accepted", session_id: workerSessionID })
    releaseWorker()
    if (input.closeRuntimeResourcesFailure) {
      let settlementError: unknown
      try {
        await workerSettlement
      } catch (error) {
        settlementError = error
      }
      await awaitDetachedRuns()
      await waitForQueueCompletionHooksForTest()
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
      expect(rootEvents).toEqual(
        Array.from(
          { length: input.retryRootFailure || input.exhaustRootFailure ? 2 : 1 },
          () => exactInfrastructureEvent,
        ),
      )
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
          ).toMatchObject({ payload: { status: { type: "streaming" } } })
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
                .where(
                  and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")),
                )
                .all(),
            )
              .map((wake) => ({ ...wake, ingress: QueuedTaskIngressSchema.parse(wake.payload) }))
              .filter((wake) => wake.ingress.source_kind === "dispatch_infrastructure_failure"),
          ).toEqual([
            expect.objectContaining({
              label: input.exhaustRootFailure ? "delivery_failed" : "drained",
              ingress: expect.objectContaining({
                infrastructure_fact_id: typedError.infrastructureArtifactID,
                delivery_attempt: input.retryRootFailure || input.exhaustRootFailure ? 2 : 1,
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
        },
      })
      await ProjectGitLock.waitForIdle()
      return
    }
    await workerSettlement
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
          | { id: string; label: string; ingress: ReturnType<typeof QueuedTaskIngressSchema.parse> }
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
              .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
              .all(),
          )
            .map((row) => ({ ...row, ingress: QueuedTaskIngressSchema.parse(row.payload) }))
            .find((row) => row.ingress.event.agentLifecycleDelivery?.sessionID === workerSessionID)
          const expectedLabel = input.exhaustRootFailure ? "delivery_failed" : "drained"
          const expectedAttempt = input.retryRootFailure || input.exhaustRootFailure ? 2 : 1
          if (lifecycleWake?.label === expectedLabel && lifecycleWake.ingress.delivery_attempt === expectedAttempt)
            break
          await Bun.sleep(20)
        }
        const descriptor = WorkerTurnDescriptor.latestForSession(workerSessionID)!
        const lifecycle = ProtocolStore.latestSessionOccurrenceEvent(
          workerSessionID,
          "agent.execution.lifecycle",
          descriptor.payload.messageAuthority.user_message_id,
        )!
        expect(lifecycleWake).toMatchObject({
          label: input.exhaustRootFailure ? "delivery_failed" : "drained",
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
        expect(rootAttempts).toBe(
          input.pipelineOwnerCleanupFailure ? 2 : input.retryRootFailure || input.exhaustRootFailure ? 2 : 1,
        )
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
          const cleanupEvent = rootEvents.find(
            (event) => event?.dispatchInfrastructureFailure,
          )?.dispatchInfrastructureFailure
          expect(cleanupEvent).toMatchObject({
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
    await waitForQueueCompletionHooksForTest()
    await ProjectGitLock.waitForIdle()
  } finally {
    releaseWorker()
    await awaitDetachedRuns()
    await waitForQueueCompletionHooksForTest()
    await ProjectGitLock.waitForIdle()
    processorSpy.mockRestore()
    providerSpy.mockRestore()
    clearRuntimeContractSpy.mockRestore()
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
    await project[Symbol.asyncDispose]()
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
  "delivers detached pipeline owner cleanup failure through its own typed ingress",
  () =>
    verifyDetachedDispatchLifecycle({
      useWorktree: false,
      retryRootFailure: false,
      pipelineOwnerCleanupFailure: true,
    }),
  60_000,
)
