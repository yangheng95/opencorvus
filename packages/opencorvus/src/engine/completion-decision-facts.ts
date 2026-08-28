import {
  ArtifactReadLocatorListSchema,
  EngineArtifactLocatorSchema,
  EvidenceLocatorListSchema,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { Identifier } from "@/id/id"
import type { Database } from "@/storage/db"
import { and, eq } from "drizzle-orm"
import z from "zod"
import { EngineArtifactTable } from "./engine.sql"
import { SelectedWorkflowBindingSchema } from "./workflow-binding"

const ExactDeliverySliceRevisionIDsSchema = z
  .array(Identifier.schema("goal"))
  .refine((values) => new Set(values).size === values.length, {
    message: "accepted Delivery Slice revision IDs must be unique",
  })

export const TaskCompletionDecisionPayloadSchema = z
  .object({
    orchestrator_session_id: z.string().min(1),
    orchestrator_message_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    tool_part_id: z.string().min(1),
    evidence_locators: EvidenceLocatorListSchema,
    deliverable_artifact_locators: ArtifactReadLocatorListSchema.default([]),
    /** Host-derived, never model-supplied: every `expert_output` Artifact published by an agent
     *  owning a terminal node of the bound workflow. See `deriveTerminalWorkflowArtifactLocators`. */
    terminal_workflow_artifact_locators: ArtifactReadLocatorListSchema.default([]),
    accepted_delivery_slice_revision_ids: ExactDeliverySliceRevisionIDsSchema.default([]),
    workflow_binding: SelectedWorkflowBindingSchema,
    time_recorded: z.number().int().nonnegative(),
  })
  .strict()

export type TaskCompletionDecisionPayload = z.infer<typeof TaskCompletionDecisionPayloadSchema>

export type TaskCompletionDecisionArtifact = {
  id: string
  locator: EngineArtifactLocator
  taskID: string
  payload: TaskCompletionDecisionPayload
  timeCreated: number
}

function parseCompletionDecisionArtifact(
  row: typeof EngineArtifactTable.$inferSelect,
): TaskCompletionDecisionArtifact {
  const payload = TaskCompletionDecisionPayloadSchema.parse(row.payload)
  if (payload.time_recorded !== row.time_created) {
    throw new Error(
      `Task completion decision artifact ${row.id} has time_recorded=${payload.time_recorded}, expected ${row.time_created}`,
    )
  }
  return {
    id: row.id,
    locator: EngineArtifactLocatorSchema.parse({
      source: "engine_artifact",
      artifact_id: row.id,
      catalog_revision: row.catalog_revision,
      expected_sha256: row.payload_sha256,
    }),
    taskID: row.task_id,
    payload,
    timeCreated: row.time_created,
  }
}

export function findTaskCompletionDecisionForTerminalTimeInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; timeCompleted: number },
): TaskCompletionDecisionArtifact | undefined {
  const rows = db
    .select()
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, input.taskID),
        eq(EngineArtifactTable.kind, "task_completion_decision"),
        eq(EngineArtifactTable.time_created, input.timeCompleted),
      ),
    )
    .all()
  if (rows.length > 1) {
    throw new Error(
      `Task ${input.taskID} has ${rows.length} completion decisions at terminal time ${input.timeCompleted}`,
    )
  }
  return rows[0] ? parseCompletionDecisionArtifact(rows[0]) : undefined
}

export function requireTaskCompletionDecisionArtifactInTransaction(
  db: Database.TxOrDb,
  input: { taskID: string; artifactID: string; timeCompleted: number },
): TaskCompletionDecisionArtifact {
  const row = db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, input.artifactID)).get()
  if (!row || row.task_id !== input.taskID || row.kind !== "task_completion_decision") {
    throw new Error(`Task ${input.taskID} completion decision Artifact ${input.artifactID} is not exact`)
  }
  const decision = parseCompletionDecisionArtifact(row)
  if (decision.timeCreated !== input.timeCompleted) {
    throw new Error(
      `Task ${input.taskID} completion decision Artifact ${input.artifactID} does not match terminal time ${input.timeCompleted}`,
    )
  }
  return decision
}
