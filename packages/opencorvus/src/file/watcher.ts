import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { createInstanceState } from "../project/instance-state"
import { ProjectInstanceContext } from "../project/instance-context"
import { Project } from "../project/project"
import { Log } from "../util/log"
import { FileIgnore } from "./ignore"
import { Config } from "../config/config"
import path from "path"
import { lazy } from "@/util/lazy"
import { Flag } from "@/flag/flag"
import { type FSWatcher, watch } from "node:fs"
import { readdir } from "fs/promises"
import { requireRuntimePackage } from "@/runtime/package-require"
import { GlobalBus } from "@/bus/global"
import { InstanceLifecycleContext, type InstanceLifecycleCapabilities } from "@/project/instance-lifecycle-context"

export namespace FileWatcher {
  const log = Log.create({ service: "file.watcher" })

  export const Event = {
    Updated: BusEvent.define(
      "file.watcher.updated",
      z.object({
        file: z.string(),
        event: z.union([z.literal("add"), z.literal("change"), z.literal("unlink")]),
      }),
    ),
    Failed: BusEvent.define(
      "file.watcher.failed",
      z.object({
        error: z.string(),
      }),
    ),
  }

  export type Subscription = {
    unsubscribe: () => void | Promise<void>
    onFailure: (listener: (error: Error) => void) => () => void
    failureReason: () => Error | undefined
  }
  type Subscribe = (dir: string, ignore: string[]) => Promise<Subscription>
  export type SubscriptionController = {
    subscription: Subscription
    fail: (error: unknown) => void
  }
  export type SubscriptionInitialization =
    | { ok: true; subscriptions: Subscription[] }
    | { ok: false; subscriptions: Subscription[]; error: unknown }
  export type SubscriptionGroup = {
    assertInitialized: () => "initialized"
    dispose: () => Promise<void>
  }
  export type PersistentCallbackRunner = (
    directory: string,
    label: string,
    callback: () => Promise<unknown>,
  ) => Promise<void>

  const disposedSubscriptions = new WeakSet<Subscription>()
  const subscriptionDisposals = new WeakMap<Subscription, Promise<void>>()

  const parcel = lazy((): typeof import("@parcel/watcher") => {
    return requireRuntimePackage<typeof import("@parcel/watcher")>("@parcel/watcher")
  })

  function publish(evt: { type: string; path: string }): Promise<unknown> {
    if (evt.type === "create" || evt.type === "add") {
      return Bus.publish(Event.Updated, { file: evt.path, event: "add" })
    }
    if (evt.type === "update" || evt.type === "change") {
      return Bus.publish(Event.Updated, { file: evt.path, event: "change" })
    }
    if (evt.type === "delete" || evt.type === "unlink") {
      return Bus.publish(Event.Updated, { file: evt.path, event: "unlink" })
    }
    return Promise.resolve()
  }

  function normalizeError(error: unknown, message: string) {
    return error instanceof Error
      ? new Error(`${message}: ${error.message}`, { cause: error })
      : new Error(`${message}: ${error}`)
  }

  function thrownError(error: unknown, message: string): Error {
    if (error instanceof Error) return error
    return new Error(`${message}: ${String(error)}`, { cause: error })
  }

  function persistentCallbackRunner(lifecycle: InstanceLifecycleCapabilities): PersistentCallbackRunner {
    return (directory, label, callback) => {
      return (async () => {
        const active = await lifecycle.reenter({
          directory,
          fn: async () => {
            await callback()
            return true
          },
        })
        if (active !== true) throw new Error(`${label} fired after its instance owner was released`)
      })()
        .catch((error) => {
          log.error("persistent file watcher callback failed", { label, error: errorMessage(error) })
        })
    }
  }

