import {
  ProcessAbortedError,
  ProcessExecutionError,
  ProcessDeadlineExceededError,
  ProcessInactivityTimeoutError,
  ProcessOutputObserverError,
  ProcessOutputLimitError,
  type ProcessRunResult,
} from "@opencorvus-ai/util/process"
import { supervisedHostProcessFacade, supervisedTaskProcessFacade } from "@/util/process-facade"
import type { ProcessSupervisor } from "./process-supervisor"

export type CommandInactivityResult = {
  exitCode: number | undefined
  stdout: string
  stderr: string
  stdoutBytes: Uint8Array
  stderrBytes: Uint8Array
  /** True only when the facade returned a complete physical/output receipt. */
  settlementConfirmed: boolean
  failure?: { kind: "deadline" | "inactivity" | "spawn" | "output" | "exit"; message: string }
}
type CommandInactivityInput = {
  executable: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  inactivityTimeoutMs: number
  deadlineAt?: number
  onStdout?: (chunk: Buffer) => void
  onStderr?: (chunk: Buffer) => void
}
export function runHostCommandWithInactivity(input: CommandInactivityInput): Promise<CommandInactivityResult> {
  return runCommand(input, supervisedHostProcessFacade("inactivity-command", false))
}
export function runTaskCommandWithInactivity(
  identity: ProcessSupervisor.TaskProcessIdentity,
  input: Omit<CommandInactivityInput, "cwd">,
): Promise<CommandInactivityResult> {
  return runCommand({ ...input, cwd: identity.cwd }, supervisedTaskProcessFacade(identity, "inactivity-command"))
}
function failures(error: unknown): unknown[] {
  if (error instanceof ProcessExecutionError) return failures(error.cause)
  return error instanceof AggregateError ? error.errors.flatMap(failures) : [error]
}
async function runCommand(
  input: CommandInactivityInput,
  facade: ReturnType<typeof supervisedHostProcessFacade>,
): Promise<CommandInactivityResult> {
  if (!Number.isSafeInteger(input.inactivityTimeoutMs) || input.inactivityTimeoutMs <= 0)
    throw new Error("Command inactivity timeout must be a positive safe integer")
  const project = (
    result: ProcessRunResult | undefined,
    settlementConfirmed: boolean,
    failure?: CommandInactivityResult["failure"],
  ): CommandInactivityResult => {
    const stdoutBytes = result?.stdout ?? new Uint8Array()
    const stderrBytes = result?.stderr ?? new Uint8Array()
    return {
      exitCode: failure ? undefined : (result?.receipt.exitCode ?? undefined),
      stdout: new TextDecoder().decode(stdoutBytes),
      stderr: new TextDecoder().decode(stderrBytes),
      stdoutBytes,
      stderrBytes,
      settlementConfirmed,
      ...(failure ? { failure } : {}),
    }
  }
  try {
    return project(
      await facade.run({
        command: { executable: input.executable, args: input.args },
        cwd: input.cwd,
        env: input.env,
        deadlineAt: input.deadlineAt,
        inactivityTimeoutMs: input.inactivityTimeoutMs,
        inactivityTimeoutMessage: `Command produced no stdout/stderr activity for ${input.inactivityTimeoutMs}ms`,
        nothrow: true,
        onStdout: input.onStdout && ((chunk) => input.onStdout!(Buffer.from(chunk))),
        onStderr: input.onStderr && ((chunk) => input.onStderr!(Buffer.from(chunk))),
      }),
      true,
    )
  } catch (error) {
    const errors = failures(error)
    const primary = errors[0]
    const controlled = errors.find(
      (value) =>
        value instanceof ProcessDeadlineExceededError ||
        value instanceof ProcessInactivityTimeoutError ||
        value instanceof ProcessOutputObserverError ||
        value instanceof ProcessOutputLimitError ||
        value instanceof ProcessAbortedError,
    )
    const result = controlled?.result
    const observed = error instanceof ProcessExecutionError ? error : undefined
    const kind =
      primary instanceof ProcessDeadlineExceededError
        ? "deadline"
        : primary instanceof ProcessInactivityTimeoutError
          ? "inactivity"
          : primary instanceof ProcessOutputObserverError ||
              primary instanceof ProcessOutputLimitError ||
              observed?.stage === "output"
            ? "output"
            : result || observed
              ? "exit"
              : "spawn"
    const projected = project(result, observed === undefined && result !== undefined && errors.length === 1, {
      kind,
      message: errors.map((value) => (value instanceof Error ? value.message : String(value))).join("; "),
    })
    if (observed)
      return {
        ...projected,
        stdoutBytes: observed.stdout,
        stderrBytes: observed.stderr,
        stdout: new TextDecoder().decode(observed.stdout),
        stderr: new TextDecoder().decode(observed.stderr),
      }
    return projected
  }
}
