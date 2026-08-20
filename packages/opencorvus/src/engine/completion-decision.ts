import z from "zod"
import {
  ArtifactReadLocatorListSchema,
  EngineArtifactLocatorSchema,
  EvidenceLocatorListSchema,
  ArtifactProducerSchema,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
  type EvidenceLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { EngineArtifactTable } from "./engine.sql"
import { insertEngineArtifact } from "./artifact"
import { Database, and, desc, eq } from "@/storage/db"
import { assertTaskAssistantProducerToolPart } from "./producer-turn"
import { assertTaskEvidenceLocators } from "./evidence-locator"
import { Identifier } from "@/id/id"
import { SelectedWorkflowBindingSchema } from "./workflow-binding"
import { deriveTaskStatus } from "./task-status"
import { assertTaskWorkflowBindingInTransaction } from "./workflow-binding-facts"
import { assertCurrentDeliverySliceRevisionIDsInTransaction } from "./delivery-slice-membership-facts"
import type { TaskRow } from "./store"

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

export type PreparedTaskCompletionDecision = {
  artifactID: string
  taskID: string
  payload: TaskCompletionDecisionPayload
}

/**
 * The complete set of terminal-workflow worker Artifacts for this Task.
 *
 * This is a *derivable* fact: the bound workflow names its terminal nodes, and the artifact catalog
 * already records which projected worker of which package revision published each `expert_output`.
 * Nothing about it depends on the Orchestrator's judgement, so it is sealed by the Host rather than
 * transcribed by the model.
 *
 * It used to be a completion gate instead — `complete_task` was rejected whenever the model's two
 * locator lists omitted one of these — and that shape was wrong twice over. The rejection named a
 * count and no identity, so the model could not tell which Artifact it had missed and retried
 * blind; one AutomationBench trial burned seven `manage_task` calls against it. And the retry it
 * was demanding could only ever restate what the Host had already computed to raise the error.
 */
function deriveTerminalWorkflowArtifactLocators(input: {
  taskID: string
  payload: TaskCompletionDecisionPayload
}): EngineArtifactLocator[] {
  const binding = input.payload.workflow_binding
  if (binding.kind !== "virtual_workflow") return []
  const dependencyNodeIDs = new Set(binding.nodes.flatMap((node) => node.depends_on))
  const terminalAgents = new Set(
    binding.nodes.filter((node) => !dependencyNodeIDs.has(node.node_id)).map((node) => node.agent_id),
  )
  return Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        catalogRevision: EngineArtifactTable.catalog_revision,
        payloadSHA256: EngineArtifactTable.payload_sha256,
        producer: EngineArtifactTable.catalog_producer,
      })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, input.taskID), eq(EngineArtifactTable.kind, "expert_output")))
      .orderBy(EngineArtifactTable.id)
      .all()
      .flatMap((row) => {
        const producer = ArtifactProducerSchema.safeParse(row.producer)
        if (
          !producer.success ||
          producer.data.owner_kind !== "projected-worker" ||
          producer.data.expert_squad_id !== binding.package_revision.id ||
          producer.data.package_revision.scope !== binding.package_revision.scope ||
          producer.data.package_revision.project_id !== binding.package_revision.project_id ||
          producer.data.package_revision.namespace !== binding.package_revision.namespace ||
          producer.data.package_revision.id !== binding.package_revision.id ||
          producer.data.package_revision.version !== binding.package_revision.version ||
          producer.data.package_revision.package_digest !== binding.package_revision.package_digest ||
          !terminalAgents.has(producer.data.agent_id)
        ) {
          return []
        }
        return [
          EngineArtifactLocatorSchema.parse({
            source: "engine_artifact",
            artifact_id: row.id,
            catalog_revision: row.catalogRevision,
            expected_sha256: row.payloadSHA256,
          }),
        ]
      }),
  )
}

