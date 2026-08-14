import type { SessionKind } from "@/session/session.sql"

const FIXED_AGENT_ROLE_IDS = Object.freeze([
  "coding",
  "chat",
  "work",
  "compaction",
  "title",
  "summary",
  "memory",
  "control",
  "orchestrator",
  "mission",
] as const)

export type AgentRoleID = (typeof FIXED_AGENT_ROLE_IDS)[number]
export type AgentArchetype = "host" | "worker"
export type AgentControlSurface = "host" | "primary" | "helper"

export interface AgentRoleContract {
  readonly id: AgentRoleID
  readonly archetype: AgentArchetype
  readonly controlSurface: AgentControlSurface
  readonly description: string
  readonly promptEditable: boolean
  readonly defaultPromptRequired: boolean
  readonly promptConfigMode: "override" | "append" | "none"
  readonly sessionKind: SessionKind | null
  readonly runtimeContractRequired: boolean
}

interface FixedRoleDefinition {
  archetype: AgentArchetype
  controlSurface: AgentControlSurface
  description: string
  promptEditable: boolean
  defaultPromptRequired: boolean
  promptConfigMode: AgentRoleContract["promptConfigMode"]
  sessionKind: SessionKind | null
  runtimeContractRequired: boolean
}

const definitions = {
  coding: {
    archetype: "worker",
    controlSurface: "primary",
    description: "Direct coding assistant for ad hoc workspace edits outside the task workflow.",
    promptEditable: true,
    defaultPromptRequired: true,
    promptConfigMode: "override",
    sessionKind: null,
    runtimeContractRequired: false,
  },
  chat: {
    archetype: "worker",
    controlSurface: "primary",
    description:
      "Right-sidebar Chat session. Uses the project conversation panel and executes tools based on configured permissions.",
    promptEditable: true,
    defaultPromptRequired: true,
    promptConfigMode: "override",
    sessionKind: null,
    runtimeContractRequired: false,
  },
  work: {
    archetype: "worker",
    controlSurface: "primary",
    description: "Right-sidebar Work session for longer multi-step research, analysis, and review-ready deliverables.",
    promptEditable: false,
    defaultPromptRequired: true,
    promptConfigMode: "none",
    sessionKind: null,
    runtimeContractRequired: false,
  },
  compaction: {
    archetype: "worker",
    controlSurface: "helper",
    description: "Internal summary agent for transcript checkpoint compaction.",
    promptEditable: false,
    defaultPromptRequired: false,
    promptConfigMode: "none",
    sessionKind: null,
    runtimeContractRequired: false,
  },
  title: {
    archetype: "worker",
    controlSurface: "helper",
    description: "Internal title agent for generating concise session titles.",
    promptEditable: true,
    defaultPromptRequired: true,
    promptConfigMode: "override",
    sessionKind: null,
    runtimeContractRequired: false,
  },
  summary: {
    archetype: "worker",
    controlSurface: "helper",
    description: "Internal follow-up summary model-routing slot; its prompt is built by the caller.",
    promptEditable: false,
    defaultPromptRequired: false,
    promptConfigMode: "none",
    sessionKind: null,
    runtimeContractRequired: false,
  },
  memory: {
    archetype: "worker",
    controlSurface: "helper",
    description: "Internal Project MEMORY.MD organizer; independently maintains bounded Project context.",
    promptEditable: false,
    defaultPromptRequired: true,
    promptConfigMode: "none",
    sessionKind: null,
    runtimeContractRequired: false,
  },
  control: {
    archetype: "worker",
    controlSurface: "primary",
    description: "Control-plane agent. Routes panel and gateway natural-language requests through the panel tool.",
    promptEditable: true,
    defaultPromptRequired: true,
    promptConfigMode: "override",
    sessionKind: null,
    runtimeContractRequired: false,
  },
  orchestrator: {
    archetype: "host",
    controlSurface: "host",
    description: "Orchestrator agent. Owns task lifecycle decisions and dispatches projected agents.",
    promptEditable: false,
    defaultPromptRequired: false,
    promptConfigMode: "none",
    sessionKind: "orchestrator",
    runtimeContractRequired: true,
  },
  mission: {
    archetype: "host",
    controlSurface: "primary",
    description:
      "Full-function Mission primary agent. Executes direct work and owns long-running objectives, roadmap, Task coordination, and delivery reconciliation.",
    promptEditable: true,
    defaultPromptRequired: true,
    promptConfigMode: "append",
    sessionKind: "mission",
    runtimeContractRequired: false,
  },
} as const satisfies Record<AgentRoleID, FixedRoleDefinition>

function createContract(id: AgentRoleID): AgentRoleContract {
  const definition = definitions[id]
  return Object.freeze({
    id,
    ...definition,
  })
}

const contracts = Object.freeze(
  Object.fromEntries(FIXED_AGENT_ROLE_IDS.map((id) => [id, createContract(id)])) as Record<
    AgentRoleID,
    AgentRoleContract
  >,
)

export namespace AgentRoleContract {
  export const ids = FIXED_AGENT_ROLE_IDS
  export const all = contracts

  export function isRoleID(id: string): id is AgentRoleID {
    return Object.hasOwn(contracts, id)
  }

  export function get(id: string): AgentRoleContract {
    if (!isRoleID(id)) throw new Error(`Unknown fixed agent role: ${JSON.stringify(id)}`)
    return contracts[id]
  }

  export function promptMode(id: AgentRoleID): AgentRoleContract["promptConfigMode"] {
    return get(id).promptConfigMode
  }

  export function description(id: AgentRoleID): string {
    return get(id).description
  }

  export function archetype(id: AgentRoleID): AgentArchetype {
    return get(id).archetype
  }

  export function controlSurface(id: AgentRoleID): AgentControlSurface {
    return get(id).controlSurface
  }

  export function sessionKind(id: AgentRoleID): SessionKind | null {
    return get(id).sessionKind
  }
}
