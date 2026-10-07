import {
  EngineArtifactLocatorSchema,
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
import { deriveTaskStatus } from "./task-status"
import { assertTaskWorkflowPackageInTransaction } from "./workflow-binding-facts"
import { assertCurrentDeliverySliceRevisionIDsInTransaction } from "./delivery-slice-membership-facts"
import type { TaskRow } from "./store"
import { TaskCompletionDecisionPayloadSchema, type TaskCompletionDecisionPayload } from "./completion-decision-facts"

export type PreparedTaskCompletionDecision = {
  artifactID: string
  taskID: string
  payload: TaskCompletionDecisionPayload
}

/** Actual package-owned worker outputs, independent of any reference graph. */
function deriveWorkerArtifactLocators(input: {
  taskID: string
  payload: TaskCompletionDecisionPayload
}): EngineArtifactLocator[] {
  const binding = input.payload.workflow_binding
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
          producer.data.package_revision.package_digest !== binding.package_revision.package_digest
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

export async function prepareTaskCompletionDecision(input: {
  taskID: string
  /** The Host owns `worker_artifact_locators`; a caller cannot supply or override it. */
  payload: Omit<TaskCompletionDecisionPayload, "worker_artifact_locators">
  visibleToolName: string
}): Promise<PreparedTaskCompletionDecision> {
  const payload = TaskCompletionDecisionPayloadSchema.parse(input.payload)
  const workerArtifactLocators = (await assertTaskEvidenceLocators({
    taskID: input.taskID,
    evidenceLocators: deriveWorkerArtifactLocators({ taskID: input.taskID, payload }),
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
      worker_artifact_locators: workerArtifactLocators,
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
  assertTaskWorkflowPackageInTransaction({
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

export async function assertTaskCompletionEvidenceLocators(input: {
  taskID: string
  evidenceLocators: readonly EvidenceLocator[]
}): Promise<EvidenceLocator[]> {
  return assertTaskEvidenceLocators(input)
}
