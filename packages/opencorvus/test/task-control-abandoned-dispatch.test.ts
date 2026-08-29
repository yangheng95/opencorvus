import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "../src/config/config"
import { createDispatchLineageOrigin } from "../src/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { findDispatchSettlementByDispatchID } from "../src/engine/dispatch-settlement"
import { EngineTaskRootIngressTable } from "../src/engine/engine.sql"
import { requireTask } from "../src/engine/store"
import { selectedWorkflowBinding } from "../src/engine/workflow-binding"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import {
  dispatchTaskLoop,
  reconcileTaskControlPlane,
  TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
  TestHooks as TaskControlTestHooks,
} from "../src/engine/task-root-ingress-delivery"
import { recordTaskInfrastructureError } from "../src/engine/persist"
import { resolveDispatchOccurrenceAuthority } from "../src/engine/dispatch-lineage"
import { DispatchOutcome } from "../src/agent/dispatch-outcome"
import { exactEngineArtifactLocator } from "../src/artifact-catalog"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import { BrowserMCPBuiltin } from "../src/mcp/browser/builtin"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { Database, and, eq } from "../src/storage/db"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

/**
 * A dispatch decision resolves its ingress as soon as the worker is accepted,
 * so nothing durable remains that can wake the Orchestrator if the delivery
 * owner dies. Without abandonment recovery the Task holds an empty ready set,
 * no lease and no timer — the multi-agent stall this suite fences.
 */
