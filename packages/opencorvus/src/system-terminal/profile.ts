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

  function configuredSystemShell(): string | undefined {
    if (process.platform === "win32") {
      return process.env.ComSpec
    }
    return process.env.SHELL
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
    commandNames: readonly string[]
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
      commandNames: ["powershell.exe", "powershell"],
      commands: ["powershell.exe", "powershell"],
      args: ["-NoLogo"],
      icon: "powershell",
    },
    {
      id: "pwsh",
      label: "PowerShell",
      scope: "win32",
      commandNames: ["pwsh.exe", "pwsh"],
      commands: ["pwsh.exe", "pwsh"],
      args: ["-NoLogo"],
      icon: "powershell",
    },
    {
      id: "cmd",
      label: "Command Prompt",
      scope: "win32",
      commandNames: ["cmd.exe", "cmd"],
      commands: ["cmd.exe", "cmd"],
      args: [],
      icon: "command-prompt",
    },
    {
      id: "git-bash",
      label: "Git Bash",
      scope: "win32",
      commandNames: ["bash.exe", "bash"],
      commands: [],
      args: [],
      icon: "bash",
      acceptResolvedCommand: isGitForWindowsBashPath,
    },
    {
      id: "bash",
      label: "Bash",
      scope: "non-win32",
      commandNames: ["bash.exe", "bash"],
      commands: ["bash"],
      args: [],
      icon: "bash",
    },
    {
      id: "zsh",
      label: "Zsh",
      scope: "non-win32",
      commandNames: ["zsh"],
      commands: ["zsh"],
      args: [],
      icon: "terminal",
    },
    {
      id: "fish",
      label: "Fish",
      scope: "non-win32",
      commandNames: ["fish"],
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

  function generatedDefinitionForID(id: string): SystemProfileDefinition | undefined {
    return GENERATED_SYSTEM_PROFILE_DEFINITIONS.find((definition) => definition.id === id)
  }

  function commandName(command: string): string {
    const normalized = command.replace(/\\/g, "/")
    return (normalized.split("/").pop() ?? normalized).toLowerCase()
  }

  function generatedCommandNameMatches(definition: SystemProfileDefinition, command: string): boolean {
    const configuredName = commandName(command)
    return definition.commandNames.some((candidate) => candidate.toLowerCase() === configuredName)
  }

  function generatedCommandMatchesCurrentDefinition(
    definition: SystemProfileDefinition,
    profile: Config.TerminalProfile,
  ): boolean {
    return !definition.acceptResolvedCommand || definition.acceptResolvedCommand(profile.command)
  }

  function profileArgsMatchGenerated(profile: Config.TerminalProfile, definition: SystemProfileDefinition): boolean {
    return (
      profile.args.length === definition.args.length &&
      profile.args.every((arg, index) => arg === definition.args[index])
    )
  }

  function profileEnvMatchesGenerated(profile: Config.TerminalProfile): boolean {
    const keys = Object.keys(profile.env)
    return (
      keys.length === Object.keys(GENERATED_TERMINAL_ENV).length &&
      profile.env.TERM === GENERATED_TERMINAL_ENV.TERM &&
      profile.env.COLORTERM === GENERATED_TERMINAL_ENV.COLORTERM
    )
  }

  function isGeneratedSystemProfile(id: string, profile: Config.TerminalProfile): boolean {
    const definition = generatedDefinitionForID(id)
    if (!definition) return false
    return (
      profile.label === definition.label &&
      profile.icon === definition.icon &&
      profileArgsMatchGenerated(profile, definition) &&
      profileEnvMatchesGenerated(profile) &&
      generatedCommandNameMatches(definition, profile.command)
    )
  }

  function profilesEqual(left: Config.TerminalProfile | undefined, right: Config.TerminalProfile | undefined): boolean {
    if (!left || !right) return left === right
    return (
      left.label === right.label &&
      left.command === right.command &&
      left.icon === right.icon &&
      left.args.length === right.args.length &&
      left.args.every((arg, index) => arg === right.args[index]) &&
      Object.keys(left.env).length === Object.keys(right.env).length &&
      Object.entries(left.env).every(([key, value]) => right.env[key] === value)
    )
  }

  function generatedProfilesDifferFromHost(
    terminal: Config.Terminal,
    hostTerminal: Config.Terminal | undefined,
  ): boolean {
    if (!hostTerminal?.profiles) return false
    const entries = Object.entries(terminal.profiles ?? {})
    const generatedEntries = entries.filter(([id, profile]) => isGeneratedSystemProfile(id, profile))
    if (generatedEntries.length === 0) return false
    const existingGeneratedProfiles = Object.fromEntries(generatedEntries)
    const customProfiles = customProfilePatch(terminal, { removeLegacyDefault: false })
    const hostGeneratedProfiles = generatedProfilePatch(hostTerminal, customProfiles)
    const existingIDs = Object.keys(existingGeneratedProfiles).sort()
    const hostIDs = Object.keys(hostGeneratedProfiles).sort()
    if (existingIDs.length !== hostIDs.length || existingIDs.some((id, index) => id !== hostIDs[index])) return true
    return hostIDs.some((id) => !profilesEqual(existingGeneratedProfiles[id], hostGeneratedProfiles[id]))
  }

  export function shouldRegenerateGeneratedProfilesForTest(
    terminal: Config.Terminal,
    resolveCommandForHost: (command: string) => string | undefined,
    platform: NodeJS.Platform = process.platform,
    hostTerminal?: Config.Terminal,
  ): boolean {
    const profiles = terminal.profiles ?? {}
    const entries = Object.entries(profiles)
    if (entries.length === 0) return false
    const generatedEntries = entries.filter(([id, profile]) => isGeneratedSystemProfile(id, profile))
    if (generatedEntries.length === 0) return false
    if (
      generatedEntries.some(([id, profile]) => {
        const definition = generatedDefinitionForID(id)
        return definition
          ? !definitionAppliesToPlatform(definition.scope, platform) ||
              !generatedCommandMatchesCurrentDefinition(definition, profile)
          : false
      })
    ) {
      return true
    }
    if (!terminal.default_profile_id || !profiles[terminal.default_profile_id]) {
      return generatedEntries.length === entries.length
    }
    if (generatedProfilesDifferFromHost(terminal, hostTerminal)) return true
    return generatedEntries.some(([, profile]) => !resolveCommandForHost(profile.command))
  }

  function shouldRegenerateGeneratedProfiles(terminal: Config.Terminal): boolean {
    return shouldRegenerateGeneratedProfilesForTest(
      terminal,
      resolveCommandIfAvailable,
      process.platform,
      setupDefaultProfile(),
    )
  }

  function removableGeneratedProfilePatch(
    terminal: Config.Terminal | undefined,
    options: { removeLegacyDefault: boolean },
  ): Record<string, null> {
    const profiles = terminal?.profiles ?? {}
    const patch: Record<string, null> = {}
    for (const [id, profile] of Object.entries(profiles)) {
      if ((options.removeLegacyDefault && id === "default") || isGeneratedSystemProfile(id, profile)) {
        patch[id] = null
      }
    }
    return patch
  }

  function customProfilePatch(
    terminal: Config.Terminal | undefined,
    options: { removeLegacyDefault: boolean },
  ): Record<string, Config.TerminalProfile> {
    const profiles = terminal?.profiles ?? {}
    const patch: Record<string, Config.TerminalProfile> = {}
    for (const [id, profile] of Object.entries(profiles)) {
      if ((options.removeLegacyDefault && id === "default") || isGeneratedSystemProfile(id, profile)) {
        continue
      }
      patch[id] = profile
    }
    return patch
  }

  function generatedProfilePatch(
    terminal: Config.Terminal,
    customProfiles: Record<string, Config.TerminalProfile>,
  ): Record<string, Config.TerminalProfile> {
    const profiles = terminal.profiles ?? {}
    const patch: Record<string, Config.TerminalProfile> = {}
    for (const [id, profile] of Object.entries(profiles)) {
      if (customProfiles[id]) continue
      patch[id] = profile
    }
    return patch
  }

  function isPreviousGeneratedSingleProfile(terminal: Config.Terminal): boolean {
    const command = configuredSystemShell()
    if (!command) return false
    const profiles = terminal.profiles ?? {}
    const entries = Object.entries(profiles)
    if (terminal.default_profile_id !== "default" || entries.length !== 1) return false
    const profile = profiles.default
    if (!profile) return false
    const label = process.platform === "win32" ? "Command Prompt" : path.basename(command)
    return (
      profile.label === label &&
      profile.command === command &&
      profile.args.length === 0 &&
      profile.env.TERM === GENERATED_TERMINAL_ENV.TERM &&
      profile.env.COLORTERM === GENERATED_TERMINAL_ENV.COLORTERM &&
      profile.icon === (process.platform === "win32" ? "command-prompt" : "terminal")
    )
  }

  export async function ensureProjectDefaultProfile(): Promise<void> {
    const config = await Config.get()
    const existingTerminal = config.terminal
    const previousGeneratedSingleProfile = existingTerminal ? isPreviousGeneratedSingleProfile(existingTerminal) : false
    const shouldWrite =
      !existingTerminal?.profiles ||
      Object.keys(existingTerminal.profiles).length === 0 ||
      previousGeneratedSingleProfile ||
      shouldRegenerateGeneratedProfiles(existingTerminal)
    if (!shouldWrite) return

    const terminal = setupDefaultProfile()
    if (!terminal) {
      throw new ConfigError({
        message: `Cannot initialize terminal profile: ${os.platform()} has no configured system shell`,
      })
    }

    const patchOptions = { removeLegacyDefault: previousGeneratedSingleProfile }
    const removePreviousProfiles = removableGeneratedProfilePatch(existingTerminal, patchOptions)
    const customProfiles = customProfilePatch(existingTerminal, patchOptions)
    const generatedProfiles = generatedProfilePatch(terminal, customProfiles)
    const defaultProfileID =
      existingTerminal?.default_profile_id && customProfiles[existingTerminal.default_profile_id]
        ? existingTerminal.default_profile_id
        : terminal.default_profile_id
    await Config.update({
      terminal: {
        ...terminal,
        default_profile_id: defaultProfileID,
        profiles: {
          ...removePreviousProfiles,
          ...customProfiles,
          ...generatedProfiles,
        },
      },
    } as Config.Info)
  }
}
