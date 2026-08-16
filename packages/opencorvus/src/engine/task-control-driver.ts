/**
 * Liveness owner for the Task control plane.
 *
 * `Reduce` is total over immutable facts, immutable policy, valid leases and
 * `now`, so *safety* never depends on scheduling. *Liveness* does, and the
 * reducer alone cannot supply it: a `ready` ingress is only ever executed
 * inside a reconciliation scan, and scans are started by edges.
 *
 * Exactly two transition classes can enlarge the enabled set
 * `E(t) = { i : Reduce(i,t)=ready and every prior ingress is settled }`:
 *
 *   (F) a fact append — a newly accepted ingress, a decision receipt, a
 *       terminalized assistant, an answered Interaction, an effect outcome;
 *   (T) the passage of time across one of the finitely many instants the
 *       reducer reads (`taskRootIngressWakeInstant`).
 *
 * This driver closes both, per Task:
 *
 *   (F) every producer calls `request`, which increments a monotone revision.
 *       The single owner re-scans while the revision it observed is stale, so
 *       a scan always exists that *begins strictly after* any given append.
 *   (T) each settled scan re-arms one timer at the earliest instant its own
 *       projections can change.
 *
 * Requests never join a running scan. A scan may await a whole Orchestrator
 * Turn, and that Turn's Tools call back into the control plane; joining would
 * deadlock a caller against its own activation. A non-owner therefore records
 * its demand in the revision and returns — exactly the "hint" contract: a hint
 * may be lost or duplicated, but the revision it left behind cannot be.
 *
 * A scan that throws is a physical fault, not a fact. It is isolated, counted
 * and re-armed under exponential backoff so a permanently failing Task paces
 * itself instead of spinning, and never starves its siblings.
 *
 * (F) and (T) above are *edge* obligations spread across every producer in the
 * program, so a single missed call site is a silent permanent stall. The driver
 * therefore also runs one **level-triggered heartbeat** per project: every
 * `heartbeatMilliseconds` it enumerates the currently live Tasks and requests
 * each one. Reduction is total and `resolved`/`terminal_inapplicable`/
 * `exhausted` absorb further fact appends, so a settled ingress costs one
 * projection and re-settles immediately.
 *
 * That upgrades liveness from "every producer remembered to signal" to a
 * bounded-delay guarantee: for any state change that enables an ingress — a
 * fact appended by *any* process, a crossed deadline, or an edge that was never
 * wired — some scan observes it within `heartbeatMilliseconds`. Edges remain
 * for latency; correctness no longer depends on their completeness.
 */
import { Log } from "@/util/log"

const log = Log.create({ service: "engine.task-control-driver" })

export type TaskControlScanResult = {
  /** Physical activations this scan started. */
  activated: number
  /** Earliest instant this Task's projections can change without a new fact. */
  wakeAt?: number
  /**
   * The scan's well-founded measure stopped decreasing before it settled.
   * The driver paces this Task under the same exponential backoff as a fault
   * instead of re-arming at the minimum delay, so a Task that cannot reduce
   * never spins the reconciler hot.
   */
  noProgress?: boolean
}

export type TaskControlScanContext = {
  /** Zero-based fixpoint pass within the current ownership. Work that is
   * idempotent per scan rather than per pass — recovery sweeps in particular —
   * runs only on pass 0. */
  pass: number
}

export type TaskControlScan = (taskID: string, context: TaskControlScanContext) => Promise<TaskControlScanResult>

export type TaskControlDriverOptions = {
  scan: TaskControlScan
  /** Fixpoint passes before a non-settling Task degrades to timer pacing. */
  maxPasses?: number
  minimumWakeDelayMilliseconds?: number
  maximumWakeDelayMilliseconds?: number
  initialBackoffMilliseconds?: number
  maximumBackoffMilliseconds?: number
  /**
   * Level-triggered sweep period. Bounds the delay before any enabling state
   * change is observed, whatever produced it. Omit `liveTasks` to disable.
   */
  heartbeatMilliseconds?: number
  /** Tasks the heartbeat sweeps. Without it the heartbeat never arms. */
  liveTasks?: () => readonly string[]
  now?: () => number
  setTimer?: (fn: () => void, delayMilliseconds: number) => { cancel(): void }
  /**
   * Re-establish the owning project context for a timer-fired request. A timer
   * callback runs outside the async context that armed it, so a re-armed scan
   * must re-enter its project or it would read another project's Database. A
   * disposed project simply drops the request.
   */
  reenter?: (fn: () => Promise<void>) => Promise<void>
}

