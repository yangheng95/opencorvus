import { spawn, execSync, type ChildProcess } from "node:child_process"
import { type ConfigGetResponse } from "./gen/types.gen.js"
import { DEFAULT_SERVER_HOST, DEFAULT_SERVER_PORT } from "./defaults.js"

type Config = ConfigGetResponse
const SERVER_PROCESS_TERMINATE_GRACE_MS = 2_000
const WINDOWS_POWERSHELL_CLEANUP_TIMEOUT_MS = 5_000

export type ServerOptions = {
  hostname?: string
  port?: number
  signal?: AbortSignal
  timeout?: number
  config?: Config
}

export type OpenCorvusServer = {
  url: string
  close(): Promise<void>
}

function resolveCommand() {
  if (process.env.OPENCORVUS_BIN_PATH) {
    return process.env.OPENCORVUS_BIN_PATH
  }
  try {
    execSync("opencorvus --version", { stdio: "ignore", timeout: 3000 })
    return "opencorvus"
  } catch {}
  return "opencorvus"
}

export async function createOpenCorvusServer(options?: ServerOptions): Promise<OpenCorvusServer> {
  options = Object.assign(
    {
      hostname: DEFAULT_SERVER_HOST,
      port: DEFAULT_SERVER_PORT,
      timeout: 5000,
    },
    options ?? {},
  )

  const args = [`serve`, `--hostname=${options.hostname}`, `--port=${options.port}`]
  if (options.config?.logLevel) args.push(`--log-level=${options.config.logLevel}`)
  const config = options.config === undefined ? process.env.OPENCORVUS_CONFIG_CONTENT : JSON.stringify(options.config)

  const proc = spawn(resolveCommand(), args, {
    detached: process.platform !== "win32",
    windowsHide: true,
    env: {
      ...process.env,
      ...(config === undefined ? {} : { OPENCORVUS_CONFIG_CONTENT: config }),
    },
  })
  let stopTask: Promise<void> | undefined
  const stopProcess = () => {
    if (!stopTask) stopTask = terminateServerProcess(proc)
    return stopTask
  }

  const url = await new Promise<string>((resolve, reject) => {
    let startupFinished = false
    let startupStopReason: Error | undefined
    const id = setTimeout(() => {
      startupStopReason = new Error(`Timeout waiting for server to start after ${options.timeout}ms`)
      void stopProcess().then(
        () => failStartup(startupStopReason),
        reject,
      )
    }, options.timeout)
    let output = ""
    const cleanupStartup = () => {
      clearTimeout(id)
      if (abortListener) options.signal?.removeEventListener("abort", abortListener)
    }
    const failStartup = (error: unknown) => {
      if (startupFinished) return
      startupFinished = true
      cleanupStartup()
      reject(error)
    }
    const failStartupAfterCleanup = (error: Error) => {
      if (startupFinished) return
      startupStopReason = error
      void stopProcess().then(
        () => failStartup(error),
        (cleanupError) => failStartup(cleanupError),
      )
    }
    const finishStartup = (serverUrl: string) => {
      if (startupFinished) return
      startupFinished = true
      clearTimeout(id)
      resolve(serverUrl)
    }
    let abortListener: (() => void) | undefined
    proc.stdout?.on("data", (chunk) => {
      output += chunk.toString()
      const lines = output.split("\n")
      for (const line of lines) {
        if (line.includes("server listening")) {
          const match = line.match(/on\s+(https?:\/\/[^\s]+)/)
          if (!match) {
            failStartupAfterCleanup(new Error(`Failed to parse server url from output: ${line}`))
            return
          }
          finishStartup(match[1]!)
          return
        }
      }
    })
    proc.stderr?.on("data", (chunk) => {
      output += chunk.toString()
    })
    proc.on("exit", (code) => {
      if (startupStopReason) return
      let msg = `Server exited with code ${code}`
      if (output.trim()) {
        msg += `\nServer output: ${output}`
      }
      failStartupAfterCleanup(new Error(msg))
    })
    proc.on("error", (error) => {
      failStartup(error)
    })
    if (options.signal) {
      abortListener = () => {
        failStartupAfterCleanup(new Error("Aborted"))
      }
      if (options.signal.aborted) abortListener()
      else options.signal.addEventListener("abort", abortListener)
    }
  })

  return {
    url,
    async close() {
      await stopProcess()
    },
  }
}

async function terminateServerProcess(proc: ChildProcess): Promise<void> {
  const pid = proc.pid
  if (!pid) return
  if (process.platform === "win32") {
    await terminateWindowsProcessTree(pid, proc.exitCode === null && proc.signalCode === null)
    return
  }
  if (!processGroupIsRunning(pid)) return
  signalProcessGroup(pid, "SIGTERM")
  if (await waitForProcessGroupExit(pid, SERVER_PROCESS_TERMINATE_GRACE_MS)) return
  signalProcessGroup(pid, "SIGKILL")
  if (await waitForProcessGroupExit(pid, SERVER_PROCESS_TERMINATE_GRACE_MS)) return
  throw new Error(`OpenCorvus server process group ${pid} did not exit after SIGKILL`)
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

async function terminateWindowsProcessTree(pid: number, includeRoot: boolean): Promise<void> {
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
  const stopped = await runWindowsPowerShellForProcessIDs(script, `OpenCorvus server process tree ${pid}`)
  await waitForWindowsProcessIDsExit(stopped, SERVER_PROCESS_TERMINATE_GRACE_MS, `OpenCorvus server process tree ${pid}`)
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
