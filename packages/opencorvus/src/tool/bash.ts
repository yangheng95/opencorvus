import z from "zod"
import { Tool } from "./tool"
import path from "path"
import fs from "fs/promises"
import DESCRIPTION from "./bash.txt"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { lazy } from "@/util/lazy"
import { Language } from "web-tree-sitter"

import { Filesystem } from "@/util/filesystem"
import { fileURLToPath } from "url"
import { Flag } from "@/flag/flag.ts"
import { Shell } from "@/shell/shell"
import {
  BASH_BACKGROUND_READINESS_MAX_MS,
  DEFAULT_BASH_BACKGROUND_LEASE_MS,
  DEFAULT_BASH_TIMEOUT_MS,
} from "@/shell/timeout"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { isFrontendDevServerCommandTokens } from "@/browser-preview/dev-server-command"

import { BashArity } from "@/permission/arity"
import { Truncate } from "./truncation"
import { Plugin } from "@/plugin"
import { PidGuard } from "@/shell/pid-guard"
import { gitCeilingEnvForWorktree } from "@/worktree/git-ceiling"
import { assertBuildWriteDirectory } from "./external-directory"
import { LocalEnvironment } from "@/config/local-environment"
import { forbiddenShellEnvironmentKeys, sanitizeShellEnvironment } from "@/shell/environment"
import { redactInlinePayloads } from "@/util/inline-base64"
import { activeTaskExecutionCapsule } from "@/engine/task-execution-capsule-binding"

const MAX_METADATA_LENGTH = 30_000
export const DEFAULT_TIMEOUT = Flag.OPENCORVUS_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS || DEFAULT_BASH_TIMEOUT_MS

export const log = Log.create({ service: "bash-tool" })
const DYNAMIC_PATH_PATTERN = /[*?[\]{}$`~]/
type BashOutputObserver = (input: { stream: "stdout" | "stderr"; chunk: string; output: string }) => void

function foregroundLifecycleHint(timeout: number) {
  return [
    `foreground command lifecycle: this non-background command has completed or stopped; OpenCorvus disposed its process tree before returning this tool result`,
    `foreground command timeout for this call: ${timeout} ms`,
    `child/background processes started inside this foreground command, including servers started with shell '&', do not survive for later screenshot/browser tools`,
    `for dev/preview/serve servers that must survive later tools, run the command with bash parameter background: true instead of shell '&'`,
  ]
}

function canAppendForegroundLifecycleHint(output: string) {
  if (output.length >= Truncate.MAX_BYTES) return false
  const lineCount = output.length === 0 ? 0 : output.split(/\r?\n/).length
  return lineCount < Truncate.MAX_LINES
}

function bashMetadataOutput(output: string): string {
  const safe = redactInlinePayloads(output)
  return safe.length > MAX_METADATA_LENGTH ? safe.slice(0, MAX_METADATA_LENGTH) + "\n\n..." : safe
}

// Commands that kill processes by name — can destroy the host process (benchmark,
// server, other executors) when run inside an isolated worktree. Worktree isolation
// protects the filesystem but NOT the process namespace.
const HOST_KILLING_PATTERNS = [
  /\btaskkill\b.*\/IM\b/i, // taskkill /F /IM bun.exe
  /\bStop-Process\b.*-Name\b/i, // Stop-Process -Name 'bun'
  /\bkillall\b/i, // killall bun
  /\bpkill\b/i, // pkill bun
  /\bwmic\b.*process.*\bcall\b.*terminate/i, // wmic process where name="bun.exe" call terminate
  /\bxargs\s+kill\b/i, // ps | grep bun | xargs kill
  /\bxargs\s+.*\bkill\b/i, // ps | xargs -I{} kill {}
  /\bkill\b.*\$\(/i, // kill $(pgrep bun)
  /\bkill\b.*`/i, // kill `pgrep bun`
]

export function isHostKillingCommand(command: string): boolean {
  return HOST_KILLING_PATTERNS.some((pattern) => pattern.test(command))
}

const resolveWasm = (asset: string) => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  const url = new URL(asset, import.meta.url)
  return fileURLToPath(url)
}

