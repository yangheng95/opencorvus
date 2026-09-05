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
  configureTaskCancellationReconciler,
  configureTaskIngressRunner,
  reconcileTaskControlPlane,
} from "@/engine/task-root-ingress-delivery"
import { runTaskLoop } from "@/orchestrator/loop"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { ensureSessionProtocolBridge } from "@/protocol/session-mirror"
import { markConversationCapabilityTransactionalInit } from "@/conversation/capability-transaction"
import { PermissionAuthority } from "@/permission/authority"
import { ProjectMemoryOrganizer } from "@/memory/project-memory-organizer"
import { reconcileBuildObservationCleanups } from "@/engine/build-observation-cleanup"
import { SessionWake } from "@/session/wake"
import { SchedulerMessageDeliveryService } from "@/protocol/scheduler-message"

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
  EngineService.bindTaskExecutionDirectoryInitializer(InstanceBootstrap)
  SchedulerMessageDeliveryService.bindSessionWake(SessionWake)
  SchedulerMessageDeliveryService.bindTaskDeliveryMaterializer(EngineService.materializeClaimedSchedulerMessageToTask)
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
  EventService.init({ sessionWake: SessionWake })
  ProjectMemoryOrganizer.init()
  // Durable subscribers must exist before any persisted outbox occurrence is
  // resumed. In particular, message.moved is the single source/target
  // projection fact; draining it before its durable bridge registers would
  // permanently discard the only live-replay recovery occurrence.
  ensureTaskMessageProtocolBridge()
  ensureSessionProtocolBridge()
  ensureMissionCallerReceiptBridge()
  // Interaction subscribers own the Question/Permission → Interaction
  // locator materialization and therefore must be registered before replay.
  EngineService.init()
  // The control-plane scan re-attempts a stalled cancellation on every pass
  // over a `cancelling` Task, so convergence no longer depends on reaching the
  // bootstrap stage below.
  configureTaskCancellationReconciler(async (taskID) => {
    await EngineService.reconcilePendingTaskCancellation(taskID)
  })
  Bus.resumeDurablePublications()
  await ProjectOpenLifecycle.stage("build-observation.reconcile-cleanup", lifecycleContext, () =>
    reconcileBuildObservationCleanups({ projectID: Instance.project.id }),
  )
  await ProjectOpenLifecycle.stage("engine-task.reconcile-pending-cancellations", lifecycleContext, async () => {
    await EngineService.reconcilePendingTaskCancellations()
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
  // Install recovery discovery during open. Every admitted scan later owns a
  // separate serving lease for its full duration; a recovered Turn therefore
  // cannot delay initialization or outlive the Project context it reads.
  await ProjectOpenLifecycle.stage("task-control.reconcile", lifecycleContext, () =>
    reconcileTaskControlPlane().then(() => undefined),
  )
  // The terminal profile and the managed channel runtime are optional
  // subsystems: each protects a real invariant by refusing to start on bad
  // config, but neither is required to open a Project. Letting either failure
  // propagate would mean an uninstalled shell or a broken channel adapter
  // makes the whole Project permanently unopenable.
  await ProjectOpenLifecycle.stage("terminal-profile.ensure-default", lifecycleContext, async () => {
    try {
      await TerminalProfile.ensureProjectDefaultProfile()
    } catch (error) {
      // A host without a resolvable shell is an explicit degraded terminal
      // outcome. Config commit or runtime-settlement failures are not: they
      // must fail this stage so Instance rollback remains the one cleanup
      // authority instead of reporting a partially committed stage complete.
      if (!(error instanceof TerminalProfile.ConfigError)) throw error
      Log.Default.warn("default terminal profile unavailable; Project opens without one", {
        ...lifecycleContext,
        error: error.message,
      })
    }
  })
  await ProjectOpenLifecycle.stage("channel-supervisor.sync", lifecycleContext, async () => {
    try {
      await ChannelSupervisor.sync(await Config.get())
    } catch (error) {
      Log.Default.error("managed channel runtime sync failed; Project opens without it", {
        ...lifecycleContext,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      await Project.setInitialized(Instance.project.id)
    }
  })
}, validateInstanceConversationCapabilities)
