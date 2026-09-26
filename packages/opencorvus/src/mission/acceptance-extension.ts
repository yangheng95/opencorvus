import z from "zod"
import { Database, and, eq, sql } from "@/storage/db"
import { EngineArtifactTable, EngineTaskRootIngressTable } from "@/engine/engine.sql"
import { insertEngineArtifact } from "@/engine/artifact"
import { currentControlLeaseInTransaction } from "@/engine/control-lease"
import { Identifier } from "@/id/id"
import { ActiveTaskExecutionReferenceSchema } from "@/engine/task-artifact-observation-schema"
import { taskLifecycleProjectionInTransaction } from "@/engine/task-lifecycle"
import { canonicalJSONValue } from "@/util/canonical-digest"
import { MissionAcceptanceGapSchema, type MissionAcceptanceGap } from "./acceptance-gap"
import {
  appendTaskAcceptanceLedgerRevisionInTransaction,
  readLatestTaskAcceptanceLedgerInTransaction,
  MissionAcceptanceGapIntegrityError,
  MissionAcceptanceLedgerConflictError,
  type TaskAcceptanceLedgerProjection,
} from "./acceptance-ledger"

export const MissionAcceptanceExtensionRequestSchema = z
  .object({
    protocol: z.literal("mission-acceptance-extension-request"),
    task_id: z.string().min(1),
    mission_id: z.string().min(1),
    mission_session_id: z.string().min(1),
    panel_message_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    tool_part_id: z.string().min(1),
    message_id: z.string().min(1),
    ingress_artifact_id: z.string().min(1),
    active_execution_reference: ActiveTaskExecutionReferenceSchema,
    expected_ledger_artifact_id: z.string().min(1),
    acceptance_gap: MissionAcceptanceGapSchema,
    time_accepted: z.number().int().positive(),
  })
  .strict()
export type MissionAcceptanceExtensionRequest = z.infer<typeof MissionAcceptanceExtensionRequestSchema>

export const MissionAcceptanceExtensionOutcomeSchema = z
  .object({
    protocol: z.literal("mission-acceptance-extension-outcome"),
    request_artifact_id: z.string().min(1),
    ingress_artifact_id: z.string().min(1),
    task_id: z.string().min(1),
    time_recorded: z.number().int().positive(),
    result: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("applied"), ledger_artifact_id: z.string().min(1) }).strict(),
      z
        .object({
          kind: z.literal("rejected"),
          code: z.enum(["ledger_conflict", "execution_changed", "invalid_extension"]),
          current_ledger_artifact_id: z.string().nullable(),
          message: z.string().min(1),
        })
        .strict(),
    ]),
  })
  .strict()

function exactArtifact(
  db: Database.TxOrDb,
  taskID: string,
  kind: "mission_acceptance_extension_request" | "mission_acceptance_extension_outcome",
  field: string,
  value: string,
) {
  const rows = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, taskID),
        eq(EngineArtifactTable.kind, kind),
        sql`json_extract(${EngineArtifactTable.payload}, ${`$.${field}`}) = ${value}`,
      ),
    )
    .limit(2)
    .all()
  if (rows.length > 1) throw new MissionAcceptanceGapIntegrityError(taskID, `Ambiguous ${kind} identity ${value}`)
  return rows[0]
}

export function readMissionAcceptanceExtensionRequest(
  db: Database.TxOrDb,
  taskID: string,
  identity: { ingressID: string } | { toolCallID: string },
) {
  const row = exactArtifact(
    db,
    taskID,
    "mission_acceptance_extension_request",
    "ingressID" in identity ? "ingress_artifact_id" : "tool_call_id",
    "ingressID" in identity ? identity.ingressID : identity.toolCallID,
  )
  if (!row) return undefined
  const parsed = MissionAcceptanceExtensionRequestSchema.safeParse(row.payload)
  if (!parsed.success || parsed.data.task_id !== taskID)
    throw new MissionAcceptanceGapIntegrityError(taskID, `Invalid extension request ${row.id}`)
  return { artifactID: row.id, request: parsed.data }
}

export function readMissionAcceptanceExtensionOutcome(db: Database.TxOrDb, taskID: string, ingressID: string) {
  const row = exactArtifact(db, taskID, "mission_acceptance_extension_outcome", "ingress_artifact_id", ingressID)
  if (!row) return undefined
  const parsed = MissionAcceptanceExtensionOutcomeSchema.safeParse(row.payload)
  if (!parsed.success || parsed.data.task_id !== taskID)
    throw new MissionAcceptanceGapIntegrityError(taskID, `Invalid extension outcome ${row.id}`)
  return { artifactID: row.id, outcome: parsed.data }
}

