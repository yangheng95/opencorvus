import z from "zod"
import { Database, NotFoundError, and, asc, eq, gt, sql } from "@/storage/db"
import {
  BusPublicationAttemptReceiptTable,
  BusPublicationDeliveryReceiptTable,
  BusPublicationDeliveryTable,
  BusPublicationOutboxTable,
  BusPublicationOwnerTable,
  BusPublicationPhaseReceiptTable,
} from "./bus.sql"
import { EngineControlActivationLeaseGrantTable, EngineControlActivationLeaseTable } from "@/engine/engine.sql"

/** History remains readable after all delivery phases have settled and after
 * Project deletion. Raw JSON is paged as stored bytes, never reserialized. */
export namespace PublicationRead {
  const sourceColumns = {
    occurrence_id: BusPublicationOutboxTable.occurrence_id,
    project_id: BusPublicationOutboxTable.project_id,
    directory: BusPublicationOutboxTable.directory,
    event_type: BusPublicationOutboxTable.event_type,
    time_created: BusPublicationOutboxTable.time_created,
  }
  export const ListInput = z.object({
    projectID: z.string().min(1),
    after: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(64).default(32),
  })
  export const Input = z.object({
    projectID: z.string().min(1),
    occurrenceID: z.string().min(1),
    field: z.enum(["properties", "causation"]).default("properties"),
    byteOffset: z.coerce.number().int().min(0).default(0),
    section: z.enum(["deliveries", "receipts", "attempts", "phases", "leases", "grants"]).default("receipts"),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(64).default(32),
  })
  export const Source = z.object({
    occurrenceID: z.string(),
    projectID: z.string(),
    directory: z.string(),
    eventType: z.string(),
    timeCreated: z.number(),
    generation: z.string().nullable(),
    ownerRecordedAt: z.number(),
  })
  export const ListResult = z.object({ sources: z.array(Source), next: z.string().nullable() })
  export const Result = z.object({
    source: Source,
    body: z.object({
      field: z.enum(["properties", "causation"]),
      encoding: z.literal("base64"),
      byteOffset: z.number(),
      totalBytes: z.number(),
      data: z.string(),
      nextByteOffset: z.number().nullable(),
    }),
    section: Input.shape.section,
    facts: z.array(z.record(z.string(), z.unknown())),
    nextOffset: z.number().nullable(),
  })

  function source(
    row: Pick<
      typeof BusPublicationOutboxTable.$inferSelect,
      "occurrence_id" | "project_id" | "directory" | "event_type" | "time_created"
    >,
    owner: typeof BusPublicationOwnerTable.$inferSelect | null | undefined,
  ) {
    if (!owner) throw new Error(`Durable Bus occurrence ${row.occurrence_id} has no immutable owner fact`)
    return {
      occurrenceID: row.occurrence_id,
      projectID: row.project_id,
      directory: row.directory,
      eventType: row.event_type,
      timeCreated: row.time_created,
      generation: owner.project_generation,
      ownerRecordedAt: owner.time_created,
    }
  }

  export function list(input: z.input<typeof ListInput>) {
    const query = ListInput.parse(input)
    return Database.use((db) => {
      const rows = db
        .select({ ...sourceColumns, owner: BusPublicationOwnerTable })
        .from(BusPublicationOutboxTable)
        .leftJoin(
          BusPublicationOwnerTable,
          eq(BusPublicationOwnerTable.occurrence_id, BusPublicationOutboxTable.occurrence_id),
        )
        .where(
          and(
            eq(BusPublicationOutboxTable.project_id, query.projectID),
            query.after ? gt(BusPublicationOutboxTable.occurrence_id, query.after) : undefined,
          ),
        )
        .orderBy(asc(BusPublicationOutboxTable.occurrence_id))
        .limit(query.limit + 1)
        .all()
      const sources = rows.slice(0, query.limit).map((row) => source(row, row.owner))
      return { sources, next: rows.length > query.limit ? sources.at(-1)!.occurrenceID : null }
    })
  }

