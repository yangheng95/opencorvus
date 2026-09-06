import z from "zod"
import { CheckConfig } from "./check-config"
import { ExpertSquadPackageRevisionBindingSchema } from "./expert-squad-package-revision-binding"
import {
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
  TASK_NATIVE_PROCESS_BINDING_PROTOCOL,
} from "./task-process-binding-contract"
export {
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
  TASK_NATIVE_PROCESS_BINDING_PROTOCOL,
} from "./task-process-binding-contract"

const SHA256 = z.string().regex(/^[a-f0-9]{64}$/)

export const TASK_PACKAGE_REVISION_BINDING_PROTOCOL = "task-package-revision-binding-v1" as const

export const TaskNativeProcessBindingPayloadSchema = z
  .object({
    protocol: z.literal(TASK_NATIVE_PROCESS_BINDING_PROTOCOL),
    task_id: z.string().min(1),
    project_id: z.string().min(1),
    package_revision_sha256: SHA256,
    mode: z.literal("native"),
    logical_workspace_root: z.string().min(1),
    workspace_root: z.string().min(1),
    initial_tree_sha256: SHA256,
    time_created: z.number().int().nonnegative(),
  })
  .strict()

export const TaskExecutionCapsuleBindingPayloadSchema = z
  .object({
    protocol: z.literal(TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL),
    task_id: z.string().min(1),
    project_id: z.string().min(1),
    package_revision_sha256: SHA256,
    runtime_descriptor_sha256: SHA256,
    runtime_identity_sha256: SHA256,
    logical_workspace_root: z.string().min(1),
    workspace: z
      .object({
        root: z.string().min(1),
        initial_tree_sha256: SHA256,
        access: z.literal("read_write"),
      })
      .strict(),
    network: z.literal("none"),
    resources: z
      .object({
        memory_max_bytes: z.number().int().positive(),
        tasks_max: z.number().int().positive(),
        nofile_max: z.number().int().positive(),
        tmpfs_max_bytes: z.number().int().positive(),
        cpu_quota_percent: z.number().positive().max(100),
      })
      .strict(),
    time_created: z.number().int().nonnegative(),
  })
  .strict()

export const TaskProcessBindingPayloadSchema = z.discriminatedUnion("protocol", [
  TaskNativeProcessBindingPayloadSchema,
  TaskExecutionCapsuleBindingPayloadSchema,
])
export type TaskProcessBindingPayload = z.infer<typeof TaskProcessBindingPayloadSchema>
export type TaskExecutionCapsuleBindingPayload = z.infer<typeof TaskExecutionCapsuleBindingPayloadSchema>

export const TaskPackageRevisionBindingPayloadSchema = z
  .object({
    protocol: z.literal(TASK_PACKAGE_REVISION_BINDING_PROTOCOL),
    package_revision: ExpertSquadPackageRevisionBindingSchema,
    creation_expected_package_digest: SHA256.nullable(),
    time_created: z.number().int().nonnegative(),
  })
  .strict()
export type TaskPackageRevisionBindingPayload = z.infer<typeof TaskPackageRevisionBindingPayloadSchema>

export const TaskCreationResolutionSeedSchema = z
  .object({
    protocol: z.literal("task-creation-resolution-seed-v1"),
    selected_profile_id: z.string().min(1),
    package_revision: z
      .object({
        scope: z.enum(["built_in", "project", "global"]),
        projectID: z.string().nullable(),
        namespace: z.string().min(1),
        id: z.string().min(1),
        version: z.string().min(1),
        packageDigest: SHA256,
      })
      .strict(),
    process_mode: z.enum(["native", "capsule"]),
    resolved_checks: CheckConfig,
  })
  .strict()
export type TaskCreationResolutionSeed = z.infer<typeof TaskCreationResolutionSeedSchema>
