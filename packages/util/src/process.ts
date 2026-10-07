const DEFAULT_OUTPUT_LIMIT = Number.POSITIVE_INFINITY
export const PROCESS_SETTLEMENT_TIMEOUT_MS = 5_000
const DEADLINE_CLOCK_INTERVAL_MS = 25

type DeadlineEntry = { deadlineAt: number; expire(): void }
const deadlineEntries = new Map<symbol, DeadlineEntry>()
const deadlineClockCell = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT))
const waitForDeadlineClock = (
  Atomics as unknown as {
    waitAsync(
      array: Int32Array,
      index: number,
      value: number,
      timeout: number,
    ): {
      value: string | Promise<string>
    }
  }
).waitAsync
let deadlineClockRunning = false
let deadlineKeepalive: ReturnType<typeof setInterval> | undefined

function stopDeadlineKeepaliveWhenIdle() {
  if (deadlineEntries.size || !deadlineKeepalive) return
  clearInterval(deadlineKeepalive)
  deadlineKeepalive = undefined
}
function expireDeadlines() {
  const now = Date.now()
  for (const [id, entry] of deadlineEntries) {
    if (entry.deadlineAt > now) continue
    deadlineEntries.delete(id)
    entry.expire()
  }
  stopDeadlineKeepaliveWhenIdle()
}
async function runDeadlineClock() {
  if (deadlineClockRunning) return
  deadlineClockRunning = true
  try {
    while (deadlineEntries.size) {
      expireDeadlines()
      if (!deadlineEntries.size) break
      await waitForDeadlineClock(deadlineClockCell, 0, 0, DEADLINE_CLOCK_INTERVAL_MS).value
    }
  } finally {
    deadlineClockRunning = false
    stopDeadlineKeepaliveWhenIdle()
    // A deadline can be registered after the loop observes an empty map but
    // before the running flag is released.
    if (deadlineEntries.size) void runDeadlineClock()
  }
}
function scheduleDeadline(deadlineAt: number, expire: () => void): () => void {
  if (deadlineAt <= Date.now()) {
    expire()
    return () => undefined
  }
  const id = Symbol("process-deadline")
  deadlineEntries.set(id, { deadlineAt, expire })
  // The empty interval only keeps an admission-only deadline alive in hosts
  // where a pending Promise is not an event-loop root. Expiration itself is
  // driven by Atomics.waitAsync, outside the host timer queue.
  deadlineKeepalive ??= setInterval(() => undefined, 1_000)
  void runDeadlineClock()
  return () => {
    deadlineEntries.delete(id)
    stopDeadlineKeepaliveWhenIdle()
  }
}

export type ProcessOwnership = "owned_tree" | "owned_process" | "detached"
export type ProcessStdio = "ignore" | "pipe" | "inherit"
export type ProcessTerminalReason =
  | "exited"
  | "terminated"
  | "aborted"
  | "deadline_exceeded"
  | "inactivity_timeout"
  | "output_limit"
export type ProcessCommand = Readonly<{ executable: string; args: readonly string[] }>
export type ProcessEnvironment = Readonly<Record<string, string | undefined>>

/** Host-neutral byte source. A facade handle has one output consumer. */
export interface ProcessByteSource extends AsyncIterable<Uint8Array> {}
/** Host-neutral, backpressure-aware input sink. */
export interface ProcessByteSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
}

export interface ProcessSpawnRequest {
  command: ProcessCommand
  cwd?: string
  env?: ProcessEnvironment
  stdin?: "ignore" | "pipe"
  stdout?: ProcessStdio
  stderr?: ProcessStdio
  ownership?: ProcessOwnership
  windowsHide?: boolean
  windowsVerbatimArguments?: boolean
  signal?: AbortSignal
  deadlineAt?: number
  gracefulTerminationMs?: number
  occurrenceID?: string
}

export interface ProcessTerminalReceipt {
  occurrenceID: string
  pid: number
  reason: ProcessTerminalReason
  exitCode: number | null
  signal: string | null
}

