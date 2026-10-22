import { afterEach, describe, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { createDispatchLineageOrigin, resolveDispatchOccurrenceAuthority } from "@/engine/dispatch-lineage"
import { settleDispatchOrReturnExisting } from "@/engine/dispatch-settlement"
import { EngineTaskRootIngressTable } from "@/engine/engine.sql"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { TestHooks as Control } from "@/engine/task-root-ingress-delivery"
import { appendTaskReopenedInTransaction } from "@/engine/task-lifecycle"
import { readTaskWorkerTerminalOccurrence } from "@/engine/task-worker-terminal-facts"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { persistEstablishedTask } from "./fixture/engine-task"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { recordTestAcceptedWorkerTurn } from "./fixture/settled-worker-report"
import { childProcessIdentity } from "./fixture/process-liveness"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"

afterEach(resetMemoryDatabase)

async function establishWorker() {
  const config = Config.Info.parse({
    prompt_profile: { active: "base" },
    mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
  })
  const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
    projectDirectory: Instance.directory,
    config,
  })
  const capability = await PromptProfileResolver.resolveWorkerCapability({
    projectDirectory: Instance.directory,
    config,
    packageRevision: scheduler.packageRevision,
    agentID: "base-developer",
  })
  const taskID = Identifier.ascending("task"),
    now = Date.now()
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Settled lifecycle",
    metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
  })
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: "Settled lifecycle",
    request: "Exact old and new worker occurrences",
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: { actor: "user" },
    projectID: Instance.project.id,
    packageRevision: scheduler.packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: scheduler.packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  const worker = await Session.create({
    kind: capability.identity.sessionKind,
    parentID: root.id,
    title: "Reusable worker",
  })
  const workflowBinding = selectedWorkflowBinding({
    projection: { packageRevision: scheduler.packageRevision, virtualWorkflows: scheduler.virtualWorkflows },
    workflowID: null,
  })
  const turn = async (accepted = true, deliveryOwnerID?: string) => {
    const dispatchID = Identifier.ascending("artifact")
    const lineage = (() => {
      using owner = deliveryOwnerID ? Control.replaceTerminalIngressDeliveryRuntime(deliveryOwnerID) : undefined
      return recordTestDispatchLineage({
        origin: createDispatchLineageOrigin({
          dispatchID,
          taskID,
          orchestratorSessionID: root.id,
          orchestratorMessageID: Identifier.ascending("message"),
          toolPartID: Identifier.ascending("part"),
          toolCallID: Identifier.ascending("call"),
          targetAgentID: capability.identity.agentID,
          projectedWorkerIdentity: capability.identity,
          workScope: { kind: "task" },
          workflowBinding,
          workflowNodeID: null,
          adapterInput: {},
        }),
        childSessionID: worker.id,
      })
    })()
    if (!accepted) return { dispatchID, lineage }
    const info = await Session.updateMessage({
      id: Identifier.ascending("message"),
      sessionID: worker.id,
      role: "user",
      author: "orchestrator",
      agent: capability.identity.agentID,
      model: { providerID: "test", modelID: "test" },
      time: { created: Date.now() },
    })
    const part = await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: info.id,
      sessionID: worker.id,
      type: "text",
      text: "Exact old and new worker occurrences",
    })
    const descriptor = recordTestAcceptedWorkerTurn({
      taskID,
      rootSessionID: root.id,
      worker,
      capability,
      inputMessageID: info.id,
      controlPartID: part.id,
      dispatchID,
      workflowBinding,
      request: part.text,
    })
    SessionStatus.beginExecutionOccurrence(worker.id, info.id)
    await SessionStatus.set(worker.id, { type: "streaming" }, { taskID, inputMessageID: info.id })
    return { dispatchID, lineage, descriptor, inputMessageID: info.id }
  }
  const settle = (dispatchID: string, sessionAccepted = true) =>
    settleDispatchOrReturnExisting({
      taskID,
      dispatchID,
      outcome: DispatchOutcome.infrastructureFailure({
        operation: "recover-abandoned-dispatch",
        message: "Exact delivery owner ended before lifecycle publication",
        errorName: "AbandonedDispatchError",
        ...(sessionAccepted ? { sessionID: worker.id } : {}),
        recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID, dispatchID }),
      }),
    })
  const complete = () =>
    ProtocolStore.appendEvent({
      kind: "event",
      type: "task.completed",
      aggregate: "task",
      aggregate_id: taskID,
      session_id: root.id,
      source: "test",
      emitted_at: Date.now() + 1,
      payload: { execution_epoch: 1 },
    })
  return { taskID, root, worker, turn, settle, complete }
}

