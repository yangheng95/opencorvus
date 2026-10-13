import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { findDispatchSettlementByDispatchID, settleDispatchOrReturnExisting } from "@/engine/dispatch-settlement"
import { EngineTaskRootIngressTable } from "@/engine/engine.sql"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { TASK_CONTROL_HEARTBEAT_MS } from "@/engine/task-control-driver"
import { TestHooks, reconcileSettledDispatchDelivery } from "@/engine/task-root-ingress-delivery"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { detachDispatchExecution, waitForDetachedDispatchPipelinesForTest } from "@/orchestrator/dispatch-agent-tool"
import { Instance } from "@/project/instance"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { childProcessIdentity } from "./fixture/process-liveness"
import { recordTestSettledWorkerReport } from "./fixture/settled-worker-report"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function prepareTerminalWorker(peerOwner?: string) {
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
    now = Date.now(),
    request = "Settle the actual post-turn domain result before delivery."
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Terminal owner authority",
    metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
  })
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: "Terminal owner authority",
    request,
    productPillar: "code",
    source: "test",
    metadata: {},
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
    title: "Post-turn owner",
  })
  const workflowBinding = selectedWorkflowBinding({
    projection: { packageRevision: scheduler.packageRevision, virtualWorkflows: scheduler.virtualWorkflows },
    workflowID: null,
  })
  const lineage = (() => {
    using owner = peerOwner ? TestHooks.replaceTerminalIngressDeliveryRuntime(peerOwner) : undefined
    return recordTestDispatchLineage({
      origin: createDispatchLineageOrigin({
        taskID,
        orchestratorSessionID: root.id,
        orchestratorMessageID: Identifier.ascending("message"),
        toolPartID: Identifier.ascending("part"),
        toolCallID: Identifier.ascending("call"),
        targetAgentID: capability.identity.agentID,
        projectedWorkerIdentity: capability.identity,
        workScope: { kind: "task" },
        adapterInput: {},
        workflowBinding,
        workflowNodeID: null,
      }),
      childSessionID: worker.id,
    })
  })()
  const input = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "user",
    author: "orchestrator",
    agent: capability.identity.agentID,
    model: { providerID: "test", modelID: "test" },
    time: { created: now },
  })
  const control = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: worker.id,
    messageID: input.id,
    type: "text",
    text: request,
  })
  const final = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: worker.id,
    role: "assistant",
    author: capability.identity.agentID,
    parentID: input.id,
    agent: capability.identity.agentID,
    providerID: "test",
    modelID: "test",
    path: { cwd: Instance.directory, root: Instance.directory },
    time: { created: now + 1, completed: now + 2 },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  })
  return {
    taskID,
    worker,
    lineage,
    final,
    terminalize: () =>
      recordTestSettledWorkerReport({
        taskID,
        rootSessionID: root.id,
        worker,
        capability,
        inputMessageID: input.id,
        controlPartID: control.id,
        finalMessageID: final.id,
        dispatchID: lineage.dispatchID,
        workflowBinding,
        request,
      }),
    settle: () =>
      settleDispatchOrReturnExisting({
        taskID,
        dispatchID: lineage.dispatchID,
        outcome: DispatchOutcome.terminal({ sessionID: worker.id, finalMessageID: final.id }),
      }),
    deliver: () => reconcileSettledDispatchDelivery({ taskID, dispatchID: lineage.dispatchID, sessionID: worker.id }),
  }
}

