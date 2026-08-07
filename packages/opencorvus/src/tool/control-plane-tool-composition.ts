import { configureControlPlaneToolLoaders, type ControlPlaneToolLoaders } from "./control-plane-tool-provider"

const defaultControlPlaneToolLoaders: ControlPlaneToolLoaders = {
  schedule: async () => (await import("./schedule")).ScheduleTool,
  panel: async () => (await import("./panel")).PanelTool,
  wait: async () => (await import("./wait")).WaitTool,
  requestOrchestratorDecision: async () =>
    (await import("./request-orchestrator-decision")).RequestOrchestratorDecisionTool,
  sendMailboxMessage: async () => (await import("./send-mailbox-message")).SendMailboxMessageTool,
}

export function installDefaultControlPlaneToolLoaders(): void {
  configureControlPlaneToolLoaders(defaultControlPlaneToolLoaders)
}