describe("settled worker lifecycle recovery", () => {
  test("a faulted settlement keeps its Task retry while a sibling reaches terminal", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const badTask = await establishWorker(),
          bad = await badTask.turn()
        settleDispatchOrReturnExisting({
          taskID: badTask.taskID,
          dispatchID: bad.dispatchID,
          outcome: {
            kind: "infrastructure_failure",
            operation: "recover-abandoned-dispatch",
            message: "Bad snapshot identity",
            session_id: badTask.worker.id,
            recovery_authority: resolveDispatchOccurrenceAuthority({
              taskID: badTask.taskID,
              dispatchID: bad.dispatchID,
            }),
            worker_turn: {
              descriptor_id: bad.descriptor!.id,
              descriptor_hash: "invalid-accepted-descriptor-identity",
              input_message_id: bad.inputMessageID!,
              current_dispatch_id: bad.dispatchID,
            },
          },
        })
        await badTask.complete()
        const healthyTask = await establishWorker(),
          healthy = await healthyTask.turn()
        healthyTask.settle(healthy.dispatchID)
        await healthyTask.complete()
        expect(Control.currentProjectFrontierSlice().taskIDs.toSorted()).toEqual(
          [badTask.taskID, healthyTask.taskID].toSorted(),
        )
        expect(await Control.reconcileAbandonedDispatches(badTask.taskID)).toMatchObject({ retryRequired: true })
        await Control.reconcileAbandonedDispatches(healthyTask.taskID)
        expect(
          readTaskWorkerTerminalOccurrence({
            taskID: healthyTask.taskID,
            sessionID: healthyTask.worker.id,
            dispatchID: healthy.dispatchID,
          }),
        ).toMatchObject({
          kind: "terminal",
          inputMessageID: healthy.inputMessageID,
          status: { type: "terminal", reason: "error" },
        })
      },
    })
  }, 30_000)

  test("publishes the initial abandoned failure before a delivery retry", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await establishWorker(),
          old = await fixture.turn()
        using failure = Control.replaceBeforeDispatchSettlementDelivery(() => {
          throw new Error("Delivery retry boundary")
        })
        expect(await Control.reconcileAbandonedDispatches(fixture.taskID)).toMatchObject({
          recovered: 0,
          retryRequired: true,
        })
        const occurrence = readTaskWorkerTerminalOccurrence({
          taskID: fixture.taskID,
          sessionID: fixture.worker.id,
          dispatchID: old.dispatchID,
        })
        expect(occurrence).toMatchObject({
          kind: "terminal",
          inputMessageID: old.inputMessageID,
          status: {
            type: "terminal",
            reason: "error",
            error: `Worker Session ${fixture.worker.id} for dispatch ${old.dispatchID} lost its delivery owner before any terminal lifecycle was recorded`,
          },
        })
      },
    })
  }, 30_000)

  test("discovers and publishes an old accepted failure after Task completion", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await establishWorker(),
          old = await fixture.turn()
        fixture.settle(old.dispatchID)
        await fixture.complete()
        const observed: unknown[] = []
        const unsubscribe = Bus.subscribe(SessionStatus.Event.Status, (event) => {
          if (event.properties.inputMessageID === old.inputMessageID) observed.push(event.properties.status)
        })
        try {
          expect(Control.currentProjectFrontierSlice().taskIDs).toContain(fixture.taskID)
          await Control.reconcileAbandonedDispatches(fixture.taskID)
          const occurrence = readTaskWorkerTerminalOccurrence({
            taskID: fixture.taskID,
            sessionID: fixture.worker.id,
            dispatchID: old.dispatchID,
          })
          expect(occurrence).toMatchObject({
            kind: "terminal",
            inputMessageID: old.inputMessageID,
            status: {
              type: "terminal",
              reason: "error",
              error: "Exact delivery owner ended before lifecycle publication",
            },
          })
          expect(observed).toEqual([
            { type: "terminal", reason: "error", error: "Exact delivery owner ended before lifecycle publication" },
          ])
          const eventID = occurrence.kind === "terminal" ? occurrence.lifecycle.id : undefined
          await Control.reconcileAbandonedDispatches(fixture.taskID)
          expect(
            readTaskWorkerTerminalOccurrence({
              taskID: fixture.taskID,
              sessionID: fixture.worker.id,
              dispatchID: old.dispatchID,
            }),
          ).toMatchObject({ kind: "terminal", lifecycle: { id: eventID } })
        } finally {
          unsubscribe()
        }
      },
    })
  }, 30_000)

  test("settles an old epoch while a new exact input remains streaming", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await establishWorker(),
          old = await fixture.turn()
        fixture.settle(old.dispatchID)
        await fixture.complete()
        Database.immediateTransaction((db) =>
          appendTaskReopenedInTransaction({
            db,
            taskID: fixture.taskID,
            sessionID: fixture.root.id,
            source: "test",
            now: Date.now() + 2,
          }),
        )
        const deliveryOwnerID = `runtime:settled-lifecycle:${Identifier.ascending("call")}`
        const current = await fixture.turn(true, deliveryOwnerID)
        await using peer = childProcessIdentity(deliveryOwnerID)
        const originalIngresses = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.task_id, fixture.taskID))
            .all(),
        )
        await Promise.all([
          Control.reconcileAbandonedDispatches(fixture.taskID),
          Control.reconcileAbandonedDispatches(fixture.taskID),
        ])
        expect(
          readTaskWorkerTerminalOccurrence({
            taskID: fixture.taskID,
            sessionID: fixture.worker.id,
            dispatchID: old.dispatchID,
          }),
        ).toMatchObject({
          kind: "terminal",
          inputMessageID: old.inputMessageID,
          status: { type: "terminal", reason: "error" },
        })
        expect(SessionStatus.executionOccurrence(fixture.worker.id)).toMatchObject({
          inputMessageID: current.inputMessageID,
          status: { type: "streaming" },
        })
        expect(WorkerTurnDescriptor.latestForSession(fixture.worker.id)?.id).toBe(current.descriptor?.id)
        expect(
          Database.use((db) =>
            db
              .select()
              .from(EngineTaskRootIngressTable)
              .where(eq(EngineTaskRootIngressTable.task_id, fixture.taskID))
              .all(),
          ),
        ).toEqual(originalIngresses)
      },
    })
  }, 30_000)

  test("a failed preparation retains its predecessor's active input authority", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const deliveryOwnerID = `runtime:settled-preparation:${Identifier.ascending("call")}`
        const fixture = await establishWorker(),
          current = await fixture.turn(true, deliveryOwnerID),
          preparation = await fixture.turn(false)
        await using peer = childProcessIdentity(deliveryOwnerID)
        const settlement = fixture.settle(preparation.dispatchID, false)
        await Control.reconcileAbandonedDispatches(fixture.taskID)
        expect(settlement.payload.outcome).toMatchObject({
          kind: "infrastructure_failure",
          worker_turn: {
            descriptor_id: current.descriptor?.id,
            input_message_id: current.inputMessageID,
            current_dispatch_id: current.dispatchID,
          },
        })
        expect(SessionStatus.executionOccurrence(fixture.worker.id)).toMatchObject({
          inputMessageID: current.inputMessageID,
          status: { type: "streaming" },
        })
      },
    })
  }, 30_000)
})