  export function createSubscriptionController(unsubscribe: () => void | Promise<void>): SubscriptionController {
    let failure: Error | undefined
    const listeners = new Set<(error: Error) => void>()
    const subscription: Subscription = {
      unsubscribe,
      onFailure(listener) {
        if (failure) {
          listener(failure)
          return () => undefined
        }
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      failureReason: () => failure,
    }
    return {
      subscription,
      fail(error) {
        if (failure) return
        failure = error instanceof Error ? error : new Error(String(error))
        for (const listener of listeners) listener(failure)
      },
    }
  }

  export function createNativeSubscription(watcher: FSWatcher, file: string): Subscription {
    let onRuntimeError!: (error: Error) => void
    const controller = createSubscriptionController(() => closeNativeFileWatcher(watcher, onRuntimeError))
    onRuntimeError = (error) => controller.fail(normalizeError(error, `Native file watcher failed for ${file}`))
    watcher.on("error", onRuntimeError)
    return controller.subscription
  }

  function subscribeFile(
    directory: string,
    file: string,
    runPersistentCallback: PersistentCallbackRunner,
  ): Subscription {
    const watcher = watch(file, { persistent: false }, () => {
      void runPersistentCallback(directory, `Native file watcher callback for ${file}`, () =>
        publish({ type: "change", path: file }),
      )
    })
    return createNativeSubscription(watcher, file)
  }

  function closeNativeFileWatcher(watcher: FSWatcher, runtimeErrorListener: (error: Error) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const releaseCloseListeners = () => {
        watcher.off("close", onClose)
        watcher.off("error", onCloseError)
      }
      const onClose = () => {
        releaseCloseListeners()
        watcher.off("error", runtimeErrorListener)
        resolve()
      }
      const onCloseError = (error: Error) => {
        releaseCloseListeners()
        reject(normalizeError(error, "Native file watcher close failed"))
      }
      watcher.once("close", onClose)
      watcher.once("error", onCloseError)
      try {
        watcher.close()
      } catch (error) {
        releaseCloseListeners()
        reject(thrownError(error, "Native file watcher close failed"))
      }
    })
  }

  function disposeSubscription(subscription: Subscription) {
    if (disposedSubscriptions.has(subscription)) return Promise.resolve()
    const existing = subscriptionDisposals.get(subscription)
    if (existing) return existing

    const operation = Promise.resolve()
      .then(() => subscription.unsubscribe())
      .then(() => {
        disposedSubscriptions.add(subscription)
      })
    subscriptionDisposals.set(subscription, operation)
    const release = () => {
      if (subscriptionDisposals.get(subscription) === operation) subscriptionDisposals.delete(subscription)
    }
    void operation.then(release, release)
    return operation
  }

  export async function disposeSubscriptions(subscriptions: readonly Subscription[]) {
    const results = await Promise.allSettled(subscriptions.map(disposeSubscription))
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [thrownError(result.reason, "File watcher subscription disposal failed")] : [],
    )
    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        `Failed to dispose ${failures.length}/${subscriptions.length} file watcher subscription(s)`,
      )
    }
  }

  export async function initializeSubscriptions(
    initialize: (subscriptions: Subscription[]) => Promise<void>,
  ): Promise<SubscriptionInitialization> {
    const subscriptions: Subscription[] = []
    try {
      await initialize(subscriptions)
      return { ok: true, subscriptions }
    } catch (error) {
      const initializationError = thrownError(error, "File watcher initialization failed")
      try {
        await disposeSubscriptions(subscriptions)
      } catch (disposalError) {
        const disposalErrors = disposalError instanceof AggregateError ? disposalError.errors : [disposalError]
        return {
          ok: false,
          subscriptions,
          error: new AggregateError(
            [initializationError, ...disposalErrors],
            `File watcher initialization failed and ${disposalErrors.length} subscription rollback(s) failed.`,
          ),
        }
      }
      return { ok: false, subscriptions, error: initializationError }
    }
  }

  function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }

  export function createSubscriptionGroup(
    subscriptions: readonly Subscription[],
    onFailure: (error: unknown) => void,
    initialFailure?: { error: unknown },
  ): SubscriptionGroup {
    const detach: Array<() => void> = []
    const initializationError = initialFailure
      ? thrownError(initialFailure.error, "File watcher initialization failed")
      : undefined
    let disposal: Promise<void> | undefined
    let observedRuntimeDisposal: Promise<void> | undefined
    let disposed = false

    const reportRuntimeFailure = (error: unknown) => onFailure(thrownError(error, "File watcher lifecycle failed"))
    const dispose = () => {
      if (disposed) return Promise.resolve()
      if (disposal) return disposal
      const operation = disposeSubscriptions(subscriptions).then(() => {
        disposed = true
        for (const stopListening of detach) stopListening()
      })
      disposal = operation
      const release = () => {
        if (disposal === operation) disposal = undefined
      }
      void operation.then(release, release)
      return operation
    }
    const disposeAfterRuntimeFailure = () => {
      const operation = dispose()
      if (observedRuntimeDisposal === operation) return
      observedRuntimeDisposal = operation
      void operation.then(
        () => {
          if (observedRuntimeDisposal === operation) observedRuntimeDisposal = undefined
        },
        (disposalError) => {
          if (observedRuntimeDisposal === operation) observedRuntimeDisposal = undefined
          reportRuntimeFailure(disposalError)
        },
      )
    }
    const runtimeFailure = (error: Error) => {
      reportRuntimeFailure(error)
      disposeAfterRuntimeFailure()
    }

    for (const subscription of subscriptions) {
      detach.push(subscription.onFailure(runtimeFailure))
    }
    if (initializationError) onFailure(initializationError)

    return {
      assertInitialized() {
        if (initializationError) throw initializationError
        return "initialized"
      },
      dispose,
    }
  }

  export async function subscribeWithParcel(
    watcher: typeof import("@parcel/watcher"),
    dir: string,
    ignore: string[],
    backend: "windows" | "fs-events" | "inotify",
    runPersistentCallback: PersistentCallbackRunner,
  ): Promise<Subscription> {
    let subscription: import("@parcel/watcher").AsyncSubscription | undefined
    const controller = createSubscriptionController(() => {
      if (!subscription) throw new Error(`Parcel watcher subscription ownership was not established for ${dir}`)
      return subscription.unsubscribe()
    })

    // Parcel exposes no cancellation token. Keeping this promise attached to State preserves ownership until it settles.
    const pending = watcher.subscribe(
      dir,
      (err, evts) => {
        if (err) {
          controller.fail(normalizeError(err, `Parcel watcher failed for ${dir}`))
          return
        }
        void runPersistentCallback(dir, `Parcel watcher callback for ${dir}`, () => Promise.all(evts.map(publish)))
      },
      {
        ignore,
        backend,
      },
    )
    try {
      subscription = await pending
    } catch (error) {
      const initializationError = thrownError(error, `Parcel watcher initialization failed for ${dir}`)
      const runtimeError = controller.subscription.failureReason()
      if (!runtimeError) throw initializationError
      throw new AggregateError(
        [initializationError, runtimeError],
        `Parcel watcher initialization and runtime callback failed for ${dir}`,
      )
    }
    return controller.subscription
  }

  export async function resolveGitHeadWatchFile(worktree: string, ignore: readonly string[]) {
    const vcsDir = await Project.localGitDirectory(worktree)
    if (!vcsDir) throw new Error(`Git metadata directory is missing for ${worktree}`)
    if (ignore.includes(".git") || ignore.includes(vcsDir)) return undefined

    const gitDirContents = await readdir(vcsDir)
    if (!gitDirContents.includes("HEAD")) throw new Error(`Git metadata HEAD is missing under ${vcsDir}`)
    return path.join(vcsDir, "HEAD")
  }

  const state = createInstanceState(
    async () => {
      log.info("init")
      const lifecycle = InstanceLifecycleContext.use()
      const runPersistentCallback = persistentCallbackRunner(lifecycle)
      const cfg = await Config.get()
      const backend = (() => {
        if (process.platform === "win32") return "windows"
        if (process.platform === "darwin") return "fs-events"
        if (process.platform === "linux") return "inotify"
        throw new Error(`watcher backend not supported on platform: ${process.platform}`)
      })()

      const parcelWatcher = parcel()
      log.info("watcher backend", { platform: process.platform, backend })

      const cfgIgnores = cfg.watcher?.ignore ?? []
      const projectDirectory = ProjectInstanceContext.use().directory
      const subscribe = (dir: string, ignore: string[]) =>
        subscribeWithParcel(parcelWatcher, dir, ignore, backend, runPersistentCallback)

      const initialized = await initializeSubscriptions(async (subscriptions) => {
        if (Flag.OPENCORVUS_EXPERIMENTAL_FILEWATCHER) {
          subscriptions.push(await subscribe(projectDirectory, [...FileIgnore.PATTERNS, ...cfgIgnores]))
        }

        if (Project.isGitRepo(projectDirectory)) {
          const head = await resolveGitHeadWatchFile(ProjectInstanceContext.use().worktree, cfgIgnores)
          if (head) subscriptions.push(subscribeFile(projectDirectory, head, runPersistentCallback))
        }
      })

      return createSubscriptionGroup(
        initialized.subscriptions,
        (error) => {
          log.error("file watcher lifecycle failed", { error: errorMessage(error) })
          GlobalBus.emit("event", {
            directory: projectDirectory,
            payload: {
              type: Event.Failed.type,
              properties: { error: errorMessage(error) },
            },
          })
        },
        initialized.ok ? undefined : { error: initialized.error },
      )
    },
    async (group) => {
      await group.dispose()
    },
    "file-watcher",
  )

  export async function init() {
    if (Flag.OPENCORVUS_EXPERIMENTAL_DISABLE_FILEWATCHER) {
      return
    }
    const group = await state()
    group.assertInitialized()
  }

  export const TestHooks = {
    persistentCallbackRunner,
  }
}
