import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Env } from "@/runtime/env"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { currentRuntimeProcessOccurrence, observeRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { isCompiledBinaryRuntime } from "@/runtime/compiled-binary"

const RESTART_HANDOFF_ENV = "OPENCORVUS_RESTART_HANDOFF"
const TIMEOUT_MS = 15_000
const POLL_MS = 25
const Owner = z.object({ occurrenceID: z.string().min(1), pid: z.number().int().positive(), processInstanceID: z.string().min(1) }).strict()
const Handoff = z.object({ protocol: z.literal(1), requestID: z.string().min(1), root: z.string(), owner: Owner,
  hostname: z.string().min(1), port: z.number().int().positive() }).strict()
export type RestartHandoff = z.infer<typeof Handoff>
const Base = z.object({ protocol: z.literal(1), request_id: z.string(), successor: Owner })
const Waiting = Base.extend({ predecessor: Owner }).strict()
const Bind = Base.extend({ hostname: z.string(), port: z.number().int() }).strict()
const Ready = Base.extend({ url: z.string() }).strict()
const Failed = Base.extend({ error: z.string() }).strict()
const SUPERVISOR_OWNED_RESTART_ENV = ["OPENCORVUS_PROCESS_OCCURRENCE_ID", "OPENCORVUS_PROCESS_OCCURRENCE_PATH",
  "OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH", "OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH"] as const

export function restartReplacementEnvironment(base: Record<string, string>, overrides?: Record<string, string>) {
  const environment = { ...base, ...overrides }
  for (const name of SUPERVISOR_OWNED_RESTART_ENV) delete environment[name]
  return environment
}
const sameOwner = (left: z.infer<typeof Owner>, right: z.infer<typeof Owner>) =>
  left.pid === right.pid && left.processInstanceID === right.processInstanceID && left.occurrenceID === right.occurrenceID

export function childRestartHandoff(): RestartHandoff | undefined {
  const raw = Env.snapshot()[RESTART_HANDOFF_ENV]
  if (!raw) return
  const handoff = Handoff.parse(JSON.parse(raw))
  if (!path.isAbsolute(handoff.root) || path.dirname(handoff.root) !== path.resolve(Global.Path.temporary)
    || !path.basename(handoff.root).startsWith("supervisor-")) throw new Error("Restart handoff root is outside its runtime")
  return handoff
}
async function publish(handoff: RestartHandoff, name: string, value: unknown) {
  if (path.dirname(await fs.realpath(handoff.root)) !== await fs.realpath(Global.Path.temporary)) throw new Error("Restart handoff physical root escaped its runtime")
  const target = path.join(handoff.root, name)
  const text = JSON.stringify(value)
  await Filesystem.writeDurableAtomicIfAbsent(target, text)
  if (await fs.readFile(target, "utf8") !== text) throw new Error(`Restart fact conflicts: ${name}`)
}
async function readFact<T>(handoff: RestartHandoff, name: string, schema: z.ZodType<T>): Promise<T | undefined> {
  try { return schema.parse(JSON.parse(await fs.readFile(path.join(handoff.root, name), "utf8"))) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error }
}
export async function sendRestartHandoffMessage(message: { type: "ready"; url: string } | { type: "failed"; error: string }, handoff: RestartHandoff) {
  const base = { protocol: 1, request_id: handoff.requestID, successor: currentRuntimeProcessOccurrence() }
  if (message.type === "ready") await publish(handoff, "restart-ready.json", { ...base, url: message.url })
  else await publish(handoff, "restart-failed.json", { ...base, error: message.error })
}
export async function waitForRestartBind(handoff: RestartHandoff) {
  const successor = currentRuntimeProcessOccurrence()
  await publish(handoff, "restart-waiting.json", { protocol: 1, request_id: handoff.requestID, predecessor: handoff.owner, successor })
  const deadline = Date.now() + TIMEOUT_MS
  for (;;) {
    const bind = await readFact(handoff, "restart-bind.json", Bind)
    if (bind) {
      if (bind.request_id !== handoff.requestID || !sameOwner(bind.successor, successor)
        || bind.hostname !== handoff.hostname || bind.port !== handoff.port) throw new Error("Restart bind ownership identity mismatch")
      return
    }
    if (Date.now() >= deadline) throw new Error("Restart child did not receive bind ownership")
    await Bun.sleep(POLL_MS)
  }
}
export async function waitForReleasedListener(hostname: string, port: number) {
  const deadline = Date.now() + TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const probe = Bun.serve({ hostname, port, fetch: () => new Response(null, { status: 503 }) })
      await probe.stop(true)
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.toLowerCase().includes("port") && !message.toLowerCase().includes("address")) throw error
    }
    await Bun.sleep(POLL_MS)
  }
  throw new Error(`Restart parent did not release ${hostname}:${port} before ownership transfer`)
}
export class ServerRestartOwnershipUncertainError extends Error {
  override readonly name = "ServerRestartOwnershipUncertainError"
  constructor(readonly context: ProcessSupervisor.DetachedCommandContext, cause: unknown) {
    super(`Restart ownership is uncertain for ${context.requestID}; retaining physical evidence`, { cause })
  }
}
export class RestartHandoffEvidenceError extends Error {
  override readonly name = "RestartHandoffEvidenceError"
}

