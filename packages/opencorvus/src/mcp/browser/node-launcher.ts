import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "../../global"
import os from "node:os"
import { createHash, randomUUID } from "node:crypto"
import {
  isBunExecutable,
  packagedBrowserNodeRuntimePaths,
  resolveBrowserNodeSidecarRuntime,
} from "@/browser/runtime/node-sidecar"
import { ProcessSupervisor } from "@/shell/process-supervisor"

export namespace BrowserMCPNodeLauncher {
  const CHILD_CLEANUP_TIMEOUT_MS = 2_000
  export const STDIN_GRACEFUL_SHUTDOWN_TIMEOUT_MS = 310_000

  export async function closeChildAfterHostStdin(input: {
    endStdin: () => void
    exited: Promise<number>
    terminate: () => Promise<void>
    timeoutMs?: number
  }): Promise<void> {
    input.endStdin()
    const exitedGracefully = await ProcessSupervisor.awaitWithTimeout(
      input.exited.then(() => true),
      input.timeoutMs ?? STDIN_GRACEFUL_SHUTDOWN_TIMEOUT_MS,
      "Browser MCP node did not exit after stdin close",
    ).catch(() => false)
    if (!exitedGracefully) await input.terminate()
  }

  export async function serveHostStdio() {
    await serve("stdio")
  }

  export async function serveHttp() {
    await serve("http")
  }

  async function serve(transport: "http" | "stdio") {
    const runtime = await resolveRuntime({ transport })
    const { node, bundle } = runtime
    const env = await childEnvironment({ packaged: runtime.packaged })
    const child = await ProcessSupervisor.spawnHostCommand({
      executable: node,
      args: [bundle, transport],
      cwd: process.cwd(),
      env,
      stdin: "pipe",
      gracefulTerminationMs: CHILD_CLEANUP_TIMEOUT_MS,
      owner: "browser-mcp-node",
    })
    if (!child.stdin || !child.stdout || !child.stderr) {
      await child.dispose()
      throw new Error("Browser MCP node supervisor did not expose stdio pipes")
    }
    process.stdin.pipe(child.stdin)
    child.stdout.pipe(process.stdout, { end: false })
    child.stderr.pipe(process.stderr, { end: false })

    let termination: Promise<void> | undefined
    const terminate = () => {
      if (termination) return termination
      const operation = ProcessSupervisor.disposeAndWaitForExit(
        child,
        `browser MCP node ${transport} process tree`,
      ).then(() => undefined)
      termination = operation
      void operation.catch(() => {
        if (termination === operation) termination = undefined
      })
      return operation
    }
    const terminateForSignal = (signal: "SIGINT" | "SIGTERM", exitCode: number) => {
      void terminate().then(
        () => {
          process.exitCode = exitCode
        },
        (error) => {
          logLauncherError(`${signal} terminate failed`, error)
          process.exitCode = 1
        },
      )
    }
    const sigint = () => {
      terminateForSignal("SIGINT", 130)
    }
    const sigterm = () => {
      terminateForSignal("SIGTERM", 143)
    }
    let stdinCloseOperation: Promise<void> | undefined
    const stdinClosed = () => {
      if (stdinCloseOperation) return
      process.stdin.unpipe(child.stdin ?? undefined)
      stdinCloseOperation = closeChildAfterHostStdin({
        endStdin: () => child.stdin?.end(),
        exited: child.exited,
        terminate,
      })
      void stdinCloseOperation.catch((error) => {
        logLauncherError("stdin close cleanup failed", error)
        process.exitCode = 1
      })
    }
    process.once("SIGINT", sigint)
    process.once("SIGTERM", sigterm)
    process.stdin.once("end", stdinClosed)
    process.stdin.once("close", stdinClosed)
    try {
      const code = await child.exited
      await stdinCloseOperation?.catch(() => undefined)
      await ProcessSupervisor.disposeAndWaitForExit(child, `browser MCP node ${transport} process tree`)
      if (code !== 0 && !termination) {
        throw new Error(`browser MCP node ${transport} process exited with code ${code}`)
      }
    } finally {
      process.off("SIGINT", sigint)
      process.off("SIGTERM", sigterm)
      process.stdin.off("end", stdinClosed)
      process.stdin.off("close", stdinClosed)
      process.stdin.unpipe(child.stdin)
      child.stdout.unpipe(process.stdout)
      child.stderr.unpipe(process.stderr)
    }
  }

