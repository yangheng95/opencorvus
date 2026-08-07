// ── Message utilities ──
// Canonical agent role classification and message display helpers.

import { t } from "./i18n"
import { isCardBodyMessagePart } from "./message-part"

// ── Agent Role ──

/** Canonical presentation roles used for card layout, icons and translated template labels. */
export type AgentRole =
  | "user"
  | "assistant"
  | "orchestrator"
  | "mission"
  | "intent-analysis"
  | "spec"
  | "requirements"
  | "frontend-design"
  | "frontend-research"
  | "visual-qa"
  | "architect"
  | "goal-workload-analyst"
  | "planner"
  | "executor"
  | "build"
  | "explore"
  | "deep-research"
  | "integrity"
  | "fact-check"
  | "system"

/** Stages that get their own collapsible agent card in the conversation view. */
export const AGENT_CARD_STAGES = new Set<AgentRole>([
  "assistant",
  "orchestrator",
  "mission",
  "intent-analysis",
  "spec",
  "requirements",
  "frontend-design",
  "frontend-research",
  "visual-qa",
  "architect",
  "goal-workload-analyst",
  "planner",
  "executor",
  "build",
  "explore",
  "deep-research",
  "integrity",
  "fact-check",
  "system",
])

export function workerSteerTargetSessionID(
  node: { kind: string; sessionID?: string | null; stage?: string | null },
  rootSessionID?: string,
): string | undefined {
  if (node.kind !== "agent") return undefined
  const sessionID = node.sessionID || undefined
  if (!sessionID || sessionID === rootSessionID || node.stage === "orchestrator") return undefined
  return sessionID
}

/**
 * Map any backend agent name to a canonical AgentRole.
 * This is the ONLY place where agent name → role mapping happens.
 */
export function normalizeAgentRole(name: string): AgentRole {
  const text = String(name || "")
    .trim()
    .toLowerCase()
  if (!text) return "assistant"
  if (text === "user") return "user"
  if (text === "orchestrator") return "orchestrator"
  if (text === "mission") return "mission"
  if (
    text === "intent-analysis" ||
    text === "intent_analysis" ||
    text === "analyze-intent" ||
    text === "analyze_intent" ||
    text === "intent"
  )
    return "intent-analysis"
  if (text === "spec") return "spec"
  if (text === "requirements") return "requirements"
  if (
    text === "frontend-design" ||
    text === "frontend_design" ||
    text === "frontend-design" ||
    text === "frontend_design"
  )
    return "frontend-design"
  if (text === "frontend-research" || text === "frontend_research") return "frontend-research"
  if (text === "visual-qa" || text === "visual_qa" || text === "visualqa") return "visual-qa"
  if (text === "architect" || text === "architecture" || text === "coordination") return "architect"
  if (
    text === "goal-workload-analyst" ||
    text === "goal_workload_analyst" ||
    text === "workload-analysis" ||
    text === "workload_analysis"
  )
    return "goal-workload-analyst"
  if (text === "planner" || text === "plan" || text === "planning" || text === "replan") return "planner"
  // "coding" is the post-rename name of the build worker (commit 2bda4d8a22
  // build→coding). It must share the build lane/icon, not collapse into the
  // generic executor bucket — otherwise the code-writing agent is not split.
  if (text === "build" || text === "coding") return "build"
  // Read-only repository-investigation subagent. Its own lane/icon so explore
  // dispatches are split out of the executor bucket (matches SessionKind
  // "explore" on the backend).
  if (text === "explore" || text === "explorer") return "explore"
  if (text === "deep-research" || text === "deep_research" || text === "deepresearch") return "deep-research"
  if (text === "executor" || text === "general" || text === "execute") return "executor"
  if (text === "acceptance" || text === "deliver" || text === "publish" || text === "refine") {
    throw new Error(`normalizeAgentRole: retired Acceptance agent identity "${text}"`)
  }
  if (text === "files") return "assistant"
  if (text === "integrity") return "integrity"
  if (text === "fact-check" || text === "fact_check" || text === "factcheck") return "fact-check"
  if (text === "system" || text === "compaction" || text === "title" || text === "summary") return "system"
  return "assistant"
}

// ── Pending placeholder detection ──

/**
 * Returns true if the given message part is a transient "thinking" placeholder
 * inserted while the assistant response is still streaming.
 */
export function isPendingPlaceholderPart(part: any): boolean {
  return part?.type === "text" && !part.id && ["……", "...", t("chat.thinking")].includes(part.text)
}

// ── Part ordering ──

export function orderedMessageParts(message: any): any[] {
  const parts = Array.isArray(message?.parts) ? message.parts.filter(isCardBodyMessagePart) : []
  if (parts.length < 2) return parts
  const reasoning: any[] = []
  const rest: any[] = []
  for (const part of parts) {
    if (part?.type === "reasoning") reasoning.push(part)
    else rest.push(part)
  }
  return [...reasoning, ...rest]
}

