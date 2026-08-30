import path from "node:path"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { requireTask } from "@/engine/store"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import {
  SessionRuntimeContractStore,
  type SessionRuntimeContractIdentity,
} from "@/session/runtime-contract"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { sameProjectedWorkerIdentity } from "@/agent/projected-worker-identity"
import { Filesystem } from "@/util/filesystem"
import { currentTaskToolInvocationSurface } from "@/tool/task-tool-invocation"
import type { ToolExecutionSurface } from "@/tool/execution-surface"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { sameExpertSquadPackageRevision } from "@/expert-squad/package-revision"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import { harnessGrantedRefs } from "@/capability/harness-projection"
import { capabilityRef, CapabilityRefCodec, type CapabilityRef } from "@opencorvus-ai/util/capability-ref"

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

function projectedBindingCapabilityRef(binding: ProjectedTaskToolRuntimeBinding): CapabilityRef {
  switch (binding.providerKind) {
    case "package-tool":
      return capabilityRef({
        kind: "tool",
        source: "package",
        owner_ref: binding.expertSquadID,
        local_ref: binding.providerName,
      })
    case "package-mcp-tool":
      return capabilityRef({
        kind: "mcp_tool",
        source: "package",
        owner_ref: binding.expertSquadID,
        local_ref: binding.providerName,
      })
    case "default-mcp-tool":
      return capabilityRef({
        kind: "mcp_tool",
        source: "project",
        owner_ref: "default-mcp-registry",
        local_ref: binding.providerName,
      })
  }
}

function exactRefIn(refs: readonly CapabilityRef[], expected: CapabilityRef): boolean {
  const encoded = CapabilityRefCodec.encode(expected)
  return refs.some((ref) => CapabilityRefCodec.encode(ref) === encoded)
}

export class TaskToolCapabilityAuthorityError extends Error {
  override readonly name = "TaskToolCapabilityAuthorityError"
}

export function assertExactTaskToolCapabilityAuthority(input: {
  toolName: string
  expected: CapabilityRef
  executableRefs: readonly CapabilityRef[]
  activeRefs: readonly CapabilityRef[]
}): void {
  if (!exactRefIn(input.executableRefs, input.expected)) {
    throw new TaskToolCapabilityAuthorityError(
      `${input.toolName}: projected runtime Harness does not grant exact ref ${CapabilityRefCodec.encode(input.expected)}.`,
    )
  }
  if (!exactRefIn(input.activeRefs, input.expected)) {
    throw new TaskToolCapabilityAuthorityError(
      `${input.toolName}: current occurrence did not reveal exact ref ${CapabilityRefCodec.encode(input.expected)}.`,
    )
  }
}

export type TaskToolExecutionScope = Readonly<{
  kind: "task"
  projectID: string
  projectDirectory: string
  /** Persisted Session working directory. Projected Build workers execute in
   * their managed worktree while projectDirectory remains the primary Task
   * root used by lifecycle and publication authority. */
  executionDirectory?: string
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

export function executionAuthorityFromTaskToolScope(scope: TaskToolExecutionScope): SessionExecutionAuthority {
  return Object.freeze({
    kind: "task",
    sessionID: scope.sessionID,
    projectID: scope.projectID,
    taskID: scope.taskID,
    directory: scope.projectDirectory,
  })
}

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

  const expectedCapabilityRef = projectedBindingCapabilityRef(input.expected)
  assertExactTaskToolCapabilityAuthority({
    toolName: input.expected.providerName,
    expected: expectedCapabilityRef,
    executableRefs: harnessGrantedRefs(contract.harnessGrants, "execute"),
    activeRefs: execution.executionSurface.capability_projection?.active_refs ?? [],
  })

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
    executionDirectory: canonicalDirectory(execution.session.directory),
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
 * Resolve one Core-owned projected Task tool from the current immutable
 * runtime contract. Unlike package tools, the Core tool has no package bundle
 * binding; its persisted call identity and exact projected owner are the authority.
 */
export async function resolveCoreProjectedTaskToolExecutionScope(input: {
  options: unknown
  toolName: string
}): Promise<TaskToolExecutionScope> {
  const execution = await resolvePersistedTaskToolCall(input.options, input.toolName)
  const contract = SessionRuntimeContractStore.get(execution.sessionID)
  if (
    !contract ||
    (contract.identity.identityKind !== "projected-worker" &&
      contract.identity.identityKind !== "projected-scheduler")
  ) {
    throw new Error(`${input.toolName}: current Session is not a projected Task scheduler or worker.`)
  }
  const identity = contract.identity
  if (identity.taskID !== execution.taskID || identity.sessionID !== execution.sessionID) {
    throw new Error(`${input.toolName}: projected Task identity does not match the persisted Task call.`)
  }
  if (execution.session.kind !== identity.sessionKind) {
    throw new Error(`${input.toolName}: execution Session kind does not match the projected Task owner.`)
  }
  if (execution.message.agent !== identity.agentID || execution.message.author !== identity.agentID) {
    throw new Error(`${input.toolName}: assistant message owner does not match the projected Task owner.`)
  }
  if (execution.message.time.completed !== undefined || execution.part.state.status !== "running") {
    throw new Error(`${input.toolName}: persisted tool call is no longer the current running invocation.`)
  }
  if (identity.identityKind === "projected-worker") assertWorkerDescriptor(identity)
  const expectedCapabilityRef = capabilityRef({
    kind: "tool",
    source: "platform",
    owner_ref: "tool-registry",
    local_ref: input.toolName,
  })
  assertExactTaskToolCapabilityAuthority({
    toolName: input.toolName,
    expected: expectedCapabilityRef,
    executableRefs: harnessGrantedRefs(contract.harnessGrants, "execute"),
    activeRefs: execution.executionSurface.capability_projection?.active_refs ?? [],
  })
  const projectDirectory = taskPrimaryProjectRoot(execution.taskID, { activeProjectID: execution.projectID })
  if (canonicalDirectory(contract.projectDirectory) !== canonicalDirectory(projectDirectory)) {
    throw new Error(`${input.toolName}: projected project directory does not match the Task project root.`)
  }
  return Object.freeze({
    kind: "task",
    projectID: execution.projectID,
    projectDirectory,
    executionDirectory: canonicalDirectory(execution.session.directory),
    taskID: execution.taskID,
    taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(projectDirectory, execution.taskID),
    sessionID: execution.sessionID,
    messageID: execution.messageID,
    toolCallID: execution.toolCallID,
    toolPartID: execution.toolPartID,
    executionSurface: execution.executionSurface,
    owner:
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
          }),
  })
}

export async function resolveCoreProjectedWorkerToolExecutionScope(input: {
  options: unknown
  toolName: string
}): Promise<TaskToolExecutionScope> {
  const scope = await resolveCoreProjectedTaskToolExecutionScope(input)
  if (scope.owner.kind !== "projected-worker") {
    throw new Error(`${input.toolName}: current Session is not a projected Task worker.`)
  }
  return scope
}

export async function resolvePackageTaskToolExecutionScope(input: {
  options: unknown
  expected: PackageToolRuntimeBinding
}): Promise<TaskToolExecutionScope> {
  return resolveProjectedTaskToolExecutionScope(input)
}
