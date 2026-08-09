import { Log } from "@/util/log"
import { Context as RuntimeContext } from "../util/context"
import { Project } from "./project"
import { State } from "./state"
import { iife } from "@/util/iife"
import { GlobalBus } from "@/bus/global"
import { Filesystem } from "@/util/filesystem"
import path from "node:path"
import { ProjectRuntimePaths } from "./runtime-paths"
import { ProjectOpenLifecycle } from "./open-lifecycle"
import {
  ProjectInstanceContext,
  provideProjectInstanceContext,
  withoutProjectInstanceContext,
  type InstanceContext as Context,
  type InstanceContextAuthority,
  type InstanceInit,
} from "./instance-context"
import { createInstanceState } from "./instance-state"
import { SchedulerTaskOwner } from "../scheduler/task-owner"
import { lifecycleError } from "./lifecycle-error"
import { provideInstanceLifecycleContext } from "./instance-lifecycle-context"
import { conversationCapabilityInitPreflight } from "@/conversation/capability-transaction"
import { Flag } from "@/flag/flag"

type LockMode = "read" | "write"
type LockRelease = () => void

interface LockWaiter {
  mode: LockMode
  resolve: (release: LockRelease) => void
}

interface RollbackOwner {
  ctx: Context
  primaryError: Error
  cleanupErrors: Error[]
  cleanupAttempt?: Promise<void>
}

interface CacheEntry {
  context: Promise<Context>
  lastAccess: number
  initialized: boolean
  initRuns: Map<InstanceInit, Promise<void>>
  capabilityPreflights: Set<InstanceInit>
  healthChecks: Map<string, () => void>
  activeLeases: Set<Lease>
  failure?: { error: Error }
  rollback?: RollbackOwner
  lock: {
    readers: number
    writer: boolean
    waiters: LockWaiter[]
  }
}

interface Lease {
  key: string
  entry: CacheEntry
  mode: LockMode
  release: LockRelease
  upgrade?: Promise<void>
  preparationTail: Promise<void>
  lifecycleTail: Promise<void>
  activities: Set<Promise<unknown>>
  closedSignal: Promise<void>
  signalClosed: () => void
  owned: boolean
  closing: boolean
  closed: boolean
}

interface LifecycleScope {
  key: string
  lease: Lease
  label: string
  closed: boolean
}

interface ActivityScope {
  lease: Lease
  closed: boolean
}

type StateFactory = <S>(
  init: () => S,
  dispose: ((state: Awaited<S>) => Promise<void>) | undefined,
  label: string,
) => (() => S) & {
  reset(): Promise<void>
  resetAll(): Promise<void>
}

type InstanceApi = {
  provide<R>(input: { directory: string; init?: InstanceInit; fn: () => R }): Promise<R>
  provideProjectIdentity<R>(input: { directory: string; fn: () => R }): Promise<R>
  tryProvideActive<R>(input: { directory: string; fn: () => R }): Promise<R | undefined>
  forEachActive(input: { fn: () => void | Promise<void> }): Promise<void>
  readonly directory: string
  readonly worktree: string
  readonly project: Project.Info
  current(): Context | undefined
  refresh(directory?: string): Promise<Context>
  containsPath(filepath: string): boolean
  state: StateFactory
  dispose(): Promise<void>
  disposeAll(): Promise<void>
  converge(input: { maximumRetained: number }): Promise<InstanceCacheConvergence>
  scheduleConvergence(input: { maximumRetained: number }): void
}

export interface InstanceCacheConvergence {
  maximumRetained: number
  retained: number
  active: number
  disposed: string[]
  failures?: Array<{ directory: string; message: string }>
}

function getOrCreateCacheEntry(directory: string, key: string): CacheEntry {
  const existing = cache.get(key)
  if (existing) return existing
  Log.Default.info("creating instance", { directory })
  const contextPromise = iife(async () => {
    const { project, sandbox } = await ProjectOpenLifecycle.stage("project.from-directory", { directory }, () =>
      Project.fromDirectory(directory),
    )
    const legacy = (
      await Promise.all(
        ProjectRuntimePaths.legacyRuntimeRelativePaths.map(async (relative) => ({
          relative,
          exists: await Filesystem.exists(path.join(project.worktree, ...relative.split("/"))),
        })),
      )
    )
      .filter((candidate) => candidate.exists)
      .map((candidate) => candidate.relative)
    if (legacy.length > 0) {
      throw new Error(
        `Legacy OpenCorvus runtime paths exist under ${project.worktree}: ${legacy.join(", ")}. ` +
          `Move or delete these runtime directories before starting; new task/session state lives under ${ProjectRuntimePaths.relativeRuntimeRoot()}.`,
      )
    }
    return refreshedContext(directory, { project, sandbox })
  }).catch((error) => {
    throw lifecycleError(error, `Instance project discovery for ${directory}`)
  })
  const created = createCacheEntry(contextPromise)
  void contextPromise.catch(() => {
    if (cache.get(key) === created) cache.delete(key)
  })
  cache.set(key, created)
  return created
}

const leaseContext = RuntimeContext.create<Lease>("instance-lease")
const lifecycleContext = RuntimeContext.create<LifecycleScope>("instance-lifecycle")
const activityContext = RuntimeContext.create<ActivityScope>("instance-activity")
const cache = new Map<string, CacheEntry>()
let accessSequence = 0
let convergenceTail = Promise.resolve()
let convergenceRequested = false
let scheduledMaximumRetained = 1
let scheduledConvergence: Promise<void> | undefined
const pendingEvictions = new Set<CacheEntry>()

const disposal = {
  all: undefined as Promise<void> | undefined,
}

function instanceCacheKey(directory: string) {
  return process.platform === "win32" ? directory.toLowerCase() : directory
}