/** Scope growth preserves every grant that an already-running descriptor can hold. */
export function requireAcceptanceScopeExtension(previous: TaskAcceptanceLedgerProjection, gap: MissionAcceptanceGap) {
  const prior = previous.revision.gap
  if (
    canonicalJSONValue(prior.reviewed_terminal_lifecycle_reference) !==
    canonicalJSONValue(gap.reviewed_terminal_lifecycle_reference)
  )
    throw new MissionAcceptanceGapIntegrityError(
      previous.revision.task_id,
      "An active extension must retain its original reviewed terminal reference.",
    )
  const nextByID = new Map(gap.criteria.map((criterion) => [criterion.criterion_id, criterion]))
  for (const criterion of prior.criteria) {
    if (
      criterion.state === "open" &&
      (!nextByID.has(criterion.criterion_id) ||
        canonicalJSONValue(criterion) !== canonicalJSONValue(nextByID.get(criterion.criterion_id)))
    )
      throw new MissionAcceptanceGapIntegrityError(
        previous.revision.task_id,
        `Active extension must preserve open criterion ${criterion.criterion_id} and its current execution authority.`,
      )
  }
  const priorOpen = new Set(
    prior.criteria.filter((criterion) => criterion.state === "open").map((criterion) => criterion.criterion_id),
  )
  if (!gap.criteria.some((criterion) => criterion.state === "open" && !priorOpen.has(criterion.criterion_id)))
    throw new MissionAcceptanceGapIntegrityError(
      previous.revision.task_id,
      "Active extension requires at least one newly opened obligation.",
    )
}

/** Called only by the canonical lease-acquisition transaction, never by admission or a notification callback. */
export function applyMissionAcceptanceExtensionAtLease(
  db: Database.TxOrDb,
  ingressID: string,
  activationID: string,
  now: number,
) {
  const ingress = db
    .select()
    .from(EngineTaskRootIngressTable)
    .where(eq(EngineTaskRootIngressTable.id, ingressID))
    .get()!
  const recorded = readMissionAcceptanceExtensionRequest(db, ingress.task_id, { ingressID })
  if (!recorded) return undefined
  const lease = currentControlLeaseInTransaction(db, "task_root_ingress", ingressID)
  if (!lease || lease.id !== activationID || lease.expires_at <= now)
    throw new MissionAcceptanceGapIntegrityError(
      ingress.task_id,
      "Acceptance extension requires the exact live root input lease.",
    )
  const existing = readMissionAcceptanceExtensionOutcome(db, ingress.task_id, ingressID)
  if (existing) return existing
  const request = recorded.request
  const current = readLatestTaskAcceptanceLedgerInTransaction(db, ingress.task_id)
  const lifecycle = taskLifecycleProjectionInTransaction(db, ingress.task_id)
  let result: z.infer<typeof MissionAcceptanceExtensionOutcomeSchema>["result"]
  if (
    lifecycle.status !== "active" ||
    lifecycle.epoch !== request.active_execution_reference.executionEpoch ||
    lifecycle.openedEventID !== request.active_execution_reference.openedEventID
  ) {
    result = {
      kind: "rejected",
      code: "execution_changed",
      current_ledger_artifact_id: current?.artifactID ?? null,
      message: "The observed active Task execution changed.",
    }
  } else if (!current || current.artifactID !== request.expected_ledger_artifact_id) {
    result = {
      kind: "rejected",
      code: "ledger_conflict",
      current_ledger_artifact_id: current?.artifactID ?? null,
      message: "The exact acceptance ledger changed before this input acquired its execution lease.",
    }
  } else {
    try {
      requireAcceptanceScopeExtension(current, request.acceptance_gap)
      const ledgerID = Identifier.deterministic(
        "artifact",
        `mission-acceptance-extension-ledger\0${recorded.artifactID}`,
      )
      appendTaskAcceptanceLedgerRevisionInTransaction({
        db,
        taskID: ingress.task_id,
        artifactID: ledgerID,
        executionEpoch: lifecycle.epoch,
        expectedPreviousArtifactID: current.artifactID,
        gap: request.acceptance_gap,
        now,
      })
      result = { kind: "applied", ledger_artifact_id: ledgerID }
    } catch (error) {
      if (
        !(error instanceof MissionAcceptanceGapIntegrityError) &&
        !(error instanceof MissionAcceptanceLedgerConflictError)
      )
        throw error
      result = {
        kind: "rejected",
        code: "invalid_extension",
        current_ledger_artifact_id: current.artifactID,
        message: error.message,
      }
    }
  }
  const outcome = MissionAcceptanceExtensionOutcomeSchema.parse({
    protocol: "mission-acceptance-extension-outcome",
    request_artifact_id: recorded.artifactID,
    ingress_artifact_id: ingressID,
    task_id: ingress.task_id,
    result,
    time_recorded: now,
  })
  const artifactID = insertEngineArtifact(db, {
    taskID: ingress.task_id,
    kind: "mission_acceptance_extension_outcome",
    label: result.kind,
    payload: outcome,
    timeCreated: now,
  })
  return { artifactID, outcome }
}
