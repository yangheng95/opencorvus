import type { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { MCP } from "."
import { BrowserMCPBuiltin } from "./browser/builtin"
import { ComputerMCPBuiltin } from "./computer/builtin"
import { ComputerHostRuntime } from "./computer/host-runtime"
import { computerRuntimeScopeIdentity } from "./computer/runtime-scope"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"
import { capabilityRef, type CapabilityRef } from "@opencorvus-ai/util/capability-ref"

type HostSessionRuntimeKind = "browser" | "computer" | `mcp:${string}`

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
const catalogBindings = new WeakMap<MCP.ScopedConnectionOwner, Readonly<Record<string, MCP.CatalogToolBinding>>>()
const catalogPromptBindings = new WeakMap<
  MCP.ScopedConnectionOwner,
  Readonly<Record<string, MCP.CatalogMetadataBinding>>
>()
const catalogResourceBindings = new WeakMap<
  MCP.ScopedConnectionOwner,
  Readonly<Record<string, MCP.CatalogMetadataBinding>>
>()

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

export namespace HostSessionMcpRuntime {
  export class CatalogPreparationError extends Error {
    override readonly name = "HostSessionMcpCatalogPreparationError"

    constructor(
      public readonly serverID: string,
      public readonly code: "inventory_inspection_failed",
      options?: ErrorOptions,
    ) {
      super(`Host Session MCP Catalog could not inspect ${serverID}.`, options)
    }
  }

  export function catalogOwnerRef(ownerID: string): string {
    return `host-session-mcp:${ownerID}`
  }

  export function catalogSnapshots(sessionID: string): readonly {
    owner_revision: string
    owner: MCP.ScopedCatalogSnapshot
    tool_ids: readonly string[]
    tool_bindings: Readonly<Record<string, MCP.CatalogToolBinding>>
    prompt_bindings: Readonly<Record<string, MCP.CatalogMetadataBinding>>
    resource_bindings: Readonly<Record<string, MCP.CatalogMetadataBinding>>
  }[] {
    const owners = connectionOwners()
    return Object.freeze(
      [...owners.entries()].flatMap(([key, owner]) => {
        if (!key.endsWith(`:${sessionID}`)) return []
        const snapshot = owner.catalogSnapshot()
        const toolIDs = catalogToolIDs.get(owner) ?? Object.freeze([])
        const toolBindings = catalogBindings.get(owner) ?? Object.freeze({})
        const promptBindings = catalogPromptBindings.get(owner) ?? Object.freeze({})
        const resourceBindings = catalogResourceBindings.get(owner) ?? Object.freeze({})
        return [
          Object.freeze({
            owner_revision: canonicalDigestSource("host-session-mcp-catalog-v2", {
              scoped_owner_revision: snapshot.owner_revision,
              tool_ids: toolIDs,
              tool_bindings: toolBindings,
              prompt_bindings: promptBindings,
              resource_bindings: resourceBindings,
            }).sha256,
            owner: snapshot,
            tool_ids: toolIDs,
            tool_bindings: toolBindings,
            prompt_bindings: promptBindings,
            resource_bindings: resourceBindings,
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

  function runtimeScope(input: {
    config: Config.Info
    sessionID: string
    serverName: string
  }): {
    owner: MCP.ScopedConnectionOwner
    scope: Parameters<typeof MCP.inspectScopedCapabilitySnapshot>[0]
  } | undefined {
    const configured = input.config.mcp?.[input.serverName]
    if (!configured || !("type" in configured) || configured.enabled === false) return
    if (input.serverName === BrowserMCPBuiltin.ServerName) {
      const declaration = BrowserMCPBuiltin.configuredDeclaration(configured)
      if (declaration.status !== "enabled") return
      const owner = connectionOwner("browser", input.sessionID, browserOwnerIdentity(input.sessionID))
      return {
        owner,
        scope: {
          key: input.serverName,
          mcp: declaration.config,
          cwd: Instance.directory,
          processAuthority: MCP.hostProcessAuthority(Instance.directory),
          globalTimeout: input.config.experimental?.mcp_timeout,
          connectionOwner: owner,
          connectionIdentity: owner.id,
        },
      }
    }
    if (input.serverName === ComputerMCPBuiltin.ServerName) {
      const declaration = ComputerMCPBuiltin.configuredDeclaration(configured)
      if (declaration.status !== "enabled") return
      const owner = connectionOwner("computer", input.sessionID, computerOwnerIdentity(input.sessionID))
      const mcp = ComputerMCPBuiltin.withRuntimeScope(
        declaration.config,
        owner.id,
        ComputerHostRuntime.adapter({ runtimeScope: owner.id }),
      )
      return {
        owner,
        scope: {
          key: input.serverName,
          mcp,
          cwd: Instance.directory,
          processAuthority: MCP.hostProcessAuthority(Instance.directory),
          globalTimeout: input.config.experimental?.mcp_timeout,
          connectionOwner: owner,
          connectionIdentity: owner.id,
        },
      }
    }
    const owner = connectionOwner(
      `mcp:${input.serverName}`,
      input.sessionID,
      `session:${input.sessionID}:mcp:${input.serverName}`,
    )
    return {
      owner,
      scope: {
        key: input.serverName,
        mcp: configured,
        cwd: Instance.directory,
        processAuthority: MCP.hostProcessAuthority(Instance.directory),
        globalTimeout: input.config.experimental?.mcp_timeout,
        connectionOwner: owner,
        connectionIdentity: owner.id,
      },
    }
  }

  /** Build immutable discovery bindings without constructing Provider Tools. */
  export async function prepareCatalog(
    config: Config.Info,
    sessionID: string,
    selectedServerRefs: readonly string[],
  ): Promise<void> {
    const selected = [...new Set(selectedServerRefs)].sort(compareCanonicalStrings)
    const desiredKinds = new Set<HostSessionRuntimeKind>(
      selected.flatMap((serverName) => {
        const configured = config.mcp?.[serverName]
        if (!configured || !("type" in configured) || configured.enabled === false) return []
        if (serverName === BrowserMCPBuiltin.ServerName) return ["browser" as const]
        if (serverName === ComputerMCPBuiltin.ServerName) return ["computer" as const]
        return [`mcp:${serverName}` as const]
      }),
    )
    const sessionSuffix = `:${sessionID}`
    const staleKinds = [...connectionOwners().keys()]
      .filter((key) => key.endsWith(sessionSuffix))
      .map((key) => key.slice(0, -sessionSuffix.length) as HostSessionRuntimeKind)
      .filter((kind) => !desiredKinds.has(kind))
    if (staleKinds.length > 0) await settleOwners(sessionID, staleKinds)
    const runtimeNames = new Map<string, string>()
    for (const serverName of selected) {
      const runtime = runtimeScope({ config, sessionID, serverName })
      if (!runtime) continue
      let snapshot: MCP.ScopedCapabilitySnapshot
      try {
        snapshot = await MCP.inspectScopedCapabilitySnapshot(runtime.scope)
      } catch (error) {
        catalogToolIDs.set(runtime.owner, Object.freeze([]))
        catalogBindings.set(runtime.owner, Object.freeze({}))
        catalogPromptBindings.set(runtime.owner, Object.freeze({}))
        catalogResourceBindings.set(runtime.owner, Object.freeze({}))
        const status = runtime.owner
          .catalogSnapshot()
          .entries.find((entry) => entry.server_id === serverName)?.status
        if (
          status?.status === "failed" ||
          status?.status === "needs_auth" ||
          status?.status === "needs_client_registration" ||
          status?.status === "disabled"
        ) {
          continue
        }
        throw new CatalogPreparationError(serverName, "inventory_inspection_failed", { cause: error })
      }
      const bindings = MCP.catalogToolBindings(serverName, runtime.scope.mcp, snapshot)
      for (const binding of bindings) {
        const previous = runtimeNames.get(binding.runtime_name)
        if (previous && previous !== `${binding.server_id}:${binding.tool_name}`) {
          throw new MCP.McpRuntimeNameCollisionError(
            `host-session:${sessionID}`,
            binding.runtime_name,
            Object.freeze([previous, `${binding.server_id}:${binding.tool_name}`].sort(compareCanonicalStrings)),
          )
        }
        runtimeNames.set(binding.runtime_name, `${binding.server_id}:${binding.tool_name}`)
      }
      const record = Object.freeze(Object.fromEntries(bindings.map((binding) => [binding.runtime_name, binding])))
      const promptRecord = Object.freeze(
        Object.fromEntries(
          MCP.catalogPromptBindings(serverName, snapshot).map((binding) => [binding.runtime_name, binding]),
        ),
      )
      const resourceRecord = Object.freeze(
        Object.fromEntries(
          MCP.catalogResourceBindings(serverName, snapshot).map((binding) => [binding.runtime_name, binding]),
        ),
      )
      catalogBindings.set(runtime.owner, record)
      catalogToolIDs.set(runtime.owner, Object.freeze(Object.keys(record).sort(compareCanonicalStrings)))
      catalogPromptBindings.set(runtime.owner, promptRecord)
      catalogResourceBindings.set(runtime.owner, resourceRecord)
    }
  }

  export async function exactTool(
    config: Config.Info,
    sessionID: string,
    runtimeName: string,
    expectedOwnerRevision: string,
  ) {
    const snapshots = catalogSnapshots(sessionID)
    const matches = snapshots.flatMap((snapshot) => {
      const binding = snapshot.tool_bindings[runtimeName]
      return binding ? [{ binding, snapshot }] : []
    })
    if (matches.length !== 1) {
      throw new Error(`Host Session MCP Catalog publishes ${matches.length} bindings for ${runtimeName}.`)
    }
    const { binding, snapshot: boundSnapshot } = matches[0]!
    const ownerRef = catalogOwnerRef(boundSnapshot.owner.owner_id)
    if (boundSnapshot.owner_revision !== expectedOwnerRevision) {
      throw new MCP.CatalogBindingStaleError([`owner_revision_vector.${ownerRef}`])
    }
    const runtime = runtimeScope({ config, sessionID, serverName: binding.server_id })
    if (!runtime) throw new MCP.CatalogBindingStaleError([`tool_binding.${runtimeName}.server_enabled`])
    const tool = await MCP.exactScopedCatalogTool({ ...runtime.scope, binding })
    const afterSnapshot = catalogSnapshots(sessionID).find(
      (candidate) => catalogOwnerRef(candidate.owner.owner_id) === ownerRef,
    )
    if (afterSnapshot?.owner_revision !== expectedOwnerRevision) {
      throw new MCP.CatalogBindingStaleError([`owner_revision_vector.${ownerRef}`])
    }
    const authority = MCP.toolAuthorityBinding(tool)
    if (
      !authority ||
      authority.configDigest !== binding.config_digest ||
      authority.toolDigest !== binding.tool_digest
    ) {
      throw new MCP.CatalogBindingStaleError([`tool_binding.${runtimeName}.definition`])
    }
    const scopedAssertion = MCP.exactToolAssertion(tool)
    MCP.bindExactToolAssertion(tool, async () => {
      await scopedAssertion?.()
      const current = catalogSnapshots(sessionID).find(
        (candidate) => catalogOwnerRef(candidate.owner.owner_id) === ownerRef,
      )
      if (current?.owner_revision !== expectedOwnerRevision) {
        throw new MCP.CatalogBindingStaleError([`owner_revision_vector.${ownerRef}`])
      }
    })
    return tool
  }

  export async function disconnectComputer(sessionID: string): Promise<void> {
    await settleOwners(sessionID, ["computer"])
  }

  export async function dispose(sessionID: string): Promise<void> {
    const runtimeScope = computerOwnerIdentity(sessionID)
    const failures: unknown[] = []
    try {
      const ownedKinds = [...connectionOwners().keys()]
        .filter((key) => key.endsWith(`:${sessionID}`))
        .map((key) => key.slice(0, -(`:${sessionID}`).length) as HostSessionRuntimeKind)
      await settleOwners(sessionID, ownedKinds)
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

}