type Entry = {
  revision: number
  running: boolean
  timer: { cancel(): void } | undefined
  timerAt: number | undefined
  failures: number
  /** When this Task last faulted or failed to reduce. Backoff decays only
   * after a fault-free window, so an alternating fault/success Task still
   * escalates instead of pinning at the initial delay. */
  lastFaultAt: number | undefined
}

/** The earlier of two optional instants. A scan pass that reports no wake does
 * not cancel an earlier pass's obligation, so wakes accumulate by minimum. */
function minDefined(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right
  if (right === undefined) return left
  return Math.min(left, right)
}

function defaultTimer(fn: () => void, delayMilliseconds: number): { cancel(): void } {
  const handle = setTimeout(fn, delayMilliseconds)
  ;(handle as { unref?: () => void }).unref?.()
  return {
    cancel() {
      clearTimeout(handle)
    },
  }
}

export class TaskControlDriver {
  private readonly entries = new Map<string, Entry>()
  private readonly scan: TaskControlScan
  private readonly maxPasses: number
  private readonly minimumWakeDelay: number
  private readonly maximumWakeDelay: number
  private readonly initialBackoff: number
  private readonly maximumBackoff: number
  private readonly now: () => number
  private readonly setTimer: (fn: () => void, delayMilliseconds: number) => { cancel(): void }
  private readonly reenter: (fn: () => Promise<void>) => Promise<void>
  private readonly heartbeatDelay: number
  private readonly liveTasks: (() => readonly string[]) | undefined
  private heartbeat: { cancel(): void } | undefined
  private disposed = false

  constructor(options: TaskControlDriverOptions) {
    this.scan = options.scan
    this.maxPasses = options.maxPasses ?? 64
    this.minimumWakeDelay = options.minimumWakeDelayMilliseconds ?? 25
    this.maximumWakeDelay = options.maximumWakeDelayMilliseconds ?? 3_600_000
    this.initialBackoff = options.initialBackoffMilliseconds ?? 1_000
    this.maximumBackoff = options.maximumBackoffMilliseconds ?? 60_000
    this.now = options.now ?? Date.now
    this.setTimer = options.setTimer ?? defaultTimer
    this.reenter = options.reenter ?? ((fn) => fn())
    this.heartbeatDelay = options.heartbeatMilliseconds ?? 30_000
    this.liveTasks = options.liveTasks
    if (
      !Number.isSafeInteger(this.maxPasses) ||
      this.maxPasses <= 0 ||
      this.minimumWakeDelay <= 0 ||
      this.maximumWakeDelay < this.minimumWakeDelay ||
      this.initialBackoff <= 0 ||
      this.maximumBackoff < this.initialBackoff ||
      this.heartbeatDelay <= 0
    ) {
      throw new Error("Task-control driver requires positive, ordered pacing bounds")
    }
    this.armHeartbeat()
  }

  /**
   * Record demand for one Task and, when no owner exists, become the owner and
   * drive its scan to a revision fixpoint. Returns the activations this call
   * owned; a non-owner returns 0 without waiting.
   *
   * `propagateFailure` reports the owner's first-pass fault to its direct
   * caller, preserving the visible error contract of an explicit single-Task
   * request. Later passes were not requested by that caller and only log.
   */
  async request(taskID: string, options?: { propagateFailure?: boolean }): Promise<number> {
    if (this.disposed) return 0
    const entry = this.entry(taskID)
    entry.revision += 1
    if (entry.running) return 0
    entry.running = true
    return this.own(taskID, entry, options?.propagateFailure === true)
  }

  /** Pending re-arm and fault state, for diagnostics only. */
  snapshot(): Array<{ taskID: string; revision: number; running: boolean; wakeAt?: number; failures: number }> {
    return [...this.entries].map(([taskID, entry]) => ({
      taskID,
      revision: entry.revision,
      running: entry.running,
      ...(entry.timerAt === undefined ? {} : { wakeAt: entry.timerAt }),
      failures: entry.failures,
    }))
  }

  dispose(): void {
    this.disposed = true
    this.heartbeat?.cancel()
    this.heartbeat = undefined
    for (const entry of this.entries.values()) {
      entry.timer?.cancel()
      entry.timer = undefined
      entry.timerAt = undefined
    }
    this.entries.clear()
  }

