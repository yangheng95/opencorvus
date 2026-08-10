import { Flag } from "@/flag/flag"
import { lazy } from "@/util/lazy"
import { Filesystem } from "@/util/filesystem"
import path from "path"
import { which } from "@/util/which"
import { PidGuard } from "./pid-guard"
import { ProcessSupervisor } from "./process-supervisor"

export namespace Shell {
  export interface RunOptions {
    cwd?: string
    env?: NodeJS.ProcessEnv
    /** Hard wall-clock timeout (ms). Process killed after this regardless of activity. */
    timeoutMs?: number
    abort?: AbortSignal
  }

  export interface RunResult {
    exitCode: number
    stdout: string
    stderr: string
    /** Exact child-process bytes, preserved across arbitrary UTF-8 chunk boundaries. */
    stdoutBytes: Uint8Array
    stderrBytes: Uint8Array
    /** True when hard wall-clock timeoutMs was reached. */
    timedOut: boolean
    aborted: boolean
    /** Diagnostic PID of the supervised shell root. Cleanup is owned by the
     * process supervisor, not by later PID-tree commands. */
    pid?: number
  }

  function firstExisting(paths: Array<string | null | undefined>) {
    for (const item of paths) {
      if (!item) continue
      if (Filesystem.stat(item)?.size) return item
    }
  }

  function gitBashCandidates() {
    const fromGit = (() => {
      const git = which("git")
      if (!git) return []
      const gitDir = path.dirname(git)
      return [path.resolve(gitDir, "..", "bin", "bash.exe"), path.resolve(gitDir, "..", "usr", "bin", "bash.exe")]
    })()

    const installRoots = [
      process.env.ProgramW6432,
      process.env.ProgramFiles,
      process.env["ProgramFiles(x86)"],
      process.env.LocalAppData,
      process.env.ChocolateyInstall,
    ].filter((value): value is string => Boolean(value))

    const fromCommonInstalls = installRoots.flatMap((root) => [
      path.join(root, "Git", "bin", "bash.exe"),
      path.join(root, "Git", "usr", "bin", "bash.exe"),
    ])

    const genericBash = [which("bash.exe"), which("bash")].filter((item): item is string => {
      if (!item) return false
      return !item.toLowerCase().endsWith("\\windows\\system32\\bash.exe")
    })

    return [...fromGit, ...fromCommonInstalls, ...genericBash]
  }

  type ShellSpawner = (options: ProcessSupervisor.SpawnOptions) => Promise<ProcessSupervisor.Handle>

