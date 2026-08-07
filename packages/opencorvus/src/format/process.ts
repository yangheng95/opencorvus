import { Process } from "@/util/process"
import type { ProcessSupervisor } from "@/shell/process-supervisor"

export const DEFAULT_FORMATTER_TIMEOUT_MS = 30_000
const MAX_CAPTURED_OUTPUT_BYTES = 64 * 1024

export function formatterTimeout(timeout: number | undefined) {
  return timeout ?? DEFAULT_FORMATTER_TIMEOUT_MS
}

export interface FormatterProcessResult {
  exitCode: number
  stdout: string
  stderr: string
}

export type FormatterProcessAuthority =
  | Readonly<{ kind: "host"; cwd: string }>
  | Readonly<{ kind: "task"; taskID: string; cwd: string }>

type FormatterProcessInput = {
  command: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  timeoutMs: number
  captureOutput?: boolean
}

function validate(input: FormatterProcessInput) {
  if (!input.command[0]) throw new Error("Formatter command must include an executable")
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs <= 0) {
    throw new Error(`Formatter inactivity timeout must be a positive integer, received ${input.timeoutMs}`)
  }
}

function capture(value: Buffer, enabled: boolean | undefined) {
  return enabled ? value.subarray(0, MAX_CAPTURED_OUTPUT_BYTES).toString() : ""
}

async function run(
  input: FormatterProcessInput,
  execute: (command: string[], options: Process.RunOptions) => Promise<Process.Result>,
): Promise<FormatterProcessResult> {
  validate(input)
  const result = await execute(input.command, {
    cwd: input.cwd,
    env: input.env,
    stdin: "ignore",
    nothrow: true,
    inactivityTimeoutMs: input.timeoutMs,
    inactivityTimeoutMessage: `Formatter command ${input.command.join(" ")} was inactive for ${input.timeoutMs}ms`,
  })
  return {
    exitCode: result.code,
    stdout: capture(result.stdout, input.captureOutput),
    stderr: capture(result.stderr, input.captureOutput),
  }
}

export function runHostFormatterProcess(input: FormatterProcessInput): Promise<FormatterProcessResult> {
  return run(input, Process.runHost)
}

export function runTaskFormatterProcess(
  identity: ProcessSupervisor.TaskProcessIdentity,
  input: Omit<FormatterProcessInput, "cwd">,
): Promise<FormatterProcessResult> {
  return run({ ...input, cwd: identity.cwd }, (command, options) => Process.runTask(identity, command, options))
}

export function runFormatterProcess(
  authority: FormatterProcessAuthority,
  input: Omit<FormatterProcessInput, "cwd">,
): Promise<FormatterProcessResult> {
  return authority.kind === "task"
    ? runTaskFormatterProcess({ taskID: authority.taskID, cwd: authority.cwd }, input)
    : runHostFormatterProcess({ ...input, cwd: authority.cwd })
}
