import type { Tool } from "./tool"

export interface ControlPlaneToolLoaders {
  schedule: () => Promise<Tool.Info>
  panel: () => Promise<Tool.Info>
  wait: () => Promise<Tool.Info>
  requestOrchestratorDecision: () => Promise<Tool.Info>
  sendMailboxMessage: () => Promise<Tool.Info>
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