function createCacheEntry(contextPromise: Promise<Context>): CacheEntry {
  return {
    context: contextPromise,
    lastAccess: ++accessSequence,
    initialized: false,
    initRuns: new Map(),
    capabilityPreflights: new Set(),
    healthChecks: new Map(),
    activeLeases: new Set(),
    lock: {
      readers: 0,
      writer: false,
      waiters: [],
    },
  }
}

function pumpLock(entry: CacheEntry) {
  const lock = entry.lock
  if (lock.writer) return

  const grant = (waiter: LockWaiter) => {
    let released = false
    if (waiter.mode === "write") lock.writer = true
    else lock.readers++
    waiter.resolve(() => {
      if (released) throw new Error("Instance cache lease released more than once")
      released = true
      if (waiter.mode === "write") lock.writer = false
      else lock.readers--
      pumpLock(entry)
    })
  }

  if (lock.readers > 0) {
    while (lock.waiters[0]?.mode === "read") grant(lock.waiters.shift()!)
    return
  }

  const first = lock.waiters.shift()
  if (!first) return
  grant(first)
  if (first.mode === "read") {
    while (lock.waiters[0]?.mode === "read") grant(lock.waiters.shift()!)
  }
}

function acquireLock(entry: CacheEntry, mode: LockMode): Promise<LockRelease> {
  return new Promise((resolve) => {
    entry.lock.waiters.push({ mode, resolve })
    pumpLock(entry)
  })
}

function acquireUpgradeLock(entry: CacheEntry): Promise<LockRelease> {
  return new Promise((resolve) => {
    entry.lock.waiters.unshift({ mode: "write", resolve })
  })
}

function tryAcquireIdleWriteLock(entry: CacheEntry): LockRelease | undefined {
  const lock = entry.lock
  if (lock.writer || lock.readers > 0 || lock.waiters.length > 0 || entry.activeLeases.size > 0) return undefined
  let released = false
  lock.writer = true
  return () => {
    if (released) throw new Error("Instance idle write lock released more than once")
    released = true
    lock.writer = false
    pumpLock(entry)
  }
}

function createLease(key: string, entry: CacheEntry, mode: LockMode, release: LockRelease): Lease {
  let signalClosed!: () => void
  const closedSignal = new Promise<void>((resolve) => {
    signalClosed = resolve
  })
  const lease: Lease = {
    key,
    entry,
    mode,
    release,
    preparationTail: Promise.resolve(),
    lifecycleTail: Promise.resolve(),
    activities: new Set(),
    closedSignal,
    signalClosed,
    owned: true,
    closing: false,
    closed: false,
  }
  entry.activeLeases.add(lease)
  return lease
}

async function closeLease(lease: Lease) {
  if (lease.closing || lease.closed) throw new Error(`Instance cache lease closed more than once: ${lease.key}`)
  lease.closing = true
  try {
    for (;;) {
      const lifecycleTail = lease.lifecycleTail
      await lifecycleTail
      const activities = [...lease.activities]
      if (activities.length > 0) await Promise.allSettled(activities)
      if (lifecycleTail === lease.lifecycleTail && lease.activities.size === 0) break
    }
  } finally {
    lease.closed = true
    lease.owned = false
    lease.release()
    lease.entry.activeLeases.delete(lease)
    lease.signalClosed()
  }
}

async function upgradeLease(lease: Lease) {
  if (lease.mode === "write") return
  if (lease.closed) throw new Error(`Cannot upgrade a closed instance cache lease: ${lease.key}`)
  if (lease.closing) {
    const active = lifecycleContext.tryUse()
    if (active?.lease !== lease || active.closed) {
      throw new Error(`Cannot upgrade a closing instance cache lease: ${lease.key}`)
    }
  }
  if (lease.upgrade) return await lease.upgrade
  const attempt = (async () => {
    const acquired = acquireUpgradeLock(lease.entry)
    lease.owned = false
    lease.release()
    const release = await acquired
    lease.mode = "write"
    lease.release = release
    lease.owned = true
  })()
  lease.upgrade = attempt
  try {
    await attempt
  } finally {
    if (lease.upgrade === attempt) lease.upgrade = undefined
  }
}

async function downgradeLease(lease: Lease) {
  if (lease.mode === "read") return
  if (lease.closed) throw new Error(`Cannot downgrade a closed instance cache lease: ${lease.key}`)
  if (!lease.owned) throw new Error(`Cannot downgrade an unowned instance cache lease: ${lease.key}`)
  const acquired = acquireLock(lease.entry, "read")
  lease.owned = false
  lease.release()
  const release = await acquired
  lease.mode = "read"
  lease.release = release
  lease.owned = true
}

async function runLeaseLifecycle<T>(lease: Lease, label: string, run: () => Promise<T>): Promise<T> {
  if (lease.closed) throw new Error(`Cannot start ${label} on a closed instance cache lease: ${lease.key}`)
  if (lease.closing) {
    const activity = activityContext.tryUse()
    if (activity?.lease !== lease || activity.closed) {
      throw new Error(`Cannot start ${label} on a closing instance cache lease: ${lease.key}`)
    }
  }
  const active = lifecycleContext.tryUse()
  if (active?.key === lease.key && !active.closed) {
    throw new Error(`Cannot start ${label} recursively while ${active.label} is active for ${lease.key}`)
  }
  const previous = lease.lifecycleTail
  let finish!: () => void
  const turn = new Promise<void>((resolve) => {
    finish = resolve
  })
  lease.lifecycleTail = previous.then(() => turn)
  await previous
  const scope: LifecycleScope = { key: lease.key, lease, label, closed: false }
  try {
    return await lifecycleContext.provide(scope, run)
  } finally {
    scope.closed = true
    finish()
  }
}