export interface ProcessSpawnedHandle {
  readonly occurrenceID: string
  readonly pid: number
  readonly stdin: ProcessByteSink | null
  readonly stdout: ProcessByteSource | null
  readonly stderr: ProcessByteSource | null
  readonly terminal: Promise<ProcessTerminalReceipt>
  readonly outputSettled: Promise<void>
  readonly settled: Promise<ProcessTerminalReceipt>
  terminate(reason?: Exclude<ProcessTerminalReason, "exited">): Promise<ProcessTerminalReceipt>
  dispose(): Promise<ProcessTerminalReceipt>
  unref(): void
}

export interface ProcessHandle extends ProcessSpawnedHandle {
  /** Release request signal/deadline ownership after a phased admission succeeds. */
  releaseControls(): "released" | "aborted" | "deadline_exceeded"
}

export interface ProcessRunRequest extends ProcessSpawnRequest {
  onStdout?: (chunk: Uint8Array) => void
  onStderr?: (chunk: Uint8Array) => void
  input?: Uint8Array | string | AsyncIterable<Uint8Array>
  nothrow?: boolean
  inactivityTimeoutMs?: number
  inactivityTimeoutMessage?: string
  timeoutMs?: number
  maxOutputBytes?: number
  onSpawned?: (handle: ProcessHandle) => void | Promise<void>
}
export interface ProcessRunResult {
  receipt: ProcessTerminalReceipt
  stdout: Uint8Array
  stderr: Uint8Array
}
export type ProcessSpawnerRequest = Omit<ProcessSpawnRequest, "signal" | "deadlineAt"> & {
  occurrenceID: string
  controlSignal: AbortSignal
}
export type ProcessSpawner = (request: ProcessSpawnerRequest) => Promise<ProcessSpawnedHandle>
export interface ProcessFacade {
  spawn(request: ProcessSpawnRequest): Promise<ProcessHandle>
  run(request: ProcessRunRequest): Promise<ProcessRunResult>
}

export class ProcessAbortedError extends Error {
  override readonly name = "ProcessAbortedError"
  constructor(
    message: string,
    readonly result?: ProcessRunResult,
  ) {
    super(message)
  }
}
export class ProcessDeadlineExceededError extends Error {
  override readonly name = "ProcessDeadlineExceededError"
  constructor(
    message: string,
    readonly result?: ProcessRunResult,
  ) {
    super(message)
  }
}
export class ProcessSettlementUncertainError extends Error {
  override readonly name = "ProcessSettlementUncertainError"
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}
export class ProcessOutputObserverError extends Error {
  override readonly name = "ProcessOutputObserverError"
  constructor(
    readonly result: ProcessRunResult,
    cause: unknown,
  ) {
    super(`Process output observer failed: ${asError(cause).message}`, { cause })
  }
}
/** Execution failed before a complete physical/output receipt was available. */
export class ProcessExecutionError extends Error {
  override readonly name = "ProcessExecutionError"
  constructor(
    cause: unknown,
    readonly stdout: Uint8Array,
    readonly stderr: Uint8Array,
    readonly stage: "output" | "execution" | "settlement" = "execution",
  ) {
    super(`Process execution failed: ${asError(cause).message}`, { cause })
  }
}

