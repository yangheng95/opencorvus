import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "child_process"
import { EventEmitter } from "node:events"
import path from "path"
import { Global } from "../global"
import { Log } from "../util/log"
import { BunProc } from "../bun"
import { $ } from "bun"
import { text } from "node:stream/consumers"
import fs from "fs/promises"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { Archive } from "../util/archive"
import { Process } from "../util/process"
import { which } from "@/util/which"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { Shell } from "@/shell/shell"
import { LSP_BUILTIN_SERVER_ID } from "./catalog"
import { activeTaskExecutionCapsule } from "@/engine/task-execution-capsule-binding"

export namespace LSPServer {
  const log = Log.create({ service: "lsp.server" })
  const pathExists = async (p: string) =>
    fs
      .stat(p)
      .then(() => true)
      .catch(() => false)

  function pathWithBin() {
    return [process.env["PATH"], Global.Path.bin]
      .filter((value): value is string => Boolean(value))
      .join(path.delimiter)
  }

  function resolveNpmCommand() {
    const candidates = process.platform === "win32" ? ["npm.cmd", "npm.exe", "npm"] : ["npm"]
    for (const candidate of candidates) {
      const found = which(candidate)
      if (found) return found
    }
    return process.platform === "win32" ? "npm.cmd" : "npm"
  }

  function quotePosix(value: string) {
    return `'${value.replaceAll("'", "'\"'\"'")}'`
  }

  function quotePowerShell(value: string) {
    return `'${value.replaceAll("'", "''")}'`
  }

