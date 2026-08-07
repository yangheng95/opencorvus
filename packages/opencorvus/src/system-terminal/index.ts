import { NamedError } from "@opencorvus-ai/util/error"
import { existsSync } from "fs"
import { spawn as spawnChildProcess } from "node:child_process"
import path from "path"
import z from "zod"
import { Plugin } from "@/plugin"
import { TerminalProfile } from "@/system-terminal/profile"
import { unwrapCommandQuotes } from "@/util/command"
import { which } from "@/util/which"

export namespace SystemTerminal {
  export const ConfigError = NamedError.create(
    "SystemTerminalConfigError",
    z.object({
      message: z.string(),
    }),
  )

  export const OpenInput = z.object({
    cwd: z.string().min(1),
    profileID: z.string().min(1).optional(),
  })
  export type OpenInput = z.infer<typeof OpenInput>

  export const OpenResponse = z.object({ ok: z.boolean() }).meta({ ref: "SystemTerminalOpenResponse" })
  export type OpenResponse = z.infer<typeof OpenResponse>

  export interface CommandSpec {
    command: string
    args: string[]
    detached?: boolean
    windowsVerbatimArguments?: boolean
  }

  export interface BuildOptions {
    platform: NodeJS.Platform
    cwd: string
    terminalApp: string
    profile?: Pick<TerminalProfile.Resolved, "command" | "args" | "icon">
    command?: string
    args?: string[]
    keepOpen?: boolean
    defaultShell?: string
  }

  function resolveExecutable(command: string): string {
    const normalized = unwrapCommandQuotes(command)
    if (path.isAbsolute(normalized)) {
      if (!existsSync(normalized)) {
        throw new ConfigError({ message: `System terminal executable does not exist: ${normalized}` })
      }
      return normalized
    }
    const resolved = which(normalized)
    if (!resolved) {
      throw new ConfigError({ message: `System terminal executable is not resolvable: ${normalized}` })
    }
    return resolved
  }

  function terminalApp(): string {
    const configured = process.env.OPENCORVUS_SYSTEM_TERMINAL_BIN?.trim()
    if (configured) return resolveExecutable(configured)
    if (process.platform === "win32") return resolveExecutable(process.env.ComSpec?.trim() || "cmd.exe")
    if (process.platform === "darwin") return resolveExecutable("/usr/bin/osascript")
    return resolveExecutable("x-terminal-emulator")
  }

  async function validateCwd(cwd: string): Promise<string> {
    try {
      return await TerminalProfile.validateCwd(cwd)
    } catch (error) {
      if (error instanceof TerminalProfile.ConfigError) {
        throw new ConfigError({ message: error.data.message })
      }
      throw error
    }
  }

  async function resolveProfile(profileID: string): Promise<TerminalProfile.Resolved> {
    try {
      return await TerminalProfile.resolve(profileID)
    } catch (error) {
      if (error instanceof TerminalProfile.ConfigError) {
        throw new ConfigError({ message: error.data.message })
      }
      throw error
    }
  }

  function shellQuote(value: string): string {
    return `'${value.replaceAll("'", "'\"'\"'")}'`
  }

  function powerShellQuote(value: string): string {
    return `'${value.replaceAll("'", "''")}'`
  }

  function cmdQuote(value: string): string {
    const escaped = value.replaceAll("^", "^^").replaceAll("%", "%%").replaceAll("!", "^!").replaceAll('"', '""')
    return `"${escaped}"`
  }

  function appleScriptString(value: string): string {
    return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
  }

  function interactiveShellArgv(options: BuildOptions): string[] {
    if (options.profile) return [unwrapCommandQuotes(options.profile.command), ...options.profile.args]
    return [options.defaultShell?.trim() ?? process.env.SHELL?.trim() ?? "sh"]
  }

  function commandArgv(options: BuildOptions): string[] {
    if (options.command) return [unwrapCommandQuotes(options.command), ...(options.args ?? [])]
    if (options.profile) return [unwrapCommandQuotes(options.profile.command), ...options.profile.args]
    return []
  }

  function windowsInteractiveArgv(options: BuildOptions): string[] {
    if (options.profile) return [unwrapCommandQuotes(options.profile.command), ...options.profile.args]
    return ["cmd.exe", "/k"]
  }

  function cmdCommandLine(argv: string[]): string {
    return argv.map(cmdQuote).join(" ")
  }

  function windowsStartCommandLine(options: BuildOptions, argv: string[]): string {
    if (argv.length === 0) {
      throw new ConfigError({ message: "System terminal launcher target is required" })
    }
    return `start "" /D ${cmdQuote(options.cwd)} ${cmdCommandLine(argv)}`
  }

  function windowsConsoleLauncherArgs(options: BuildOptions, argv: string[]): string[] {
    return [unwrapCommandQuotes(options.terminalApp), "/d", "/s", "/c", windowsStartCommandLine(options, argv)]
  }

  function shellLine(options: BuildOptions): string {
    const argv = commandArgv(options)
    const prefix = `cd ${shellQuote(options.cwd)}`
    if (argv.length === 0) return `${prefix}; exec ${interactiveShellArgv(options).map(shellQuote).join(" ")}`
    const command = argv.map(shellQuote).join(" ")
    if (options.keepOpen) {
      return `${prefix} && ${command}; exec ${[...interactiveShellArgv(options), "-i"].map(shellQuote).join(" ")}`
    }
    return `${prefix}; exec ${command}`
  }