export type ProcessFacadeOptions = Readonly<{ settlementTimeoutMs?: number }>
type ResolvedProcessFacadeOptions = Readonly<Required<ProcessFacadeOptions>>
async function awaitSettlement<T>(operation: Promise<T>, options: ResolvedProcessFacadeOptions): Promise<T> {
  let cancel = () => {}
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        cancel = scheduleDeadline(Date.now() + options.settlementTimeoutMs, () =>
          reject(new ProcessSettlementUncertainError("Process settlement exceeded its finite cleanup budget")),
        )
      }),
    ])
  } finally {
    cancel()
  }
}
export class ProcessInactivityTimeoutError extends Error {
  override readonly name = "ProcessInactivityTimeoutError"
  constructor(
    message: string,
    readonly result: ProcessRunResult,
  ) {
    super(message)
  }
}
export class ProcessOutputLimitError extends Error {
  override readonly name = "ProcessOutputLimitError"
  constructor(
    message: string,
    readonly result: ProcessRunResult,
  ) {
    super(message)
  }
}
export class ProcessRunFailedError extends Error {
  override readonly name = "ProcessRunFailedError"
  constructor(
    readonly command: ProcessCommand,
    readonly receipt: ProcessTerminalReceipt,
    readonly stdout: Uint8Array,
    readonly stderr: Uint8Array,
  ) {
    const detail = new TextDecoder().decode(stderr).trim()
    super(
      `Command failed with code ${receipt.exitCode ?? "null"}: ${formatCommand(command)}${detail ? `\n${detail}` : ""}`,
    )
  }
}

function formatCommand(command: ProcessCommand): string {
  return [command.executable, ...command.args].join(" ")
}
function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
function uniqueFailures(failures: readonly unknown[]): unknown[] {
  const ordered: unknown[] = []
  const seen = new Set<unknown>()
  const append = (failure: unknown) => {
    if (failure instanceof AggregateError) {
      for (const nested of failure.errors) append(nested)
      return
    }
    if (seen.has(failure)) return
    seen.add(failure)
    ordered.push(failure)
  }
  for (const failure of failures) append(failure)
  return ordered
}
function combinedFailure(failures: readonly unknown[], message: string): unknown {
  const unique = uniqueFailures(failures)
  if (unique.length === 1) return unique[0]
  return new AggregateError(unique, message)
}
function newOccurrenceID(): string {
  if (!globalThis.crypto?.randomUUID)
    throw new Error("The process facade requires crypto.randomUUID() for occurrence identity")
  return globalThis.crypto.randomUUID()
}
function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    joined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return joined
}
function deadlineFrom(request: Pick<ProcessRunRequest, "deadlineAt" | "timeoutMs">): number | undefined {
  const relative = request.timeoutMs === undefined ? undefined : Date.now() + request.timeoutMs
  if (request.deadlineAt === undefined) return relative
  return relative === undefined ? request.deadlineAt : Math.min(request.deadlineAt, relative)
}
function reasonError(result: ProcessRunResult, request: ProcessRunRequest): Error | undefined {
  const label = formatCommand(request.command)
  if (result.receipt.reason === "aborted") return new ProcessAbortedError(`Process aborted: ${label}`, result)
  if (result.receipt.reason === "deadline_exceeded")
    return new ProcessDeadlineExceededError(`Process deadline exceeded: ${label}`, result)
  if (result.receipt.reason === "inactivity_timeout")
    return new ProcessInactivityTimeoutError(
      request.inactivityTimeoutMessage ?? `Process became inactive: ${label}`,
      result,
    )
  if (result.receipt.reason === "output_limit")
    return new ProcessOutputLimitError(`Process output limit exceeded: ${label}`, result)
  return undefined
}

type ProcessControlLease = {
  readonly signal: AbortSignal
  readonly failure: Promise<never>
  reason(): "aborted" | "deadline_exceeded" | undefined
  release(): void
}

