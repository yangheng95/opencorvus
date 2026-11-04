import { NamedError } from "@opencorvus-ai/util/error"
import { existsSync } from "fs"
import fs from "fs/promises"
import os from "os"
import path from "path"
import z from "zod"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { which } from "@/util/which"

export namespace TerminalProfile {
  export const ConfigError = NamedError.create(
    "TerminalProfileConfigError",
    z.object({
      message: z.string(),
    }),
  )

  export interface Resolved {
    id: string
    label: string
    command: string
    args: string[]
    env: Record<string, string>
    icon: Icon
  }

  export const Icon = z.enum(["terminal", "powershell", "command-prompt", "bash"])
  export type Icon = z.infer<typeof Icon>

  export const PublicInfo = z
    .object({
      id: z.string().min(1),
      label: z.string().min(1),
      icon: Icon,
    })
    .meta({ ref: "TerminalProfile" })

  export type PublicInfo = z.infer<typeof PublicInfo>

  export const ListResponse = z
    .object({
      defaultProfileID: z.string().min(1),
      profiles: z.array(PublicInfo),
    })
    .meta({ ref: "TerminalProfileList" })

  export type ListResponse = z.infer<typeof ListResponse>

  function normalizeForCompare(value: string): string {
    return process.platform === "win32" ? value.toLowerCase() : value
  }