  export async function resolveRuntime(
    runtime: {
      execPath?: string
      platform?: NodeJS.Platform
      transport?: "http" | "stdio"
      sourceCacheDirectory?: string
    } = {},
  ) {
    const packaged = packagedRuntimePaths(runtime)
    if ((await exists(packaged.node)) && (await exists(packaged.bundle))) return { ...packaged, packaged: true }
    if (isBunExecutable(runtime.execPath ?? process.execPath)) {
      const browserRuntime = await resolveBrowserNodeSidecarRuntime(runtime)
      return {
        node: browserRuntime.nodeExecutable,
        bundle: await resolveSourceBundle(runtime.transport ?? "stdio", runtime.sourceCacheDirectory),
        packaged: false,
      }
    }
    throw new Error(
      `Browser MCP packaged runtime is missing. Expected ${packaged.node} and ${packaged.bundle} beside the opencorvus executable.`,
    )
  }

  export function packagedRuntimePaths(
    runtime: {
      execPath?: string
      platform?: NodeJS.Platform
      transport?: "http" | "stdio"
    } = {},
  ) {
    const packaged = packagedBrowserNodeRuntimePaths(runtime)
    const transport = runtime.transport ?? "stdio"
    return {
      node: packaged.nodeExecutable,
      bundle: packaged.mcpBundle,
    }
  }

  async function resolveSourceBundle(transport: "http" | "stdio", sourceCacheDirectory?: string) {
    return buildSourceBundle(transport, sourceCacheDirectory)
  }

  export async function childEnvironment(input: {
    packaged: boolean
    directory?: string
    env?: NodeJS.ProcessEnv
  }): Promise<NodeJS.ProcessEnv> {
    const env = { ...(input.env ?? process.env) }
    if (input.packaged) {
      env.OPENCORVUS_BROWSER_MCP_PACKAGED = "1"
      delete env.OPENCORVUS_BROWSER_MCP_SOURCE_PACKAGE_DIR
    } else {
      env.OPENCORVUS_BROWSER_MCP_SOURCE_PACKAGE_DIR = path.resolve(import.meta.dir, "../../..")
      delete env.OPENCORVUS_BROWSER_MCP_PACKAGED
    }

    return env
  }

  async function buildSourceBundle(transport: "http" | "stdio", sourceCacheDirectory?: string) {
    if (typeof Bun === "undefined") {
      throw new Error("Browser MCP node bundle is missing and this runtime cannot build it.")
    }
    const outdir = sourceCacheDirectory ?? path.join(Global.Path.cache, "browser-mcp-node")
    await fs.mkdir(outdir, { recursive: true })
    const staging = path.join(outdir, `.${transport}-${process.pid}-${randomUUID()}.mjs`)
    const child = await ProcessSupervisor.spawnHostCommand({
      executable: process.execPath,
      args: [
        "build",
        path.join(import.meta.dir, `${transport}.ts`),
        "--target=node",
        "--external=electron",
        `--outfile=${staging}`,
      ],
      cwd: process.cwd(),
      env: process.env,
      owner: "browser-mcp-source-bundle",
    })
    let stderr = ""
    child.stdout?.resume()
    child.stderr?.setEncoding("utf8")
    child.stderr?.on("data", (chunk) => (stderr += String(chunk)))
    try {
      const code = await child.exited
      await child.outputSettled
      await ProcessSupervisor.disposeAndWaitForExit(child, `browser MCP ${transport} source bundle build`)
      if (code !== 0) throw new Error(`Failed to build Browser MCP node bundle: ${stderr.trim()}`)
      const bytes = await fs.readFile(staging)
      const digest = createHash("sha256").update(bytes).digest("hex")
      const published = path.join(outdir, `${transport}-${digest}.mjs`)
      if (await exists(published)) return published
      try {
        await fs.rename(staging, published)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== "EEXIST" && code !== "ENOTEMPTY") throw error
        if (!(await exists(published))) throw error
      }
      return published
    } catch (error) {
      await ProcessSupervisor.disposeAndWaitForExit(child, `browser MCP ${transport} source bundle cleanup`).catch(
        () => undefined,
      )
      throw error
    } finally {
      await fs.unlink(staging).catch(() => undefined)
    }
  }

  async function exists(file: string) {
    return fs
      .access(file)
      .then(() => true)
      .catch(() => false)
  }

  function logLauncherError(message: string, error: unknown) {
    console.error(`[browser-mcp-launcher] ${message}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
