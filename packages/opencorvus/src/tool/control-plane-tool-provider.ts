import type { Tool } from "./tool"
import type { Message } from "@/session/message"

export type RecoveredControlPlaneToolResult = {
  title: string
  output: string
  metadata: Record<string, unknown>
}

export type ControlPlaneToolRecovery = (input: {
  sessionID: string
  messageID: string
  agent: string
  part: Message.ToolPart
}) => Promise<RecoveredControlPlaneToolResult | undefined>

export interface ControlPlaneToolLoaders {
  schedule: () => Promise<Tool.Info>
  wait: () => Promise<Tool.Info>
  requestOrchestratorDecision: () => Promise<Tool.Info>
  sendMailboxMessage: () => Promise<Tool.Info>
  recoverPanelCreation: ControlPlaneToolRecovery
}

let installedLoaders: ControlPlaneToolLoaders | undefined

export function configureControlPlaneToolLoaders(loaders: ControlPlaneToolLoaders): void {
  if (installedLoaders && installedLoaders !== loaders) {
    throw new Error("Control-plane tool loaders are already configured")
  }
  installedLoaders = loaders
}

export function requireControlPlaneToolLoaders(): ControlPlaneToolLoaders {
  if (!installedLoaders) throw new Error("Control-plane tool loaders are not configured")
  return installedLoaders
}
