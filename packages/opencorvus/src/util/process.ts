import { spawn as launch, type ChildProcess } from "child_process"
import { normalizeExecutableArgv } from "./command"
import { ProcessSupervisor } from "@/shell/process-supervisor"

const PROCESS_CLOSE_TIMEOUT_MS = 5_000
const PROCESS_TERMINATE_GRACE_MS = 1_000

export namespace Process {
  export type Stdio = "inherit" | "pipe" | "ignore"

  export interface Options {
    cwd?: string
    env?: NodeJS.ProcessEnv | null
    stdin?: Stdio
    stdout?: Stdio
    stderr?: Stdio
    abort?: AbortSignal
    ownership?: "process" | "process-group"
    /** Exact child environment. Mutually exclusive with env; never merged with process.env. */
    exactEnv?: NodeJS.ProcessEnv
  }

  export interface RunOptions extends Omit<Options, "stdout" | "stderr"> {
    nothrow?: boolean
    inactivityTimeoutMs?: number
    inactivityTimeoutMessage?: string
  }

  export interface Result {
    code: number
    stdout: Buffer
    stderr: Buffer
  }

  export class RunFailedError extends Error {
    readonly cmd: string[]
    readonly code: number
    readonly stdout: Buffer
    readonly stderr: Buffer

    constructor(cmd: string[], code: number, stdout: Buffer, stderr: Buffer) {
      const text = stderr.toString().trim()
      super(
        text
          ? `Command failed with code ${code}: ${cmd.join(" ")}\n${text}`
          : `Command failed with code ${code}: ${cmd.join(" ")}`,
      )
      this.name = "ProcessRunFailedError"
      this.cmd = [...cmd]
      this.code = code
      this.stdout = stdout
      this.stderr = stderr
    }
  }

  export type Child = ChildProcess & {
    exited: Promise<number>
    terminate(): Promise<void>
  }

