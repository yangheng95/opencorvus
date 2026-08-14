import { createInstanceState } from "../project/instance-state"
import { ProjectInstanceContext } from "../project/instance-context"
import { InstanceLifecycleContext, type InstanceLifecycleCapabilities } from "../project/instance-lifecycle-context"
import { Log } from "../util/log"
import { SchedulerTaskOwner } from "./task-owner"

export class SchedulerDisposalInactivityError extends Error {
  override readonly name = "SchedulerDisposalInactivityError"

  constructor(
    public readonly scope: "instance" | "global",
    public readonly taskIDs: readonly string[],
    public readonly inactivityTimeoutMilliseconds: number,
  ) {
    super(
      `${scope} scheduler made no disposal progress for ${inactivityTimeoutMilliseconds}ms; ` +
        `${taskIDs.length} task(s) remain active: ${taskIDs.join(", ")}`,
    )
  }
}

export namespace Scheduler {
  const log = Log.create({ service: "scheduler" })

  export type Task = {
    id: string
    interval: number
    runAtStart: boolean
    run: (signal: AbortSignal) => Promise<void>
    scope?: "instance" | "global"
  }

  type Timer = ReturnType<typeof setInterval>
  type EntryBase = {
    tasks: Map<string, Task>
    timers: Map<string, Timer>
    active: Map<Promise<void>, string>
    activeByTask: Map<string, Promise<void>>
    starting: Map<string, Promise<void>>
    coalesced: Set<string>
    lifecycle: AbortController
    runtime?: InstanceLifecycleCapabilities
    disposal?: Promise<void>
    disposalFailed: boolean
  }
  type Entry = (EntryBase & { scope: "global" }) | (EntryBase & { scope: "instance"; directory: string })

  const createBase = (): EntryBase => {
    const tasks = new Map<string, Task>()
    const timers = new Map<string, Timer>()
    const active = new Map<Promise<void>, string>()
    return {
      tasks,
      timers,
      active,
      activeByTask: new Map(),
      starting: new Map(),
      coalesced: new Set(),
      lifecycle: new AbortController(),
      disposalFailed: false,
    }
  }
  const createGlobal = (): Entry => ({ ...createBase(), scope: "global" })
  const createInstance = (): Entry => ({
    ...createBase(),
    scope: "instance",
    directory: ProjectInstanceContext.use().directory,
    runtime: InstanceLifecycleContext.use(),
  })

  let shared = createGlobal()
  let globalSettlementGate: symbol | undefined

  const state = createInstanceState(
    () => createInstance(),
    async (entry) => {
      await disposeEntry(entry)
    },
    "scheduler",
  )

  export function register(task: Task) {
    const scope = task.scope ?? "instance"
    if (scope === "global" && globalSettlementGate) {
      throw new Error(`Cannot register scheduled task "${task.id}" while the global scheduler is settling`)
    }
    const entry = scope === "global" ? shared : state()
    if (scope === "instance") entry.runtime ??= InstanceLifecycleContext.use()
    if (entry.lifecycle.signal.aborted) {
      throw new Error(`Cannot register scheduled task "${task.id}" while its scheduler scope is disposing`)
    }
    const current = entry.timers.get(task.id)
    if (current && scope === "global") return
    if (current) clearInterval(current)

    install(entry, task, task.runAtStart)
  }

  function install(entry: Entry, task: Task, runAtStart: boolean) {
    entry.tasks.set(task.id, task)
    if (runAtStart) requestStart(entry, task)
    const timer = setInterval(() => {
      requestStart(entry, task)
    }, task.interval)
    timer.unref()
    entry.timers.set(task.id, timer)
  }

  export const DEFAULT_DISPOSAL_INACTIVITY_TIMEOUT_MILLISECONDS = 60_000

  export async function disposeGlobal(options?: { inactivityTimeoutMilliseconds?: number }) {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal("global scheduler disposal")
    const entry = shared
    await disposeEntry(entry, options?.inactivityTimeoutMilliseconds)
    if (shared === entry && !globalSettlementGate) shared = createGlobal()
  }

  export function acquireGlobalSettlementGate(): Disposable & { commit(): void } {
    if (globalSettlementGate) throw new Error("Global scheduler settlement is already in progress")
    const token = Symbol("global-scheduler-settlement")
    const entry = shared
    const registeredTasks = [...entry.tasks.values()]
    let committed = false
    globalSettlementGate = token
    return {
      commit() {
        if (globalSettlementGate !== token) {
          throw new Error("Global scheduler settlement gate is no longer authoritative")
        }
        committed = true
      },
      [Symbol.dispose]() {
        if (globalSettlementGate !== token) return
        const restore = () => {
          if (globalSettlementGate !== token) return
          globalSettlementGate = undefined
          if (shared !== entry || !entry.lifecycle.signal.aborted) return
          shared = createGlobal()
          if (!committed) {
            for (const task of registeredTasks) install(shared, task, false)
          }
        }
        if (entry.disposalFailed && !committed) {
          void entry.disposal!.then(restore).catch((error) => {
            log.error("global scheduler rollback could not reach physical idle", { error })
          })
          return
        }
        restore()
      },
    }
  }