function createProcessControlLease(request: ProcessSpawnRequest): ProcessControlLease {
  const controller = new AbortController()
  let controlReason: "aborted" | "deadline_exceeded" | undefined
  let released = false
  let rejectFailure!: (error: Error) => void
  const failure = new Promise<never>((_resolve, reject) => {
    rejectFailure = reject
  })
  void failure.catch(() => undefined)
  const abort = (reason: "aborted" | "deadline_exceeded") => {
    if (released || controlReason) return
    controlReason = reason
    const label = formatCommand(request.command)
    const error =
      reason === "aborted"
        ? new ProcessAbortedError(`Process aborted: ${label}`)
        : new ProcessDeadlineExceededError(`Process deadline exceeded: ${label}`)
    controller.abort(error)
    rejectFailure(error)
  }
  const abortFromRequest = () => abort("aborted")
  request.signal?.addEventListener("abort", abortFromRequest, { once: true })
  if (request.signal?.aborted) abortFromRequest()
  const cancelDeadline =
    request.deadlineAt === undefined
      ? undefined
      : scheduleDeadline(request.deadlineAt, () => abort("deadline_exceeded"))
  const expireIfDue = () => {
    if (request.deadlineAt !== undefined && request.deadlineAt <= Date.now()) abort("deadline_exceeded")
  }
  return {
    signal: controller.signal,
    failure,
    reason: () => {
      expireIfDue()
      return controlReason
    },
    release() {
      if (released) return
      expireIfDue()
      released = true
      cancelDeadline?.()
      request.signal?.removeEventListener("abort", abortFromRequest)
    },
  }
}

function controlledHandle(
  raw: ProcessSpawnedHandle,
  controls: ProcessControlLease,
  options: ResolvedProcessFacadeOptions,
): ProcessHandle {
  let requestedReason: Exclude<ProcessTerminalReason, "exited"> | undefined
  let termination: Promise<ProcessTerminalReceipt> | undefined
  let controlFailureReject!: (error: Error) => void
  const controlFailure = new Promise<never>((_resolve, reject) => {
    controlFailureReject = reject
  })
  void controlFailure.catch(() => undefined)
  const terminal = Promise.race([
    raw.terminal.then((receipt) => {
      requestedReason ??= controls.reason()
      return { ...receipt, reason: requestedReason ?? receipt.reason }
    }),
    controlFailure,
  ])
  const settled = terminal
    .then(
      (receipt) =>
        awaitSettlement(
          Promise.allSettled([raw.outputSettled, raw.settled]).then((outcomes) => {
            const failures = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []))
            if (failures.length) throw combinedFailure(failures, "Process output and physical settlement failed")
            return receipt
          }),
          options,
        ),
      async (primary) => {
        try {
          const outcomes = await awaitSettlement(Promise.allSettled([raw.outputSettled, raw.settled]), options)
          const failures = outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : []))
          if (failures.length) throw combinedFailure(failures, "Process output and physical settlement failed")
        } catch (cleanup) {
          throw combinedFailure([primary, cleanup], "Process terminal and physical settlement failed")
        }
        throw primary
      },
    )
    .then((receipt) => receipt)
  void settled.catch(() => undefined)
  const joinControlOperation = async (
    operation: Promise<ProcessTerminalReceipt>,
    message: string,
  ): Promise<ProcessTerminalReceipt> => {
    const observedOperation = awaitSettlement(operation, options).catch((error) => {
      const failure = asError(error)
      controlFailureReject(failure)
      throw failure
    })
    const outcomes = await Promise.allSettled([observedOperation, settled])
    const failures = uniqueFailures(
      outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : [])),
    )
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, message)
    const settlement = outcomes[1]!
    if (settlement.status !== "fulfilled") throw new Error("Process control settlement was unavailable")
    return settlement.value
  }
  const terminate = (reason: Exclude<ProcessTerminalReason, "exited"> = "terminated") => {
    requestedReason ??= reason
    if (!termination) {
      termination = joinControlOperation(raw.terminate(reason), "Process termination and physical settlement failed")
      void termination.catch(() => undefined)
    }
    return termination
  }
  const abort = () => void terminate(controls.reason() ?? "aborted")
  let controlsReleased = false
  let controlReleaseResult: "released" | "aborted" | "deadline_exceeded" | undefined
  const releaseControls = () => {
    if (controlReleaseResult) return controlReleaseResult
    controlReleaseResult = controls.reason() ?? "released"
    if (controlsReleased) return controlReleaseResult
    controlsReleased = true
    controls.signal.removeEventListener("abort", abort)
    controls.release()
    return controlReleaseResult
  }
  void settled
    .finally(() => {
      releaseControls()
    })
    .catch(() => undefined)
  controls.signal.addEventListener("abort", abort, { once: true })
  if (controls.signal.aborted) abort()
  return {
    ...raw,
    terminal,
    settled,
    terminate,
    async dispose() {
      requestedReason ??= "terminated"
      return await joinControlOperation(raw.dispose(), "Process disposal and physical settlement failed")
    },
    releaseControls,
  }
}