  function collectOutput(stream: NodeJS.ReadableStream, onActivity: () => void): Promise<Buffer> {
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        onActivity()
      })
      stream.once("end", () => resolve(Buffer.concat(chunks)))
      stream.once("error", reject)
      const existingError = (stream as NodeJS.ReadableStream & { errored?: Error | null }).errored
      if (existingError) reject(existingError)
    })
  }

  async function terminateOwnedProcess(proc: ChildProcess, exited: Promise<number>, command: string[]) {
    if (proc.exitCode === null && proc.signalCode === null) proc.kill("SIGTERM")
    try {
      await ProcessSupervisor.awaitWithTimeout(
        exited,
        PROCESS_TERMINATE_GRACE_MS,
        `Process did not exit after SIGTERM: ${command.join(" ")}`,
      )
    } catch (error) {
      if (proc.exitCode !== null || proc.signalCode !== null) throw error
      proc.kill("SIGKILL")
      await ProcessSupervisor.awaitWithTimeout(
        exited,
        PROCESS_CLOSE_TIMEOUT_MS,
        `Process did not close after SIGKILL: ${command.join(" ")}`,
      )
    }
  }

  export function spawnHost(cmd: string[], opts: Options = {}): Child {
    if (cmd.length === 0) throw new Error("Command is required")
    if (opts.exactEnv && opts.env !== undefined) {
      throw new Error("Process.spawnHost accepts exactly one of env or exactEnv")
    }
    opts.abort?.throwIfAborted()
    const command = normalizeExecutableArgv(cmd)

    const proc = launch(command[0], command.slice(1), {
      cwd: opts.cwd,
      env: opts.exactEnv ?? (opts.env === null ? {} : opts.env ? { ...process.env, ...opts.env } : undefined),
      stdio: [opts.stdin ?? "ignore", opts.stdout ?? "ignore", opts.stderr ?? "ignore"],
      detached: process.platform !== "win32" && opts.ownership !== "process",
    })

    let termination: Promise<void> | undefined
    let rejectExited: ((error: Error) => void) | undefined
    let closed = false
    let exited: Promise<number>

    const terminate = () => {
      if (termination) return termination
      if (closed) return Promise.resolve()
      if (!proc.pid) throw new Error(`Process tree termination requires a process id: ${command.join(" ")}`)
      const cleanup =
        opts.ownership === "process"
          ? terminateOwnedProcess(proc, exited, command)
          : process.platform === "win32"
            ? ProcessSupervisor.terminateProcessTree(proc.pid, `process tree ${command.join(" ")}`)
            : ProcessSupervisor.terminateProcessGroup(proc.pid, `process group ${command.join(" ")}`)
      termination = cleanup
        .then(() =>
          ProcessSupervisor.awaitWithTimeout(
            exited,
            PROCESS_CLOSE_TIMEOUT_MS,
            `Process did not close after tree cleanup: ${command.join(" ")}`,
          ),
        )
        .then(() => undefined)
        .catch((error) => {
          const failure = error instanceof Error ? error : new Error(String(error))
          if (!closed) rejectExited?.(failure)
          throw failure
        })
      return termination
    }

    const abort = () => {
      try {
        void terminate().catch(() => undefined)
      } catch {
        // The owning caller observes termination failures through explicit terminate() calls.
      }
    }

    exited = new Promise<number>((resolve, reject) => {
      rejectExited = (error) => {
        done()
        reject(error)
      }
      const done = () => {
        opts.abort?.removeEventListener("abort", abort)
      }

      proc.once("close", (code, signal) => {
        closed = true
        done()
        resolve(code ?? (signal ? 1 : 0))
      })

      proc.once("error", (error) => {
        done()
        reject(error)
      })
    })

    if (opts.abort) {
      opts.abort.addEventListener("abort", abort, { once: true })
      if (opts.abort.aborted) abort()
    }

    const child = proc as Child
    child.exited = exited
    child.terminate = terminate
    return child
  }

  type CommandSpawner = (
    opts: ProcessSupervisor.CommandSpawnOptions,
  ) => Promise<ProcessSupervisor.Handle>

  async function runWithSpawner(
    cmd: string[],
    opts: RunOptions,
    spawnCommand: CommandSpawner,
  ): Promise<Result> {
    if (opts.exactEnv && opts.env !== undefined) {
      throw new Error("Process.run accepts exactly one of env or exactEnv")
    }
    const command = normalizeExecutableArgv(cmd)
    const handle = await spawnCommand({
      executable: command[0]!,
      args: command.slice(1),
      cwd: opts.cwd,
      env: opts.exactEnv ?? (opts.env === null ? {} : opts.env ? { ...process.env, ...opts.env } : undefined),
      stdin: opts.stdin === "pipe" ? "pipe" : "ignore",
    })

    if (!handle.stdout || !handle.stderr) throw new Error("Process output not available")

    let terminationPromise: Promise<number> | undefined
    let resolveTerminationRequested: ((promise: Promise<number>) => void) | undefined
    const terminationRequested = new Promise<Promise<number>>((resolve) => {
      resolveTerminationRequested = resolve
    })
    const requestTermination = () => {
      if (!terminationPromise) {
        terminationPromise = ProcessSupervisor.terminateAndWaitForExit(handle, `Process.run ${command.join(" ")}`)
        terminationPromise.catch(() => undefined)
        resolveTerminationRequested?.(terminationPromise)
      }
      return terminationPromise
    }
    const abort = () => {
      requestTermination()
    }

    if (opts.abort) {
      opts.abort.addEventListener("abort", abort, { once: true })
      if (opts.abort.aborted) abort()
    }

    let code: number
    let stdout: Buffer
    let stderr: Buffer
    let inactivityTimedOut = false
    let inactivityTimer: ReturnType<typeof setTimeout> | undefined
    const inactivityTimeoutMessage =
      opts.inactivityTimeoutMessage ??
      `Process.run ${command.join(" ")} timed out after ${opts.inactivityTimeoutMs}ms without stdout/stderr activity`
    const clearInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      inactivityTimer = undefined
    }
    const refreshInactivityTimer = () => {
      if (opts.inactivityTimeoutMs === undefined || inactivityTimedOut) return
      clearInactivityTimer()
      inactivityTimer = setTimeout(() => {
        inactivityTimedOut = true
        clearInactivityTimer()
        requestTermination()
      }, opts.inactivityTimeoutMs)
      inactivityTimer.unref?.()
    }
    const onOutputActivity = () => refreshInactivityTimer()
    const stdoutBuffered = collectOutput(handle.stdout, onOutputActivity)
    const stderrBuffered = collectOutput(handle.stderr, onOutputActivity)
    if (opts.inactivityTimeoutMs !== undefined) {
      refreshInactivityTimer()
    }
    const processCompleted = Promise.all([handle.exited, stdoutBuffered, stderrBuffered])
    const terminationCompleted = terminationRequested.then(async (cleanup) => {
      const terminatedCode = await cleanup
      const [terminatedStdout, terminatedStderr] = await Promise.all([stdoutBuffered, stderrBuffered])
      return [terminatedCode, terminatedStdout, terminatedStderr] as const
    })
    let primaryError: unknown
    try {
      ;[code, stdout, stderr] = await Promise.race([processCompleted, terminationCompleted])
      if (terminationPromise) code = await terminationPromise
    } catch (error) {
      primaryError = error
      throw error
    } finally {
      clearInactivityTimer()
      opts.abort?.removeEventListener("abort", abort)
      try {
        await ProcessSupervisor.disposeAndWaitForExit(handle, "Process.run")
      } catch (error) {
        if (primaryError) {
          throw ProcessSupervisor.combineFailures("Process.run execution and disposal failed", [primaryError, error])
        }
        throw error
      }
    }
    if (inactivityTimedOut) {
      code = code === 0 ? 1 : code
      const separator = stderr.length > 0 && !stderr.toString().endsWith("\n") ? "\n" : ""
      stderr = Buffer.concat([stderr, Buffer.from(`${separator}${inactivityTimeoutMessage}`)])
    }
    const out = {
      code,
      stdout,
      stderr,
    }
    if (out.code === 0 || opts.nothrow) return out
    throw new RunFailedError(command, out.code, out.stdout, out.stderr)
  }

  export function runHost(cmd: string[], opts: RunOptions = {}): Promise<Result> {
    return runWithSpawner(cmd, opts, ProcessSupervisor.spawnHostCommand)
  }

  export function runTask(
    identity: ProcessSupervisor.TaskProcessIdentity,
    cmd: string[],
    opts: Omit<RunOptions, "cwd"> = {},
  ): Promise<Result> {
    return runWithSpawner(
      cmd,
      { ...opts, cwd: identity.cwd },
      (spawnOptions) => {
        const { cwd: _cwd, ...taskOptions } = spawnOptions
        return ProcessSupervisor.spawnTaskCommand(identity, taskOptions)
      },
    )
  }
}
