import { Config } from "@/config/config"
import { createInstanceState } from "@/project/instance-state"
import { AgentRoleContract, type AgentRoleID } from "@/agent/role-contract"
import { nativeAgentPermissionProfiles } from "@/agent/native-agent-permissions"
import { materializeNativeAgentDefinitions } from "@/agent/native-agent-materializer"
import type { NativeAgentInfo } from "@/agent/native-agent-info"

export type HostAgentID = Extract<AgentRoleID, "orchestrator">

const ORCHESTRATOR_RUNTIME_PROMPT = [
  "You are the OpenCorvus Orchestrator.",
  "Follow the per-wake orchestrator instructions and task context supplied by the orchestrator runtime.",
  "Use only the tools exposed in the current turn. Dispatch worker agents through `dispatch_agent`; use `manage_task` for Task lifecycle decisions and Delivery Slice contract revisions. Delivery Slices are evidence and acceptance subjects, never worker, dispatch, worktree, or lifecycle owners. You are the only agent-side owner of this engine Task lifecycle. Complete the requested closure inside this Task; only Mission or an explicit control-plane request may create another engine Task.",
].join("\n")

const definitions = {
  orchestrator: {
    name: "orchestrator",
    prompt: ORCHESTRATOR_RUNTIME_PROMPT,
    steps: 1000,
    options: {},
    hidden: true,
  },
} satisfies Record<HostAgentID, NativeAgentInfo>

function hostIDs(): HostAgentID[] {
  const ids = AgentRoleContract.ids.filter(
    (id): id is HostAgentID => AgentRoleContract.get(id).controlSurface === "host",
  )
  for (const id of ids) {
    if (!Object.hasOwn(definitions, id)) throw new Error(`Host agent ${id} has no registry definition`)
  }
  for (const id of Object.keys(definitions) as HostAgentID[]) {
    if (!ids.includes(id)) throw new Error(`Host registry definition ${id} is not classified as a host`)
  }
  return ids
}

type HostAgentState = Partial<Record<HostAgentID, NativeAgentInfo>>

async function buildState(config: Config.Info): Promise<HostAgentState> {
  const permissions = nativeAgentPermissionProfiles(config)
  const materialized = materializeNativeAgentDefinitions({
    config,
    definitions,
  })
  return Object.fromEntries(hostIDs().flatMap((id) => (materialized[id] ? [[id, materialized[id]]] : [])))
}

const state = createInstanceState(async () => buildState(await Config.get()), undefined, "host-agent-registry")
const scopedStates = new Map<string, Promise<HostAgentState>>()

function configStateKey(config: Config.Info): string {
  return String(Bun.hash.xxHash64(JSON.stringify(config)))
}

function stateFor(config?: Config.Info): Promise<HostAgentState> {
  if (!config) return state()
  const key = configStateKey(config)
  const existing = scopedStates.get(key)
  if (existing) return existing
  const next = buildState(config)
  scopedStates.set(key, next)
  return next
}

export namespace HostAgentRegistry {
  export const ids: readonly HostAgentID[] = hostIDs()

  export function isID(value: string): value is HostAgentID {
    return ids.includes(value as HostAgentID)
  }

  export async function get(id: HostAgentID, options?: { config?: Config.Info }): Promise<NativeAgentInfo> {
    if (!isID(id)) throw new Error(`Unknown host agent: ${id}`)
    const host = (await stateFor(options?.config))[id]
    if (!host) throw new Error(`Host agent ${id} is unavailable`)
    return host
  }

  export async function list(options?: { config?: Config.Info }): Promise<NativeAgentInfo[]> {
    const hosts = await stateFor(options?.config)
    return ids.flatMap((id) => (hosts[id] ? [hosts[id]] : []))
  }

  export async function reset(): Promise<void> {
    scopedStates.clear()
    await state.reset()
  }

  export async function resetAll(): Promise<void> {
    scopedStates.clear()
    await state.resetAll()
  }
}
