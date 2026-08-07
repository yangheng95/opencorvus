import { Context } from "../util/context"

type SchedulerTaskOwnerValue = {
  taskID: string
}

const context = Context.create<SchedulerTaskOwnerValue>("scheduler-task")

export namespace SchedulerTaskOwner {
  export function provide<R>(owner: SchedulerTaskOwnerValue, fn: () => R): R {
    return context.provide(owner, fn)
  }

  export function assertCanStartLifecycleDisposal(operation: string): void {
    const owner = context.tryUse()
    if (!owner) return
    throw new Error(
      `Scheduled task "${owner.taskID}" cannot initiate ${operation} while its scheduler task owner is active`,
    )
  }

  export function isActive(): boolean {
    return context.tryUse() !== undefined
  }
}