async function collectOutput(
  source: ProcessByteSource,
  onActivity: () => void,
  retain: (chunk: Uint8Array) => Uint8Array | undefined,
  observe?: (chunk: Uint8Array) => void,
  chunks: Uint8Array[] = [],
): Promise<Uint8Array> {
  for await (const value of source) {
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value)
    const kept = retain(chunk)
    if (kept?.byteLength) chunks.push(kept)
    observe?.(chunk.slice())
    onActivity()
  }
  return concatBytes(chunks)
}
async function outputFailure(output: Promise<Uint8Array>, onFailure: () => void): Promise<never> {
  try {
    await output
  } catch (error) {
    onFailure()
    throw error
  }
  return await new Promise<never>(() => undefined)
}
function inputValues(input: NonNullable<ProcessRunRequest["input"]>): AsyncIterable<Uint8Array> {
  if (typeof input !== "string" && !(input instanceof Uint8Array)) return input
  return (async function* () {
    yield typeof input === "string" ? new TextEncoder().encode(input) : input
  })()
}
function startInput(
  sink: ProcessByteSink,
  input: NonNullable<ProcessRunRequest["input"]>,
  onActivity: () => void,
  onFailure: (error: unknown) => void,
): { cancel(): void } {
  const iterator = inputValues(input)[Symbol.asyncIterator]()
  let cancelled = false
  void (async () => {
    try {
      while (!cancelled) {
        const next = await iterator.next()
        if (next.done || cancelled) break
        if (!next.value.byteLength) continue
        await sink.write(next.value)
        onActivity()
      }
      if (!cancelled) await sink.close()
    } catch (error) {
      if (!cancelled) onFailure(error)
    }
  })()
  return {
    cancel() {
      if (cancelled) return
      cancelled = true
      void Promise.resolve(iterator.return?.()).catch(() => undefined)
      void sink.close().catch(() => undefined)
    },
  }
}