  function quoteCmd(value: string) {
    if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) return value
    return `"${value.replaceAll('"', '""')}"`
  }

  function shellCommand(argv: string[], shell: string) {
    const name = path.basename(shell, path.extname(shell)).toLowerCase()
    if (name === "powershell" || name === "pwsh") return `& ${argv.map(quotePowerShell).join(" ")}`
    if (name === "cmd") return argv.map(quoteCmd).join(" ")
    return `exec ${argv.map(quotePosix).join(" ")}`
  }

  async function waitForExit(proc: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
    if (proc.exitCode !== null || proc.signalCode !== null) return true
    return await Promise.race([
      new Promise<boolean>((resolve) => proc.once("exit", () => resolve(true))),
      Bun.sleep(timeoutMs).then(() => false),
    ])
  }

  async function waitForClose(proc: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
    if (proc.stdin.destroyed && proc.stdout.destroyed && proc.stderr.destroyed) return true
    return await Promise.race([
      new Promise<boolean>((resolve) => proc.once("close", () => resolve(true))),
      Bun.sleep(timeoutMs).then(() => false),
    ])
  }

  async function terminateSpawnedStdio(proc: ChildProcessWithoutNullStreams) {
    const close = waitForClose(proc, 2_000)
    if (proc.exitCode === null && proc.signalCode === null && proc.pid) {
      await ProcessSupervisor.terminateOwnedChildProcessTree(proc, `LSP stdio process tree ${proc.pid}`, {
        gracefulTimeoutMs: 1_000,
      })
    } else if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill("SIGTERM")
      if (!(await waitForExit(proc, 1_000))) {
        proc.kill("SIGKILL")
        await waitForExit(proc, 1_000)
      }
    }
    if (!(await close)) throw new Error(`LSP stdio process ${proc.pid ?? "unknown"} did not close its streams`)
    proc.unref()
  }

  export type OwnedChildProcess = ChildProcessWithoutNullStreams & {
    opencorvusDispose?: () => Promise<void>
  }

  export async function spawnTaskStdio(
    taskID: string,
    command: string,
    argsOrOptions?: string[] | SpawnOptionsWithoutStdio,
    maybeOptions?: SpawnOptionsWithoutStdio,
  ): Promise<OwnedChildProcess> {
    const args = Array.isArray(argsOrOptions) ? argsOrOptions : []
    const options = (Array.isArray(argsOrOptions) ? maybeOptions : argsOrOptions) ?? {}
    if (!options.cwd) throw new Error("LSP stdio spawning requires an exact Task cwd")
    const handle = await spawnSupervisedStdio(taskID, options.cwd.toString(), [command, ...args], options.env)
    const owned = handle.process as OwnedChildProcess
    let disposeOperation: Promise<void> | undefined
    owned.opencorvusDispose = async () => {
      if (disposeOperation) return disposeOperation
      const operation = handle.dispose?.() ?? Promise.resolve()
      disposeOperation = operation
      try {
        await operation
      } catch (error) {
        if (disposeOperation === operation) disposeOperation = undefined
        throw error
      }
    }
    return owned
  }

  export function spawnHostStdio(
    command: string,
    argsOrOptions?: string[] | SpawnOptionsWithoutStdio,
    maybeOptions?: SpawnOptionsWithoutStdio,
  ): OwnedChildProcess {
    const args = Array.isArray(argsOrOptions) ? argsOrOptions : []
    const options = (Array.isArray(argsOrOptions) ? maybeOptions : argsOrOptions) ?? {}
    const proc = spawn(command, args, { ...options, detached: process.platform !== "win32", stdio: "pipe" })
    const owned = proc as OwnedChildProcess
    let disposeOperation: Promise<void> | undefined
    owned.opencorvusDispose = async () => {
      disposeOperation ??= terminateSpawnedStdio(proc)
      return disposeOperation
    }
    return owned
  }

  function supervisedChildProcess(supervisor: ProcessSupervisor.Handle): ChildProcessWithoutNullStreams {
    const events = new EventEmitter()
    let exitCode: number | null = null
    let signalCode: NodeJS.Signals | null = null
    let exitError: Error | undefined
    let settled = false
    const processLike = {
      pid: supervisor.pid,
      stdin: supervisor.stdin,
      stdout: supervisor.stdout,
      stderr: supervisor.stderr,
      get exitCode() {
        return exitCode
      },
      get signalCode() {
        return signalCode
      },
      kill: () => {
        void supervisor.terminate()
        return true
      },
      once(event: string | symbol, listener: (...args: any[]) => void) {
        if (event === "exit" && settled && !exitError) {
          queueMicrotask(() => listener(exitCode, signalCode))
          return processLike
        }
        if (event === "error" && exitError) {
          queueMicrotask(() => listener(exitError))
          return processLike
        }
        events.once(event, listener)
        return processLike
      },
      on(event: string | symbol, listener: (...args: any[]) => void) {
        events.on(event, listener)
        return processLike
      },
      off(event: string | symbol, listener: (...args: any[]) => void) {
        events.off(event, listener)
        return processLike
      },
      removeListener(event: string | symbol, listener: (...args: any[]) => void) {
        events.removeListener(event, listener)
        return processLike
      },
      emit(event: string | symbol, ...args: any[]) {
        return events.emit(event, ...args)
      },
    } as unknown as ChildProcessWithoutNullStreams

    supervisor.exited.then(
      (code) => {
        settled = true
        exitCode = code
        events.emit("exit", exitCode, signalCode)
        events.emit("close", exitCode, signalCode)
      },
      (error) => {
        settled = true
        exitError = error instanceof Error ? error : new Error(String(error))
        if (events.listenerCount("error") > 0) events.emit("error", exitError)
      },
    )

    return processLike
  }

  async function spawnSupervisedStdio(
    taskID: string,
    root: string,
    argv: string[],
    env?: NodeJS.ProcessEnv,
  ): Promise<Handle> {
    const shell = Shell.acceptable()
    const supervisor = await ProcessSupervisor.spawnTaskShell({ taskID, cwd: root }, {
      command: shellCommand(argv, shell),
      shell,
      env,
      stdin: "pipe",
      owner: "lsp",
      taskCancellationRole: "auxiliary",
    })
    if (!supervisor.stdin || !supervisor.stdout || !supervisor.stderr) {
      await supervisor.dispose()
      throw new Error("Process supervisor did not provide stdio pipes")
    }
    return {
      process: supervisedChildProcess(supervisor),
      dispose: () => supervisor.dispose(),
    }
  }

  export interface Handle {
    process: ChildProcessWithoutNullStreams
    initialization?: Record<string, any>
    dispose?: () => Promise<void>
  }

  type RootFunction = (file: string) => Promise<string | undefined>

  const NearestRoot = (includePatterns: string[], excludePatterns?: string[]): RootFunction => {
    return async (file) => {
      if (excludePatterns) {
        const excludedFiles = Filesystem.up({
          targets: excludePatterns,
          start: path.dirname(file),
          stop: Instance.directory,
        })
        const excluded = await excludedFiles.next()
        await excludedFiles.return()
        if (excluded.value) return undefined
      }
      const files = Filesystem.up({
        targets: includePatterns,
        start: path.dirname(file),
        stop: Instance.directory,
      })
      const first = await files.next()
      await files.return()
      if (!first.value) return Instance.directory
      return path.dirname(first.value)
    }
  }

  export interface Info {
    id: string
    extensions: string[]
    global?: boolean
    root: RootFunction
    spawn(root: string, stdio: StdioSpawner, probe: ProcessProbe): Promise<Handle | undefined>
  }

  export type StdioSpawner = (
    command: string,
    argsOrOptions?: string[] | SpawnOptionsWithoutStdio,
    maybeOptions?: SpawnOptionsWithoutStdio,
  ) => Promise<OwnedChildProcess>

  export type ProcessProbe = (root: string, argv: string[]) => Promise<Process.Result>

  function isServerInfo(value: unknown): value is Info {
    return (
      typeof value === "object" &&
      value !== null &&
      typeof (value as { id?: unknown }).id === "string" &&
      Array.isArray((value as { extensions?: unknown }).extensions) &&
      typeof (value as { root?: unknown }).root === "function" &&
      typeof (value as { spawn?: unknown }).spawn === "function"
    )
  }

  export function builtInServers(): Info[] {
    return Object.values(LSPServer).filter(isServerInfo)
  }

  export const Deno: Info = {
    id: LSP_BUILTIN_SERVER_ID.deno,
    root: async (file) => {
      const files = Filesystem.up({
        targets: ["deno.json", "deno.jsonc"],
        start: path.dirname(file),
        stop: Instance.directory,
      })
      const first = await files.next()
      await files.return()
      if (!first.value) return undefined
      return path.dirname(first.value)
    },
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
    async spawn(root, stdio) {
      const deno = which("deno")
      if (!deno) {
        log.info("deno not found, please install deno first")
        return
      }
      return {
      process: await stdio(deno, ["lsp"], {
          cwd: root,
        }),
      }
    },
  }

  export const Typescript: Info = {
    id: LSP_BUILTIN_SERVER_ID.typescript,
    root: NearestRoot(
      ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
      ["deno.json", "deno.jsonc"],
    ),
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
    async spawn(root, stdio) {
      const tsserver = await Bun.resolve("typescript/lib/tsserver.js", Instance.directory).catch(() => {})
      log.info("typescript server", { tsserver })
      if (!tsserver) return
      const child = await stdio(BunProc.which(), ["x", "typescript-language-server", "--stdio"], {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: child,
        initialization: {
          tsserver: {
            path: tsserver,
          },
        },
      }
    },
  }

  export const Vue: Info = {
    id: LSP_BUILTIN_SERVER_ID.vue,
    extensions: [".vue"],
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
    async spawn(root, stdio) {
      let binary = which("vue-language-server")
      const args: string[] = []
      if (!binary) {
        const js = path.join(
          Global.Path.bin,
          "node_modules",
          "@vue",
          "language-server",
          "bin",
          "vue-language-server.js",
        )
        if (!(await Filesystem.exists(js))) {
          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          await Process.spawnHost([BunProc.which(), "install", "@vue/language-server"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = await stdio(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization: {
          // Leave empty; the server will auto-detect workspace TypeScript.
        },
      }
    },
  }

  export const ESLint: Info = {
    id: LSP_BUILTIN_SERVER_ID.eslint,
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue"],
    async spawn(root, stdio) {
      const eslint = await Bun.resolve("eslint", Instance.directory).catch(() => {})
      if (!eslint) return
      log.info("spawning eslint server")
      const serverPath = path.join(Global.Path.bin, "vscode-eslint", "server", "out", "eslintServer.js")
      if (!(await Filesystem.exists(serverPath))) {
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("downloading and building VS Code ESLint server")
        const response = await fetch("https://github.com/microsoft/vscode-eslint/archive/refs/heads/main.zip")
        if (!response.ok) return

        const zipPath = path.join(Global.Path.bin, "vscode-eslint.zip")
        if (response.body) await Filesystem.writeStream(zipPath, response.body)

        const ok = await Archive.extractZip(zipPath, Global.Path.bin)
          .then(() => true)
          .catch((error) => {
            log.error("Failed to extract vscode-eslint archive", { error })
            return false
          })
        if (!ok) return
        await fs.rm(zipPath, { force: true })

        const extractedPath = path.join(Global.Path.bin, "vscode-eslint-main")
        const finalPath = path.join(Global.Path.bin, "vscode-eslint")

        const stats = await fs.stat(finalPath).catch(() => undefined)
        if (stats) {
          log.info("removing old eslint installation", { path: finalPath })
          await fs.rm(finalPath, { force: true, recursive: true })
        }
        await fs.rename(extractedPath, finalPath)

        const npmCmd = resolveNpmCommand()
        await $`${npmCmd} install`.cwd(finalPath).quiet()
        await $`${npmCmd} run compile`.cwd(finalPath).quiet()

        log.info("installed VS Code ESLint server", { serverPath })
      }

      const proc = await stdio(BunProc.which(), [serverPath, "--stdio"], {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })

      return {
        process: proc,
      }
    },
  }

  export const Oxlint: Info = {
    id: LSP_BUILTIN_SERVER_ID.oxlint,
    root: NearestRoot([
      ".oxlintrc.json",
      "package-lock.json",
      "bun.lockb",
      "bun.lock",
      "pnpm-lock.yaml",
      "yarn.lock",
      "package.json",
    ]),
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".astro", ".svelte"],
    async spawn(root, stdio, runProbe) {
      const ext = process.platform === "win32" ? ".cmd" : ""

      const serverTarget = path.join("node_modules", ".bin", "oxc_language_server" + ext)
      const lintTarget = path.join("node_modules", ".bin", "oxlint" + ext)

      const resolveBin = async (target: string) => {
        const localBin = path.join(root, target)
        if (await Filesystem.exists(localBin)) return localBin

        const candidates = Filesystem.up({
          targets: [target],
          start: root,
          stop: Instance.worktree,
        })
        const first = await candidates.next()
        await candidates.return()
        if (first.value) return first.value

        return undefined
      }

      let lintBin = await resolveBin(lintTarget)
      if (!lintBin) {
        const found = which("oxlint")
        if (found) lintBin = found
      }

      if (lintBin) {
        const probe = await runProbe(root, [lintBin, "--help"])
        if (probe.code === 0) {
          const help = probe.stdout.toString()
          if (help.includes("--lsp")) {
            return {
              process: await stdio(lintBin, ["--lsp"], {
                cwd: root,
              }),
            }
          }
        }
      }

      let serverBin = await resolveBin(serverTarget)
      if (!serverBin) {
        const found = which("oxc_language_server")
        if (found) serverBin = found
      }
      if (serverBin) {
        return {
          process: await stdio(serverBin, [], {
            cwd: root,
          }),
        }
      }

      log.info("oxlint not found, please install oxlint")
      return
    },
  }

  export const Biome: Info = {
    id: LSP_BUILTIN_SERVER_ID.biome,
    root: NearestRoot([
      "biome.json",
      "biome.jsonc",
      "package-lock.json",
      "bun.lockb",
      "bun.lock",
      "pnpm-lock.yaml",
      "yarn.lock",
    ]),
    extensions: [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".mts",
      ".cts",
      ".json",
      ".jsonc",
      ".vue",
      ".astro",
      ".svelte",
      ".css",
      ".graphql",
      ".gql",
      ".html",
    ],
    async spawn(root, stdio) {
      const localBin = path.join(root, "node_modules", ".bin", "biome")
      let bin: string | undefined
      if (await Filesystem.exists(localBin)) bin = localBin
      if (!bin) {
        const found = which("biome")
        if (found) bin = found
      }

      let args = ["lsp-proxy", "--stdio"]

      if (!bin) {
        const resolved = await Bun.resolve("biome", root).catch(() => undefined)
        if (!resolved) return
        bin = BunProc.which()
        args = ["x", "biome", "lsp-proxy", "--stdio"]
      }

      const proc = await stdio(bin, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })

      return {
        process: proc,
      }
    },
  }

  export const Gopls: Info = {
    id: LSP_BUILTIN_SERVER_ID.gopls,
    root: async (file) => {
      const work = await NearestRoot(["go.work"])(file)
      if (work) return work
      return NearestRoot(["go.mod", "go.sum"])(file)
    },
    extensions: [".go"],
    async spawn(root, stdio) {
      let bin = which("gopls", {
        PATH: pathWithBin(),
      })
      if (!bin) {
        if (!which("go")) return
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return

        log.info("installing gopls")
        const proc = Process.spawnHost(["go", "install", "golang.org/x/tools/gopls@latest"], {
          env: { ...process.env, GOBIN: Global.Path.bin },
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("Failed to install gopls")
          return
        }
        bin = path.join(Global.Path.bin, "gopls" + (process.platform === "win32" ? ".exe" : ""))
        log.info(`installed gopls`, {
          bin,
        })
      }
      return {
        process: await stdio(bin!, {
          cwd: root,
        }),
      }
    },
  }

  export const Rubocop: Info = {
    id: LSP_BUILTIN_SERVER_ID.rubyLsp,
    root: NearestRoot(["Gemfile"]),
    extensions: [".rb", ".rake", ".gemspec", ".ru"],
    async spawn(root, stdio) {
      let bin = which("rubocop", {
        PATH: pathWithBin(),
      })
      if (!bin) {
        const ruby = which("ruby")
        const gem = which("gem")
        if (!ruby || !gem) {
          log.info("Ruby not found, please install Ruby first")
          return
        }
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("installing rubocop")
        const proc = Process.spawnHost(["gem", "install", "rubocop", "--bindir", Global.Path.bin], {
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("Failed to install rubocop")
          return
        }
        bin = path.join(Global.Path.bin, "rubocop" + (process.platform === "win32" ? ".exe" : ""))
        log.info(`installed rubocop`, {
          bin,
        })
      }
      return {
        process: await stdio(bin!, ["--lsp"], {
          cwd: root,
        }),
      }
    },
  }

  export const Ty: Info = {
    id: LSP_BUILTIN_SERVER_ID.ty,
    extensions: [".py", ".pyi"],
    root: NearestRoot([
      "pyproject.toml",
      "ty.toml",
      "setup.py",
      "setup.cfg",
      "requirements.txt",
      "Pipfile",
      "pyrightconfig.json",
    ]),
    async spawn(root, stdio) {
      if (!Flag.OPENCORVUS_EXPERIMENTAL_LSP_TY) {
        return undefined
      }

      let binary = which("ty")

      const initialization: Record<string, string> = {}

      const potentialVenvPaths = [process.env["VIRTUAL_ENV"], path.join(root, ".venv"), path.join(root, "venv")].filter(
        (p): p is string => p !== undefined,
      )
      for (const venvPath of potentialVenvPaths) {
        const isWindows = process.platform === "win32"
        const potentialPythonPath = isWindows
          ? path.join(venvPath, "Scripts", "python.exe")
          : path.join(venvPath, "bin", "python")
        if (await Filesystem.exists(potentialPythonPath)) {
          initialization["pythonPath"] = potentialPythonPath
          break
        }
      }

      if (!binary) {
        for (const venvPath of potentialVenvPaths) {
          const isWindows = process.platform === "win32"
          const potentialTyPath = isWindows
            ? path.join(venvPath, "Scripts", "ty.exe")
            : path.join(venvPath, "bin", "ty")
          if (await Filesystem.exists(potentialTyPath)) {
            binary = potentialTyPath
            break
          }
        }
      }

      if (!binary) {
        log.error("ty not found, please install ty first")
        return
      }

      const proc = await stdio(binary, ["server"], {
        cwd: root,
      })

      return {
        process: proc,
        initialization,
      }
    },
  }

  export const Pyright: Info = {
    id: LSP_BUILTIN_SERVER_ID.pyright,
    extensions: [".py", ".pyi"],
    root: NearestRoot(["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile", "pyrightconfig.json"]),
    async spawn(root, stdio) {
      let binary = which("pyright-langserver")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "pyright", "dist", "pyright-langserver.js")
        if (!(await Filesystem.exists(js))) {
          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          await Process.spawnHost([BunProc.which(), "install", "pyright"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
          }).exited
        }
        binary = BunProc.which()
        args.push(...["run", js])
      }
      args.push("--stdio")

      const initialization: Record<string, string> = {}

      const potentialVenvPaths = [process.env["VIRTUAL_ENV"], path.join(root, ".venv"), path.join(root, "venv")].filter(
        (p): p is string => p !== undefined,
      )
      for (const venvPath of potentialVenvPaths) {
        const isWindows = process.platform === "win32"
        const potentialPythonPath = isWindows
          ? path.join(venvPath, "Scripts", "python.exe")
          : path.join(venvPath, "bin", "python")
        if (await Filesystem.exists(potentialPythonPath)) {
          initialization["pythonPath"] = potentialPythonPath
          break
        }
      }

      const proc = await stdio(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization,
      }
    },
  }

  export const ElixirLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.elixirLs,
    extensions: [".ex", ".exs"],
    root: NearestRoot(["mix.exs", "mix.lock"]),
    async spawn(root, stdio) {
      let binary = which("elixir-ls")
      if (!binary) {
        const elixirLsPath = path.join(Global.Path.bin, "elixir-ls")
        binary = path.join(
          Global.Path.bin,
          "elixir-ls-master",
          "release",
          process.platform === "win32" ? "language_server.bat" : "language_server.sh",
        )

        if (!(await Filesystem.exists(binary))) {
          const elixir = which("elixir")
          if (!elixir) {
            log.error("elixir is required to run elixir-ls")
            return
          }

          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          log.info("downloading elixir-ls from GitHub releases")

          const response = await fetch("https://github.com/elixir-lsp/elixir-ls/archive/refs/heads/master.zip")
          if (!response.ok) return
          const zipPath = path.join(Global.Path.bin, "elixir-ls.zip")
          if (response.body) await Filesystem.writeStream(zipPath, response.body)

          const ok = await Archive.extractZip(zipPath, Global.Path.bin)
            .then(() => true)
            .catch((error) => {
              log.error("Failed to extract elixir-ls archive", { error })
              return false
            })
          if (!ok) return

          await fs.rm(zipPath, {
            force: true,
            recursive: true,
          })

          await $`mix deps.get && mix compile && mix elixir_ls.release2 -o release`
            .quiet()
            .cwd(path.join(Global.Path.bin, "elixir-ls-master"))
            .env({ MIX_ENV: "prod", ...process.env })

          log.info(`installed elixir-ls`, {
            path: elixirLsPath,
          })
        }
      }

      return {
        process: await stdio(binary, {
          cwd: root,
        }),
      }
    },
  }

  export const Zls: Info = {
    id: LSP_BUILTIN_SERVER_ID.zls,
    extensions: [".zig", ".zon"],
    root: NearestRoot(["build.zig"]),
    async spawn(root, stdio) {
      let bin = which("zls", {
        PATH: pathWithBin(),
      })

      if (!bin) {
        const zig = which("zig")
        if (!zig) {
          log.error("Zig is required to use zls. Please install Zig first.")
          return
        }

        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("downloading zls from GitHub releases")

        const releaseResponse = await fetch("https://api.github.com/repos/zigtools/zls/releases/latest")
        if (!releaseResponse.ok) {
          log.error("Failed to fetch zls release info")
          return
        }

        const release = (await releaseResponse.json()) as any

        const platform = process.platform
        const arch = process.arch
        let assetName = ""

        let zlsArch: string = arch
        if (arch === "arm64") zlsArch = "aarch64"
        else if (arch === "x64") zlsArch = "x86_64"
        else if (arch === "ia32") zlsArch = "x86"

        let zlsPlatform: string = platform
        if (platform === "darwin") zlsPlatform = "macos"
        else if (platform === "win32") zlsPlatform = "windows"

        const ext = platform === "win32" ? "zip" : "tar.xz"

        assetName = `zls-${zlsArch}-${zlsPlatform}.${ext}`

        const supportedCombos = [
          "zls-x86_64-linux.tar.xz",
          "zls-x86_64-macos.tar.xz",
          "zls-x86_64-windows.zip",
          "zls-aarch64-linux.tar.xz",
          "zls-aarch64-macos.tar.xz",
          "zls-aarch64-windows.zip",
          "zls-x86-linux.tar.xz",
          "zls-x86-windows.zip",
        ]

        if (!supportedCombos.includes(assetName)) {
          log.error(`Platform ${platform} and architecture ${arch} is not supported by zls`)
          return
        }

        const asset = release.assets.find((a: any) => a.name === assetName)
        if (!asset) {
          log.error(`Could not find asset ${assetName} in latest zls release`)
          return
        }

        const downloadUrl = asset.browser_download_url
        const downloadResponse = await fetch(downloadUrl)
        if (!downloadResponse.ok) {
          log.error("Failed to download zls")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        if (downloadResponse.body) await Filesystem.writeStream(tempPath, downloadResponse.body)

        if (ext === "zip") {
          const ok = await Archive.extractZip(tempPath, Global.Path.bin)
            .then(() => true)
            .catch((error) => {
              log.error("Failed to extract zls archive", { error })
              return false
            })
          if (!ok) return
        } else {
          await $`tar -xf ${tempPath}`.cwd(Global.Path.bin).quiet().nothrow()
        }

        await fs.rm(tempPath, { force: true })

        bin = path.join(Global.Path.bin, "zls" + (platform === "win32" ? ".exe" : ""))

        if (!(await Filesystem.exists(bin))) {
          log.error("Failed to extract zls binary")
          return
        }

        if (platform !== "win32") {
          await $`chmod +x ${bin}`.quiet().nothrow()
        }

        log.info(`installed zls`, { bin })
      }

      return {
        process: await stdio(bin, {
          cwd: root,
        }),
      }
    },
  }

  export const CSharp: Info = {
    id: LSP_BUILTIN_SERVER_ID.csharp,
    root: NearestRoot([".slnx", ".sln", ".csproj", "global.json"]),
    extensions: [".cs"],
    async spawn(root, stdio) {
      let bin = which("csharp-ls", {
        PATH: pathWithBin(),
      })
      if (!bin) {
        if (!which("dotnet")) {
          log.error(".NET SDK is required to install csharp-ls")
          return
        }

        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("installing csharp-ls via dotnet tool")
        const proc = Process.spawnHost(["dotnet", "tool", "install", "csharp-ls", "--tool-path", Global.Path.bin], {
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("Failed to install csharp-ls")
          return
        }

        bin = path.join(Global.Path.bin, "csharp-ls" + (process.platform === "win32" ? ".exe" : ""))
        log.info(`installed csharp-ls`, { bin })
      }

      return {
        process: await stdio(bin, {
          cwd: root,
        }),
      }
    },
  }

  export const FSharp: Info = {
    id: LSP_BUILTIN_SERVER_ID.fsharp,
    root: NearestRoot([".slnx", ".sln", ".fsproj", "global.json"]),
    extensions: [".fs", ".fsi", ".fsx", ".fsscript"],
    async spawn(root, stdio) {
      let bin = which("fsautocomplete", {
        PATH: pathWithBin(),
      })
      if (!bin) {
        if (!which("dotnet")) {
          log.error(".NET SDK is required to install fsautocomplete")
          return
        }

        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("installing fsautocomplete via dotnet tool")
        const proc = Process.spawnHost(["dotnet", "tool", "install", "fsautocomplete", "--tool-path", Global.Path.bin], {
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        })
        const exit = await proc.exited
        if (exit !== 0) {
          log.error("Failed to install fsautocomplete")
          return
        }

        bin = path.join(Global.Path.bin, "fsautocomplete" + (process.platform === "win32" ? ".exe" : ""))
        log.info(`installed fsautocomplete`, { bin })
      }

      return {
        process: await stdio(bin, {
          cwd: root,
        }),
      }
    },
  }

  export const SourceKit: Info = {
    id: LSP_BUILTIN_SERVER_ID.sourcekitLsp,
    extensions: [".swift", ".objc", "objcpp"],
    root: NearestRoot(["Package.swift", "*.xcodeproj", "*.xcworkspace"]),
    async spawn(root, stdio) {
      // Check if sourcekit-lsp is available in the PATH
      // This is installed with the Swift toolchain
      const sourcekit = which("sourcekit-lsp")
      if (sourcekit) {
        return {
          process: await stdio(sourcekit, {
            cwd: root,
          }),
        }
      }

      // If sourcekit-lsp not found, check if xcrun is available
      // This is specific to macOS where sourcekit-lsp is typically installed with Xcode
      if (!which("xcrun")) return

      const lspLoc = await $`xcrun --find sourcekit-lsp`.quiet().nothrow()

      if (lspLoc.exitCode !== 0) return

      const bin = lspLoc.text().trim()

      return {
        process: await stdio(bin, {
          cwd: root,
        }),
      }
    },
  }

  export const RustAnalyzer: Info = {
    id: LSP_BUILTIN_SERVER_ID.rust,
    root: async (root) => {
      const crateRoot = await NearestRoot(["Cargo.toml", "Cargo.lock"])(root)
      if (crateRoot === undefined) {
        return undefined
      }
      let currentDir = crateRoot

      while (currentDir !== path.dirname(currentDir)) {
        // Stop at filesystem root
        const cargoTomlPath = path.join(currentDir, "Cargo.toml")
        try {
          const cargoTomlContent = await Filesystem.readText(cargoTomlPath)
          if (cargoTomlContent.includes("[workspace]")) {
            return currentDir
          }
        } catch (err) {
          // File doesn't exist or can't be read, continue searching up
        }

        const parentDir = path.dirname(currentDir)
        if (parentDir === currentDir) break // Reached filesystem root
        currentDir = parentDir

        // Stop if we've gone above the app root
        if (!currentDir.startsWith(Instance.worktree)) break
      }

      return crateRoot
    },
    extensions: [".rs"],
    async spawn(root, stdio) {
      const bin = which("rust-analyzer")
      if (!bin) {
        log.info("rust-analyzer not found in path, please install it")
        return
      }
      return {
        process: await stdio(bin, {
          cwd: root,
        }),
      }
    },
  }

  export const Clangd: Info = {
    id: LSP_BUILTIN_SERVER_ID.clangd,
    root: NearestRoot(["compile_commands.json", "compile_flags.txt", ".clangd", "CMakeLists.txt", "Makefile"]),
    extensions: [".c", ".cpp", ".cc", ".cxx", ".c++", ".h", ".hpp", ".hh", ".hxx", ".h++"],
    async spawn(root, stdio) {
      const args = ["--background-index", "--clang-tidy"]
      const fromPath = which("clangd")
      if (fromPath) {
        return {
          process: await stdio(fromPath, args, {
            cwd: root,
          }),
        }
      }

      const ext = process.platform === "win32" ? ".exe" : ""
      const direct = path.join(Global.Path.bin, "clangd" + ext)
      if (await Filesystem.exists(direct)) {
        return {
          process: await stdio(direct, args, {
            cwd: root,
          }),
        }
      }

      const entries = await fs.readdir(Global.Path.bin, { withFileTypes: true }).catch(() => [])
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (!entry.name.startsWith("clangd_")) continue
        const candidate = path.join(Global.Path.bin, entry.name, "bin", "clangd" + ext)
        if (await Filesystem.exists(candidate)) {
          return {
            process: await stdio(candidate, args, {
              cwd: root,
            }),
          }
        }
      }

      if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
      log.info("downloading clangd from GitHub releases")

      const releaseResponse = await fetch("https://api.github.com/repos/clangd/clangd/releases/latest")
      if (!releaseResponse.ok) {
        log.error("Failed to fetch clangd release info")
        return
      }

      const release: {
        tag_name?: string
        assets?: { name?: string; browser_download_url?: string }[]
      } = await releaseResponse.json()

      const tag = release.tag_name
      if (!tag) {
        log.error("clangd release did not include a tag name")
        return
      }
      const platform = process.platform
      const tokens: Record<string, string> = {
        darwin: "mac",
        linux: "linux",
        win32: "windows",
      }
      const token = tokens[platform]
      if (!token) {
        log.error(`Platform ${platform} is not supported by clangd auto-download`)
        return
      }

      const assets = release.assets ?? []
      const valid = (item: { name?: string; browser_download_url?: string }) => {
        if (!item.name) return false
        if (!item.browser_download_url) return false
        if (!item.name.includes(token)) return false
        return item.name.includes(tag)
      }

      const asset =
        assets.find((item) => valid(item) && item.name?.endsWith(".zip")) ??
        assets.find((item) => valid(item) && item.name?.endsWith(".tar.xz")) ??
        assets.find((item) => valid(item))
      if (!asset?.name || !asset.browser_download_url) {
        log.error("clangd could not match release asset", { tag, platform })
        return
      }

      const name = asset.name
      const downloadResponse = await fetch(asset.browser_download_url)
      if (!downloadResponse.ok) {
        log.error("Failed to download clangd")
        return
      }

      const archive = path.join(Global.Path.bin, name)
      const buf = await downloadResponse.arrayBuffer()
      if (buf.byteLength === 0) {
        log.error("Failed to write clangd archive")
        return
      }
      await Filesystem.write(archive, Buffer.from(buf))

      const zip = name.endsWith(".zip")
      const tar = name.endsWith(".tar.xz")
      if (!zip && !tar) {
        log.error("clangd encountered unsupported asset", { asset: name })
        return
      }

      if (zip) {
        const ok = await Archive.extractZip(archive, Global.Path.bin)
          .then(() => true)
          .catch((error) => {
            log.error("Failed to extract clangd archive", { error })
            return false
          })
        if (!ok) return
      }
      if (tar) {
        await $`tar -xf ${archive}`.cwd(Global.Path.bin).quiet().nothrow()
      }
      await fs.rm(archive, { force: true })

      const bin = path.join(Global.Path.bin, "clangd_" + tag, "bin", "clangd" + ext)
      if (!(await Filesystem.exists(bin))) {
        log.error("Failed to extract clangd binary")
        return
      }

      if (platform !== "win32") {
        await $`chmod +x ${bin}`.quiet().nothrow()
      }

      const alias = path.join(Global.Path.bin, "clangd" + ext)
      await fs.unlink(alias).catch(() => {})
      if (platform === "win32") {
        await fs.copyFile(bin, alias).catch((error) => {
          log.warn("Failed to copy clangd binary alias", { bin, alias, error })
        })
      } else {
        await fs.symlink(bin, alias).catch((error) => {
          log.warn("Failed to symlink clangd binary alias", { bin, alias, error })
        })
      }

      log.info(`installed clangd`, { bin })

      return {
        process: await stdio(bin, args, {
          cwd: root,
        }),
      }
    },
  }

  export const Svelte: Info = {
    id: LSP_BUILTIN_SERVER_ID.svelte,
    extensions: [".svelte"],
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
    async spawn(root, stdio) {
      let binary = which("svelteserver")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "svelte-language-server", "bin", "server.js")
        if (!(await Filesystem.exists(js))) {
          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          await Process.spawnHost([BunProc.which(), "install", "svelte-language-server"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = await stdio(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization: {},
      }
    },
  }

  export const Astro: Info = {
    id: LSP_BUILTIN_SERVER_ID.astro,
    extensions: [".astro"],
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
    async spawn(root, stdio) {
      const tsserver = await Bun.resolve("typescript/lib/tsserver.js", Instance.directory).catch(() => {})
      if (!tsserver) {
        log.info("typescript not found, required for Astro language server")
        return
      }
      const tsdk = path.dirname(tsserver)

      let binary = which("astro-ls")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "@astrojs", "language-server", "bin", "nodeServer.js")
        if (!(await Filesystem.exists(js))) {
          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          await Process.spawnHost([BunProc.which(), "install", "@astrojs/language-server"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = await stdio(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization: {
          typescript: {
            tsdk,
          },
        },
      }
    },
  }

  export const JDTLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.jdtls,
    root: NearestRoot(["pom.xml", "build.gradle", "build.gradle.kts", ".project", ".classpath"]),
    extensions: [".java"],
    async spawn(root, stdio) {
      const java = which("java")
      if (!java) {
        log.error("Java 21 or newer is required to run the JDTLS. Please install it first.")
        return
      }
      const javaMajorVersion = await $`java -version`
        .quiet()
        .nothrow()
        .then(({ stderr }) => {
          const m = /"(\d+)\.\d+\.\d+"/.exec(stderr.toString())
          return !m ? undefined : parseInt(m[1])
        })
      if (javaMajorVersion == null || javaMajorVersion < 21) {
        log.error("JDTLS requires at least Java 21.")
        return
      }
      const distPath = path.join(Global.Path.bin, "jdtls")
      const launcherDir = path.join(distPath, "plugins")
      const installed = await pathExists(launcherDir)
      if (!installed) {
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("Downloading JDTLS LSP server.")
        await fs.mkdir(distPath, { recursive: true })
        const releaseURL =
          "https://www.eclipse.org/downloads/download.php?file=/jdtls/snapshots/jdt-language-server-latest.tar.gz"
        const archiveName = "release.tar.gz"

        log.info("Downloading JDTLS archive", { url: releaseURL, dest: distPath })
        const curlResult = await $`curl -L -o ${archiveName} '${releaseURL}'`.cwd(distPath).quiet().nothrow()
        if (curlResult.exitCode !== 0) {
          log.error("Failed to download JDTLS", { exitCode: curlResult.exitCode, stderr: curlResult.stderr.toString() })
          return
        }

        log.info("Extracting JDTLS archive")
        const tarResult = await $`tar -xzf ${archiveName}`.cwd(distPath).quiet().nothrow()
        if (tarResult.exitCode !== 0) {
          log.error("Failed to extract JDTLS", { exitCode: tarResult.exitCode, stderr: tarResult.stderr.toString() })
          return
        }

        await fs.rm(path.join(distPath, archiveName), { force: true })
        log.info("JDTLS download and extraction completed")
      }
      const jarFileName = await $`ls org.eclipse.equinox.launcher_*.jar`
        .cwd(launcherDir)
        .quiet()
        .nothrow()
        .then(({ stdout }) => stdout.toString().trim())
      const launcherJar = path.join(launcherDir, jarFileName)
      if (!(await pathExists(launcherJar))) {
        log.error(`Failed to locate the JDTLS launcher module in the installed directory: ${distPath}.`)
        return
      }
      const configFile = path.join(
        distPath,
        (() => {
          switch (process.platform) {
            case "darwin":
              return "config_mac"
            case "linux":
              return "config_linux"
            case "win32":
              return "config_win"
            default:
              return "config_linux"
          }
        })(),
      )
      const dataDir = await Global.createTemporaryDirectory("jdtls-data-")
      const childProcess = await stdio(
        java,
        [
          "-jar",
          launcherJar,
          "-configuration",
          configFile,
          "-data",
          dataDir,
          "-Declipse.application=org.eclipse.jdt.ls.core.id1",
          "-Dosgi.bundles.defaultStartLevel=4",
          "-Declipse.product=org.eclipse.jdt.ls.core.product",
          "-Dlog.level=ALL",
          "--add-modules=ALL-SYSTEM",
          "--add-opens java.base/java.util=ALL-UNNAMED",
          "--add-opens java.base/java.lang=ALL-UNNAMED",
        ],
        {
          cwd: root,
        },
      )
      const disposeProcess = childProcess.opencorvusDispose!
      let cleanup: Promise<void> | undefined
      childProcess.opencorvusDispose = async () => {
        if (cleanup) return cleanup
        cleanup = (async () => {
          try {
            await disposeProcess()
          } finally {
            await fs.rm(dataDir, { recursive: true, force: true })
          }
        })()
        return cleanup
      }
      return {
        process: childProcess,
      }
    },
  }

  export const KotlinLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.kotlinLs,
    extensions: [".kt", ".kts"],
    root: async (file) => {
      // 1) Nearest Gradle root (multi-project or included build)
      const settingsRoot = await NearestRoot(["settings.gradle.kts", "settings.gradle"])(file)
      if (settingsRoot) return settingsRoot
      // 2) Gradle wrapper (strong root signal)
      const wrapperRoot = await NearestRoot(["gradlew", "gradlew.bat"])(file)
      if (wrapperRoot) return wrapperRoot
      // 3) Single-project or module-level build
      const buildRoot = await NearestRoot(["build.gradle.kts", "build.gradle"])(file)
      if (buildRoot) return buildRoot
      // 4) Maven project-root detection
      return NearestRoot(["pom.xml"])(file)
    },
    async spawn(root, stdio) {
      const distPath = path.join(Global.Path.bin, "kotlin-ls")
      const launcherScript =
        process.platform === "win32" ? path.join(distPath, "kotlin-lsp.cmd") : path.join(distPath, "kotlin-lsp.sh")
      const installed = await Filesystem.exists(launcherScript)
      if (!installed) {
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("Downloading Kotlin Language Server from GitHub.")

        const releaseResponse = await fetch("https://api.github.com/repos/Kotlin/kotlin-lsp/releases/latest")
        if (!releaseResponse.ok) {
          log.error("Failed to fetch kotlin-lsp release info")
          return
        }

        const release = await releaseResponse.json()
        const version = release.name?.replace(/^v/, "")

        if (!version) {
          log.error("Could not determine Kotlin LSP version from release")
          return
        }

        const platform = process.platform
        const arch = process.arch

        let kotlinArch: string = arch
        if (arch === "arm64") kotlinArch = "aarch64"
        else if (arch === "x64") kotlinArch = "x64"

        let kotlinPlatform: string = platform
        if (platform === "darwin") kotlinPlatform = "mac"
        else if (platform === "linux") kotlinPlatform = "linux"
        else if (platform === "win32") kotlinPlatform = "win"

        const supportedCombos = ["mac-x64", "mac-aarch64", "linux-x64", "linux-aarch64", "win-x64", "win-aarch64"]

        const combo = `${kotlinPlatform}-${kotlinArch}`

        if (!supportedCombos.includes(combo)) {
          log.error(`Platform ${platform}/${arch} is not supported by Kotlin LSP`)
          return
        }

        const assetName = `kotlin-lsp-${version}-${kotlinPlatform}-${kotlinArch}.zip`
        const releaseURL = `https://download-cdn.jetbrains.com/kotlin-lsp/${version}/${assetName}`

        await fs.mkdir(distPath, { recursive: true })
        const archivePath = path.join(distPath, "kotlin-ls.zip")
        await $`curl -L -o '${archivePath}' '${releaseURL}'`.quiet().nothrow()
        const ok = await Archive.extractZip(archivePath, distPath)
          .then(() => true)
          .catch((error) => {
            log.error("Failed to extract Kotlin LS archive", { error })
            return false
          })
        if (!ok) return
        await fs.rm(archivePath, { force: true })
        if (process.platform !== "win32") {
          await $`chmod +x ${launcherScript}`.quiet().nothrow()
        }
        log.info("Installed Kotlin Language Server", { path: launcherScript })
      }
      if (!(await Filesystem.exists(launcherScript))) {
        log.error(`Failed to locate the Kotlin LS launcher script in the installed directory: ${distPath}.`)
        return
      }
      return {
        process: await stdio(launcherScript, ["--stdio"], {
          cwd: root,
        }),
      }
    },
  }

  export const YamlLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.yamlLs,
    extensions: [".yaml", ".yml"],
    root: NearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
    async spawn(root, stdio) {
      let binary = which("yaml-language-server")
      const args: string[] = []
      if (!binary) {
        const js = path.join(
          Global.Path.bin,
          "node_modules",
          "yaml-language-server",
          "out",
          "server",
          "src",
          "server.js",
        )
        const exists = await Filesystem.exists(js)
        if (!exists) {
          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          await Process.spawnHost([BunProc.which(), "install", "yaml-language-server"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = await stdio(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
      }
    },
  }

  export const LuaLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.luaLs,
    root: NearestRoot([
      ".luarc.json",
      ".luarc.jsonc",
      ".luacheckrc",
      ".stylua.toml",
      "stylua.toml",
      "selene.toml",
      "selene.yml",
    ]),
    extensions: [".lua"],
    async spawn(root, stdio) {
      let bin = which("lua-language-server", {
        PATH: pathWithBin(),
      })

      if (!bin) {
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("downloading lua-language-server from GitHub releases")

        const releaseResponse = await fetch("https://api.github.com/repos/LuaLS/lua-language-server/releases/latest")
        if (!releaseResponse.ok) {
          log.error("Failed to fetch lua-language-server release info")
          return
        }

        const release = await releaseResponse.json()

        const platform = process.platform
        const arch = process.arch
        let assetName = ""

        let lualsArch: string = arch
        if (arch === "arm64") lualsArch = "arm64"
        else if (arch === "x64") lualsArch = "x64"
        else if (arch === "ia32") lualsArch = "ia32"

        let lualsPlatform: string = platform
        if (platform === "darwin") lualsPlatform = "darwin"
        else if (platform === "linux") lualsPlatform = "linux"
        else if (platform === "win32") lualsPlatform = "win32"

        const ext = platform === "win32" ? "zip" : "tar.gz"

        assetName = `lua-language-server-${release.tag_name}-${lualsPlatform}-${lualsArch}.${ext}`

        const supportedCombos = [
          "darwin-arm64.tar.gz",
          "darwin-x64.tar.gz",
          "linux-x64.tar.gz",
          "linux-arm64.tar.gz",
          "win32-x64.zip",
          "win32-ia32.zip",
        ]

        const assetSuffix = `${lualsPlatform}-${lualsArch}.${ext}`
        if (!supportedCombos.includes(assetSuffix)) {
          log.error(`Platform ${platform} and architecture ${arch} is not supported by lua-language-server`)
          return
        }

        const asset = release.assets.find((a: any) => a.name === assetName)
        if (!asset) {
          log.error(`Could not find asset ${assetName} in latest lua-language-server release`)
          return
        }

        const downloadUrl = asset.browser_download_url
        const downloadResponse = await fetch(downloadUrl)
        if (!downloadResponse.ok) {
          log.error("Failed to download lua-language-server")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        if (downloadResponse.body) await Filesystem.writeStream(tempPath, downloadResponse.body)

        // Unlike zls which is a single self-contained binary,
        // lua-language-server needs supporting files (meta/, locale/, etc.)
        // Extract entire archive to dedicated directory to preserve all files
        const installDir = path.join(Global.Path.bin, `lua-language-server-${lualsArch}-${lualsPlatform}`)

        // Remove old installation if exists
        const stats = await fs.stat(installDir).catch(() => undefined)
        if (stats) {
          await fs.rm(installDir, { force: true, recursive: true })
        }

        await fs.mkdir(installDir, { recursive: true })

        if (ext === "zip") {
          const ok = await Archive.extractZip(tempPath, installDir)
            .then(() => true)
            .catch((error) => {
              log.error("Failed to extract lua-language-server archive", { error })
              return false
            })
          if (!ok) return
        } else {
          const ok = await $`tar -xzf ${tempPath} -C ${installDir}`
            .quiet()
            .then(() => true)
            .catch((error) => {
              log.error("Failed to extract lua-language-server archive", { error })
              return false
            })
          if (!ok) return
        }

        await fs.rm(tempPath, { force: true })

        // Binary is located in bin/ subdirectory within the extracted archive
        bin = path.join(installDir, "bin", "lua-language-server" + (platform === "win32" ? ".exe" : ""))

        if (!(await Filesystem.exists(bin))) {
          log.error("Failed to extract lua-language-server binary")
          return
        }

        if (platform !== "win32") {
          const ok = await $`chmod +x ${bin}`.quiet().catch((error) => {
            log.error("Failed to set executable permission for lua-language-server binary", {
              error,
            })
          })
          if (!ok) return
        }

        log.info(`installed lua-language-server`, { bin })
      }

      return {
        process: await stdio(bin, {
          cwd: root,
        }),
      }
    },
  }

  export const PHPIntelephense: Info = {
    id: LSP_BUILTIN_SERVER_ID.phpIntelephense,
    extensions: [".php"],
    root: NearestRoot(["composer.json", "composer.lock", ".php-version"]),
    async spawn(root, stdio) {
      let binary = which("intelephense")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "intelephense", "lib", "intelephense.js")
        if (!(await Filesystem.exists(js))) {
          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          await Process.spawnHost([BunProc.which(), "install", "intelephense"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = await stdio(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
        initialization: {
          telemetry: {
            enabled: false,
          },
        },
      }
    },
  }

  export const Prisma: Info = {
    id: LSP_BUILTIN_SERVER_ID.prisma,
    extensions: [".prisma"],
    root: NearestRoot(["schema.prisma", "prisma/schema.prisma", "prisma"], ["package.json"]),
    async spawn(root, stdio) {
      const prisma = which("prisma")
      if (!prisma) {
        log.info("prisma not found, please install prisma")
        return
      }
      return {
        process: await stdio(prisma, ["language-server"], {
          cwd: root,
        }),
      }
    },
  }

  export const Dart: Info = {
    id: LSP_BUILTIN_SERVER_ID.dart,
    extensions: [".dart"],
    root: NearestRoot(["pubspec.yaml", "analysis_options.yaml"]),
    async spawn(root, stdio) {
      const dart = which("dart")
      if (!dart) {
        log.info("dart not found, please install dart first")
        return
      }
      return {
        process: await stdio(dart, ["language-server", "--lsp"], {
          cwd: root,
        }),
      }
    },
  }

  export const Ocaml: Info = {
    id: LSP_BUILTIN_SERVER_ID.ocamlLsp,
    extensions: [".ml", ".mli"],
    root: NearestRoot(["dune-project", "dune-workspace", ".merlin", "opam"]),
    async spawn(root, stdio) {
      const bin = which("ocamllsp")
      if (!bin) {
        log.info("ocamllsp not found, please install ocaml-lsp-server")
        return
      }
      return {
        process: await stdio(bin, {
          cwd: root,
        }),
      }
    },
  }
  export const BashLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.bash,
    extensions: [".sh", ".bash", ".zsh", ".ksh"],
    root: async () => Instance.directory,
    async spawn(root, stdio) {
      let binary = which("bash-language-server")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "bash-language-server", "out", "cli.js")
        if (!(await Filesystem.exists(js))) {
          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          await Process.spawnHost([BunProc.which(), "install", "bash-language-server"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("start")
      const proc = await stdio(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
      }
    },
  }

  export const TerraformLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.terraform,
    extensions: [".tf", ".tfvars"],
    root: NearestRoot([".terraform.lock.hcl", "terraform.tfstate", "*.tf"]),
    async spawn(root, stdio) {
      let bin = which("terraform-ls", {
        PATH: pathWithBin(),
      })

      if (!bin) {
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("downloading terraform-ls from HashiCorp releases")

        const releaseResponse = await fetch("https://api.releases.hashicorp.com/v1/releases/terraform-ls/latest")
        if (!releaseResponse.ok) {
          log.error("Failed to fetch terraform-ls release info")
          return
        }

        const release = (await releaseResponse.json()) as {
          version?: string
          builds?: { arch?: string; os?: string; url?: string }[]
        }

        const platform = process.platform
        const arch = process.arch

        const tfArch = arch === "arm64" ? "arm64" : "amd64"
        const tfPlatform = platform === "win32" ? "windows" : platform

        const builds = release.builds ?? []
        const build = builds.find((b) => b.arch === tfArch && b.os === tfPlatform)
        if (!build?.url) {
          log.error(`Could not find build for ${tfPlatform}/${tfArch} terraform-ls release version ${release.version}`)
          return
        }

        const downloadResponse = await fetch(build.url)
        if (!downloadResponse.ok) {
          log.error("Failed to download terraform-ls")
          return
        }

        const tempPath = path.join(Global.Path.bin, "terraform-ls.zip")
        if (downloadResponse.body) await Filesystem.writeStream(tempPath, downloadResponse.body)

        const ok = await Archive.extractZip(tempPath, Global.Path.bin)
          .then(() => true)
          .catch((error) => {
            log.error("Failed to extract terraform-ls archive", { error })
            return false
          })
        if (!ok) return
        await fs.rm(tempPath, { force: true })

        bin = path.join(Global.Path.bin, "terraform-ls" + (platform === "win32" ? ".exe" : ""))

        if (!(await Filesystem.exists(bin))) {
          log.error("Failed to extract terraform-ls binary")
          return
        }

        if (platform !== "win32") {
          await $`chmod +x ${bin}`.quiet().nothrow()
        }

        log.info(`installed terraform-ls`, { bin })
      }

      return {
        process: await stdio(bin, ["serve"], {
          cwd: root,
        }),
        initialization: {
          experimentalFeatures: {
            prefillRequiredFields: true,
            validateOnSave: true,
          },
        },
      }
    },
  }

  export const TexLab: Info = {
    id: LSP_BUILTIN_SERVER_ID.texlab,
    extensions: [".tex", ".bib"],
    root: NearestRoot([".latexmkrc", "latexmkrc", ".texlabroot", "texlabroot"]),
    async spawn(root, stdio) {
      let bin = which("texlab", {
        PATH: pathWithBin(),
      })

      if (!bin) {
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("downloading texlab from GitHub releases")

        const response = await fetch("https://api.github.com/repos/latex-lsp/texlab/releases/latest")
        if (!response.ok) {
          log.error("Failed to fetch texlab release info")
          return
        }

        const release = (await response.json()) as {
          tag_name?: string
          assets?: { name?: string; browser_download_url?: string }[]
        }
        const version = release.tag_name?.replace("v", "")
        if (!version) {
          log.error("texlab release did not include a version tag")
          return
        }

        const platform = process.platform
        const arch = process.arch

        const texArch = arch === "arm64" ? "aarch64" : "x86_64"
        const texPlatform = platform === "darwin" ? "macos" : platform === "win32" ? "windows" : "linux"
        const ext = platform === "win32" ? "zip" : "tar.gz"
        const assetName = `texlab-${texArch}-${texPlatform}.${ext}`

        const assets = release.assets ?? []
        const asset = assets.find((a) => a.name === assetName)
        if (!asset?.browser_download_url) {
          log.error(`Could not find asset ${assetName} in texlab release`)
          return
        }

        const downloadResponse = await fetch(asset.browser_download_url)
        if (!downloadResponse.ok) {
          log.error("Failed to download texlab")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        if (downloadResponse.body) await Filesystem.writeStream(tempPath, downloadResponse.body)

        if (ext === "zip") {
          const ok = await Archive.extractZip(tempPath, Global.Path.bin)
            .then(() => true)
            .catch((error) => {
              log.error("Failed to extract texlab archive", { error })
              return false
            })
          if (!ok) return
        }
        if (ext === "tar.gz") {
          await $`tar -xzf ${tempPath}`.cwd(Global.Path.bin).quiet().nothrow()
        }

        await fs.rm(tempPath, { force: true })

        bin = path.join(Global.Path.bin, "texlab" + (platform === "win32" ? ".exe" : ""))

        if (!(await Filesystem.exists(bin))) {
          log.error("Failed to extract texlab binary")
          return
        }

        if (platform !== "win32") {
          await $`chmod +x ${bin}`.quiet().nothrow()
        }

        log.info("installed texlab", { bin })
      }

      return {
        process: await stdio(bin, {
          cwd: root,
        }),
      }
    },
  }

  export const DockerfileLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.dockerfile,
    extensions: [".dockerfile", "Dockerfile"],
    root: async () => Instance.directory,
    async spawn(root, stdio) {
      let binary = which("docker-langserver")
      const args: string[] = []
      if (!binary) {
        const js = path.join(Global.Path.bin, "node_modules", "dockerfile-language-server-nodejs", "lib", "server.js")
        if (!(await Filesystem.exists(js))) {
          if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
          await Process.spawnHost([BunProc.which(), "install", "dockerfile-language-server-nodejs"], {
            cwd: Global.Path.bin,
            env: {
              ...process.env,
              BUN_BE_BUN: "1",
            },
            stdout: "pipe",
            stderr: "pipe",
            stdin: "pipe",
          }).exited
        }
        binary = BunProc.which()
        args.push("run", js)
      }
      args.push("--stdio")
      const proc = await stdio(binary, args, {
        cwd: root,
        env: {
          ...process.env,
          BUN_BE_BUN: "1",
        },
      })
      return {
        process: proc,
      }
    },
  }

  export const Gleam: Info = {
    id: LSP_BUILTIN_SERVER_ID.gleam,
    extensions: [".gleam"],
    root: NearestRoot(["gleam.toml"]),
    async spawn(root, stdio) {
      const gleam = which("gleam")
      if (!gleam) {
        log.info("gleam not found, please install gleam first")
        return
      }
      return {
        process: await stdio(gleam, ["lsp"], {
          cwd: root,
        }),
      }
    },
  }

  export const Clojure: Info = {
    id: LSP_BUILTIN_SERVER_ID.clojureLsp,
    extensions: [".clj", ".cljs", ".cljc", ".edn"],
    root: NearestRoot(["deps.edn", "project.clj", "shadow-cljs.edn", "bb.edn", "build.boot"]),
    async spawn(root, stdio) {
      let bin = which("clojure-lsp")
      if (!bin && process.platform === "win32") {
        bin = which("clojure-lsp.exe")
      }
      if (!bin) {
        log.info("clojure-lsp not found, please install clojure-lsp first")
        return
      }
      return {
        process: await stdio(bin, ["listen"], {
          cwd: root,
        }),
      }
    },
  }

  export const Nixd: Info = {
    id: LSP_BUILTIN_SERVER_ID.nixd,
    extensions: [".nix"],
    root: async (file) => {
      // First, look for flake.nix - the most reliable Nix project root indicator
      const flakeRoot = await NearestRoot(["flake.nix"])(file)
      if (flakeRoot && flakeRoot !== Instance.directory) return flakeRoot

      // If no flake.nix, fall back to git repository root
      if (Instance.worktree && Instance.worktree !== Instance.directory) return Instance.worktree

      // Finally, use the configured instance directory
      return Instance.directory
    },
    async spawn(root, stdio) {
      const nixd = which("nixd")
      if (!nixd) {
        log.info("nixd not found, please install nixd first")
        return
      }
      return {
        process: await stdio(nixd, [], {
          cwd: root,
          env: {
            ...process.env,
          },
        }),
      }
    },
  }

  export const Tinymist: Info = {
    id: LSP_BUILTIN_SERVER_ID.tinymist,
    extensions: [".typ", ".typc"],
    root: NearestRoot(["typst.toml"]),
    async spawn(root, stdio) {
      let bin = which("tinymist", {
        PATH: pathWithBin(),
      })

      if (!bin) {
        if (Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD) return
        log.info("downloading tinymist from GitHub releases")

        const response = await fetch("https://api.github.com/repos/Myriad-Dreamin/tinymist/releases/latest")
        if (!response.ok) {
          log.error("Failed to fetch tinymist release info")
          return
        }

        const release = (await response.json()) as {
          tag_name?: string
          assets?: { name?: string; browser_download_url?: string }[]
        }

        const platform = process.platform
        const arch = process.arch

        const tinymistArch = arch === "arm64" ? "aarch64" : "x86_64"
        let tinymistPlatform: string
        let ext: string

        if (platform === "darwin") {
          tinymistPlatform = "apple-darwin"
          ext = "tar.gz"
        } else if (platform === "win32") {
          tinymistPlatform = "pc-windows-msvc"
          ext = "zip"
        } else {
          tinymistPlatform = "unknown-linux-gnu"
          ext = "tar.gz"
        }

        const assetName = `tinymist-${tinymistArch}-${tinymistPlatform}.${ext}`

        const assets = release.assets ?? []
        const asset = assets.find((a) => a.name === assetName)
        if (!asset?.browser_download_url) {
          log.error(`Could not find asset ${assetName} in tinymist release`)
          return
        }

        const downloadResponse = await fetch(asset.browser_download_url)
        if (!downloadResponse.ok) {
          log.error("Failed to download tinymist")
          return
        }

        const tempPath = path.join(Global.Path.bin, assetName)
        if (downloadResponse.body) await Filesystem.writeStream(tempPath, downloadResponse.body)

        if (ext === "zip") {
          const ok = await Archive.extractZip(tempPath, Global.Path.bin)
            .then(() => true)
            .catch((error) => {
              log.error("Failed to extract tinymist archive", { error })
              return false
            })
          if (!ok) return
        } else {
          await $`tar -xzf ${tempPath} --strip-components=1`.cwd(Global.Path.bin).quiet().nothrow()
        }

        await fs.rm(tempPath, { force: true })

        bin = path.join(Global.Path.bin, "tinymist" + (platform === "win32" ? ".exe" : ""))

        if (!(await Filesystem.exists(bin))) {
          log.error("Failed to extract tinymist binary")
          return
        }

        if (platform !== "win32") {
          await $`chmod +x ${bin}`.quiet().nothrow()
        }

        log.info("installed tinymist", { bin })
      }

      return {
        process: await stdio(bin, { cwd: root }),
      }
    },
  }

  export const HLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.haskellLanguageServer,
    extensions: [".hs", ".lhs"],
    root: NearestRoot(["stack.yaml", "cabal.project", "hie.yaml", "*.cabal"]),
    async spawn(root, stdio) {
      const bin = which("haskell-language-server-wrapper")
      if (!bin) {
        log.info("haskell-language-server-wrapper not found, please install haskell-language-server")
        return
      }
      return {
        process: await stdio(bin, ["--lsp"], {
          cwd: root,
        }),
      }
    },
  }

  export const JuliaLS: Info = {
    id: LSP_BUILTIN_SERVER_ID.julials,
    extensions: [".jl"],
    root: NearestRoot(["Project.toml", "Manifest.toml", "*.jl"]),
    async spawn(root, stdio) {
      const julia = which("julia")
      if (!julia) {
        log.info("julia not found, please install julia first (https://julialang.org/downloads/)")
        return
      }
      return {
        process: await stdio(
          julia,
          ["--startup-file=no", "--history-file=no", "-e", "using LanguageServer; runserver()"],
          {
            cwd: root,
          },
        ),
      }
    },
  }
}
