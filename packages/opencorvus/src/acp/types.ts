import type { McpServer } from "@agentclientprotocol/sdk"
import type { OpenCorvusClient } from "@opencorvus-ai/sdk"

export interface ACPSessionState {
  id: string
  cwd: string
  mcpServers: McpServer[]
  createdAt: Date
  model?: {
    providerID: string
    modelID: string
  }
  variant?: string
  modeId: string
}

export interface ACPConfig {
  sdk: OpenCorvusClient
  // R5.1 item 8: there is intentionally NO `defaultModel` here. The ACP
  // default model is resolved exclusively through `resolveConfiguredModelRef`
  // (session overlay > project base); an injected default would be a parallel
  // production model source (rule 8). An explicit ACP model selection flows
  // only as the resolver's `explicitModel` and never pollutes the
  // project/session overlay.
}
