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
import { waitForRuntimeSettlementIdle } from "@/runtime/execution-settlement"
import { AwaitTimeoutError, withTimeout } from "@/util/await-with-timeout"

type TurnRelease = () => void

/** A pending teardown (refresh or dispose) that is draining serving handles.
 *  While registered it gates new admissions, so a continuous admission stream
 *  cannot starve the teardown; ambient (inherited) chains bypass it because
 *  the teardown is waiting on exactly those chains to finish. */
interface TeardownPark {
  settled: Promise<void>
}

interface RollbackOwner {
  ctx: Context
  primaryError: Error
  cleanupErrors: Error[]
  cleanupAttempt?: Promise<void>
}

interface CacheEntry {
  context: Promise<Context>
  identityKnown: Promise<void>
  projectID?: string
  lastAccess: number
  initialized: boolean
  permissionRecoveryStarted: boolean
  initRuns: Map<InstanceInit, Promise<void>>
  capabilityPreflights: Set<InstanceInit>
  healthChecks: Map<string, () => void>
  activeLeases: Set<Lease>
  failure?: { error: Error }
  rollback?: RollbackOwner
  abandoned: boolean
  exclusive: {
    tail: Promise<void>
    depth: number
  }
  teardownParks: Set<TeardownPark>
  servingObservers: Set<() => void>
  /**
   * Abort controllers for instance background work. Teardown cancels these
   * BEFORE draining serving handles: the work holds a serving lease so its
   * context stays valid, and without this cancellation that same lease is
   * what teardown would wait on forever.
   */
  backgroundWork: Set<AbortController>
}

interface Lease {
  key: string
  entry: CacheEntry
  /** Serving handles run caller `fn`s under the shared context and are what
   *  teardown drains. Lifecycle leases (serving=false) exist only for context
   *  provision and settlement snapshots while their owner holds a tail turn. */
  serving: boolean
  /** Set while this serving chain is itself parked inside a teardown drain, so
   *  two ambient teardowns waiting on each other both proceed to the tail. */
  parkedForTeardown: boolean
  preparationTail: Promise<void>
  lifecycleTail: Promise<void>
  activities: Set<Promise<unknown>>
  closedSignal: Promise<void>
  signalClosed: () => void
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
  tryProvideActive<R>(input: {
    directory: string
    fn: () => R
    projectDeletionAdmission?: ProjectDeletionAdmission
  }): Promise<Awaited<R> | undefined>
  forEachActive(input: { fn: () => void | Promise<void> }): Promise<void>
  closeProjectAdmission(input: { projectID: string; directories: string[] }): Promise<ProjectDeletionAdmission>
  disposeProjectEntries(projectID: string, inactivityTimeoutMilliseconds?: number): Promise<void>
  readonly directory: string
  readonly worktree: string
  readonly project: Project.Info
  readonly projectGeneration: string
  current(): Context | undefined
  refresh(directory?: string): Promise<Context>
  containsPath(filepath: string): boolean
  state: StateFactory
  dispose(): Promise<void>
  disposeAll(): Promise<void>
  acquireProcessSettlementGate(): Disposable & { waitForIdle(inactivityTimeoutMilliseconds: number): Promise<void> }
  converge(input: { maximumRetained: number }): Promise<InstanceCacheConvergence>
  scheduleConvergence(input: { maximumRetained: number }): void
}

export interface ProjectDeletionAdmission extends Disposable {
  readonly projectID: string
}

const projectDeletionAdmissionTokens = new WeakMap<ProjectDeletionAdmission, symbol>()

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
  let settleIdentity!: () => void
  const identityKnown = new Promise<void>((resolve) => {
    settleIdentity = resolve
  })
  const blockedProjectIDs = new Set(closedProjectAdmissions.keys())
  let created!: CacheEntry
  const contextPromise = iife(async () => {
    const { project, sandbox, generation } = await ProjectOpenLifecycle.stage(
      "project.from-directory",
      { directory },
      () => Project.fromDirectory(directory, { blockedProjectIDs }),
    )
    created.projectID = project.id
    settleIdentity()
    assertEntryProjectAdmissionOpen(created)
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
    return refreshedContext(directory, { project, sandbox, generation })
  }).catch((error) => {
    settleIdentity()
    throw lifecycleError(error, `Instance project discovery for ${directory}`)
  })
  created = createCacheEntry(contextPromise, identityKnown)
  for (const admission of closedProjectAdmissions.values()) admission.discoveries.set(identityKnown, key)
  void identityKnown.finally(() => {
    for (const admission of closedProjectAdmissions.values()) admission.discoveries.delete(identityKnown)
  })
  void contextPromise.catch(() => {
    if (cache.get(key) === created) cache.delete(key)
  })
  cache.set(key, created)
  return created
}

const leaseContext = RuntimeContext.create<Lease>("instance-lease")
const lifecycleContext = RuntimeContext.create<LifecycleScope>("instance-lifecycle")
const activityContext = RuntimeContext.create<ActivityScope>("instance-activity")
/** The entry whose exclusive tail turn the current async chain holds. Nested
 *  lifecycle work started from inside a turn body (a capability preflight that
 *  provides its instance, an initializer that re-enters) must run directly
 *  instead of queueing behind its own turn. Detached work runs outside this
 *  context and queues normally. */
const entryTurnContext = RuntimeContext.create<CacheEntry>("instance-entry-turn")
const cache = new Map<string, CacheEntry>()
let accessSequence = 0
let convergenceTail = Promise.resolve()
let convergenceRequested = false
let scheduledMaximumRetained = 1
let scheduledConvergence: Promise<void> | undefined
const pendingEvictions = new Set<CacheEntry>()
const pendingEvictionSettlements = new Map<CacheEntry, Promise<void>>()
let beforeConvergenceDisposalForTest:
  | ((input: { directory: string; projectID?: string }) => void | Promise<void>)
  | undefined
const closedProjectAdmissions = new Map<
  string,
  { directories: string[]; token: symbol; discoveries: Map<Promise<void>, string> }
>()

const disposal = {
  all: undefined as Promise<void> | undefined,
}
let processSettlementGate: symbol | undefined

export class InstanceProcessAdmissionClosedError extends Error {
  override readonly name = "InstanceProcessAdmissionClosedError"

  constructor() {
    super("Instance process admission is closed during runtime settlement")
  }
}

export class InstanceSettlementInactivityError extends Error {
  override readonly name = "InstanceSettlementInactivityError"

  constructor(
    readonly labels: string[],
    readonly inactivityTimeoutMilliseconds: number,
  ) {
    super(
      `Instance settlement made no progress for ${inactivityTimeoutMilliseconds}ms; ` +
        `active authorities: ${labels.join(", ") || "unknown"}`,
    )
  }
}

