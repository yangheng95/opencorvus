import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import lockfile from "proper-lockfile"

export namespace ExpertSquadInstallLock {
  const leaseBrand: unique symbol = Symbol("opencorvus.expert-squad-install-lease")
  export type Lease = Readonly<{ id: string; [leaseBrand]: true }>
  const activeLeases = new WeakSet<object>()
  const localQueues = new Map<string, Promise<void>>()
  const crossProcessRetry = {
    forever: true,
    factor: 1.2,
    minTimeout: 25,
    maxTimeout: 250,
    randomize: true,
  } as const

  function target(id: string) {
    return path.join(Global.Path.config, "expert-squad-install-locks", id)
  }

  async function withProcessLock<T>(id: string, run: (lease: Lease) => Promise<T>): Promise<T> {
    const lockTarget = target(id)
    await mkdir(path.dirname(lockTarget), { recursive: true })
    const release = await lockfile.lock(lockTarget, { realpath: false, retries: crossProcessRetry })
    const lease = Object.freeze({ id, [leaseBrand]: true }) as Lease
    activeLeases.add(lease)
    try {
      return await run(lease)
    } finally {
      activeLeases.delete(lease)
      await release()
    }
  }

  export async function run<T>(id: string, operation: (lease: Lease) => Promise<T>): Promise<T> {
    const key = Filesystem.normalizePath(id)
    const previous = localQueues.get(key) ?? Promise.resolve()
    let finish!: () => void
    const current = new Promise<void>((resolve) => {
      finish = resolve
    })
    const settledPrevious = previous.then(
      () => undefined,
      () => undefined,
    )
    const tail = settledPrevious.then(() => current)
    localQueues.set(key, tail)
    await settledPrevious
    try {
      return await withProcessLock(id, operation)
    } finally {
      finish()
      if (localQueues.get(key) === tail) localQueues.delete(key)
    }
  }

  export function assertHeld(lease: Lease, id: string) {
    if (!activeLeases.has(lease) || lease.id !== id)
      throw new Error(`Expert squad install lease does not own manifest ID ${id}`)
  }
}
