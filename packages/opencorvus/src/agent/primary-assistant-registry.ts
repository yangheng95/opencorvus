import { Config } from "@/config/config"
import { AgentRoleContract, type AgentRoleID } from "@/agent/role-contract"
import { AgentToolPool } from "@/agent/tool-pool-contract"
import { nativeAgentPermissionProfiles } from "@/agent/native-agent-permissions"
import { materializeNativeAgentDefinitions } from "@/agent/native-agent-materializer"
import type { NativeAgentInfo } from "@/agent/native-agent-info"
import { CapabilityRules } from "@/capability/rules"
import PROMPT_CODING from "@/agent/prompt/coding.txt"
import MISSION_CORE from "@/prompt/core/mission-core.txt"
import { CHAT_INTERACTIVE_ARTIFACT_GUIDANCE } from "@/prompt/fragments/interactive-artifact-guidance"
import { TASK_REQUEST_SCOPE_GUIDANCE } from "@/prompt/fragments/task-request-scope"
import PROMPT_SYSTEM from "@/session/prompt/system.txt"
import { WORK_RUNTIME_PROMPT } from "@/work/harness"
import { NativeAgentRegistryCache } from "@/agent/native-agent-registry-cache"

export type PrimaryAssistantID = Extract<AgentRoleID, "coding" | "chat" | "work" | "control" | "mission">

const CONTROL_RUNTIME_PROMPT = [
  "You are the OpenCorvus control-plane agent.",
  "Follow the per-request control-plane system prompt supplied by the control runtime.",
  "Use only the panel tool exposed in the current turn.",
].join("\n")

const CODING_RUNTIME_PROMPT = [PROMPT_SYSTEM, PROMPT_CODING].join("\n\n")

const CHAT_RUNTIME_PROMPT = [
  CODING_RUNTIME_PROMPT,
  [
    "# Right-sidebar Chat handoff",
    "",
    "You are the project-bound Chat assistant in the OpenCorvus right sidebar. Handle ordinary coding, debugging, explanation, and repository-edit requests interactively in this Chat session.",
    "",
    "When the user's request clearly needs durable workflow orchestration, long-running multi-step decomposition, autonomous benchmark/debug loops, cross-role planning, or Mission-owned task tracking, recommend Mission by calling the `panel` tool with `action: \"wake_mission\"`. Pass the full user request in `request`, a short semantic `title` when one is obvious, and a concise evidence-based `reason` in the user's language that both explains why Mission is better suited to this specific request and asks whether to route there. The tool shows that complete reason in a Yes/No popup and defaults to Yes after 10 seconds; never route first and explain afterward.",
    "",
    "When the user explicitly asks to use, start, or route the current request to Mission, that visible instruction is sufficient authority to call `panel.wake_mission`; do not override it by deciding that Chat could also perform the work. Still use the same visible confirmation owned by `panel.wake_mission`.",
    "",
    "After `wake_mission` returns, report whether the user confirmed Mission or declined it. Do not also create a normal task for a confirmed Mission request.",
    "",
    "When a Mission completion receipt appears in this Chat, surface it to the user as the Mission outcome.",
    "",
    CHAT_INTERACTIVE_ARTIFACT_GUIDANCE,
    "",
    "# Task-scoped browser preview",
    "",
    "Browser Preview publication always belongs to a real project task. Use `panel.create_task` with the user's full preview/start request so the task owns the long-lived service and publishes the preview target. Do not replace Task-owned publication with a background shell process or present a URL parsed from shell output as a Browser Preview result.",
    "",
    TASK_REQUEST_SCOPE_GUIDANCE,
  ].join("\n"),
].join("\n\n")

const definitions: Record<PrimaryAssistantID, NativeAgentInfo> = {
  coding: {
    name: "coding",
    prompt: CODING_RUNTIME_PROMPT,
    permission: undefined,
    options: {},
  },
  chat: {
    name: "chat",
    prompt: CHAT_RUNTIME_PROMPT,
    permission: undefined,
    options: {},
    hidden: true,
  },
  work: {
    name: "work",
    prompt: WORK_RUNTIME_PROMPT,
    permission: undefined,
    options: {},
    hidden: true,
  },
  control: {
    name: "control",
    prompt: CONTROL_RUNTIME_PROMPT,
    permission: undefined,
    options: {},
    hidden: true,
  },
  mission: {
    name: "mission",
    prompt: [MISSION_CORE, TASK_REQUEST_SCOPE_GUIDANCE].join("\n\n"),
    permission: undefined,
    steps: 1000,
    options: {},
    hidden: true,
  },
}

