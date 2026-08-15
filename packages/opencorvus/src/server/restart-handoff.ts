import { randomUUID } from "node:crypto"
import { Env } from "@/runtime/env"
import { ProcessSupervisor } from "@/shell/process-supervisor"

const RESTART_HANDOFF_ENV = "OPENCORVUS_RESTART_HANDOFF"
const RESTART_HANDOFF_PREFIX = "OPENCORVUS_RESTART:"
const RESTART_HANDOFF_TIMEOUT_MS = 15_000
const RESTART_BIND_PROBE_INTERVAL_MS = 25
const SUPERVISOR_OWNED_RESTART_ENV = [
  "OPENCORVUS_PROCESS_OCCURRENCE_ID",
  "OPENCORVUS_PROCESS_OCCURRENCE_PATH",
  "OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH",
  "OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH",
] as const

export function restartReplacementEnvironment(
  base: Record<string, string>,
  overrides?: Record<string, string>,
): Record<string, string> {
  const environment = { ...base, ...overrides }
  for (const name of SUPERVISOR_OWNED_RESTART_ENV) delete environment[name]
  return environment
}

export interface RestartHandoff {
  token: string
  hostname: string
  port: number
}

type RestartMessage =
  | { token: string; type: "waiting"; pid: number }
  | { token: string; type: "ready"; pid: number; url: string }
  | { token: string; type: "failed"; pid: number; error: string }
type ChildRestartMessage = { type: "waiting" } | { type: "ready"; url: string } | { type: "failed"; error: string }

function parseHandoff(raw: string | undefined): RestartHandoff | undefined {
  if (!raw) return
  const parsed = JSON.parse(raw) as Partial<RestartHandoff>
  if (
    typeof parsed.token !== "string" ||
    parsed.token.length === 0 ||
    typeof parsed.hostname !== "string" ||
    parsed.hostname.length === 0 ||
    !Number.isInteger(parsed.port) ||
    parsed.port! <= 0
  ) {
    throw new Error("Invalid restart handoff environment")
  }
  return parsed as RestartHandoff
}

export function childRestartHandoff() {
  return parseHandoff(Env.snapshot()[RESTART_HANDOFF_ENV])
}

export function sendRestartHandoffMessage(message: ChildRestartMessage, handoff: RestartHandoff) {
  process.stdout.write(
    `${RESTART_HANDOFF_PREFIX}${JSON.stringify({ ...message, token: handoff.token, pid: process.pid })}\n`,
  )
}

export async function waitForRestartBind(handoff: RestartHandoff) {
  sendRestartHandoffMessage({ type: "waiting" }, handoff)
  await ProcessSupervisor.awaitWithTimeout(
    new Promise<void>((resolve, reject) => {
      let buffer = ""
      const cleanup = () => {
        process.stdin.off("data", onData)
        process.stdin.off("error", onError)
        process.stdin.off("end", onEnd)
      }
      const onError = (error: Error) => {
        cleanup()
        reject(error)
      }
      const onEnd = () => {
        cleanup()
        reject(new Error("Restart parent closed the handoff channel before bind"))
      }
      const onData = (chunk: Buffer | string) => {
        buffer += chunk.toString()
        for (const line of buffer.split(/\r?\n/)) {
          if (line === `${RESTART_HANDOFF_PREFIX}bind:${handoff.token}`) {
            cleanup()
            resolve()
            return
          }
        }
        const newline = buffer.lastIndexOf("\n")
        if (newline >= 0) buffer = buffer.slice(newline + 1)
      }
      process.stdin.on("data", onData)
      process.stdin.once("error", onError)
      process.stdin.once("end", onEnd)
      process.stdin.resume()
    }),
    RESTART_HANDOFF_TIMEOUT_MS,
    "Restart child did not receive bind ownership",
  )
}

function observeMessages(stream: NodeJS.ReadableStream, token: string, onMessage: (message: RestartMessage) => void) {
  let buffer = ""
  stream.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString()
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith(RESTART_HANDOFF_PREFIX)) continue
      try {
        const message = JSON.parse(line.slice(RESTART_HANDOFF_PREFIX.length)) as RestartMessage
        if (message.token === token) onMessage(message)
      } catch {
        // Non-protocol child output is not restart ownership evidence.
      }
    }
  })
}

