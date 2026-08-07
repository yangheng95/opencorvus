import { spawn as nodeSpawn, type ChildProcess } from "node:child_process"
import { createInterface } from "node:readline"
import fs from "node:fs/promises"
import path from "node:path"
import {
  browserNodeExecutableName,
  isBunExecutable,
  packagedBrowserNodeRuntimePaths,
} from "@/browser/runtime/node-sidecar"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { requireRuntimePackage, runtimePackageRequire } from "@/runtime/package-require"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { Log } from "@/util/log"

const MAX_BUFFER_BYTES = 1_000_000
const BUFFER_CHUNK = 64 * 1024
const encoder = new TextEncoder()
const log = Log.create({ service: "pty" })
const NODE_BRIDGE_SCRIPT = String.raw`
const readline = require("node:readline")

const payload = JSON.parse(Buffer.from(process.argv[1], "base64").toString("utf8"))
const Pty = require(payload.nodePtyRequirePath)
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n")
}
let proc
try {
  proc = Pty.spawn(payload.command, payload.args, {
    name: "xterm-256color",
    cols: payload.cols,
    rows: payload.rows,
    cwd: payload.cwd,
    env: { ...process.env, ...payload.env },
    useConptyDll: false,
  })
  proc.on("error", (error) => {
    send({ type: "error", error: error instanceof Error ? error.message : String(error) })
  })
  send({ type: "ready" })
} catch (error) {
  send({ type: "startup_error", error: error instanceof Error ? error.message : String(error) })
  process.exit(1)
}
proc.onData((data) => send({ type: "data", data }))
proc.onExit((event) => {
  send({ type: "exit", exitCode: event.exitCode })
  process.exit(0)
})
const reader = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
reader.on("line", (line) => {
  try {
    const message = JSON.parse(line)
    if (message.type === "input") proc.write(message.data)
    if (message.type === "resize") proc.resize(message.cols, message.rows)
    if (message.type === "kill") proc.kill()
  } catch (error) {
    send({ type: "error", error: error instanceof Error ? error.message : String(error) })
  }
})
process.on("SIGTERM", () => proc.kill())
`

type HostStatus = "idle" | "running" | "exited"
type PtyExitEvent = { exitCode: number | null }
type ExitHandler = (event: PtyExitEvent) => void

interface HostConnection {
  send(chunk: string | Uint8Array<ArrayBuffer>): void
  close(code?: number, reason?: string): void
}

export interface HostProcess {
  pid: number
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(): Promise<void>
  onData(handler: (chunk: string) => void): void
  onError(handler: (error: Error) => void): void
  onExit(handler: ExitHandler): void
}

interface HostSession {
  id: string
  title: string
  command: PtyPreparedCommand
  process: HostProcess | null
  status: HostStatus
  cols: number
  rows: number
  buffer: string
  bufferCursor: number
  cursor: number
  connections: Set<HostConnection>
  exitHandlers: Set<ExitHandler>
  exitCode: number | null
  createdAt: number
  updatedAt: number
}

export interface PtyPreparedCommand {
  command: string
  args: string[]
  cwd: string
  directory: string
  url?: string
  port?: number
  hostname?: string
  env?: Record<string, string>
}

const state = createInstanceState(
  () => ({
    sessions: new Map<string, HostSession>(),
    primaryID: null as string | null,
    bridgeCleanupPending: new Set<() => Promise<void>>(),
  }),
  async (s) => {
    const failures: unknown[] = []
    for (const session of s.sessions.values()) {
      try {
        await closeSession(session, "PTY host stopped")
      } catch (error) {
        failures.push(error)
      }
    }
    try {
      await settlePendingBridgeCleanup(s)
    } catch (error) {
      failures.push(error)
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, `PTY host cleanup failed for ${failures.length} owner(s)`)
    }
    s.sessions.clear()
    s.primaryID = null
  },
  "pty-host",
)

function meta(cursor: number) {
  const json = JSON.stringify({ cursor })
  const bytes = encoder.encode(json)
  const out = new Uint8Array(bytes.length + 1)
  out[0] = 0
  out.set(bytes, 1)
  return out
}

function appendBuffer(session: HostSession, chunk: string) {
  session.cursor += chunk.length
  session.buffer += chunk
  while (Buffer.byteLength(session.buffer, "utf8") > MAX_BUFFER_BYTES) {
    const remove = Math.max(1, Math.floor(session.buffer.length / 4))
    session.buffer = session.buffer.slice(remove)
    session.bufferCursor += remove
  }
  session.updatedAt = Date.now()
  for (const connection of session.connections) {
    try {
      connection.send(chunk)
    } catch {
      session.connections.delete(connection)
    }
  }
}

