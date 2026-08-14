import { Plugin } from "../plugin"
import { Format } from "../format"
import { FileWatcher } from "../file/watcher"
import { File } from "../file"
import { Project } from "./project"
import { Bus } from "../bus"
import { Command } from "../command"
import { Instance } from "./instance"
import { Vcs } from "./vcs"
import { Log } from "@/util/log"
import { ProjectGC } from "./gc"
import { recoverTaskArtifactsDuringBootstrap } from "@/task-artifact/recovery"
import { WorktreeGC } from "../worktree/gc"
import { Truncate } from "../tool/truncation"
import { AutomationService } from "../scheduler/automation-service"
import { EventService } from "../scheduler/event-service"
import { EngineService } from "@/task-api"
import { EngineEventLog } from "@/engine/event-log"
import { EngineInteraction } from "@/engine/interaction"
import { ChannelSupervisor } from "@/channel/supervisor"
import { Config } from "@/config/config"
import { ensureTaskMessageProtocolBridge } from "@/orchestrator/protocol/message-bridge"
import { TerminalProfile } from "@/system-terminal/profile"
import { ensureMissionCallerReceiptBridge } from "@/mission/caller-receipt"
import { ProjectOpenLifecycle } from "./open-lifecycle"
import {
  configureTaskIngressRunner,
  deliverPendingTaskRootIngresses,
  reconcileFailedExactTerminalIngressDeliveries,
  reconcileUndeliveredDispatchInfrastructureFacts,
  reconcileTerminalAgentLifecycleDeliveries,
  reconcileInterruptedTaskExecutions,
  recoverInterruptedTaskIngressDeliveries,
} from "@/engine/task-root-ingress-delivery"
import { runTaskLoop } from "@/orchestrator/loop"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { installDefaultTaskWakeRuntime } from "@/scheduler/task-wake-composition"
import { ensureSessionProtocolBridge } from "@/protocol/session-mirror"
import { markConversationCapabilityTransactionalInit } from "@/conversation/capability-transaction"
import { reconcilePendingCancelledTaskSettlements } from "@/engine/state"
import { PermissionAuthority } from "@/permission/authority"
import { ProjectMemoryOrganizer } from "@/memory/project-memory-organizer"
import { reconcileBuildObservationCleanups } from "@/engine/build-observation-cleanup"
import { recoverAbandonedTaskCompletionClosures } from "@/engine/task-completion-closure"

async function validateInstanceConversationCapabilities() {
  const lifecycleContext = {
    directory: Instance.directory,
    worktree: Instance.worktree,
    projectID: Instance.project.id,
  }
  await ProjectOpenLifecycle.stage("config.validate", lifecycleContext, async () => {
    const { validateConfigCandidate } = await import("@/config/candidate-validation")
    await validateConfigCandidate({
      config: await Config.get(),
      root: "config",
      projectDirectory: Instance.project.worktree,
      projectOwnedCapabilities: true,
    })
  })
}