  /**
   * Level-triggered sweep. Requests run in parallel so one Task's Orchestrator
   * Turn cannot starve its siblings, but the sweep *awaits* them inside the
   * re-entered project context: `reenter` provides an instance lease exactly
   * for the duration of its callback, and a scan detached past that boundary
   * keeps the closed lease in its async context — every later database access
   * then faults with "closed instance cache lease" on each tick, which is how
   * the heartbeat silently broke the very liveness it exists to guarantee.
   * The next tick therefore arms after the sweep settles; under long Turns the
   * period stretches, which costs backstop latency, never correctness.
   */
  private armHeartbeat(): void {
    if (this.disposed || !this.liveTasks) return
    this.heartbeat?.cancel()
    this.heartbeat = this.setTimer(() => {
      this.heartbeat = undefined
      void this.reenter(async () => {
        await Promise.all(
          this.liveTasks!().map((taskID) =>
            this.request(taskID).catch((error) => {
              log.error("Task-control heartbeat request faulted", { taskID, error })
            }),
          ),
        )
      })
        .catch((error) => {
          log.error("Task-control heartbeat sweep faulted", { error })
        })
        .finally(() => this.armHeartbeat())
    }, this.heartbeatDelay)
  }

  private entry(taskID: string): Entry {
    const existing = this.entries.get(taskID)
    if (existing) return existing
    const created: Entry = {
      revision: 0,
      running: false,
      timer: undefined,
      timerAt: undefined,
      failures: 0,
      lastFaultAt: undefined,
    }
    this.entries.set(taskID, created)
    return created
  }

  private async own(taskID: string, entry: Entry, propagateFailure: boolean): Promise<number> {
    let activated = 0
    let wakeAt: number | undefined
    let failure: unknown
    let failed = false
    try {
      for (let pass = 0; pass < this.maxPasses; pass += 1) {
        const observed = entry.revision
        this.decayFailures(entry)
        let result: TaskControlScanResult
        try {
          result = await this.scan(taskID, { pass })
        } catch (error) {
          wakeAt = minDefined(wakeAt, this.penalize(entry))
          log.error("Task-control scan faulted; re-armed under backoff", {
            taskID,
            pass,
            failures: entry.failures,
            error,
          })
          if (pass === 0 && propagateFailure) {
            failed = true
            failure = error
          }
          break
        }
        activated += result.activated
        if (result.noProgress) {
          wakeAt = minDefined(wakeAt, this.penalize(entry))
          log.warn("Task-control scan made no reducible progress; paced under backoff", {
            taskID,
            pass,
            failures: entry.failures,
          })
          break
        }
        wakeAt = minDefined(wakeAt, result.wakeAt)
        if (entry.revision === observed) break
        if (pass + 1 === this.maxPasses) {
          // A fixpoint that will not settle is a non-decreasing measure, which
          // is the same liveness fault as a scan that cannot reduce. Pacing it
          // at the minimum delay would run `maxPasses` full scans every 25ms.
          wakeAt = minDefined(wakeAt, this.penalize(entry))
          log.warn("Task-control fixpoint did not settle; paced under backoff", {
            taskID,
            passes: this.maxPasses,
            revision: entry.revision,
            failures: entry.failures,
          })
        }
      }
    } finally {
      entry.running = false
      this.arm(taskID, entry, wakeAt)
    }
    if (failed) throw failure
    return activated
  }

  /** Count one liveness fault against this Task and return the instant it may
   * next be scanned. */
  private penalize(entry: Entry): number {
    entry.failures += 1
    entry.lastFaultAt = this.now()
    const exponent = Math.min(entry.failures - 1, 30)
    return this.now() + Math.min(this.initialBackoff * 2 ** exponent, this.maximumBackoff)
  }

  /**
   * Forgive accumulated backoff only after a fault-free window as long as the
   * maximum delay. Resetting on any progressing pass would let a Task that
   * alternates fault and success retry at the initial delay forever, which is
   * the spin the backoff exists to prevent. Evaluated before every pass so a
   * Task that has genuinely recovered pays no residual penalty.
   */
  private decayFailures(entry: Entry): void {
    if (entry.failures === 0) return
    if (entry.lastFaultAt !== undefined && this.now() - entry.lastFaultAt < this.maximumBackoff) return
    entry.failures = 0
    entry.lastFaultAt = undefined
  }

  private arm(taskID: string, entry: Entry, wakeAt: number | undefined): void {
    entry.timer?.cancel()
    entry.timer = undefined
    entry.timerAt = undefined
    if (this.disposed || wakeAt === undefined) return
    const delay = Math.min(Math.max(wakeAt - this.now(), this.minimumWakeDelay), this.maximumWakeDelay)
    entry.timerAt = this.now() + delay
    entry.timer = this.setTimer(() => {
      entry.timer = undefined
      entry.timerAt = undefined
      void this.reenter(async () => {
        await this.request(taskID)
      }).catch((error) => {
        log.error("Task-control re-arm request faulted", { taskID, error })
      })
    }, delay)
  }
}