function readOutput(session: HostSession | null, cursor?: number) {
  const end = session?.cursor ?? 0
  const start = session?.bufferCursor ?? 0
  const from =
    cursor === -1 ? end : typeof cursor === "number" && Number.isSafeInteger(cursor) ? Math.max(0, cursor) : 0
  const data = (() => {
    if (!session?.buffer || from >= end) return ""
    const offset = Math.max(0, from - start)
    if (offset >= session.buffer.length) return ""
    return session.buffer.slice(offset)
  })()
  return {
    ...info(session),
    data,
    cursor: end,
    from,
    truncated: !!session && from < start,
  }
}

function info(session: HostSession | null) {
  if (!session) {
    return {
      id: null,
      running: false,
      status: "idle" as const,
      cols: null,
      rows: null,
      url: null,
      directory: Instance.current()?.directory ?? null,
      title: null,
      command: null,
      args: null,
      pid: null,
      exitCode: null,
      createdAt: null,
      updatedAt: null,
    }
  }
  return {
    id: session.id,
    running: session.status === "running" && !!session.process,
    status: session.status,
    cols: session.cols,
    rows: session.rows,
    url: session.command.url,
    directory: session.command.directory,
    title: session.title,
    command: session.command.command,
    args: session.command.args,
    pid: session.process?.pid ?? 0,
    exitCode: session.exitCode,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

function currentSession() {
  const s = state()
  return s.primaryID ? (s.sessions.get(s.primaryID) ?? null) : null
}

async function closeSession(session: HostSession, reason: string) {
  const closeFailures: unknown[] = []
  for (const connection of [...session.connections]) {
    try {
      connection.close(1000, reason)
      session.connections.delete(connection)
    } catch (error) {
      closeFailures.push(error)
    }
  }
  const process = session.process
  let processFailure: unknown
  try {
    await process?.kill()
  } catch (error) {
    processFailure = error
  }
  if (!processFailure) {
    if (session.process === process) session.process = null
    session.status = "exited"
    session.updatedAt = Date.now()
  }
  const failures = [...closeFailures, ...(processFailure ? [processFailure] : [])]
  if (failures.length > 0) {
    throw new AggregateError(failures, `PTY session ${session.id} cleanup failed`)
  }
}

function hostExitReason(exitCode: number | null) {
  return exitCode === null ? "PTY host exited" : `PTY host exited with code ${exitCode}`
}

function assertSize(cols: number, rows: number) {
  if (!Number.isInteger(cols) || cols < 1 || cols > 500) throw new Error("cols must be an integer from 1 to 500")
  if (!Number.isInteger(rows) || rows < 1 || rows > 200) throw new Error("rows must be an integer from 1 to 200")
}

function directPtyProcess(input: {
  command: PtyPreparedCommand
  cols: number
  rows: number
  env: Record<string, string>
}): HostProcess {
  const nodePty = requireRuntimePackage<typeof import("@lydell/node-pty")>("@lydell/node-pty")
  const proc = nodePty.spawn(input.command.command, input.command.args, {
    name: "xterm-256color",
    cols: input.cols,
    rows: input.rows,
    cwd: input.command.cwd,
    env: input.env,
    useConptyDll: false,
  })
  let exited = false
  let exitEvent: { exitCode: number | null } | undefined
  const exitHandlers = new Set<ExitHandler>()
  const errorHandlers = new Set<(error: Error) => void>()
  const pendingErrors: Error[] = []
  const emitError = (error: Error) => {
    if (errorHandlers.size === 0) {
      pendingErrors.push(error)
      return
    }
    for (const handler of errorHandlers) handler(error)
  }
  // @lydell/node-pty exposes EventEmitter errors at runtime even though the
  // public IPty declaration omits `on("error")`. Its Windows adapter closes
  // the terminal and rethrows a socket error when no external owner is
  // registered, so the host must subscribe immediately after spawn.
  ;(
    proc as typeof proc & {
      on(event: "error", handler: (error: Error) => void): void
    }
  ).on("error", emitError)
  const waitForExit = (timeoutMs: number) =>
    new Promise<boolean>((resolve) => {
      if (exited) {
        resolve(true)
        return
      }
      const timer = setTimeout(() => {
        exitHandlers.delete(onExit)
        resolve(false)
      }, timeoutMs)
      unrefTimer(timer)
      const onExit = () => {
        clearTimeout(timer)
        resolve(true)
      }
      exitHandlers.add(onExit)
    })
  proc.onExit((event) => {
    exited = true
    exitEvent = { exitCode: event.exitCode }
    for (const handler of exitHandlers) handler(exitEvent)
    exitHandlers.clear()
  })
  return {
    pid: proc.pid,
    write: (data) => proc.write(data),
    resize: (cols, rows) => proc.resize(cols, rows),
    kill: async () => {
      if (!exited) proc.kill()
      if (await waitForExit(2_000)) return
      throw new Error(`PTY process ${proc.pid} did not exit after kill`)
    },
    onData: (handler) => proc.onData(handler),
    onError: (handler) => {
      errorHandlers.add(handler)
      for (const error of pendingErrors.splice(0)) handler(error)
    },
    onExit: (handler) => {
      if (exitEvent) {
        handler(exitEvent)
        return
      }
      exitHandlers.add(handler)
    },
  }
}

async function exists(file: string) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}

async function resolvePtyNodeRuntime() {
  const packaged = packagedBrowserNodeRuntimePaths()
  if (await exists(packaged.nodeExecutable)) {
    const runtimeRoot = path.dirname(packaged.nodeExecutable)
    return {
      nodeExecutable: packaged.nodeExecutable,
      cwd: runtimeRoot,
      nodePtyRequirePath: path.join(runtimeRoot, "node_modules", "@lydell", "node-pty", "index.js"),
    }
  }
  if (isBunExecutable(process.execPath)) {
    return {
      nodeExecutable: process.env.OPENCORVUS_PTY_NODE ?? browserNodeExecutableName(process.platform),
      cwd: process.cwd(),
      nodePtyRequirePath: runtimePackageRequire().resolve("@lydell/node-pty"),
    }
  }
  throw new Error(`PTY Node runtime is missing. Expected ${packaged.nodeExecutable} beside the opencorvus executable.`)
}

function bridgeMessage(child: ChildProcess, message: unknown) {
  if (!child.stdin?.writable || child.stdin.destroyed || child.exitCode !== null) return
  try {
    child.stdin.write(JSON.stringify(message) + "\n")
  } catch {
    // The bridge process can exit between the writable check and write.
  }
}

function bridgeExited(child: ChildProcess) {
  return child.exitCode !== null || child.signalCode !== null
}

function unrefTimer(timer: ReturnType<typeof setTimeout>) {
  const unref = timer as { unref?: () => void }
  unref.unref?.()
}

async function waitForBridgeExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (bridgeExited(child)) return true
  return await new Promise<boolean>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.off("exit", onExit)
      resolve(false)
    }, timeoutMs)
    unrefTimer(timer)
    const onExit = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(true)
    }
    child.once("exit", onExit)
  })
}

