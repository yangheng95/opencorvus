import z from "zod"
import { Identifier } from "@/id/id"

const DescriptorReference = z
  .object({
    id: Identifier.schema("worker_turn_descriptor"),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

const WorkerExecutionAuthority = z
  .object({
    worker_turn_descriptor: DescriptorReference,
    dispatch_lineage_artifact_id: Identifier.schema("artifact"),
  })
  .strict()

export const ProcessRecoveryPhysicalEvidence = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("managed_process_occurrence"),
      process_occurrence_id: z.string().min(1),
      supervisor_observation_id: z.string().min(1),
      envelope_path: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("unmanaged_process_cause_unknown"),
      reason: z.string().min(1),
    })
    .strict(),
])

export const ProcessRecoveryAffectedSubject = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("affected_created_session"),
      session_id: Identifier.schema("session"),
      session_created_at: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("affected_prepared_worker_turn"),
      session_id: Identifier.schema("session"),
      input_message_id: Identifier.schema("message"),
      worker: WorkerExecutionAuthority,
    })
    .strict(),
  z
    .object({
      kind: z.literal("affected_execution"),
      session_id: Identifier.schema("session"),
      input_message_id: Identifier.schema("message"),
      lifecycle_event_id: Identifier.schema("protocol_event"),
      worker: WorkerExecutionAuthority.optional(),
    })
    .strict(),
])

export const ProcessRecoveryFactContext = z
  .object({
    schema_version: z.literal(1),
    origin: z.enum(["process_shutdown", "abrupt_process_recovery"]),
    physical_evidence: ProcessRecoveryPhysicalEvidence,
    affected_subjects: ProcessRecoveryAffectedSubject.array().min(1),
  })
  .strict()

export type ProcessRecoveryFactContext = z.infer<typeof ProcessRecoveryFactContext>

export function resolveProcessRecoveryInputAuthority(input: {
  preparedWorkerInputMessageID?: string
  lifecycleInputMessageID?: string
}): string | undefined {
  return input.preparedWorkerInputMessageID ?? input.lifecycleInputMessageID
}

/** Shape written by every shutdown handoff before the v1 context existed.
 * These rows are immutable audit facts in real databases; a reader that
 * refuses them refuses to render every Task that ever survived a shutdown. */
const LegacyShutdownHandoffContext = z
  .object({ owned_session_ids: z.string().min(1).array() })
  .strict()

export type ProcessRecoveryFactContextCompat =
  | { kind: "v1"; context: ProcessRecoveryFactContext }
  | { kind: "legacy_shutdown_handoff"; ownedSessionIDs: readonly string[] }

/**
 * Parse a recovery fact context, current or historical.
 *
 * The v1 schema shipped as a reader-side contract with no writer producing it,
 * so every real database holds only the legacy shape — and the strict parse
 * threw, which propagated out of Task description and returned HTTP 500 for
 * the whole conversation view. Immutable history can never be re-written to
 * satisfy a newer reader; the reader carries the compatibility.
 */
export function parseProcessRecoveryFactContext(input: unknown, factID: string): ProcessRecoveryFactContextCompat {
  const parsed = ProcessRecoveryFactContext.safeParse(input)
  if (parsed.success) return { kind: "v1", context: parsed.data }
  const legacy = LegacyShutdownHandoffContext.safeParse(input)
  if (legacy.success) return { kind: "legacy_shutdown_handoff", ownedSessionIDs: legacy.data.owned_session_ids }
  throw new Error(`Process recovery fact ${factID} has invalid context: ${parsed.error.message}`)
}
