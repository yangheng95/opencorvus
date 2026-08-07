import path from "node:path"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { requireTask } from "@/engine/store"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import {
  SessionRuntimeContractStore,
  sessionRuntimeToolRecords,
  type SessionRuntimeContractIdentity,
} from "@/session/runtime-contract"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { sameProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import { Filesystem } from "@/util/filesystem"
import { currentTaskToolInvocationSurface } from "@/tool/task-tool-invocation"
import type { ToolExecutionSurface } from "@/tool/execution-surface"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { sameExpertSquadPackageRevision } from "@/expert-squad/package-revision"

// SDK means Software Development Kit; SHA-256 means Secure Hash Algorithm 256-bit.
export type ProjectedTaskToolRuntimeBinding = Readonly<{
  taskID: string
  projectDirectory: string
  ownerKind: "projected-scheduler" | "projected-worker"
  expertSquadID: string
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
  agentID: string
  projectionHash: string
  providerKind: "package-tool" | "package-mcp-tool" | "default-mcp-tool"
  toolRef: string
  providerName: string
  runtimeToolID: string
  mcpServerConfigSHA256?: string
}>

export type PackageToolRuntimeBinding = ProjectedTaskToolRuntimeBinding &
  Readonly<{
    providerKind: "package-tool"
    compiledBundleSHA256: string
  }>

export type TaskToolExecutionScope = Readonly<{
  kind: "task"
  projectID: string
  projectDirectory: string
  taskID: string
  taskRuntimeDirectory: string
  sessionID: string
  messageID: string
  toolCallID: string
  toolPartID: string
  executionSurface: ToolExecutionSurface
  owner: Readonly<
    | {
        kind: "projected-scheduler"
        expertSquadID: string
        packageRevision: PromptProfileResolver.ResolvedPackageRevision
        agentID: "orchestrator"
        projectionHash: string
      }
    | {
        kind: "projected-worker"
        expertSquadID: string
        packageRevision: PromptProfileResolver.ResolvedPackageRevision
        agentID: string
        projectionHash: string
        workerTurnDescriptorID: string
        workerTurnDescriptorHash: string
      }
  >
}>

const projectedTaskToolRuntimeBinding = Symbol("opencorvus.projected-task-tool-runtime-binding")

type AiSdkExecutionOptions = {
  toolCallId?: unknown
  opencorvus?: {
    projectID?: unknown
    sessionID?: unknown
    messageID?: unknown
    toolCallID?: unknown
    toolPartID?: unknown
    invocationAuthority?: unknown
  }
}

export function bindProjectedTaskToolRuntime<T extends object>(tool: T, binding: ProjectedTaskToolRuntimeBinding): T {
  Object.defineProperty(tool, projectedTaskToolRuntimeBinding, {
    value: Object.freeze({ ...binding, packageRevision: Object.freeze({ ...binding.packageRevision }) }),
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return tool
}

export function bindPackageToolRuntime<T extends object>(tool: T, binding: PackageToolRuntimeBinding): T {
  return bindProjectedTaskToolRuntime(tool, binding)
}

function runtimeBinding(tool: object | undefined): ProjectedTaskToolRuntimeBinding | undefined {
  return (
    tool &&
    (tool as { [projectedTaskToolRuntimeBinding]?: ProjectedTaskToolRuntimeBinding })[projectedTaskToolRuntimeBinding]
  )
}

export function projectedTaskToolRuntimeBindingOf(
  tool: object | undefined,
): ProjectedTaskToolRuntimeBinding | undefined {
  return runtimeBinding(tool)
}

function requireExecutionIdentity(options: unknown, toolName: string) {
  const record = options as AiSdkExecutionOptions | undefined
  const meta = record?.opencorvus
  const projectID = typeof meta?.projectID === "string" ? meta.projectID : ""
  const sessionID = typeof meta?.sessionID === "string" ? meta.sessionID : ""
  const messageID = typeof meta?.messageID === "string" ? meta.messageID : ""
  const toolCallID = typeof meta?.toolCallID === "string" ? meta.toolCallID : ""
  const toolPartID = typeof meta?.toolPartID === "string" ? meta.toolPartID : ""
  const sdkToolCallID = typeof record?.toolCallId === "string" ? record.toolCallId : ""
  if (!projectID || !sessionID || !messageID || !toolCallID || !toolPartID || !sdkToolCallID) {
    throw new Error(
      `${toolName}: missing real task tool execution identity; project/session/message/call/part and SDK call IDs are mandatory.`,
    )
  }
  if (sdkToolCallID !== toolCallID) {
    throw new Error(`${toolName}: SDK tool call ID does not match the persisted execution call ID.`)
  }
  const executionSurface = currentTaskToolInvocationSurface(meta?.invocationAuthority, {
    projectID,
    sessionID,
    messageID,
    toolCallID,
    toolPartID,
    providerName: toolName,
  })
  return { projectID, sessionID, messageID, toolCallID, toolPartID, executionSurface }
}

export async function resolvePersistedTaskToolCall(options: unknown, toolName: string) {
  const execution = requireExecutionIdentity(options, toolName)
  const owningTaskID = taskIDForSession(execution.sessionID)
  if (!owningTaskID) throw new Error(`${toolName}: session ${execution.sessionID} does not belong to a Task.`)
  const task = requireTask(owningTaskID)
  if (task.project_id !== execution.projectID) {
    throw new Error(`${toolName}: persisted Task project does not match execution project identity.`)
  }
  const session = await Session.assertLineageInProject({
    sessionID: execution.sessionID,
    projectID: execution.projectID,
  })
  const message = await MessageStore.get({ sessionID: execution.sessionID, messageID: execution.messageID })
  if (message.info.role !== "assistant") throw new Error(`${toolName}: persisted execution message is not assistant.`)
  const part = message.parts.find((candidate) => candidate.id === execution.toolPartID)
  if (!part || part.type !== "tool" || part.callID !== execution.toolCallID || part.tool !== toolName) {
    throw new Error(`${toolName}: persisted tool part does not match provider name and call identity.`)
  }
  return Object.freeze({ ...execution, taskID: owningTaskID, session, message: message.info, part })
}

function canonicalDirectory(value: string): string {
  return Filesystem.normalizePath(path.resolve(value))
}

function assertRuntimeBinding(
  actual: ProjectedTaskToolRuntimeBinding | undefined,
  expected: ProjectedTaskToolRuntimeBinding,
): void {
  if (!actual) throw new Error(`${expected.providerName}: active runtime tool has no projected execution binding.`)
  for (const key of Object.keys(expected) as (keyof ProjectedTaskToolRuntimeBinding)[]) {
    if (key === "packageRevision") {
      if (!sameExpertSquadPackageRevision(actual.packageRevision, expected.packageRevision)) {
        throw new Error(`${expected.providerName}: active runtime package revision does not match this tool closure.`)
      }
      continue
    }
    if (actual[key] !== expected[key]) {
      throw new Error(
        `${expected.providerName}: active runtime projected binding ${key} does not match this tool closure.`,
      )
    }
  }
}

function assertWorkerDescriptor(
  identity: Extract<SessionRuntimeContractIdentity, { identityKind: "projected-worker" }>,
): void {
  const descriptor = WorkerTurnDescriptor.get({ id: identity.workerTurnDescriptorID, sessionID: identity.sessionID })
  if (!descriptor || descriptor.hash !== identity.workerTurnDescriptorHash) {
    throw new Error(`${identity.agentID}: projected worker runtime descriptor is missing or stale.`)
  }
  if (
    descriptor.payload.expertSquadID !== identity.expertSquadID ||
    !sameExpertSquadPackageRevision(descriptor.payload.packageRevision, identity.packageRevision) ||
    descriptor.payload.lifecycle.taskID !== identity.taskID ||
    !sameProjectedWorkerIdentity(descriptor.payload.identity, identity)
  ) {
    throw new Error(
      `${identity.agentID}: projected worker runtime descriptor does not match the active execution owner.`,
    )
  }
}

export async function resolveProjectedTaskToolExecutionScope(input: {
  options: unknown
  expected: ProjectedTaskToolRuntimeBinding
}): Promise<TaskToolExecutionScope> {
  const execution = await resolvePersistedTaskToolCall(input.options, input.expected.providerName)
  const owningTaskID = execution.taskID
  if (owningTaskID !== input.expected.taskID) {
    throw new Error(
      `${input.expected.providerName}: session ${execution.sessionID} does not belong to expected task ${input.expected.taskID}.`,
    )
  }
  const projectDirectory = taskPrimaryProjectRoot(owningTaskID, { activeProjectID: execution.projectID })
  if (canonicalDirectory(projectDirectory) !== canonicalDirectory(input.expected.projectDirectory)) {
    throw new Error(`${input.expected.providerName}: projected project directory does not match the Task project root.`)
  }

  const contract = SessionRuntimeContractStore.get(execution.sessionID)
  if (!contract) throw new Error(`${input.expected.providerName}: session has no projected runtime contract.`)
  const identity = contract.identity
  if (
    identity.sessionID !== execution.sessionID ||
    identity.taskID !== owningTaskID ||
    identity.identityKind !== input.expected.ownerKind ||
    identity.expertSquadID !== input.expected.expertSquadID ||
    identity.agentID !== input.expected.agentID ||
    identity.projectionHash !== input.expected.projectionHash ||
    !sameExpertSquadPackageRevision(identity.packageRevision, input.expected.packageRevision) ||
    canonicalDirectory(contract.projectDirectory) !== canonicalDirectory(projectDirectory)
  ) {
    throw new Error(`${input.expected.providerName}: projected runtime contract does not match the package tool owner.`)
  }
  if (execution.session.kind !== identity.sessionKind) {
    throw new Error(`${input.expected.providerName}: execution Session kind does not match the projected owner.`)
  }
  if (execution.message.agent !== identity.agentID || execution.message.author !== identity.agentID) {
    throw new Error(`${input.expected.providerName}: assistant message owner does not match the projected owner.`)
  }
  if (execution.message.time.completed !== undefined) {
    throw new Error(`${input.expected.providerName}: assistant message is no longer the current running invocation.`)
  }
  if (execution.part.state.status !== "running") {
    throw new Error(`${input.expected.providerName}: persisted tool part is not the current running invocation.`)
  }
  if (identity.identityKind === "projected-worker") assertWorkerDescriptor(identity)

  const activeTool = sessionRuntimeToolRecords(contract).projectedTools[input.expected.providerName]
  assertRuntimeBinding(runtimeBinding(activeTool), input.expected)

  const owner =
    identity.identityKind === "projected-scheduler"
      ? Object.freeze({
          kind: "projected-scheduler" as const,
          expertSquadID: identity.expertSquadID,
          packageRevision: identity.packageRevision,
          agentID: identity.agentID,
          projectionHash: identity.projectionHash,
        })
      : Object.freeze({
          kind: "projected-worker" as const,
          expertSquadID: identity.expertSquadID,
          packageRevision: identity.packageRevision,
          agentID: identity.agentID,
          projectionHash: identity.projectionHash,
          workerTurnDescriptorID: identity.workerTurnDescriptorID,
          workerTurnDescriptorHash: identity.workerTurnDescriptorHash,
        })
  return Object.freeze({
    kind: "task",
    projectID: execution.projectID,
    projectDirectory,
    taskID: owningTaskID,
    taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(projectDirectory, owningTaskID),
    sessionID: execution.sessionID,
    messageID: execution.messageID,
    toolCallID: execution.toolCallID,
    toolPartID: execution.toolPartID,
    executionSurface: execution.executionSurface,
    owner,
  })
}

/**
 * Resolve one Core-owned projected-worker tool from the current immutable
 * runtime contract. Unlike package tools, the Core tool has no package bundle
 * binding; its persisted call identity and the exact worker descriptor are
 * the authority.
 */
export async function resolveCoreProjectedWorkerToolExecutionScope(input: {
  options: unknown
  toolName: string
}): Promise<TaskToolExecutionScope> {
  const execution = await resolvePersistedTaskToolCall(input.options, input.toolName)
  const contract = SessionRuntimeContractStore.get(execution.sessionID)
  if (!contract || contract.identity.identityKind !== "projected-worker") {
    throw new Error(`${input.toolName}: current Session is not a projected Task worker.`)
  }
  const identity = contract.identity
  if (identity.taskID !== execution.taskID || identity.sessionID !== execution.sessionID) {
    throw new Error(`${input.toolName}: projected worker identity does not match the persisted Task call.`)
  }
  if (execution.session.kind !== identity.sessionKind) {
    throw new Error(`${input.toolName}: execution Session kind does not match the projected worker.`)
  }
  if (execution.message.agent !== identity.agentID || execution.message.author !== identity.agentID) {
    throw new Error(`${input.toolName}: assistant message owner does not match the projected worker.`)
  }
  if (execution.message.time.completed !== undefined || execution.part.state.status !== "running") {
    throw new Error(`${input.toolName}: persisted tool call is no longer the current running invocation.`)
  }
  assertWorkerDescriptor(identity)
  if (!contract.projectedRegistryToolIDs?.includes(input.toolName)) {
    throw new Error(`${input.toolName}: tool is not present in the projected worker registry contract.`)
  }
  const projectDirectory = taskPrimaryProjectRoot(execution.taskID, { activeProjectID: execution.projectID })
  if (canonicalDirectory(contract.projectDirectory) !== canonicalDirectory(projectDirectory)) {
    throw new Error(`${input.toolName}: projected project directory does not match the Task project root.`)
  }
  return Object.freeze({
    kind: "task",
    projectID: execution.projectID,
    projectDirectory,
    taskID: execution.taskID,
    taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(projectDirectory, execution.taskID),
    sessionID: execution.sessionID,
    messageID: execution.messageID,
    toolCallID: execution.toolCallID,
    toolPartID: execution.toolPartID,
    executionSurface: execution.executionSurface,
    owner: Object.freeze({
      kind: "projected-worker" as const,
      expertSquadID: identity.expertSquadID,
      packageRevision: identity.packageRevision,
      agentID: identity.agentID,
      projectionHash: identity.projectionHash,
      workerTurnDescriptorID: identity.workerTurnDescriptorID,
      workerTurnDescriptorHash: identity.workerTurnDescriptorHash,
    }),
  })
}

export async function resolvePackageTaskToolExecutionScope(input: {
  options: unknown
  expected: PackageToolRuntimeBinding
}): Promise<TaskToolExecutionScope> {
  return resolveProjectedTaskToolExecutionScope(input)
}