async function waitForChildProcessIDExit(processID: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!processIDIsRunning(processID)) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return !processIDIsRunning(processID)
}

function processIDIsRunning(processID: number): boolean {
  try {
    process.kill(processID, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ESRCH") return false
    return code === "EPERM"
  }
}

async function forceKillBridgeChild(child: ChildProcess) {
  if (bridgeExited(child) || !child.pid) return
  if (process.platform === "win32") {
    await ProcessSupervisor.terminateProcessTree(child.pid, `PTY bridge process tree ${child.pid}`)
    return
  }
  child.kill("SIGKILL")
  if (await waitForBridgeExit(child, 1_000)) return
  throw new Error(`PTY bridge process ${child.pid} did not exit after SIGKILL`)
}

async function terminateBridgeChild(child: ChildProcess) {
  if (bridgeExited(child)) return
  bridgeMessage(child, { type: "kill" })
  child.stdin?.end()
  if (await waitForBridgeExit(child, 1_000)) return
  child.kill("SIGTERM")
  if (await waitForBridgeExit(child, 1_000)) return
  await forceKillBridgeChild(child)
}

async function waitForBridgeSpawn(child: ChildProcess, executable: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      child.off("spawn", onSpawn)
      child.off("error", onError)
      child.off("exit", onExit)
    }
    const onSpawn = () => {
      cleanup()
      resolve()
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup()
      reject(new Error(`PTY bridge ${executable} exited before startup with ${signal ?? code}`))
    }
    child.once("spawn", onSpawn)
    child.once("error", onError)
    child.once("exit", onExit)
  })
}