async function runLeaseTrackedOperation<T>(lease: Lease, label: string, run: () => Promise<T>): Promise<T> {
  if (lease.closed) throw new Error(`Cannot start ${label} on a closed instance cache lease: ${lease.key}`)
  if (lease.closing) {
    const activity = activityContext.tryUse()
    if (activity?.lease !== lease || activity.closed) {
      throw new Error(`Cannot start ${label} on a closing instance cache lease: ${lease.key}`)
    }
  }
  const previous = lease.lifecycleTail
  let finish!: () => void
  const turn = new Promise<void>((resolve) => {
    finish = resolve
  })
  lease.lifecycleTail = previous.then(() => turn)
  await previous
  try {
    return await run()
  } finally {
    finish()
  }
}

async function runLeasePreparation<T>(lease: Lease, run: () => Promise<T>): Promise<T> {
  const previous = lease.preparationTail
  let finish!: () => void
  const turn = new Promise<void>((resolve) => {
    finish = resolve
  })
  lease.preparationTail = previous.then(() => turn)
  await previous
  try {
    return await run()
  } finally {
    finish()
  }
}

function assertInheritedLeaseOpen(lease: Lease | undefined, operation: string) {
  if (!lease) return
  if (lease.closed) throw new Error(`Cannot ${operation} through a closed instance cache lease: ${lease.key}`)
  if (!lease.owned) {
    throw new Error(`Cannot ${operation} while its instance cache lease is waiting for lock ownership: ${lease.key}`)
  }
  if (!lease.closing) return
  const active = lifecycleContext.tryUse()
  if (active?.lease === lease && !active.closed) return
  const activity = activityContext.tryUse()
  if (activity?.lease === lease && !activity.closed) return
  throw new Error(`Cannot ${operation} through a closing instance cache lease: ${lease.key}`)
}

function assertSameKeyReentryAllowed(lease: Lease, operation: string) {
  if (lease.closed) throw new Error(`Cannot ${operation} through a closed instance cache lease: ${lease.key}`)
  if (!lease.closing) return
  const active = lifecycleContext.tryUse()
  if (active?.lease === lease && !active.closed) return
  const activity = activityContext.tryUse()
  if (activity?.lease === lease && !activity.closed) return
  throw new Error(`Cannot ${operation} through a closing instance cache lease: ${lease.key}`)
}

function assertNoRecursiveLifecycle(key: string, operation: string) {
  const active = lifecycleContext.tryUse()
  if (active?.key === key && !active.closed) {
    throw new Error(`Cannot ${operation} recursively while ${active.label} is active for ${key}`)
  }
}

function leaseAuthority(lease: Lease, options: { allowRollback: boolean }): InstanceContextAuthority {
  return {
    assertActive() {
      assertInheritedLeaseOpen(lease, "access instance context")
      if (cache.get(lease.key) !== lease.entry) {
        throw new Error(`Cannot access instance context after its cache owner was released: ${lease.key}`)
      }
      if (lease.entry.rollback && !options.allowRollback) {
        throw new Error(`Cannot access instance context while rollback cleanup is retained: ${lease.key}`)
      }
    },
  }
}

function provideLeaseContext<R>(
  lease: Lease,
  ctx: Context,
  fn: () => R,
  options: { allowRollback: boolean } = { allowRollback: false },
): R {
  return provideInstanceLifecycleContext(
    {
      reenter: reenterActiveInstance,
      registerHealthCheck: registerInstanceHealthCheck,
      runAsActivity: runAsInstanceActivity,
      runOutside: runOutsideInstanceContext,
    },
    () => provideProjectInstanceContext(ctx, leaseAuthority(lease, options), fn),
  )
}

function assertEntryCurrent(key: string, entry: CacheEntry) {
  if (cache.get(key) !== entry) {
    if (entry.failure) throw entry.failure.error
    throw new Error(`Instance cache entry changed while acquiring its lifecycle lease: ${key}`)
  }
}

function assertNotDisposing() {
  if (disposal.all) throw new Error("Cannot enter an instance while global instance disposal is in progress")
}

function assertContextHealthy(entry: CacheEntry) {
  for (const [label, check] of entry.healthChecks) {
    try {
      check()
    } catch (error) {
      throw lifecycleError(error, `Instance health check ${label}`)
    }
  }
}

function initializers(entry: CacheEntry, extra?: InstanceInit) {
  const result = [...entry.initRuns.keys()]
  if (extra && !entry.initRuns.has(extra)) result.push(extra)
  return result
}

function flattenErrors(errors: readonly unknown[]): Error[] {
  const result: Error[] = []
  for (const error of errors) {
    const values =
      error instanceof AggregateError
        ? flattenErrors(Array.from(error.errors))
        : [lifecycleError(error, "Instance rollback")]
    for (const value of values) if (!result.includes(value)) result.push(value)
  }
  return result
}

function rollbackError(owner: RollbackOwner): Error {
  const errors = flattenErrors([owner.primaryError, ...owner.cleanupErrors])
  if (errors.length === 1) return errors[0]
  return new AggregateError(errors, `Instance bootstrap and rollback failed for ${owner.ctx.directory}`)
}

function retainRollbackOwner(entry: CacheEntry, ctx: Context, primaryError: unknown): RollbackOwner {
  const failure = lifecycleError(primaryError, `Instance lifecycle for ${ctx.directory}`)
  const owner: RollbackOwner = { ctx, primaryError: failure, cleanupErrors: [] }
  entry.failure = { error: failure }
  entry.rollback = owner
  return owner
}

function claimEntryFailure(entry: CacheEntry) {
  const failure = entry.failure
  entry.failure = undefined
  return failure
}

function markEntryFailureReported(entry: CacheEntry, reported: unknown) {
  if (entry.failure?.error === reported) entry.failure = undefined
}

