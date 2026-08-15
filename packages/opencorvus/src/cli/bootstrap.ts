import { InstanceBootstrap } from "../project/bootstrap"
import { Instance } from "../project/instance"
import { Server } from "../server/server"

export async function bootstrap<T>(directory: string, cb: () => Promise<T>) {
  Server.installInProcessClient()
  const operation = await Promise.allSettled([Instance.provide({ directory, init: InstanceBootstrap, fn: cb })]).then(
    ([result]) => result!,
  )
  let settlementError: unknown
  try {
    const terminated = await Server.settleCurrentProcessExecution("In-process CLI runtime completion", {
      disposeInstances: () => Instance.disposeAll(),
    })
    await Server.releaseRuntimeHandoff(terminated.releaseHandoff)
  } catch (error) {
    settlementError = error
  }
  if (operation.status === "rejected" && settlementError !== undefined) {
    throw new AggregateError(
      [operation.reason, settlementError],
      "In-process CLI operation and runtime settlement both failed",
    )
  }
  if (settlementError !== undefined) throw settlementError
  if (operation.status === "rejected") throw operation.reason
  return operation.value
}
