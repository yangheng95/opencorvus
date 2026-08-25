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
import { Database, and, asc, eq, inArray, isNotNull, isNull } from "../storage/db"
import {
  BusPublicationAttemptReceiptTable,
  BusPublicationDeliveryReceiptTable,
  BusPublicationDeliveryTable,
  BusPublicationOutboxTable,
  BusPublicationPhaseReceiptTable,
} from "./bus.sql"
import { Instance, runAsInstanceActivity, runOutsideInstanceContext } from "../project/instance"
import { Identifier } from "@/id/id"
import { acquireControlLease, currentControlLeaseInTransaction, releaseControlLeaseInTransaction, renewControlLease } from "@/engine/control-lease"

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
  }

  const causationContext = Context.create<Causation>("bus-causation")

  export function withCausation<R>(causation: Causation, fn: () => R): R {
    return causationContext.provide(causation, fn)
  }

  type Subscription = {
    callback: (event: Envelope<any>) => unknown | Promise<unknown>
    id: string
    durable: boolean
    effectContract?: "idempotent_by_occurrence"
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
      reservation = RuntimeExecutionSettlement.reserve(
        "protocol_publication",
        `${payload.type}:${payload.occurrenceID}`,
      )
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
        retryAt = durableAttemptProjection(entry.occurrenceID)?.retry_at ?? retryAt
      } catch (error) {
        entry.error = error
        log.warn("durable Bus retry schedule metadata read failed", {
          occurrenceID: entry.occurrenceID,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    entry.retryTimer = setTimeout(
      () => {
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
      },
      Math.min(2_147_483_647, Math.max(0, retryAt - Date.now())),
    )
    entry.retryTimer.unref()
  }

  function recordDurablePublicationFailure(entry: OwnedPublication, error: unknown): void {
    if (durableRetryMetadataWriteFailuresForTest > 0) {
      durableRetryMetadataWriteFailuresForTest -= 1
      throw new Error("injected durable Bus retry metadata write failure")
    }
    if (!durableRow(entry.occurrenceID)) return
    const attempt = durableAttemptReceipts(entry.occurrenceID).length + 1
    const exponential = Math.min(30_000, 250 * 2 ** Math.min(16, attempt - 1))
    let jitterHash = attempt >>> 0
    for (let index = 0; index < entry.occurrenceID.length; index += 1) {
      jitterHash = Math.imul(jitterHash ^ entry.occurrenceID.charCodeAt(index), 16_777_619) >>> 0
    }
    const jitter = Math.floor((exponential * (jitterHash % 25)) / 100)
    const now = Date.now()
    Database.use((db) => db.insert(BusPublicationAttemptReceiptTable).values({
      id: Identifier.ascending("call"),
      occurrence_id: entry.occurrenceID,
      error: error instanceof Error ? error.message : String(error),
      retry_at: now + exponential + jitter,
      time_created: now,
    }).run())
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
                  publication = captured.durable ? executeDurableOccurrence(occurrenceID) : captured.current.retry()
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
    effectContract?: "idempotent_by_occurrence"
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

  function durableAttemptReceipts(id: string) {
    return Database.use((db) => db.select().from(BusPublicationAttemptReceiptTable)
      .where(eq(BusPublicationAttemptReceiptTable.occurrence_id, id))
      .orderBy(asc(BusPublicationAttemptReceiptTable.time_created), asc(BusPublicationAttemptReceiptTable.id)).all())
  }

  function durableAttemptProjection(id: string) {
    return durableAttemptReceipts(id).at(-1)
  }

  function phaseSettled(row: DurableRow, phase: DurablePhase) {
    return Database.use((db) => Boolean(db.select({ id: BusPublicationPhaseReceiptTable.id })
      .from(BusPublicationPhaseReceiptTable)
      .where(and(
        eq(BusPublicationPhaseReceiptTable.occurrence_id, row.occurrence_id),
        eq(BusPublicationPhaseReceiptTable.phase, phase),
      )).get()))
  }

  function settlePhase(id: string, phase: DurablePhase) {
    Database.use((db) => db.insert(BusPublicationPhaseReceiptTable).values({
      id: Identifier.deterministic("call", `bus-phase\0${id}\0${phase}`),
      occurrence_id: id,
      phase,
      time_created: Date.now(),
    }).onConflictDoNothing().run())
  }

  async function dispatchDurableTargets(payload: Envelope<any>, phase: DurablePhase, targets: DurableTarget[]) {
    const activeIDs = new Set(targets.map((target) => target.id))
    const deliveryOutcome = (subscriberID: string) => Database.use((db) => {
      const outcomes = db
      .select({ outcome: BusPublicationDeliveryReceiptTable.outcome })
      .from(BusPublicationDeliveryReceiptTable)
      .where(and(
        eq(BusPublicationDeliveryReceiptTable.occurrence_id, payload.occurrenceID),
        eq(BusPublicationDeliveryReceiptTable.phase, phase),
        eq(BusPublicationDeliveryReceiptTable.subscriber_id, subscriberID),
      ))
      .orderBy(asc(BusPublicationDeliveryReceiptTable.time_created), asc(BusPublicationDeliveryReceiptTable.id))
      .all()
      if (outcomes.some((receipt) => receipt.outcome === "succeeded")) return "succeeded" as const
      if (outcomes.some((receipt) => receipt.outcome === "ignored")) return "ignored" as const
      return outcomes.at(-1)?.outcome
    })
    Database.transaction((db) => {
      const stale = db
        .select()
        .from(BusPublicationDeliveryTable)
        .where(
          and(
            eq(BusPublicationDeliveryTable.occurrence_id, payload.occurrenceID),
            eq(BusPublicationDeliveryTable.phase, phase),
            isNull(BusPublicationDeliveryTable.effect_contract),
          ),
        )
        .all()
      for (const receipt of stale) {
        if (activeIDs.has(receipt.subscriber_id)) continue
        const settled = db.select({ outcome: BusPublicationDeliveryReceiptTable.outcome })
          .from(BusPublicationDeliveryReceiptTable).where(and(
            eq(BusPublicationDeliveryReceiptTable.occurrence_id, payload.occurrenceID),
            eq(BusPublicationDeliveryReceiptTable.phase, phase),
            eq(BusPublicationDeliveryReceiptTable.subscriber_id, receipt.subscriber_id),
          )).all().some((row) => row.outcome === "succeeded" || row.outcome === "ignored")
        if (!settled) db.insert(BusPublicationDeliveryReceiptTable).values({
          id: Identifier.ascending("call"), occurrence_id: payload.occurrenceID, phase,
          subscriber_id: receipt.subscriber_id, outcome: "ignored", error: null, retry_at: null,
          time_created: Date.now(),
        }).run()
      }
      for (const target of targets) {
        if (target.durable && target.effectContract !== "idempotent_by_occurrence") {
          throw new Error(`Durable Bus subscriber ${target.id} must declare occurrenceID idempotency`)
        }
        db.insert(BusPublicationDeliveryTable)
          .values({
            occurrence_id: payload.occurrenceID,
            phase,
            subscriber_id: target.id,
            effect_contract: target.effectContract ?? null,
            time_created: Date.now(),
          })
          .onConflictDoNothing()
          .run()
        const request = db.select().from(BusPublicationDeliveryTable).where(and(
          eq(BusPublicationDeliveryTable.occurrence_id, payload.occurrenceID),
          eq(BusPublicationDeliveryTable.phase, phase),
          eq(BusPublicationDeliveryTable.subscriber_id, target.id),
        )).get()
        if (!request || (request.effect_contract !== null) !== target.durable || request.effect_contract !== (target.effectContract ?? null)) {
          throw new Error(`Durable Bus subscriber ${target.id} changed its immutable delivery contract`)
        }
      }
    })

    const failures: unknown[] = []
    for (const target of targets) {
      const prior = deliveryOutcome(target.id)
      if (prior === "succeeded" || prior === "ignored") continue
      const deliveryID = `${payload.occurrenceID}\0${phase}\0${target.id}`
      const ownerID = `bus:${runtimeSubscriptionID}`
      const now = Date.now()
      // Receipts now end their own lease, so a live lease for this exact
      // delivery is a real concurrent owner rather than this runtime's own
      // leftover. Reusing one would have been a way of tolerating a lease that
      // nothing handed back.
      const lease = acquireControlLease({ target: "bus_delivery", targetID: deliveryID, ownerOccurrenceID: ownerID, now, leaseMilliseconds: 30_000 })
      if (!lease.acquired) {
        failures.push(new Error(`Durable Bus delivery ${deliveryID} is leased by another runtime`))
        continue
      }
      const renewal = setInterval(() => {
        try {
          renewControlLease({ target: "bus_delivery", targetID: deliveryID, leaseID: lease.lease.id, ownerOccurrenceID: ownerID, now: Date.now(), expiresAt: Date.now() + 30_000 })
        } catch (error) {
          // Either this delivery's own receipt already ended the lease, or
          // another runtime took it. The receipt fence below surfaces the
          // second case, but saying so here is what makes it diagnosable.
          log.warn("durable Bus delivery lease renewal ended", {
            deliveryID,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }, 10_000)
      renewal.unref()
      try {
        await target.deliver()
        Database.immediateTransaction((db) => {
          const settledAt = Date.now()
          const current = currentControlLeaseInTransaction(db, "bus_delivery", deliveryID)
          if (!current || current.id !== lease.lease.id || current.owner_occurrence_id !== ownerID || current.expires_at <= settledAt) throw new Error(`Durable Bus delivery ${deliveryID} lost its lease before receipt`)
          db.insert(BusPublicationDeliveryReceiptTable).values({ id: Identifier.ascending("call"), occurrence_id: payload.occurrenceID, phase, subscriber_id: target.id, outcome: "succeeded", error: null, retry_at: null, time_created: settledAt }).run()
          releaseControlLeaseInTransaction(db, { target: "bus_delivery", targetID: deliveryID, leaseID: lease.lease.id, ownerOccurrenceID: ownerID, now: settledAt })
        })
      } catch (error) {
        const outcome = target.settleFailure ? "ignored" as const : "failed" as const
        const settled = Database.immediateTransaction((db) => {
          const terminal = db.select({ outcome: BusPublicationDeliveryReceiptTable.outcome })
            .from(BusPublicationDeliveryReceiptTable)
            .where(and(
              eq(BusPublicationDeliveryReceiptTable.occurrence_id, payload.occurrenceID),
              eq(BusPublicationDeliveryReceiptTable.phase, phase),
              eq(BusPublicationDeliveryReceiptTable.subscriber_id, target.id),
              inArray(BusPublicationDeliveryReceiptTable.outcome, ["succeeded", "ignored"]),
            )).get()
          const settledAt = Date.now()
          const current = currentControlLeaseInTransaction(db, "bus_delivery", deliveryID)
          const held =
            current &&
            current.id === lease.lease.id &&
            current.owner_occurrence_id === ownerID &&
            current.expires_at > settledAt
          if (terminal) {
            // Somebody else — the stale-subscriber sweep, or another runtime —
            // already settled this delivery. This owner writes nothing, so the
            // only thing it still has to do is stop holding the lease.
            if (held) releaseControlLeaseInTransaction(db, { target: "bus_delivery", targetID: deliveryID, leaseID: lease.lease.id, ownerOccurrenceID: ownerID, now: settledAt })
            return { kind: "terminal" as const, outcome: terminal.outcome }
          }
          if (!held) return { kind: "stale" as const }
          db.insert(BusPublicationDeliveryReceiptTable).values({
            id: Identifier.ascending("call"),
            occurrence_id: payload.occurrenceID,
            phase,
            subscriber_id: target.id,
            outcome,
            error: error instanceof Error ? error.message : String(error),
            retry_at: null,
            time_created: settledAt,
          }).run()
          // This delivery has its terminal receipt, so its owner is done.
          releaseControlLeaseInTransaction(db, { target: "bus_delivery", targetID: deliveryID, leaseID: lease.lease.id, ownerOccurrenceID: ownerID, now: settledAt })
          return { kind: "written" as const }
        })
        if (settled.kind === "terminal") continue
        if (settled.kind === "stale") {
          failures.push(new Error(`Durable Bus delivery ${deliveryID} lost its lease before failure receipt`, { cause: error }))
          continue
        }
        if (target.settleFailure) {
          log.warn("transient Bus projection failed", {
            occurrenceID: payload.occurrenceID,
            subscriberID: target.id,
            error: error instanceof Error ? error.message : String(error),
          })
        } else {
          failures.push(error)
        }
      } finally {
        clearInterval(renewal)
      }
    }
    const durableRequests = Database.use((db) =>
      db
        .select({ id: BusPublicationDeliveryTable.subscriber_id })
        .from(BusPublicationDeliveryTable)
        .where(
          and(
            eq(BusPublicationDeliveryTable.occurrence_id, payload.occurrenceID),
            eq(BusPublicationDeliveryTable.phase, phase),
            isNotNull(BusPublicationDeliveryTable.effect_contract),
          ),
        )
        .all(),
    )
    const durablePending = durableRequests.filter((entry) => {
      const outcome = deliveryOutcome(entry.id)
      return outcome !== "succeeded" && outcome !== "ignored"
    })
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
            effectContract: sub.effectContract,
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
          effectContract: target.effectContract,
          settleFailure: !target.durable,
          deliver: () => target.deliver({ directory: row.directory, payload }),
        }))
        await dispatchDurableTargets(payload, "global", targets)
      } catch (error) {
        failures.push(error)
      }
    }
    const refreshed = durableRow(row.occurrence_id)
    if (refreshed && !(["exact", "wildcard", "global"] as const).every((phase) => phaseSettled(refreshed, phase))) {
      failures.push(new Error(`Durable Bus publication ${row.occurrence_id} has unresolved phases`))
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
          ? runAsInstanceActivity(() => executeDurableRow(row, reservation!.signal))
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
        .select({ id: BusPublicationOutboxTable.occurrence_id })
        .from(BusPublicationOutboxTable)
        .where(eq(BusPublicationOutboxTable.directory, directory))
        .all(),
    )
    for (const row of rows) {
      const authority = durableRow(row.id)
      if (!authority || (["exact", "wildcard", "global"] as const).every((phase) => phaseSettled(authority, phase))) continue
      const existing = ownedPublicationOwners.get(row.id)
      if (existing?.pending) continue
      const retry = durableAttemptProjection(row.id)
      if (retry && retry.retry_at > Date.now()) {
        const entry =
          existing ??
          ({
            occurrenceID: row.id,
            directory,
            current: dormantDurablePublication(row.id),
            retryEpoch: 0,
            durable: true,
          } satisfies OwnedPublication)
        entry.error = new Error(retry.error)
        ownedPublicationOwners.set(row.id, entry)
        scheduleOwnedPublicationRetry(entry)
        continue
      }
      const publication = executeDurableOccurrence(row.id)
      const entry =
        existing ??
        ({
          occurrenceID: row.id,
          directory,
          current: publication,
          retryEpoch: 0,
          durable: true,
        } satisfies OwnedPublication)
      ownedPublicationOwners.set(row.id, entry)
      trackOwnedPublication(entry, publication)
    }
  }

  function publishForProjectInTransaction<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    owner: { projectID: string; directory: string },
    operation: string,
  ): Publication {
    Database.requireActiveTransaction(operation)
    const id = occurrenceID()
    const parsed = BusEvent.parseProperties(def, properties)
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
          project_id: owner.projectID,
          directory: owner.directory,
          event_type: def.type,
          properties: parsed,
          causation,
          time_created: now,
        })
        .run(),
    )
    Database.effect(() => {
      if (automaticDrainSuppressedForTest) return
      Database.runOutsideContext(() => {
        const publication = executeDurableOccurrence(id)
        const entry = {
          occurrenceID: id,
          directory: owner.directory,
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

  export function publishOwnedInTransaction<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ): Publication {
    return publishForProjectInTransaction(
      def,
      properties,
      { projectID: Instance.project.id, directory: currentProjectDirectory() },
      "Bus.publishOwnedInTransaction",
    )
  }

  /** Publish from durable Project authority when no live Instance exists, for
   * example while deleting a Task whose registered repository is absent. */
  export function publishProjectOwnedInTransaction<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    owner: { projectID: string; directory: string },
  ): Publication {
    return publishForProjectInTransaction(def, properties, owner, "Bus.publishProjectOwnedInTransaction")
  }

  function stageDurablePublication<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    exactOccurrenceID?: string,
  ): Publication {
    let publication: Publication | undefined
    Database.transaction(() => {
      if (!exactOccurrenceID) {
        publication = publishOwnedInTransaction(def, properties)
        return
      }
      const parsed = BusEvent.parseProperties(def, properties)
      const existing = Database.use((db) => db.select().from(BusPublicationOutboxTable)
        .where(eq(BusPublicationOutboxTable.occurrence_id, exactOccurrenceID)).get())
      if (existing) {
        if (existing.event_type !== def.type || JSON.stringify(existing.properties) !== JSON.stringify(parsed)) {
          throw new Error(`Durable Bus occurrence ${exactOccurrenceID} has conflicting immutable input`)
        }
        publication = dormantDurablePublication(exactOccurrenceID)
        return
      }
      const directory = currentProjectDirectory()
      const projectID = Instance.project.id
      Database.use((db) => db.insert(BusPublicationOutboxTable).values({
        occurrence_id: exactOccurrenceID,
        project_id: projectID,
        directory,
        event_type: def.type,
        properties: parsed,
        causation: causationContext.tryUse(),
        time_created: Date.now(),
      }).run())
      publication = dormantDurablePublication(exactOccurrenceID)
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

  /** Append or replay one deterministic durable occurrence. The caller owns
   * the terminal slot identity; a non-equivalent replay fails closed. */
  export function publishOwnedExact<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
    exactOccurrenceID: string,
  ): Publication {
    return stageDurablePublication(def, properties, exactOccurrenceID)
  }

  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: Envelope<z.infer<Definition["properties"]>, Definition["type"]>) => unknown | Promise<unknown>,
    options?: { durableID: string; effect: "idempotent_by_occurrence" },
  ) {
    return raw(def.type, callback, options)
  }

  export function subscribeAll(callback: (event: any) => unknown | Promise<unknown>, options?: { durableID: string; effect: "idempotent_by_occurrence" }) {
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
      for (;;) {
        const pending = [...ownedPublicationOwners.values()].flatMap((entry) => (entry.pending ? [entry.pending] : []))
        if (pending.length === 0) break
        await Promise.allSettled(pending)
      }
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
      return Database.use((db) => db.select().from(BusPublicationOutboxTable).all().filter((row) => {
        const phases = db.select({ phase: BusPublicationPhaseReceiptTable.phase })
          .from(BusPublicationPhaseReceiptTable)
          .where(eq(BusPublicationPhaseReceiptTable.occurrence_id, row.occurrence_id)).all()
        return new Set(phases.map((item) => item.phase)).size < 3
      }))
    }

    export function deliveries(occurrenceID: string) {
      return Database.use((db) =>
        {
          const completedPhases = db.select({ phase: BusPublicationPhaseReceiptTable.phase })
            .from(BusPublicationPhaseReceiptTable)
            .where(eq(BusPublicationPhaseReceiptTable.occurrence_id, occurrenceID)).all()
          if (new Set(completedPhases.map((item) => item.phase)).size === 3) return []
          return db
          .select()
          .from(BusPublicationDeliveryTable)
          .where(eq(BusPublicationDeliveryTable.occurrence_id, occurrenceID))
          .all()
          .map((row) => {
            const outcomes = db.select({ outcome: BusPublicationDeliveryReceiptTable.outcome })
              .from(BusPublicationDeliveryReceiptTable).where(and(
                eq(BusPublicationDeliveryReceiptTable.occurrence_id, occurrenceID),
                eq(BusPublicationDeliveryReceiptTable.phase, row.phase),
                eq(BusPublicationDeliveryReceiptTable.subscriber_id, row.subscriber_id),
              )).all()
            return { ...row, settled: outcomes.some((item) => item.outcome === "succeeded" || item.outcome === "ignored") }
          })
        },
      )
    }
  }

  export function once<Definition extends BusEvent.Definition>(
    def: Definition,
    callback: (event: Envelope<z.infer<Definition["properties"]>, Definition["type"]>) => unknown | Promise<unknown>,
  ) {
    const unsub = raw(def.type, async (event) => {
      const result = await callback(event)
      if (result === "done") unsub()
    })
    return unsub
  }

  function raw(type: string, callback: (event: any) => unknown | Promise<unknown>, options?: { durableID: string; effect: "idempotent_by_occurrence" }) {
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
      effectContract: options?.effect,
      source: isBusTraceEnabled()
        ? new Error().stack
            ?.split("\n")
            .slice(2, 6)
            .map((x) => x.trim())
            .join(" | ")
        : undefined,
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