async function retryRollbackCleanup(
  key: string,
  entry: CacheEntry,
  lease: Lease,
  owner = entry.rollback,
): Promise<void> {
  SchedulerTaskOwner.assertCanStartLifecycleDisposal("instance rollback cleanup")
  if (!owner || entry.rollback !== owner) return
  if (owner.cleanupAttempt) return await owner.cleanupAttempt
  const attempt = Promise.resolve()
    .then(() =>
      provideLeaseContext(lease, owner.ctx, () => State.dispose(owner.ctx.directory), { allowRollback: true }),
    )
    .then(() => {
      if (entry.rollback === owner) entry.rollback = undefined
      if (cache.get(key) === entry) cache.delete(key)
    })
    .catch((error) => {
      const cleanupError = lifecycleError(error, `Instance rollback cleanup for ${owner.ctx.directory}`)
      if (!owner.cleanupErrors.includes(cleanupError)) owner.cleanupErrors.push(cleanupError)
      const failure = rollbackError(owner)
      entry.failure = { error: failure }
      throw failure
    })
    .finally(() => {
      if (owner.cleanupAttempt === attempt) owner.cleanupAttempt = undefined
    })
  owner.cleanupAttempt = attempt
  return await attempt
}

async function rollbackContextTransaction(
  key: string,
  entry: CacheEntry,
  lease: Lease,
  ctx: Context,
  error: unknown,
): Promise<never> {
  const owner = retainRollbackOwner(entry, ctx, error)
  if (SchedulerTaskOwner.isActive()) throw owner.primaryError
  await retryRollbackCleanup(key, entry, lease, owner)
  throw owner.primaryError
}

async function prepareContextExclusive(
  key: string,
  entry: CacheEntry,
  lease: Lease,
  init?: InstanceInit,
): Promise<Context> {
  await upgradeLease(lease)
  assertEntryCurrent(key, entry)
  if (entry.rollback) throw rollbackError(entry.rollback)
  const current = await entry.context
  if (entry.initialized) assertContextHealthy(entry)

  if (!entry.initialized) {
    try {
      await provideLeaseContext(lease, current, () => bootstrapContext(current, entry, init ? [init] : []))
      entry.initialized = true
      return current
    } catch (error) {
      return await rollbackContextTransaction(key, entry, lease, current, error)
    }
  }

  if (needsProjectRefresh(current)) {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal("instance refresh")
    const next = await Project.fromDirectory(current.directory)
    const refreshInitializers = initializers(entry, init)
    try {
      await provideLeaseContext(lease, current, () => State.dispose(current.directory))
    } catch (error) {
      const owner = retainRollbackOwner(entry, current, error)
      throw owner.primaryError
    }
    entry.initRuns = new Map()
    entry.capabilityPreflights = new Set()
    entry.healthChecks = new Map()
    applyContext(current, next)
    try {
      await provideLeaseContext(lease, current, () => bootstrapContext(current, entry, refreshInitializers))
      return current
    } catch (error) {
      return await rollbackContextTransaction(key, entry, lease, current, error)
    }
  }

  if (!init || entry.initRuns.has(init)) return current
  try {
    await provideLeaseContext(lease, current, () => runContextInit(entry, init))
    return current
  } catch (error) {
    return await rollbackContextTransaction(key, entry, lease, current, error)
  }
}

async function prepareContext(key: string, entry: CacheEntry, lease: Lease, init?: InstanceInit): Promise<Context> {
  const current = await entry.context
  if (entry.rollback) throw rollbackError(entry.rollback)
  if (entry.initialized) assertContextHealthy(entry)
  if (entry.initialized && !needsProjectRefresh(current) && (!init || entry.initRuns.has(init))) return current
  const prepare = () =>
    runLeaseLifecycle(lease, "instance context preparation", () => prepareContextExclusive(key, entry, lease, init))
  return await prepare()
}

async function prepareCapabilityPreflight(key: string, entry: CacheEntry, init: InstanceInit) {
  const preflight = conversationCapabilityInitPreflight(init)
  if (!preflight || entry.capabilityPreflights.has(init)) return
  const { withSkillCatalogReferenceRead } = await import("@/skill/reference-lock")
  const { withConversationCapabilityReferenceRead } = await import("@/conversation/capability-transaction")
  const release = await acquireLock(entry, "write")
  const lease = createLease(key, entry, "write", release)
  try {
    assertEntryCurrent(key, entry)
    const current = await entry.context
    if (entry.rollback) throw rollbackError(entry.rollback)
    await withSkillCatalogReferenceRead(() =>
      withConversationCapabilityReferenceRead(async () => {
        if (entry.capabilityPreflights.has(init)) return
        await leaseContext.provide(lease, () =>
          provideLeaseContext(lease, current, () =>
            runLeaseLifecycle(lease, "instance capability preflight", () => preflight()),
          ),
        )
        entry.capabilityPreflights.add(init)
      }),
    )
  } finally {
    await closeLease(lease)
  }
}

async function prepareInheritedCapabilityPreflight(
  key: string,
  entry: CacheEntry,
  lease: Lease,
  init: InstanceInit,
) {
  if (!conversationCapabilityInitPreflight(init)) return
  if (entry.capabilityPreflights.has(init)) {
    await lease.lifecycleTail
    return
  }
  await runLeaseTrackedOperation(lease, "inherited instance capability preflight", async () => {
    if (entry.capabilityPreflights.has(init)) return
    const inheritedMode = lease.mode
    lease.owned = false
    lease.release()
    try {
      await prepareCapabilityPreflight(key, entry, init)
    } finally {
      const release = await acquireLock(entry, inheritedMode)
      lease.mode = inheritedMode
      lease.release = release
      lease.owned = true
    }
  })
}