function parseCompletionDecisionArtifact(row: typeof EngineArtifactTable.$inferSelect): TaskCompletionDecisionArtifact {
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

export async function prepareTaskCompletionDecision(input: {
  taskID: string
  /** The Host owns `terminal_workflow_artifact_locators`; a caller cannot supply or override it. */
  payload: Omit<TaskCompletionDecisionPayload, "terminal_workflow_artifact_locators">
  visibleToolName: string
}): Promise<PreparedTaskCompletionDecision> {
  const payload = TaskCompletionDecisionPayloadSchema.parse(input.payload)
  const terminalWorkflowArtifactLocators = (await assertTaskEvidenceLocators({
    taskID: input.taskID,
    evidenceLocators: deriveTerminalWorkflowArtifactLocators({ taskID: input.taskID, payload }),
  })) as ArtifactReadLocator[]
  const evidenceLocators = await assertTaskEvidenceLocators({
    taskID: input.taskID,
    evidenceLocators: payload.evidence_locators,
  })
  const deliverableArtifactLocators = (await assertTaskEvidenceLocators({
    taskID: input.taskID,
    evidenceLocators: payload.deliverable_artifact_locators,
  })) as ArtifactReadLocator[]
  const { assertCurrentDeliverySliceRevisionIDs } = await import("./store")
  const acceptedDeliverySliceRevisionIDs = assertCurrentDeliverySliceRevisionIDs({
    taskID: input.taskID,
    deliverySliceRevisionIDs: payload.accepted_delivery_slice_revision_ids,
    subject: "Task completion decision",
  })
  assertTaskAssistantProducerToolPart({
    taskID: input.taskID,
    sessionID: payload.orchestrator_session_id,
    messageID: payload.orchestrator_message_id,
    toolPartID: payload.tool_part_id,
    toolCallID: payload.tool_call_id,
    visibleToolName: input.visibleToolName,
  })
  return {
    artifactID: Identifier.ascending("artifact"),
    taskID: input.taskID,
    payload: TaskCompletionDecisionPayloadSchema.parse({
      ...payload,
      evidence_locators: evidenceLocators,
      deliverable_artifact_locators: deliverableArtifactLocators,
      terminal_workflow_artifact_locators: terminalWorkflowArtifactLocators,
      accepted_delivery_slice_revision_ids: acceptedDeliverySliceRevisionIDs,
    }),
  }
}

export function insertPreparedTaskCompletionDecision(
  db: Database.TxOrDb,
  prepared: PreparedTaskCompletionDecision,
  terminalTask: TaskRow,
): string {
  const terminalStatus = deriveTaskStatus(terminalTask)
  if (
    terminalTask.id !== prepared.taskID ||
    terminalStatus !== "completed" ||
    terminalTask.time_completed !== prepared.payload.time_recorded
  ) {
    throw new Error(
      `Task completion decision ${prepared.artifactID} does not match the winning completed Task transition`,
    )
  }
  assertTaskWorkflowBindingInTransaction({
    db,
    taskID: prepared.taskID,
    workflowBinding: prepared.payload.workflow_binding,
  })
  const currentDeliverySliceRevisionIDs = assertCurrentDeliverySliceRevisionIDsInTransaction({
    db,
    taskID: prepared.taskID,
    deliverySliceRevisionIDs: prepared.payload.accepted_delivery_slice_revision_ids,
    subject: "Task completion decision",
  })
  const collision = db
    .select({ id: EngineArtifactTable.id })
    .from(EngineArtifactTable)
    .where(
      and(
        eq(EngineArtifactTable.task_id, prepared.taskID),
        eq(EngineArtifactTable.kind, "task_completion_decision"),
        eq(EngineArtifactTable.time_created, prepared.payload.time_recorded),
      ),
    )
    .get()
  if (collision) {
    throw new Error(
      `Task ${prepared.taskID} already has completion decision ${collision.id} at ${prepared.payload.time_recorded}`,
    )
  }
  return insertEngineArtifact(db, {
    id: prepared.artifactID,
    taskID: prepared.taskID,
    kind: "task_completion_decision",
    label: "TaskCompletionDecision",
    payload: {
      ...prepared.payload,
      accepted_delivery_slice_revision_ids: currentDeliverySliceRevisionIDs,
    },
    timeCreated: prepared.payload.time_recorded,
  })
}

export function allocateTaskCompletionDecisionTime(taskID: string, now = Date.now()): number {
  const prior = Database.use((db) =>
    db
      .select({ timeCreated: EngineArtifactTable.time_created })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_completion_decision")))
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .get(),
  )
  return Math.max(now, (prior?.timeCreated ?? -1) + 1)
}

export function findTaskCompletionDecisionForTerminalTime(input: {
  taskID: string
  timeCompleted: number
}): TaskCompletionDecisionArtifact | undefined {
  return Database.use((db) => findTaskCompletionDecisionForTerminalTimeInTransaction(db, input))
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

export function requireTaskCompletionDecisionArtifact(input: {
  taskID: string
  artifactID: string
  timeCompleted: number
}): TaskCompletionDecisionArtifact {
  const row = Database.use((db) =>
    db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, input.artifactID)).get(),
  )
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

export async function assertTaskCompletionEvidenceLocators(input: {
  taskID: string
  evidenceLocators: readonly EvidenceLocator[]
}): Promise<EvidenceLocator[]> {
  return assertTaskEvidenceLocators(input)
}
