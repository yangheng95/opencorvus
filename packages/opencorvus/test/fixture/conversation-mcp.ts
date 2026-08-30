import type { Config } from "@/config/config"
import { ConversationCapability, type ConversationAgentID } from "@/conversation/capability"
import { HostSessionMcpRuntime } from "@/mcp/host-session-runtime"

export async function prepareConversationMcpCatalog(
  config: Config.Info,
  agentID: ConversationAgentID,
  sessionID: string,
) {
  const refs = ConversationCapability.assignment(config, agentID).mcp_server_refs
  await HostSessionMcpRuntime.prepareCatalog(config, sessionID, refs)
  const names = HostSessionMcpRuntime.catalogSnapshots(sessionID)
    .flatMap((snapshot) => Object.keys(snapshot.tool_bindings))
    .sort()
  return { refs, names }
}

/** Test-only exhaustive exact calls used to verify MCP owner isolation. */
export async function exactConversationMcpTools(
  config: Config.Info,
  agentID: ConversationAgentID,
  sessionID: string,
) {
  const { names } = await prepareConversationMcpCatalog(config, agentID, sessionID)
  const snapshots = HostSessionMcpRuntime.catalogSnapshots(sessionID)
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => {
        const owners = snapshots.filter((snapshot) => Object.hasOwn(snapshot.tool_bindings, name))
        if (owners.length !== 1) throw new Error(`Fixture found ${owners.length} Host Session owners for ${name}.`)
        return [
          name,
          await HostSessionMcpRuntime.exactTool(config, sessionID, name, owners[0]!.owner_revision),
        ] as const
      }),
    ),
  )
}
