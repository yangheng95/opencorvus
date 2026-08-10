import { InstanceBootstrap } from "../project/bootstrap"
import { Instance } from "../project/instance"
import { Server } from "../server/server"
import { RuntimeServerOwnership, RuntimeServerOwnershipHandoffPendingError } from "../server/runtime-server-ownership"
import { Database } from "../storage/db"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  const database = Database.Path()
  const runtimeOwnership =
    RuntimeServerOwnership.recoverRetained(database) ?? RuntimeServerOwnership.acquire({ database })
  let releaseHandoff: ((commit?: boolean) => void | Promise<void>) | undefined
  let retainOwnership = false
  try {
    Server.installInProcessClient()
    return await Instance.provide({
      directory,
      init: InstanceBootstrap,
      fn: async () => {
        try {
          return await cb()
        } finally {
          try {
            const terminated = await Server.settleCurrentProcessExecution("In-process CLI runtime completion", {
              disposeInstances: () => Instance.dispose(),
            })
            releaseHandoff = terminated.releaseHandoff
          } catch (error) {
            retainOwnership = true
            try {
              if (
                RuntimeServerOwnership.currentOccurrenceID(runtimeOwnership.database) !==
                runtimeOwnership.owner.occurrenceID
              ) {
                throw new Error(
                  `In-process CLI runtime ownership ${runtimeOwnership.owner.occurrenceID} cannot be retained after settlement failure`,
                )
              }
              runtimeOwnership.retainForRecovery()
            } catch (retainError) {
              throw new AggregateError(
                [error, retainError],
                "In-process CLI runtime settlement failed and ownership recovery could not be retained",
              )
            }
            throw error
          }
        }
      },
    })
  } finally {
    if (!retainOwnership) {
      try {
        await RuntimeServerOwnership.releaseWithRetry(runtimeOwnership, () => releaseHandoff?.(true))
      } catch (error) {
        if (
          !(error instanceof RuntimeServerOwnershipHandoffPendingError) &&
          RuntimeServerOwnership.currentOccurrenceID(runtimeOwnership.database) ===
          runtimeOwnership.owner.occurrenceID
        ) {
          await releaseHandoff?.(false)
          runtimeOwnership.retainForRecovery()
        }
        throw error
      }
    }
  }
}
