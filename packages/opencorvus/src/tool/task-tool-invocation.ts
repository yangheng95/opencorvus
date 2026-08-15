import { AsyncLocalStorage } from "node:async_hooks"
import { createToolExecutionSurface, type ToolExecutionSurface } from "./execution-surface"
import { PermissionAuthority } from "@/permission/authority"
import type { ToolInvocationProviderKind } from "@/permission/invocation"

export type TaskToolInvocationIdentity = Readonly<{
  projectID: string
  sessionID: string
  messageID: string
  toolCallID: string
  toolPartID: string
  providerName: string
  providerKind: ToolInvocationProviderKind
  providerID: string
  providerDigest?: string
  args: unknown
}>
export type TaskToolInvocationExpectedIdentity = Pick<
  TaskToolInvocationIdentity,
  "projectID" | "sessionID" | "messageID" | "toolCallID" | "toolPartID" | "providerName"
>

declare const taskToolInvocationAuthorityBrand: unique symbol
export type TaskToolInvocationAuthority = Readonly<{ [taskToolInvocationAuthorityBrand]: true }>

type ActiveInvocation = Readonly<{
  authority: TaskToolInvocationAuthority
  identity: TaskToolInvocationIdentity
  executionSurface: ToolExecutionSurface
  lifetime: { active: boolean }
}>

const activeInvocation = new AsyncLocalStorage<ActiveInvocation>()

export async function withTaskToolInvocation<T>(
  identity: TaskToolInvocationIdentity,
  executionSurface: ToolExecutionSurface,
  execute: (authority: TaskToolInvocationAuthority) => Promise<T>,
): Promise<T> {
  const authority = Object.freeze({}) as TaskToolInvocationAuthority
  const lifetime = { active: true }
  const invocation = Object.freeze({
    authority,
    identity: Object.freeze({ ...identity }),
    executionSurface: createToolExecutionSurface({
      toolIDs: executionSurface.toolIDs,
      permission: executionSurface.permission,
      permissionLayers: executionSurface.permission_layers,
      harnessProjection: executionSurface.harness_projection,
    }),
    lifetime,
  })
  try {
    return await PermissionAuthority.authorizeAndExecute(
      {
        projectID: identity.projectID,
        sessionID: identity.sessionID,
        messageID: identity.messageID,
        toolCallID: identity.toolCallID,
        toolPartID: identity.toolPartID,
        providerKind: identity.providerKind,
        providerID: identity.providerID,
        providerDigest: identity.providerDigest,
        toolName: identity.providerName,
        args: identity.args,
      },
      () => activeInvocation.run(invocation, () => execute(authority)),
    )
  } finally {
    lifetime.active = false
  }
}

export function assertCurrentTaskToolInvocation(
  authority: unknown,
  expected: TaskToolInvocationExpectedIdentity,
): void {
  currentTaskToolInvocationSurface(authority, expected)
}

export function currentTaskToolInvocationSurface(
  authority: unknown,
  expected: TaskToolInvocationExpectedIdentity,
): ToolExecutionSurface {
  const current = activeInvocation.getStore()
  if (!current || !current.lifetime.active || current.authority !== authority) {
    throw new Error(`${expected.providerName}: task tool invocation authority is not current.`)
  }
  for (const key of Object.keys(expected) as (keyof TaskToolInvocationExpectedIdentity)[]) {
    if (current.identity[key] !== expected[key]) {
      throw new Error(
        `${expected.providerName}: current task tool invocation ${key} does not match execution identity.`,
      )
    }
  }
  return current.executionSurface
}
