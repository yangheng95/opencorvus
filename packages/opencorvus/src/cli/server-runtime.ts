import { AutomationService } from "@/scheduler/automation-service"
import { SchedulerMessageDeliveryService } from "@/protocol/scheduler-message"
import { Server } from "@/server/server"
import {
  cachedRuntimeProcessOccurrenceObserver,
  currentRuntimeProcessOccurrence,
  type RuntimeProcessOccurrenceInfo,
} from "@/runtime/process-occurrence"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { recoverOrphanedIsolatedCheckWorkspaces } from "@/project/isolated-check-workspace"
import { recoverProjectDeletionCleanup } from "@/project/deletion-cleanup"
import { recoverProjectMaintenanceFences } from "@/project/deletion-registry"

/** Run every process-local recovery barrier before a listener is published.
 * Durable leases and idempotent facts coordinate concurrent backends; a
 * database-path-wide host lock is neither acquired nor consulted. */
export async function prepareServerRuntimeAfterRecovery(input: {
  recover(): Promise<void>
  disposeInstances(): Promise<void>
}): Promise<{ occurrence: RuntimeProcessOccurrenceInfo; recovery: Promise<void> }> {
  const occurrence = currentRuntimeProcessOccurrence()
  const recovery = Promise.resolve().then(async () => {
    const observeProcessOccurrence = cachedRuntimeProcessOccurrenceObserver()
    await ProcessSupervisor.recoverOrphanedWindowsRequests({
      currentOccurrenceID: occurrence.occurrenceID,
      observeProcessOccurrence,
    })
    await recoverOrphanedIsolatedCheckWorkspaces({
      currentOccurrenceID: occurrence.occurrenceID,
      observeProcessOccurrence,
    })
    await recoverProjectDeletionCleanup(observeProcessOccurrence)
    recoverProjectMaintenanceFences(observeProcessOccurrence)
    AutomationService.initGlobal()
    await input.recover()
    SchedulerMessageDeliveryService.initGlobal()
  })
  try {
    await recovery
    return { occurrence, recovery }
  } catch (recoveryError) {
    try {
      const terminated = await Server.settleCurrentProcessExecution("Started Task recovery failed before listener bind", {
        disposeInstances: input.disposeInstances,
      })
      await Server.releaseRuntimeHandoff(terminated.releaseHandoff)
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
  server: ReturnType<typeof Server.listenPrepared>
  occurrence: RuntimeProcessOccurrenceInfo
  recovery: Promise<void>
}> {
  const prepared = await prepareServerRuntimeAfterRecovery(input)
  return {
    server: Server.listenPrepared(input.options),
    ...prepared,
  }
}
