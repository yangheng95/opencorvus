import {
  ProcessDeadlineExceededError,
  ProcessInactivityTimeoutError,
  ProcessOutputLimitError,
  ProcessRunFailedError as SharedProcessRunFailedError,
  type ProcessHandle,
  type ProcessByteSink,
  type ProcessByteSource,
  type ProcessRunRequest,
} from "@opencorvus-ai/util/process"
import { NodeProcess } from "@opencorvus-ai/util/process-node"
import { normalizeExecutableArgv } from "./command"
import { supervisedHostProcessFacade, supervisedTaskProcessFacade } from "./process-facade"

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

  export interface RunOptions extends Omit<Options, "stdout" | "stderr" | "ownership"> {
    /** Stable process-supervisor owner used for diagnostic attribution and ownership observability. */
    owner?: string
    nothrow?: boolean
    inactivityTimeoutMs?: number
    inactivityTimeoutMessage?: string
    /** Hard wall-clock limit independent of stdout/stderr activity. */
    timeoutMs?: number
    /** Maximum combined stdout and stderr bytes retained in memory. */
    maxOutputBytes?: number
    /** Binary standard-input chunks written with backpressure through the owned supervisor handle. */
    input?: AsyncIterable<Uint8Array>
    /** Observes the successful creation of the supervised child process. */
    onSpawned?: () => void
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

  export async function readBytes(source: ProcessByteSource | null): Promise<Buffer> {
    if (!source) return Buffer.alloc(0)
    const chunks: Buffer[] = []
    for await (const chunk of source) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks)
  }

  export async function readText(source: ProcessByteSource | null): Promise<string> {
    return (await readBytes(source)).toString("utf8")
  }

  export interface Child {
    readonly occurrenceID: string
    readonly pid: number
    readonly stdin: ProcessByteSink | null
    readonly stdout: ProcessByteSource | null
    readonly stderr: ProcessByteSource | null
    readonly exited: Promise<number>
    terminate(): Promise<void>
    unref(): void
  }

  function environment(opts: Pick<Options, "env" | "exactEnv">, label: string): NodeJS.ProcessEnv | undefined {
    if (opts.exactEnv && opts.env !== undefined) throw new Error(`${label} accepts exactly one of env or exactEnv`)
    return opts.exactEnv ?? (opts.env === null ? {} : opts.env ? { ...process.env, ...opts.env } : undefined)
  }

  function child(handle: ProcessHandle): Child {
    return {
      occurrenceID: handle.occurrenceID,
      pid: handle.pid,
      stdin: handle.stdin,
      stdout: handle.stdout,
      stderr: handle.stderr,
      exited: handle.terminal.then((receipt) => receipt.exitCode ?? (receipt.signal ? 1 : 0)),
      async terminate() {
        await handle.terminate()
      },
      unref: () => handle.unref(),
    }
  }

  export async function spawnHost(cmd: string[], opts: Options = {}): Promise<Child> {
    if (cmd.length === 0) throw new Error("Command is required")
    const command = normalizeExecutableArgv(cmd)
    const exactEnvironment = environment(opts, "Process.spawnHost")
    const facade = opts.ownership === "process" ? NodeProcess : supervisedHostProcessFacade("process:spawn-host")
    const handle = await facade.spawn({
      command: { executable: command[0]!, args: command.slice(1) },
      cwd: opts.cwd,
      env: exactEnvironment,
      stdin: opts.stdin === "pipe" ? "pipe" : "ignore",
      stdout: opts.stdout,
      stderr: opts.stderr,
      signal: opts.abort,
      ownership: opts.ownership === "process" ? "owned_process" : "owned_tree",
    })
    return child(handle)
  }

  function runRequest(cmd: string[], opts: RunOptions): ProcessRunRequest {
    const command = normalizeExecutableArgv(cmd)
    return {
      command: { executable: command[0]!, args: command.slice(1) },
      cwd: opts.cwd,
      env: environment(opts, "Process.run"),
      stdin: opts.stdin === "pipe" ? "pipe" : "ignore",
      signal: opts.abort,
      input: opts.input,
      nothrow: opts.nothrow,
      inactivityTimeoutMs: opts.inactivityTimeoutMs,
      inactivityTimeoutMessage: opts.inactivityTimeoutMessage,
      timeoutMs: opts.timeoutMs,
      maxOutputBytes: opts.maxOutputBytes,
      onSpawned: opts.onSpawned,
      ownership: "owned_tree",
    }
  }

  async function runWithFacade(
    cmd: string[],
    opts: RunOptions,
    facade: ReturnType<typeof supervisedHostProcessFacade>,
  ): Promise<Result> {
    try {
      const result = await facade.run(runRequest(cmd, opts))
      return {
        code: result.receipt.exitCode ?? (result.receipt.signal ? 1 : 0),
        stdout: Buffer.from(result.stdout),
        stderr: Buffer.from(result.stderr),
      }
    } catch (error) {
      if (error instanceof SharedProcessRunFailedError) {
        throw new RunFailedError(cmd, error.receipt.exitCode ?? 1, Buffer.from(error.stdout), Buffer.from(error.stderr))
      }
      if (error instanceof ProcessInactivityTimeoutError) {
        const resultStderr = Buffer.from(error.result.stderr)
        const separator = resultStderr.length > 0 && !resultStderr.toString().endsWith("\n") ? "\n" : ""
        const stderr = Buffer.concat([resultStderr, Buffer.from(`${separator}${error.message}`)])
        const code =
          error.result.receipt.exitCode && error.result.receipt.exitCode !== 0 ? error.result.receipt.exitCode : 1
        if (opts.nothrow) return { code, stdout: Buffer.from(error.result.stdout), stderr }
        throw new RunFailedError(cmd, code, Buffer.from(error.result.stdout), stderr)
      }
      if (error instanceof ProcessDeadlineExceededError) {
        throw new Error(`Process timed out after ${opts.timeoutMs}ms: ${cmd.join(" ")}`, { cause: error })
      }
      if (error instanceof ProcessOutputLimitError) {
        throw new Error(`Process output exceeded ${opts.maxOutputBytes} bytes: ${cmd.join(" ")}`, { cause: error })
      }
      throw error
    }
  }

  export function runHost(cmd: string[], opts: RunOptions = {}): Promise<Result> {
    return runWithFacade(cmd, opts, supervisedHostProcessFacade(opts.owner?.trim() || "process:run-host"))
  }

  export function runTask(
    identity: Readonly<{ taskID: string; cwd: string }>,
    cmd: string[],
    opts: Omit<RunOptions, "cwd"> = {},
  ): Promise<Result> {
    return runWithFacade(
      cmd,
      { ...opts, cwd: identity.cwd },
      supervisedTaskProcessFacade(identity, opts.owner?.trim() || "process:run-task"),
    )
  }
}
