import { Context } from "@/util/context"
import { Log } from "@/util/log"
import { currentRuntimeProcessOccurrence } from "@/runtime/process-occurrence"

type StateLabel = "skill" | "inventory" | "config"
type Aggregate =
  | "skill.parse"
  | "inventory.manifest"
  | "inventory.provenance"
  | "risk.scripts"
  | "risk.agents"
  | "risk.references"
  | "risk.templates"
type Phase =
  | "request"
  | "matrix.config"
  | "matrix.inventory"
  | "matrix.projection"
  | "matrix.registry"
  | "matrix.assembly"
  | "catalog.total"
  | "catalog.admission"
  | "catalog.held"
  | "catalog.release"
  | "catalog.reentrant"
  | "catalog.recovery"
  | "catalog.revision"
  | "catalog.config-reset"
  | "catalog.inventory-reset"
  | "skill.builtins"
  | "skill.external-global"
  | "skill.external-project"
  | "skill.explicit-scan"
  | "skill.config-directories"
  | "skill.config"
  | "skill.configured-scan"
  | "skill.remote"
  | "inventory.skills"
  | "inventory.config"
  | "inventory.projection"
  | "config.load"
  | "config.verify"
  | "config.dependencies"
  | "projection.package"
  | "projection.package-source-capture"
  | "projection.package-publication"
  | "projection.package-existing-verify"
  | "projection.package-staging-write"
  | "projection.package-atomic-publication"
  | "projection.package-competing-verify"
  | "projection.package-final-verify"
  | "projection.skills"
  | "projection.capabilities"
  | "projection.selectors"
  | "state.read"
  | "state.initialize"
type Totals = { count: number; items: number; duration: number; maximum: number; rejected: number }
type Initializer = { id: string; creatorRequestID: string | null; settled: boolean }
type Trace = {
  id: string
  request?: { id: string; settled: boolean }
  aggregates?: Map<Aggregate, Totals>
  read?: { label: StateLabel; created?: Initializer }
}

const context = Context.create<Trace>("skill-read-diagnostics")
const log = Log.create({ service: "skill-read-diagnostics" })
const initializers = new WeakMap<Promise<unknown>, Initializer>()
let sequence = 0

function errorType(error: unknown) {
  return error instanceof Error ? "error" : error === null ? "null" : typeof error
}

function observe<T>(
  value: T,
  finish: (outcome: "fulfilled" | "rejected", error?: unknown, value?: unknown) => void,
): T {
  if (value instanceof Promise)
    void value.then(
      (result) => finish("fulfilled", undefined, result),
      (error) => finish("rejected", error),
    )
  else finish("fulfilled", undefined, value)
  return value
}

function span(phase: Phase, fields: Record<string, unknown> = {}) {
  const parent = context.tryUse()
  const id = `${process.pid}:${++sequence}`
  const attributes: Record<string, unknown> = {
    phase,
    spanID: id,
    parentSpanID: parent?.id ?? null,
    processOccurrenceID: currentRuntimeProcessOccurrence().occurrenceID,
    http: { requestID: parent?.request?.id ?? null, requestSettled: parent?.request?.settled ?? false },
    origin: parent?.request ? "http" : "startup-or-unattributed",
    ...fields,
  }
  const timer = log.timeDebug("phase", attributes)
  let settled = false
  return {
    trace: { ...parent, id } as Trace,
    attributes,
    finish(outcome: "fulfilled" | "rejected", error?: unknown) {
      if (settled) return
      settled = true
      attributes.outcome = outcome
      attributes.http = { requestID: parent?.request?.id ?? null, requestSettled: parent?.request?.settled ?? false }
      if (outcome === "rejected") attributes.errorType = errorType(error)
      timer.stop()
    },
  }
}

/** Observation only: every helper returns the operation's original value or promise. */
export namespace SkillReadDiagnostics {
  export type SnapshotMetadata = Readonly<{ digest?: string; fileCount?: number; stagingBasename?: string }>

  export function publicationDecision(
    metadata: SnapshotMetadata,
    error: unknown,
    competing: boolean,
    verified?: boolean,
  ) {
    if (!log.enabled("DEBUG")) return
    const parent = context.tryUse()
    const value = error && typeof error === "object" ? error : {}
    const native = {
      code:
        "code" in value && typeof value.code === "string" && /^[A-Z0-9_]+$/.test(value.code) ? value.code : undefined,
      errno:
        "errno" in value && typeof value.errno === "number" && Number.isFinite(value.errno) ? value.errno : undefined,
      syscall:
        "syscall" in value && typeof value.syscall === "string" && /^[a-zA-Z0-9_]+$/.test(value.syscall)
          ? value.syscall
          : undefined,
    }
    log.debug("publication-decision", {
      ...metadata,
      ...native,
      parentSpanID: parent?.id ?? null,
      processOccurrenceID: currentRuntimeProcessOccurrence().occurrenceID,
      http: { requestID: parent?.request?.id ?? null, requestSettled: parent?.request?.settled ?? false },
      origin: parent?.request ? "http" : "startup-or-unattributed",
      publicationDecision: !competing
        ? "rejected-noncompeting"
        : verified
          ? "accepted-competing"
          : "rejected-competing",
      verificationAttempted: competing,
      verified,
    })
  }