function primaryIDs(): PrimaryAssistantID[] {
  const ids = AgentRoleContract.ids.filter(
    (id): id is PrimaryAssistantID => AgentRoleContract.get(id).controlSurface === "primary",
  )
  for (const id of ids) {
    if (!Object.hasOwn(definitions, id)) throw new Error(`Primary assistant ${id} has no registry definition`)
  }
  for (const id of Object.keys(definitions) as PrimaryAssistantID[]) {
    if (!ids.includes(id)) throw new Error(`Primary assistant definition ${id} is not classified as primary`)
  }
  return ids
}

type PrimaryAssistantState = Partial<Record<PrimaryAssistantID, NativeAgentInfo>>

async function buildState(config: Config.Info): Promise<PrimaryAssistantState> {
  const permissions = nativeAgentPermissionProfiles(config)
  const configuredDefinitions: Record<PrimaryAssistantID, NativeAgentInfo> = {
    ...definitions,
    coding: {
      ...definitions.coding,
      permission: permissions.nonDesign(CapabilityRules.fromConfig({ question: "allow", webfetch: "allow" })),
    },
    chat: {
      ...definitions.chat,
      permission: permissions.nonDesign(
        CapabilityRules.fromConfig({ question: "allow", webfetch: "allow", panel: "allow" }),
      ),
    },
    work: {
      ...definitions.work,
      permission: permissions.nonDesign(
        CapabilityRules.fromConfig({ question: "allow", webfetch: "allow", panel: "allow" }),
      ),
    },
    control: {
      ...definitions.control,
      permission: permissions.nonDesign(CapabilityRules.fromConfig({ panel: "allow" })),
    },
    mission: {
      ...definitions.mission,
      permission: permissions.nonDesign(
        CapabilityRules.fromConfig({
          bash: "allow",
          read: "allow",
          glob: "allow",
          search_code: "allow",
          lsp: "allow",
          panel: "allow",
          mission_state: "allow",
          wait: "allow",
          webfetch: "allow",
          websearch: "allow",
          memory: "allow",
          question: "allow",
        }),
      ),
    },
  }
  const materialized = materializeNativeAgentDefinitions({
    config,
    definitions: configuredDefinitions,
  })
  return Object.fromEntries(primaryIDs().flatMap((id) => (materialized[id] ? [[id, materialized[id]]] : [])))
}

const cache = new NativeAgentRegistryCache({ label: "primary-assistant-registry", build: buildState })

export namespace PrimaryAssistantRegistry {
  export const ids: readonly PrimaryAssistantID[] = primaryIDs()

  export function isID(value: string): value is PrimaryAssistantID {
    return ids.includes(value as PrimaryAssistantID)
  }

  export async function get(id: PrimaryAssistantID, options?: { config?: Config.Info }): Promise<NativeAgentInfo> {
    if (!isID(id)) throw new Error(`Unknown primary assistant: ${id}`)
    const primary = (await cache.get(options?.config))[id]
    if (!primary) throw new Error(`Primary assistant ${id} is unavailable`)
    return primary
  }

  export async function list(options?: { config?: Config.Info }): Promise<NativeAgentInfo[]> {
    const primaries = await cache.get(options?.config)
    return ids.flatMap((id) => (primaries[id] ? [primaries[id]] : []))
  }

  export async function defaultID(options?: { config?: Config.Info }): Promise<PrimaryAssistantID> {
    const config = options?.config ?? (await Config.get())
    const id = config.default_agent ?? "coding"
    if (!isID(id)) throw new Error(`default agent "${id}" is not a primary assistant`)
    const primary = await get(id, { config })
    if (primary.hidden === true) throw new Error(`default agent "${id}" is hidden`)
    return id
  }

  export function nativeDefaultPrompt(id: PrimaryAssistantID): string {
    return definitions[id].prompt ?? ""
  }

  export function reset() {
    return cache.reset()
  }

  export function resetAll() {
    return cache.resetAll()
  }
}
