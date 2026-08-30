import type { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { MCP } from "."
import { BrowserMCPBuiltin } from "./browser/builtin"
import { ComputerMCPBuiltin } from "./computer/builtin"
import { ComputerHostRuntime } from "./computer/host-runtime"
import { computerRuntimeScopeIdentity } from "./computer/runtime-scope"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"
import { capabilityRef, type CapabilityRef } from "@/capability/ref"

type HostSessionRuntimeKind = "browser" | "computer"

const connectionOwners = createInstanceState(
  () => new Map<string, MCP.ScopedConnectionOwner>(),
  async (owners) => {
    const results = await Promise.allSettled([...owners.values()].map((owner) => owner.close()))
    const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, "Host Session builtin MCP cleanup failed")
  },
  "host-session-runtime-mcp",
)
const catalogToolIDs = new WeakMap<MCP.ScopedConnectionOwner, readonly string[]>()

function ownerKey(kind: HostSessionRuntimeKind, sessionID: string): string {
  return `${kind}:${sessionID}`
}

function connectionOwner(kind: HostSessionRuntimeKind, sessionID: string, ownerID: string): MCP.ScopedConnectionOwner {
  const owners = connectionOwners()
  const key = ownerKey(kind, sessionID)
  const current = owners.get(key)
  if (current) return current
  const owner = MCP.createScopedConnectionOwner(ownerID)
  owners.set(key, owner)
  return owner
}

async function settleOwners(sessionID: string, kinds: readonly HostSessionRuntimeKind[]): Promise<void> {
  const owners = connectionOwners()
  const results = await Promise.allSettled(
    kinds.flatMap((kind) => {
      const key = ownerKey(kind, sessionID)
      const owner = owners.get(key)
      if (!owner) return []
      owners.delete(key)
      return [owner.close()]
    }),
  )
  const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, "Host Session builtin MCP disconnect failed")
}

async function ownedBuiltinTools(input: {
  config: Config.Info
  sessionID: string
  serverName: string
  toolNames?: readonly string[]
  owner: () => MCP.ScopedConnectionOwner
  bindRuntime: (declaration: Config.Mcp, owner: MCP.ScopedConnectionOwner) => Config.Mcp
}) {
  const configured = input.config.mcp?.[input.serverName]
  if (!configured || !("type" in configured) || configured.enabled === false) return {}
  const owner = input.owner()
  const mcp = input.bindRuntime(configured, owner)
  const scope = {
    key: input.serverName,
    mcp,
    cwd: Instance.directory,
    processAuthority: MCP.hostProcessAuthority(Instance.directory),
    globalTimeout: input.config.experimental?.mcp_timeout,
    connectionOwner: owner,
    connectionIdentity: owner.id,
  }
  const tools = !input.toolNames
    ? await MCP.scopedToolsForServer(scope)
    : Object.fromEntries(
        await Promise.all(
          input.toolNames.map(
            async (toolName) =>
              [`${input.serverName}_${toolName}`, await MCP.scopedTool({ ...scope, toolName })] as const,
          ),
        ),
      )
  catalogToolIDs.set(owner, Object.freeze(Object.keys(tools).sort(compareCanonicalStrings)))
  return tools
}

export namespace HostSessionMcpRuntime {
  export function catalogOwnerRef(ownerID: string): string {
    return `host-session-mcp:${ownerID}`
  }

  export function catalogSnapshots(sessionID: string): readonly {
    owner_revision: string
    owner: MCP.ScopedCatalogSnapshot
    tool_ids: readonly string[]
  }[] {
    const owners = connectionOwners()
    return Object.freeze(
      (["browser", "computer"] as const).flatMap((kind) => {
        const owner = owners.get(ownerKey(kind, sessionID))
        if (!owner) return []
        const snapshot = owner.catalogSnapshot()
        const toolIDs = catalogToolIDs.get(owner) ?? Object.freeze([])
        return [
          Object.freeze({
            owner_revision: canonicalDigestSource("host-session-mcp-catalog-v1", {
              scoped_owner_revision: snapshot.owner_revision,
              tool_ids: toolIDs,
            }).sha256,
            owner: snapshot,
            tool_ids: toolIDs,
          }),
        ]
      }),
    )
  }

