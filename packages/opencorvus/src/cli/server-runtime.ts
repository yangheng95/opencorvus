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
import { Log } from "@/util/log"

const log = Log.create({ service: "startup-recovery" })

function reportUnreconciledArtifacts(
  subject: string,
  result: {
    quarantined: number
    retainedUnknown: number
    unreconciled: ReadonlyArray<Error & { quarantineFailure?: unknown }>
  },
) {
  for (const unknown of result.unreconciled) {
    log.error(`${subject} artifact could not be reconciled`, {
      detail: unknown.message,
      cause: String(unknown.cause ?? ""),
      disposition: unknown.quarantineFailure === undefined ? "quarantined" : "retained",
      ...(unknown.quarantineFailure === undefined ? {} : { quarantineFailure: String(unknown.quarantineFailure) }),
    })
  }
}

export function reportUnreconciledFailures(subject: string, failures: ReadonlyArray<unknown>) {
  for (const failure of failures) {
    log.error(`${subject} could not be reconciled`, {
      detail: failure instanceof Error ? failure.message : String(failure),
      ...(failure instanceof AggregateError
        ? { causes: failure.errors.map((item) => (item instanceof Error ? item.message : String(item))) }
        : {}),
    })
  }
}

/** Complete bounded process-local integrity work before publishing a listener.
 * Task, Mission, and Session convergence is deliberately excluded: it may run
 * streamed model/tool turns and is owned by the post-bind recovery promise. */
export async function prepareServerRuntimeForListener(input: {
  disposeInstances(): Promise<void>
}): Promise<{ occurrence: RuntimeProcessOccurrenceInfo }> {
  const occurrence = currentRuntimeProcessOccurrence()
  try {
    const observeProcessOccurrence = cachedRuntimeProcessOccurrenceObserver()
    const requestRecovery = await ProcessSupervisor.recoverOrphanedWindowsRequests({
      currentOccurrenceID: occurrence.occurrenceID,
      observeProcessOccurrence,
    })
    reportUnreconciledArtifacts("windows supervisor request", requestRecovery)
    const workspaceRecovery = await recoverOrphanedIsolatedCheckWorkspaces({
      currentOccurrenceID: occurrence.occurrenceID,
      observeProcessOccurrence,
    })
    reportUnreconciledArtifacts("isolated check-workspace", workspaceRecovery)
    const deletionRecovery = await recoverProjectDeletionCleanup(observeProcessOccurrence)
    reportUnreconciledFailures("project deletion cleanup", deletionRecovery.unreconciled)
    const fenceRecovery = recoverProjectMaintenanceFences(observeProcessOccurrence)
    reportUnreconciledFailures("project maintenance fence", fenceRecovery.unreconciled)
    AutomationService.initGlobal()
    return { occurrence }
  } catch (preparationError) {
    try {
      const terminated = await Server.settleCurrentProcessExecution("Runtime preparation failed before listener bind", {
        disposeInstances: input.disposeInstances,
      })
      await Server.releaseRuntimeHandoff(terminated.releaseHandoff)
    } catch (cleanupError) {
      throw new AggregateError([preparationError, cleanupError], "Runtime preparation and cleanup failed")
    }
    throw preparationError
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
  const prepared = await prepareServerRuntimeForListener(input)
  let server: ReturnType<typeof Server.listenPrepared>
  try {
    server = Server.listenPrepared(input.options)
  } catch (listenerError) {
    try {
      const terminated = await Server.settleCurrentProcessExecution("Listener bind failed after runtime preparation", {
        disposeInstances: input.disposeInstances,
      })
      await Server.releaseRuntimeHandoff(terminated.releaseHandoff)
    } catch (cleanupError) {
      throw new AggregateError([listenerError, cleanupError], "Listener bind and runtime cleanup failed")
    }
    throw listenerError
  }
  let recovery: Promise<void>
  try {
    // Durable claims isolate pollers from the one-shot recovery pass. Start the
    // global retry owner before any Project can hold that pass in a model Turn.
    SchedulerMessageDeliveryService.initGlobal()
    recovery = Promise.resolve().then(async () => {
      await input.recover()
    })
  } catch (initializationError) {
    try {
      await server.stop(true)
    } catch (cleanupError) {
      throw new AggregateError(
        [initializationError, cleanupError],
        "Post-bind runtime initialization and listener cleanup failed",
      )
    }
    throw initializationError
  }
  return {
    server,
    ...prepared,
    recovery,
  }
}

/** Require application recovery for callers that cannot operate partially.
 * A rejected recovery never leaks the listener that was published first. */
export async function requireRecoveredServerRuntime<
  T extends { server: ReturnType<typeof Server.listenPrepared>; recovery: Promise<void> },
>(runtime: T): Promise<T> {
  try {
    await runtime.recovery
    return runtime
  } catch (error) {
    try {
      await runtime.server.stop(true)
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Application recovery and listener cleanup failed")
    }
    throw error
  }
}

/** Settle runtime owners before joining application recovery.
 * Long recovery work is itself owned by Session/Task/Instance settlement; the
 * cancellation request inside Server settlement is what lets that work end. */
export async function settleRecoveringServerRuntime(input: {
  reason: string
  recovery: Promise<void>
  disposeInstances(): Promise<void>
}) {
  const terminated = await Server.settleCurrentProcessExecution(input.reason, {
    disposeInstances: input.disposeInstances,
  })
  await input.recovery.catch(() => undefined)
  return terminated
}
