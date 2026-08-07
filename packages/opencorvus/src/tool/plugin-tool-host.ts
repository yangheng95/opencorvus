import {
  ArtifactReadInputSchema,
  ArtifactSelectInputSchema,
  ArtifactSelectOutputSchema,
  artifactReadLocatorKey,
  auditArtifactReadLocatorsFromFacts,
  type ArtifactReadLocator,
  type ArtifactReadWindowFact,
  type ToolCommandRunInput,
  type ToolCommandRunResult,
  type ToolHost,
} from "@opencorvus-ai/plugin"
import { publishExpertArtifact, readTaskArtifact, searchTaskArtifacts } from "@/artifact-catalog"
import {
  completeArtifactReadsBeforePublication,
  selectedArtifactLocatorsBeforePublication,
} from "@/agent/artifact-read-facts"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { createTaskArtifactStoreExecution } from "@/task-artifact/store"
import type { TaskToolExecutionScope } from "@/tool/task-tool-execution-scope"
import { collectTaskRunEvidence } from "@/tool/task-run-evidence-host"
import { createExpertSquadPackageHost } from "@/tool/expert-squad-package-host"
import { createMetricEvaluationHost } from "@/tool/metric-evaluation-host"
import { createPluginToolFilesHost } from "@/tool/plugin-tool-files-host"
import { assertTaskNetworkCapability } from "@/engine/task-execution-capsule-binding"

