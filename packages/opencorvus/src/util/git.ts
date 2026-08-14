import { Process } from "./process"
import { ProcessSupervisor } from "@/shell/process-supervisor"

export interface GitResult {
  exitCode: number
  text(): string
  stdout: Buffer
  stderr: Buffer
}

/**
 * Timeout profile bands. Use `timeoutProfile` to express intent rather than
 * hard-coding ms; the band rationalises Phase-1 of the systemic timeout
 * sweep (git timeout systemic fix contract):
 *  - `fast`    — local read-only metadata: rev-parse, show-ref, log -1, status --short
 *  - `default` — local heavy: status, diff, add, commit, worktree prune
 *  - `network` — fetch / clone / push / submodule update
 *
 * Caller still wins via explicit `timeoutMs` (takes precedence over profile).
 */
export const GitTimeout = {
  fast: 15_000,
  default: 90_000,
  network: 300_000,
} as const

export type GitTimeoutProfile = keyof typeof GitTimeout

export interface GitOptions {
  cwd: string
  env?: Record<string, string>
  abort?: AbortSignal
  /** Explicit ms; wins over `timeoutProfile`. */
  timeoutMs?: number
  /** Named band; ignored when `timeoutMs` is supplied. */
  timeoutProfile?: GitTimeoutProfile
}

const GIT_PROCESS_CONFIG = ["-c", "core.longPaths=true"] as const

/**
 * Build argv for every OpenCorvus-owned Git process.
 *
 * Git for Windows leaves long-path support disabled unless the process opts
 * in. Keeping the setting here makes EngineGit, snapshots, worktrees, and
 * managed Git Skills use the same non-persistent process configuration.
 */
export function gitProcessArgs(args: string[], executable = "git"): string[] {
  return [executable, ...GIT_PROCESS_CONFIG, ...args]
}

/**
 * Pure resolver: which deadline applies given the caller's options? Exposed
 * separately so tests can pin profile dispatch without launching a process.
 */
export function resolveGitTimeoutMs(opts: Pick<GitOptions, "timeoutMs" | "timeoutProfile">): number {
  if (opts.timeoutMs !== undefined) return opts.timeoutMs
  if (opts.timeoutProfile) return GitTimeout[opts.timeoutProfile]
  return 90_000
}

/**
 * Run a git command.
 *
 * Uses Process helpers with stdin ignored to avoid protocol pipe inheritance
 * issues in embedded/client environments.
 *
 * Timeout resolution order: `opts.timeoutMs` > `opts.timeoutProfile` >
 * legacy default (90s). The timeout is an inactivity window: stdout or
 * stderr activity refreshes it, while a silent child is terminated through
 * the shared process supervisor.
 */
type GitProcessRunner = (command: string[], options: Process.RunOptions) => Promise<Process.Result>

async function executeGit(
  run: GitProcessRunner,
  args: string[],
  opts: GitOptions,
  command = gitProcessArgs(args),
  exactEnv?: NodeJS.ProcessEnv,
): Promise<GitResult> {
  const timeoutMs = resolveGitTimeoutMs(opts)
  const timeoutMessage = `git ${args.join(" ")} timed out after ${timeoutMs}ms (cwd=${opts.cwd})`
  const result = await run(command, {
    cwd: opts.cwd,
    ...(exactEnv ? { exactEnv } : { env: opts.env }),
    stdin: "ignore",
    nothrow: true,
    inactivityTimeoutMs: timeoutMs,
    inactivityTimeoutMessage: timeoutMessage,
    abort: opts.abort,
  })
  return {
    exitCode: result.code,
    text: () => result.stdout.toString(),
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

export function hostGit(args: string[], opts: GitOptions): Promise<GitResult> {
  return executeGit(Process.runHost, args, opts)
}

export function taskGit(
  identity: ProcessSupervisor.TaskProcessIdentity,
  args: string[],
  opts: Omit<GitOptions, "cwd">,
): Promise<GitResult> {
  return executeGit((command, options) => Process.runTask(identity, command, options), args, {
    ...opts,
    cwd: identity.cwd,
  })
}
