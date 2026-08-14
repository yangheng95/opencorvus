import { AutomationService } from "@/scheduler/automation-service"
import { SchedulerMessageDeliveryService } from "@/protocol/scheduler-message"
import { Server } from "@/server/server"
import {
  RuntimeServerOwnership,
  RuntimeServerOwnershipHandoffPendingError,
  RuntimeServerStartupCleanupPendingError,
} from "@/server/runtime-server-ownership"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { recoverOrphanedIsolatedCheckWorkspaces } from "@/project/isolated-check-workspace"
import { recoverProjectDeletionCleanup } from "@/project/deletion-cleanup"

export async function acquireServerRuntimeAfterRecovery(input: {
  recover(): Promise<void>
  disposeInstances(): Promise<void>
}): Promise<{ ownership: RuntimeServerOwnership.Handle; recovery: Promise<void> }> {
  let ownership: RuntimeServerOwnership.Handle
  try {
    ownership = Server.acquireRuntimeOwnershipForStartup()
  } catch (error) {
    if (!(error instanceof RuntimeServerStartupCleanupPendingError)) throw error
    await error.complete()
    ownership = Server.acquireRuntimeOwnershipForStartup()
  }
  const recovery = Promise.resolve().then(async () => {
    const observeProcessOccurrence = RuntimeServerOwnership.cachedProcessOccurrenceObserver()
    await ProcessSupervisor.recoverOrphanedWindowsRequests({
      currentOccurrenceID: ownership.owner.occurrenceID,
      observeProcessOccurrence,
    })
    await recoverOrphanedIsolatedCheckWorkspaces({
      currentOccurrenceID: ownership.owner.occurrenceID,
      observeProcessOccurrence,
    })
    await recoverProjectDeletionCleanup(ownership)
    AutomationService.initGlobal()
    await input.recover()
    SchedulerMessageDeliveryService.initGlobal()
  })
  try {
    await recovery
    return { ownership, recovery }
  } catch (recoveryError) {
    let terminated: Awaited<ReturnType<typeof Server.settleCurrentProcessExecution>> | undefined
    let cleanupFailure: unknown
    const cleanup = RuntimeServerOwnership.retainStartupCleanup({
      handle: ownership,
      async complete() {
        if (cleanupFailure instanceof RuntimeServerOwnershipHandoffPendingError) {
          await cleanupFailure.complete()
          return
        }
        terminated ??= await Server.settleCurrentProcessExecution("Started Task recovery failed before listener bind", {
          disposeInstances: input.disposeInstances,
        })
        try {
          await RuntimeServerOwnership.releaseWithRetry(ownership, () => terminated!.releaseHandoff(true))
        } catch (error) {
          cleanupFailure = error
          throw error
        }
      },
    })
    try {
      await cleanup.complete()
    } catch (cleanupError) {
      throw new AggregateError([recoveryError, cleanupError], "Started Task recovery and runtime cleanup failed")
    }
    throw recoveryError
  }
}

export async function listenWithRecoveredServerRuntime(input: {
  options: Server.ListenOptions
  recover(): Promise<void>
  disposeInstances(): Promise<void>
}): Promise<{
  server: ReturnType<typeof Server.listenWithOwnedRuntime>
  ownership: RuntimeServerOwnership.Handle
  recovery: Promise<void>
}> {
  const prepared = await acquireServerRuntimeAfterRecovery(input)
  return {
    server: Server.listenWithOwnedRuntime(input.options, prepared.ownership),
    ...prepared,
  }
}
