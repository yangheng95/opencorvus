import { InstanceBootstrap } from "../project/bootstrap"
import { Instance } from "../project/instance"
import { Server } from "../server/server"
import { RuntimeServerOwnership } from "../server/runtime-server-ownership"
import { Database } from "../storage/db"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  const runtimeOwnership = RuntimeServerOwnership.acquire({ database: Database.Path() })
  let releaseHandoff: (() => void) | undefined
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
            const terminated = await Server.settleCurrentProcessExecution("In-process CLI runtime completion")
            releaseHandoff = terminated.releaseHandoff
            await Instance.dispose()
          } catch (error) {
            retainOwnership = true
            throw error
          }
        }
      },
    })
  } finally {
    if (!retainOwnership) {
      try {
        runtimeOwnership.release()
      } finally {
        releaseHandoff?.()
      }
    }
  }
}