  export function catalogToolRefs(sessionID: string): readonly CapabilityRef[] {
    return Object.freeze(
      catalogSnapshots(sessionID).flatMap((snapshot) =>
        snapshot.tool_ids.map((toolID) =>
          capabilityRef({
            kind: "mcp_tool",
            source: "project",
            owner_ref: catalogOwnerRef(snapshot.owner.owner_id),
            local_ref: toolID,
          }),
        ),
      ),
    )
  }

  export function computerOwnerIdentity(sessionID: string): string {
    return computerRuntimeScopeIdentity({ ownerKind: "session", sessionID })
  }

  export function browserOwnerIdentity(sessionID: string): string {
    const normalized = sessionID.trim()
    if (!normalized) throw new Error("Browser runtime scope requires a non-empty Session identity")
    return `session:${normalized}:browser`
  }

  export async function disconnectComputer(sessionID: string): Promise<void> {
    await settleOwners(sessionID, ["computer"])
  }

  export async function dispose(sessionID: string): Promise<void> {
    const runtimeScope = computerOwnerIdentity(sessionID)
    const failures: unknown[] = []
    try {
      await settleOwners(sessionID, ["computer", "browser"])
    } catch (error) {
      failures.push(error)
    }
    try {
      await ComputerHostRuntime.destroy(runtimeScope)
    } catch (error) {
      failures.push(error)
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, "Host Session builtin runtime cleanup failed")
  }

  export async function tools(config: Config.Info, sessionID: string, selectedServerRefs: readonly string[]) {
    const selected = new Set(selectedServerRefs)
    const ordinaryServerRefs = [...selected].filter(
      (ref) => ref !== BrowserMCPBuiltin.ServerName && ref !== ComputerMCPBuiltin.ServerName,
    )
    const ordinaryTools = await MCP.toolsForServers(config, ordinaryServerRefs)

    const configuredBrowser = config.mcp?.[BrowserMCPBuiltin.ServerName]
    const browserDeclaration = configuredBrowser
      ? BrowserMCPBuiltin.configuredDeclaration(configuredBrowser)
      : undefined
    const browserTools =
      selected.has(BrowserMCPBuiltin.ServerName) && browserDeclaration?.status === "enabled"
        ? await ownedBuiltinTools({
            config,
            sessionID,
            serverName: BrowserMCPBuiltin.ServerName,
            owner: () => connectionOwner("browser", sessionID, browserOwnerIdentity(sessionID)),
            bindRuntime: (declaration) => declaration,
          })
        : {}

    const configuredComputer = config.mcp?.[ComputerMCPBuiltin.ServerName]
    const computerDeclaration = configuredComputer
      ? ComputerMCPBuiltin.configuredDeclaration(configuredComputer)
      : undefined
    const computerTools =
      selected.has(ComputerMCPBuiltin.ServerName) && computerDeclaration?.status === "enabled"
        ? await ownedBuiltinTools({
            config,
            sessionID,
            serverName: ComputerMCPBuiltin.ServerName,
            toolNames: ComputerMCPBuiltin.ImportableToolNames,
            owner: () => connectionOwner("computer", sessionID, computerOwnerIdentity(sessionID)),
            bindRuntime: (declaration, owner) =>
              ComputerMCPBuiltin.withRuntimeScope(
                declaration as typeof computerDeclaration.config,
                owner.id,
                ComputerHostRuntime.adapter({ runtimeScope: owner.id }),
              ),
          })
        : {}

    return { ...ordinaryTools, ...browserTools, ...computerTools }
  }
}