async function awaitSettlementPromise<T>(input: {
  label: string
  settled: Promise<T>
  inactivityTimeoutMilliseconds: number
}): Promise<T> {
  return await withTimeout(input.settled, input.inactivityTimeoutMilliseconds, input.label).catch((error) => {
    if (!(error instanceof AwaitTimeoutError)) throw error
    throw new InstanceSettlementInactivityError([input.label], input.inactivityTimeoutMilliseconds)
  })
}

function instanceCacheKey(directory: string) {
  return process.platform === "win32" ? directory.toLowerCase() : directory
}

function createCacheEntry(contextPromise: Promise<Context>, identityKnown: Promise<void>): CacheEntry {
  return {
    context: contextPromise,
    identityKnown,
    lastAccess: ++accessSequence,
    initialized: false,
    permissionRecoveryStarted: false,
    initRuns: new Map(),
    capabilityPreflights: new Set(),
    healthChecks: new Map(),
    activeLeases: new Set(),
    abandoned: false,
    exclusive: {
      tail: Promise.resolve(),
      depth: 0,
    },
    teardownParks: new Set(),
    servingObservers: new Set(),
    backgroundWork: new Set(),
  }
}

function seedProjectDeletionIdentity(
  directory: string,
  project: Project.Info,
  projectGeneration: string,
): { key: string; entry: CacheEntry } | undefined {
  const resolved = Filesystem.resolve(directory)
  const key = instanceCacheKey(resolved)
  if (cache.has(key)) return undefined
  const context: Context = {
    directory: resolved,
    // Instance.worktree is the exact execution sandbox, while Project.worktree
    // remains the registered repository root. This matches refreshedContext.
    worktree: resolved,
    project,
    projectGeneration,
    git: Project.isGitRepo(project.worktree),
  }
  const entry = createCacheEntry(Promise.resolve(context), Promise.resolve())
  entry.projectID = project.id
  cache.set(key, entry)
  return { key, entry }
}

/**
 * The per-Project exclusive FIFO tail. Every lifecycle mutation — bootstrap,
 * initializer runs, refresh, rollback cleanup, disposal, capability preflight —
 * runs as one queued turn. There are no lock modes and no upgrades, so a wait
 * cycle cannot be constructed: a turn owner never waits on another turn, and
 * serving handles never hold a turn at all.
 */
function acquireEntryTurn(entry: CacheEntry): Promise<TurnRelease> {
  entry.exclusive.depth += 1
  const previous = entry.exclusive.tail
  let finish!: () => void
  const turn = new Promise<void>((resolve) => {
    finish = resolve
  })
  entry.exclusive.tail = previous.then(() => turn)
  return previous.then(() => {
    let released = false
    return () => {
      if (released) throw new Error("Instance exclusive turn released more than once")
      released = true
      entry.exclusive.depth -= 1
      finish()
    }
  })
}

/** True while any serving handle other than `excluding` is open. Chains that
 *  are themselves parked inside a teardown drain do not count: they provably
 *  touch nothing until the tail serializes them, and counting them would let
 *  two ambient teardowns wait on each other forever. */
function otherServingOpen(entry: CacheEntry, excluding?: Lease): boolean {
  for (const lease of entry.activeLeases) {
    if (!lease.serving || lease.closed) continue
    if (lease === excluding || lease.parkedForTeardown) continue
    return true
  }
  return false
}

function notifyServingObservers(entry: CacheEntry) {
  for (const observer of [...entry.servingObservers]) observer()
}

function waitForServingDrain(entry: CacheEntry, excluding?: Lease): Promise<void> {
  if (!otherServingOpen(entry, excluding)) return Promise.resolve()
  return new Promise((resolve) => {
    const observer = () => {
      if (otherServingOpen(entry, excluding)) return
      entry.servingObservers.delete(observer)
      resolve()
    }
    entry.servingObservers.add(observer)
  })
}

function holdsEntryTurn(entry: CacheEntry): boolean {
  return entryTurnContext.tryUse() === entry
}

/** Wait until serving handles other than the ambient `chain` are closed. The
 *  chain is flagged as parked while it waits so two teardowns waiting on each
 *  other's chains both proceed to the tail. */
async function drainOtherServing(entry: CacheEntry, chain: Lease | undefined): Promise<void> {
  while (otherServingOpen(entry, chain)) {
    if (chain) {
      chain.parkedForTeardown = true
      notifyServingObservers(entry)
    }
    try {
      await waitForServingDrain(entry, chain)
    } finally {
      if (chain) chain.parkedForTeardown = false
    }
  }
}

/**
 * Run a teardown-grade operation: acquire a tail turn, and if serving handles
 * other than the ambient `chain` are still open, release the turn, park until
 * they drain, and rejoin the tail. The park is registered for the whole call,
 * so admissions arriving after the teardown began queue behind it instead of
 * starving it, while the excused ambient chain keeps running to completion.
 */
async function runTeardownTurn<T>(entry: CacheEntry, chain: Lease | undefined, fn: () => Promise<T>): Promise<T> {
  cancelInstanceBackgroundWork(entry, "instance teardown")
  if (holdsEntryTurn(entry)) {
    // Already inside this entry's turn: the running turn itself gates
    // admissions, so drain in place and run directly instead of queueing
    // behind our own turn.
    await drainOtherServing(entry, chain)
    return await fn()
  }
  let settlePark!: () => void
  const park: TeardownPark = {
    settled: new Promise<void>((resolve) => {
      settlePark = resolve
    }),
  }
  entry.teardownParks.add(park)
  try {
    for (;;) {
      const release = await acquireEntryTurn(entry)
      if (!otherServingOpen(entry, chain)) {
        try {
          return await entryTurnContext.provide(entry, fn)
        } finally {
          release()
        }
      }
      release()
      await drainOtherServing(entry, chain)
    }
  } finally {
    entry.teardownParks.delete(park)
    settlePark()
  }
}

/** Admissions wait here until no teardown is parked and no tail turn is queued
 *  or running, then re-validate synchronously. Serving is deliberately not a
 *  condition: serving never blocks serving. */
async function waitForLifecycleQuiet(entry: CacheEntry): Promise<void> {
  for (;;) {
    if (entry.teardownParks.size > 0) {
      await Promise.all([...entry.teardownParks].map((park) => park.settled))
      continue
    }
    if (entry.exclusive.depth > 0) {
      await entry.exclusive.tail
      continue
    }
    return
  }
}

function lifecycleQuiet(entry: CacheEntry): boolean {
  return entry.teardownParks.size === 0 && entry.exclusive.depth === 0
}

/** Acquire a tail turn, bounded. Lifecycle disposers own settlement budgets;
 *  when the tail does not free up within the budget the caller gets a named
 *  inactivity error instead of a silent hang. An expired waiter releases its
 *  turn the moment it is granted so the queue keeps moving. */
