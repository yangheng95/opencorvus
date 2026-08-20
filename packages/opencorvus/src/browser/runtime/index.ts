import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { pathToFileURL } from "node:url"
import { resolveOpenCorvusRuntimePaths } from "@opencorvus-ai/util/runtime-paths"

export namespace BrowserRuntime {
  export type BrowserProxyConfig = {
    server: string
    bypass?: string
    username?: string
    password?: string
  }

  type PlaywrightModule = {
    chromium: {
      launch(input: { executablePath: string; headless: boolean; args: string[]; timeout: number }): Promise<any>
      connectOverCDP(endpointURL: string, input: { timeout: number }): Promise<any>
    }
  }

  export type ErrorCode =
    | "browser_executable_not_found"
    | "browser_missing"
    | "browser_launch_failed"
    | "browser_connect_failed"

  export type Diagnostic = {
    code: ErrorCode
    message: string
    checkedCandidates: string[]
    recoveryCommand: string
    override?: string
  }

  export class RuntimeError extends Error {
    readonly code: ErrorCode
    readonly diagnostic: Diagnostic

    constructor(diagnostic: Diagnostic, options?: ErrorOptions) {
      super(`${diagnostic.code}: ${diagnostic.message} Recovery: ${diagnostic.recoveryCommand}`, options)
      this.name = "BrowserRuntimeError"
      this.code = diagnostic.code
      this.diagnostic = diagnostic
    }
  }

