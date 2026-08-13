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

export class TaskCompletionEvidenceIncompleteError extends Error {
  override readonly name = "TaskCompletionEvidenceIncompleteError"
  readonly code = "TASK_COMPLETION_EVIDENCE_INCOMPLETE"

  constructor(
    readonly taskID: string,
    readonly missingArtifactLocators: readonly EngineArtifactLocator[],
  ) {
    super(
      `Task ${taskID} completion evidence omits ${missingArtifactLocators.length} terminal workflow Artifact(s)`,
    )
  }
}

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

function assertTerminalWorkflowArtifactCompleteness(input: {
  taskID: string
  payload: TaskCompletionDecisionPayload
}) {
  const binding = input.payload.workflow_binding
  if (binding.kind !== "virtual_workflow") return
  const dependencyNodeIDs = new Set(binding.nodes.flatMap((node) => node.depends_on))
  const terminalAgents = new Set(
    binding.nodes.filter((node) => !dependencyNodeIDs.has(node.node_id)).map((node) => node.agent_id),
  )
  const declared = new Set(
    [...input.payload.evidence_locators, ...input.payload.deliverable_artifact_locators].map((locator) =>
      JSON.stringify(locator),
    ),
  )
  const missing = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        catalogRevision: EngineArtifactTable.catalog_revision,
        payloadSHA256: EngineArtifactTable.payload_sha256,
        producer: EngineArtifactTable.catalog_producer,
      })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, input.taskID), eq(EngineArtifactTable.kind, "expert_output")))
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
        const locator = EngineArtifactLocatorSchema.parse({
          source: "engine_artifact",
          artifact_id: row.id,
          catalog_revision: row.catalogRevision,
          expected_sha256: row.payloadSHA256,
        })
        return declared.has(JSON.stringify(locator)) ? [] : [locator]
      }),
  )
  if (missing.length > 0) throw new TaskCompletionEvidenceIncompleteError(input.taskID, missing)
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
  payload: TaskCompletionDecisionPayload
  visibleToolName: string
}): Promise<PreparedTaskCompletionDecision> {
  const payload = TaskCompletionDecisionPayloadSchema.parse(input.payload)
  assertTerminalWorkflowArtifactCompleteness({ taskID: input.taskID, payload })
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
      accepted_delivery_slice_revision_ids: acceptedDeliverySliceRevisionIDs,
    }),
  }
}

export function insertPreparedTaskCompletionDecision(
  db: Database.TxOrDb,
  prepared: PreparedTaskCompletionDecision,
  terminalTask: {
    id: string
    time_started: number | null
    time_completed: number | null
    error: string | null
    metadata: Record<string, unknown> | null
  },
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
