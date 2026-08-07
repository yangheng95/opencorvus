import type { ProjectedWorkerIdentity } from "./projected-worker-identity"
import { RuntimeTemplateRegistry } from "./runtime-template-registry"
import type { SessionKind } from "@/session/session.sql"
import { rightSidebarConversationAgentID } from "@/chat/session"

export function persistedSessionAgentID(input: {
  sessionID: string
  sessionKind: SessionKind
  metadata?: unknown
  projectedIdentity?: ProjectedWorkerIdentity
}): string {
  if (input.projectedIdentity) {
    if (input.projectedIdentity.sessionKind !== input.sessionKind) {
      throw new Error(
        `Session ${input.sessionID} projected agent ${input.projectedIdentity.agentID} requires ${input.projectedIdentity.sessionKind}, found ${input.sessionKind}`,
      )
    }
    return input.projectedIdentity.agentID
  }
  const rightSidebarIdentity = rightSidebarConversationAgentID({
    kind: input.sessionKind,
    metadata: input.metadata,
  })
  if (rightSidebarIdentity) return rightSidebarIdentity
  if (RuntimeTemplateRegistry.isWorkerSessionKind(input.sessionKind)) {
    throw new Error(`Worker session ${input.sessionID} (${input.sessionKind}) is missing projected agent evidence`)
  }
  return input.sessionKind
}
