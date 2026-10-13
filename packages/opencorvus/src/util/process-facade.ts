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
    if (request.ownership === "detached") return spawnNodeProcess(request)
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
      signal: request.controlSignal,
      terminateChildrenOnRootExit: input.terminateChildrenOnRootExit,
    }
    const handle = input.task
      ? await ProcessSupervisor.spawnTaskCommand(input.task, command)
      : await ProcessSupervisor.spawnHostCommand({ ...command, cwd: request.cwd })
    const terminal = terminalReceipt(request.occurrenceID, handle.pid, handle)
    const outputSettled = handle.outputSettled
    const settled = Promise.allSettled([terminal, outputSettled, handle.settled]).then((outcomes) => {
      const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : [])
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
        stream.pipe(inherited)
        return null
      }
      if (mode === "ignore") {
        stream.resume()
        return null
      }
      return nodeProcessByteSource(stream)
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
