import { join } from "path"
import { readFileSync, rmSync } from "fs"
import { spawn, type ChildProcess } from "node:child_process"
import type { AudioBuffer, STTProvider, STTResult } from "../types"
import { createChannelTemporaryDirectory } from "../../runtime-paths"

const LOCAL_CLI_TERMINATE_GRACE_MS = 2_000
const WINDOWS_POWERSHELL_CLEANUP_TIMEOUT_MS = 5_000

export class LocalCLIProvider implements STTProvider {
  readonly name = "local-cli"
  private command?: string
  private timeoutMs: number

  constructor(opts: { command?: string; timeoutMs?: number }) {
    this.command = opts.command
    this.timeoutMs = opts.timeoutMs ?? 60_000
  }

  async isAvailable(): Promise<boolean> {
    if (!this.command) return false
    const bin = parseCommandTemplate(this.command)[0]
    try {
      const result = await runCommand(["which", bin], process.cwd(), 5_000)
      return result.exitCode === 0
    } catch {
      return false
    }
  }

  async transcribe(audio: AudioBuffer, options?: { language?: string; prompt?: string }): Promise<STTResult> {
    const start = performance.now()

    const outputDir = await createChannelTemporaryDirectory("stt-")
    const ext = audio.mime.split("/")[1]?.replace("mpeg", "mp3").replace("ogg", "ogg") ?? "ogg"
    const mediaPath = join(outputDir, `input.${ext}`)
    await Bun.write(mediaPath, audio.data)

    try {
      // The template is split into arguments FIRST, honouring quotes, and the
      // placeholders are substituted inside each argument. Substituting first
      // and splitting on whitespace afterwards tore any value containing a
      // space into several arguments — and the media path is a temporary
      // directory, which on Windows always contains one.
      const parts = parseCommandTemplate(this.command!).map((argument) =>
        argument
          .replaceAll("{{MediaPath}}", mediaPath)
          .replaceAll("{{OutputDir}}", outputDir)
          .replaceAll("{{Language}}", options?.language ?? ""),
      )
      const result = await runCommand(parts, outputDir, this.timeoutMs)

      if (result.timedOut) {
        throw new Error(`CLI timed out after ${this.timeoutMs}ms without completing`)
      }
      if (result.exitCode !== 0) {
        throw new Error(`CLI exited with code ${result.exitCode}: ${result.stderr.slice(0, 200)}`)
      }

      const txtPath = join(outputDir, "input.txt")
      const text = readFileSync(txtPath, "utf-8").trim()

      return {
        text,
        provider: this.name,
        durationMs: Math.round(performance.now() - start),
      }
    } finally {
      rmSync(outputDir, { recursive: true, force: true })
    }
  }
}

type CommandResult = {
  exitCode: number | null
  timedOut: boolean
  stderr: string
}

/**
 * Split one configured command line into executable and arguments.
 *
 * A configured command is a command LINE, so a quoted segment is one argument
 * no matter how much whitespace it contains, and a backslash escapes the next
 * character outside single quotes. This is the argv a process facade needs;
 * whitespace splitting is not a parser.
 */
export function parseCommandTemplate(commandLine: string): string[] {
  const argv: string[] = []
  let current = ""
  let started = false
  let quote: '"' | "'" | undefined
  for (let index = 0; index < commandLine.length; index += 1) {
    const character = commandLine[index]!
    if (quote === undefined && /\s/.test(character)) {
      if (started) {
        argv.push(current)
        current = ""
        started = false
      }
      continue
    }
    if (quote === undefined && (character === '"' || character === "'")) {
      quote = character
      started = true
      continue
    }
    if (quote !== undefined && character === quote) {
      quote = undefined
      continue
    }
    const next = commandLine[index + 1]
    if (character === "\\" && quote !== "'" && (next === '"' || next === "'" || next === "\\")) {
      // A backslash escapes only a quote or another backslash. Treating it as
      // a general escape would eat the separators out of every Windows path.
      current += next
      started = true
      index += 1
      continue
    }
    current += character
    started = true
  }
  if (quote !== undefined) {
    throw new Error(`Configured command has an unterminated ${quote} quote: ${commandLine}`)
  }
  if (started) argv.push(current)
  return argv
}