function needsProjectRefresh(ctx: Context) {
  const hasGit = Project.isGitRepo(ctx.directory)
  return hasGit !== ctx.git || ((ctx.project.id === "global" || ctx.worktree === "/") && hasGit)
}

async function bootstrapContext(ctx: Context, entry: CacheEntry, inits: readonly InstanceInit[]) {
  const lifecycleContext = { directory: ctx.directory, worktree: ctx.worktree, projectID: ctx.project.id }
  // .gitignore upkeep runs inside the established project context because
  // ensureGitignore reads the current project directory from that context.
  const { ensureGitignore } = await import("@/engine/git")
  await ProjectOpenLifecycle.stage("engine.git.ensure-gitignore", lifecycleContext, () => ensureGitignore())
  const { ExpertSquadRegistry } = await import("@/expert-squad/registry")
  await ProjectOpenLifecycle.stage("expert-squad.discover", lifecycleContext, async () => {
    const result = await ExpertSquadRegistry.discoverAvailable(ctx.project.worktree)
    for (const issue of result.issues) {
      Log.Default.error("expert squad package quarantined during project open", {
        ...lifecycleContext,
        ...issue,
      })
    }
  })
  const { AttachmentStore } = await import("@/storage/attachment-store")
  try {
    await ProjectOpenLifecycle.stage("attachment-store.sweep", lifecycleContext, () =>
      AttachmentStore.sweep(ctx.project.id),
    )
  } catch (error) {
    if (!(error instanceof AttachmentStore.AuthorityError)) throw error
    Log.Default.warn("attachment store authority isolated from project runtime", {
      ...lifecycleContext,
      error: error.message,
    })
  }
  await ProjectOpenLifecycle.stage("instance.init", lifecycleContext, async () => {
    for (const init of inits) await runContextInit(entry, init)
  })
}

function refreshedContext(directory: string, next: Awaited<ReturnType<typeof Project.fromDirectory>>): Context {
  return {
    directory,
    worktree: next.sandbox,
    project: next.project,
    git: Project.isGitRepo(next.project.worktree),
  }
}

function applyContext(current: Context, next: Awaited<ReturnType<typeof Project.fromDirectory>>) {
  current.worktree = next.sandbox
  current.project = next.project
  current.git = Project.isGitRepo(next.project.worktree)
}

async function runContextInit(entry: CacheEntry, init?: InstanceInit) {
  if (!init) return
  const current = entry.initRuns.get(init)
  if (current) return current
  const run = Promise.resolve()
    .then(init)
    .then(() => undefined)
    .catch((error) => {
      if (entry.initRuns.get(init) === run) entry.initRuns.delete(init)
      throw lifecycleError(error, "Instance initializer")
    })
  entry.initRuns.set(init, run)
  await run
}

async function disposeEntry(key: string, entry: CacheEntry, ctx: Context) {
  Log.Default.info("disposing instance", { directory: ctx.directory })
  try {
    await State.dispose(ctx.directory)
  } catch (error) {
    const owner = retainRollbackOwner(entry, ctx, error)
    throw owner.primaryError
  }
  if (cache.get(key) === entry) cache.delete(key)
  GlobalBus.emit("event", {
    directory: ctx.directory,
    payload: {
      type: "server.instance.disposed",
      properties: {
        directory: ctx.directory,
      },
    },
  })
}

export function runOutsideInstanceContext<R>(fn: () => R): R {
  return leaseContext.without(() =>
    lifecycleContext.without(() => activityContext.without(() => withoutProjectInstanceContext(fn))),
  )
}

export function registerInstanceHealthCheck(label: string, check: () => void): void {
  ProjectInstanceContext.use()
  const lease = leaseContext.use()
  if (lease.entry.healthChecks.has(label)) {
    throw new Error(`Instance health check is already registered: ${label}`)
  }
  lease.entry.healthChecks.set(label, check)
}

export function runAsInstanceActivity<R>(fn: () => Promise<R>): Promise<R> {
  const lease = leaseContext.use()
  assertInheritedLeaseOpen(lease, "start an instance activity")
  return startLeaseActivity(lease, fn)
}

function startLeaseActivity<R>(lease: Lease, fn: () => Promise<R>): Promise<R> {
  const scope: ActivityScope = { lease, closed: false }
  let started!: Promise<R>
  lifecycleContext.without(() =>
    activityContext.provide(scope, () => {
      try {
        started = Promise.resolve(fn())
      } catch (error) {
        started = Promise.reject(error)
      }
    }),
  )
  let activity!: Promise<R>
  activity = started.finally(() => {
    scope.closed = true
    lease.activities.delete(activity)
  })
  lease.activities.add(activity)
  return activity
}

export function reenterActiveInstance<R>(input: { directory: string; fn: () => R }): Promise<R | undefined> {
  return runOutsideInstanceContext(() => Instance.tryProvideActive(input))
}

