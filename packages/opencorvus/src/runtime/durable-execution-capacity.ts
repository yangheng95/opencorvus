import { randomUUID } from "node:crypto"
import { and, Database, eq } from "@/storage/db"
import { Log } from "@/util/log"
import { RuntimeExecutionCapacityLeaseTable } from "./execution-capacity.sql"

const log = Log.create({ service: "durable-execution-capacity" })
const LEASE_MS = 30_000
const RENEW_MS = 10_000
const SATURATED_RETRY_MS = 25

export type DurableExecutionCapacityLease = {
  resourceKey: string
  slot: number
  leaseID: string
  ownerID: string
  signal: AbortSignal
  release(): void
}

type AcquiredRow = typeof RuntimeExecutionCapacityLeaseTable.$inferSelect

function assertLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 64) {
    throw new Error(`Durable execution capacity must be an integer between 1 and 64: ${limit}`)
  }
}

function assertResourceKey(resourceKey: string): void {
  if (!/^[a-f0-9]{64}$/.test(resourceKey)) {
    throw new Error("Durable execution capacity resource key must be a lowercase SHA-256 digest")
  }
}

function tryAcquire(input: {
  resourceKey: string
  limit: number
  leaseID: string
  ownerID: string
  now: number
}): AcquiredRow | undefined {
  return Database.immediateTransaction((db) => {
    const current = new Map(
      db
        .select()
        .from(RuntimeExecutionCapacityLeaseTable)
        .where(eq(RuntimeExecutionCapacityLeaseTable.resource_key, input.resourceKey))
        .all()
        .map((row) => [row.slot, row] as const),
    )
    if ([...current.values()].filter((row) => row.expires_at > input.now).length >= input.limit) return undefined
    for (let slot = 0; slot < input.limit; slot += 1) {
      const row: AcquiredRow = {
        resource_key: input.resourceKey,
        slot,
        lease_id: input.leaseID,
        owner_id: input.ownerID,
        time_acquired: input.now,
        expires_at: input.now + LEASE_MS,
      }
      const prior = current.get(slot)
      if (!prior) {
        db.insert(RuntimeExecutionCapacityLeaseTable).values(row).run()
        return row
      }
      if (prior.expires_at > input.now) continue
      const replaced = db
        .update(RuntimeExecutionCapacityLeaseTable)
        .set(row)
        .where(
          and(
            eq(RuntimeExecutionCapacityLeaseTable.resource_key, prior.resource_key),
            eq(RuntimeExecutionCapacityLeaseTable.slot, prior.slot),
            eq(RuntimeExecutionCapacityLeaseTable.lease_id, prior.lease_id),
            eq(RuntimeExecutionCapacityLeaseTable.expires_at, prior.expires_at),
          ),
        )
        .returning()
        .get()
      if (replaced) return replaced
    }
    return undefined
  })
}

function waitForRetry(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, SATURATED_RETRY_MS)
    const onAbort = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener("abort", onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
}

export namespace DurableExecutionCapacity {
  export async function acquire(input: {
    resourceKey: string
    limit: number
    signal?: AbortSignal
  }): Promise<DurableExecutionCapacityLease> {
    assertResourceKey(input.resourceKey)
    assertLimit(input.limit)
    const externalSignal = input.signal ?? new AbortController().signal
    const leaseID = randomUUID()
    const ownerID = `runtime:${process.pid}:${randomUUID()}`
    let row: AcquiredRow | undefined
    while (!row) {
      externalSignal.throwIfAborted()
      row = tryAcquire({
        resourceKey: input.resourceKey,
        limit: input.limit,
        leaseID,
        ownerID,
        now: Date.now(),
      })
      if (!row) await waitForRetry(externalSignal)
    }

    const controller = new AbortController()
    let released = false
    const renewTimer = setInterval(() => {
      if (released) return
      try {
        const now = Date.now()
        const renewed = Database.immediateTransaction((db) =>
          db
            .update(RuntimeExecutionCapacityLeaseTable)
            .set({ expires_at: now + LEASE_MS })
            .where(
              and(
                eq(RuntimeExecutionCapacityLeaseTable.resource_key, row!.resource_key),
                eq(RuntimeExecutionCapacityLeaseTable.slot, row!.slot),
                eq(RuntimeExecutionCapacityLeaseTable.lease_id, row!.lease_id),
                eq(RuntimeExecutionCapacityLeaseTable.owner_id, row!.owner_id),
                eq(RuntimeExecutionCapacityLeaseTable.expires_at, row!.expires_at),
              ),
            )
            .returning({ expiresAt: RuntimeExecutionCapacityLeaseTable.expires_at })
            .get(),
        )
        if (!renewed) throw new Error(`Physical capacity slot ${row!.slot} lost its lease fence`)
        row = { ...row!, expires_at: renewed.expiresAt }
      } catch (error) {
        controller.abort(error)
      }
    }, RENEW_MS)
    renewTimer.unref()

    return {
      resourceKey: row.resource_key,
      slot: row.slot,
      leaseID: row.lease_id,
      ownerID: row.owner_id,
      signal: controller.signal,
      release() {
        if (released) return
        released = true
        clearInterval(renewTimer)
        try {
          const now = Math.max(Date.now(), row!.time_acquired)
          Database.immediateTransaction((db) => {
            db.update(RuntimeExecutionCapacityLeaseTable)
              .set({ expires_at: now })
              .where(
                and(
                  eq(RuntimeExecutionCapacityLeaseTable.resource_key, row!.resource_key),
                  eq(RuntimeExecutionCapacityLeaseTable.slot, row!.slot),
                  eq(RuntimeExecutionCapacityLeaseTable.lease_id, row!.lease_id),
                  eq(RuntimeExecutionCapacityLeaseTable.owner_id, row!.owner_id),
                ),
              )
              .run()
          })
        } catch (error) {
          log.warn("physical capacity lease release failed; expiry remains the crash bound", {
            resourceKey: row!.resource_key,
            slot: row!.slot,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      },
    }
  }

  export const TestHooks = {
    snapshot(resourceKey: string): AcquiredRow[] {
      return Database.use((db) =>
        db
          .select()
          .from(RuntimeExecutionCapacityLeaseTable)
          .where(eq(RuntimeExecutionCapacityLeaseTable.resource_key, resourceKey))
          .orderBy(RuntimeExecutionCapacityLeaseTable.slot)
          .all(),
      )
    },
  }
}
