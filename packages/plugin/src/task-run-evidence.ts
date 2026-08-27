import { z } from "zod"
import { ArtifactProducerSchema } from "./artifact-producer.js"
import { TaskArtifactSnapshotIdentitySchema } from "./task-artifact.js"

const SHA256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const TerminalLifecycleReferenceSchema = z
  .object({
    terminalEventID: z.string().min(1),
    terminalStatus: z.enum(["completed", "failed", "cancelled"]),
    timeCompleted: z.number().int().positive(),
    terminalError: z.string().min(1).optional(),
    terminalReason: z.literal("interrupted").optional(),
  })
  .strict()

export const TaskRunMessageLocatorSchema = z
  .object({
    session_id: z.string().min(1),
    message_id: z.string().min(1),
  })
  .strict()

export const DurableActivityCursorSchema = z
  .object({
    source: z.enum(["task", "session", "message", "part", "engine_artifact", "interaction_request"]),
    id: z.string().min(1),
    time_updated: z.number().int().nonnegative(),
  })
  .strict()

export type DurableActivityCursor = z.infer<typeof DurableActivityCursorSchema>

export const TaskRunTerminalOccurrenceSchema = z
  .discriminatedUnion("status", [
    z
      .object({
        status: z.literal("completed"),
        lifecycle: TerminalLifecycleReferenceSchema.extend({ terminalStatus: z.literal("completed") }).strict(),
        completion_decision_artifact_id: z.string().min(1),
      })
      .strict(),
    z
      .object({
        status: z.enum(["failed", "cancelled"]),
        lifecycle: TerminalLifecycleReferenceSchema,
        completion_decision_artifact_id: z.null(),
      })
      .strict(),
    z
      .object({
        status: z.literal("inactive"),
        last_activity: DurableActivityCursorSchema,
      })
      .strict(),
    z
      .object({
        status: z.literal("awaiting_interaction"),
        interaction_request_id: z.string().min(1),
        time_created: z.number().int().nonnegative(),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (
      (value.status === "failed" || value.status === "cancelled") &&
      value.lifecycle.terminalStatus !== value.status
    ) {
      context.addIssue({ code: "custom", path: ["lifecycle", "terminalStatus"], message: "terminal status must match" })
    }
  })

export const TaskRunEvidenceCollectInputSchema = z
  .object({
    taskID: z.string().min(1),
    terminalOccurrence: TaskRunTerminalOccurrenceSchema,
    selectedMessageLocators: z.array(TaskRunMessageLocatorSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.selectedMessageLocators.map((locator) => `${locator.session_id}\u0000${locator.message_id}`)
    if (new Set(keys).size !== keys.length) {
      context.addIssue({
        code: "custom",
        path: ["selectedMessageLocators"],
        message: "selected Message locators must be unique exact identities",
      })
    }
  })

export const TaskRunEvidenceMessageSchema = z
  .object({
    locator: TaskRunMessageLocatorSchema,
    role: z.string().min(1),
    agent: z.string().min(1).nullable(),
    time_created: z.number().int().nonnegative(),
    time_updated: z.number().int().nonnegative(),
    canonical_sha256: SHA256Schema,
    canonical_bytes: z.number().int().nonnegative(),
    parts: z.array(
      z
        .object({
          id: z.string().min(1),
          type: z.string().min(1),
          time_created: z.number().int().nonnegative(),
          time_updated: z.number().int().nonnegative(),
          canonical_sha256: SHA256Schema,
          canonical_bytes: z.number().int().nonnegative(),
          tool: z
            .object({
              name: z.string().min(1),
              call_id: z.string().min(1),
              status: z.string().min(1),
            })
            .strict()
            .optional(),
        })
        .strict(),
    ),
    body: z.unknown().optional(),
  })
  .strict()

export const TaskRunEvidenceBundleSchema = z
  .object({
    schema_version: z.literal(1),
    task: z
      .object({
        id: z.string().min(1),
        project_id: z.string().min(1),
        session_id: z.string().min(1),
        request_sha256: SHA256Schema,
        status: z.enum(["active", "completed", "failed", "cancelled"]),
        time_started: z.number().int().nonnegative(),
        time_completed: z.number().int().nonnegative().nullable(),
        error: z.string().nullable(),
      })
      .strict(),
    revision_facts: z
      .object({
        installed_resolved_digest: SHA256Schema,
        creation_expected_digest: SHA256Schema.nullable(),
        task_binding_digest: SHA256Schema,
        workflow_binding_digest: SHA256Schema.nullable(),
        runtime_snapshot_digests: z.array(SHA256Schema),
      })
      .strict(),
    workspace_checkpoint: z
      .object({
        initial_tree_sha256: SHA256Schema,
        execution_baseline_tree_sha256: SHA256Schema,
        process_binding_sha256: SHA256Schema,
        baseline: z
          .object({
            commit: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/),
            tree: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/),
            repositories: z.array(
              z
                .object({
                  path: z.string().min(1),
                  depth: z.number().int().nonnegative(),
                  commit: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/),
                  tree: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/),
                  authority: z
                    .object({
                      workspace: z.string().min(1),
                      git_marker_kind: z.enum(["directory", "file"]),
                      git_marker_realpath: z.string().min(1),
                      git_marker_sha256: SHA256Schema.optional(),
                      git_dir: z.string().min(1),
                      common_dir: z.string().min(1),
                      index_path: z.string().min(1),
                      object_format: z.enum(["sha1", "sha256"]),
                      ref: z.string().min(1),
                    })
                    .strict(),
                })
                .strict(),
            ),
          })
          .strict(),
        result: z.discriminatedUnion("kind", [
          z
            .object({
              kind: z.literal("terminal_git"),
              commit: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/),
              tree: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/),
              repositories: z.array(
                z
                  .object({
                    path: z.string().min(1),
                    depth: z.number().int().nonnegative(),
                    commit: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/),
                    tree: z.string().regex(/^[a-f0-9]{40}([a-f0-9]{24})?$/),
                    authority: z
                      .object({
                        workspace: z.string().min(1),
                        git_marker_kind: z.enum(["directory", "file"]),
                        git_marker_realpath: z.string().min(1),
                        git_marker_sha256: SHA256Schema.optional(),
                        git_dir: z.string().min(1),
                        common_dir: z.string().min(1),
                        index_path: z.string().min(1),
                        object_format: z.enum(["sha1", "sha256"]),
                        ref: z.string().min(1),
                      })
                      .strict(),
                  })
                  .strict(),
              ),
            })
            .strict(),
          z
            .object({
              kind: z.literal("live_observation"),
              tree_sha256: SHA256Schema,
              time_observed: z.number().int().nonnegative(),
            })
            .strict(),
        ]),
      })
      .strict(),
    terminal_occurrence: TaskRunTerminalOccurrenceSchema,
    sessions: z.array(
      z
        .object({
          id: z.string().min(1),
          parent_id: z.string().min(1).nullable(),
          kind: z.string().min(1),
          time_created: z.number().int().nonnegative(),
          time_updated: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    messages: z.array(TaskRunEvidenceMessageSchema),
    engine_artifacts: z.array(
      z
        .object({
          artifact_id: z.string().min(1),
          kind: z.string().min(1),
          artifact_type: z.string().min(1).nullable(),
          schema_version: z.number().int().positive().nullable(),
          catalog_revision: z.number().int().positive(),
          payload_sha256: SHA256Schema,
          payload_bytes: z.number().int().nonnegative(),
          time_created: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    task_artifacts: z.array(
      z
        .object({
          snapshot: TaskArtifactSnapshotIdentitySchema,
          snapshot_kind: z.enum(["catalog", "engine_resource"]),
          publication_sequence: z.number().int().positive(),
          created_at_ms: z.number().int().nonnegative(),
          producer: ArtifactProducerSchema,
          trees: z.array(
            z
              .object({
                tree: z.string().min(1),
                files: z.array(
                  z
                    .object({
                      path: z.string().min(1),
                      media_type: z.string().min(1),
                      bytes: z.number().int().nonnegative(),
                      sha256: SHA256Schema,
                    })
                    .strict(),
                ),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    canonical_sha256: SHA256Schema,
  })
  .strict()

export type TaskRunEvidenceCollectInput = z.infer<typeof TaskRunEvidenceCollectInputSchema>
export type TaskRunEvidenceBundle = z.infer<typeof TaskRunEvidenceBundleSchema>

export function canonicalTaskRunEvidenceJSON(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalTaskRunEvidenceJSON).join(",")}]`
  if (typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalTaskRunEvidenceJSON(record[key])}`)
      .join(",")}}`
  }
  throw new Error("Task run evidence contains a non-canonical JSON value")
}

export type TaskRunEvidenceHost = Readonly<{
  collect(input: TaskRunEvidenceCollectInput): Promise<TaskRunEvidenceBundle>
}>
