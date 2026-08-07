import { NamedError } from "@opencorvus-ai/util/error"
import { existsSync } from "fs"
import path from "path"
import z from "zod"
import { SystemTerminal } from "@/system-terminal"
import { unwrapCommandQuotes } from "@/util/command"
import { which } from "@/util/which"

export namespace CodingCli {
  export const ConfigError = NamedError.create(
    "CodingCliConfigError",
    z.object({
      message: z.string(),
    }),
  )

  export const Icon = z.enum(["claude-code", "codex", "gemini", "copilot", "glm"])
  export type Icon = z.infer<typeof Icon>

  export const PublicInfo = z
    .object({
      id: z.string().min(1),
      label: z.string().min(1),
      icon: Icon,
    })
    .meta({ ref: "CodingCliProfile" })
  export type PublicInfo = z.infer<typeof PublicInfo>

  export const ListResponse = z
    .object({
      profiles: z.array(PublicInfo),
    })
    .meta({ ref: "CodingCliProfileList" })
  export type ListResponse = z.infer<typeof ListResponse>

  export const OpenInput = z.object({
    cliID: z.string().min(1),
    terminalProfileID: z.string().min(1),
    cwd: z.string().min(1),
  })
  export type OpenInput = z.infer<typeof OpenInput>

  export const OpenResponse = z.object({ ok: z.boolean() }).meta({ ref: "CodingCliOpenResponse" })
  export type OpenResponse = z.infer<typeof OpenResponse>

  interface Definition {
    id: string
    label: string
    icon: Icon
    env: string
    commands: string[]
    args?: string[]
  }

  export interface Resolved extends PublicInfo {
    command: string
    args: string[]
  }

  const DEFINITIONS: Definition[] = [
    {
      id: "claude-code",
      label: "Claude Code",
      icon: "claude-code",
      env: "OPENCORVUS_CODING_CLI_CLAUDE_CODE_BIN",
      commands:
        process.platform === "win32"
          ? ["claude.exe", "claude-code.exe", "claude.cmd", "claude-code.cmd", "claude"]
          : ["claude", "claude-code"],
    },
    {
      id: "codex",
      label: "Codex",
      icon: "codex",
      env: "OPENCORVUS_CODING_CLI_CODEX_BIN",
      commands: process.platform === "win32" ? ["codex.exe", "codex.cmd", "codex"] : ["codex"],
    },
    {
      id: "gemini-code",
      label: "Gemini Code",
      icon: "gemini",
      env: "OPENCORVUS_CODING_CLI_GEMINI_CODE_BIN",
      commands:
        process.platform === "win32"
          ? [
              "gemini.exe",
              "gemini.cmd",
              "geminicode.exe",
              "geminicode.cmd",
              "gemini-code.exe",
              "gemini-code.cmd",
              "gemini",
            ]
          : ["gemini", "geminicode", "gemini-code"],
    },
    {
      id: "copilot",
      label: "GitHub Copilot",
      icon: "copilot",
      env: "OPENCORVUS_CODING_CLI_COPILOT_BIN",
      commands:
        process.platform === "win32"
          ? ["copilot.exe", "copilot.cmd", "github-copilot.exe", "github-copilot.cmd", "copilot"]
          : ["copilot", "github-copilot"],
    },
    {
      id: "glm-code",
      label: "GLM Code",
      icon: "glm",
      env: "OPENCORVUS_CODING_CLI_GLM_CODE_BIN",
      commands:
        process.platform === "win32"
          ? ["glmcode.exe", "glmcode.cmd", "glm-code.exe", "glm-code.cmd", "glm.exe", "glm.cmd", "glmcode"]
          : ["glmcode", "glm-code", "glm"],
    },
  ]

  function resolveCommand(command: string): string {
    const normalized = unwrapCommandQuotes(command)
    if (path.isAbsolute(normalized)) {
      if (!existsSync(normalized)) {
        throw new ConfigError({ message: `Coding CLI command does not exist: ${normalized}` })
      }
      return normalized
    }
    const resolved = which(normalized)
    if (!resolved) {
      throw new ConfigError({ message: `Coding CLI command is not resolvable: ${normalized}` })
    }
    return resolved
  }

  function resolveCommandIfInstalled(command: string): string | undefined {
    try {
      return resolveCommand(command)
    } catch (error) {
      if (error instanceof ConfigError) return undefined
      throw error
    }
  }

  function resolveDefinition(definition: Definition): Resolved | undefined {
    const explicit = process.env[definition.env]?.trim()
    if (explicit) {
      return {
        id: definition.id,
        label: definition.label,
        icon: definition.icon,
        command: resolveCommand(explicit),
        args: [...(definition.args ?? [])],
      }
    }
    for (const command of definition.commands) {
      const resolved = resolveCommandIfInstalled(command)
      if (!resolved) continue
      return {
        id: definition.id,
        label: definition.label,
        icon: definition.icon,
        command: resolved,
        args: [...(definition.args ?? [])],
      }
    }
  }

  function profiles(): Record<string, Resolved> {
    const result: Record<string, Resolved> = {}
    for (const definition of DEFINITIONS) {
      const resolved = resolveDefinition(definition)
      if (resolved) result[resolved.id] = resolved
    }
    return result
  }

  export async function list(): Promise<ListResponse> {
    return {
      profiles: Object.values(profiles()).map((profile) => ({
        id: profile.id,
        label: profile.label,
        icon: profile.icon,
      })),
    }
  }

  function resolve(cliID: string): Resolved {
    const profile = profiles()[cliID]
    if (!profile) {
      throw new ConfigError({ message: `Unknown or unavailable coding CLI: ${cliID}` })
    }
    return profile
  }

  export async function open(input: OpenInput): Promise<OpenResponse> {
    const cli = resolve(input.cliID)
    await SystemTerminal.openCommand({
      cwd: input.cwd,
      terminalProfileID: input.terminalProfileID,
      command: cli.command,
      args: cli.args,
    })
    return { ok: true }
  }
}
