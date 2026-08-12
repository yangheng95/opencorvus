import { ProcessSupervisor } from "./process-supervisor"

export type CommandInactivityResult = {
  exitCode: number | undefined
  stdout: string
  stderr: string
  stdoutBytes: Uint8Array
  stderrBytes: Uint8Array
  failure?: {
    kind: "inactivity" | "spawn" | "output" | "exit"
    message: string
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Run one exact executable/argv command. The only deadline is reset by real
 * stdout/stderr bytes; elapsed time from process start is never a deadline. */
type CommandInactivityInput = {
  executable: string
  args: string[]
  cwd: string
  env?: NodeJS.ProcessEnv
  inactivityTimeoutMs: number
  onStdout?: (chunk: Buffer) => void
  onStderr?: (chunk: Buffer) => void
}

type CommandInactivityRequest = CommandInactivityInput &
  ({ owner: "host" } | { owner: "task"; taskID: string })

export function runHostCommandWithInactivity(input: CommandInactivityInput): Promise<CommandInactivityResult> {
  return runCommandWithInactivity({ ...input, owner: "host" })
}

export function runTaskCommandWithInactivity(
  identity: ProcessSupervisor.TaskProcessIdentity,
  input: Omit<CommandInactivityInput, "cwd">,
): Promise<CommandInactivityResult> {
  return runCommandWithInactivity({ ...input, owner: "task", taskID: identity.taskID, cwd: identity.cwd })
}

async function runCommandWithInactivity(input: CommandInactivityRequest): Promise<CommandInactivityResult> {
  if (!Number.isSafeInteger(input.inactivityTimeoutMs) || input.inactivityTimeoutMs <= 0) {
    throw new Error("Command inactivity timeout must be a positive safe integer")
  }
  let proc: ProcessSupervisor.Handle
  try {
    const options = {
      executable: input.executable,
      args: input.args,
      env: input.env,
      owner: "inactivity-command",
    }
    proc = input.owner === "task"
      ? await ProcessSupervisor.spawnTaskCommand({ taskID: input.taskID, cwd: input.cwd }, options)
      : await ProcessSupervisor.spawnHostCommand({ ...options, cwd: input.cwd })
  } catch (error) {
    return {
      exitCode: undefined,
      stdout: "",
      stderr: "",
      stdoutBytes: new Uint8Array(),
      stderrBytes: new Uint8Array(),
      failure: { kind: "spawn", message: `Command failed to start: ${errorMessage(error)}` },
    }
  }
  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  const outputFailures: Array<{ source: string; error: unknown }> = []
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined
  let inactive = false
  let spawnError: unknown
  let cleanupError: unknown
  let settlementError: unknown
  let cleanupPromise: Promise<void> | undefined
  let finishProcess: ((code: number | undefined) => void) | undefined

  const cleanup = () => {
    cleanupPromise ??= ProcessSupervisor.terminateAndWaitForExit(proc, `inactive command process ${proc.pid}`).then(() => undefined).catch((error) => {
      cleanupError = error
    })
    return cleanupPromise
  }
  const resetInactivity = () => {
    if (outputFailures.length > 0) return
    if (inactivityTimer) clearTimeout(inactivityTimer)
    inactivityTimer = setTimeout(() => {
      inactive = true
      void cleanup().finally(() => finishProcess?.(undefined))
    }, input.inactivityTimeoutMs)
  }
  const recordOutputFailure = (source: string, error: unknown) => {
    outputFailures.push({ source, error })
    if (inactivityTimer) clearTimeout(inactivityTimer)
    inactivityTimer = undefined
    void cleanup().finally(() => finishProcess?.(undefined))
  }
  const recordOutput = (source: "stdout" | "stderr", chunk: unknown) => {
    const bytes = Buffer.from(chunk as Uint8Array)
    if (bytes.byteLength === 0) return
    ;(source === "stdout" ? stdoutChunks : stderrChunks).push(bytes)
    try {
      ;(source === "stdout" ? input.onStdout : input.onStderr)?.(bytes)
    } catch (error) {
      recordOutputFailure(`${source} callback`, error)
      return
    }
    resetInactivity()
  }

  proc.stdout?.on("data", (chunk) => recordOutput("stdout", chunk))
  proc.stderr?.on("data", (chunk) => recordOutput("stderr", chunk))
  proc.stdout?.once("error", (error) => {
    recordOutputFailure("stdout stream", error)
  })
  proc.stderr?.once("error", (error) => {
    recordOutputFailure("stderr stream", error)
  })
  resetInactivity()

  const exitCode = await new Promise<number | undefined>((resolve) => {
    let settled = false
    const finish = (code: number | undefined) => {
      if (settled) return
      settled = true
      if (inactivityTimer) clearTimeout(inactivityTimer)
      resolve(code)
    }
    finishProcess = finish
    void proc.exited.then(
      (code) => finish(inactive || outputFailures.length > 0 ? undefined : code),
      (error) => {
        spawnError = error
        finish(undefined)
      },
    )
  })
  if (cleanupPromise) await cleanupPromise
  else await proc.dispose().catch((error) => {
    cleanupError = error
  })
  await (proc.settled ?? proc.outputSettled ?? proc.exited.then(() => undefined)).catch((error) => {
    settlementError = error
  })

  const stdoutBytes = Buffer.concat(stdoutChunks)
  const stderrBytes = Buffer.concat(stderrChunks)
  let failure: CommandInactivityResult["failure"]
  if (inactive) {
    failure = {
      kind: "inactivity",
      message: `Command produced no stdout/stderr activity for ${input.inactivityTimeoutMs}ms`,
    }
  } else if (spawnError) {
    failure = { kind: "spawn", message: `Command failed to start: ${errorMessage(spawnError)}` }
  } else if (outputFailures.length > 0) {
    failure = {
      kind: "output",
      message: outputFailures.map((failure) => `${failure.source}: ${errorMessage(failure.error)}`).join("; "),
    }
  } else if (exitCode === undefined) {
    failure = {
      kind: "exit",
      message: "Command exited without an exit code",
    }
  }
  if (cleanupError) {
    const cleanupMessage = `Process tree cleanup failed: ${errorMessage(cleanupError)}`
    failure = failure
      ? { ...failure, message: `${failure.message}; ${cleanupMessage}` }
      : { kind: "exit", message: cleanupMessage }
  }
  if (settlementError) {
    const settlementMessage = `Process supervisor settlement failed: ${errorMessage(settlementError)}`
    failure = failure
      ? { ...failure, message: `${failure.message}; ${settlementMessage}` }
      : { kind: "exit", message: settlementMessage }
  }
  return {
    exitCode,
    stdout: stdoutBytes.toString("utf8"),
    stderr: stderrBytes.toString("utf8"),
    stdoutBytes,
    stderrBytes,
    failure,
  }
}
