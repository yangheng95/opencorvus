// ── PID Guard ──
// Prevents executor child processes from killing the host/orchestrator process.
// Injects a shell `kill()` function override via BASH_ENV (bash) or ZDOTDIR (zsh)
// that checks target PIDs against OPENCORVUS_PROTECTED_PIDS before dispatching.

import path from "path"
import fs from "fs/promises"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { lazy } from "@/util/lazy"

// POSIX-compatible kill() wrapper — works in both bash and zsh.
// Skips signal flags (-9, -TERM), job specs (%1), and non-numeric args.
// If any target PID is in OPENCORVUS_PROTECTED_PIDS, refuse the entire command.
const GUARD_SCRIPT = `\
kill() {
  for __oc_a in "$@"; do
    case "$__oc_a" in -*|%*|--) continue ;; esac
    case "$__oc_a" in *[!0-9]*) continue ;; esac
    case ",$OPENCORVUS_PROTECTED_PIDS," in
      *,"$__oc_a",*) echo "opencorvus: refused to kill protected process $__oc_a" >&2; return 1 ;;
    esac
  done
  builtin kill "$@" 2>/dev/null || command kill "$@"
}
`

// zsh wrapper — chain-sources the user's original .zshenv before defining the guard.
const GUARD_ZSHENV = `\
if [ -n "$_OPENCORVUS_ORIGINAL_ZDOTDIR" ] && [ -f "$_OPENCORVUS_ORIGINAL_ZDOTDIR/.zshenv" ]; then
  . "$_OPENCORVUS_ORIGINAL_ZDOTDIR/.zshenv"
elif [ -f "$HOME/.zshenv" ]; then
  . "$HOME/.zshenv"
fi
${GUARD_SCRIPT}`

export namespace PidGuard {
  // Write guard files once per process, reuse paths thereafter.
  const state = lazy(async () => {
    const dir = Global.Path.state
    const bashEnvPath = path.join(dir, "pid-guard.sh")
    const zshDir = path.join(dir, "pid-guard-zsh")
    const zshEnvPath = path.join(zshDir, ".zshenv")
    await fs.mkdir(zshDir, { recursive: true })
    await Promise.all([Filesystem.write(bashEnvPath, GUARD_SCRIPT), Filesystem.write(zshEnvPath, GUARD_ZSHENV)])
    return { bashEnvPath, zshDir }
  })

  /** Comma-separated PIDs that must not be killed by child processes. */
  export function protectedPids(): string {
    const pids = new Set<number>()
    pids.add(process.pid)
    if (process.ppid > 0) pids.add(process.ppid)
    return Array.from(pids).join(",")
  }

  /**
   * Return env vars to inject into a child shell process for PID protection.
   * - bash/sh → sets BASH_ENV to source the guard script
   * - zsh → sets ZDOTDIR so .zshenv is sourced automatically
   * - cmd/powershell → only sets OPENCORVUS_PROTECTED_PIDS (kill is N/A)
   */
  export async function env(shellPath: string): Promise<Record<string, string>> {
    const paths = await state()
    const base = path
      .basename(shellPath)
      .replace(/\.exe$/i, "")
      .toLowerCase()
    const result: Record<string, string> = {
      OPENCORVUS_PROTECTED_PIDS: protectedPids(),
    }
    if (base === "bash" || base === "sh") {
      result.BASH_ENV = paths.bashEnvPath
    } else if (base === "zsh") {
      result.ZDOTDIR = paths.zshDir
      result._OPENCORVUS_ORIGINAL_ZDOTDIR = process.env.ZDOTDIR || ""
    }
    return result
  }
}
