import PROMPT_COMPACTION from "@/agent/prompt/compaction.txt"
import PROMPT_TITLE from "@/agent/prompt/title.txt"
import PROMPT_MEMORY from "@/agent/prompt/memory.txt"
import { Config } from "@/config/config"
import { AgentRoleContract, type AgentRoleID } from "@/agent/role-contract"
import { nativeAgentPermissionProfiles } from "@/agent/native-agent-permissions"
import { materializeNativeAgentDefinitions } from "@/agent/native-agent-materializer"
import type { NativeAgentInfo } from "@/agent/native-agent-info"
import { NativeAgentRegistryCache } from "@/agent/native-agent-registry-cache"

export type HelperAgentID = Extract<AgentRoleID, "title" | "summary" | "compaction" | "memory">

const definitions = {
  compaction: {
    name: "compaction",
    hidden: true,
    steps: 20,
    prompt: PROMPT_COMPACTION,
    options: {},
  },
  title: {
    name: "title",
    hidden: true,
    temperature: 0.5,
    prompt: PROMPT_TITLE,
    options: {},
  },
  summary: {
    name: "summary",
    hidden: true,
    options: {},
  },
  memory: {
    name: "memory",
    hidden: true,
    steps: 1,
    prompt: PROMPT_MEMORY,
    options: {},
  },
} satisfies Record<HelperAgentID, NativeAgentInfo>

function helperIDs(): HelperAgentID[] {
  const ids = AgentRoleContract.ids.filter(
    (id): id is HelperAgentID => AgentRoleContract.get(id).controlSurface === "helper",
  )
  for (const id of ids) {
    if (!Object.hasOwn(definitions, id)) throw new Error(`Helper agent ${id} has no registry definition`)
  }
  for (const id of Object.keys(definitions) as HelperAgentID[]) {
    if (!ids.includes(id)) throw new Error(`Helper registry definition ${id} is not classified as a helper`)
  }
  return ids
}

type HelperAgentState = Partial<Record<HelperAgentID, NativeAgentInfo>>

async function buildState(config: Config.Info): Promise<HelperAgentState> {
  const permissions = nativeAgentPermissionProfiles(config)
  const base = Object.fromEntries(
    Object.entries(definitions).map(([id, definition]) => [
      id,
      {
        ...definition,
        ...(id === "summary" ? {} : { permission: permissions.nonDesign() }),
      },
    ]),
  ) as Record<HelperAgentID, NativeAgentInfo>
  const materialized = materializeNativeAgentDefinitions({
    config,
    definitions: base,
  })
  return Object.fromEntries(helperIDs().flatMap((id) => (materialized[id] ? [[id, materialized[id]]] : [])))
}

const cache = new NativeAgentRegistryCache({ label: "helper-agent-registry", build: buildState })

export namespace HelperAgentRegistry {
  export const ids: readonly HelperAgentID[] = helperIDs()

  export function isID(value: string): value is HelperAgentID {
    return ids.includes(value as HelperAgentID)
  }

  export async function get(id: HelperAgentID, options?: { config?: Config.Info }): Promise<NativeAgentInfo> {
    if (!isID(id)) throw new Error(`Unknown helper agent: ${id}`)
    const helper = (await cache.get(options?.config))[id]
    if (!helper) throw new Error(`Helper agent ${id} is unavailable`)
    return helper
  }

  export async function list(options?: { config?: Config.Info }): Promise<NativeAgentInfo[]> {
    const helpers = await cache.get(options?.config)
    return ids.flatMap((id) => (helpers[id] ? [helpers[id]] : []))
  }

  export function nativeDefaultPrompt(id: HelperAgentID): string | undefined {
    if (!isID(id)) throw new Error(`Unknown helper agent: ${id}`)
    const definition = definitions[id]
    return "prompt" in definition ? definition.prompt : undefined
  }

  export function reset() {
    return cache.reset()
  }

  export function resetAll() {
    return cache.resetAll()
  }
}