export async function beginRestartHandoff(input: {
  hostname: string; port: number; quiesceListener: () => Promise<void>; settleExecution: () => Promise<void>
  releaseRuntimeState: () => Promise<void> | void; restoreListener: () => Promise<void>
  command?: string[]; environment?: Record<string, string>
}): Promise<{ childPid: number; drained: Promise<void> }> {
  await ProcessSupervisor.assertDetachedCommandAvailable()
  const context = await ProcessSupervisor.createDetachedCommandContext()
  const handoff: RestartHandoff = { protocol: 1, requestID: context.requestID, root: context.root, owner: context.owner,
    hostname: input.hostname, port: input.port }
  const [executable, ...args] = input.command ?? [process.execPath, ...process.argv.slice(isCompiledBinaryRuntime() ? 2 : 1)]
  let listenerQuiesceStarted = false
  let spawnAttempted = false
  let drained = Promise.resolve()
  let child: ProcessSupervisor.Handle | undefined
  const finishTransfer = async () => {
    child!.unref()
    if (process.platform !== "win32") await fs.rm(context.root, { recursive: true, force: true })
    return { childPid: child!.pid, drained }
  }
  try {
    if (!executable) throw new Error("Restart process executable is unavailable")
    listenerQuiesceStarted = true
    drained = input.quiesceListener()
    await drained
    await input.settleExecution()
    await input.releaseRuntimeState()
    await waitForReleasedListener(input.hostname, input.port)
    spawnAttempted = true
    child = await ProcessSupervisor.spawnHostCommand({ executable, args, cwd: process.cwd(),
      env: { ...restartReplacementEnvironment(Env.snapshot(), input.environment), [RESTART_HANDOFF_ENV]: JSON.stringify(handoff) },
      owner: "server-restart-replacement", detached: context })
    let terminal: unknown
    void child.exited.then(code => { terminal = new Error(`Restart replacement exited before transfer with code ${code}`) }, error => { terminal = error })
    const wait = async <T>(name: string, schema: z.ZodType<T>) => {
      const deadline = Date.now() + TIMEOUT_MS
      for (;;) {
        const failed = await readFact(handoff, "restart-failed.json", Failed)
        if (failed) {
          const waiting = await readFact(handoff, "restart-waiting.json", Waiting)
          if (!waiting || failed.request_id !== context.requestID || waiting.request_id !== context.requestID
            || !sameOwner(waiting.predecessor, context.owner) || failed.successor.pid !== child!.pid
            || !sameOwner(failed.successor, waiting.successor)) throw new RestartHandoffEvidenceError("Restart failure does not match its complete waiting occurrence")
          if (process.platform === "win32") {
            const physical = JSON.parse(await fs.readFile(path.join(context.root, "ready.json"), "utf8"))
            if (physical.protocol !== 3 || physical.detached !== true || physical.request_id !== context.requestID
              || physical.target_pid !== failed.successor.pid || physical.target_process_instance_id !== failed.successor.processInstanceID
              || physical.runtime_occurrence_id !== context.owner.occurrenceID) throw new RestartHandoffEvidenceError("Restart failure does not match its native physical target")
          }
          throw new Error(failed.error)
        }
        const fact = await readFact(handoff, name, schema)
        if (fact) return fact
        if (terminal) throw terminal
        if (Date.now() >= deadline) throw new Error(`Restart handoff timed out waiting for ${name}`)
        await Bun.sleep(POLL_MS)
      }
    }
    const waiting = await wait("restart-waiting.json", Waiting)
    if (waiting.request_id !== context.requestID || !sameOwner(waiting.predecessor, context.owner)
      || waiting.successor.pid !== child.pid || observeRuntimeProcessOccurrence(waiting.successor) !== "exact_live") throw new Error("Restart waiting target identity mismatch")
    await publish(handoff, "restart-bind.json", { protocol: 1, request_id: context.requestID, successor: waiting.successor,
      hostname: input.hostname, port: input.port })
    const ready = await wait("restart-ready.json", Ready)
    if (ready.request_id !== context.requestID || !sameOwner(ready.successor, waiting.successor)
      || ready.url !== `http://${input.hostname}:${input.port}`) throw new Error("Restart ready target identity or URL mismatch")
    if (!child.transferOwnership) throw new Error("Restart child has no ownership transfer capability")
    await child.transferOwnership(ready.successor)
    return await finishTransfer()
  } catch (error) {
    if (child) {
      try { await child.dispose(); await child.settled } catch (cleanupError) {
        if (cleanupError instanceof ProcessSupervisor.ProcessOwnershipTransferredError) {
          await child.transferOwnership!(cleanupError.release.kind === "native_transfer" ? cleanupError.release.receipt.successor : cleanupError.release.successor)
          return await finishTransfer()
        }
        throw new ServerRestartOwnershipUncertainError(context, new AggregateError([error, cleanupError], "Restart cleanup could not establish physical settlement"))
      }
    } else if (spawnAttempted) {
      // The adapter removes this root only after proving pre-target/physical cleanup.
      try { await fs.stat(context.root); throw new ServerRestartOwnershipUncertainError(context, error) }
      catch (observation) { if ((observation as NodeJS.ErrnoException).code !== "ENOENT") throw observation }
    }
    if (!spawnAttempted || process.platform !== "win32") await fs.rm(context.root, { recursive: true, force: true })
    if (listenerQuiesceStarted) {
      try { await input.restoreListener() } catch (restoreError) {
        throw new AggregateError([error, restoreError], "Restart failed and current listener restoration failed")
      }
    }
    throw error
  }
}