export const InstanceBootstrap = markConversationCapabilityTransactionalInit(async function InstanceBootstrap() {
  Log.Default.info("bootstrapping", { directory: Instance.directory })
  installDefaultControlPlaneToolLoaders()
  installDefaultTaskWakeRuntime()
  configureTaskIngressRunner(runTaskLoop)
  const lifecycleContext = {
    directory: Instance.directory,
    worktree: Instance.worktree,
    projectID: Instance.project.id,
  }
  await ProjectOpenLifecycle.stage("plugin.init", lifecycleContext, () => Plugin.init())
  Format.init()
  await ProjectOpenLifecycle.stage("file-watcher.init", lifecycleContext, () => FileWatcher.init())
  await ProjectOpenLifecycle.stage("file.init", lifecycleContext, () => File.init())
  await ProjectOpenLifecycle.stage("vcs.init", lifecycleContext, () => Vcs.init())
  // ProjectGC removes only orphan snapshot/session-diff caches. User-owned
  // Project rows and their Task runtime trees require explicit destruction.
  ProjectGC.init()
  const taskArtifactRecovery = await ProjectOpenLifecycle.stage(
    "task-artifact.recover-unreferenced",
    lifecycleContext,
    () =>
      recoverTaskArtifactsDuringBootstrap({
        projectID: Instance.project.id,
        projectDirectory: Instance.directory,
      }),
  )
  if (taskArtifactRecovery.status === "corrupt") {
    Log.Default.error("task artifact corruption isolated during project open", {
      ...lifecycleContext,
      ...taskArtifactRecovery.error,
    })
  }
  // Periodic sweep of unbound Task dispatch worktrees proven clean, old, and free of
  // in-transit commits.
  WorktreeGC.init()
  Truncate.init()
  AutomationService.init()
  EventService.init()
  ProjectMemoryOrganizer.init()
  // Durable subscribers must exist before any persisted outbox occurrence is
  // resumed. In particular, message.moved is the single source/target
  // projection fact; draining it before its durable bridge registers would
  // permanently discard the only live-replay recovery occurrence.
  ensureTaskMessageProtocolBridge()
  ensureSessionProtocolBridge()
  ensureMissionCallerReceiptBridge()
  Bus.resumeDurablePublications()
  await ProjectOpenLifecycle.stage("engine-task.recover-completion-closures", lifecycleContext, async () => {
    recoverAbandonedTaskCompletionClosures(Instance.project.id)
  })
  EngineService.init()
  await ProjectOpenLifecycle.stage("build-observation.reconcile-cleanup", lifecycleContext, () =>
    reconcileBuildObservationCleanups({ projectID: Instance.project.id }),
  )
  await ProjectOpenLifecycle.stage("engine-task.reconcile-pending-cancellations", lifecycleContext, async () => {
    await EngineService.reconcilePendingTaskCancellations()
    reconcilePendingCancelledTaskSettlements()
  })
  EngineEventLog.init()
  await ProjectOpenLifecycle.stage("engine-interaction.reconcile-recovered-waiters", lifecycleContext, () =>
    EngineInteraction.reconcileRecoveredPendingWaiters({
      projectID: Instance.project.id,
      timeResolved: Date.now(),
    }),
  )
  await ProjectOpenLifecycle.stage("permission.reconcile-interrupted-attempts", lifecycleContext, async () => {
    PermissionAuthority.reconcileInterruptedAttempts()
  })
  // Restore the prior runtime's exact FIFO head before interrupted worker
  // recovery can append and drain new process-recovery/lifecycle wakes. If a
  // stale `delivering` ingress remains ineligible here, the next `accepted` row
  // can overtake it during recovery and permanently invert operator order.
  await ProjectOpenLifecycle.stage("task-root-ingress.recover-interrupted-running-ingresses", lifecycleContext, () =>
    recoverInterruptedTaskIngressDeliveries().then(() => undefined),
  )
  await ProjectOpenLifecycle.stage("task-root-ingress.recover-interrupted-executions", lifecycleContext, async () => {
    try {
      await reconcileInterruptedTaskExecutions()
    } catch (error) {
      Log.Default.error("interrupted Task execution recovery failed", {
        directory: Instance.directory,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  })
  await ProjectOpenLifecycle.stage("task-root-ingress.deliver-persisted-ingresses", lifecycleContext, async () => {
    const failures: Error[] = []
    const recover = async (operation: string, run: () => void | Promise<void>) => {
      try {
        await run()
      } catch (error) {
        const failure = new Error(
          `${operation}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        )
        failures.push(failure)
        Log.Default.error("persisted coordination wake recovery item failed", {
          directory: Instance.directory,
          operation,
          error: failure.message,
        })
      }
    }
    await recover("reconcile-terminal-agent-lifecycle-deliveries", () =>
      reconcileTerminalAgentLifecycleDeliveries().then(() => undefined),
    )
    await recover("reconcile-failed-exact-terminal-ingresses", () =>
      reconcileFailedExactTerminalIngressDeliveries().then(() => undefined),
    )
    await recover("reconcile-undelivered-dispatch-infrastructure-facts", () =>
      reconcileUndeliveredDispatchInfrastructureFacts().then(() => undefined),
    )
    await recover("deliver-pending-task-root-ingresses", () =>
      deliverPendingTaskRootIngresses().then(() => undefined),
    )
    if (failures.length > 0) {
      throw new AggregateError(failures, `Failed ${failures.length} persisted coordination recovery operation(s)`)
    }
  })
  await ProjectOpenLifecycle.stage("terminal-profile.ensure-default", lifecycleContext, () =>
    TerminalProfile.ensureProjectDefaultProfile(),
  )
  await ProjectOpenLifecycle.stage("channel-supervisor.sync", lifecycleContext, async () => {
    await ChannelSupervisor.sync(await Config.get())
  })
  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id)
    }
  })
}, validateInstanceConversationCapabilities)