  export function phase<T>(name: Phase, operation: () => T, metadata?: SnapshotMetadata): T {
    if (!log.enabled("DEBUG")) return operation()
    const owner = span(name, metadata)
    try {
      return observe(context.provide(owner.trace, operation), owner.finish)
    } catch (error) {
      owner.finish("rejected", error)
      throw error
    }
  }

  export function request<T>(id: string, operation: () => T): T {
    if (!log.enabled("DEBUG")) return operation()
    const request = { id, settled: false }
    try {
      return context.provide({ id: `http:${id}`, request }, () =>
        observe(phase("request", operation), () => {
          request.settled = true
        }),
      )
    } catch (error) {
      request.settled = true
      throw error
    }
  }

  export function initialize<T>(label: StateLabel, operation: () => T): T {
    if (!log.enabled("DEBUG")) return operation()
    const parent = context.tryUse()
    const owner = span("state.initialize", { stateLabel: label })
    const initializer = { id: owner.trace.id, creatorRequestID: parent?.request?.id ?? null, settled: false }
    if (parent?.read?.label === label) parent.read.created = initializer
    const aggregates = new Map<Aggregate, Totals>()
    const finish = (outcome: "fulfilled" | "rejected", error?: unknown) => {
      owner.attributes.aggregates = Object.fromEntries(aggregates)
      owner.finish(outcome, error)
    }
    try {
      return observe(context.provide({ ...owner.trace, read: undefined, aggregates }, operation), finish)
    } catch (error) {
      finish("rejected", error)
      throw error
    }
  }

  export function readState<T>(label: StateLabel, accessor: () => T): T {
    if (!log.enabled("DEBUG")) return accessor()
    const owner = span("state.read", { stateLabel: label })
    const read: NonNullable<Trace["read"]> = { label }
    try {
      const value = context.provide({ ...owner.trace, read }, accessor)
      const initializer = read.created ?? (value instanceof Promise ? initializers.get(value) : undefined)
      if (read.created && value instanceof Promise) initializers.set(value, read.created)
      owner.attributes.disposition = read.created
        ? "creator"
        : initializer
          ? initializer.settled
            ? "cached-settled"
            : "join-pending"
          : "unobserved-origin"
      owner.attributes.initializerID = initializer?.id ?? null
      owner.attributes.creatorRequestID = initializer?.creatorRequestID ?? null
      return observe(value, (outcome, error) => {
        if (initializer) initializer.settled = true
        owner.finish(outcome, error)
      })
    } catch (error) {
      owner.finish("rejected", error)
      throw error
    }
  }

  export function aggregate<T>(name: Aggregate, operation: () => T): T {
    const totals = log.enabled("DEBUG") ? context.tryUse()?.aggregates : undefined
    if (!totals) return operation()
    const started = performance.now()
    const finish = (outcome: "fulfilled" | "rejected", _error?: unknown, value?: unknown) => {
      const duration = performance.now() - started
      const item = totals.get(name) ?? { count: 0, items: 0, duration: 0, maximum: 0, rejected: 0 }
      item.count++
      item.duration += duration
      item.maximum = Math.max(item.maximum, duration)
      if (outcome === "rejected") item.rejected++
      if (Array.isArray(value)) item.items += value.length
      totals.set(name, item)
    }
    try {
      return observe(operation(), finish)
    } catch (error) {
      finish("rejected")
      throw error
    }
  }

  export function catalogOwner<T>(
    acquire: (run: () => Promise<T>) => Promise<T>,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!log.enabled("DEBUG")) return acquire(operation)
    return phase("catalog.total", () => {
      const admission = span("catalog.admission")
      let release: ReturnType<typeof span> | undefined
      const acquired = () => {
        admission.finish("fulfilled")
        try {
          return observe(phase("catalog.held", operation), () => {
            release = span("catalog.release")
          })
        } catch (error) {
          release = span("catalog.release")
          throw error
        }
      }
      try {
        return observe(acquire(acquired), (outcome, error) => {
          admission.finish(outcome, error)
          release?.finish(outcome, error)
        })
      } catch (error) {
        admission.finish("rejected", error)
        release?.finish("rejected", error)
        throw error
      }
    })
  }
}