async function runProcess(facade: ProcessFacade, request: ProcessRunRequest): Promise<ProcessRunResult> {
  const handle = await facade.spawn({
    ...request,
    deadlineAt: deadlineFrom(request),
    stdin: request.input === undefined ? (request.stdin ?? "ignore") : "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  let cancelInactivityDeadline: (() => void) | undefined
  let outputBytes = 0
  let outputLimitReached = false
  const outputLimit = request.maxOutputBytes ?? DEFAULT_OUTPUT_LIMIT
  const refreshInactivity = () => {
    if (request.inactivityTimeoutMs === undefined) return
    cancelInactivityDeadline?.()
    cancelInactivityDeadline = scheduleDeadline(
      Date.now() + request.inactivityTimeoutMs,
      () => void handle.terminate("inactivity_timeout"),
    )
  }
  const retain = (chunk: Uint8Array) => {
    const remaining = Math.max(0, outputLimit - outputBytes)
    outputBytes += chunk.byteLength
    if (outputBytes > outputLimit && !outputLimitReached) {
      outputLimitReached = true
      void handle.terminate("output_limit")
    }
    return remaining === 0 ? undefined : chunk.subarray(0, remaining)
  }
  let stdout: Promise<Uint8Array> | undefined
  let stderr: Promise<Uint8Array> | undefined
  const stdoutChunks: Uint8Array[] = []
  const stderrChunks: Uint8Array[] = []
  let processSettled = false
  let inputFailure: unknown
  let inputWriter: { cancel(): void } | undefined
  let primaryError: unknown
  let hasPrimaryError = false
  let byteSourceFailed = false
  let observerError: unknown
  let observerFailed = false
  const observe = (callback: ((chunk: Uint8Array) => void) | undefined) => (chunk: Uint8Array) => {
    if (observerFailed) return
    try {
      callback?.(chunk)
    } catch (error) {
      observerFailed = true
      observerError = error
      void handle.terminate().catch(() => undefined)
    }
  }
  try {
    await request.onSpawned?.(handle)
    if (!handle.stdout || !handle.stderr)
      throw new Error(`Process output is unavailable: ${formatCommand(request.command)}`)
    if (request.input !== undefined && !handle.stdin)
      throw new Error(`Process input is unavailable: ${formatCommand(request.command)}`)
    refreshInactivity()
    stdout = collectOutput(handle.stdout, refreshInactivity, retain, observe(request.onStdout), stdoutChunks)
    stderr = collectOutput(handle.stderr, refreshInactivity, retain, observe(request.onStderr), stderrChunks)
    const sourceFailed = () => {
      byteSourceFailed = true
    }
    const observerFailure = Promise.race([outputFailure(stdout, sourceFailed), outputFailure(stderr, sourceFailed)])
    void observerFailure.catch(() => undefined)
    inputWriter =
      request.input === undefined
        ? undefined
        : startInput(handle.stdin!, request.input, refreshInactivity, (error) => {
            if (processSettled) return
            inputFailure = error
            void handle.terminate()
          })
    const receipt = await Promise.race([handle.settled, observerFailure])
    processSettled = true
    inputWriter?.cancel()
    const [stdoutBytes, stderrBytes] = await Promise.all([stdout, stderr])
    if (inputFailure) throw inputFailure
    // Physical exit can precede the last buffered output chunk. Completed-run
    // policy is evaluated after both streams drain, without rewriting the
    // handle's physical terminal receipt or an earlier cancellation reason.
    const result: ProcessRunResult = {
      receipt: outputLimitReached && receipt.reason === "exited" ? { ...receipt, reason: "output_limit" } : receipt,
      stdout: stdoutBytes,
      stderr: stderrBytes,
    }
    const controlledError = reasonError(result, request)
    if (controlledError) throw controlledError
    if (observerFailed) throw new ProcessOutputObserverError(result, observerError)
    if (receipt.exitCode === 0 || request.nothrow) return result
    throw new ProcessRunFailedError(request.command, receipt, stdoutBytes, stderrBytes)
  } catch (error) {
    primaryError = error
    hasPrimaryError = true
    if (
      error instanceof ProcessAbortedError ||
      error instanceof ProcessDeadlineExceededError ||
      error instanceof ProcessInactivityTimeoutError ||
      error instanceof ProcessOutputLimitError ||
      error instanceof ProcessOutputObserverError ||
      error instanceof ProcessRunFailedError
    )
      throw error
    throw new ProcessExecutionError(
      error,
      concatBytes(stdoutChunks),
      concatBytes(stderrChunks),
      byteSourceFailed ? "output" : "execution",
    )
  } finally {
    processSettled = true
    inputWriter?.cancel()
    cancelInactivityDeadline?.()
    try {
      await handle.dispose()
    } catch (cleanupError) {
      throw new ProcessExecutionError(
        hasPrimaryError
          ? combinedFailure([primaryError, cleanupError], "Process execution and cleanup failed")
          : cleanupError,
        concatBytes(stdoutChunks),
        concatBytes(stderrChunks),
        byteSourceFailed ? "output" : "settlement",
      )
    }
  }
}

function admissionError(request: ProcessSpawnRequest): Error | undefined {
  if (request.signal?.aborted)
    return new ProcessAbortedError(`Process aborted before spawn: ${formatCommand(request.command)}`)
  if (request.deadlineAt !== undefined && request.deadlineAt <= Date.now())
    return new ProcessDeadlineExceededError(`Process deadline exceeded before spawn: ${formatCommand(request.command)}`)
}

async function failAfterHandleCleanup(
  handle: ProcessSpawnedHandle,
  primary: unknown,
  message: string,
  options: ResolvedProcessFacadeOptions,
): Promise<never> {
  const outcomes = await Promise.allSettled([
    awaitSettlement(handle.dispose(), options),
    awaitSettlement(handle.settled, options),
  ])
  const cleanupFailures = uniqueFailures(
    outcomes.flatMap((outcome) => (outcome.status === "rejected" ? [outcome.reason] : [])),
  )
  if (cleanupFailures.length) {
    throw combinedFailure([primary, ...cleanupFailures], message)
  }
  throw primary
}

async function spawnWithAdmissionControls(
  spawner: ProcessSpawner,
  request: ProcessSpawnRequest & { occurrenceID: string },
  options: ResolvedProcessFacadeOptions,
): Promise<{ raw: ProcessSpawnedHandle; controls: ProcessControlLease }> {
  const immediate = admissionError(request)
  if (immediate) throw immediate
  const controls = createProcessControlLease(request)
  const { signal: _signal, deadlineAt: _deadlineAt, ...physicalRequest } = request
  const pending = Promise.resolve().then(() => spawner({ ...physicalRequest, controlSignal: controls.signal }))
  try {
    return { raw: await Promise.race([pending, controls.failure]), controls }
  } catch (error) {
    const controlled = admissionError(request)
    if (controlled || error instanceof ProcessAbortedError || error instanceof ProcessDeadlineExceededError) {
      const primary = controlled ?? error
      controls.release()
      let lateHandle: ProcessSpawnedHandle
      try {
        lateHandle = await awaitSettlement(pending, options)
      } catch (cleanupError) {
        const expectedControlSettlement =
          cleanupError === primary ||
          cleanupError === controls.signal.reason ||
          (controls.signal.aborted && cleanupError instanceof Error && cleanupError.name === "AbortError")
        if (!expectedControlSettlement) {
          throw combinedFailure([primary, cleanupError], "Process admission control and cleanup failed")
        }
        throw primary
      }
      return await failAfterHandleCleanup(lateHandle, primary, "Process admission control and cleanup failed", options)
    }
    controls.release()
    throw error
  }
}

export function createProcessFacade(
  spawner: ProcessSpawner,
  options: ProcessFacadeOptions = { settlementTimeoutMs: PROCESS_SETTLEMENT_TIMEOUT_MS },
): ProcessFacade {
  const resolvedOptions: ResolvedProcessFacadeOptions = {
    settlementTimeoutMs: options.settlementTimeoutMs ?? PROCESS_SETTLEMENT_TIMEOUT_MS,
  }
  if (!Number.isSafeInteger(resolvedOptions.settlementTimeoutMs) || resolvedOptions.settlementTimeoutMs <= 0)
    throw new Error("Process settlement budget must be a positive safe integer")
  const facade: ProcessFacade = {
    async spawn(request) {
      const occurrenceID = request.occurrenceID?.trim() || newOccurrenceID()
      const boundRequest = { ...request, occurrenceID }
      const { raw, controls } = await spawnWithAdmissionControls(spawner, boundRequest, resolvedOptions)
      if (raw.occurrenceID !== occurrenceID) {
        controls.release()
        return await failAfterHandleCleanup(
          raw,
          new Error("Process spawner returned a different occurrence identity"),
          "Process occurrence validation and cleanup failed",
          resolvedOptions,
        )
      }
      const lateControl = admissionError(boundRequest)
      if (lateControl) {
        controls.release()
        return await failAfterHandleCleanup(
          raw,
          lateControl,
          "Process admission control and cleanup failed",
          resolvedOptions,
        )
      }
      return controlledHandle(raw, controls, resolvedOptions)
    },
    run(request) {
      return runProcess(facade, request)
    },
  }
  return facade
}
