/**
 * Filter a shared tool map through one exact runtime-template tool pool.
 *
 * Only shared tools (e.g. everything returned by `createAgentContextTools()`)
 * should pass through this filter. Structured-output tools created by the
 * sub-agent's own factory (register_contract, register_frontend_design, …)
 * bypass it — they are the agent's contract with the orchestrator and must
 * not be disabled by user config.
 */
import { AgentToolPool } from "./tool-pool-contract"
import type { RuntimeTemplateID } from "./runtime-template-id"
import { RuntimeTemplateRegistry } from "./runtime-template-registry"

export async function filterAgentTools<T extends Record<string, unknown>>(
  tools: T,
  runtimeTemplateID: RuntimeTemplateID,
  _opts?: { taskID?: string; sessionID?: string },
): Promise<T> {
  const template = RuntimeTemplateRegistry.get(runtimeTemplateID)
  const visible = AgentToolPool.visibleToolIDs(template.baseToolPool)
  const entries = Object.entries(tools).filter(([name]) => {
    return visible.has(name)
  })
  return Object.fromEntries(entries) as T
}
