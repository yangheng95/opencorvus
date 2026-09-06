import z from "zod"
import { and, eq } from "drizzle-orm"
import { realpathSync } from "node:fs"
import { realpath } from "node:fs/promises"
import { Database } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { Ownership } from "@/engine/ownership"
import { TASK_PROCESS_MODE_ENV } from "@/runtime/task-process-deployment"
import {
  activeExecutionCapsuleRuntimeFact,
  ExecutionCapsuleRuntimeUnavailableError,
  type TaskExecutionCapsuleRequest,
} from "@/execution-capsule/runtime"
import { executionCapsuleSourceTreeDigest } from "@/execution-capsule/tree-digest"
import { insertEngineArtifact } from "./artifact"
import { EngineArtifactTable, EngineTaskTable } from "./engine.sql"
import { listStartedIncompleteTaskIDs } from "./store"
import {
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
  TASK_NATIVE_PROCESS_BINDING_PROTOCOL,
  TaskExecutionCapsuleBindingPayloadSchema,
  TaskNativeProcessBindingPayloadSchema,
  TaskProcessBindingPayloadSchema,
  type TaskExecutionCapsuleBindingPayload,
  type TaskProcessBindingPayload,
} from "./task-creation-facts"
export {
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
  TASK_NATIVE_PROCESS_BINDING_PROTOCOL,
  TaskExecutionCapsuleBindingPayloadSchema,
  TaskNativeProcessBindingPayloadSchema,
  TaskProcessBindingPayloadSchema,
  type TaskExecutionCapsuleBindingPayload,
  type TaskProcessBindingPayload,
} from "./task-creation-facts"

export function configuredTaskProcessMode(): "native" | "capsule" {
  const mode = process.env[TASK_PROCESS_MODE_ENV]
  if (mode === "native" || mode === "capsule") return mode
  throw new ExecutionCapsuleRuntimeUnavailableError(
    `${TASK_PROCESS_MODE_ENV} must explicitly declare native or capsule Task execution`,
  )
}

function physicalTaskRoot(directory: string): string {
  return Filesystem.normalizePath(realpathSync.native(directory))
}

