import { InstanceBootstrap } from "../project/bootstrap"
import { Instance } from "../project/instance"
import { Server } from "../server/server"
import {
  RuntimeServerOwnership,
  RuntimeServerOwnershipHandoffPendingError,
  RuntimeServerStartupCleanupPendingError,
} from "../server/runtime-server-ownership"
import { Database } from "../storage/db"

async function acquireInProcessRuntimeOwnership(database: string): Promise<RuntimeServerOwnership.Handle> {
  while (true) {
    try {
      return RuntimeServerOwnership.recoverRetained(database) ?? RuntimeServerOwnership.acquire({ database })
    } catch (error) {
      if (!(error instanceof RuntimeServerStartupCleanupPendingError)) throw error
      await error.complete()
    }
  }
}

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  const database = Database.Path()
  const runtimeOwnership = await acquireInProcessRuntimeOwnership(database)
  let releaseHandoff: ((commit?: boolean) => void | Promise<void>) | undefined
  Server.installInProcessClient()
  const operation = await Promise.allSettled([Instance.provide({ directory, init: InstanceBootstrap, fn: cb })]).then(
    ([result]) => result!,
  )
  let settlementError: unknown
  try {
    const terminated = await Server.settleCurrentProcessExecution("In-process CLI runtime completion", {
      disposeInstances: () => Instance.disposeAll(),
    })
    releaseHandoff = terminated.releaseHandoff
  } catch (error) {
    try {
      if (
        RuntimeServerOwnership.currentOccurrenceID(runtimeOwnership.database) !== runtimeOwnership.owner.occurrenceID
      ) {
        throw new Error(
          `In-process CLI runtime ownership ${runtimeOwnership.owner.occurrenceID} cannot be retained after settlement failure`,
        )
      }
      runtimeOwnership.retainForRecovery()
    } catch (retainError) {
      settlementError = new AggregateError(
        [error, retainError],
        "In-process CLI runtime settlement failed and ownership recovery could not be retained",
      )
    }
    settlementError ??= error
  }
  if (settlementError !== undefined) {
    if (operation.status === "rejected") {
      throw new AggregateError(
        [operation.reason, settlementError],
        "In-process CLI operation and runtime settlement both failed",
      )
    }
    throw settlementError
  }

  const releaseFailures: unknown[] = []
  try {
    await RuntimeServerOwnership.releaseWithRetry(runtimeOwnership, () => releaseHandoff?.(true))
  } catch (releaseError) {
    releaseFailures.push(releaseError)
    if (releaseError instanceof RuntimeServerOwnershipHandoffPendingError) {
      try {
        RuntimeServerOwnership.retainStartupCleanup({
          handle: runtimeOwnership,
          complete: () => releaseError.complete(),
        })
      } catch (cleanupRetentionError) {
        releaseFailures.push(cleanupRetentionError)
      }
    } else if (
      RuntimeServerOwnership.currentOccurrenceID(runtimeOwnership.database) === runtimeOwnership.owner.occurrenceID
    ) {
      let rollbackComplete = false
      let recoveryRetained = false
      try {
        await releaseHandoff?.(false)
        rollbackComplete = true
      } catch (rollbackError) {
        releaseFailures.push(rollbackError)
      }
      try {
        runtimeOwnership.retainForRecovery()
        recoveryRetained = true
      } catch (retainError) {
        releaseFailures.push(retainError)
      }
      if (!rollbackComplete || !recoveryRetained) {
        try {
          RuntimeServerOwnership.retainStartupCleanup({
            handle: runtimeOwnership,
            async complete() {
              if (!rollbackComplete) {
                await releaseHandoff?.(false)
                rollbackComplete = true
              }
              if (!recoveryRetained) {
                runtimeOwnership.retainForRecovery()
                recoveryRetained = true
              }
            },
          })
        } catch (cleanupRetentionError) {
          releaseFailures.push(cleanupRetentionError)
        }
      }
    }
  }

  if (operation.status === "rejected" && releaseFailures.length > 0) {
    throw new AggregateError(
      [operation.reason, ...releaseFailures],
      "In-process CLI operation and runtime ownership release both failed",
    )
  }
  if (releaseFailures.length === 1) throw releaseFailures[0]
  if (releaseFailures.length > 1) {
    throw new AggregateError(releaseFailures, "In-process CLI runtime ownership release and rollback failed")
  }
  if (operation.status === "rejected") throw operation.reason
  return operation.value
}