export const Instance: InstanceApi = {
  async provide<R>(input: { directory: string; init?: InstanceInit; fn: () => R }): Promise<R> {
    assertNotDisposing()
    // Normalize project directories once so cache keys and boundary checks stay stable.
    const directory = Filesystem.resolve(input.directory)
    const key = instanceCacheKey(directory)
    const inheritedLease = leaseContext.tryUse()
    assertNoRecursiveLifecycle(key, "provide an instance")
    if (inheritedLease?.key === key) {
      // A registered instance activity is part of the lease owner and remains
      // valid while closeLease waits for that activity to settle. Detached
      // fire-and-forget callbacks still fail this assertion because they have
      // neither an active lifecycle nor an active activity scope. A concurrent
      // same-key call may arrive while another inherited preflight has
      // temporarily released the lock, so ownership is checked again only
      // after the tracked lifecycle queue returns it.
      assertSameKeyReentryAllowed(inheritedLease, "provide an instance")
      return await startLeaseActivity(inheritedLease, async () => {
        const ctx = await runLeasePreparation(inheritedLease, async () => {
          const inheritedMode = inheritedLease.mode
          const entry = cache.get(key)
          if (entry !== inheritedLease.entry) {
            throw new Error(`Cannot re-enter replaced instance cache entry: ${key}`)
          }
          if (entry.rollback) throw rollbackError(entry.rollback)
          if (input.init) await prepareInheritedCapabilityPreflight(key, entry, inheritedLease, input.init)
          else await inheritedLease.lifecycleTail
          assertInheritedLeaseOpen(inheritedLease, "prepare an inherited instance")
          const prepared = await prepareContext(key, entry, inheritedLease, input.init)
          if (inheritedMode === "read") await downgradeLease(inheritedLease)
          return prepared
        })
        return await provideLeaseContext(inheritedLease, ctx, async () => input.fn())
      })
    }
    assertInheritedLeaseOpen(inheritedLease, "provide an instance")
    for (;;) {
      const entry = getOrCreateCacheEntry(directory, key)
      entry.lastAccess = ++accessSequence
      // Project discovery is the authority for this exact entry. Await it
      // before capability preflight so a deterministic discovery failure is
      // returned to the caller once. The context promise removes its failed
      // cache entry, and treating that self-removal as a concurrent cache
      // replacement here would otherwise rebuild the same entry forever.
      const initial = await entry.context
      if (input.init) {
        try {
          await prepareCapabilityPreflight(key, entry, input.init)
        } catch (error) {
          if (cache.get(key) !== entry) continue
          throw error
        }
      }
      const release = await acquireLock(entry, "read")
      try {
        assertEntryCurrent(key, entry)
      } catch (error) {
        release()
        if (cache.get(key) !== entry) continue
        throw error
      }
      if (entry.rollback) {
        SchedulerTaskOwner.assertCanStartLifecycleDisposal("instance rollback cleanup")
        release()
        const releaseWrite = await acquireLock(entry, "write")
        const cleanupLease = createLease(key, entry, "write", releaseWrite)
        try {
          assertEntryCurrent(key, entry)
          const owner = entry.rollback
          if (owner) {
            await leaseContext.provide(cleanupLease, () =>
              provideLeaseContext(cleanupLease, owner.ctx, () =>
                runLeaseLifecycle(cleanupLease, "instance rollback cleanup", () =>
                  retryRollbackCleanup(key, entry, cleanupLease, owner),
                ),
              ),
            )
          }
        } finally {
          await closeLease(cleanupLease)
        }
        continue
      }
      const lease = createLease(key, entry, "read", release)
      try {
        return await leaseContext.provide(lease, () =>
          provideLeaseContext(lease, initial, async () => {
            const ctx = await prepareContext(key, entry, lease, input.init)
            await downgradeLease(lease)
            return await provideLeaseContext(lease, ctx, async () => input.fn())
          }),
        )
      } finally {
        await closeLease(lease)
      }
    }
  },
  async provideProjectIdentity<R>(input: { directory: string; fn: () => R }): Promise<R> {
    assertNotDisposing()
    const directory = Filesystem.resolve(input.directory)
    const key = instanceCacheKey(directory)
    const inheritedLease = leaseContext.tryUse()
    assertInheritedLeaseOpen(inheritedLease, "provide project identity")
    assertNoRecursiveLifecycle(key, "provide project identity")
    if (inheritedLease?.key === key) {
      const entry = cache.get(key)
      if (entry !== inheritedLease.entry) throw new Error(`Cannot re-enter replaced instance cache entry: ${key}`)
      if (entry.rollback) throw rollbackError(entry.rollback)
      const ctx = await entry.context
      return await provideLeaseContext(inheritedLease, ctx, async () => input.fn())
    }
    for (;;) {
      const entry = getOrCreateCacheEntry(directory, key)
      entry.lastAccess = ++accessSequence
      const release = await acquireLock(entry, "read")
      if (cache.get(key) !== entry) {
        release()
        continue
      }
      const lease = createLease(key, entry, "read", release)
      try {
        if (entry.rollback) throw rollbackError(entry.rollback)
        const ctx = await entry.context
        return await leaseContext.provide(lease, () => provideLeaseContext(lease, ctx, async () => input.fn()))
      } finally {
        await closeLease(lease)
      }
    }
  },
  async tryProvideActive<R>(input: { directory: string; fn: () => R }): Promise<R | undefined> {
    assertNotDisposing()
    const directory = Filesystem.resolve(input.directory)
    const key = instanceCacheKey(directory)
    const entry = cache.get(key)
    if (!entry) return undefined
    entry.lastAccess = ++accessSequence
    const inheritedLease = leaseContext.tryUse()
    assertInheritedLeaseOpen(inheritedLease, "provide an active instance")
    assertNoRecursiveLifecycle(key, "provide an active instance")
    if (inheritedLease?.key === key) {
      if (inheritedLease.entry !== entry) return undefined
      if (entry.rollback) throw rollbackError(entry.rollback)
      if (!entry.initialized) return undefined
      const ctx = await entry.context
      assertContextHealthy(entry)
      return await input.fn()
    }
    const release = await acquireLock(entry, "read")
    const lease = createLease(key, entry, "read", release)
    try {
      if (cache.get(key) !== entry) return undefined
      if (entry.rollback) throw rollbackError(entry.rollback)
      if (!entry.initialized) return undefined
      const ctx = await entry.context
      if (cache.get(key) !== entry) return undefined
      assertContextHealthy(entry)
      return await leaseContext.provide(lease, () => provideLeaseContext(lease, ctx, async () => input.fn()))
    } finally {
      await closeLease(lease)
    }
  },
  async forEachActive(input: { fn: () => void | Promise<void> }) {
    assertNotDisposing()
    const inheritedLease = leaseContext.tryUse()
    assertInheritedLeaseOpen(inheritedLease, "iterate active instances")
    const entries = [...cache.entries()]
    for (const [key, entry] of entries) {
      if (cache.get(key) !== entry) continue
      if (inheritedLease?.key === key) {
        if (inheritedLease.entry !== entry) continue
        if (entry.rollback) throw rollbackError(entry.rollback)
        if (!entry.initialized) continue
        const ctx = await entry.context
        if (cache.get(key) !== entry) continue
        assertContextHealthy(entry)
        await provideLeaseContext(inheritedLease, ctx, input.fn)
        continue
      }
      const release = await acquireLock(entry, "read")
      const lease = createLease(key, entry, "read", release)
      try {
        if (cache.get(key) !== entry) continue
        if (entry.rollback) throw rollbackError(entry.rollback)
        if (!entry.initialized) continue
        const ctx = await entry.context
        if (cache.get(key) !== entry) continue
        assertContextHealthy(entry)
        await leaseContext.provide(lease, () => provideLeaseContext(lease, ctx, input.fn))
      } finally {
        await closeLease(lease)
      }
    }
  },
  get directory() {
    return ProjectInstanceContext.use().directory
  },
  get worktree() {
    return ProjectInstanceContext.use().worktree
  },
  get project() {
    return ProjectInstanceContext.use().project
  },
  current() {
    return ProjectInstanceContext.tryUse()
  },
  async refresh(directory = Instance.directory) {
    assertNotDisposing()
    assertInheritedLeaseOpen(leaseContext.tryUse(), "refresh an instance")
    const resolved = Filesystem.resolve(directory)
    const key = instanceCacheKey(resolved)
    assertNoRecursiveLifecycle(key, "refresh an instance")
    const entry = cache.get(key)
    if (!entry) throw new Error(`Cannot refresh inactive instance: ${resolved}`)
    const inheritedLease = leaseContext.tryUse()
    let lease: Lease
    let owned = false
    if (inheritedLease?.key === key) {
      if (inheritedLease.entry !== entry) throw new Error(`Cannot refresh replaced instance cache entry: ${key}`)
      lease = inheritedLease
    } else {
      const release = await acquireLock(entry, "write")
      lease = createLease(key, entry, "write", release)
      owned = true
    }
    const run = () =>
      runLeaseLifecycle(lease, "instance refresh", async () => {
        await upgradeLease(lease)
        assertEntryCurrent(key, entry)
        if (entry.rollback) throw rollbackError(entry.rollback)
        const current = await entry.context
        assertContextHealthy(entry)
        if (needsProjectRefresh(current)) {
          SchedulerTaskOwner.assertCanStartLifecycleDisposal("instance refresh")
          return await prepareContextExclusive(key, entry, lease)
        }
        const next = await Project.fromDirectory(current.directory)
        applyContext(current, next)
        return current
      })
    try {
      if (owned) {
        const current = await entry.context
        return await leaseContext.provide(lease, () => provideLeaseContext(lease, current, run))
      }
      return await run()
    } finally {
      if (owned) await closeLease(lease)
    }
  },
  /**
   * Check if a path is within the project boundary.
   * Returns true if path is inside Instance.directory OR Instance.worktree.
   * Paths within the worktree but outside the working directory should not trigger external_directory permission.
   */
  containsPath(filepath: string) {
    if (Filesystem.contains(Instance.directory, filepath)) return true
    return Filesystem.contains(Instance.worktree, filepath)
  },
  state<S>(
    init: () => S,
    dispose: ((state: Awaited<S>) => Promise<void>) | undefined,
    label: string,
  ): State.Accessor<S> {
    return createInstanceState(init, dispose, label)
  },
  async dispose() {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal("instance disposal")
    const inheritedLease = leaseContext.use()
    assertInheritedLeaseOpen(inheritedLease, "dispose an instance")
    const directory = Instance.directory
    const key = instanceCacheKey(directory)
    assertNoRecursiveLifecycle(key, "dispose an instance")
    const entry = cache.get(key)
    if (!entry) throw new Error(`Cannot dispose inactive instance: ${directory}`)
    if (inheritedLease.key !== key || inheritedLease.entry !== entry) {
      throw new Error(`Cannot dispose an instance outside its active cache lease: ${key}`)
    }
    await runLeaseLifecycle(inheritedLease, "instance disposal", async () => {
      await upgradeLease(inheritedLease)
      assertEntryCurrent(key, entry)
      if (entry.rollback) throw rollbackError(entry.rollback)
      const ctx = await entry.context
      await disposeEntry(key, entry, ctx)
    })
  },
  async converge(input) {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal("instance cache convergence")
    if (leaseContext.tryUse()) {
      throw new Error("Cannot converge the instance cache from within an active instance callback")
    }
    const operation = convergenceTail.then(async () => {
      const maximumRetained = Math.max(1, Math.floor(input.maximumRetained))
      const disposed: string[] = []
      const failures: Array<{ directory: string; message: string }> = []
      const candidates = [...cache.entries()].sort(
        ([leftKey, left], [rightKey, right]) => left.lastAccess - right.lastAccess || leftKey.localeCompare(rightKey),
      )
      for (const [key, entry] of candidates) {
        if (cache.size - pendingEvictions.size <= maximumRetained) break
        if (cache.get(key) !== entry || pendingEvictions.has(entry)) continue
        const release = tryAcquireIdleWriteLock(entry)
        if (!release) continue
        pendingEvictions.add(entry)
        const lease = createLease(key, entry, "write", release)
        const directory = entry.rollback?.ctx.directory ?? key
        const disposal = (async () => {
          try {
            if (entry.rollback) {
              await leaseContext.provide(lease, () =>
                provideLeaseContext(lease, entry.rollback!.ctx, () =>
                  runLeaseLifecycle(lease, "instance rollback convergence", () =>
                    retryRollbackCleanup(key, entry, lease),
                  ),
                  { allowRollback: true },
                ),
              )
              return { status: "disposed" as const, directory }
            }
            const ctx = await entry.context
            if (cache.get(key) !== entry) return { status: "replaced" as const, directory }
            await leaseContext.provide(lease, () =>
              provideLeaseContext(lease, ctx, () =>
                runLeaseLifecycle(lease, "instance cache convergence", () => disposeEntry(key, entry, ctx)),
              ),
            )
            return { status: "disposed" as const, directory: ctx.directory }
          } catch (error) {
            return {
              status: "failed" as const,
              directory,
              message: lifecycleError(error, `Instance convergence for ${directory}`).message,
            }
          } finally {
            try {
              await closeLease(lease)
            } finally {
              pendingEvictions.delete(entry)
            }
          }
        })()
        let timeout: ReturnType<typeof setTimeout> | undefined
        const outcome = await Promise.race([
          disposal,
          new Promise<{ status: "timed-out"; directory: string; message: string }>((resolve) => {
            timeout = setTimeout(
              () =>
                resolve({
                  status: "timed-out",
                  directory,
                  message: `Instance convergence for ${directory} did not settle within ${Flag.OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS}ms`,
                }),
              Flag.OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS,
            )
            timeout.unref()
          }),
        ])
        if (timeout) clearTimeout(timeout)
        if (outcome.status === "disposed") disposed.push(outcome.directory)
        if (outcome.status === "failed" || outcome.status === "timed-out") {
          failures.push({ directory: outcome.directory, message: outcome.message })
        }
        if (outcome.status === "timed-out") {
          const scheduled = !!scheduledConvergence
          void disposal.then((settled) =>
            Promise.resolve().then(() => {
              Log.Default.info("delayed Project runtime convergence settled", { directory, outcome: settled })
              if (scheduled) Instance.scheduleConvergence({ maximumRetained: scheduledMaximumRetained })
            }),
          )
        }
      }
      let active = 0
      for (const entry of cache.values()) if (entry.activeLeases.size > 0) active += 1
      return {
        maximumRetained,
        retained: cache.size,
        active,
        disposed,
        ...(failures.length > 0 ? { failures } : {}),
      }
    })
    convergenceTail = operation.then(
      () => undefined,
      () => undefined,
    )
    return await operation
  },
  scheduleConvergence(input) {
    scheduledMaximumRetained = Math.max(1, Math.floor(input.maximumRetained))
    convergenceRequested = true
    if (scheduledConvergence) return
    scheduledConvergence = Promise.resolve()
      .then(async () => {
        while (convergenceRequested) {
          convergenceRequested = false
          const result = await Instance.converge({ maximumRetained: scheduledMaximumRetained })
          if (result.disposed.length > 0 || result.failures?.length) {
            Log.Default.info("converged idle Project runtimes", result)
          }
        }
      })
      .catch((error) => Log.Default.error("scheduled instance cache convergence failed", { error }))
      .finally(() => {
        scheduledConvergence = undefined
        if (convergenceRequested) Instance.scheduleConvergence({ maximumRetained: scheduledMaximumRetained })
      })
  },
  async disposeAll() {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal("global instance disposal")
    if (leaseContext.tryUse()) {
      throw new Error("Cannot dispose all instances from within an active instance callback")
    }
    if (disposal.all) return disposal.all

    disposal.all = iife(async () => {
      Log.Default.info("disposing all instances")
      const entries = [...cache.entries()]
      const { Scheduler } = await import("@/scheduler")
      const errors: unknown[] = []
      for (const [key, entry] of entries) {
        await Promise.all([...entry.activeLeases].map((lease) => lease.closedSignal))
        const release = await acquireLock(entry, "write")
        const lease = createLease(key, entry, "write", release)
        try {
          let ctx: Context | undefined
          let contextError: unknown
          try {
            ctx = await entry.context
          } catch (error) {
            contextError = error
          }
          if (entry.rollback) {
            try {
              const owner = entry.rollback
              await leaseContext.provide(lease, () =>
                provideLeaseContext(lease, owner.ctx, () =>
                  runLeaseLifecycle(lease, "instance rollback disposal", () =>
                    retryRollbackCleanup(key, entry, lease, owner),
                  ),
                ),
              )
            } catch (error) {
              errors.push(error)
              markEntryFailureReported(entry, error)
              continue
            }
            const failure = claimEntryFailure(entry)
            if (failure) errors.push(failure.error)
            if (contextError) errors.push(contextError)
            continue
          }
          if (contextError) {
            errors.push(contextError)
            if (cache.get(key) === entry) cache.delete(key)
            continue
          }
          if (!ctx || cache.get(key) !== entry) {
            const failure = claimEntryFailure(entry)
            if (failure) errors.push(failure.error)
            continue
          }
          await leaseContext.provide(lease, () =>
            provideLeaseContext(lease, ctx!, () =>
              runLeaseLifecycle(lease, "global instance disposal", () => disposeEntry(key, entry, ctx!)),
            ),
          )
        } catch (error) {
          errors.push(error)
          markEntryFailureReported(entry, error)
        } finally {
          await closeLease(lease)
        }
      }
      try {
        await Scheduler.disposeGlobal()
      } catch (error) {
        errors.push(error)
      }
      if (errors.length > 0) throw new AggregateError(errors, "One or more instances failed to dispose")
    }).finally(() => {
      disposal.all = undefined
    })

    return disposal.all
  },
}