export async function prepareTaskProcessBinding(input: {
  mode: "native" | "capsule"
  taskID: string
  projectID: string
  rootDirectory: string
  packageRevisionSHA256: string
  timeCreated: number
}): Promise<TaskProcessBindingPayload> {
  const logicalRoot = Filesystem.resolve(input.rootDirectory)
  const root = physicalTaskRoot(input.rootDirectory)
  if (input.mode === "native") {
    return TaskNativeProcessBindingPayloadSchema.parse({
      protocol: TASK_NATIVE_PROCESS_BINDING_PROTOCOL,
      task_id: input.taskID,
      project_id: input.projectID,
      package_revision_sha256: input.packageRevisionSHA256,
      mode: "native",
      logical_workspace_root: logicalRoot,
      workspace_root: root,
      initial_tree_sha256: await executionCapsuleSourceTreeDigest(root),
      time_created: input.timeCreated,
    })
  }
  const runtime = await activeExecutionCapsuleRuntimeFact()
  if (!runtime) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task ${input.taskID} requires the configured Capsule deployment runtime`,
    )
  }
  if (!Filesystem.contains(runtime.outerVisibleRoot, root)) {
    throw new Error(`Task ${input.taskID} Capsule root ${root} is outside ${runtime.outerVisibleRoot}`)
  }
  return TaskExecutionCapsuleBindingPayloadSchema.parse({
    protocol: TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
    task_id: input.taskID,
    project_id: input.projectID,
    package_revision_sha256: input.packageRevisionSHA256,
    runtime_descriptor_sha256: runtime.descriptorSHA256,
    runtime_identity_sha256: runtime.runtimeIdentitySHA256,
    logical_workspace_root: logicalRoot,
    workspace: {
      root,
      initial_tree_sha256: await executionCapsuleSourceTreeDigest(root),
      access: "read_write",
    },
    network: runtime.network,
    resources: runtime.resources,
    time_created: input.timeCreated,
  })
}

export function insertTaskProcessBinding(input: {
  db: Database.TxOrDb
  payload: TaskProcessBindingPayload
}) {
  const payload = TaskProcessBindingPayloadSchema.parse(input.payload)
  insertEngineArtifact(input.db, {
    taskID: payload.task_id,
    kind: "task_execution_capsule_binding",
    label: "Task process authority binding",
    payload,
    timeCreated: payload.time_created,
    timeUpdated: payload.time_created,
  })
}

export function assertTaskProcessBindingCreation(input: {
  payload: TaskProcessBindingPayload
  taskID: string
  projectID: string
  rootDirectory: string
  packageRevisionSHA256: string
  timeCreated: number
}): void {
  const payload = TaskProcessBindingPayloadSchema.parse(input.payload)
  const root = payload.protocol === TASK_NATIVE_PROCESS_BINDING_PROTOCOL ? payload.workspace_root : payload.workspace.root
  if (
    payload.task_id !== input.taskID ||
    payload.project_id !== input.projectID ||
    payload.package_revision_sha256 !== input.packageRevisionSHA256 ||
    payload.time_created !== input.timeCreated ||
    payload.logical_workspace_root !== Filesystem.resolve(input.rootDirectory) ||
    physicalTaskRoot(root) !== physicalTaskRoot(input.rootDirectory)
  ) {
    throw new Error(`Task ${input.taskID} process binding conflicts with its creation transaction`)
  }
}

export function readTaskProcessBinding(taskID: string): TaskProcessBindingPayload {
  const rows = Database.use((db) =>
    db
      .select({ payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "task_execution_capsule_binding"),
        ),
      )
      .all(),
  )
  if (rows.length !== 1) throw new Error(`Task ${taskID} has ${rows.length} process authority bindings`)
  return TaskProcessBindingPayloadSchema.parse(rows[0]!.payload)
}

/** Durable physical-directory authority across dispatch recovery and prompt
 *  handoff gaps. A Task process binding is immutable for the Task lifetime. */
export function activeTaskProcessBindingRoots(input: {
  projectID: string
  diagnosticRoot: string
}): Array<{ taskID: string; directory: string }> {
  const roots: Array<{ taskID: string; directory: string }> = []
  const activeTaskIDs = new Set(listStartedIncompleteTaskIDs({ projectID: input.projectID }))
  const { rows } = Database.use((db) => ({
    rows: db
      .select({ payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.kind, "task_execution_capsule_binding"))
      .all(),
  }))
  for (const row of rows) {
    const parsed = TaskProcessBindingPayloadSchema.safeParse(row.payload)
    if (!parsed.success) {
      throw Ownership.observationFailure({
        operation: "read-process-binding-authority",
        code: "INVALID_AUTHORITY",
        scope: "worktree-ownership",
        diagnosticPath: input.diagnosticRoot,
        cause: parsed.error,
        message: "Worktree ownership authority is invalid",
      })
    }
    const binding = parsed.data
    if (binding.project_id !== input.projectID || !activeTaskIDs.has(binding.task_id)) continue
    const root =
      binding.protocol === TASK_NATIVE_PROCESS_BINDING_PROTOCOL ? binding.workspace_root : binding.workspace.root
    roots.push({ taskID: binding.task_id, directory: root })
  }
  return roots
}

export function readTaskExecutionCapsuleBinding(taskID: string): TaskExecutionCapsuleBindingPayload | undefined {
  const binding = readTaskProcessBinding(taskID)
  return binding.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL ? binding : undefined
}

async function assertCurrentRuntimeBinding(binding: TaskExecutionCapsuleBindingPayload) {
  const runtime = await activeExecutionCapsuleRuntimeFact()
  if (!runtime) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task ${binding.task_id} Execution Capsule runtime descriptor is unavailable`,
    )
  }
  if (
    binding.runtime_descriptor_sha256 !== runtime.descriptorSHA256 ||
    binding.runtime_identity_sha256 !== runtime.runtimeIdentitySHA256 ||
    binding.network !== runtime.network ||
    JSON.stringify(binding.resources) !== JSON.stringify(runtime.resources)
  ) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task ${binding.task_id} Execution Capsule binding does not match the active runtime`,
    )
  }
}

export async function activeTaskExecutionCapsule(input: {
  taskID: string
  cwd: string
}): Promise<TaskExecutionCapsuleRequest | undefined> {
  const processBinding = readTaskProcessBinding(input.taskID)
  const deploymentMode = configuredTaskProcessMode()
  const descriptorActive = Boolean(process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR?.trim())
  if (processBinding.protocol === TASK_NATIVE_PROCESS_BINDING_PROTOCOL) {
    if (deploymentMode !== "native" || descriptorActive) {
      throw new ExecutionCapsuleRuntimeUnavailableError(
        `Task ${input.taskID} native process binding cannot run under an active Capsule descriptor`,
      )
    }
    return undefined
  }
  if (deploymentMode !== "capsule" || !descriptorActive) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task ${input.taskID} Execution Capsule runtime descriptor is unavailable`,
    )
  }
  const binding = processBinding
  await assertCurrentRuntimeBinding(binding)
  return Object.freeze({
    taskID: input.taskID,
    root: binding.workspace.root,
    cwd: input.cwd,
    network: binding.network,
  })
}

