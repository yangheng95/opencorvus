import { Identifier } from "@/id/id"
import { Database, and, eq, inArray, sql } from "@/storage/db"
import { PermissionLedgerTable } from "./permission.sql"

/** Canonical Project ownership is carried only by the requested row. */
export function permissionRequestOwnerBelongsToProject(projectID: string) {
  return sql`EXISTS (
    SELECT 1 FROM permission_ledger AS permission_request_owner
    WHERE permission_request_owner.request_id = ${PermissionLedgerTable.request_id}
      AND permission_request_owner.event_type = 'requested'
      AND permission_request_owner.project_id = ${projectID}
  )`
}

/**
 * Close every reusable Project grant inside the same fenced transaction that
 * deletes its Project occurrence. A same-path Project can reuse its durable
 * identity, so the immutable terminal facts are the deletion boundary.
 */
export function expireProjectPermissionGrantsInTransaction(input: {
  db: Database.TxOrDb
  projectID: string
  reason: string
}): number {
  const grants = input.db
    .select({ id: PermissionLedgerTable.id, requestID: PermissionLedgerTable.request_id })
    .from(PermissionLedgerTable)
    .where(
      and(
        eq(PermissionLedgerTable.event_type, "grant_created"),
        eq(PermissionLedgerTable.decision_scope, "project"),
        permissionRequestOwnerBelongsToProject(input.projectID),
      ),
    )
    .all()
  if (grants.length === 0) return 0
  const inactive = new Set(
    input.db
      .select({ source: PermissionLedgerTable.source_event_id })
      .from(PermissionLedgerTable)
      .where(
        and(
          inArray(PermissionLedgerTable.event_type, ["revoked", "expired"]),
          inArray(
            PermissionLedgerTable.source_event_id,
            grants.map((grant) => grant.id),
          ),
        ),
      )
      .all()
      .map((row) => row.source),
  )
  const active = grants.filter((grant) => !inactive.has(grant.id))
  if (active.length === 0) return 0
  const settledAt = Date.now()
  input.db
    .insert(PermissionLedgerTable)
    .values(
      active.map((grant) => ({
        id: Identifier.ascending("permission"),
        request_id: grant.requestID,
        event_type: "expired" as const,
        source_event_id: grant.id,
        actor_id: "project-deletion",
        reason: input.reason,
        time_created: settledAt,
      })),
    )
    .run()
  return active.length
}