function acquireEntryTurnWithin(
  entry: CacheEntry,
  label: string,
  inactivityTimeoutMilliseconds: number,
): Promise<TurnRelease> {
  return new Promise((resolve, reject) => {
    let expired = false
    const timer = setTimeout(() => {
      expired = true
      reject(new InstanceSettlementInactivityError([label], inactivityTimeoutMilliseconds))
    }, inactivityTimeoutMilliseconds)
    void acquireEntryTurn(entry).then((release) => {
      if (expired) {
        release()
        return
      }
      clearTimeout(timer)
      resolve(release)
    })
  })
}

/** Claim a tail turn synchronously if this entry is fully idle: no queued or
 *  running turns, no leases, no parked teardown. Cache convergence uses this
 *  to dispose only entries that nobody is touching. */
function tryClaimIdleEntryTurn(entry: CacheEntry): TurnRelease | undefined {
  if (entry.exclusive.depth > 0 || entry.activeLeases.size > 0 || entry.teardownParks.size > 0) return undefined
  entry.exclusive.depth += 1
  let finish!: () => void
  const turn = new Promise<void>((resolve) => {
    finish = resolve
  })
  entry.exclusive.tail = entry.exclusive.tail.then(() => turn)
  let released = false
  return () => {
    if (released) throw new Error("Instance idle exclusive turn released more than once")
    released = true
    entry.exclusive.depth -= 1
    finish()
  }
}

function createLease(key: string, entry: CacheEntry, serving: boolean): Lease {
  let signalClosed!: () => void
  const closedSignal = new Promise<void>((resolve) => {
    signalClosed = resolve
  })
  const lease: Lease = {
    key,
    entry,
    serving,
    parkedForTeardown: false,
    preparationTail: Promise.resolve(),
    lifecycleTail: Promise.resolve(),
    activities: new Set(),
    closedSignal,
    signalClosed,
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
    lease.entry.activeLeases.delete(lease)
    lease.signalClosed()
    notifyServingObservers(lease.entry)
  }
}

function abandonLease(lease: Lease): void {
  if (lease.closed) return
  lease.closing = true
  lease.closed = true
  lease.entry.activeLeases.delete(lease)
  lease.signalClosed()
  notifyServingObservers(lease.entry)
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

function assertNotDisposing(directory?: string) {
  if (disposal.all) throw new Error("Cannot enter an instance while global instance disposal is in progress")
  if (processSettlementGate && !leaseContext.tryUse()) {
    throw new InstanceProcessAdmissionClosedError()
  }
  if (directory) {
    for (const [projectID, admission] of closedProjectAdmissions) {
      if (admission.directories.some((registered) => Filesystem.overlaps(registered, directory))) {
        throw new Error(`Project ${projectID} instance admission is closed during deletion`)
      }
    }
  }
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

function assertProjectAdmissionOpen(key: string, entry: CacheEntry, ctx: Context) {
  if (!closedProjectAdmissions.has(ctx.project.id)) return
  throw new Error(`Project ${ctx.project.id} instance admission is closed during deletion`)
}

function assertEntryProjectAdmissionOpen(entry: CacheEntry) {
  if (!entry.projectID || !closedProjectAdmissions.has(entry.projectID)) return
  throw new Error(`Project ${entry.projectID} instance admission is closed during deletion`)
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

const TEARDOWN_REQUIRED = Symbol("instance-teardown-required")

/** Replace this entry's project context in place: tear down State, apply the
 *  rediscovered project, and re-run every known initializer. Assumes the
 *  exclusive tail turn is held and serving is drained. */
async function refreshContextInTurn(
  key: string,
  entry: CacheEntry,
  lease: Lease,
  init: InstanceInit | undefined,
): Promise<Context> {
  const current = await entry.context
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
    for (const initializer of refreshInitializers) await runCapabilityPreflight(entry, initializer)
    await provideLeaseContext(lease, current, () => bootstrapContext(current, entry, refreshInitializers))
    return current
  } catch (error) {
    return await rollbackContextTransaction(key, entry, lease, current, error)
  }
}

/** Context preparation body. Assumes the exclusive tail turn is held. Returns
 *  TEARDOWN_REQUIRED when a project refresh is due while serving handles
 *  outside the ambient `chain` are still open — the caller must then rejoin
 *  as a teardown turn, which drains serving before re-entering. */
async function prepareContextInTurn(
  key: string,
  entry: CacheEntry,
  lease: Lease,
  init: InstanceInit | undefined,
  chain: Lease | undefined,
): Promise<Context | typeof TEARDOWN_REQUIRED> {
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
    if (otherServingOpen(entry, chain)) return TEARDOWN_REQUIRED
    return await refreshContextInTurn(key, entry, lease, init)
  }

  if (!init || entry.initRuns.has(init)) return current
  try {
    await provideLeaseContext(lease, current, () => runContextInit(entry, init))
    return current
  } catch (error) {
    return await rollbackContextTransaction(key, entry, lease, current, error)
  }
}

async function prepareContextExclusive(
  key: string,
  entry: CacheEntry,
  lease: Lease,
  init: InstanceInit | undefined,
  chain: Lease | undefined,
): Promise<Context> {
  if (holdsEntryTurn(entry)) {
    // Nested lifecycle work inside our own turn body (a capability preflight
    // providing its instance, an initializer re-entering) runs directly —
    // queueing here would wait on the turn this chain already holds.
    for (;;) {
      const outcome = await prepareContextInTurn(key, entry, lease, init, chain)
      if (outcome !== TEARDOWN_REQUIRED) return outcome
      // Draining serving handles waits on background work's lease like any
      // other; cancel it first, as every teardown-grade drain does.
      cancelInstanceBackgroundWork(entry, "instance context refresh")
      await drainOtherServing(entry, chain)
    }
  }
  const release = await acquireEntryTurn(entry)
  let outcome: Context | typeof TEARDOWN_REQUIRED
  try {
    outcome = await entryTurnContext.provide(entry, () => prepareContextInTurn(key, entry, lease, init, chain))
  } finally {
    release()
  }
  if (outcome !== TEARDOWN_REQUIRED) return outcome
  return await runTeardownTurn(entry, chain, async () => {
    const prepared = await prepareContextInTurn(key, entry, lease, init, chain)
    if (prepared === TEARDOWN_REQUIRED) {
      throw new Error(`Instance refresh found open serving handles after draining: ${key}`)
    }
    return prepared
  })
}

/** Whether this entry still owes exclusive context preparation. Single source
 *  for `prepareContext`'s early return and for the admission fast path, so the
 *  two can never disagree about whether a tail turn is required. */
function contextPreparationRequired(entry: CacheEntry, current: Context, init?: InstanceInit): boolean {
  if (entry.rollback) return true
  if (!entry.initialized) return true
  if (needsProjectRefresh(current)) return true
  return Boolean(init) && !entry.initRuns.has(init!)
}

async function prepareContext(
  key: string,
  entry: CacheEntry,
  lease: Lease,
  init: InstanceInit | undefined,
  chain: Lease | undefined,
): Promise<Context> {
  const current = await entry.context
  if (entry.rollback) throw rollbackError(entry.rollback)
  if (entry.initialized) assertContextHealthy(entry)
  if (!contextPreparationRequired(entry, current, init)) return current
  return await runLeaseLifecycle(lease, "instance context preparation", () =>
    prepareContextExclusive(key, entry, lease, init, chain),
  )
}

async function prepareCapabilityPreflight(key: string, entry: CacheEntry, init: InstanceInit) {
  const preflight = conversationCapabilityInitPreflight(init)
  if (!preflight || entry.capabilityPreflights.has(init)) return
  const release = await acquireEntryTurn(entry)
  const lease = createLease(key, entry, false)
  try {
    assertEntryCurrent(key, entry)
    const current = await entry.context
    if (entry.rollback) throw rollbackError(entry.rollback)
    await entryTurnContext.provide(entry, () =>
      leaseContext.provide(lease, () =>
        provideLeaseContext(lease, current, () =>
          runLeaseLifecycle(lease, "instance capability preflight", () => runCapabilityPreflight(entry, init)),
        ),
      ),
    )
  } finally {
    try {
      await closeLease(lease)
    } finally {
      release()
    }
  }
}

async function runCapabilityPreflight(entry: CacheEntry, init: InstanceInit) {
  const preflight = conversationCapabilityInitPreflight(init)
  if (!preflight || entry.capabilityPreflights.has(init)) return
  const { withSkillCatalogReferenceRead } = await import("@/skill/reference-lock")
  const { withConversationCapabilityReferenceRead } = await import("@/conversation/capability-transaction")
  await withSkillCatalogReferenceRead(() =>
    withConversationCapabilityReferenceRead(async () => {
      if (entry.capabilityPreflights.has(init)) return
      await preflight()
      entry.capabilityPreflights.add(init)
    }),
  )
}

async function prepareInheritedCapabilityPreflight(key: string, entry: CacheEntry, lease: Lease, init: InstanceInit) {
  if (!conversationCapabilityInitPreflight(init)) return
  if (entry.capabilityPreflights.has(init)) {
    await lease.lifecycleTail
    return
  }
  // The preflight takes its own tail turn; the inherited serving handle never
  // blocks the tail, so no release-and-reacquire dance is needed.
  await runLeaseTrackedOperation(lease, "inherited instance capability preflight", async () => {
    if (entry.capabilityPreflights.has(init)) return
    await prepareCapabilityPreflight(key, entry, init)
  })
}

function needsProjectRefresh(ctx: Context) {
  const hasGit = Project.isGitRepo(ctx.directory)
  return hasGit !== ctx.git || ((ctx.project.id === "global" || ctx.worktree === "/") && hasGit)
}

async function bootstrapContext(ctx: Context, entry: CacheEntry, inits: readonly InstanceInit[]) {
  const lifecycleContext = { directory: ctx.directory, worktree: ctx.worktree, projectID: ctx.project.id }
  // Project metadata upkeep runs inside the established project context.
  const { ensureGitProjectMetadata } = await import("@/engine/git-project-metadata")
  await ProjectOpenLifecycle.stage("engine.git.ensure-project-metadata", lifecycleContext, () =>
    ensureGitProjectMetadata(),
  )
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
    projectGeneration: next.generation,
    git: Project.isGitRepo(next.project.worktree),
  }
}