// ── Role labels ──

export function roleLabel(role: string): string {
  if (role === "user") return t("chat.role.user")
  if (role === "assistant") return t("chat.role.assistant")
  if (role === "orchestrator") return t("chat.role.orchestrator")
  if (role === "mission") return t("chat.role.mission")
  if (role === "intent-analysis") return t("chat.role.intent-analysis")
  if (role === "requirements") return t("chat.role.requirements")
  if (role === "frontend-design" || role === "frontend_design") return t("chat.role.frontend-design")
  if (role === "frontend-research" || role === "frontend_research") return t("chat.role.frontend-research")
  if (role === "visual-qa" || role === "visual_qa") return t("chat.role.visual-qa")
  if (role === "architect") return t("chat.role.architect")
  if (role === "goal-workload-analyst" || role === "goal_workload_analyst") return t("chat.role.goal-workload-analyst")
  if (role === "planner") return t("chat.role.planner")
  if (role === "spec") return t("chat.role.spec")
  if (role === "system") return t("chat.role.system")
  if (role === "executor") return t("chat.role.executor")
  if (role === "build") return t("chat.role.build")
  if (role === "explore") return t("chat.role.explore")
  if (role === "deep-research" || role === "deep_research") return t("chat.role.deep-research")
  if (role === "integrity") return t("chat.role.integrity")
  if (role === "fact-check") return t("chat.role.fact-check")
  return t("chat.role.assistant")
}

/** Preserve the exact runtime identity in visible non-user message headers. */
export function agentIdentityLabel(agentID: string | undefined, role: AgentRole): string {
  if (role === "user" || role === "system") return roleLabel(role)
  const exactAgentID = agentID?.trim()
  if (!exactAgentID) throw new Error(`agentIdentityLabel: non-user ${role} card missing exact agentID`)
  return exactAgentID
}

// ── Message classification ──

/**
 * Classify which channel a message belongs to.
 * Single classification function — replaces classifyAgentStage and classifyMessage.
 *
 * Returns:
 * - An AgentRole string (e.g. "spec", "planner") → message belongs to that agent card
 * - "main" → message belongs to the main conversation
 */
export function classifyMessage(msg: any, rootSessionID: string): string {
  void rootSessionID
  const backendChannel = String(msg?.info?.channel || "")
    .trim()
    .toLowerCase()
  if (!backendChannel) {
    throw new Error(`classifyMessage: message ${msg?.info?.id ?? "<unknown>"} missing channel`)
  }
  if (backendChannel === "main") return "main"
  if (backendChannel === "filtered") {
    throw new Error(`classifyMessage: message ${msg?.info?.id ?? "<unknown>"} uses the retired hidden channel`)
  }
  const normalizedChannel = normalizeAgentRole(backendChannel)
  if (AGENT_CARD_STAGES.has(normalizedChannel)) return normalizedChannel
  throw new Error(`classifyMessage: message ${msg?.info?.id ?? "<unknown>"} has unknown channel ${backendChannel}`)
}

// ── Agent stage label ──

/** Get the display label for an agent stage used in card headers. */
export function agentStageLabel(stage: string): string {
  const role = normalizeAgentRole(stage)
  if (role === "spec") return t("chat.role.spec")
  if (role === "orchestrator") return t("chat.role.orchestrator")
  if (role === "mission") return t("chat.role.mission")
  if (role === "intent-analysis") return t("chat.role.intent-analysis")
  if (role === "requirements") return t("chat.role.requirements")
  if (role === "frontend-design") return t("chat.role.frontend-design")
  if (role === "frontend-research") return t("chat.role.frontend-research")
  if (role === "visual-qa") return t("chat.role.visual-qa")
  if (role === "architect") return t("chat.role.architect")
  if (role === "goal-workload-analyst") return t("chat.role.goal-workload-analyst")
  if (role === "planner") return t("chat.role.planner")
  if (role === "executor") return t("chat.role.executor")
  if (role === "build") return t("chat.role.build")
  if (role === "explore") return t("chat.role.explore")
  if (role === "deep-research") return t("chat.role.deep-research")
  if (role === "integrity") return t("chat.role.integrity")
  if (role === "fact-check") return t("chat.role.fact-check")
  if (role === "system") return t("chat.role.system")
  return t("chat.role.assistant")
}

// ── Effective role ──

/**
 * Determine the display role for a message.
 * Use backend-stamped resolvedRole. Missing resolvedRole is a bridge bug.
 */
export function effectiveRole(msg: any, _rootSessionID?: string): string {
  void _rootSessionID
  const resolved = typeof msg?.info?.resolvedRole === "string" ? msg.info.resolvedRole.trim() : ""
  if (!resolved) throw new Error(`effectiveRole: message ${msg?.info?.id ?? "<unknown>"} missing resolvedRole`)
  return resolved
}