async function nodeBridgePtyProcess(input: {
  command: PtyPreparedCommand
  cols: number
  rows: number
  env: Record<string, string>
}): Promise<HostProcess> {
  const runtime = await resolvePtyNodeRuntime()
  const payload = Buffer.from(
    JSON.stringify({
      command: input.command.command,
      args: input.command.args,
      cwd: input.command.cwd,
      cols: input.cols,
      rows: input.rows,
      env: input.env,
      nodePtyRequirePath: runtime.nodePtyRequirePath,
    }),
    "utf8",
  ).toString("base64")
  const child = nodeSpawn(runtime.nodeExecutable, ["-e", NODE_BRIDGE_SCRIPT, payload], {
    cwd: runtime.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  })
  await waitForBridgeSpawn(child, runtime.nodeExecutable)
  child.stdin?.on("error", () => {
    // The Pseudo Terminal (PTY) child may exit before a late kill/input message reaches stdin.
  })
  const dataHandlers: Array<(chunk: string) => void> = []
  const errorHandlers: Array<(error: Error) => void> = []
  const exitHandlers: ExitHandler[] = []
  const pendingData: string[] = []
  const pendingErrors: Error[] = []
  let pendingExit: { exitCode: number | null } | undefined
  let exited = false
  let bridgeReadySettled = false
  let resolveBridgeReady: (() => void) | undefined
  let rejectBridgeReady: ((error: Error) => void) | undefined
  const bridgeReady = new Promise<void>((resolve, reject) => {
    resolveBridgeReady = () => {
      if (bridgeReadySettled) return
      bridgeReadySettled = true
      resolve()
    }
    rejectBridgeReady = (error) => {
      if (bridgeReadySettled) return
      bridgeReadySettled = true
      reject(error)
    }
  })

  const emitData = (chunk: string) => {
    if (dataHandlers.length === 0) {
      pendingData.push(chunk)
      return
    }
    for (const handler of dataHandlers) handler(chunk)
  }

  const emitError = (error: Error) => {
    if (errorHandlers.length === 0) {
      pendingErrors.push(error)
      return
    }
    for (const handler of errorHandlers) handler(error)
  }

  const emitExit = (event: { exitCode: number | null }) => {
    if (exitHandlers.length === 0) {
      pendingExit = event
      return
    }
    for (const handler of exitHandlers) handler(event)
  }

  child.stderr?.setEncoding("utf8")
  child.stderr?.on("data", (chunk) => {
    emitData(String(chunk))
  })

  const reader = createInterface({ input: child.stdout!, crlfDelay: Infinity })
  reader.on("line", (line) => {
    const message = JSON.parse(line) as
      | { type: "ready" }
      | { type: "startup_error"; error: string }
      | { type: "data"; data: string }
      | { type: "exit"; exitCode: number | null }
      | { type: "error"; error: string }
    if (message.type === "ready") {
      resolveBridgeReady?.()
      return
    }
    if (message.type === "startup_error") {
      rejectBridgeReady?.(new Error(`PTY bridge startup failed: ${message.error}`))
      return
    }
    if (message.type === "data") {
      emitData(message.data)
    }
    if (message.type === "error") {
      emitError(new Error(message.error))
    }
    if (message.type === "exit" && !exited) {
      exited = true
      emitExit({ exitCode: message.exitCode })
    }
  })
  child.on("exit", (exitCode) => {
    rejectBridgeReady?.(new Error(`PTY bridge ${runtime.nodeExecutable} exited before PTY startup with ${exitCode}`))
    if (exited) return
    exited = true
    emitExit({ exitCode })
  })
  child.on("error", (error) => {
    rejectBridgeReady?.(error)
    emitData(error.message)
  })

  try {
    await bridgeReady
  } catch (startupError) {
    const cleanup = () => forceKillBridgeChild(child)
    try {
      await cleanup()
    } catch (cleanupError) {
      state().bridgeCleanupPending.add(cleanup)
      throw new AggregateError(
        [startupError, cleanupError],
        `PTY bridge ${runtime.nodeExecutable} startup and cleanup failed`,
      )
    }
    throw startupError
  }

  let termination: Promise<void> | undefined
  return {
    pid: child.pid ?? 0,
    write: (data) => bridgeMessage(child, { type: "input", data }),
    resize: (cols, rows) => bridgeMessage(child, { type: "resize", cols, rows }),
    kill: () => {
      if (termination) return termination
      const operation = terminateBridgeChild(child)
      termination = operation
      void operation.catch(() => {
        if (termination === operation) {
          termination = undefined
        }
      })
      return operation
    },
    onData: (handler) => {
      dataHandlers.push(handler)
      for (const chunk of pendingData.splice(0)) handler(chunk)
    },
    onError: (handler) => {
      errorHandlers.push(handler)
      for (const error of pendingErrors.splice(0)) handler(error)
    },
    onExit: (handler) => {
      exitHandlers.push(handler)
      if (pendingExit) handler(pendingExit)
    },
  }
}

