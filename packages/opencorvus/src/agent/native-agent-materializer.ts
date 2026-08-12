import { Provider } from "@/provider/provider"
import { CapabilityRules } from "@/capability/rules"
import { mergeDeep } from "remeda"
import type { Config } from "@/config/config"
import { AgentRoleContract } from "@/agent/role-contract"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import type { NativeAgentInfo } from "@/agent/native-agent-info"

export function materializeNativeAgentDefinitions(input: {
  config: Config.Info
  definitions: Record<string, NativeAgentInfo>
}): Record<string, NativeAgentInfo> {
  const result = Object.fromEntries(
    Object.entries(input.definitions).map(([id, definition]) => [id, { ...definition }]),
  )
  for (const key of Object.keys(input.definitions)) {
    const value = input.config.agent?.[key as keyof NonNullable<Config.Info["agent"]>]
    if (!value) continue
    const role = AgentRoleContract.get(key)
    const item = result[key]
    if (!item) throw new Error(`Native agent override ${key} has no fixed registry definition`)
    if (value.model) item.model = Provider.parseModel(value.model)
    item.variant = value.variant ?? item.variant
    const promptConfigMode = role.promptConfigMode
    if (promptConfigMode === "append" && value.prompt !== undefined) {
      throw new Error(`config.agent.${key}.prompt is invalid for append-mode agents; use prompt_append`)
    }
    if (promptConfigMode === "override") item.prompt = value.prompt ?? item.prompt
    if (promptConfigMode === "append") item.promptAppend = value.prompt_append ?? item.promptAppend
    item.description = value.description ?? item.description
    item.temperature = value.temperature ?? item.temperature
    item.topP = value.top_p ?? item.topP
    item.color = value.color ?? item.color
    item.steps = value.steps ?? item.steps
    item.options = mergeDeep(item.options, value.options ?? {})
    if (item.permission) {
      item.permission = CapabilityRules.merge(item.permission, CapabilityRules.fromConfig(value.permission ?? {}))
    }
  }

  for (const id of AgentRoleContract.ids) {
    const item = result[id]
    if (!item) continue
    const contract = AgentRoleContract.get(id)
    item.description = item.description ?? contract.description
    item.tools = AgentToolPool.assignment(id)
  }

  return result
}