  export const DEFAULT_BROWSER_CANDIDATES = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ] as const

  export const DEFAULT_BROWSER_COMMANDS = [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "microsoft-edge",
    "microsoft-edge-stable",
    "msedge",
    "chrome",
  ] as const

  export const RECOVERY_COMMAND =
    "Install Chrome/Edge or set OPENCORVUS_BROWSER_EXECUTABLE to the browser executable path."
  export const CDP_ENDPOINT_RECOVERY_COMMAND =
    "Start Chrome with a remote debugging endpoint and a non-default --user-data-dir, then set OPENCORVUS_BROWSER_CDP_ENDPOINT."
  export const CHROME_CHANNEL_RECOVERY_COMMAND =
    "Install Chrome/Edge so OpenCorvus can start its own remote-debugging Chrome in a dedicated profile, or set OPENCORVUS_BROWSER_MODE=isolated for a separate signed-out browser."
  export const CHROME_PROFILE_RECOVERY_COMMAND =
    "Point OPENCORVUS_BROWSER_CHROME_USER_DATA_DIR at a writable non-default profile directory and close any browser already using it, or set OPENCORVUS_BROWSER_MODE=isolated for a separate signed-out browser."
  export const DEFAULT_BROWSER_LAUNCH_TIMEOUT_MS = 300_000
  export const DEFAULT_CHROME_CDP_STARTUP_TIMEOUT_MS = 30_000

  /**
   * Chrome 136 and later refuse `--remote-debugging-port` whenever the profile
   * is the browser's own default data directory ("DevTools remote debugging
   * requires a non-default data directory"), so the managed CDP profile lives
   * beside the rest of the OpenCorvus runtime state instead.
   */
  export const MANAGED_CHROME_PROFILE_DIRECTORY_NAME = "chrome-cdp-profile"

  export function cdpConnectionDiagnostic(target: "endpoint" | "chrome" = "endpoint"): Diagnostic {
    return {
      code: "browser_connect_failed",
      message:
        target === "chrome"
          ? "BrowserRuntime could not connect to the running Google Chrome instance."
          : "BrowserRuntime could not connect to the configured CDP endpoint.",
      checkedCandidates: [],
      recoveryCommand:
        target === "chrome" ? CHROME_CHANNEL_RECOVERY_COMMAND : CDP_ENDPOINT_RECOVERY_COMMAND,
    }
  }

  export function resolveChromeUserDataDir(input?: {
    platform?: NodeJS.Platform
    env?: NodeJS.ProcessEnv
    homeDir?: string
  }): string {
    const platform = input?.platform ?? process.platform
    const env = input?.env ?? process.env
    const homeDir = input?.homeDir ?? os.homedir()
    const platformPath = platform === "win32" ? path.win32 : path.posix
    if (platform === "win32") {
      return platformPath.join(
        env.LOCALAPPDATA || platformPath.join(homeDir, "AppData", "Local"),
        "Google",
        "Chrome",
        "User Data",
      )
    }
    if (platform === "darwin") {
      return platformPath.join(homeDir, "Library", "Application Support", "Google", "Chrome")
    }
    if (platform === "linux") return platformPath.join(homeDir, ".config", "google-chrome")
    throw new RuntimeError(cdpConnectionDiagnostic("chrome"))
  }

  export function defaultChromeProfileDiagnostic(userDataDir: string): Diagnostic {
    return {
      code: "browser_launch_failed",
      message:
        `Chrome refuses remote debugging on its own default profile directory (${userDataDir}). ` +
        "DevTools remote debugging requires a non-default data directory.",
      checkedCandidates: [userDataDir],
      recoveryCommand: CHROME_PROFILE_RECOVERY_COMMAND,
    }
  }

  export function managedChromeStartupDiagnostic(input: {
    executablePath: string
    userDataDir: string
    exitCode: number | null
    spawnError?: string
  }): Diagnostic {
    const exited = input.spawnError
      ? ` The browser could not be started: ${input.spawnError}.`
      : input.exitCode === null
        ? ""
        : ` The browser exited with code ${input.exitCode}.`
    return {
      code: "browser_launch_failed",
      message:
        `BrowserRuntime started ${input.executablePath} with remote debugging in ${input.userDataDir} ` +
        `but no DevTools endpoint became reachable.${exited}`,
      checkedCandidates: [input.userDataDir],
      recoveryCommand: CHROME_PROFILE_RECOVERY_COMMAND,
    }
  }

  function normalizedUserDataDir(userDataDir: string, platform: NodeJS.Platform): string {
    const platformPath = platform === "win32" ? path.win32 : path.posix
    return platformPath.normalize(userDataDir.trim()).replace(/[\\/]+$/, "")
  }

  function comparableUserDataDir(userDataDir: string, platform: NodeJS.Platform): string {
    const normalized = normalizedUserDataDir(userDataDir, platform)
    return platform === "win32" ? normalized.toLowerCase() : normalized
  }

  /**
   * The one profile a remote-debugging Chrome can never use. Refusing it here
   * turns an unreachable DevTools endpoint — the failure mode that silently
   * disabled every browser tool — into a named, actionable error.
   */
  export function assertNonDefaultChromeUserDataDir(
    userDataDir: string,
    input?: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; homeDir?: string },
  ): string {
    const platform = input?.platform ?? process.platform
    let browserDefault: string | undefined
    try {
      browserDefault = comparableUserDataDir(resolveChromeUserDataDir({ ...input, platform }), platform)
    } catch {
      browserDefault = undefined
    }
    if (browserDefault && comparableUserDataDir(userDataDir, platform) === browserDefault) {
      throw new RuntimeError(defaultChromeProfileDiagnostic(userDataDir.trim()))
    }
    return normalizedUserDataDir(userDataDir, platform)
  }

  export function resolveManagedChromeUserDataDir(input?: {
    platform?: NodeJS.Platform
    env?: NodeJS.ProcessEnv
    homeDir?: string
  }): string {
    const platform = input?.platform ?? process.platform
    const env = input?.env ?? process.env
    const homeDir = input?.homeDir ?? os.homedir()
    const platformPath = platform === "win32" ? path.win32 : path.posix
    const explicit = env.OPENCORVUS_BROWSER_CHROME_USER_DATA_DIR?.trim()
    if (explicit) return assertNonDefaultChromeUserDataDir(explicit, { platform, env, homeDir })
    const runtimePaths = resolveOpenCorvusRuntimePaths({ env, platform, home: homeDir })
    return assertNonDefaultChromeUserDataDir(
      platformPath.join(runtimePaths.data, MANAGED_CHROME_PROFILE_DIRECTORY_NAME),
      { platform, env, homeDir },
    )
  }

  export async function resolveChromeCdpEndpoint(input?: {
    userDataDir?: string
    platform?: NodeJS.Platform
    env?: NodeJS.ProcessEnv
    homeDir?: string
  }): Promise<string> {
    const userDataDir = input?.userDataDir ?? resolveManagedChromeUserDataDir(input)
    const activePort = await fs.readFile(path.join(userDataDir, "DevToolsActivePort"), "utf8").catch(() => "")
    const [portLine, browserPath, ...unexpected] = activePort.trim().split(/\r?\n/)
    const port = Number(portLine)
    if (
      !Number.isInteger(port) ||
      port <= 0 ||
      port > 65_535 ||
      unexpected.length > 0 ||
      !/^\/devtools\/browser\/[A-Za-z0-9-]+$/.test(browserPath ?? "")
    ) {
      throw new RuntimeError(cdpConnectionDiagnostic("chrome"))
    }
    return `ws://127.0.0.1:${port}${browserPath}`
  }

  export function resolveBrowserLaunchTimeoutMs(explicit?: number): number {
    if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) return explicit
    const env = Number(process.env.OPENCORVUS_BROWSER_LAUNCH_TIMEOUT_MS ?? "")
    if (Number.isFinite(env) && env > 0) return env
    return DEFAULT_BROWSER_LAUNCH_TIMEOUT_MS
  }

  export async function findBrowserExecutable(override?: string): Promise<string> {
    const explicit = override ?? process.env.OPENCORVUS_BROWSER_EXECUTABLE
    if (explicit) {
      await fs.access(explicit).catch(() => {
        throw new RuntimeError({
          code: "browser_executable_not_found",
          message: `browserExecutable not found: ${explicit}`,
          checkedCandidates: [explicit],
          override: explicit,
          recoveryCommand: RECOVERY_COMMAND,
        })
      })
      return explicit
    }
    const checkedCandidates = resolveBrowserExecutableCandidates()
    for (const bin of checkedCandidates) {
      try {
        await fs.access(bin)
        return bin
      } catch {}
    }
    throw new RuntimeError({
      code: "browser_missing",
      message: "No Chrome/Edge executable found.",
      checkedCandidates,
      recoveryCommand: RECOVERY_COMMAND,
    })
  }

  export async function launchPlaywrightBrowserInNodeProcess(input: {
    headless: boolean
    executablePath?: string
    args?: string[]
    proxyServer?: string
    timeoutMs?: number
  }): Promise<any> {
    if (typeof Bun !== "undefined") {
      throw new RuntimeError({
        code: "browser_launch_failed",
        message: "Playwright browser launch must run in the Browser Node sidecar, not in a Bun process.",
        checkedCandidates: [],
        recoveryCommand: "Start browser work through the Browser Node sidecar runtime.",
      })
    }
    const executablePath = await findBrowserExecutable(input.executablePath)
    try {
      const { chromium } = await loadPlaywright()
      return await chromium.launch({
        executablePath,
        headless: input.headless,
        args: input.args ?? defaultLaunchArgs({ proxyServer: input.proxyServer }),
        timeout: resolveBrowserLaunchTimeoutMs(input.timeoutMs),
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new RuntimeError(
        {
          code: "browser_launch_failed",
          message: `BrowserRuntime launch failed for ${executablePath}: ${detail}`,
          checkedCandidates: [executablePath],
          recoveryCommand: RECOVERY_COMMAND,
        },
        { cause: error },
      )
    }
  }

  export async function connectPlaywrightBrowserOverCdpInNodeProcess(input: {
    endpointURL: string
    timeoutMs?: number
    target?: "endpoint" | "chrome"
  }): Promise<any> {
    if (typeof Bun !== "undefined") {
      throw new RuntimeError({
        code: "browser_connect_failed",
        message: "Playwright CDP connection must run in the Browser Node sidecar, not in a Bun process.",
        checkedCandidates: [],
        recoveryCommand: "Start browser work through the Browser Node sidecar runtime.",
      })
    }
    try {
      const { chromium } = await loadPlaywright()
      return await chromium.connectOverCDP(input.endpointURL, {
        timeout: resolveBrowserLaunchTimeoutMs(input.timeoutMs),
      })
    } catch (error) {
      void error
      throw new RuntimeError(cdpConnectionDiagnostic(input.target))
    }
  }

  export function resolveChromeCdpStartupTimeoutMs(explicit?: number, env: NodeJS.ProcessEnv = process.env): number {
    if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) return explicit
    const configured = Number(env.OPENCORVUS_BROWSER_CDP_STARTUP_TIMEOUT_MS ?? "")
    if (Number.isFinite(configured) && configured > 0) return configured
    return DEFAULT_CHROME_CDP_STARTUP_TIMEOUT_MS
  }

  export function managedChromeLaunchArgs(userDataDir: string): string[] {
    return [
      `--user-data-dir=${userDataDir}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
    ]
  }

  export async function tryResolveChromeCdpEndpoint(userDataDir: string): Promise<string | undefined> {
    return resolveChromeCdpEndpoint({ userDataDir }).catch(() => undefined)
  }

  /**
   * Connects to the visible Chrome that serves OpenCorvus browser work, starting
   * one in the managed profile when no DevTools endpoint is reachable yet. The
   * browser deliberately outlives this process: an attached profile keeps its
   * signed-in state and only its pages are closed on shutdown, so the next
   * connection reuses the same instance through its DevToolsActivePort file.
   */
  export async function connectPlaywrightBrowserToChromeChannelInNodeProcess(input?: {
    timeoutMs?: number
    startupTimeoutMs?: number
    userDataDir?: string
    executablePath?: string
    env?: NodeJS.ProcessEnv
  }): Promise<any> {
    if (typeof Bun !== "undefined") {
      throw new RuntimeError({
        code: "browser_connect_failed",
        message: "Playwright CDP connection must run in the Browser Node sidecar, not in a Bun process.",
        checkedCandidates: [],
        recoveryCommand: "Start browser work through the Browser Node sidecar runtime.",
      })
    }
    const env = input?.env ?? process.env
    const userDataDir = assertNonDefaultChromeUserDataDir(
      input?.userDataDir ?? resolveManagedChromeUserDataDir({ env }),
      { env },
    )
    const runningEndpoint = await tryResolveChromeCdpEndpoint(userDataDir)
    if (runningEndpoint) {
      const reused = await connectPlaywrightBrowserOverCdpInNodeProcess({
        endpointURL: runningEndpoint,
        timeoutMs: input?.timeoutMs,
        target: "chrome",
      }).catch(() => undefined)
      if (reused) return reused
    }
    const executablePath = await findBrowserExecutable(input?.executablePath)
    await fs.mkdir(userDataDir, { recursive: true })
    const child = spawn(executablePath, managedChromeLaunchArgs(userDataDir), {
      detached: true,
      stdio: "ignore",
    })
    child.unref()
    let exitCode: number | null = null
    let spawnError: string | undefined
    child.on("error", (error) => {
      spawnError = error.message
      exitCode = exitCode ?? -1
    })
    child.on("exit", (code) => {
      exitCode = code ?? 0
    })
    const deadline = Date.now() + resolveChromeCdpStartupTimeoutMs(input?.startupTimeoutMs, env)
    while (Date.now() < deadline) {
      const endpointURL = await tryResolveChromeCdpEndpoint(userDataDir)
      if (endpointURL && endpointURL !== runningEndpoint) {
        const connected = await connectPlaywrightBrowserOverCdpInNodeProcess({
          endpointURL,
          timeoutMs: input?.timeoutMs,
          target: "chrome",
        }).catch(() => undefined)
        if (connected) return connected
      }
      // A browser that hands its command line to an instance already owning the
      // profile exits at once; waiting out the full deadline would hide that.
      if (exitCode !== null) break
      await delay(100)
    }
    throw new RuntimeError(managedChromeStartupDiagnostic({ executablePath, userDataDir, exitCode, spawnError }))
  }

  export function defaultLaunchArgs(input?: {
    env?: NodeJS.ProcessEnv
    extraArgs?: readonly string[]
    proxyServer?: string
  }) {
    return uniqueCandidates([
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-remote-fonts",
      ...resolveBrowserProxyLaunchArgs({
        env: input?.env,
        proxyServer: input?.proxyServer,
      }),
      ...(input?.extraArgs ?? []),
    ])
  }

  export function resolveBrowserProxyLaunchArgs(input?: { env?: NodeJS.ProcessEnv; proxyServer?: string }): string[] {
    const env = input?.env ?? process.env
    const proxy = resolveBrowserProxyConfig({ env, proxyServer: input?.proxyServer })
    if (!proxy) return []

    const args = [`--proxy-server=${proxy.server}`]
    const bypassList = resolveBrowserProxyBypassList(env)
    if (bypassList) args.push(`--proxy-bypass-list=${bypassList}`)
    return args
  }

  export function resolveBrowserProxyConfig(input?: {
    env?: NodeJS.ProcessEnv
    proxyServer?: string
  }): BrowserProxyConfig | undefined {
    const env = input?.env ?? process.env
    const normalized = normalizeProxyServer(input?.proxyServer ?? resolveBrowserProxyServer(env))
    if (!normalized) return undefined
    const parsed = new URL(normalized)
    const proxy: BrowserProxyConfig = {
      server: `${parsed.protocol}//${parsed.host}`,
    }
    const username = decodeUrlCredential(parsed.username)
    const password = decodeUrlCredential(parsed.password)
    if (username) proxy.username = username
    if (password) proxy.password = password
    const bypass = resolveBrowserContextProxyBypassList(env)
    if (bypass) proxy.bypass = bypass
    return proxy
  }

  export function resolveBrowserProxyServer(env: NodeJS.ProcessEnv = process.env): string | undefined {
    return firstNonBlank([
      env.HTTPS_PROXY,
      env.https_proxy,
      env.HTTP_PROXY,
      env.http_proxy,
      env.ALL_PROXY,
      env.all_proxy,
    ])
  }

  export function resolveBrowserProxyBypassList(env: NodeJS.ProcessEnv = process.env): string {
    return resolveNoProxyTokens(env).join(";")
  }

  export function resolveBrowserContextProxyBypassList(env: NodeJS.ProcessEnv = process.env): string {
    return resolveNoProxyTokens(env).join(",")
  }

  export function resolveBrowserExecutableCandidates(input?: {
    envPath?: string
    homeDir?: string
    pathExt?: string
    platform?: NodeJS.Platform
    defaultCandidates?: readonly string[]
    browserCommands?: readonly string[]
  }): string[] {
    const fixedCandidates = input?.defaultCandidates ?? DEFAULT_BROWSER_CANDIDATES
    const userBinCandidates = resolveBrowserCommandsFromUserBin({
      browserCommands: input?.browserCommands,
      homeDir: input?.homeDir,
      platform: input?.platform,
    })
    const pathCandidates = resolveBrowserCommandsFromPath({
      browserCommands: input?.browserCommands,
      envPath: input?.envPath,
      pathExt: input?.pathExt,
      platform: input?.platform,
    })
    return uniqueCandidates([...fixedCandidates, ...userBinCandidates, ...pathCandidates])
  }

  export async function resolvePlaywrightEntry(): Promise<string> {
    const packaged = path.join(path.dirname(process.execPath), "node_modules", "playwright", "index.mjs")
    if (await exists(packaged)) return packaged

    if (isPackagedRuntime()) {
      throw new Error(`Packaged Playwright runtime is missing. Expected ${packaged}`)
    }

    const packageRoot = await sourcePackageRoot()
    const source = path.join(packageRoot, "node_modules", "playwright", "index.mjs")
    if (await exists(source)) return source
    throw new Error(`Source Playwright runtime is missing. Expected ${source}`)
  }

  async function loadPlaywright(): Promise<PlaywrightModule> {
    const entry = await resolvePlaywrightEntry()
    return import(pathToFileURL(entry).href) as Promise<PlaywrightModule>
  }

  async function sourcePackageRoot(): Promise<string> {
    const explicit = process.env.OPENCORVUS_BROWSER_MCP_SOURCE_PACKAGE_DIR?.trim()
    if (explicit) return explicit

    let current = import.meta.dir
    while (true) {
      if (await exists(path.join(current, "package.json"))) return current
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }

    throw new Error("Cannot resolve source package root for Playwright runtime")
  }

  function isPackagedRuntime() {
    if (process.env.OPENCORVUS_BROWSER_MCP_PACKAGED === "1") return true
    const executable = path
      .basename(process.execPath)
      .toLowerCase()
      .replace(/\.exe$/, "")
    return executable !== "bun" && executable !== "node"
  }

  async function exists(file: string) {
    return fs
      .access(file)
      .then(() => true)
      .catch(() => false)
  }

  function resolveBrowserCommandsFromPath(input?: {
    envPath?: string
    pathExt?: string
    platform?: NodeJS.Platform
    browserCommands?: readonly string[]
  }): string[] {
    const envPath = input?.envPath ?? process.env.PATH ?? ""
    if (!envPath.trim()) return []

    const platform = input?.platform ?? process.platform
    const browserCommands = input?.browserCommands ?? DEFAULT_BROWSER_COMMANDS
    const pathEntries = splitPathList(envPath, platform)
    const extensions = platform === "win32" ? windowsPathExtensions(input?.pathExt) : [""]

    const candidates: string[] = []
    for (const directory of pathEntries) {
      for (const command of browserCommands) {
        if (platform === "win32" && path.extname(command)) {
          candidates.push(path.join(directory, command))
          continue
        }
        for (const extension of extensions) {
          candidates.push(path.join(directory, `${command}${extension}`))
        }
      }
    }
    return candidates
  }

  function resolveBrowserCommandsFromUserBin(input?: {
    homeDir?: string
    platform?: NodeJS.Platform
    browserCommands?: readonly string[]
  }): string[] {
    const platform = input?.platform ?? process.platform
    if (platform !== "linux") return []

    const homeDir = input?.homeDir ?? process.env.HOME
    if (!homeDir?.trim()) return []

    const userBin = path.join(homeDir, ".local", "bin")
    const browserCommands = input?.browserCommands ?? DEFAULT_BROWSER_COMMANDS
    return browserCommands.map((command) => path.join(userBin, command))
  }

  function windowsPathExtensions(pathExt = process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM"): string[] {
    const extensions = pathExt
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
    return extensions.length ? extensions : [".EXE", ".CMD", ".BAT", ".COM"]
  }

  function pathListDelimiter(platform: NodeJS.Platform): string {
    return platform === "win32" ? ";" : ":"
  }

  function splitPathList(envPath: string, platform: NodeJS.Platform): string[] {
    const trimmed = envPath.trim()
    if (!trimmed) return []
    if (platform !== "win32" && /(^|;)[A-Za-z]:[\\/]/.test(trimmed)) {
      return trimmed.split(";").filter(Boolean)
    }
    return trimmed.split(pathListDelimiter(platform)).filter(Boolean)
  }

  function normalizeProxyServer(value: string | undefined): string | undefined {
    const trimmed = value?.trim()
    if (!trimmed) return undefined
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed
    return `http://${trimmed}`
  }

  function resolveNoProxyTokens(env: NodeJS.ProcessEnv): string[] {
    const noProxy = firstNonBlank([env.NO_PROXY, env.no_proxy])
    return noProxy
      ? noProxy
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : ["localhost", "127.0.0.1", "::1", "*.local"]
  }

  function decodeUrlCredential(value: string): string | undefined {
    if (!value) return undefined
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  function firstNonBlank(values: readonly (string | undefined)[]): string | undefined {
    for (const value of values) {
      const trimmed = value?.trim()
      if (trimmed) return trimmed
    }
    return undefined
  }

  function uniqueCandidates(candidates: readonly string[]): string[] {
    return [...new Set(candidates)]
  }
}

export const findBrowserExecutable = BrowserRuntime.findBrowserExecutable