const parser = lazy(async () => {
  const { Parser } = await import("web-tree-sitter")
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  const treePath = resolveWasm(treeWasm)
  await Parser.init({
    locateFile() {
      return treePath
    },
  })
  const { default: bashWasm } = await import("tree-sitter-bash/tree-sitter-bash.wasm" as string, {
    with: { type: "wasm" },
  })
  const bashPath = resolveWasm(bashWasm)
  const bashLanguage = await Language.load(bashPath)
  const p = new Parser()
  p.setLanguage(bashLanguage)
  return p
})

function stripShellQuotes(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

async function resolveStaticPathArg(arg: string, cwd: string) {
  const cleaned = stripShellQuotes(arg)
  if (!cleaned || DYNAMIC_PATH_PATTERN.test(cleaned)) return undefined

  // On win32, translate Git Bash / Cygwin / WSL mount paths (`/c/Users/...`,
  // `/mnt/c/...`, etc.) to native Windows form BEFORE path.resolve. node's
  // path.resolve treats `/c/...` as a POSIX absolute path rooted at the
  // current drive, producing the `C:\c\Users\...` duplication that previously
  // forced two bash-permission tests to be skipped.
  const normalizedArg = process.platform === "win32" ? Filesystem.windowsPath(cleaned) : cleaned
  const normalizedCwd = process.platform === "win32" ? Filesystem.windowsPath(cwd) : cwd
  const absolute = path.resolve(normalizedCwd, normalizedArg)
  const real = await fs.realpath(absolute).catch(() => absolute)
  return process.platform === "win32" ? Filesystem.windowsPath(real).replace(/\//g, "\\") : real
}

export function createBashSpawnDiagnostics(input: {
  shell: string
  cwd: string
  shellEnv: Record<string, string>
  guardEnv: Record<string, string>
  childEnv: NodeJS.ProcessEnv
}) {
  const shellStat = Filesystem.stat(input.shell)
  const cwdStat = Filesystem.stat(input.cwd)
  return {
    shell: input.shell,
    cwd: input.cwd,
    shellExists: Boolean(shellStat),
    shellIsFile: shellStat?.isFile(),
    cwdExists: Boolean(cwdStat),
    cwdIsDirectory: cwdStat?.isDirectory(),
    envShell: input.childEnv.SHELL,
    envPath: input.childEnv.PATH,
    shellEnvKeys: Object.keys(input.shellEnv).sort(),
    guardEnvKeys: Object.keys(input.guardEnv).sort(),
    removedForbiddenEnvKeys: forbiddenShellEnvironmentKeys()
      .filter((key) => process.env[key] !== undefined)
      .sort(),
  }
}

function resolveWorkdir(rawCwd: string): string {
  const nativeCwd = process.platform === "win32" ? Filesystem.windowsPath(rawCwd) : rawCwd
  return path.isAbsolute(nativeCwd) ? nativeCwd : path.resolve(Instance.directory, nativeCwd)
}

// TODO: we may wanna rename this tool so it works better on other shells
export const BashTool = Tool.define("bash", async () => {
  const shell = Shell.acceptable()
  log.info("bash tool using shell", { shell })

  return {
    description: DESCRIPTION.replaceAll("${directory}", Instance.directory)
      .replaceAll("${shell}", shell)
      .replaceAll("${maxLines}", String(Truncate.MAX_LINES))
      .replaceAll("${maxBytes}", String(Truncate.MAX_BYTES))
      .replaceAll("${defaultTimeout}", String(DEFAULT_TIMEOUT))
      .replaceAll("${defaultBackgroundLease}", String(DEFAULT_BASH_BACKGROUND_LEASE_MS)),
    parameters: z.object({
      command: z.string().describe("The command to execute"),
      timeout: z.number().describe("Optional timeout in milliseconds").optional(),
      workdir: z
        .string()
        .describe(
          `The working directory to run the command in. Defaults to ${Instance.directory}. Use this instead of 'cd' commands.`,
        )
        .optional(),
      description: z
        .string()
        .describe(
          "Clear, concise description of what this command does in 5-10 words. Examples:\nInput: ls\nOutput: Lists files in current directory\n\nInput: git status\nOutput: Shows working tree status\n\nInput: npm install\nOutput: Installs package dependencies\n\nInput: mkdir foo\nOutput: Creates directory 'foo'",
        ),
      background: z
        .boolean()
        .describe(
          "When true, the command keeps running after this tool call returns until explicitly stopped or until the background lease expires. The tool returns immediately with the spawned PID once stdout/stderr are observed (or after a short readiness window). Use ONLY for long-lived servers (dev/preview/serve) that must outlive a single tool call so acceptance checks can probe them. You are responsible for stopping it later (e.g. `kill <pid>` or `lsof -ti :<port> | xargs kill`).",
        )
        .optional(),
      leaseTimeout: z
        .number()
        .describe(
          "Optional background process lease in milliseconds. Only applies with background: true. Defaults to 3600000ms (1 hour). Use this only when you intentionally need a shorter or longer lease; timeout controls the tool/readiness wait, not the background process lifetime.",
        )
        .optional(),
    }),
    async execute(params, ctx) {
      // Workdir from the LLM can arrive in Git Bash / Cygwin / WSL form
      // (`/c/Users/...`, `/mnt/c/...`) on Windows. Translate to native form
      // up front so every downstream consumer (containsPath, ProcessSupervisor
      // spawn cwd, the resolveStaticPathArg call below) sees a single
      // canonical shape. Without this, containsPath silently mismatches the
      // project root and an external_directory permission ask is raised for
      // workdirs that are actually inside the project.
      const rawCwd = params.workdir || Instance.directory
      const cwd = resolveWorkdir(rawCwd)
      await assertBuildWriteDirectory(ctx, cwd)
      if (params.timeout !== undefined && params.timeout < 0) {
        throw new Error(`Invalid timeout value: ${params.timeout}. Timeout must be a positive number.`)
      }
      if (params.leaseTimeout !== undefined && params.leaseTimeout < 0) {
        throw new Error(`Invalid leaseTimeout value: ${params.leaseTimeout}. leaseTimeout must be a positive number.`)
      }
      const timeout = params.timeout ?? DEFAULT_TIMEOUT
      // Block commands that kill processes by name — these can destroy the host
      // process, benchmark, or sibling executors. Worktree isolation only covers
      // the filesystem; the process namespace is shared.
      if (isHostKillingCommand(params.command)) {
        return {
          title: "Refused",
          output: `Refused: this command kills processes by name and would destroy the host process. Use process-specific alternatives (e.g. kill a PID you spawned, or stop a service you started).`,
          metadata: {
            refused: true as boolean,
            command: params.command,
            output: "",
            exit: null as number | null,
            pid: null as number | null,
            background: false,
            description: params.description,
          },
        }
      }

      let shouldAppendForegroundLifecycleHint = false

      const tree = await parser().then((p) => p.parse(params.command))
      if (!tree) {
        throw new Error("Failed to parse command")
      }
      try {
        for (const node of tree.rootNode.descendantsOfType("command")) {
          if (!node) continue

          const command: string[] = []
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)
            if (!child) continue
            if (
              child.type !== "command_name" &&
              child.type !== "word" &&
              child.type !== "string" &&
              child.type !== "raw_string" &&
              child.type !== "concatenation"
            ) {
              continue
            }
            command.push(child.text)
          }

          if (isFrontendDevServerCommandTokens(command)) {
            shouldAppendForegroundLifecycleHint = true
          }

          if (command[0] === "cd") {
            for (const arg of command.slice(1)) {
              if (arg.startsWith("-")) continue
              const resolved = await resolveStaticPathArg(arg, cwd)
              log.info("resolved path", { arg, resolved })
              if (resolved) await assertBuildWriteDirectory(ctx, resolved)
            }
          }
        }
      } finally {
        disposeSyntaxTree(tree)
      }

      const shellEnv = await Plugin.trigger(
        "shell.env",
        { cwd, sessionID: ctx.sessionID, callID: ctx.callID },
        { env: {} },
      )
      const localEnvironment = await LocalEnvironment.projectShellCommand(params.command)
      const guardEnv = await PidGuard.env(shell)
      const commandEnvironment = { ...process.env, ...shellEnv.env, ...localEnvironment.variables }
      const childEnv = sanitizeShellEnvironment(process.env, {
        ...shellEnv.env,
        ...localEnvironment.variables,
        ...gitCeilingEnvForWorktree(cwd, commandEnvironment),
        ...guardEnv,
      })
      const spawnDiagnostics = createBashSpawnDiagnostics({
        shell,
        cwd,
        shellEnv: shellEnv.env,
        guardEnv,
        childEnv,
      })
      log.info("spawning shell", spawnDiagnostics)
      const processOptions = { command: localEnvironment.command, shell, env: childEnv }
      const executionAuthority = Tool.requireExecutionAuthority(ctx)
      const supervisor = await (executionAuthority.kind === "task"
        ? ProcessSupervisor.spawnTaskShell({ taskID: executionAuthority.taskID, cwd }, processOptions)
        : ProcessSupervisor.spawnHostShell({ ...processOptions, cwd })).catch((error) => {
        log.error("spawn shell failed", { ...spawnDiagnostics, error })
        throw error
      })

      let output = ""
      // Initialize metadata with empty output
      ctx.metadata({
        metadata: {
          output: "",
          description: params.description,
        },
      })

      const outputObserver =
        typeof ctx.extra?.bashOutputObserver === "function"
          ? (ctx.extra.bashOutputObserver as BashOutputObserver)
          : undefined

      const append = (stream: "stdout" | "stderr", chunk: Buffer) => {
        const text = chunk.toString()
        output += text
        outputObserver?.({ stream, chunk: text, output })
        ctx.metadata({
          metadata: {
            // truncate the metadata to avoid GIANT blobs of data (has nothing to do w/ what agent can access)
            output: bashMetadataOutput(output),
            description: params.description,
          },
        })
      }

      supervisor.stdout?.on("data", (chunk: Buffer) => append("stdout", chunk))
      supervisor.stderr?.on("data", (chunk: Buffer) => append("stderr", chunk))

      let timedOut = false
      let aborted = false
      let exited = false
      let exitCode: number | null = null

      let terminationPromise: Promise<number> | undefined
      let resolveTerminationRequested: ((promise: Promise<number>) => void) | undefined
      const terminationRequested = new Promise<Promise<number>>((resolve) => {
        resolveTerminationRequested = resolve
      })
      const requestTermination = (reason: string) => {
        if (!terminationPromise) {
          terminationPromise = ProcessSupervisor.terminateAndWaitForExit(supervisor, `bash foreground ${reason}`)
          terminationPromise.catch(() => undefined)
          resolveTerminationRequested?.(terminationPromise)
        }
        return terminationPromise
      }

      let backgroundDisposePromise: Promise<number> | undefined
      const requestBackgroundDispose = (reason: string) => {
        if (!backgroundDisposePromise) {
          backgroundDisposePromise = ProcessSupervisor.disposeAndWaitForExit(supervisor, `bash background ${reason}`)
          backgroundDisposePromise.catch(() => undefined)
        }
        return backgroundDisposePromise
      }

      if (params.background) {
        const backgroundLease = params.leaseTimeout ?? DEFAULT_BASH_BACKGROUND_LEASE_MS
        let backgroundLeaseTimer: ReturnType<typeof setTimeout> | undefined
        let backgroundExitError: unknown
        const backgroundAbortHandler = () => {
          aborted = true
          void requestBackgroundDispose("abort").catch((error) => {
            log.error("bash background abort cleanup failed", {
              command: params.command,
              error: error instanceof Error ? error.message : String(error),
            })
          })
        }
        supervisor.exited.then(
          (code) => {
            exited = true
            exitCode = code
            if (backgroundLeaseTimer) clearTimeout(backgroundLeaseTimer)
            void requestBackgroundDispose("natural exit").catch((error) => {
              log.error("bash background natural-exit cleanup failed", {
                command: params.command,
                error: error instanceof Error ? error.message : String(error),
              })
            })
          },
          (error) => {
            exited = true
            exitCode = null
            backgroundExitError = error
            if (backgroundLeaseTimer) clearTimeout(backgroundLeaseTimer)
            void requestBackgroundDispose("failed exit").catch((cleanupError) => {
              log.error("bash background failed-exit cleanup failed", {
                command: params.command,
                processError: error instanceof Error ? error.message : String(error),
                cleanupError: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
              })
            })
          },
        )
        if (ctx.abort.aborted) {
          aborted = true
          await requestBackgroundDispose("abort")
        }
        ctx.abort.addEventListener("abort", backgroundAbortHandler, { once: true })
        if (!backgroundDisposePromise) {
          backgroundLeaseTimer = setTimeout(() => {
            timedOut = true
            void requestBackgroundDispose("lease timeout").catch((error) => {
              log.error("bash background lease cleanup failed", {
                command: params.command,
                error: error instanceof Error ? error.message : String(error),
              })
            })
          }, backgroundLease)
          backgroundLeaseTimer.unref?.()
        }
        supervisor.unref()
        const readinessMs = Math.min(timeout, BASH_BACKGROUND_READINESS_MAX_MS)
        try {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, readinessMs)
            void supervisor.exited
              .finally(() => {
                clearTimeout(timer)
                resolve()
              })
              .catch(() => undefined)
          })
          if (exited || aborted) {
            let cleanupError: unknown
            if (backgroundDisposePromise) {
              try {
                await backgroundDisposePromise
              } catch (error) {
                cleanupError = error
              }
            }
            if (backgroundExitError && cleanupError) {
              throw ProcessSupervisor.combineFailures("Bash background process and cleanup failed", [
                backgroundExitError,
                cleanupError,
              ])
            }
            if (backgroundExitError) throw backgroundExitError
            if (cleanupError) throw cleanupError
          }
        } finally {
          ctx.abort.removeEventListener("abort", backgroundAbortHandler)
        }
        const resultMetadata: string[] = [
          `bash tool returned while command continues running in background (pid=${supervisor.pid ?? "unknown"})`,
          `background process lease timeout: ${backgroundLease} ms`,
          `OpenCorvus will terminate this process tree when the lease expires unless you stop it first`,
          `stop it later with the process-specific PID ${supervisor.pid ?? "<pid>"} (or kill by port)`,
        ]
        if (timedOut) resultMetadata.push(`background process exceeded lease before readiness window`)
        if (exited) resultMetadata.push(`background process exited before readiness window (exit=${exitCode})`)
        output += "\n\n<bash_metadata>\n" + resultMetadata.join("\n") + "\n</bash_metadata>"
        return {
          title: params.description,
          metadata: {
            refused: false as boolean,
            command: params.command,
            output: bashMetadataOutput(output),
            exit: exited ? exitCode : null,
            pid: supervisor.pid ?? null,
            background: true,
            description: params.description,
          },
          output,
        }
      }

      const abortHandler = () => {
        aborted = true
        requestTermination("abort")
      }

      ctx.abort.addEventListener("abort", abortHandler, { once: true })

      const timeoutTimer = setTimeout(() => {
        timedOut = true
        requestTermination(`timeout ${timeout}ms`)
      }, timeout + 100)

      let primaryError: unknown
      try {
        if (ctx.abort.aborted) {
          aborted = true
          requestTermination("abort")
        }
        exitCode = await Promise.race([supervisor.exited, terminationRequested.then((cleanup) => cleanup)])
        exited = true
        if (terminationPromise) {
          exitCode = await terminationPromise
        }
      } catch (error) {
        primaryError = error
        throw error
      } finally {
        clearTimeout(timeoutTimer)
        ctx.abort.removeEventListener("abort", abortHandler)
        try {
          await ProcessSupervisor.disposeAndWaitForExit(supervisor, "bash foreground")
        } catch (error) {
          if (primaryError) {
            throw ProcessSupervisor.combineFailures("Bash execution and disposal failed", [primaryError, error])
          }
          throw error
        }
      }

      const resultMetadata: string[] = []

      if (shouldAppendForegroundLifecycleHint && canAppendForegroundLifecycleHint(output)) {
        resultMetadata.push(...foregroundLifecycleHint(timeout))
      }

      if (timedOut) {
        resultMetadata.push(`bash tool terminated command after exceeding timeout ${timeout} ms`)
      }

      if (aborted) {
        resultMetadata.push("User aborted the command")
      }

      if (resultMetadata.length > 0) {
        output += "\n\n<bash_metadata>\n" + resultMetadata.join("\n") + "\n</bash_metadata>"
      }

      return {
        title: params.description,
        metadata: {
          refused: false as boolean,
          command: params.command,
          output: bashMetadataOutput(output),
          exit: exitCode,
          pid: null as number | null,
          background: false,
          description: params.description,
        },
        output,
      }
    },
  }
})

export function disposeSyntaxTree(tree: unknown): void {
  const disposable = tree as { delete?: () => void }
  disposable.delete?.()
}