export type ResolvedTaskProcessExecution =
  | Readonly<{ kind: "task_native"; taskID: string; cwd: string }>
  | Readonly<{ kind: "task_capsule"; capsule: TaskExecutionCapsuleRequest }>

export async function resolveTaskProcessExecution(input: {
  taskID: string
  cwd: string
}): Promise<ResolvedTaskProcessExecution> {
  const binding = readTaskProcessBinding(input.taskID)
  const deploymentMode = configuredTaskProcessMode()
  const descriptorActive = Boolean(process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR?.trim())
  if (binding.protocol === TASK_NATIVE_PROCESS_BINDING_PROTOCOL) {
    if (deploymentMode !== "native" || descriptorActive) {
      throw new ExecutionCapsuleRuntimeUnavailableError(
        `Task ${input.taskID} native process binding cannot run under an active Capsule descriptor`,
      )
    }
    const boundRoot = Filesystem.normalizePath(await realpath(binding.workspace_root))
    const cwd = Filesystem.normalizePath(await realpath(input.cwd))
    if (!Filesystem.contains(boundRoot, cwd)) {
      throw new ExecutionCapsuleRuntimeUnavailableError(
        `Task ${input.taskID} process cwd ${cwd} is outside immutable native root ${boundRoot}`,
      )
    }
    return Object.freeze({ kind: "task_native", taskID: input.taskID, cwd })
  }
  const capsule = await activeTaskExecutionCapsule(input)
  if (!capsule) {
    throw new ExecutionCapsuleRuntimeUnavailableError(`Task ${input.taskID} Execution Capsule resolution failed`)
  }
  return Object.freeze({ kind: "task_capsule", capsule })
}

export async function assertTaskExecutionCapsuleRuntime(taskID: string): Promise<void> {
  const binding = readTaskProcessBinding(taskID)
  const deploymentMode = configuredTaskProcessMode()
  const descriptorActive = Boolean(process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR?.trim())
  if (binding.protocol === TASK_NATIVE_PROCESS_BINDING_PROTOCOL) {
    if (deploymentMode !== "native" || descriptorActive) {
      throw new ExecutionCapsuleRuntimeUnavailableError(
        `Task ${taskID} native process binding cannot run under an active Capsule descriptor`,
      )
    }
    return
  }
  if (deploymentMode !== "capsule" || !descriptorActive) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task ${taskID} Execution Capsule binding and runtime descriptor must both be present`,
    )
  }
  await assertCurrentRuntimeBinding(binding)
}

export async function assertTaskExecutionCapsuleReplay(input: {
  taskID: string
  requestedRoot: string
}): Promise<void> {
  await assertTaskExecutionCapsuleRuntime(input.taskID)
  const binding = readTaskProcessBinding(input.taskID)
  const bindingRoot = binding.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL
    ? binding.workspace.root
    : binding.workspace_root
  const requestedRoot = Filesystem.normalizePath(await realpath(input.requestedRoot))
  const boundRoot = Filesystem.normalizePath(await realpath(bindingRoot))
  if (requestedRoot !== boundRoot) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task ${input.taskID} replay root ${requestedRoot} does not match immutable Capsule root ${boundRoot}`,
    )
  }
}

export function assertTaskNetworkCapability(input: { taskID: string; capability: string }): void {
  const binding = readTaskProcessBinding(input.taskID)
  if (binding.protocol === TASK_NATIVE_PROCESS_BINDING_PROTOCOL) return
  if (binding.network === "none") {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task ${input.taskID} Capsule network capability is none; ${input.capability} is unavailable`,
    )
  }
}
