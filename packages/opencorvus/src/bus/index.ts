import z from "zod"
import { Log } from "../util/log"
import { createInstanceState } from "../project/instance-state"
import { currentProjectDirectory } from "../project/instance-context"
import { BusEvent } from "./bus-event"
import { DurableBusSubscriptionIdentityConflictError, GlobalBus } from "./global"
import { isBusTraceEnabled, traceBus } from "../util/debug-trace"
import { randomUUID } from "node:crypto"
import { Context } from "../util/context"
import {
  RuntimeExecutionAdmissionClosedError,
  RuntimeExecutionSettlement,
  type RuntimeExecutionReservation,
} from "../runtime/execution-settlement"
import { Database, and, eq } from "../storage/db"
import { BusPublicationDeliveryTable, BusPublicationOutboxTable } from "./bus.sql"
import { Instance, runOutsideInstanceContext } from "../project/instance"

export namespace Bus {
  const log = Log.create({ service: "bus" })
  export type Envelope<Properties = unknown, Type extends string = string> = {
    occurrenceID: string
    type: Type
    properties: Properties
    causation?: Causation
    /** Physical publication ownership; subscribers doing async work must stop on abort. */
    signal?: AbortSignal
  }

  export type Causation = {
    source: string
    occurrenceID: string
    ancestry: Array<{ occurrenceID: string; sourceID: string }>
  }

  const causationContext = Context.create<Causation>("bus-causation")

  export function withCausation<R>(causation: Causation, fn: () => R): R {
    return causationContext.provide(causation, fn)
  }

  type Subscription = {
    callback: (event: Envelope<any>) => unknown | Promise<unknown>
    id: string
    durable: boolean
    source?: string
  }
  const runtimeSubscriptionID = randomUUID()
  let subscriptionSequence = 0
  export type Publication = Promise<void> & {
    readonly occurrenceID: string
    retry(): Publication
  }
  type OwnedPublication = {
    occurrenceID: string
    directory: string
    current: Publication
    pending?: Promise<void>
    error?: unknown
    retryTimer?: ReturnType<typeof setTimeout>
    retryEpoch: number
    durable: boolean
  }

  type ProcessSettlementScope = {
    token: symbol
    owners: Map<string, OwnedPublication>
  }

  let processSettlementGate: ProcessSettlementScope | undefined

  function occurrenceID() {
    return `bus-occurrence:${randomUUID()}`
  }

  export const InstanceDisposed = BusEvent.define(
    "server.instance.disposed",
    z.object({
      directory: z.string(),
    }),
  )