export function ptyHostRuntimeKind(
  input: { platform?: NodeJS.Platform; bunRuntime?: boolean } = {},
): "node-bridge" | "direct" {
  const platform = input.platform ?? process.platform
  const bunRuntime = input.bunRuntime ?? (typeof Bun !== "undefined" && typeof Bun.version === "string")
  return platform === "win32" && bunRuntime ? "node-bridge" : "direct"
}

async function hostProcess(input: {
  command: PtyPreparedCommand
  cols: number
  rows: number
  env: Record<string, string>
}) {
  if (ptyHostRuntimeKind() === "node-bridge") {
    return nodeBridgePtyProcess(input)
  }
  return directPtyProcess(input)
}

async function settlePendingBridgeCleanup(owner: ReturnType<typeof state>) {
  const pending = [...owner.bridgeCleanupPending]
  if (pending.length === 0) return
  const results = await Promise.allSettled(
    pending.map(async (cleanup) => {
      await cleanup()
      owner.bridgeCleanupPending.delete(cleanup)
    }),
  )
  const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
  if (failures.length > 0) {
    throw new AggregateError(failures, `PTY bridge cleanup retry failed for ${failures.length} owner(s)`)
  }
}

export function retainPtyBridgeCleanupForTest(cleanup: () => Promise<void>) {
  state().bridgeCleanupPending.add(cleanup)
}

type HostProcessFactory = typeof hostProcess
let createHostProcess: HostProcessFactory = hostProcess

export function setPtyHostProcessFactoryForTest(next: HostProcessFactory | undefined) {
  const previous = createHostProcess
  createHostProcess = next ?? hostProcess
  return () => {
    createHostProcess = previous
  }
}

async function spawnPrepared(input: {
  command: PtyPreparedCommand
  cols: number
  rows: number
  title?: string
  onExit?: (id: string, event: PtyExitEvent) => void
}) {
  assertSize(input.cols, input.rows)
  const owner = state()
  const now = Date.now()
  const session: HostSession = {
    id: Identifier.ascending("pty"),
    title: input.title ?? "Pseudo Terminal",
    command: input.command,
    process: null,
    status: "running",
    cols: input.cols,
    rows: input.rows,
    buffer: "",
    bufferCursor: 0,
    cursor: 0,
    connections: new Set(),
    exitHandlers: new Set(),
    exitCode: null,
    createdAt: now,
    updatedAt: now,
  }
  if (input.onExit) session.exitHandlers.add((event) => input.onExit!(session.id, event))
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      ...input.command.env,
      OPENCORVUS_PTY_HOST: "1",
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
  await settlePendingBridgeCleanup(owner)
  const proc = await createHostProcess({
    command: input.command,
    cols: input.cols,
    rows: input.rows,
    env,
  })
  session.process = proc
  proc.onData((chunk) => appendBuffer(session, chunk))
  proc.onError((error) => {
    log.warn("PTY process error", {
      id: session.id,
      command: session.command.command,
      error,
    })
    appendBuffer(session, `\r\n[PTY error] ${error.message}\r\n`)
  })
  proc.onExit((event) => {
    session.status = "exited"
    session.process = null
    session.exitCode = event.exitCode
    session.updatedAt = Date.now()
    for (const connection of [...session.connections]) {
      try {
        connection.close(4405, hostExitReason(event.exitCode))
        session.connections.delete(connection)
      } catch (error) {
        log.warn("PTY connection close failed after process exit", {
          id: session.id,
          error,
        })
      }
    }
    for (const handler of session.exitHandlers) handler(event)
    session.exitHandlers.clear()
    if (session.connections.size === 0 && owner.sessions.get(session.id) === session) {
      owner.sessions.delete(session.id)
      if (owner.primaryID === session.id) owner.primaryID = Array.from(owner.sessions.keys()).at(-1) ?? null
    }
  })
  return session
}