const OUTPUT_CLOSE_TIMEOUT_MS = 1_000

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function collectOutput(
  stream: NodeJS.ReadableStream | null,
  append: (chunk: string) => void,
  onActivity: () => void,
): Promise<void> {
  if (!stream) return Promise.resolve()
  stream.setEncoding("utf8")
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    stream.on("data", (chunk) => {
      append(String(chunk))
      onActivity()
    })
    stream.once("end", finish)
    stream.once("close", finish)
    stream.once("error", (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

async function waitForOutputClose(
  handle: ProcessSupervisor.Handle,
  stdoutClosed: Promise<void>,
  stderrClosed: Promise<void>,
) {
  await ProcessSupervisor.awaitWithTimeout(
    Promise.all([stdoutClosed, stderrClosed]),
    OUTPUT_CLOSE_TIMEOUT_MS,
    `plugin tool command ${handle.pid} output streams did not close within ${OUTPUT_CLOSE_TIMEOUT_MS}ms`,
  )
}

async function runCommand(
  input: ToolCommandRunInput,
  taskID: string,
): Promise<ToolCommandRunResult> {
  if (!input.executable.trim()) throw new Error("Tool host command executable must be nonempty.")
  if (!Array.isArray(input.args)) throw new Error("Tool host command args must be an array.")
  if (!input.cwd.trim()) throw new Error("Tool host command cwd must be nonempty.")
  if (!Number.isInteger(input.inactiveTimeoutMs) || input.inactiveTimeoutMs <= 0) {
    throw new Error("Tool host command inactiveTimeoutMs must be a positive integer.")
  }

  const startedAt = new Date()
  const startedMs = Date.now()
  const abort = input.abort ?? new AbortController().signal
  let stdout = ""
  let stderr = ""
  let timedOut = false
  let aborted = abort.aborted
  let inactivityTimer: ReturnType<typeof setTimeout> | undefined
  let cleanupStarted = false
  let handle: ProcessSupervisor.Handle | undefined
  let termination: Promise<void> | undefined
  let terminationError: unknown
  let rejectTerminationFailure: (error: unknown) => void = () => {}
  const terminationFailure = new Promise<never>((_resolve, reject) => {
    rejectTerminationFailure = reject
  })

  const finish = (result: Pick<ToolCommandRunResult, "exitCode" | "signal" | "error">): ToolCommandRunResult => ({
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedMs,
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut,
    aborted,
    error: result.error,
    stdout,
    stderr,
  })

  if (aborted) {
    return finish({
      exitCode: null,
      signal: null,
      error: "Tool host command was aborted before spawn.",
    })
  }

  const clearInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer)
    inactivityTimer = undefined
  }

  const requestTermination = () => {
    if (!handle || termination) return
    termination = ProcessSupervisor.terminateAndWaitForExit(handle, `plugin tool command ${handle.pid}`)
      .then(() => undefined)
      .catch((error) => {
        terminationError = error
        rejectTerminationFailure(error)
      })
  }

  const resetInactivityTimer = () => {
    if (cleanupStarted) return
    clearInactivityTimer()
    inactivityTimer = setTimeout(() => {
      timedOut = true
      requestTermination()
    }, input.inactiveTimeoutMs)
  }

  const onAbort = () => {
    aborted = true
    requestTermination()
  }

  try {
    handle = await ProcessSupervisor.spawnTaskCommand({ taskID, cwd: input.cwd }, {
      executable: input.executable,
      args: input.args,
      env: input.env as NodeJS.ProcessEnv | undefined,
      stdin: "ignore",
    })
  } catch (error) {
    return finish({
      exitCode: null,
      signal: null,
      error: errorMessage(error),
    })
  }

  const stdoutClosed = collectOutput(
    handle.stdout,
    (chunk) => {
      stdout += chunk
    },
    resetInactivityTimer,
  )
  const stderrClosed = collectOutput(
    handle.stderr,
    (chunk) => {
      stderr += chunk
    },
    resetInactivityTimer,
  )

  let completion: Pick<ToolCommandRunResult, "exitCode" | "signal" | "error">
  let primaryError: unknown
  try {
    abort.addEventListener("abort", onAbort, { once: true })
    if (abort.aborted) onAbort()
    resetInactivityTimer()
    completion = await Promise.race([
      handle.exited.then(
        (exitCode) => ({ exitCode, signal: null, error: null }),
        (error) => ({ exitCode: null, signal: null, error: errorMessage(error) }),
      ),
      terminationFailure,
    ])
    if (termination) await termination
    if (terminationError) throw terminationError
  } catch (error) {
    primaryError = error
    throw error
  } finally {
    cleanupStarted = true
    clearInactivityTimer()
    abort.removeEventListener("abort", onAbort)
    const cleanupFailures: unknown[] = []
    try {
      await ProcessSupervisor.disposeAndWaitForExit(handle, `plugin tool command ${handle.pid}`)
    } catch (error) {
      cleanupFailures.push(error)
    }
    try {
      await waitForOutputClose(handle, stdoutClosed, stderrClosed)
    } catch (error) {
      cleanupFailures.push(error)
    }
    if (cleanupFailures.length > 0) {
      throw ProcessSupervisor.combineFailures("Plugin tool command execution and cleanup failed", [
        ...(primaryError ? [primaryError] : []),
        ...cleanupFailures,
      ])
    }
  }

  return finish(completion)
}

export async function withTaskScopedPluginToolHost<T>(
  scope: TaskToolExecutionScope,
  callback: (host: ToolHost) => Promise<T>,
): Promise<T> {
  const execution = createTaskArtifactStoreExecution(scope)
  const commandAbort = new AbortController()
  const commandOperations = new Set<Promise<ToolCommandRunResult>>()
  const fileOperations = new Set<Promise<unknown>>()
  const networkOperations = new Set<Promise<unknown>>()
  const artifactOperations = new Set<Promise<unknown>>()
  const invocationReadFacts: ArtifactReadWindowFact[] = []
  const invocationSelectedLocators = new Map<string, ArtifactReadLocator>()
  let active = true
  const invocationRunCommand = (input: ToolCommandRunInput): Promise<ToolCommandRunResult> => {
    if (!active) return Promise.reject(new Error("Package tool host invocation is closed"))
    const abort = input.abort ? AbortSignal.any([input.abort, commandAbort.signal]) : commandAbort.signal
    const pending = runCommand({ ...input, abort }, scope.taskID)
    commandOperations.add(pending)
    void pending.then(
      () => commandOperations.delete(pending),
      () => commandOperations.delete(pending),
    )
    return pending
  }
  const trackArtifactOperation = <T>(operation: () => Promise<T>): Promise<T> => {
    if (!active) return Promise.reject(new Error("Package tool host invocation is closed"))
    const pending = operation()
    artifactOperations.add(pending)
    void pending.then(
      () => artifactOperations.delete(pending),
      () => artifactOperations.delete(pending),
    )
    return pending
  }
  const trackFileOperation = <T>(operation: () => Promise<T>): Promise<T> => {
    if (!active) return Promise.reject(new Error("Package tool host invocation is closed"))
    const pending = operation()
    fileOperations.add(pending)
    void pending.then(
      () => fileOperations.delete(pending),
      () => fileOperations.delete(pending),
    )
    return pending
  }
  const invocationFetch: ToolHost["fetch"] = (input, init) => {
    if (!active) return Promise.reject(new Error("Package tool host invocation is closed"))
    const pending = Promise.resolve().then(() => {
      assertTaskNetworkCapability({ taskID: scope.taskID, capability: "package-tool HTTP request" })
      return globalThis.fetch(input, init)
    })
    networkOperations.add(pending)
    void pending.then(
      () => networkOperations.delete(pending),
      () => networkOperations.delete(pending),
    )
    return pending
  }
  const artifactAuthority = {
    projectID: scope.projectID,
    projectDirectory: scope.projectDirectory,
    taskID: scope.taskID,
  }
  const observedArtifactLocators = (): ArtifactReadLocator[] => {
    const locators = new Map<string, ArtifactReadLocator>()
    for (const locator of completeArtifactReadsBeforePublication({
      sessionID: scope.sessionID,
      assistantMessageID: scope.messageID,
    })) {
      locators.set(artifactReadLocatorKey(locator), locator)
    }
    for (const locator of auditArtifactReadLocatorsFromFacts(invocationReadFacts).completeLocators) {
      locators.set(artifactReadLocatorKey(locator), locator)
    }
    return [...locators.values()].sort((left, right) =>
      artifactReadLocatorKey(left).localeCompare(artifactReadLocatorKey(right)),
    )
  }
  const selectedArtifactLocators = (): ArtifactReadLocator[] => {
    const locators = new Map<string, ArtifactReadLocator>()
    for (const locator of selectedArtifactLocatorsBeforePublication({
      sessionID: scope.sessionID,
      assistantMessageID: scope.messageID,
    })) {
      locators.set(artifactReadLocatorKey(locator), locator)
    }
    for (const [key, locator] of invocationSelectedLocators) locators.set(key, locator)
    return [...locators.values()].sort((left, right) =>
      artifactReadLocatorKey(left).localeCompare(artifactReadLocatorKey(right)),
    )
  }
  const host = Object.freeze({
    kind: "task" as const,
    managedRuntimeDirectory: scope.taskRuntimeDirectory,
    files: createPluginToolFilesHost(trackFileOperation, {
      taskID: scope.taskID,
    }),
    fetch: invocationFetch,
    runCommand: invocationRunCommand,
    engineArtifacts: Object.freeze({
      publish: (input) =>
        trackArtifactOperation(() =>
          publishExpertArtifact({
            scope,
            artifact: { ...input, idempotent: true },
            observedArtifactLocators: observedArtifactLocators(),
            selectedArtifactLocators: selectedArtifactLocators(),
          }),
        ),
      search: (input) =>
        trackArtifactOperation(() => searchTaskArtifacts({ authority: artifactAuthority, search: input })),
      read: (input) =>
        trackArtifactOperation(async () => {
          const request = ArtifactReadInputSchema.parse(input)
          const result = await readTaskArtifact({ authority: artifactAuthority, read: request })
          invocationReadFacts.push({ request, chunk: result.chunk })
          return result
        }),
      select: (input) =>
        trackArtifactOperation(async () => {
          const selected = ArtifactSelectInputSchema.parse(input)
          const key = artifactReadLocatorKey(selected.locator)
          if (!observedArtifactLocators().some((locator) => artifactReadLocatorKey(locator) === key)) {
            throw new Error(`engineArtifacts.select locator was not completely read before selection: ${key}`)
          }
          invocationSelectedLocators.set(key, selected.locator)
          return ArtifactSelectOutputSchema.parse(selected)
        }),
    }),
    taskArtifacts: Object.freeze({
      stage: execution.stage,
      publish: (stage, input) => execution.publish(stage, { ...input, idempotent: true }),
      resources: execution.resources,
      materialize: execution.materialize,
      verify: execution.verify,
      read: execution.read,
    }),
    taskRuns: Object.freeze({
      collect: (request) =>
        trackArtifactOperation(() =>
          collectTaskRunEvidence({
            projectID: scope.projectID,
            request,
          }),
        ),
    }),
    expertSquadPackages: createExpertSquadPackageHost(execution),
    metrics: createMetricEvaluationHost(scope, execution),
  })
  let output: T | undefined
  let completed = false
  let primaryFailure: unknown
  try {
    output = await callback(host)
    completed = true
  } catch (cause) {
    primaryFailure = cause
  }
  active = false
  commandAbort.abort()
  const cleanupFailures: unknown[] = []
  for (const outcome of await Promise.allSettled([...commandOperations])) {
    if (outcome.status === "rejected") cleanupFailures.push(outcome.reason)
  }
  for (const outcome of await Promise.allSettled([...fileOperations])) {
    if (outcome.status === "rejected") cleanupFailures.push(outcome.reason)
  }
  for (const outcome of await Promise.allSettled([...networkOperations])) {
    if (outcome.status === "rejected") cleanupFailures.push(outcome.reason)
  }
  for (const outcome of await Promise.allSettled([...artifactOperations])) {
    if (outcome.status === "rejected") cleanupFailures.push(outcome.reason)
  }
  try {
    await execution.close()
  } catch (cause) {
    cleanupFailures.push(cause)
  }
  if (primaryFailure && cleanupFailures.length > 0) {
    throw new AggregateError(
      [primaryFailure, ...cleanupFailures],
      "Package tool execution and invocation cleanup both failed",
    )
  }
  if (primaryFailure) throw primaryFailure
  if (cleanupFailures.length === 1) throw cleanupFailures[0]
  if (cleanupFailures.length > 1) {
    throw new AggregateError(cleanupFailures, "Package tool invocation cleanup failed")
  }
  if (!completed) throw new Error("Package tool execution completed without a result")
  return output as T
}