  function windowsExternalCommandSpec(options: BuildOptions, argv: string[]): CommandSpec {
    if (!options.profile) {
      throw new ConfigError({ message: "System terminal profile is required to open a command" })
    }
    const profileCommand = unwrapCommandQuotes(options.profile.command)
    if (options.profile.icon === "powershell") {
      // Launch the coding CLI as PowerShell's foreground command so the CLI
      // owns the session instead of relying on a brittle wrapper shell.
      const command = `& ${argv.map(powerShellQuote).join(" ")}`
      return {
        command: profileCommand,
        args: [...options.profile.args, "-Command", command],
        windowsVerbatimArguments: true,
      }
    }
    if (options.profile.icon === "bash") {
      return {
        command: profileCommand,
        args: [...options.profile.args, "-lc", shellLine({ ...options, keepOpen: true })],
      }
    }
    return {
      command: profileCommand,
      args: [...options.profile.args, "/d", "/s", "/k", cmdCommandLine(argv)],
      windowsVerbatimArguments: true,
    }
  }

  export function buildCommand(options: BuildOptions): CommandSpec {
    const argv = commandArgv(options)
    if (options.platform === "win32") {
      if (options.command) {
        return windowsExternalCommandSpec(options, argv)
      }
      const command = windowsInteractiveArgv(options)
      const launcher = windowsConsoleLauncherArgs(options, command)
      return { command: launcher[0], args: launcher.slice(1), detached: true }
    }

    if (options.platform === "darwin") {
      const script = [
        'tell application "Terminal"',
        "activate",
        `do script ${appleScriptString(shellLine(options))}`,
        "end tell",
      ].join("\n")
      return { command: options.terminalApp, args: ["-e", script] }
    }

    return {
      command: options.terminalApp,
      args: ["-e", "sh", "-lc", shellLine(options)],
    }
  }

  async function launchChildProcess(spec: CommandSpec, cwd: string, env: Record<string, string>): Promise<OpenResponse> {
    let child
    try {
      child = spawnChildProcess(spec.command, spec.args, {
        cwd,
        detached: spec.detached ?? false,
        env: {
          ...process.env,
          ...env,
        },
        shell: false,
        stdio: "ignore",
        windowsHide: false,
        windowsVerbatimArguments: spec.windowsVerbatimArguments ?? false,
      })
    } catch (error) {
      throw new ConfigError({ message: error instanceof Error ? error.message : String(error) })
    }

    let earlyExit: number | undefined
    try {
      earlyExit = await new Promise<number | undefined>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup()
          resolve(undefined)
        }, 300)
        const cleanup = () => {
          clearTimeout(timeout)
          child.off("error", onError)
          child.off("exit", onExit)
        }
        const onError = (error: Error) => {
          cleanup()
          reject(error)
        }
        const onExit = (code: number | null) => {
          cleanup()
          resolve(code ?? 1)
        }
        child.once("error", onError)
        child.once("exit", onExit)
      })
    } catch (error) {
      throw new ConfigError({ message: error instanceof Error ? error.message : String(error) })
    }
    if (typeof earlyExit === "number" && earlyExit !== 0) {
      throw new ConfigError({ message: `System terminal launcher exited with code ${earlyExit}: ${spec.command}` })
    }
    if (earlyExit === undefined) child.unref()
    return { ok: true }
  }

  async function launch(spec: CommandSpec, cwd: string, env: Record<string, string>): Promise<OpenResponse> {
    if (spec.detached || spec.windowsVerbatimArguments) return await launchChildProcess(spec, cwd, env)

    let child: Bun.Subprocess<"ignore", "ignore", "ignore">
    try {
      child = Bun.spawn([spec.command, ...spec.args], {
        cwd,
        env: {
          ...process.env,
          ...env,
        },
        stdio: ["ignore", "ignore", "ignore"],
        windowsHide: false,
      })
    } catch (error) {
      throw new ConfigError({ message: error instanceof Error ? error.message : String(error) })
    }
    const earlyExit = await Promise.race([child.exited, Bun.sleep(300).then(() => undefined)])
    if (typeof earlyExit === "number" && earlyExit !== 0) {
      throw new ConfigError({ message: `System terminal launcher exited with code ${earlyExit}: ${spec.command}` })
    }
    if (earlyExit === undefined) child.unref()
    return { ok: true }
  }

  export async function open(input: OpenInput): Promise<OpenResponse> {
    const cwd = await validateCwd(input.cwd)
    const profile = input.profileID ? await resolveProfile(input.profileID) : undefined
    const shellEnv = await Plugin.trigger("shell.env", { cwd }, { env: {} })
    const spec = buildCommand({
      platform: process.platform,
      cwd,
      terminalApp: terminalApp(),
      profile,
      defaultShell: process.env.SHELL,
    })
    return await launch(spec, cwd, shellEnv.env as Record<string, string>)
  }

  export async function openCommand(input: {
    cwd: string
    terminalProfileID: string
    command: string
    args?: string[]
  }): Promise<OpenResponse> {
    const cwd = await validateCwd(input.cwd)
    const profile = await resolveProfile(input.terminalProfileID)
    const shellEnv = await Plugin.trigger("shell.env", { cwd }, { env: {} })
    const spec = buildCommand({
      platform: process.platform,
      cwd,
      terminalApp: terminalApp(),
      profile,
      command: input.command,
      args: input.args ?? [],
      keepOpen: true,
      defaultShell: process.env.SHELL,
    })
    return await launch(spec, cwd, shellEnv.env as Record<string, string>)
  }
}