describe("abandoned dispatch recovery", () => {
  test("settles a committed dispatch whose delivery owner vanished and wakes the Task", async () => {
    await using project = await memoryProject()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "base" },
          mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const worker = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: scheduler.packageRevision,
          agentID: "base-developer",
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Abandoned dispatch recovery",
          metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Abandoned dispatch recovery",
          request: "Prove an abandoned worker is settled and handed back to the Orchestrator",
          productPillar: "code",
          source: "test",
          priority: "normal",
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

        // A worker Session committed by a runtime that is now gone: the child
        // Session exists, no terminal lifecycle was ever recorded, and this
        // process owns neither a prompt generation nor a delivery pipeline.
        const task = requireTask(taskID)
        const child = await Session.create({ kind: "delegated-worker", parentID: root.id, title: "Abandoned worker" })
        const dispatchID = Identifier.ascending("artifact")
        const lineage = recordTestDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID,
            taskID,
            orchestratorSessionID: task.session_id!,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: worker.identity.agentID,
            projectedWorkerIdentity: worker.identity,
            workScope: { kind: "task" },
            workflowBinding: selectedWorkflowBinding({
              projection: {
                packageRevision: scheduler.packageRevision,
                virtualWorkflows: scheduler.virtualWorkflows,
              },
              workflowID: null,
            }),
            workflowNodeID: null,
            adapterInput: {},
          }),
          childSessionID: child.id,
          // The runtime that committed this lineage holds no liveness lease,
          // which is what "its owner is gone" means to recovery.
          ownerProcessOccurrenceID: "runtime:vanished-owner",
        })

        expect(findDispatchSettlementByDispatchID({ taskID, dispatchID })).toBeUndefined()

        const activatedIngressSources: string[] = []
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:test-abandoned-dispatch")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID }) => {
            const ingress = Database.use((db) =>
              db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.id, wakeID!)).get(),
            )
            if (ingress) activatedIngressSources.push(ingress.source)
            // The Orchestrator decision itself is out of scope; this scan only
            // has to prove the abandoned worker produced a real wake.
            return {}
          },
        })

        await reconcileTaskControlPlane(taskID)

        const settlement = findDispatchSettlementByDispatchID({ taskID, dispatchID })
        const ingresses = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(
              and(
                eq(EngineTaskRootIngressTable.task_id, taskID),
                eq(EngineTaskRootIngressTable.source, "engine_artifact"),
              ),
            )
            .all(),
        )
        // The recovery fact enters the epoch FIFO as an ordinary accepted
        // ingress. This scan still activates the head — the Task-creation
        // ingress, which the stub runner leaves undecided — so the assertion
        // is that the wake now durably *exists*, not that it ran first.
        expect({
          outcomeKind: settlement?.payload.outcome.kind,
          settledSession: settlement?.payload.session_id,
          settledLineage: settlement?.payload.dispatch_lineage_id,
          recoveryIngresses: ingresses.length,
          scanActivatedHead: activatedIngressSources,
        }).toEqual({
          outcomeKind: "infrastructure_failure",
          settledSession: child.id,
          settledLineage: lineage.artifactID,
          recoveryIngresses: 1,
          scanActivatedHead: ["task"],
        })

        // Recovery is idempotent: a second scan finds the dispatch settled and
        // must not mint a second outcome or a second wake.
        await reconcileTaskControlPlane(taskID)
        const afterReplay = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(
              and(
                eq(EngineTaskRootIngressTable.task_id, taskID),
                eq(EngineTaskRootIngressTable.source, "engine_artifact"),
              ),
            )
            .all(),
        )
        expect(afterReplay.length).toBe(1)
      },
    })
  }, 30_000)

  test("a spent infrastructure budget silences the recovery sweep too", async () => {
    await using project = await memoryProject()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          prompt_profile: { active: "base" },
          mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const worker = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: scheduler.packageRevision,
          agentID: "base-developer",
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Budget-silenced recovery",
          metadata: { configOverlay: { prompt_profile: { active: scheduler.packageRevision.id } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Budget-silenced recovery",
          request: "Prove the settled-undelivered sweep honours the epoch infrastructure budget",
          productPillar: "code",
          source: "test",
          priority: "normal",
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
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })

        // Spend the whole epoch budget on unrelated failures.
        for (let attempt = 0; attempt < TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET; attempt += 1) {
          const filler = await Session.create({ kind: "delegated-worker", parentID: root.id, title: `Filler ${attempt}` })
          const artifactID = recordTaskInfrastructureError({
            taskID,
            component: "dispatch-agent",
            operation: "recover-abandoned-dispatch",
            reason: `Filler worker ${attempt} failed`,
            errorName: "AbandonedDispatchError",
            sessionID: filler.id,
            context: { target: "base-developer", dispatchID: `filler-${attempt}` },
            now: Date.now(),
          })
          await dispatchTaskLoop({
            taskID,
            event: {
              note: `Filler worker ${attempt} failed`,
              dispatchInfrastructureFailure: {
                infrastructureFactID: artifactID,
                outcome: DispatchOutcome.infrastructureFailure({
                  operation: "recover-abandoned-dispatch",
                  message: `Filler worker ${attempt} failed`,
                  errorName: "AbandonedDispatchError",
                  sessionID: filler.id,
                  recoveryAuthority: resolveDispatchOccurrenceAuthority({ taskID, dispatchID: `filler-${attempt}` }),
                  infrastructureError: exactEngineArtifactLocator({ taskID, artifactID }),
                }),
              },
            },
          })
        }

        // An abandoned dispatch settles after the budget is spent: its own
        // wake is suppressed, and the settled-undelivered recovery sweep must
        // not smuggle a replacement wake past the gate as `processRecovery`.
        const task = requireTask(taskID)
        const child = await Session.create({ kind: "delegated-worker", parentID: root.id, title: "Silenced worker" })
        const dispatchID = Identifier.ascending("artifact")
        recordTestDispatchLineage({
          origin: createDispatchLineageOrigin({
            dispatchID,
            taskID,
            orchestratorSessionID: task.session_id!,
            orchestratorMessageID: Identifier.ascending("message"),
            toolPartID: Identifier.ascending("part"),
            toolCallID: Identifier.ascending("call"),
            targetAgentID: worker.identity.agentID,
            projectedWorkerIdentity: worker.identity,
            workScope: { kind: "task" },
            workflowBinding: selectedWorkflowBinding({
              projection: {
                packageRevision: scheduler.packageRevision,
                virtualWorkflows: scheduler.virtualWorkflows,
              },
              workflowID: null,
            }),
            workflowNodeID: null,
            adapterInput: {},
          }),
          childSessionID: child.id,
          ownerProcessOccurrenceID: "runtime:vanished-owner",
        })

        const ingressCount = () =>
          Database.use(
            (db) =>
              db
                .select({ id: EngineTaskRootIngressTable.id })
                .from(EngineTaskRootIngressTable)
                .where(eq(EngineTaskRootIngressTable.task_id, taskID))
                .all().length,
          )

        await reconcileTaskControlPlane(taskID)
        const afterSettlement = {
          settled: findDispatchSettlementByDispatchID({ taskID, dispatchID })?.payload.outcome.kind,
          ingresses: ingressCount(),
        }
        // Two more sweeps: the settled-but-undelivered dispatch must stay
        // silent instead of re-entering through a budget-exempt event.
        await reconcileTaskControlPlane(taskID)
        await reconcileTaskControlPlane(taskID)

        expect({
          ...afterSettlement,
          ingressesAfterSweeps: ingressCount(),
        }).toEqual({
          settled: "infrastructure_failure",
          // Creation ingress + the budgeted failures; the silenced dispatch
          // minted nothing, then and later.
          ingresses: 1 + TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
          ingressesAfterSweeps: 1 + TASK_EPOCH_INFRASTRUCTURE_INGRESS_BUDGET,
        })
      },
    })
  }, 30_000)
})