  function isInside(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate)
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
  }

  export async function validateCwd(cwd: string): Promise<string> {
    if (!path.isAbsolute(cwd)) {
      throw new ConfigError({ message: `Terminal cwd must be absolute: ${cwd}` })
    }
    const rootRealPath = await fs.realpath(Instance.directory)
    const candidateRealPath = await fs.realpath(cwd)
    const root = normalizeForCompare(rootRealPath)
    const candidate = normalizeForCompare(candidateRealPath)
    if (!isInside(root, candidate)) {
      throw new ConfigError({
        message: `Terminal cwd ${cwd} must be inside project directory ${Instance.directory}`,
      })
    }
    return candidateRealPath
  }

  function resolveCommand(command: string): string {
    if (path.isAbsolute(command)) {
      if (!existsSync(command)) {
        throw new ConfigError({ message: `Terminal profile command does not exist: ${command}` })
      }
      return command
    }

    const resolved = which(command)
    if (!resolved) {
      throw new ConfigError({ message: `Terminal profile command is not resolvable: ${command}` })
    }
    return resolved
  }

  function resolveCommandIfAvailable(command: string): string | undefined {
    try {
      return resolveCommand(command)
    } catch (error) {
      if (error instanceof ConfigError) return undefined
      throw error
    }
  }

  function configuredProfileIcon(profile: Config.TerminalProfile): Icon {
    return profile.icon ?? "terminal"
  }

  async function registry(): Promise<{ defaultProfileID: string; profiles: Record<string, Resolved> }> {
    const config = await Config.get()
    const terminal = config.terminal
    if (!terminal?.profiles || Object.keys(terminal.profiles).length === 0) {
      throw new ConfigError({ message: "Terminal profiles are not configured" })
    }
    if (!terminal.default_profile_id) {
      throw new ConfigError({ message: "Terminal default_profile_id is not configured" })
    }
    if (!terminal.profiles[terminal.default_profile_id]) {
      throw new ConfigError({
        message: `Terminal default_profile_id references unknown profile: ${terminal.default_profile_id}`,
      })
    }

    const profiles: Record<string, Resolved> = {}
    for (const [id, profile] of Object.entries(terminal.profiles)) {
      profiles[id] = {
        id,
        label: profile.label,
        command: resolveCommand(profile.command),
        args: [...profile.args],
        env: { ...profile.env },
        icon: configuredProfileIcon(profile),
      }
    }
    return { defaultProfileID: terminal.default_profile_id, profiles }
  }

  export async function resolve(profileID: string): Promise<Resolved> {
    const { profiles } = await registry()
    const profile = profiles[profileID]
    if (!profile) {
      throw new ConfigError({ message: `Unknown terminal profile: ${profileID}` })
    }
    return profile
  }

  export async function list(): Promise<ListResponse> {
    const result = await registry()
    return {
      defaultProfileID: result.defaultProfileID,
      profiles: Object.values(result.profiles).map((profile) => ({
        id: profile.id,
        label: profile.label,
        icon: profile.icon,
      })),
    }
  }

  const GENERATED_TERMINAL_ENV = {
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  } as const

  type PlatformScope = NodeJS.Platform | "non-win32" | "all"

  interface SystemProfileDefinition {
    id: string
    label: string
    scope: PlatformScope
    commands: string[]
    args: string[]
    icon: Icon
    acceptResolvedCommand?: (command: string) => boolean
  }

  interface SystemProfileOptions {
    platform: NodeJS.Platform
    env: NodeJS.ProcessEnv
    resolveCommand: (command: string) => string | undefined
  }

  function uniqueStrings(values: Array<string | undefined>): string[] {
    return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value))]
  }

  function windowsGitBashPathsFromRoot(root: string | undefined): string[] {
    if (!root?.trim()) return []
    return [path.win32.join(root, "bin", "bash.exe"), path.win32.join(root, "usr", "bin", "bash.exe")]
  }

  function windowsGitRootsFromGitCommand(command: string): string[] {
    const directory = path.win32.dirname(command)
    return uniqueStrings([path.win32.resolve(directory, ".."), path.win32.resolve(directory, "..", "..")])
  }

  function isGitForWindowsBashPath(command: string): boolean {
    const normalized = command.replace(/\\/g, "/").toLowerCase()
    return (
      normalized.includes("/git/") && (normalized.endsWith("/bin/bash.exe") || normalized.endsWith("/usr/bin/bash.exe"))
    )
  }

  function windowsGitBashCommands(options: SystemProfileOptions): string[] {
    const resolvedGitCommands = uniqueStrings(
      ["git.exe", "git"].map((command) => options.resolveCommand(command)).filter(Boolean) as string[],
    )
    const rootsFromGit = resolvedGitCommands.flatMap(windowsGitRootsFromGitCommand)
    return uniqueStrings([
      options.env.OPENCORVUS_SYSTEM_TERMINAL_GIT_BASH_BIN,
      ...rootsFromGit.flatMap(windowsGitBashPathsFromRoot),
      ...windowsGitBashPathsFromRoot(
        options.env.ProgramFiles ? path.win32.join(options.env.ProgramFiles, "Git") : undefined,
      ),
      ...windowsGitBashPathsFromRoot(
        options.env["ProgramFiles(x86)"] ? path.win32.join(options.env["ProgramFiles(x86)"], "Git") : undefined,
      ),
      ...windowsGitBashPathsFromRoot(
        options.env.LOCALAPPDATA ? path.win32.join(options.env.LOCALAPPDATA, "Programs", "Git") : undefined,
      ),
      "bash.exe",
      "bash",
    ])
  }

  const GENERATED_SYSTEM_PROFILE_DEFINITIONS: readonly SystemProfileDefinition[] = [
    {
      id: "powershell",
      label: "Windows PowerShell",
      scope: "win32",
      commands: ["powershell.exe", "powershell"],
      args: ["-NoLogo"],
      icon: "powershell",
    },
    {
      id: "pwsh",
      label: "PowerShell",
      scope: "win32",
      commands: ["pwsh.exe", "pwsh"],
      args: ["-NoLogo"],
      icon: "powershell",
    },
    {
      id: "cmd",
      label: "Command Prompt",
      scope: "win32",
      commands: ["cmd.exe", "cmd"],
      args: [],
      icon: "command-prompt",
    },
    {
      id: "git-bash",
      label: "Git Bash",
      scope: "win32",
      commands: [],
      args: [],
      icon: "bash",
      acceptResolvedCommand: isGitForWindowsBashPath,
    },
    {
      id: "bash",
      label: "Bash",
      scope: "non-win32",
      commands: ["bash"],
      args: [],
      icon: "bash",
    },
    {
      id: "zsh",
      label: "Zsh",
      scope: "non-win32",
      commands: ["zsh"],
      args: [],
      icon: "terminal",
    },
    {
      id: "fish",
      label: "Fish",
      scope: "non-win32",
      commands: ["fish"],
      args: [],
      icon: "terminal",
    },
  ]

  function definitionAppliesToPlatform(scope: PlatformScope, platform: NodeJS.Platform): boolean {
    if (scope === "all") return true
    if (scope === "non-win32") return platform !== "win32"
    return scope === platform
  }

  function systemProfileDefinitions(options: SystemProfileOptions): SystemProfileDefinition[] {
    return GENERATED_SYSTEM_PROFILE_DEFINITIONS.filter((definition) =>
      definitionAppliesToPlatform(definition.scope, options.platform),
    ).map((definition) => {
      if (definition.id === "cmd") {
        return {
          ...definition,
          commands: uniqueStrings([options.env.ComSpec, ...definition.commands]),
        }
      }
      if (definition.id === "git-bash") {
        return {
          ...definition,
          commands: windowsGitBashCommands(options),
        }
      }
      if (definition.id === "bash") {
        return {
          ...definition,
          commands: uniqueStrings([
            options.env.SHELL?.endsWith("/bash") ? options.env.SHELL : undefined,
            ...definition.commands,
          ]),
        }
      }
      if (definition.id === "zsh") {
        return {
          ...definition,
          commands: uniqueStrings([
            options.env.SHELL?.endsWith("/zsh") ? options.env.SHELL : undefined,
            ...definition.commands,
          ]),
        }
      }
      if (definition.id === "fish") {
        return {
          ...definition,
          commands: uniqueStrings([
            options.env.SHELL?.endsWith("/fish") ? options.env.SHELL : undefined,
            ...definition.commands,
          ]),
        }
      }
      return { ...definition }
    })
  }

  function createSystemTerminalProfileConfig(options: SystemProfileOptions): Config.Terminal | undefined {
    const profiles: Record<string, Config.TerminalProfile> = {}
    for (const definition of systemProfileDefinitions(options)) {
      const command = definition.commands
        .map(options.resolveCommand)
        .find(
          (resolved) => !!resolved && (!definition.acceptResolvedCommand || definition.acceptResolvedCommand(resolved)),
        )
      if (!command) continue
      profiles[definition.id] = {
        label: definition.label,
        command,
        args: definition.args,
        env: { ...GENERATED_TERMINAL_ENV },
        icon: definition.icon,
      }
    }
    const defaultProfileID = profiles.powershell ? "powershell" : Object.keys(profiles)[0]
    if (!defaultProfileID) return
    return {
      default_profile_id: defaultProfileID,
      profiles,
    }
  }

  export function createSystemTerminalProfilesForTest(options: SystemProfileOptions): Config.Terminal | undefined {
    return createSystemTerminalProfileConfig(options)
  }

  export function setupDefaultProfile(): Config.Terminal | undefined {
    return createSystemTerminalProfileConfig({
      platform: process.platform,
      env: process.env,
      resolveCommand: resolveCommandIfAvailable,
    })
  }

  export async function ensureProjectDefaultProfile(): Promise<void> {
    const config = await Config.get()
    if (config.terminal?.profiles && Object.keys(config.terminal.profiles).length > 0) return

    const terminal = setupDefaultProfile()
    if (!terminal) {
      throw new ConfigError({
        message: `Cannot initialize terminal profile: ${os.platform()} has no configured system shell`,
      })
    }
    await Config.update({ terminal } as Config.Info)
  }
}