  function requestStart(entry: Entry, task: Task) {
    if (entry.lifecycle.signal.aborted) return
    if (entry.tasks.get(task.id) !== task) return
    if (entry.starting.has(task.id) || entry.activeByTask.has(task.id)) {
      entry.coalesced.add(task.id)
      return
    }
    entry.coalesced.delete(task.id)
    let request!: Promise<void>
    request =
      entry.scope === "instance"
        ? requiredRuntime(entry)
            .reenter({ directory: entry.directory, fn: () => start(entry, task) })
            .then(() => undefined)
        : import("../project/instance").then(({ runOutsideInstanceContext }) =>
            runOutsideInstanceContext(() => start(entry, task)),
          )
    entry.starting.set(task.id, request)
    void request
      .catch((error) => {
        log.error("scheduled task could not acquire its runtime owner", { id: task.id, error })
      })
      .finally(() => {
        if (entry.starting.get(task.id) === request) entry.starting.delete(task.id)
      })
  }

  function requiredRuntime(entry: Entry): InstanceLifecycleCapabilities {
    if (!entry.runtime) throw new Error(`Scheduler ${entry.scope} runtime capabilities were not registered`)
    return entry.runtime
  }

  function start(entry: Entry, task: Task): Promise<void> {
    entry.starting.delete(task.id)
    if (entry.lifecycle.signal.aborted) return Promise.resolve()
    if (entry.tasks.get(task.id) !== task) return Promise.resolve()
    const current = entry.activeByTask.get(task.id)
    if (current) {
      entry.coalesced.add(task.id)
      return current
    }
    let begin!: () => void
    const ownershipEstablished = new Promise<void>((resolve) => {
      begin = resolve
    })
    let active!: Promise<void>
    active = SchedulerTaskOwner.provide({ taskID: task.id }, async () => {
      await ownershipEstablished
      await run(task, entry.lifecycle.signal)
    }).finally(() => {
      entry.active.delete(active)
      if (entry.activeByTask.get(task.id) === active) entry.activeByTask.delete(task.id)
      if (entry.coalesced.delete(task.id) && !entry.lifecycle.signal.aborted && entry.tasks.get(task.id) === task) {
        requestStart(entry, task)
      }
    })
    entry.active.set(active, task.id)
    entry.activeByTask.set(task.id, active)
    begin()
    return active
  }

  function disposeEntry(entry: Entry, inactivityTimeoutMilliseconds = DEFAULT_DISPOSAL_INACTIVITY_TIMEOUT_MILLISECONDS): Promise<void> {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal(`${entry.scope} scheduler disposal`)
    if (!Number.isInteger(inactivityTimeoutMilliseconds) || inactivityTimeoutMilliseconds <= 0) {
      throw new Error(`Invalid scheduler disposal inactivity timeout ${inactivityTimeoutMilliseconds}`)
    }
    if (!entry.disposal) {
      entry.lifecycle.abort(new Error(`${entry.scope} scheduler is disposing`))
      for (const timer of entry.timers.values()) {
        clearInterval(timer)
      }
      entry.timers.clear()
      const acquiringTaskIDs = [...entry.starting.keys()]
      if (acquiringTaskIDs.length > 0) {
        log.info("waiting for scheduled task runtime acquisition", { taskIDs: acquiringTaskIDs })
      }
      const activeTaskIDs = [...entry.active.values()]
      if (activeTaskIDs.length > 0) log.info("waiting for active scheduled tasks", { taskIDs: activeTaskIDs })
      entry.disposal = waitForPhysicalIdle(entry).then(() => {
        entry.active.clear()
        entry.activeByTask.clear()
        entry.starting.clear()
        entry.coalesced.clear()
        entry.disposalFailed = false
      })
    }
    return waitForPhysicalIdle(entry, inactivityTimeoutMilliseconds).catch((error) => {
      entry.disposalFailed = true
      throw error
    })
  }

  async function waitForPhysicalIdle(entry: Entry, inactivityTimeoutMilliseconds?: number): Promise<void> {
    for (;;) {
      const pending = [...entry.starting.values(), ...entry.active.keys()]
      if (pending.length === 0) return
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          ...pending.map((operation) => operation.then(() => undefined, () => undefined)),
          ...(inactivityTimeoutMilliseconds === undefined ? [] : [new Promise<void>((_, reject) => {
            timer = setTimeout(() => {
              const taskIDs = [...new Set([...entry.starting.keys(), ...entry.active.values()])]
              reject(new SchedulerDisposalInactivityError(entry.scope, taskIDs, inactivityTimeoutMilliseconds))
            }, inactivityTimeoutMilliseconds)
          })]),
        ])
      } finally {
        if (timer) clearTimeout(timer)
      }
    }
  }

  async function run(task: Task, signal: AbortSignal) {
    log.debug("run", { id: task.id })
    await task.run(signal).catch((error) => {
      if (signal.aborted && error === signal.reason) return
      log.error("run failed", { id: task.id, error })
    })
  }

  export const TestHooks = {
    disposeCurrent(): Promise<void> {
      return disposeEntry(state())
    },
  }
}