function applyContext(current: Context, next: Awaited<ReturnType<typeof Project.fromDirectory>>) {
  current.worktree = next.sandbox
  current.project = next.project
  current.projectGeneration = next.generation
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
  if (entry.abandoned) return
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
    lifecycleContext.without(() =>
      activityContext.without(() => entryTurnContext.without(() => withoutProjectInstanceContext(fn))),
    ),
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

function cancelInstanceBackgroundWork(entry: CacheEntry, reason: string): void {
  for (const controller of [...entry.backgroundWork]) {
    controller.abort(new Error(`Instance background work cancelled: ${reason}`))
  }
}

/**
 * Run work in the background of the current instance, cancelled by teardown.
 *
 * The work runs under its own serving lease, so its context stays valid for
 * exactly as long as it runs — a detached callback loses the context the
 * moment its scheduling scope ends. What makes that lease safe is the
 * cancellation: teardown aborts the work's signal before it drains serving
 * handles, so the work unwinds at its next checkpoint instead of being the
 * lease teardown waits on forever. That pairing is the difference between
 * this and `Instance.provide` from a fire-and-forget callback, which is a
 * deadlock against disposal.
 *
 * The work owns its own durable recovery. A cancelled or failed run is logged
 * and dropped here; whatever durable state the work maintains is what the
 * next trigger resumes from.
 */
export function runInstanceBackgroundWork(label: string, work: (signal: AbortSignal) => Promise<void>): void {
  // Only the instance context is required: schedulers such as a durable Bus
  // delivery replayed from the outbox run with a project identity but no
  // lease of their own, and background work must be schedulable from exactly
  // those places.
  const directory = ProjectInstanceContext.use().directory
  const entry = cache.get(instanceCacheKey(directory))
  if (!entry) {
    throw new Error(`Instance background work has no live instance for ${directory}`)
  }
  const controller = new AbortController()
  entry.backgroundWork.add(controller)
  void runOutsideInstanceContext(() =>
    Instance.provide({
      directory,
      fn: async () => {
        controller.signal.throwIfAborted()
        // The controller guards exactly one entry. If that entry was replaced
        // or deleted between scheduling and admission — a teardown drained
        // and this provide re-created the instance — running here would put
        // uncancellable work on an entry whose teardown already cancelled,
        // which is the deadlock this primitive exists to prevent.
        if (cache.get(instanceCacheKey(directory)) !== entry) {
          throw controller.signal.reason ?? new Error(`Instance background work outlived its instance: ${label}`)
        }
        await work(controller.signal)
      },
    }),
  )
    .catch((error) => {
      if (controller.signal.aborted) return
      Log.Default.warn("instance background work did not complete", {
        label,
        directory,
        error: error instanceof Error ? error.message : String(error),
      })
    })
    .finally(() => {
      entry.backgroundWork.delete(controller)
    })
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

export function reenterActiveInstance<R>(input: { directory: string; fn: () => R }): Promise<Awaited<R> | undefined> {
  return runOutsideInstanceContext(() => Instance.tryProvideActive(input))
}

export const Instance: InstanceApi = {
  acquireProcessSettlementGate(): Disposable & { waitForIdle(inactivityTimeoutMilliseconds: number): Promise<void> } {
    if (processSettlementGate) throw new Error("Instance process settlement is already in progress")
    const token = Symbol("instance-process-settlement")
    processSettlementGate = token
    return {
      async waitForIdle(inactivityTimeoutMilliseconds) {
        if (processSettlementGate !== token) throw new Error("Instance process settlement gate is no longer active")
        await waitForRuntimeSettlementIdle({
          snapshot: () =>
            [...cache.entries()].flatMap(([key, entry]) =>
              [...entry.activeLeases].map((lease) => ({
                label:
                  `instance:${key}:${lease.serving ? "serving" : "exclusive"}:` +
                  `activities=${lease.activities.size}:closing=${String(lease.closing)}`,
                settled: lease.closedSignal,
              })),
            ),
          inactivityTimeoutMilliseconds,
          inactivityError: (labels) => new InstanceSettlementInactivityError(labels, inactivityTimeoutMilliseconds),
        })
      },
      [Symbol.dispose]() {
        if (processSettlementGate !== token) return
        processSettlementGate = undefined
        if (convergenceRequested && !scheduledConvergence) {
          Instance.scheduleConvergence({ maximumRetained: scheduledMaximumRetained })
        }
      },
    }
  },
  async provide<R>(input: { directory: string; init?: InstanceInit; fn: () => R }): Promise<R> {
    // Normalize project directories once so cache keys and boundary checks stay stable.
    const directory = Filesystem.resolve(input.directory)
    assertNotDisposing(directory)
    const key = instanceCacheKey(directory)
    const inheritedLease = leaseContext.tryUse()
    const activeLifecycle = lifecycleContext.tryUse()
    // Work running inside this lease's own lifecycle turn is already in this
    // project's context. Project open's Task-control recovery is such work, and
    // a recovered Orchestrator Turn reaches project-scoped read helpers that
    // re-enter by directory. Sending them through preparation would await the
    // lifecycle tail that settles only when the turn making the call returns,
    // so the guard below refuses them outright — and the Task that was being
    // recovered dies with it. Reuse the ambient context instead, and leave
    // preparation to the turn that owns it. An `init` still goes the long way:
    // asking for initialization is asking for preparation.
    if (
      !input.init &&
      inheritedLease?.key === key &&
      activeLifecycle?.lease === inheritedLease &&
      !activeLifecycle.closed &&
      ProjectInstanceContext.tryUse() !== undefined
    ) {
      assertSameKeyReentryAllowed(inheritedLease, "provide an instance")
      if (cache.get(key) !== inheritedLease.entry) {
        throw new Error(`Cannot re-enter replaced instance cache entry: ${key}`)
      }
      if (inheritedLease.entry.rollback) throw rollbackError(inheritedLease.entry.rollback)
      return await input.fn()
    }
    assertNoRecursiveLifecycle(key, "provide an instance")
    if (inheritedLease?.key === key) {
      // A registered instance activity is part of the lease owner and remains
      // valid while closeLease waits for that activity to settle. Detached
      // fire-and-forget callbacks still fail this assertion because they have
      // neither an active lifecycle nor an active activity scope.
      assertSameKeyReentryAllowed(inheritedLease, "provide an instance")
      return await startLeaseActivity(inheritedLease, async () => {
        const ctx = await runLeasePreparation(inheritedLease, async () => {
          const entry = cache.get(key)
          if (entry !== inheritedLease.entry) {
            throw new Error(`Cannot re-enter replaced instance cache entry: ${key}`)
          }
          if (entry.rollback) throw rollbackError(entry.rollback)
          if (input.init) await prepareInheritedCapabilityPreflight(key, entry, inheritedLease, input.init)
          else await inheritedLease.lifecycleTail
          assertInheritedLeaseOpen(inheritedLease, "prepare an inherited instance")
          // The inherited serving handle is the ambient chain: preparation that
          // must drain serving excuses it, keeping nested provide/refresh live.
          const prepared = await prepareContext(key, entry, inheritedLease, input.init, inheritedLease)
          assertProjectAdmissionOpen(key, entry, prepared)
          return prepared
        })
        return await provideLeaseContext(inheritedLease, ctx, async () => input.fn())
      })
    }
    assertInheritedLeaseOpen(inheritedLease, "provide an instance")
    for (;;) {
      assertNotDisposing(directory)
      const entry = getOrCreateCacheEntry(directory, key)
      entry.lastAccess = ++accessSequence
      // Project discovery is the authority for this exact entry. Await it
      // before capability preflight so a deterministic discovery failure is
      // returned to the caller once. The context promise removes its failed
      // cache entry, and treating that self-removal as a concurrent cache
      // replacement here would otherwise rebuild the same entry forever.
      const initial = await entry.context
      assertProjectAdmissionOpen(key, entry, initial)
      if (input.init) {
        try {
          await prepareCapabilityPreflight(key, entry, input.init)
        } catch (error) {
          if (cache.get(key) !== entry) continue
          throw error
        }
      }
      if (cache.get(key) !== entry) continue
      if (entry.rollback) {
        SchedulerTaskOwner.assertCanStartLifecycleDisposal("instance rollback cleanup")
        const release = await acquireEntryTurn(entry)
        const cleanupLease = createLease(key, entry, false)
        try {
          assertEntryCurrent(key, entry)
          const owner = entry.rollback
          if (owner) {
            await entryTurnContext.provide(entry, () =>
              leaseContext.provide(cleanupLease, () =>
                provideLeaseContext(cleanupLease, owner.ctx, () =>
                  runLeaseLifecycle(cleanupLease, "instance rollback cleanup", () =>
                    retryRollbackCleanup(key, entry, cleanupLease, owner),
                  ),
                ),
              ),
            )
          }
        } finally {
          try {
            await closeLease(cleanupLease)
          } finally {
            release()
          }
        }
        continue
      }
      // Pending teardowns and queued lifecycle turns get the entry to
      // themselves; admissions wait out the quiet period and re-validate.
      if (!lifecycleQuiet(entry)) {
        await waitForLifecycleQuiet(entry)
        continue
      }
      // Every check between here and lease registration is synchronous, so a
      // lifecycle turn cannot interleave — a turn claimed first flips
      // lifecycleQuiet, and a handle registered first is what any later
      // teardown drains. Serving never touches the exclusive tail, so a busy
      // caller `fn` can never block other admissions.
      const needsPreparation = contextPreparationRequired(entry, initial, input.init)
      if (!needsPreparation) assertContextHealthy(entry)
      const lease = createLease(key, entry, !needsPreparation)
      try {
        if (needsPreparation) {
          await leaseContext.provide(lease, () =>
            provideLeaseContext(lease, initial, () => prepareContext(key, entry, lease, input.init, undefined)),
          )
          // Serve on the freshly prepared context instead of re-deriving the
          // preparation predicate: a predicate that stays true (a sandbox
          // directory whose git state can never match its project worktree)
          // must cost one refresh per admission, not an admission that never
          // returns. The checks and the serving flip below are synchronous,
          // so no lifecycle turn can interleave before this handle registers.
          if (!lifecycleQuiet(entry) || cache.get(key) !== entry || entry.rollback) continue
          assertContextHealthy(entry)
          lease.serving = true
        }
        return await leaseContext.provide(lease, () =>
          provideLeaseContext(lease, initial, async () => {
            if (input.init && !entry.permissionRecoveryStarted) {
              const { PermissionAuthority } = await import("@/permission/authority")
              // Continuation recovery converges durable evidence; it is not a
              // precondition for serving this project. Marking the attempt
              // before it runs keeps a deterministic recovery fault from
              // re-running on every later admission, and swallowing it keeps
              // one unrecoverable ledger request from failing every
              // project-scoped route.
              entry.permissionRecoveryStarted = true
              try {
                await PermissionAuthority.resumeApprovedContinuations()
              } catch (error) {
                Log.Default.error("permission continuation recovery failed", {
                  directory: key,
                  error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
                })
              }
            }
            return input.fn()
          }),
        )
      } finally {
        await closeLease(lease)
      }
    }
  },
  async provideProjectIdentity<R>(input: { directory: string; fn: () => R }): Promise<R> {
    const directory = Filesystem.resolve(input.directory)
    assertNotDisposing(directory)
    const key = instanceCacheKey(directory)
    const inheritedLease = leaseContext.tryUse()
    assertInheritedLeaseOpen(inheritedLease, "provide project identity")
    assertNoRecursiveLifecycle(key, "provide project identity")
    if (inheritedLease?.key === key) {
      const entry = cache.get(key)
      if (entry !== inheritedLease.entry) throw new Error(`Cannot re-enter replaced instance cache entry: ${key}`)
      if (entry.rollback) throw rollbackError(entry.rollback)
      const ctx = await entry.context
      assertProjectAdmissionOpen(key, entry, ctx)
      return await provideLeaseContext(inheritedLease, ctx, async () => input.fn())
    }
    for (;;) {
      assertNotDisposing(directory)
      const entry = getOrCreateCacheEntry(directory, key)
      entry.lastAccess = ++accessSequence
      const ctx = await entry.context
      if (cache.get(key) !== entry) continue
      if (!lifecycleQuiet(entry)) {
        await waitForLifecycleQuiet(entry)
        continue
      }
      if (entry.rollback) throw rollbackError(entry.rollback)
      assertProjectAdmissionOpen(key, entry, ctx)
      const lease = createLease(key, entry, true)
      try {
        return await leaseContext.provide(lease, () => provideLeaseContext(lease, ctx, async () => input.fn()))
      } finally {
        await closeLease(lease)
      }
    }
  },
  async tryProvideActive<R>(input: {
    directory: string
    fn: () => R
    projectDeletionAdmission?: ProjectDeletionAdmission
  }): Promise<Awaited<R> | undefined> {
    const directory = Filesystem.resolve(input.directory)
    const deletionAdmission = input.projectDeletionAdmission
    if (deletionAdmission) {
      if (
        closedProjectAdmissions.get(deletionAdmission.projectID)?.token !==
        projectDeletionAdmissionTokens.get(deletionAdmission)
      ) {
        throw new Error(`Project ${deletionAdmission.projectID} deletion admission is not active`)
      }
    }
    // Project deletion authority bypasses only this Project's directory gate.
    // Process-wide settlement and global disposal remain authoritative.
    assertNotDisposing()
    if (!deletionAdmission) assertNotDisposing(directory)
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
      // Deletion-owned identities intentionally skip capability bootstrap;
      // they exist only to settle durable lifecycle facts under the closed gate.
      if (!entry.initialized && !deletionAdmission) return undefined
      const ctx = await entry.context
      if (deletionAdmission && ctx.project.id !== deletionAdmission.projectID) {
        throw new Error(`Project deletion admission does not own active entry ${ctx.project.id}`)
      }
      if (entry.initialized) assertContextHealthy(entry)
      return await input.fn()
    }
    while (!lifecycleQuiet(entry)) {
      await waitForLifecycleQuiet(entry)
      if (cache.get(key) !== entry) return undefined
    }
    if (cache.get(key) !== entry) return undefined
    if (entry.rollback) throw rollbackError(entry.rollback)
    if (!entry.initialized && !deletionAdmission) return undefined
    const ctx = await entry.context
    if (deletionAdmission && ctx.project.id !== deletionAdmission.projectID) {
      throw new Error(`Project deletion admission does not own active entry ${ctx.project.id}`)
    }
    if (cache.get(key) !== entry) return undefined
    if (!lifecycleQuiet(entry)) return undefined
    if (entry.initialized) assertContextHealthy(entry)
    const lease = createLease(key, entry, true)
    try {
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
        assertProjectAdmissionOpen(key, entry, ctx)
        if (cache.get(key) !== entry) continue
        assertContextHealthy(entry)
        await provideLeaseContext(inheritedLease, ctx, input.fn)
        continue
      }
      while (!lifecycleQuiet(entry)) {
        await waitForLifecycleQuiet(entry)
        if (cache.get(key) !== entry) break
      }
      if (cache.get(key) !== entry) continue
      if (entry.rollback) throw rollbackError(entry.rollback)
      if (!entry.initialized) continue
      const ctx = await entry.context
      assertProjectAdmissionOpen(key, entry, ctx)
      if (cache.get(key) !== entry) continue
      if (!lifecycleQuiet(entry)) continue
      assertContextHealthy(entry)
      const lease = createLease(key, entry, true)
      try {
        await leaseContext.provide(lease, () => provideLeaseContext(lease, ctx, input.fn))
      } finally {
        await closeLease(lease)
      }
    }
  },
  async closeProjectAdmission(input) {
    if (closedProjectAdmissions.has(input.projectID)) {
      throw new Error(`Project ${input.projectID} instance admission is already closed`)
    }
    const token = Symbol(input.projectID)
    const discoveries = new Map(
      [...cache.entries()]
        .filter(([, entry]) => !entry.projectID)
        .map(([key, entry]) => [entry.identityKnown, key] as const),
    )
    const directories = input.directories.map((directory) => Filesystem.resolve(directory))
    closedProjectAdmissions.set(input.projectID, {
      token,
      directories,
      discoveries,
    })
    for (const discovery of discoveries.keys()) {
      void discovery.finally(() => discoveries.delete(discovery)).catch(() => undefined)
    }
    const seededEntries: Array<{ key: string; entry: CacheEntry }> = []
    const discardUnusedSeededEntries = () => {
      for (const { key, entry } of seededEntries) {
        if (cache.get(key) === entry && !entry.initialized) cache.delete(key)
      }
    }
    try {
      await Promise.allSettled(discoveries.keys())
      await waitForRuntimeSettlementIdle({
        snapshot: () =>
          [...pendingEvictionSettlements]
            .filter(([entry]) => entry.projectID === input.projectID)
            .map(([entry, settled]) => ({
              label: `project-convergence:${entry.projectID}`,
              settled,
            })),
        inactivityTimeoutMilliseconds: Flag.OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS,
        inactivityError: (labels) =>
          new InstanceSettlementInactivityError(labels, Flag.OPENCORVUS_PROJECT_RUNTIME_DISPOSAL_TIMEOUT_MS),
      })
      await Promise.resolve()
      const occurrence = Project.occurrence(input.projectID)
      if (!occurrence) {
        throw new Error(`Project ${input.projectID} disappeared while closing deletion admission`)
      }
      for (const directory of directories) {
        const seeded = seedProjectDeletionIdentity(directory, occurrence.project, occurrence.generation)
        if (seeded) seededEntries.push(seeded)
      }
      const authority: ProjectDeletionAdmission = {
        projectID: input.projectID,
        [Symbol.dispose]() {
          // Once authority is returned, deletion settlement may initialize lazy
          // State on these identities. Retain any entries not formally disposed
          // so ordinary bootstrap or later convergence can own their cleanup.
          if (closedProjectAdmissions.get(input.projectID)?.token === token) {
            closedProjectAdmissions.delete(input.projectID)
          }
          projectDeletionAdmissionTokens.delete(authority)
        },
      }
      projectDeletionAdmissionTokens.set(authority, token)
      return authority
    } catch (error) {
      // No async work runs between seeding and authority publication, so entries
      // created by a failed pre-authority handshake are still safe to discard.
      discardUnusedSeededEntries()
      if (closedProjectAdmissions.get(input.projectID)?.token === token) {
        closedProjectAdmissions.delete(input.projectID)
      }
      throw error
    }
  },
  async disposeProjectEntries(projectID, inactivityTimeoutMilliseconds = 60_000) {
    SchedulerTaskOwner.assertCanStartLifecycleDisposal("Project instance disposal")
    if (leaseContext.tryUse()) {
      throw new Error("Cannot dispose Project instances from within an active instance callback")
    }
    const errors: unknown[] = []
    const processed = new Set<CacheEntry>()
    const admission = closedProjectAdmissions.get(projectID)
    if (!admission) throw new Error(`Project ${projectID} instance admission must be closed before disposal`)
    for (;;) {
      await waitForRuntimeSettlementIdle({
        snapshot: () =>
          [...admission.discoveries].map(([settled, key]) => ({
            label: `project-discovery:${key}`,
            settled,
          })),
        inactivityTimeoutMilliseconds,
        inactivityError: (labels) => new InstanceSettlementInactivityError(labels, inactivityTimeoutMilliseconds),
      })
      const targets = [...cache.entries()].filter(([, entry]) => entry.projectID === projectID && !processed.has(entry))
      // Project deletion is a teardown like any other: an in-flight background
      // model turn must be cancelled, not waited out of the inactivity budget.
      for (const [, entry] of targets) cancelInstanceBackgroundWork(entry, "project instance disposal")
      if (targets.length === 0) {
        if (admission.discoveries.size === 0) break
        continue
      }
      for (const [key, entry] of targets) {
        processed.add(entry)
        const waitForLeaseSettlement = () =>
          waitForRuntimeSettlementIdle({
            snapshot: () =>
              [...entry.activeLeases].map((lease) => ({
                label:
                  `project-instance:${key}:${lease.serving ? "serving" : "exclusive"}:` +
                  `activities=${lease.activities.size}`,
                settled: lease.closedSignal,
              })),
            inactivityTimeoutMilliseconds,
            inactivityError: (labels) => new InstanceSettlementInactivityError(labels, inactivityTimeoutMilliseconds),
          })
        await waitForLeaseSettlement()
        let release = await acquireEntryTurnWithin(entry, `project-instance-lock:${key}`, inactivityTimeoutMilliseconds)
        // A serving handle admitted between the settlement wait and the turn
        // grant still owns the shared context; hand the turn back and wait it
        // out under the same inactivity budget.
        while (otherServingOpen(entry)) {
          release()
          await waitForLeaseSettlement()
          release = await acquireEntryTurnWithin(entry, `project-instance-lock:${key}`, inactivityTimeoutMilliseconds)
        }
        const lease = createLease(key, entry, false)
        let abandoned = false
        try {
          const ctx = await awaitSettlementPromise({
            label: `project-context:${key}`,
            settled: entry.context,
            inactivityTimeoutMilliseconds,
          })
          if (cache.get(key) !== entry || ctx.project.id !== projectID) continue
          const disposal = entryTurnContext.provide(entry, () =>
            leaseContext.provide(lease, () =>
              provideLeaseContext(lease, ctx, () =>
                runLeaseLifecycle(lease, "Project instance disposal", async () => {
                  if (entry.rollback) await retryRollbackCleanup(key, entry, lease, entry.rollback)
                  else await disposeEntry(key, entry, ctx)
                }),
              ),
            ),
          )
          try {
            await awaitSettlementPromise({
              label: `project-instance-disposal:${key}`,
              settled: disposal,
              inactivityTimeoutMilliseconds,
            })
          } catch (error) {
            if (error instanceof InstanceSettlementInactivityError) {
              abandoned = true
              entry.abandoned = true
              State.abandon(ctx.directory)
              if (cache.get(key) === entry) cache.delete(key)
              abandonLease(lease)
              void disposal.catch(() => undefined)
            }
            throw error
          }
        } catch (error) {
          errors.push(error)
        } finally {
          try {
            if (!abandoned) await closeLease(lease)
          } finally {
            release()
          }
        }
      }
    }
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, `Failed to dispose Project ${projectID} Instance entries`)
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
  get projectGeneration() {
    return ProjectInstanceContext.use().projectGeneration
  },
  current() {
    return ProjectInstanceContext.tryUse()
  },
  async refresh(directory = Instance.directory) {
    const resolved = Filesystem.resolve(directory)
    assertNotDisposing(resolved)
    assertInheritedLeaseOpen(leaseContext.tryUse(), "refresh an instance")
    const key = instanceCacheKey(resolved)
    assertNoRecursiveLifecycle(key, "refresh an instance")
    const entry = cache.get(key)
    if (!entry) throw new Error(`Cannot refresh inactive instance: ${resolved}`)
    const inheritedLease = leaseContext.tryUse()
    let lease: Lease
    let owned = false
    let chain: Lease | undefined
    if (inheritedLease?.key === key) {
      if (inheritedLease.entry !== entry) throw new Error(`Cannot refresh replaced instance cache entry: ${key}`)
      lease = inheritedLease
      chain = inheritedLease
    } else {
      lease = createLease(key, entry, false)
      owned = true
    }
    // Refresh mutates the shared context in place, so it runs as a teardown
    // turn: serving handles outside the ambient chain drain first, and the
    // chain itself is excused so an in-callback refresh stays live.
    const run = () =>
      runLeaseLifecycle(lease, "instance refresh", () =>
        runTeardownTurn(entry, chain, async () => {
          assertEntryCurrent(key, entry)
          if (entry.rollback) throw rollbackError(entry.rollback)
          const current = await entry.context
          assertContextHealthy(entry)
          if (needsProjectRefresh(current)) {
            SchedulerTaskOwner.assertCanStartLifecycleDisposal("instance refresh")
            const prepared = await prepareContextInTurn(key, entry, lease, undefined, chain)
            if (prepared === TEARDOWN_REQUIRED) {
              throw new Error(`Instance refresh found open serving handles after draining: ${key}`)
            }
            return prepared
          }
          const next = await Project.fromDirectory(current.directory)
          applyContext(current, next)
          return current
        }),
      )
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
    // Disposal drains every serving handle except its own ambient chain, and
    // gates new admissions while it waits, so it can neither deadlock on its
    // caller nor starve behind a continuous admission stream.
    await runLeaseLifecycle(inheritedLease, "instance disposal", () =>
      runTeardownTurn(entry, inheritedLease, async () => {
        assertEntryCurrent(key, entry)
        if (entry.rollback) throw rollbackError(entry.rollback)
        const ctx = await entry.context
        await disposeEntry(key, entry, ctx)
      }),
    )
  },
  async converge(input) {
    assertNotDisposing()
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
        if (entry.projectID && closedProjectAdmissions.has(entry.projectID)) continue
        const release = tryClaimIdleEntryTurn(entry)
        if (!release) continue
        pendingEvictions.add(entry)
        const lease = createLease(key, entry, false)
        const directory = entry.rollback?.ctx.directory ?? key
        const disposal = (async () => {
          try {
            if (entry.rollback) {
              await entryTurnContext.provide(entry, () =>
                leaseContext.provide(lease, () =>
                  provideLeaseContext(
                    lease,
                    entry.rollback!.ctx,
                    () =>
                      runLeaseLifecycle(lease, "instance rollback convergence", () =>
                        retryRollbackCleanup(key, entry, lease),
                      ),
                    { allowRollback: true },
                  ),
                ),
              )
              return { status: "disposed" as const, directory }
            }
            const ctx = await entry.context
            if (cache.get(key) !== entry) return { status: "replaced" as const, directory }
            if (entry.projectID && closedProjectAdmissions.has(entry.projectID)) {
              return { status: "retained" as const, directory: ctx.directory }
            }
            await beforeConvergenceDisposalForTest?.({ directory: ctx.directory, projectID: entry.projectID })
            await entryTurnContext.provide(entry, () =>
              leaseContext.provide(lease, () =>
                provideLeaseContext(lease, ctx, () =>
                  runLeaseLifecycle(lease, "instance cache convergence", () => disposeEntry(key, entry, ctx)),
                ),
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
              release()
              pendingEvictions.delete(entry)
            }
          }
        })()
        const evictionSettlement = disposal.then(() => undefined)
        pendingEvictionSettlements.set(entry, evictionSettlement)
        void evictionSettlement
          .finally(() => {
            if (pendingEvictionSettlements.get(entry) === evictionSettlement) {
              pendingEvictionSettlements.delete(entry)
            }
          })
          .catch(() => undefined)
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
              if (scheduled && !processSettlementGate) {
                Instance.scheduleConvergence({ maximumRetained: scheduledMaximumRetained })
              }
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
    assertNotDisposing()
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
      .catch((error) => {
        if (error instanceof InstanceProcessAdmissionClosedError) return
        Log.Default.error("scheduled instance cache convergence failed", { error })
      })
      .finally(() => {
        scheduledConvergence = undefined
        if (convergenceRequested && !processSettlementGate) {
          Instance.scheduleConvergence({ maximumRetained: scheduledMaximumRetained })
        }
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
        cancelInstanceBackgroundWork(entry, "global instance disposal")
        await Promise.all([...entry.activeLeases].map((lease) => lease.closedSignal))
        let release = await acquireEntryTurn(entry)
        // A lease admitted between the settlement wait and the turn grant is
        // waited out; global disposal already rejects new admissions, so this
        // converges.
        while (entry.activeLeases.size > 0) {
          release()
          await Promise.all([...entry.activeLeases].map((lease) => lease.closedSignal))
          release = await acquireEntryTurn(entry)
        }
        const lease = createLease(key, entry, false)
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
              await entryTurnContext.provide(entry, () =>
                leaseContext.provide(lease, () =>
                  provideLeaseContext(lease, owner.ctx, () =>
                    runLeaseLifecycle(lease, "instance rollback disposal", () =>
                      retryRollbackCleanup(key, entry, lease, owner),
                    ),
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
          await entryTurnContext.provide(entry, () =>
            leaseContext.provide(lease, () =>
              provideLeaseContext(lease, ctx!, () =>
                runLeaseLifecycle(lease, "global instance disposal", () => disposeEntry(key, entry, ctx!)),
              ),
            ),
          )
        } catch (error) {
          errors.push(error)
          markEntryFailureReported(entry, error)
        } finally {
          try {
            await closeLease(lease)
          } finally {
            release()
          }
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

export const InstanceTestHooks = {
  installBeforeConvergenceDisposal(
    hook: (input: { directory: string; projectID?: string }) => void | Promise<void>,
  ): Disposable {
    if (beforeConvergenceDisposalForTest) throw new Error("Instance convergence disposal hook is already installed")
    beforeConvergenceDisposalForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeConvergenceDisposalForTest === hook) beforeConvergenceDisposalForTest = undefined
      },
    }
  },
  isProjectAdmissionClosed(projectID: string): boolean {
    return closedProjectAdmissions.has(projectID)
  },
  async acquireCacheWriteLock(directory: string): Promise<Disposable> {
    const key = instanceCacheKey(Filesystem.resolve(directory))
    const entry = cache.get(key)
    if (!entry) throw new Error(`Cannot acquire a test cache lock for inactive instance: ${directory}`)
    const release = await acquireEntryTurn(entry)
    return { [Symbol.dispose]: release }
  },
}