  async function runWithSpawner(command: string, opts: RunOptions, spawnShell: ShellSpawner): Promise<RunResult> {
    const shell = acceptable()
    const guardEnv = await PidGuard.env(shell)
    const supervisor = await spawnShell({
      command,
      shell,
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env, ...guardEnv },
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    let timedOut = false
    let aborted = false

    let terminationPromise: Promise<number> | undefined
    let resolveTerminationRequested: ((promise: Promise<number>) => void) | undefined
    const terminationRequested = new Promise<Promise<number>>((resolve) => {
      resolveTerminationRequested = resolve
    })
    const requestTermination = (reason: string) => {
      if (!terminationPromise) {
        terminationPromise = ProcessSupervisor.terminateAndWaitForExit(supervisor, `Shell.run ${reason}`)
        terminationPromise.catch(() => undefined)
        resolveTerminationRequested?.(terminationPromise)
      }
      return terminationPromise
    }

    supervisor.stdout?.on("data", (chunk) => {
      stdoutChunks.push(Buffer.from(chunk))
    })
    supervisor.stderr?.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk))
    })

    if (opts.abort?.aborted) {
      aborted = true
      requestTermination("abort")
    }

    const abortHandler = () => {
      aborted = true
      requestTermination("abort")
    }
    opts.abort?.addEventListener("abort", abortHandler, { once: true })

    const timeoutMs = typeof opts.timeoutMs === "number" && Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : undefined
    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true
            requestTermination("timeout")
          }, timeoutMs)
        : undefined
    timer?.unref?.()

    let primaryError: unknown
    try {
      const exitCode = await Promise.race([supervisor.exited, terminationRequested.then((cleanup) => cleanup)])
      if (terminationPromise) {
        await terminationPromise
      }
      await supervisor.outputSettled
      const stdoutBytes = Buffer.concat(stdoutChunks)
      const stderrBytes = Buffer.concat(stderrChunks)
      return {
        exitCode,
        stdout: stdoutBytes.toString("utf8"),
        stderr: stderrBytes.toString("utf8"),
        stdoutBytes,
        stderrBytes,
        timedOut,
        aborted,
        pid: supervisor.pid,
      }
    } catch (error) {
      primaryError = error
      throw error
    } finally {
      if (timer) clearTimeout(timer)
      opts.abort?.removeEventListener("abort", abortHandler)
      try {
        await ProcessSupervisor.disposeAndWaitForExit(supervisor, "Shell.run")
      } catch (error) {
        if (primaryError) {
          throw ProcessSupervisor.combineFailures("Shell.run execution and disposal failed", [primaryError, error])
        }
        throw error
      }
    }
  }

  export function runHost(command: string, opts: RunOptions = {}): Promise<RunResult> {
    return runWithSpawner(command, opts, ProcessSupervisor.spawnHostShell)
  }

  export function runTask(
    identity: ProcessSupervisor.TaskProcessIdentity,
    command: string,
    opts: Omit<RunOptions, "cwd"> = {},
  ): Promise<RunResult> {
    return runWithSpawner(command, { ...opts, cwd: identity.cwd }, (spawnOptions) => {
      const { cwd: _cwd, ...taskOptions } = spawnOptions
      return ProcessSupervisor.spawnTaskShell(identity, taskOptions)
    })
  }

  export interface LaunchResult {
    pid: number
    address?: string
    initialOutput: string
    exited: Promise<void>
  }

  /**
   * Launch a long-running process in the background.
   *
   * Spawns the process, collects initial output for `outputSniffMs` to detect
   * the address/port, then unrefs the supervisor so it keeps running under the
   * same ownership boundary. Returns the diagnostic PID and detected address.
   */
  export interface LaunchOptions {
    cwd?: string
    env?: NodeJS.ProcessEnv
    outputSniffMs?: number
    leaseMs?: number
    abort?: AbortSignal
  }

  async function launchWithSpawner(
    command: string,
    opts: LaunchOptions,
    spawnShell: ShellSpawner,
  ): Promise<LaunchResult> {
    const { cwd, env, outputSniffMs = 8000, leaseMs } = opts
    const shell = acceptable()
    const guardEnv = await PidGuard.env(shell)
    const supervisor = await spawnShell({
      command,
      shell,
      cwd,
      env: { ...process.env, ...env, ...guardEnv },
    })

    let initialOutput = ""
    let processSettled = false
    let finishSniff: (() => void) | undefined
    supervisor.stdout?.on("data", (chunk: Buffer) => {
      initialOutput += chunk.toString()
    })
    supervisor.stderr?.on("data", (chunk: Buffer) => {
      initialOutput += chunk.toString()
    })
    const processOutcome = supervisor.exited.then(
      (code) => {
        processSettled = true
        finishSniff?.()
        return { code } as const
      },
      (error) => {
        processSettled = true
        finishSniff?.()
        return { error } as const
      },
    )

    let disposePromise: Promise<number> | undefined
    let disposeReason: string | undefined
    let resolveDisposeRequested: (() => void) | undefined
    const disposeRequested = new Promise<void>((resolve) => {
      resolveDisposeRequested = resolve
    })
    const requestDispose = (reason: string) => {
      if (!disposePromise) {
        disposeReason = reason
        disposePromise = ProcessSupervisor.disposeAndWaitForExit(supervisor, `Shell.launch ${reason}`)
        void disposePromise.catch(() => undefined)
        resolveDisposeRequested?.()
      }
      return disposePromise
    }

    let aborted = false
    const abortHandler = () => {
      aborted = true
      requestDispose("abort")
      finishSniff?.()
    }
    opts.abort?.addEventListener("abort", abortHandler, { once: true })
    if (opts.abort?.aborted) abortHandler()

    await new Promise<void>((resolve) => {
      let finished = false
      const timer = setTimeout(() => finishSniff?.(), outputSniffMs)
      const done = () => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        resolve()
      }
      finishSniff = done
      if (processSettled || aborted) done()
    })
    finishSniff = undefined

    const throwAfterDispose = async (primary: unknown, reason: string): Promise<never> => {
      try {
        await requestDispose(reason)
      } catch (cleanupError) {
        throw ProcessSupervisor.combineFailures(`Shell.launch ${reason} and disposal failed`, [primary, cleanupError])
      }
      throw primary
    }

    if (aborted) {
      opts.abort?.removeEventListener("abort", abortHandler)
      await throwAfterDispose(new Error(`Process launch aborted. Output:\n${initialOutput.slice(0, 1000)}`), "abort")
    }

    if (processSettled) {
      opts.abort?.removeEventListener("abort", abortHandler)
      const outcome = await processOutcome
      const immediate = new Error(`Process exited immediately after launch. Output:\n${initialOutput.slice(0, 1000)}`)
      const primary =
        "error" in outcome
          ? ProcessSupervisor.combineFailures("Shell.launch process failed immediately", [immediate, outcome.error])
          : immediate
      await throwAfterDispose(primary, "immediate exit")
    }

    const leaseTimer =
      typeof leaseMs === "number" && Number.isFinite(leaseMs) && leaseMs > 0
        ? setTimeout(() => {
            requestDispose("lease timeout")
          }, leaseMs)
        : undefined
    leaseTimer?.unref?.()
    const lifecyclePromise = (async () => {
      await Promise.race([processOutcome.then(() => undefined), disposeRequested])
      await requestDispose(disposeReason ?? "natural exit")
    })().finally(() => {
      if (leaseTimer) clearTimeout(leaseTimer)
      opts.abort?.removeEventListener("abort", abortHandler)
    })
    void lifecyclePromise.catch(() => undefined)
    supervisor.unref()

    const address = detectLaunchAddress(initialOutput)
    return { pid: supervisor.pid, address, initialOutput: initialOutput.slice(0, 2000), exited: lifecyclePromise }
  }

  export function launchHost(command: string, opts: LaunchOptions = {}): Promise<LaunchResult> {
    return launchWithSpawner(command, opts, ProcessSupervisor.spawnHostShell)
  }

  export function launchTask(
    identity: ProcessSupervisor.TaskProcessIdentity,
    command: string,
    opts: Omit<LaunchOptions, "cwd"> = {},
  ): Promise<LaunchResult> {
    return launchWithSpawner(command, { ...opts, cwd: identity.cwd }, (spawnOptions) => {
      const { cwd: _cwd, ...taskOptions } = spawnOptions
      return ProcessSupervisor.spawnTaskShell(identity, taskOptions)
    })
  }

  function detectLaunchAddress(output: string): string | undefined {
    const urlMatch = output.match(/https?:\/\/[^\s\n"'><,]+/)
    if (urlMatch) return urlMatch[0].replace(/\/$/, "")
    const hostPortMatch = output.match(/(?:localhost|0\.0\.0\.0|127\.0\.0\.1):\d{2,5}/)
    if (hostPortMatch) return `http://${hostPortMatch[0]}`
  }

  const BLACKLIST = new Set(["fish", "nu"])

  function platformDefault() {
    if (process.platform === "win32") {
      const bash = firstExisting([Flag.OPENCORVUS_GIT_BASH_PATH, ...gitBashCandidates()])
      if (bash) return bash
      return process.env.COMSPEC || "cmd.exe"
    }
    if (process.platform === "darwin") {
      const zsh = which("zsh")
      if (zsh) return zsh
      return "/bin/zsh"
    }
    const bash = which("bash")
    if (bash) return bash
    const sh = which("sh")
    if (sh) return sh
    return "/bin/sh"
  }

  export function fromEnv(shell: string | undefined, platform: NodeJS.Platform): string | undefined {
    if (!shell) return undefined
    if (platform === "win32") {
      const base = path.win32.basename(shell).toLowerCase()
      if (base === "powershell.exe" || base === "pwsh.exe" || base === "cmd.exe") return undefined
    }
    return shell
  }

  export const preferred = lazy(() => {
    const s = fromEnv(process.env.SHELL, process.platform)
    if (s) return s
    return platformDefault()
  })

  export const acceptable = lazy(() => {
    const s = fromEnv(process.env.SHELL, process.platform)
    if (s && !BLACKLIST.has(process.platform === "win32" ? path.win32.basename(s) : path.basename(s))) return s
    return platformDefault()
  })
}