  async function dispatchPhase(subscriptions: Map<any, Subscription[]>, payload: Envelope<any>, key: string) {
    const pending: Array<Promise<unknown>> = []
    let index = 0
    const match = [...(subscriptions.get(key) ?? [])]
    for (const sub of match) {
      if (isBusTraceEnabled()) {
        index += 1
        traceBus({
          phase: "before-dispatch",
          type: payload.type,
          key,
          index,
          source: sub.source,
        })
      }
      const label = `${payload.type}/${sub.source ?? "unknown"}`
      let result: unknown
      try {
        result = sub.callback(payload)
      } catch (err) {
        result = Promise.reject(err)
      }
      pending.push(
        Promise.resolve(result).catch((err) => {
          log.warn("subscriber failed", { type: payload.type, label, error: String(err) })
          throw err
        }),
      )
    }
    const settled = await Promise.allSettled(pending)
    const failures = settled
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason)
    return { settled, failures }
  }

  async function dispatchTo(subscriptions: Map<any, Subscription[]>, payload: Envelope<any>) {
    if (payload.type === "*") {
      const exact = await dispatchPhase(subscriptions, payload, payload.type)
      if (exact.failures.length === 1) throw exact.failures[0]
      if (exact.failures.length > 1) {
        throw new AggregateError(exact.failures, `${exact.failures.length} Bus subscribers failed for ${payload.type}`)
      }
      return exact.settled
    }
    // Start both local phases before awaiting either receipt. A slow peer on
    // the exact channel must not prevent the durable wildcard consumer from
    // accepting the same occurrence.
    const [exact, wildcard] = await Promise.all([
      dispatchPhase(subscriptions, payload, payload.type),
      dispatchPhase(subscriptions, payload, "*"),
    ])
    const failures = [...exact.failures, ...wildcard.failures]
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) {
      throw new AggregateError(failures, `${failures.length} Bus subscribers failed for ${payload.type}`)
    }
    return [...exact.settled, ...wildcard.settled]
  }

  const state = createInstanceState(
    () => {
      const subscriptions = new Map<any, Subscription[]>()

      return {
        subscriptions,
        durableSubscriptions: new Map<string, Subscription>(),
      }
    },
    async (current) => {
      await dispatchTo(current.subscriptions, {
        occurrenceID: occurrenceID(),
        type: InstanceDisposed.type,
        properties: {
          directory: currentProjectDirectory(),
        },
      })
    },
    "bus",
  )

  const ownedPublicationOwners = new Map<string, OwnedPublication>()
  let automaticDrainSuppressedForTest = false
  let durableRetryMetadataReadFailuresForTest = 0
  let durableRetryMetadataWriteFailuresForTest = 0

  function observePublishPromise<T extends Promise<unknown>>(promise: T, type: string): T {
    void promise.catch((err) => {
      log.warn("publish failed", { type, error: err instanceof Error ? err.message : String(err) })
    })
    return promise
  }

  function publishPrepared(
    payload: Envelope<any>,
    directory: string,
    subscriptions: Map<any, Subscription[]>,
  ): Publication {
    let result: Promise<void>
    let reservation: RuntimeExecutionReservation | undefined
    try {
      reservation = RuntimeExecutionSettlement.reserve("protocol_publication", `${payload.type}:${payload.occurrenceID}`)
      result = executePublication(payload, directory, subscriptions, reservation.signal)
      reservation.settleWith(result)
    } catch (error) {
      reservation?.settle()
      result = Promise.reject(error)
    }
    const observed = observePublishPromise(result, payload.type) as Publication
    Object.defineProperties(observed, {
      occurrenceID: { value: payload.occurrenceID, enumerable: true },
      retry: {
        value: () => retryPrepared(payload, directory),
        enumerable: false,
      },
    })
    return observed
  }

  async function executePublication(
    payload: Envelope<any>,
    directory: string,
    subscriptions: Map<any, Subscription[]>,
    signal: AbortSignal,
  ): Promise<void> {
    const deliveryPayload = { ...payload } as Envelope<any>
    Object.defineProperty(deliveryPayload, "signal", { value: signal, enumerable: false })
    const failures: unknown[] = []
    try {
      await dispatchTo(subscriptions, deliveryPayload)
    } catch (error) {
      failures.push(error)
    }
    try {
      await GlobalBus.emitAndWait("event", { directory, payload: deliveryPayload })
    } catch (error) {
      failures.push(error)
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, `Bus publication failed for ${payload.type}`)
  }

  function retryPrepared(payload: Envelope<any>, directory: string): Publication {
    let reservation: RuntimeExecutionReservation | undefined
    let operation: Promise<void>
    try {
      reservation = RuntimeExecutionSettlement.reserve(
        "protocol_publication",
        `${payload.type}:${payload.occurrenceID}:retry`,
      )
      operation = (async () => {
        const { runWithInitializedIndependentProject } = await import("../project/independent-project-owner")
        await runWithInitializedIndependentProject({
          directory,
          signal: reservation!.signal,
          fn: () => executePublication(payload, directory, state().subscriptions, reservation!.signal),
        })
      })()
      reservation.settleWith(operation)
    } catch (error) {
      reservation?.settle()
      operation = Promise.reject(error)
    }
    const observed = observePublishPromise(operation, payload.type) as Publication
    Object.defineProperties(observed, {
      occurrenceID: { value: payload.occurrenceID, enumerable: true },
      retry: { value: () => retryPrepared(payload, directory), enumerable: false },
    })
    return observed
  }

  function scheduleOwnedPublicationRetry(entry: OwnedPublication) {
    if (processSettlementGate) {
      processSettlementGate.owners.set(entry.occurrenceID, entry)
      cancelOwnedPublicationRetry(entry)
      return
    }
    if (entry.retryTimer) return
    const retryEpoch = ++entry.retryEpoch
    let retryAt = Date.now() + 250
    if (entry.durable) {
      try {
        if (durableRetryMetadataReadFailuresForTest > 0) {
          durableRetryMetadataReadFailuresForTest -= 1
          throw new Error("injected durable Bus retry metadata read failure")
        }
        retryAt = durableRow(entry.occurrenceID)?.next_attempt_at ?? retryAt
      } catch (error) {
        entry.error = error
        log.warn("durable Bus retry schedule metadata read failed", {
          occurrenceID: entry.occurrenceID,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    entry.retryTimer = setTimeout(() => {
      Database.runOutsideContext(() =>
        runOutsideInstanceContext(() => {
          if (entry.retryEpoch !== retryEpoch || ownedPublicationOwners.get(entry.occurrenceID) !== entry) return
          entry.retryTimer = undefined
          if (entry.pending || entry.error === undefined) return
          try {
            if (entry.durable) {
              if (!durableOutboxExists(entry.occurrenceID)) {
                ownedPublicationOwners.delete(entry.occurrenceID)
                return
              }
              trackOwnedPublication(entry, executeDurableOccurrence(entry.occurrenceID))
              return
            }
            trackOwnedPublication(entry, entry.current.retry())
          } catch (error) {
            entry.error = error
            scheduleOwnedPublicationRetry(entry)
          }
        }),
      )
    }, Math.min(2_147_483_647, Math.max(0, retryAt - Date.now())))
    entry.retryTimer.unref()
  }

  function recordDurablePublicationFailure(entry: OwnedPublication, error: unknown): void {
    if (durableRetryMetadataWriteFailuresForTest > 0) {
      durableRetryMetadataWriteFailuresForTest -= 1
      throw new Error("injected durable Bus retry metadata write failure")
    }
    const row = durableRow(entry.occurrenceID)
    if (!row) return
    const attempt = row.attempt_count + 1
    const exponential = Math.min(30_000, 250 * 2 ** Math.min(16, attempt - 1))
    let jitterHash = attempt >>> 0
    for (let index = 0; index < entry.occurrenceID.length; index += 1) {
      jitterHash = Math.imul(jitterHash ^ entry.occurrenceID.charCodeAt(index), 16_777_619) >>> 0
    }
    const jitter = Math.floor((exponential * (jitterHash % 25)) / 100)
    Database.use((db) =>
      db
        .update(BusPublicationOutboxTable)
        .set({
          attempt_count: attempt,
          next_attempt_at: Date.now() + exponential + jitter,
          last_error: error instanceof Error ? error.message : String(error),
          time_updated: Date.now(),
        })
        .where(eq(BusPublicationOutboxTable.occurrence_id, entry.occurrenceID))
        .run(),
    )
  }

  function cancelOwnedPublicationRetry(entry: OwnedPublication) {
    entry.retryEpoch += 1
    if (entry.retryTimer) clearTimeout(entry.retryTimer)
    entry.retryTimer = undefined
  }

  function trackOwnedPublication(entry: OwnedPublication, publication: Publication) {
    entry.current = publication
    entry.error = undefined
    let pending!: Promise<void>
    pending = publication
      .then(
        () => {
          if (ownedPublicationOwners.get(publication.occurrenceID) === entry) {
            cancelOwnedPublicationRetry(entry)
            ownedPublicationOwners.delete(publication.occurrenceID)
          }
        },
        (error) => {
          entry.error = error
          if (error instanceof RuntimeExecutionAdmissionClosedError && error.kind === "protocol_publication") {
            cancelOwnedPublicationRetry(entry)
            return
          }
          if (entry.durable) {
            try {
              recordDurablePublicationFailure(entry, error)
            } catch (metadataError) {
              log.warn("durable Bus retry metadata write failed", {
                occurrenceID: entry.occurrenceID,
                error: metadataError instanceof Error ? metadataError.message : String(metadataError),
              })
            }
          }
          scheduleOwnedPublicationRetry(entry)
        },
      )
      .finally(() => {
        if (entry.pending === pending) entry.pending = undefined
      })
    entry.pending = pending
  }

  export function own(publication: Publication): void {
    const existing = ownedPublicationOwners.get(publication.occurrenceID)
    if (existing?.current === publication) return
    const entry = existing ?? {
      occurrenceID: publication.occurrenceID,
      directory: currentProjectDirectory(),
      current: publication,
      retryEpoch: 0,
      durable: false,
    }
    ownedPublicationOwners.set(publication.occurrenceID, entry)
    trackOwnedPublication(entry, publication)
  }

  RuntimeExecutionSettlement.onAdmissionReopened("protocol_publication", () => {
    if (processSettlementGate) return
    for (const entry of ownedPublicationOwners.values()) {
      if (entry.pending || entry.error === undefined) continue
      cancelOwnedPublicationRetry(entry)
      Database.runOutsideContext(() =>
        runOutsideInstanceContext(() => {
          if (entry.durable) {
            if (!durableOutboxExists(entry.occurrenceID)) {
              ownedPublicationOwners.delete(entry.occurrenceID)
              return
            }
            scheduleOwnedPublicationRetry(entry)
            return
          }
          trackOwnedPublication(entry, entry.current.retry())
        }),
      )
    }
  })

  export type ProcessSettlementGate = Disposable & {
    commit(): void
    rollback(): () => Promise<void>
  }

  export function acquireProcessSettlementGate(): ProcessSettlementGate {
    if (processSettlementGate) throw new Error("Bus process settlement is already in progress")
    const scope: ProcessSettlementScope = { token: Symbol("bus-process-settlement"), owners: new Map() }
    for (const entry of ownedPublicationOwners.values()) {
      if (entry.durable && !durableOutboxExists(entry.occurrenceID)) continue
      scope.owners.set(entry.occurrenceID, entry)
      cancelOwnedPublicationRetry(entry)
    }
    processSettlementGate = scope
    let decision: "pending" | "commit" | "rollback" = "pending"
    let disposed = false
    let rollbackCompleted = false
    let rollbackOperation: Promise<void> | undefined
    return {
      commit() {
        if (decision === "rollback") throw new Error("Bus process settlement rollback is already authoritative")
        decision = "commit"
      },
      rollback() {
        if (decision === "commit") throw new Error("Bus process settlement commit is already authoritative")
        decision = "rollback"
        return async () => {
          if (!disposed) throw new Error("Bus rollback can resume only after all runtime admission gates reopen")
          if (rollbackCompleted) return
          if (rollbackOperation) return await rollbackOperation
          rollbackOperation = (async () => {
            const failures: unknown[] = []
            for (const [occurrenceID, captured] of scope.owners) {
              try {
                if (captured.durable && !durableOutboxExists(occurrenceID)) {
                  if (ownedPublicationOwners.get(occurrenceID) === captured) {
                    ownedPublicationOwners.delete(occurrenceID)
                  }
                  continue
                }
                let entry = ownedPublicationOwners.get(occurrenceID)
                let publication: Publication
                if (entry?.pending) {
                  publication = entry.current
                } else {
                  publication = captured.durable
                    ? executeDurableOccurrence(occurrenceID)
                    : captured.current.retry()
                  entry = entry ?? {
                    occurrenceID,
                    directory: captured.directory,
                    current: publication,
                    retryEpoch: 0,
                    durable: captured.durable,
                  }
                  ownedPublicationOwners.set(occurrenceID, entry)
                  trackOwnedPublication(entry, publication)
                }
                await publication
              } catch (error) {
                failures.push(error)
              }
            }
            if (failures.length > 0) {
              throw new AggregateError(failures, "Failed to resume Bus publications after runtime rollback")
            }
          })()
          try {
            await rollbackOperation
            rollbackCompleted = true
          } finally {
            rollbackOperation = undefined
          }
        }
      },
      [Symbol.dispose]() {
        if (processSettlementGate?.token !== scope.token) return
        if (decision === "pending") {
          throw new Error("Bus process settlement gate requires an explicit commit or rollback decision")
        }
        const failures: unknown[] = []
        if (decision === "commit") {
          for (const [occurrenceID, captured] of scope.owners) {
            cancelOwnedPublicationRetry(captured)
            if (captured.pending) {
              failures.push(new Error(`Bus publication ${occurrenceID} is still physically running at commit`))
              continue
            }
            if (ownedPublicationOwners.get(occurrenceID) === captured) {
              ownedPublicationOwners.delete(occurrenceID)
            }
          }
        }
        processSettlementGate = undefined
        disposed = true
        if (failures.length > 0) throw new AggregateError(failures, "Bus process settlement commit failed")
      },
    }
  }

  type DurableRow = typeof BusPublicationOutboxTable.$inferSelect
  type DurablePhase = "exact" | "wildcard" | "global"
  type DurableTarget = {
    id: string
    durable: boolean
    settleFailure?: boolean
    deliver: () => unknown | Promise<unknown>
  }

  function durableOutboxExists(id: string) {
    return Database.use((db) =>
      Boolean(
        db
          .select({ id: BusPublicationOutboxTable.occurrence_id })
          .from(BusPublicationOutboxTable)
          .where(eq(BusPublicationOutboxTable.occurrence_id, id))
          .get(),
      ),
    )
  }

  function durableRow(id: string): DurableRow | undefined {
    return Database.use((db) =>
      db.select().from(BusPublicationOutboxTable).where(eq(BusPublicationOutboxTable.occurrence_id, id)).get(),
    )
  }

  function phaseSettled(row: DurableRow, phase: DurablePhase) {
    if (phase === "exact") return row.exact_settled
    if (phase === "wildcard") return row.wildcard_settled
    return row.global_settled
  }

  function settlePhase(id: string, phase: DurablePhase) {
    const field =
      phase === "exact"
        ? { exact_settled: true }
        : phase === "wildcard"
          ? { wildcard_settled: true }
          : { global_settled: true }
    Database.use((db) =>
      db
        .update(BusPublicationOutboxTable)
        .set({ ...field, time_updated: Date.now() })
        .where(eq(BusPublicationOutboxTable.occurrence_id, id))
        .run(),
    )
  }

  async function dispatchDurableTargets(payload: Envelope<any>, phase: DurablePhase, targets: DurableTarget[]) {
    const activeIDs = new Set(targets.map((target) => target.id))
    Database.transaction((db) => {
      const stale = db
        .select()
        .from(BusPublicationDeliveryTable)
        .where(
          and(
            eq(BusPublicationDeliveryTable.occurrence_id, payload.occurrenceID),
            eq(BusPublicationDeliveryTable.phase, phase),
            eq(BusPublicationDeliveryTable.durable, false),
            eq(BusPublicationDeliveryTable.settled, false),
          ),
        )
        .all()
      for (const receipt of stale) {
        if (activeIDs.has(receipt.subscriber_id)) continue
        db.update(BusPublicationDeliveryTable)
          .set({ settled: true, time_updated: Date.now() })
          .where(
            and(
              eq(BusPublicationDeliveryTable.occurrence_id, payload.occurrenceID),
              eq(BusPublicationDeliveryTable.phase, phase),
              eq(BusPublicationDeliveryTable.subscriber_id, receipt.subscriber_id),
            ),
          )
          .run()
      }
      for (const target of targets) {
        db.insert(BusPublicationDeliveryTable)
          .values({
            occurrence_id: payload.occurrenceID,
            phase,
            subscriber_id: target.id,
            durable: target.durable,
            settled: false,
            time_created: Date.now(),
            time_updated: Date.now(),
          })
          .onConflictDoNothing()
          .run()
      }
    })

    const failures: unknown[] = []
    const settleDelivery = (subscriberID: string) =>
      Database.use((db) =>
        db
          .update(BusPublicationDeliveryTable)
          .set({ settled: true, time_updated: Date.now() })
          .where(
            and(
              eq(BusPublicationDeliveryTable.occurrence_id, payload.occurrenceID),
              eq(BusPublicationDeliveryTable.phase, phase),
              eq(BusPublicationDeliveryTable.subscriber_id, subscriberID),
            ),
          )
          .run(),
      )
    for (const target of targets) {
      const receipt = Database.use((db) =>
        db
          .select({ settled: BusPublicationDeliveryTable.settled })
          .from(BusPublicationDeliveryTable)
          .where(
            and(
              eq(BusPublicationDeliveryTable.occurrence_id, payload.occurrenceID),
              eq(BusPublicationDeliveryTable.phase, phase),
              eq(BusPublicationDeliveryTable.subscriber_id, target.id),
            ),
          )
          .get(),
      )
      if (receipt?.settled) continue
      try {
        await target.deliver()
        settleDelivery(target.id)
      } catch (error) {
        if (target.settleFailure) {
          settleDelivery(target.id)
          log.warn("transient Bus projection failed", {
            occurrenceID: payload.occurrenceID,
            subscriberID: target.id,
            error: error instanceof Error ? error.message : String(error),
          })
        } else {
          failures.push(error)
        }
      }
    }
    const durablePending = Database.use((db) =>
      db
        .select({ id: BusPublicationDeliveryTable.subscriber_id })
        .from(BusPublicationDeliveryTable)
        .where(
          and(
            eq(BusPublicationDeliveryTable.occurrence_id, payload.occurrenceID),
            eq(BusPublicationDeliveryTable.phase, phase),
            eq(BusPublicationDeliveryTable.durable, true),
            eq(BusPublicationDeliveryTable.settled, false),
          ),
        )
        .all(),
    )
    if (durablePending.some((entry) => !activeIDs.has(entry.id))) {
      failures.push(new Error(`Durable Bus ${phase} subscriber is unavailable for ${payload.occurrenceID}`))
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, `Durable Bus ${phase} phase failed`)
    settlePhase(payload.occurrenceID, phase)
  }

  async function executeDurableRow(row: DurableRow, signal: AbortSignal) {
    const payload: Envelope<any> = {
      occurrenceID: row.occurrence_id,
      type: row.event_type,
      properties: row.properties,
      ...(row.causation ? { causation: row.causation as Causation } : {}),
    }
    Object.defineProperty(payload, "signal", { value: signal, enumerable: false })
    const failures: unknown[] = []
    await Promise.all(
      (["exact", "wildcard"] as const).map(async (phase) => {
        if (phaseSettled(row, phase)) return
        try {
          const key = phase === "exact" ? payload.type : "*"
          const targets = [...(state().subscriptions.get(key) ?? [])].map((sub) => ({
            id: sub.id,
            durable: sub.durable,
            settleFailure: !sub.durable,
            deliver: () => sub.callback(payload),
          }))
          await dispatchDurableTargets(payload, phase, targets)
        } catch (error) {
          failures.push(error)
        }
      }),
    )
    if (!phaseSettled(row, "global")) {
      try {
        const targets = GlobalBus.deliveryTargets("event").map((target) => ({
          id: target.id,
          durable: target.durable,
          settleFailure: !target.durable,
          deliver: () => target.deliver({ directory: row.directory, payload }),
        }))
        await dispatchDurableTargets(payload, "global", targets)
      } catch (error) {
        failures.push(error)
      }
    }
    const refreshed = durableRow(row.occurrence_id)
    if (refreshed?.exact_settled && refreshed.wildcard_settled && refreshed.global_settled) {
      Database.use((db) =>
        db.delete(BusPublicationOutboxTable).where(eq(BusPublicationOutboxTable.occurrence_id, row.occurrence_id)).run(),
      )
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, `Durable Bus publication failed for ${row.event_type}`)
  }

  function executeDurableOccurrence(id: string): Publication {
    const row = durableRow(id)
    if (!row) {
      const complete = Promise.resolve() as Publication
      Object.defineProperties(complete, {
        occurrenceID: { value: id, enumerable: true },
        retry: { value: () => retryDurableOccurrence(id), enumerable: false },
      })
      return complete
    }
    let reservation: RuntimeExecutionReservation | undefined
    let operation: Promise<void>
    try {
      reservation = RuntimeExecutionSettlement.reserve("protocol_publication", `${row.event_type}:${id}:outbox`)
      operation =
        Instance.current()?.directory === row.directory
          ? executeDurableRow(row, reservation.signal)
          : (async () => {
              const resumedActive = await Instance.tryProvideActive({
                directory: row.directory,
                fn: async () => {
                  await executeDurableRow(durableRow(id) ?? row, reservation!.signal)
                  return true
                },
              })
              if (resumedActive) return
              const { runWithInitializedIndependentProject } = await import("../project/independent-project-owner")
              await runWithInitializedIndependentProject({
                directory: row.directory,
                signal: reservation!.signal,
                fn: () => executeDurableRow(durableRow(id) ?? row, reservation!.signal),
              })
            })()
      reservation.settleWith(operation)
    } catch (error) {
      reservation?.settle()
      operation = Promise.reject(error)
    }
    const publication = observePublishPromise(operation, row.event_type) as Publication
    Object.defineProperties(publication, {
      occurrenceID: { value: id, enumerable: true },
      retry: { value: () => retryDurableOccurrence(id), enumerable: false },
    })
    return publication
  }

  function retryDurableOccurrence(id: string): Publication {
    const existing = ownedPublicationOwners.get(id)
    if (existing?.pending) return existing.current
    if (existing) cancelOwnedPublicationRetry(existing)
    const publication = executeDurableOccurrence(id)
    const row = durableRow(id)
    if (!row && !existing) return publication
    const entry =
      existing ??
      ({
        occurrenceID: id,
        directory: row!.directory,
        current: publication,
        retryEpoch: 0,
        durable: true,
      } satisfies OwnedPublication)
    ownedPublicationOwners.set(id, entry)
    trackOwnedPublication(entry, publication)
    return publication
  }

  function dormantDurablePublication(id: string): Publication {
    const publication = Promise.resolve() as Publication
    Object.defineProperties(publication, {
      occurrenceID: { value: id, enumerable: true },
      retry: { value: () => retryDurableOccurrence(id), enumerable: false },
    })
    return publication
  }

  export function resumeDurablePublications(directory = currentProjectDirectory()): void {
    const rows = Database.use((db) =>
      db
        .select({
          id: BusPublicationOutboxTable.occurrence_id,
          next_attempt_at: BusPublicationOutboxTable.next_attempt_at,
          last_error: BusPublicationOutboxTable.last_error,
        })
        .from(BusPublicationOutboxTable)
        .where(eq(BusPublicationOutboxTable.directory, directory))
        .all(),
    )
    for (const row of rows) {
      const existing = ownedPublicationOwners.get(row.id)
      if (existing?.pending) continue
      if (row.next_attempt_at > Date.now()) {
        const entry =
          existing ??
          ({
            occurrenceID: row.id,
            directory,
            current: dormantDurablePublication(row.id),
            retryEpoch: 0,
            durable: true,
          } satisfies OwnedPublication)
        entry.error = new Error(row.last_error ?? `Durable Bus occurrence ${row.id} is awaiting retry`)
        ownedPublicationOwners.set(row.id, entry)
        scheduleOwnedPublicationRetry(entry)
        continue
      }
      const publication = executeDurableOccurrence(row.id)
      const entry =
        existing ??
        ({ occurrenceID: row.id, directory, current: publication, retryEpoch: 0, durable: true } satisfies OwnedPublication)
      ownedPublicationOwners.set(row.id, entry)
      trackOwnedPublication(entry, publication)
    }
  }

  export function publishOwnedInTransaction<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ): Publication {
    Database.requireActiveTransaction("Bus.publishOwnedInTransaction")
    const id = occurrenceID()
    const parsed = BusEvent.parseProperties(def, properties)
    const directory = currentProjectDirectory()
    const projectID = Instance.project.id
    const causation = causationContext.tryUse()
    const accepted = Promise.resolve() as Publication
    Object.defineProperties(accepted, {
      occurrenceID: { value: id, enumerable: true },
      retry: { value: () => retryDurableOccurrence(id), enumerable: false },
    })
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(BusPublicationOutboxTable)
        .values({
          occurrence_id: id,
          project_id: projectID,
          directory,
          event_type: def.type,
          properties: parsed,
          causation,
          time_created: now,
          time_updated: now,
        })
        .run(),
    )
    Database.effect(() => {
      if (automaticDrainSuppressedForTest) return
      Database.runOutsideContext(() => {
        const publication = executeDurableOccurrence(id)
        const entry = {
          occurrenceID: id,
          directory,
          current: publication,
          retryEpoch: 0,
          durable: true,
        } satisfies OwnedPublication
        ownedPublicationOwners.set(id, entry)
        trackOwnedPublication(entry, publication)
      })
    })
    return accepted
  }

  function stageDurablePublication<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ): Publication {
    let publication: Publication | undefined
    Database.transaction(() => {
      publication = publishOwnedInTransaction(def, properties)
    })
    return publication!
  }

  export function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ): Publication {
    const id = occurrenceID()
    try {
      const parsed = BusEvent.parseProperties(def, properties)
      const payload = {
        occurrenceID: id,
        type: def.type,
        properties: parsed,
        ...(causationContext.tryUse() ? { causation: causationContext.use() } : {}),
      }
      log.debug("publishing", {
        type: def.type,
      })
      const directory = currentProjectDirectory()
      const current = state()
      return publishPrepared(payload, directory, current.subscriptions)
    } catch (err) {
      const rejected = observePublishPromise(Promise.reject(err), def.type) as Publication
      Object.defineProperties(rejected, {
        occurrenceID: { value: id, enumerable: true },
        retry: { value: () => publish(def, properties), enumerable: false },
      })
      return rejected
    }
  }

  /** Fire-and-forget publication with a durable in-process retry owner. */
  export function publishOwned<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ): Publication {
    return stageDurablePublication(def, properties)
  }

  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      occurrenceID: string
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => unknown | Promise<unknown>,
    options?: { durableID: string },
  ) {
    return raw(def.type, callback, options)
  }

  export function subscribeAll(
    callback: (event: any) => unknown | Promise<unknown>,
    options?: { durableID: string },
  ) {
    return raw("*", callback, options)
  }

  export function subscriptionStats() {
    const subscriptions = state().subscriptions
    let callbacks = 0
    for (const match of subscriptions.values()) callbacks += match.length
    return {
      types: subscriptions.size,
      callbacks,
    }
  }

  export namespace TestHooks {
    export function ownedPublications() {
      return [...ownedPublicationOwners.entries()].map(([id, entry]) => ({
          directory: entry.directory,
          id,
          pending: Boolean(entry.pending),
          failed: entry.error !== undefined,
        }))
    }

    export function ownedPublicationRetryScheduled(occurrenceID: string): boolean {
      return Boolean(ownedPublicationOwners.get(occurrenceID)?.retryTimer)
    }

    export function failNextDurableRetryMetadata(input: { reads?: number; writes?: number }): Disposable {
      if (durableRetryMetadataReadFailuresForTest > 0 || durableRetryMetadataWriteFailuresForTest > 0) {
        throw new Error("Durable Bus retry metadata failure hook is already installed")
      }
      durableRetryMetadataReadFailuresForTest = input.reads ?? 0
      durableRetryMetadataWriteFailuresForTest = input.writes ?? 0
      return {
        [Symbol.dispose]() {
          durableRetryMetadataReadFailuresForTest = 0
          durableRetryMetadataWriteFailuresForTest = 0
        },
      }
    }

    export async function disposeOwnedState() {
      const pending = [...ownedPublicationOwners.values()].flatMap((entry) => (entry.pending ? [entry.pending] : []))
      if (pending.length > 0) await Promise.allSettled(pending)
      const failures = [...ownedPublicationOwners.values()].flatMap((entry) =>
        entry.error === undefined ? [] : [entry.error],
      )
      if (failures.length > 0) {
        throw new AggregateError(failures, `${failures.length} owned Bus publication(s) remain unresolved`)
      }
      for (const entry of ownedPublicationOwners.values()) if (entry.retryTimer) clearTimeout(entry.retryTimer)
      ownedPublicationOwners.clear()
    }

    export function suppressAutomaticDurableDrain() {
      automaticDrainSuppressedForTest = true
      return {
        [Symbol.dispose]() {
          automaticDrainSuppressedForTest = false
        },
      }
    }

    export function outbox() {
      return Database.use((db) => db.select().from(BusPublicationOutboxTable).all())
    }

    export function deliveries(occurrenceID: string) {
      return Database.use((db) =>
        db
          .select()
          .from(BusPublicationDeliveryTable)
          .where(eq(BusPublicationDeliveryTable.occurrence_id, occurrenceID))
          .all(),
      )
    }
  }

  export function once<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: {
      occurrenceID: string
      type: Definition["type"]
      properties: z.infer<Definition["properties"]>
    }) => unknown | Promise<unknown>,
  ) {
    const unsub = raw(def.type, async (event) => {
      const result = await callback(event)
      if (result === "done") unsub()
    })
    return unsub
  }

  function raw(
    type: string,
    callback: (event: any) => unknown | Promise<unknown>,
    options?: { durableID: string },
  ) {
    log.debug("subscribing", { type })
    if (isBusTraceEnabled()) {
      const stack = new Error().stack
        ?.split("\n")
        .slice(2, 6)
        .map((x) => x.trim())
        .join(" | ")
      traceBus({
        phase: "subscribe",
        type,
        callback: callback.name || "anonymous",
        source: stack,
      })
    }
    const current = state()
    const subscriptions = current.subscriptions
    const durableKey = options ? `${type}\u0000${options.durableID}` : undefined
    if (durableKey) {
      const existing = current.durableSubscriptions.get(durableKey)
      if (existing && existing.callback !== callback) {
        throw new DurableBusSubscriptionIdentityConflictError({
          channel: `local:${type}`,
          durableID: options!.durableID,
        })
      }
      if (existing) return createUnsubscribe(existing)
    }
    const subscription: Subscription = {
      callback,
      id: options?.durableID ?? `runtime:${runtimeSubscriptionID}:${++subscriptionSequence}`,
      durable: options !== undefined,
      source: isBusTraceEnabled() ? new Error().stack?.split("\n").slice(2, 6).map((x) => x.trim()).join(" | ") : undefined,
    }
    if (durableKey) current.durableSubscriptions.set(durableKey, subscription)
    let match = subscriptions.get(type) ?? []
    match.push(subscription)
    subscriptions.set(type, match)

    function createUnsubscribe(target: Subscription) {
      return () => {
      log.debug("unsubscribing", { type })
      const match = subscriptions.get(type)
      if (!match) return
      const index = match.indexOf(target)
      if (index === -1) return
      match.splice(index, 1)
      if (durableKey && current.durableSubscriptions.get(durableKey) === target) {
        current.durableSubscriptions.delete(durableKey)
      }
      if (match.length === 0) subscriptions.delete(type)
      }
    }
    return createUnsubscribe(subscription)
  }
}
