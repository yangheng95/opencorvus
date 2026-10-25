import {
  createProcessFacade,
  PROCESS_SETTLEMENT_TIMEOUT_MS,
  type ProcessFacade,
  type ProcessSpawnedHandle,
  type ProcessSpawner,
  type ProcessByteSource,
  type ProcessTerminalReceipt,
} from "@opencorvus-ai/util/process"
import { nodeProcessByteSink, nodeProcessByteSource, spawnNodeProcess } from "@opencorvus-ai/util/process-node"
import type { ProcessSupervisor as ProcessSupervisorContract } from "@/shell/process-supervisor"
import { PhysicalOperationScope } from "./physical-operation-scope"

function terminalReceipt(
  occurrenceID: string,
  pid: number,
  handle: Pick<ProcessSupervisorContract.Handle, "terminalFact">,
): Promise<ProcessTerminalReceipt> {
  const fact = handle.terminalFact
  return fact.then(({ exitCode, signal }) => ({
    occurrenceID,
    pid,
    reason: "exited",
    exitCode,
    signal,
  }))
}

type SupervisedTaskIdentity = Readonly<{ taskID: string; cwd: string }>

function supervisedProcessFacade(input: {
  owner: string
  task?: SupervisedTaskIdentity
  terminateChildrenOnRootExit: boolean
}): ProcessFacade {
  const spawner: ProcessSpawner = async (request): Promise<ProcessSpawnedHandle> => {
    const physical = PhysicalOperationScope.current()
    physical?.signal.throwIfAborted()
    if (request.windowsVerbatimArguments) {
      throw new Error("The supervised process facade does not accept verbatim Windows command-line strings")
    }
    if (request.windowsHide === false) {
      throw new Error("The supervised process facade cannot create a visible unmanaged window")
    }
    if (request.ownership === "owned_process") {
      throw new Error("Root-only process ownership belongs to the Node process adapter")
    }
    if (input.task && request.ownership === "detached") {
      throw new Error("Task process execution cannot detach from Task settlement")
    }
    if (request.ownership === "detached") {
      if (physical) throw new Error("Invocation-owned Host work cannot detach from physical settlement")
      return spawnNodeProcess(request)
    }
    // Plugin initialization participates in Config/Provider discovery. Loading
    // the concrete supervisor at module evaluation would create an application
    // cycle through that discovery graph. The injected capability stays an
    // abstraction until the first physical spawn, where the host adapter is
    // actually needed.
    const { ProcessSupervisor } = (await import("@/shell/process-supervisor")) as {
      ProcessSupervisor: typeof ProcessSupervisorContract
    }
    request.controlSignal.throwIfAborted()
    const command = {
      executable: request.command.executable,
      args: [...request.command.args],
      env: request.env,
      stdin: request.stdin,
      owner: input.owner,
      gracefulTerminationMs: request.gracefulTerminationMs,
      signal: physical?.combine(request.controlSignal) ?? request.controlSignal,
      terminateChildrenOnRootExit: input.terminateChildrenOnRootExit,
    }
    const handle = input.task
      ? await ProcessSupervisor.spawnTaskCommand(input.task, command)
      : await ProcessSupervisor.spawnHostCommand({ ...command, cwd: request.cwd })
    physical?.own(handle.settled, () => ProcessSupervisor.disposeAndWaitForExit(handle, "Host RPC process"))
    const terminal = terminalReceipt(request.occurrenceID, handle.pid, handle)
    const outputSettled = handle.outputSettled
    const settled = Promise.allSettled([terminal, outputSettled, handle.settled]).then((outcomes) => {
      const failures = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []))
      if (failures.length) throw ProcessSupervisor.combineFailures("Process facade settlement failed", failures)
      const receipt = outcomes[0]
      if (receipt.status !== "fulfilled") throw receipt.reason
      return receipt.value
    })
    void settled.catch(() => undefined)
    const projectOutput = (
      stream: NodeJS.ReadableStream | null,
      mode: "ignore" | "pipe" | "inherit" | undefined,
      inherited: NodeJS.WritableStream,
    ): ProcessByteSource | null => {
      if (!stream) return null
      if (mode === "inherit") {
        if (physical) stream.on("data", physical.activity)
        stream.pipe(inherited)
        return null
      }
      if (mode === "ignore") {
        if (physical) stream.on("data", physical.activity)
        stream.resume()
        return null
      }
      const source = nodeProcessByteSource(stream)
      if (!physical || !source) return source
      return (async function* () {
        for await (const chunk of source) {
          if (chunk.byteLength) physical.activity()
          yield chunk
        }
      })()
    }
    return {
      occurrenceID: request.occurrenceID,
      pid: handle.pid,
      stdin: nodeProcessByteSink(handle.stdin),
      stdout: projectOutput(handle.stdout, request.stdout, process.stdout),
      stderr: projectOutput(handle.stderr, request.stderr, process.stderr),
      terminal,
      outputSettled,
      settled,
      async terminate(reason = "terminated") {
        await ProcessSupervisor.disposeAndWaitForExit(handle, "Process facade termination")
        return { ...(await settled), reason }
      },
      async dispose() {
        await ProcessSupervisor.disposeAndWaitForExit(handle, "Process facade disposal")
        return await settled
      },
      unref: () => handle.unref(),
    }
  }
  return createProcessFacade(spawner, { settlementTimeoutMs: PROCESS_SETTLEMENT_TIMEOUT_MS })
}

export function supervisedHostProcessFacade(owner: string, terminateChildrenOnRootExit: boolean): ProcessFacade {
  return supervisedProcessFacade({ owner, terminateChildrenOnRootExit })
}

export function supervisedTaskProcessFacade(identity: SupervisedTaskIdentity, owner: string): ProcessFacade {
  return supervisedProcessFacade({ owner, task: identity, terminateChildrenOnRootExit: false })
}
