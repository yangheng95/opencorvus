import { Config } from "./config"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { AgentRoleContract } from "@/agent/role-contract"
import { PromptProfile } from "@/agent/prompt-profile"

import PROMPT_SYSTEM from "@/session/prompt/system.txt"

/** Native agents whose prompt is NOT consumed from prompt catalog config
 *  at runtime. Surfacing them in the catalog is a UX trap: users edit the
 *  card, hit Save, and nothing changes.
 *  - orchestrator → dynamic prompt built per-trigger in `buildSystemParts`;
 *    the small Host registry prompt only prevents inheritance of the generic
 *    assistant core header, while task evidence and the active projection are
 *    resolved for every invocation, so a user-editable static override has no place to land.
 *  - summary is a promptless helper registry entry used only as a canonical
 *    model identity by Host-owned summary operations. */
const UNEDITABLE_AGENTS = new Set<string>(
  Object.values(AgentRoleContract.all)
    .filter((contract) => !contract.promptEditable)
    .map((contract) => contract.id),
)

export namespace PromptCatalog {
  export interface Entry {
    scope: "system" | "agent"
    key: string
    label: string
    group: string
    prompt: string
    editable_prompt: string
    effective_prompt: string
    active_profile: string
    profile_prompt: string | null
    configured_prompt: string | null
    default_prompt: string
    inherits_core: boolean
    prompt_mode: "override" | "append"
    description?: string
  }

  export interface ListInput {
    config?: Config.Info
  }

  /** Static metadata for system-scope prompt slots.
   *  The core header is the only system-wide slot; it applies to every LLM call
   *  regardless of which identity is running. Fixed-identity prompt overrides
   *  live on `config.agent.{name}.prompt` or `.prompt_append`. Both surface as agent-scope entries
   *  with distinct defaults from their owning fixed registry. */
  const SYSTEM_PROMPT_META: Array<{
    key: string
    label: string
    group: string
    defaultPrompt: string
    description?: string
  }> = [
    {
      key: "core_header",
      label: "System Prompt",
      group: "core",
      defaultPrompt: PROMPT_SYSTEM,
      description: "Unified system prompt applied to all models",
    },
  ]

  function agentGroup(agentName: string): "primary_agent" | "hidden_agent" {
    if (PrimaryAssistantRegistry.isID(agentName)) return "primary_agent"
    if (HelperAgentRegistry.isID(agentName)) return "hidden_agent"
    throw new Error(`Prompt catalog identity ${agentName} is not owned by a fixed prompt registry`)
  }

  export async function list(input: ListInput = {}): Promise<Entry[]> {
    const cfg = input.config ?? (await Config.get())
    const configPrompts = cfg.prompt ?? {}
    const activeProfile = PromptProfile.activeID(cfg)
    const agents = [
      ...(await PrimaryAssistantRegistry.list({ config: cfg })),
      ...(await HelperAgentRegistry.list({ config: cfg })),
    ]

    const entries: Entry[] = []

    // System-scope prompts
    for (const slot of SYSTEM_PROMPT_META) {
      const configured = configPrompts[slot.key] ?? null
      const defaultPrompt = slot.defaultPrompt
      entries.push({
        scope: "system",
        key: slot.key,
        label: slot.label,
        group: slot.group,
        prompt: configured ?? defaultPrompt,
        editable_prompt: configured ?? defaultPrompt,
        effective_prompt: configured ?? defaultPrompt,
        active_profile: activeProfile,
        profile_prompt: null,
        configured_prompt: configured,
        default_prompt: defaultPrompt,
        inherits_core: false,
        prompt_mode: "override",
        description: slot.description,
      })
    }

    // Primary and Helper registries are the only prompt sources on this
    // fixed-identity surface. Runtime templates and projected workers use
    // their dedicated configuration and catalog surfaces. `prompt_mode`
    // makes write semantics explicit:
    // - override entries replace the runtime prompt with `config.agent.X.prompt`.
    // - append entries keep the code-owned core and append
    //   `config.agent.X.prompt_append`.
    for (const agent of agents) {
      if (UNEDITABLE_AGENTS.has(agent.name)) continue
      const agentCfg = (cfg.agent ?? {})[agent.name]
      if (!AgentRoleContract.isRoleID(agent.name)) {
        throw new Error(`Native prompt registry identity ${agent.name} has no canonical role contract`)
      }
      const contract = AgentRoleContract.get(agent.name)
      if (!contract.promptEditable) {
        throw new Error(`Uneditable native prompt ${agent.name} reached the editable prompt catalog`)
      }
      const promptMode = AgentRoleContract.promptMode(agent.name)
      if (promptMode === "none") continue
      const configuredPrompt = promptMode === "append" ? (agentCfg?.prompt_append ?? null) : (agentCfg?.prompt ?? null)
      const nativeDefault = PrimaryAssistantRegistry.isID(agent.name)
        ? PrimaryAssistantRegistry.nativeDefaultPrompt(agent.name)
        : HelperAgentRegistry.isID(agent.name)
          ? HelperAgentRegistry.nativeDefaultPrompt(agent.name)
          : undefined
      if (nativeDefault === undefined) {
        throw new Error(`Editable native prompt ${agent.name} has no registry-owned default`)
      }
      const defaultPrompt = nativeDefault
      const basePrompt = promptMode === "append" ? defaultPrompt : (configuredPrompt ?? defaultPrompt)
      const userAppend = promptMode === "append" ? configuredPrompt : null
      const editablePrompt = promptMode === "append" ? (userAppend ?? "") : basePrompt
      const effectivePrompt = [basePrompt, userAppend]
        .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
        .join("\n\n")
      const prompt = editablePrompt
      const inheritsCore =
        promptMode === "override" && !configuredPrompt && (!defaultPrompt || defaultPrompt === PROMPT_SYSTEM)
      entries.push({
        scope: "agent",
        key: agent.name,
        label: agent.name,
        group: agentGroup(agent.name),
        prompt,
        editable_prompt: editablePrompt,
        effective_prompt: effectivePrompt,
        active_profile: activeProfile,
        profile_prompt: null,
        configured_prompt: configuredPrompt,
        default_prompt: defaultPrompt,
        inherits_core: inheritsCore,
        prompt_mode: promptMode,
        description: agent.description,
      })
    }

    return entries
  }

  /**
   * Resolve the effective prompt for a system-scope slot.
   * Returns the config override if present, otherwise the built-in default.
   */
  export async function resolve(key: string): Promise<string | undefined> {
    const cfg = await Config.get()
    const override = cfg.prompt?.[key]
    if (override) return override
    const meta = SYSTEM_PROMPT_META.find((s) => s.key === key)
    if (!meta) return undefined
    return meta.defaultPrompt
  }
}