test("a local post-turn pipeline owns domain settlement until its exact terminal-success delivery", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      using runner = TestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
      const fixture = await prepareTerminalWorker()
      const release = Promise.withResolvers<void>(),
        terminal = Promise.withResolvers<void>()
      const deliveries: string[] = []
      try {
        expect(
          await detachDispatchExecution({
            execute: async () => {
              await fixture.terminalize()
              terminal.resolve()
              await release.promise
              return fixture.settle().payload.outcome
            },
            committedLineage: Promise.resolve({ sessionID: fixture.worker.id, artifactID: fixture.lineage.artifactID }),
            runDetached: (fn) => fn(),
            runDetachedRecovery: (fn) => fn(),
            deliver: async () => {
              deliveries.push(await fixture.deliver())
            },
            onDeliveryFailure: ({ error }) => {
              throw error
            },
            onPipelineOwnerCleanupFailure: ({ error }) => {
              throw error
            },
          }),
        ).toMatchObject({ kind: "accepted", session_id: fixture.worker.id })
        await terminal.promise
        const now = Date.now(),
          pending = await TestHooks.reconcileAbandonedDispatches(fixture.taskID)
        const wakeAt = pending.wakeAt!
        expect(pending).toMatchObject({
          recovered: 0,
          hasMore: false,
          retryRequired: false,
          wakeAt: expect.any(Number),
        })
        expect(wakeAt).toBeGreaterThanOrEqual(now + TASK_CONTROL_HEARTBEAT_MS)
        expect(wakeAt).toBeLessThanOrEqual(Date.now() + TASK_CONTROL_HEARTBEAT_MS)
      } finally {
        release.resolve()
        await waitForDetachedDispatchPipelinesForTest()
      }
      expect(
        findDispatchSettlementByDispatchID({ taskID: fixture.taskID, dispatchID: fixture.lineage.dispatchID })?.payload
          .outcome,
      ).toEqual({ kind: "terminal_success", session_id: fixture.worker.id, final_message_id: fixture.final.id })
      expect(deliveries).toEqual(["delivered"])
    },
  })
}, 60_000)

for (const disposition of ["complete", "die"] as const)
  test(`a live peer terminal owner schedules recheck and then ${disposition === "complete" ? "delivers its exact success" : "recovers partial after physical exit"}`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        using runner = TestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const peerID = `terminal-owner:${Identifier.ascending("call")}`
        const fixture = await prepareTerminalWorker(peerID)
        await using peer = childProcessIdentity(peerID)
        await fixture.terminalize()
        const now = Date.now(),
          pending = await TestHooks.reconcileAbandonedDispatches(fixture.taskID)
        const wakeAt = pending.wakeAt!
        expect(pending).toMatchObject({ recovered: 0, retryRequired: false, wakeAt: expect.any(Number) })
        expect(wakeAt).toBeGreaterThanOrEqual(now + TASK_CONTROL_HEARTBEAT_MS)
        expect(wakeAt).toBeLessThanOrEqual(Date.now() + TASK_CONTROL_HEARTBEAT_MS)
        if (disposition === "complete") fixture.settle()
        else await peer.exit()
        expect(await TestHooks.reconcileAbandonedDispatches(fixture.taskID)).toMatchObject({
          recovered: 1,
          retryRequired: false,
        })
        expect(
          findDispatchSettlementByDispatchID({ taskID: fixture.taskID, dispatchID: fixture.lineage.dispatchID })
            ?.payload.outcome,
        ).toEqual({
          kind: disposition === "complete" ? "terminal_success" : "partial",
          session_id: fixture.worker.id,
          final_message_id: fixture.final.id,
          ...(disposition === "die" ? { failed_operation: "recover_dispatch_domain_settlement" } : {}),
        })
        const ingresses = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.task_id, fixture.taskID))
            .all(),
        )
        const terminal = Database.use((db) =>
          db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.session_id, fixture.worker.id)).all(),
        ).find(
          (event) =>
            event.type === "agent.execution.lifecycle" &&
            (event.payload as any).status?.final_message_id === fixture.final.id,
        )!
        const settlement = findDispatchSettlementByDispatchID({
          taskID: fixture.taskID,
          dispatchID: fixture.lineage.dispatchID,
        })!
        const source = disposition === "complete" ? "engine_artifact" : "protocol_event"
        const sourceID = disposition === "complete" ? settlement.artifactID : terminal.id
        expect(
          ingresses
            .filter((row) => row.source_id === sourceID)
            .map((row) => ({ source: row.source, sourceID: row.source_id, taskID: row.task_id })),
        ).toEqual([{ source, sourceID, taskID: fixture.taskID }])
      },
    })
  }, 60_000)