async function runCommand(command: string[], cwd: string, timeoutMs: number): Promise<CommandResult> {
  if (command.length === 0) throw new Error("local CLI command is empty")
  let stderr = ""
  let timedOut = false
  let termination: Promise<void> | undefined
  let terminationError: unknown
  let rejectTerminationFailure: (error: unknown) => void = () => {}
  const terminationFailure = new Promise<never>((_resolve, reject) => {
    rejectTerminationFailure = reject
  })
  const child = spawn(command[0], command.slice(1), {
    cwd,
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
    detached: process.platform !== "win32",
  })
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk) => {
    stderr += chunk
  })
  const requestTermination = () => {
    if (termination) return
    termination = terminateProcess(child).catch((error) => {
      terminationError = error
      rejectTerminationFailure(error)
    })
  }
  const timeout = setTimeout(() => {
    timedOut = true
    requestTermination()
  }, timeoutMs)
  try {
    const completion = new Promise<{ exitCode: number | null }>((resolve, reject) => {
      child.once("error", reject)
      child.once("close", (exitCode) => resolve({ exitCode }))
    })
    const result = await Promise.race([completion, terminationFailure])
    clearTimeout(timeout)
    if (!termination) termination = terminateProcess(child)
    if (termination) await termination
    if (terminationError) throw terminationError
    return {
      exitCode: result.exitCode,
      timedOut,
      stderr,
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function terminateProcess(child: ChildProcess): Promise<void> {
  const pid = child.pid
  if (!pid) return
  if (process.platform === "win32") {
    await killWindowsProcessTree(pid, child.exitCode === null && child.signalCode === null)
    return
  }
  if (!processGroupIsRunning(pid)) return
  signalProcessGroup(pid, "SIGTERM")
  if (await waitForProcessGroupExit(pid, LOCAL_CLI_TERMINATE_GRACE_MS)) return
  signalProcessGroup(pid, "SIGKILL")
  if (await waitForProcessGroupExit(pid, LOCAL_CLI_TERMINATE_GRACE_MS)) return
  throw new Error(`local CLI process group ${pid} did not exit after SIGKILL`)
}

function processGroupIsRunning(pid: number): boolean {
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ESRCH") return false
    return code === "EPERM"
  }
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return
    throw error
  }
}

async function waitForProcessGroupExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!processGroupIsRunning(pid)) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return !processGroupIsRunning(pid)
}

async function killWindowsProcessTree(pid: number, includeRoot: boolean): Promise<void> {
  const script = `
$ErrorActionPreference = "Stop"
$root = ${pid}
$includeRoot = ${includeRoot ? "$true" : "$false"}
$processes = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
$children = @{}
foreach ($process in $processes) {
  $parent = [int]$process.ParentProcessId
  if (-not $children.ContainsKey($parent)) {
    $children[$parent] = New-Object System.Collections.Generic.List[int]
  }
  $children[$parent].Add([int]$process.ProcessId)
}
$queue = New-Object System.Collections.Generic.Queue[int]
$seen = New-Object System.Collections.Generic.HashSet[int]
$targets = New-Object System.Collections.Generic.List[int]
$queue.Enqueue([int]$root)
while ($queue.Count -gt 0) {
  $current = $queue.Dequeue()
  if (-not $seen.Add($current)) { continue }
  if (-not $children.ContainsKey($current)) { continue }
  foreach ($child in $children[$current]) {
    $targets.Add([int]$child)
    $queue.Enqueue([int]$child)
  }
}
if ($includeRoot) {
  foreach ($process in $processes) {
    if ([int]$process.ProcessId -eq [int]$root) {
      $targets.Add([int]$root)
      break
    }
  }
}
$unique = @($targets | Sort-Object -Unique)
if ($unique.Count -gt 0) {
  foreach ($target in $unique) {
    Stop-Process -Id $target -Force -ErrorAction SilentlyContinue
  }
  $unique | ConvertTo-Json -Compress
} else {
  Write-Output "[]"
}
`
  const stopped = await runWindowsPowerShellForProcessIDs(script, `local CLI process tree ${pid}`)
  await waitForWindowsProcessIDsExit(stopped, LOCAL_CLI_TERMINATE_GRACE_MS, `local CLI process tree ${pid}`)
}

async function runWindowsPowerShellForProcessIDs(script: string, label: string): Promise<number[]> {
  const output = await new Promise<string>((resolve, reject) => {
    const runner = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    let settled = false
    let stdout = ""
    let stderr = ""
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    const timer = setTimeout(() => {
      runner.kill()
      settle(() =>
        reject(new Error(`${label} PowerShell cleanup timed out after ${WINDOWS_POWERSHELL_CLEANUP_TIMEOUT_MS}ms`)),
      )
    }, WINDOWS_POWERSHELL_CLEANUP_TIMEOUT_MS)
    if (typeof timer.unref === "function") timer.unref()
    runner.stdout.setEncoding("utf8")
    runner.stderr.setEncoding("utf8")
    runner.stdout.on("data", (chunk) => {
      stdout += chunk
    })
    runner.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    runner.once("exit", (code, signal) => {
      settle(() => {
        if (code === 0) resolve(stdout)
        else reject(new Error(`${label} PowerShell cleanup exited with ${signal ?? code}: ${stderr.trim()}`))
      })
    })
    runner.once("error", (error) => settle(() => reject(error)))
  })
  const trimmed = output.trim()
  if (!trimmed) return []
  const parsed = JSON.parse(trimmed) as number | number[]
  return (Array.isArray(parsed) ? parsed : [parsed]).filter((value) => Number.isInteger(value) && value > 0)
}

async function waitForWindowsProcessIDsExit(pids: number[], timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pids.every((pid) => !processIDIsRunning(pid))) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  const live = pids.filter(processIDIsRunning)
  if (live.length > 0) throw new Error(`${label} did not exit after cleanup: ${live.join(", ")}`)
}

function processIDIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ESRCH") return false
    return code === "EPERM"
  }
}
