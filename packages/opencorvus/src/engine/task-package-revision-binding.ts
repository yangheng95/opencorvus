import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { Database, and, eq } from "@/storage/db"
import { insertEngineArtifact } from "./artifact"
import { EngineArtifactTable, EngineTaskTable } from "./engine.sql"
import {
  ExpertSquadPackageRevisionBindingSchema,
  expertSquadPackageRevisionBinding,
  resolvedPackageRevisionFromBinding,
  type ExpertSquadPackageRevisionBinding,
} from "./expert-squad-package-revision-binding"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"

export const TASK_PACKAGE_REVISION_BINDING_PROTOCOL = "task-package-revision-binding-v1" as const
export const TASK_PACKAGE_REVISION_BINDING_LABEL = "Task package revision binding" as const

export const TaskPackageRevisionBindingPayloadSchema = z
  .object({
    protocol: z.literal(TASK_PACKAGE_REVISION_BINDING_PROTOCOL),
    package_revision: ExpertSquadPackageRevisionBindingSchema,
    creation_expected_package_digest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    time_created: z.number().int().nonnegative(),
  })
  .strict()

export type TaskPackageRevisionBindingPayload = z.infer<typeof TaskPackageRevisionBindingPayloadSchema>

export const TaskPackageRevisionBindingError = NamedError.create(
  "TaskPackageRevisionBindingError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    artifactCount: z.number().int().nonnegative(),
  }),
)

export const TaskExpectedPackageDigestConflictError = NamedError.create(
  "TaskExpectedPackageDigestConflictError",
  z.object({
    message: z.string(),
    profileID: z.string(),
    expectedPackageDigest: z.string(),
    actualPackageDigest: z.string(),
  }),
)

export const TaskCreationIdempotencyConflictError = NamedError.create(
  "TaskCreationIdempotencyConflictError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    identityKind: z.enum(["request", "channel"]),
    identity: z.string(),
    pinnedPackageRevision: ExpertSquadPackageRevisionBindingSchema,
    requestedProfileID: z.string(),
    expectedPackageDigest: z.string().optional(),
  }),
)

export const TaskPromptProfileImmutableError = NamedError.create(
  "TaskPromptProfileImmutableError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    pinnedPackageRevision: ExpertSquadPackageRevisionBindingSchema,
    requestedProfileID: z.string(),
  }),
)

export function insertTaskPackageRevisionBinding(input: {
  db: Database.TxOrDb
  taskID: string
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
  creationExpectedPackageDigest?: string
  timeCreated: number
}): TaskPackageRevisionBindingPayload {
  const payload = TaskPackageRevisionBindingPayloadSchema.parse({
    protocol: TASK_PACKAGE_REVISION_BINDING_PROTOCOL,
    package_revision: expertSquadPackageRevisionBinding(input.packageRevision),
    creation_expected_package_digest: input.creationExpectedPackageDigest ?? null,
    time_created: input.timeCreated,
  })
  insertEngineArtifact(input.db, {
    taskID: input.taskID,
    kind: "task_package_revision_binding",
    label: TASK_PACKAGE_REVISION_BINDING_LABEL,
    payload,
    timeCreated: input.timeCreated,
    timeUpdated: input.timeCreated,
  })
  return payload
}

function taskPackageRevisionBindingRows(db: Database.TxOrDb, taskID: string) {
  return db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_package_revision_binding")))
    .all()
}

export function requireTaskPackageRevisionBinding(
  taskID: string,
  db?: Database.TxOrDb,
): ExpertSquadPackageRevisionBinding {
  const rows = db
    ? taskPackageRevisionBindingRows(db, taskID)
    : Database.use((database) => taskPackageRevisionBindingRows(database, taskID))
  if (rows.length !== 1) {
    throw new TaskPackageRevisionBindingError({
      message: `Task ${taskID} requires exactly one immutable package revision binding; found ${rows.length}`,
      taskID,
      artifactCount: rows.length,
    })
  }
  try {
    return TaskPackageRevisionBindingPayloadSchema.parse(rows[0]!.payload).package_revision
  } catch (cause) {
    throw new TaskPackageRevisionBindingError({
      message: `Task ${taskID} package revision binding ${rows[0]!.id} is invalid: ${cause instanceof Error ? cause.message : String(cause)}`,
      taskID,
      artifactCount: rows.length,
    })
  }
}

export function requireTaskResolvedPackageRevision(
  taskID: string,
  db?: Database.TxOrDb,
): PromptProfileResolver.ResolvedPackageRevision {
  return resolvedPackageRevisionFromBinding(requireTaskPackageRevisionBinding(taskID, db))
}

export function taskRootOwnsPackageRevisionBinding(input: { projectID: string; sessionID: string }): boolean {
  const task = Database.use((db) =>
    db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(and(eq(EngineTaskTable.project_id, input.projectID), eq(EngineTaskTable.session_id, input.sessionID)))
      .get(),
  )
  if (!task) return false
  requireTaskPackageRevisionBinding(task.id)
  return true
}
