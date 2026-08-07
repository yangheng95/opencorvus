import os from "os"
import { Instance } from "../project/instance"
import { Project } from "../project/project"
import { Shell } from "@/shell/shell"
import { EffectiveConfig } from "@/config/effective"
import type { ResolvedSkillSurface } from "@/skill/surface"
import type { Config } from "@/config/config"

import PROMPT_SYSTEM from "./prompt/system.txt"
import type { Provider } from "@/provider/provider"
import type { SessionAgentRuntime } from "@/agent/session-agent-runtime"

function platformName(): string {
  switch (process.platform) {
    case "win32":
      return "Windows"
    case "darwin":
      return "macOS"
    case "linux":
      return "Linux"
    default:
      return process.platform
  }
}

function displayServer(): string | undefined {
  if (process.platform !== "linux") return undefined
  if (process.env.WAYLAND_DISPLAY) return process.env.DISPLAY ? "Wayland (XWayland available)" : "Wayland"
  if (process.env.DISPLAY) return "X11"
  return "headless"
}

function utcOffset(now: Date): string {
  const min = -now.getTimezoneOffset()
  const sign = min >= 0 ? "+" : "-"
  const abs = Math.abs(min)
  const h = String(Math.floor(abs / 60)).padStart(2, "0")
  const m = String(abs % 60).padStart(2, "0")
  return `${sign}${h}:${m}`
}

export namespace SystemPrompt {
  export function requestLanguage(): string {
    return [
      "## Response Language",
      "",
      "Answer in the language used by the current request's authored instructions. Treat quoted source text, code, paths, commands, identifiers, API names, and runtime protocol scaffolding as content to preserve, not evidence that changes the response language. If the request explicitly asks for a response language, follow that request.",
    ].join("\n")
  }

  /** Resolve the core system prompt string, respecting config.prompt.core_header override. */
  export async function instructions(): Promise<string> {
    const cfg = await EffectiveConfig.effective()
    return cfg.prompt?.["core_header"] ?? PROMPT_SYSTEM
  }

  export async function provider(model: Provider.Model, opts?: { sessionID?: string }) {
    const cfg = await EffectiveConfig.effective(opts?.sessionID ? { sessionID: opts.sessionID } : undefined)
    const override = cfg.prompt?.["core_header"]
    if (override) return [override]
    return [PROMPT_SYSTEM]
  }

  export async function environment(model: Provider.Model) {
    const platform = platformName()
    const arch = process.arch
    const hostname = os.hostname()
    const shell = Shell.acceptable()
    const display = displayServer()
    const now = new Date()
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"

    return [
      [
        `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Workspace root folder: ${Instance.worktree}`,
        `  Is directory a git repo: ${Project.isGitRepo(Instance.directory) ? "yes" : "no"}`,
        `  Platform: ${platform} (${arch})`,
        `  Hostname: ${hostname}`,
        `  Shell: ${shell}`,
        ...(display ? [`  Display-Server: ${display}`] : []),
        `  Today's date: ${now.toDateString()}`,
        `  Local timezone: ${zone} (UTC${utcOffset(now)})`,
        `</env>`,
      ].join("\n"),
    ]
  }

  export async function skills(
    _agent: SessionAgentRuntime,
    input: { surface: ResolvedSkillSurface },
  ): Promise<string | undefined> {
    const surface = input.surface
    if (!surface.tool_available) return
    const mission = surface.family === "mission"
    const toolID = surface.tool_id
    const directive = mission ? "mission" : "skill"
    const label = mission ? "Mission Skill" : "Skill"
    const compatible = surface.skills.filter((skill) => skill.enabled)
    const skillRows =
      compatible.length === 0
        ? ["- none: No enabled skills are currently mounted for this agent in this turn."]
        : compatible.map((s) => `- ${s.name}: ${s.description}`)

    return [
      `## ${label} Policy`,
      "",
      mission
        ? "Mission Skills are curated orchestration contracts for coordinating Mission-owned work across one or more fixed-profile Tasks."
        : "Skills are curated, tested workflows for recurring task shapes (webpage cloning, spec research, acceptance verification, etc.). Each skill bundles the task contract, evidence expectations, and resource files.",
      `The \`${toolID}\` tool can search mounted skills. Call it without a name to list them, or with \`query\` to fuzzy-search mounted skill titles and SKILL.md contents before loading an exact skill name.`,
      "",
      `### Mounted ${label}s`,
      "The entries below are already mounted for this agent in the current turn. Treat them as the agent's available skill surface, not as optional global suggestions.",
      "",
      "### Check First",
      "1. Before planning or tool use, inspect `<available_skills>` and decide whether the current task overlaps any mounted skill description.",
      `2. If the task wording is ambiguous, call the \`${toolID}\` tool with \`query\` to fuzzy-search mounted skill titles and SKILL.md contents.`,
      `3. When a mounted skill is relevant, call the \`${toolID}\` tool with its exact name to load the full instructions into context **before** you start executing.`,
      `4. When the loaded instructions require a relative supporting file, call the \`${toolID}\` tool again with the same exact \`name\` and that relative \`file\` path. Never send a materialized Skill cache path to the project \`read\` tool.`,
      "5. Follow the loaded skill's evidence and output contract rather than improvising. Do not repeat acquisition tools once the required evidence artifacts already exist.",
      "6. If several mounted skills could apply, load the most specific one first; load additional skills only if the task spans their domains.",
      "",
      `### Explicit User ${label} Directives`,
      `A visible user-authored directive in the exact form \`@${directive}("<exact-name>")\` is mandatory, not a search hint. For every such directive, call the \`${toolID}\` tool with that exact name ${
        mission
          ? "before planning, writing Mission state, or creating a child Task"
          : "before planning, delegation, or other execution"
      }. Never substitute a similar name, silently ignore the directive, or claim the ${label} was loaded without the real tool result.`,
      `Explicit directives are additive: after loading every named ${label}, you may still search for and load other mounted ${label}s when the task spans additional workflows.`,
      "",
      "<available_skills>",
      ...skillRows,
      "</available_skills>",
    ].join("\n")
  }
}
