import { Icon, type IconName } from "./ui/Icon"
import { normalizeAgentRole, type AgentRole } from "../utils/message"
import { stageAccent } from "../utils/card-color"

export const AVATAR_ICON_BY_ROLE: Record<AgentRole, IconName> = {
  user: "avatar-user",
  assistant: "avatar-assistant",
  system: "avatar-system",
  orchestrator: "avatar-orchestrator",
  mission: "mission",
  "intent-analysis": "avatar-intent-analysis",
  spec: "avatar-spec",
  requirements: "avatar-requirements",
  "frontend-design": "avatar-frontend-design",
  "frontend-research": "avatar-frontend-research",
  "visual-qa": "avatar-visual-qa",
  architect: "avatar-architect",
  "goal-workload-analyst": "avatar-goal-workload-analyst",
  planner: "avatar-planner",
  executor: "executor",
  build: "avatar-build",
  explore: "avatar-explore",
  "deep-research": "avatar-deep-research",
  integrity: "avatar-integrity",
  "fact-check": "avatar-fact-check",
}

export function avatarRole(role: string): AgentRole {
  return normalizeAgentRole(role)
}

export function avatarIconName(role: string): IconName {
  return AVATAR_ICON_BY_ROLE[avatarRole(role)]
}

function avatarAccent(role: string): string {
  const accent = stageAccent(avatarRole(role))
  if (!accent) {
    throw new Error(`Avatar: missing stage accent for role "${role}"`)
  }
  return accent
}

export function Avatar(props: { role: string; status?: string; class?: string }) {
  const normalizedRole = () => avatarRole(props.role)
  const classes = () => ["chat-avatar", props.class].filter(Boolean).join(" ")

  return (
    <span
      class={classes()}
      data-role={normalizedRole()}
      data-status={props.status || undefined}
      style={{ "--card-stage": avatarAccent(props.role) }}
      aria-hidden="true"
    >
      <Icon class="chat-avatar__icon" name={avatarIconName(props.role)} size="large" />
    </span>
  )
}
