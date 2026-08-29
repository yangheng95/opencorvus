import { MCP } from "@/mcp"
import { ComputerHostRuntime } from "./host-runtime"

/**
 * Owns the two resources projected Computer execution creates: its scoped MCP
 * connection and its host desktop runtime. Generic scoped MCP owners only
 * settle connections; projected Worker/Orchestrator lifecycles opt into this
 * Computer-specific teardown explicitly.
 */
export function createComputerRuntimeConnectionOwner(runtimeScope: string): MCP.ScopedConnectionOwner {
  return MCP.createScopedConnectionOwner(runtimeScope, {
    onClose: () => ComputerHostRuntime.destroy(runtimeScope),
  })
}