export async function waitForReleasedListener(hostname: string, port: number) {
  const deadline = Date.now() + RESTART_HANDOFF_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const probe = Bun.serve({ hostname, port, fetch: () => new Response(null, { status: 503 }) })
      await probe.stop(true)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.toLowerCase().includes("port") && !message.toLowerCase().includes("address")) throw error
    }
    await new Promise<void>((resolve) => setTimeout(resolve, RESTART_BIND_PROBE_INTERVAL_MS))
  }
  throw new Error(`Restart parent did not release ${hostname}:${port} before ownership transfer`)
}

export async function beginRestartHandoff(input: {
  hostname: string
  port: number
  quiesceListener: () => Promise<void>
  settleExecution: () => Promise<void>
  releaseRuntimeState: () => Promise<void> | void
  restoreListener: () => Promise<void>
  command?: string[]
  environment?: Record<string, string>
}): Promise<{ childPid: number; drained: Promise<void> }> {
  const token = randomUUID()
  const handoff: RestartHandoff = { token, hostname: input.hostname, port: input.port }
  const [executable, ...args] = input.command ?? process.argv
  if (!executable) throw new Error("Restart process executable is unavailable")
  let listenerQuiesceStarted = false
  let drained = Promise.resolve()
  let child: Awaited<ReturnType<typeof ProcessSupervisor.spawnHostCommand>> | undefined
  try {
    listenerQuiesceStarted = true
    drained = input.quiesceListener()
    await drained
    await input.settleExecution()
    await input.releaseRuntimeState()
    await waitForReleasedListener(input.hostname, input.port)

    child = await ProcessSupervisor.spawnHostCommand({
      executable,
      args,
      cwd: process.cwd(),
      env: {
        ...restartReplacementEnvironment(Env.snapshot(), input.environment),
        [RESTART_HANDOFF_ENV]: JSON.stringify(handoff),
      },
      stdin: "pipe",
      owner: "server-restart-replacement",
      detached: true,
    })
    child.stderr?.on("data", (chunk) => process.stderr.write(chunk))

    let waitingResolve!: (message: Extract<RestartMessage, { type: "waiting" }>) => void
    let readyResolve!: (message: Extract<RestartMessage, { type: "ready" }>) => void
    let protocolReject!: (error: unknown) => void
    const protocolFailure = new Promise<never>((_resolve, reject) => {
      protocolReject = reject
    })
    void protocolFailure.catch(() => undefined)
    const waiting = new Promise<Extract<RestartMessage, { type: "waiting" }>>((resolve) => {
      waitingResolve = resolve
    })
    const ready = new Promise<Extract<RestartMessage, { type: "ready" }>>((resolve) => {
      readyResolve = resolve
    })
    observeMessages(child.stdout!, token, (message) => {
      if (message.type === "waiting") waitingResolve(message)
      if (message.type === "ready") readyResolve(message)
      if (message.type === "failed") protocolReject(new Error(message.error))
    })
    void child.exited.then(
      (code) => protocolReject(new Error(`Restart replacement exited before readiness with code ${code}`)),
      protocolReject,
    )

    await ProcessSupervisor.awaitWithTimeout(
      Promise.race([waiting, protocolFailure]),
      RESTART_HANDOFF_TIMEOUT_MS,
      "Restart replacement did not request bind ownership",
    )
    child.stdin?.write(`${RESTART_HANDOFF_PREFIX}bind:${token}\n`)
    const message = await ProcessSupervisor.awaitWithTimeout(
      Promise.race([ready, protocolFailure]),
      RESTART_HANDOFF_TIMEOUT_MS,
      "Restart replacement did not become ready",
    )
    if (message.url !== `http://${input.hostname}:${input.port}`) {
      throw new Error(`Restart replacement reported unexpected URL ${message.url}`)
    }
    child.unref()
    return { childPid: message.pid, drained }
  } catch (error) {
    if (child) {
      try {
        await ProcessSupervisor.disposeAndWaitForExit(child, "Restart replacement")
      } catch (cleanupError) {
        error = ProcessSupervisor.combineFailures("Restart replacement and cleanup failed", [error, cleanupError])
      }
    }
    if (listenerQuiesceStarted) {
      try {
        await input.restoreListener()
      } catch (restoreError) {
        throw ProcessSupervisor.combineFailures("Restart failed and the current listener could not be restored", [
          error,
          restoreError,
        ])
      }
    }
    throw error
  }
}