  export function read(input: z.input<typeof Input>) {
    const query = Input.parse(input)
    return Database.use((db) => {
      const row = db
        .select(sourceColumns)
        .from(BusPublicationOutboxTable)
        .where(
          and(
            eq(BusPublicationOutboxTable.occurrence_id, query.occurrenceID),
            eq(BusPublicationOutboxTable.project_id, query.projectID),
          ),
        )
        .get()
      if (!row) throw new NotFoundError({ message: `Durable publication not found: ${query.occurrenceID}` })
      const owner = db
        .select()
        .from(BusPublicationOwnerTable)
        .where(eq(BusPublicationOwnerTable.occurrence_id, row.occurrence_id))
        .get()
      const column =
        query.field === "properties" ? BusPublicationOutboxTable.properties : BusPublicationOutboxTable.causation
      const raw = db
        .select({
          total: sql<number>`coalesce(length(cast(${column} AS BLOB)),0)`,
          chunk: sql<Uint8Array | null>`substr(cast(${column} AS BLOB),${query.byteOffset + 1},4096)`,
        })
        .from(BusPublicationOutboxTable)
        .where(eq(BusPublicationOutboxTable.occurrence_id, row.occurrence_id))
        .get()!
      const prefix = `${row.occurrence_id}\0`
      const leaseScope = and(
        eq(EngineControlActivationLeaseTable.target, "bus_delivery"),
        sql`substr(cast(${EngineControlActivationLeaseTable.target_id} AS BLOB),1,length(cast(${prefix} AS BLOB)))=cast(${prefix} AS BLOB)`,
      )
      const facts = (() => {
        const count = query.limit + 1
        switch (query.section) {
          case "deliveries":
            return db
              .select()
              .from(BusPublicationDeliveryTable)
              .where(eq(BusPublicationDeliveryTable.occurrence_id, row.occurrence_id))
              .orderBy(BusPublicationDeliveryTable.phase, BusPublicationDeliveryTable.subscriber_id)
              .limit(count)
              .offset(query.offset)
              .all()
          case "receipts":
            return db
              .select()
              .from(BusPublicationDeliveryReceiptTable)
              .where(eq(BusPublicationDeliveryReceiptTable.occurrence_id, row.occurrence_id))
              .orderBy(BusPublicationDeliveryReceiptTable.time_created, BusPublicationDeliveryReceiptTable.id)
              .limit(count)
              .offset(query.offset)
              .all()
          case "attempts":
            return db
              .select()
              .from(BusPublicationAttemptReceiptTable)
              .where(eq(BusPublicationAttemptReceiptTable.occurrence_id, row.occurrence_id))
              .orderBy(BusPublicationAttemptReceiptTable.time_created, BusPublicationAttemptReceiptTable.id)
              .limit(count)
              .offset(query.offset)
              .all()
          case "phases":
            return db
              .select()
              .from(BusPublicationPhaseReceiptTable)
              .where(eq(BusPublicationPhaseReceiptTable.occurrence_id, row.occurrence_id))
              .orderBy(BusPublicationPhaseReceiptTable.phase)
              .limit(count)
              .offset(query.offset)
              .all()
          case "leases":
            return db
              .select()
              .from(EngineControlActivationLeaseTable)
              .where(leaseScope)
              .orderBy(EngineControlActivationLeaseTable.time_activated, EngineControlActivationLeaseTable.id)
              .limit(count)
              .offset(query.offset)
              .all()
          case "grants":
            return db
              .select({
                lease_id: EngineControlActivationLeaseGrantTable.lease_id,
                ordinal: EngineControlActivationLeaseGrantTable.ordinal,
                expires_at: EngineControlActivationLeaseGrantTable.expires_at,
                time_created: EngineControlActivationLeaseGrantTable.time_created,
              })
              .from(EngineControlActivationLeaseGrantTable)
              .innerJoin(
                EngineControlActivationLeaseTable,
                eq(EngineControlActivationLeaseTable.id, EngineControlActivationLeaseGrantTable.lease_id),
              )
              .where(leaseScope)
              .orderBy(EngineControlActivationLeaseGrantTable.lease_id, EngineControlActivationLeaseGrantTable.ordinal)
              .limit(count)
              .offset(query.offset)
              .all()
        }
      })()
      const chunk = Buffer.from(raw.chunk ?? [])
      return {
        source: source(row, owner),
        body: {
          field: query.field,
          encoding: "base64" as const,
          byteOffset: query.byteOffset,
          totalBytes: raw.total,
          data: chunk.toString("base64"),
          nextByteOffset: query.byteOffset + chunk.length < raw.total ? query.byteOffset + chunk.length : null,
        },
        section: query.section,
        facts: facts.slice(0, query.limit),
        nextOffset: facts.length > query.limit ? query.offset + query.limit : null,
      }
    })
  }
}