export namespace PtyHost {
  export type Info = ReturnType<typeof info>
  export type Snapshot = Info & { buffer: string }
  export type Output = ReturnType<typeof readOutput>
  export type PreparedConnection = {
    attach(input: HostConnection): {
      onMessage(data: string): void
      onClose(): void
    }
  }

  export async function startPrepared(input: {
    command: PtyPreparedCommand
    cols?: number
    rows?: number
    title?: string
    onExit?: (id: string, event: PtyExitEvent) => void
  }) {
    const s = state()
    const session = await spawnPrepared({
      command: input.command,
      cols: input.cols ?? 100,
      rows: input.rows ?? 30,
      title: input.title,
      onExit: input.onExit,
    })
    if (session.status === "running") {
      s.sessions.set(session.id, session)
      s.primaryID = session.id
    }
    return info(session)
  }

  export function status() {
    return info(currentSession())
  }

  export function list() {
    return Array.from(state().sessions.values()).map((session) => info(session))
  }

  export function get(id: string) {
    return info(state().sessions.get(id) ?? null)
  }

  export function snapshot(): Snapshot {
    const session = currentSession()
    return {
      ...info(session),
      buffer: session?.buffer ?? "",
    }
  }

  export function output(input?: { cursor?: number }): Output {
    return readOutput(currentSession(), input?.cursor)
  }

  export function preparePtyConnect(input: { id: string; cursor?: number }): PreparedConnection {
    const s = state()
    const session = s.sessions.get(input.id)
    if (!session?.process || session.status !== "running" || session.id !== input.id) {
      throw new Error("PTY session not found")
    }
    const retained = readOutput(session, input.cursor)
    return {
      attach(connection) {
        if (!session.process || session.status !== "running") {
          connection.close(4404, "PTY session is not running")
          return {
            onMessage() {},
            onClose() {},
          }
        }
        session.connections.add(connection)
        if (retained.data) {
          for (let i = 0; i < retained.data.length; i += BUFFER_CHUNK) {
            connection.send(retained.data.slice(i, i + BUFFER_CHUNK))
          }
        }
        connection.send(meta(retained.cursor))
        return {
          onMessage(data) {
            if (!session.process || session.status !== "running") return
            session.process.write(data)
            session.updatedAt = Date.now()
          },
          onClose() {
            session.connections.delete(connection)
          },
        }
      },
    }
  }

  export function input(data: string) {
    const session = currentSession()
    if (!session?.process || session.status !== "running") throw new Error("PTY host is not running")
    session.process.write(data)
    session.updatedAt = Date.now()
    return true
  }

  export function inputPty(input: { id: string; data: string }) {
    const session = state().sessions.get(input.id)
    if (!session?.process || session.status !== "running") return
    session.process.write(input.data)
    session.updatedAt = Date.now()
    return true
  }

  export function resize(input: { cols: number; rows: number }) {
    assertSize(input.cols, input.rows)
    const session = currentSession()
    if (!session?.process || session.status !== "running") throw new Error("PTY host is not running")
    session.process.resize(input.cols, input.rows)
    session.cols = input.cols
    session.rows = input.rows
    session.updatedAt = Date.now()
    return info(session)
  }

  export function rename(input: { id: string; title: string }) {
    const session = state().sessions.get(input.id)
    if (!session || session.id !== input.id) throw new Error("PTY session not found")
    session.title = input.title
    session.updatedAt = Date.now()
    return info(session)
  }

  export function resizePty(input: { id: string; cols: number; rows: number }) {
    assertSize(input.cols, input.rows)
    const session = state().sessions.get(input.id)
    if (!session?.process || session.status !== "running") throw new Error("PTY session not found")
    session.process.resize(input.cols, input.rows)
    session.cols = input.cols
    session.rows = input.rows
    session.updatedAt = Date.now()
    return info(session)
  }

  export async function stop() {
    const s = state()
    const session = currentSession()
    if (!session) return true
    await closeSession(session, "PTY host stopped")
    s.sessions.delete(session.id)
    if (s.primaryID === session.id) s.primaryID = Array.from(s.sessions.keys()).at(-1) ?? null
    return true
  }

  export async function remove(input: { id: string }) {
    const s = state()
    const session = s.sessions.get(input.id)
    if (!session) return true
    await closeSession(session, "PTY session removed")
    s.sessions.delete(input.id)
    if (s.primaryID === input.id) s.primaryID = Array.from(s.sessions.keys()).at(-1) ?? null
    return true
  }
}
