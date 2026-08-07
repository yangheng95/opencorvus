import { createInstanceState } from "../project/instance-state"
import { ProjectInstanceContext } from "../project/instance-context"
import { InstanceLifecycleContext, type InstanceLifecycleCapabilities } from "../project/instance-lifecycle-context"
import { Log } from "../util/log"
import { SchedulerTaskOwner } from "./task-owner"

export namespace Scheduler {
  const log = Log.create({ service: "scheduler" })

  export type Task = {
    id: string
    interval: number
    runAtStart: boolean
    run: () => Promise<void>
    scope?: "instance" | "global"
  }

  type Timer = ReturnType<typeof setInterval>
  type EntryBase = {
    tasks: Map<string, Task>
    timers: Map<string, Timer>
    active: Map<Promise<void>, string>
    lifecycle: AbortController
    runtime?: InstanceLifecycleCapabilities
    disposal?: Promise<void>
  }
  type Entry = (EntryBase & { scope: "global" }) | (EntryBase & { scope: "instance"; directory: string })

  const createBase = (): EntryBase => {
    const tasks = new Map<string, Task>()
    const timers = new Map<string, Timer>()
    const active = new Map<Promise<void>, string>()
    return { tasks, timers, active, lifecycle: new AbortController() }
  }
  const createGlobal = (): Entry => ({ ...createBase(), scope: "global" })
  const createInstance = (): Entry => ({
    ...createBase(),
    scope: "instance",
    directory: ProjectInstanceContext.use().directory,
    runtime: InstanceLifecycleContext.use(),
  })

  let shared = createGlobal()

  const state = createInstanceState(
    () => createInstance(),
    async (entry) => {
      await disposeEntry(entry)
    },
    "scheduler",
  )

  export function register(task: Task) {
    const scope = task.scope ?? "instance"
    const entry = scope === "global" ? shared : state()
    if (scope === "instance") entry.runtime ??= InstanceLifecycleContext.use()
    if (entry.lifecycle.signal.aborted) {
      throw new Error(`Cannot register scheduled task "${task.id}" while its scheduler scope is disposing`)
    }
    const current = entry.timers.get(task.id)
    if (current && scope === "global") return
    if (current) clearInterval(current)

    entry.tasks.set(task.id, task)
    if (task.runAtStart) {
      if (entry.scope === "instance") void requiredRuntime(entry).runAsActivity(() => start(entry, task))
      else requestStart(entry, task)
    }
    const timer = setInterval(() => {
      requestStart(entry, task)
    }, task.interval)
    timer.unref()
    entry.timers.set(task.id, timer)
  }

  export async function disposeGlobal() {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal("global scheduler disposal")
    const entry = shared
    await disposeEntry(entry)
    if (shared === entry) shared = createGlobal()
  }

  function requestStart(entry: Entry, task: Task) {
    if (entry.lifecycle.signal.aborted) return
    if (entry.tasks.get(task.id) !== task) return
    const request =
      entry.scope === "instance"
        ? requiredRuntime(entry).reenter({ directory: entry.directory, fn: () => start(entry, task) })
        : import("../project/instance").then(({ runOutsideInstanceContext }) =>
            runOutsideInstanceContext(() => start(entry, task)),
          )
    void request.catch((error) => {
      log.error("scheduled task could not acquire its runtime owner", { id: task.id, error })
    })
  }

  function requiredRuntime(entry: Entry): InstanceLifecycleCapabilities {
    if (!entry.runtime) throw new Error(`Scheduler ${entry.scope} runtime capabilities were not registered`)
    return entry.runtime
  }

  function start(entry: Entry, task: Task): Promise<void> {
    if (entry.lifecycle.signal.aborted) return Promise.resolve()
    if (entry.tasks.get(task.id) !== task) return Promise.resolve()
    let begin!: () => void
    const ownershipEstablished = new Promise<void>((resolve) => {
      begin = resolve
    })
    let active!: Promise<void>
    active = SchedulerTaskOwner.provide({ taskID: task.id }, async () => {
      await ownershipEstablished
      await run(task)
    }).finally(() => {
      entry.active.delete(active)
    })
    entry.active.set(active, task.id)
    begin()
    return active
  }

  function disposeEntry(entry: Entry): Promise<void> {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal(`${entry.scope} scheduler disposal`)
    if (entry.disposal) return entry.disposal
    entry.lifecycle.abort()
    entry.disposal = (async () => {
      for (const timer of entry.timers.values()) {
        clearInterval(timer)
      }
      entry.timers.clear()
      const activeTaskIDs = [...entry.active.values()]
      if (activeTaskIDs.length > 0) log.info("waiting for active scheduled tasks", { taskIDs: activeTaskIDs })
      const active = [...entry.active.keys()]
      if (active.length > 0) await Promise.allSettled(active)
      entry.active.clear()
      entry.tasks.clear()
    })()
    return entry.disposal
  }

  async function run(task: Task) {
    log.debug("run", { id: task.id })
    await task.run().catch((error) => {
      log.error("run failed", { id: task.id, error })
    })
  }
}
