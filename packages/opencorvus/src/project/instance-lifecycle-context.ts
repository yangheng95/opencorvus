import { Context } from "../util/context"

export interface InstanceLifecycleCapabilities {
  reenter<R>(input: { directory: string; fn: () => R }): Promise<R | undefined>
  registerHealthCheck(label: string, check: () => void): void
  runAsActivity<R>(fn: () => Promise<R>): Promise<R>
  runOutside<R>(fn: () => R): R
}

const storage = Context.create<InstanceLifecycleCapabilities>("instance-lifecycle")

export const InstanceLifecycleContext = {
  use(): InstanceLifecycleCapabilities {
    return storage.use()
  },
}

export function provideInstanceLifecycleContext<R>(capabilities: InstanceLifecycleCapabilities, fn: () => R): R {
  return storage.provide(capabilities, fn)
}
