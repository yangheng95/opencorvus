import {
  createProcessFacade,
  type ProcessFacade,
  type ProcessSpawnedHandle,
  type ProcessSpawner,
  type ProcessByteSource,
  type ProcessTerminalReceipt,
} from "@opencorvus-ai/util/process"
import { nodeProcessByteSink, nodeProcessByteSource } from "@opencorvus-ai/util/process-node"
import type { ProcessSupervisor as ProcessSupervisorContract } from "@/shell/process-supervisor"

function terminalReceipt(
  occurrenceID: string,
  pid: number,
  handle: Pick<ProcessSupervisorContract.Handle, "exited" | "terminalFact">,
): Promise<ProcessTerminalReceipt> {
  const fact = handle.terminalFact ?? handle.exited.then((exitCode) => ({ exitCode, signal: null }))
  return fact.then(({ exitCode, signal }) => ({
    occurrenceID,
    pid,
    reason: "exited",
    exitCode,
    signal,
  }))
}

type SupervisedTaskIdentity = Readonly<{ taskID: string; cwd: string }>

function supervisedProcessFacade(input: { owner: string; task?: SupervisedTaskIdentity }): ProcessFacade {
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
    // Plugin initialization participates in Config/Provider discovery. Loading
    // the concrete supervisor at module evaluation would create an application
    // cycle through that discovery graph. The injected capability stays an
    // abstraction until the first physical spawn, where the host adapter is
    // actually needed.
    const { ProcessSupervisor } = (await import("@/shell/process-supervisor")) as {
      ProcessSupervisor: typeof ProcessSupervisorContract
    }
    const command = {
      executable: request.command.executable,
      args: [...request.command.args],
      env: request.env,
      stdin: request.stdin,
      owner: input.owner,
      gracefulTerminationMs: request.gracefulTerminationMs,
      detached: request.ownership === "detached",
      signal: request.controlSignal,
    }
    const handle = input.task
      ? await ProcessSupervisor.spawnTaskCommand(input.task, command)
      : await ProcessSupervisor.spawnHostCommand({ ...command, cwd: request.cwd })
    const terminal = terminalReceipt(request.occurrenceID, handle.pid, handle)
    const outputSettled = handle.outputSettled ?? handle.exited.then(() => undefined)
    const supervisorSettled = handle.settled ?? Promise.all([handle.exited, outputSettled]).then(() => undefined)
    const settled = Promise.all([terminal, outputSettled, supervisorSettled]).then(([receipt]) => receipt)
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
        await handle.terminate()
        return { ...(await settled), reason }
      },
      async dispose() {
        await handle.dispose()
        return await settled
      },
      unref: () => handle.unref(),
    }
  }
  return createProcessFacade(spawner)
}

export function supervisedHostProcessFacade(owner: string): ProcessFacade {
  return supervisedProcessFacade({ owner })
}

export function supervisedTaskProcessFacade(identity: SupervisedTaskIdentity, owner: string): ProcessFacade {
  return supervisedProcessFacade({ owner, task: identity })
}
