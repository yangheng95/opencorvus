import { Instance } from "../../project/instance"
import { Log } from "../../util/log"
import { Filesystem } from "../../util/filesystem"
import { Message } from "../message"
import { SessionStatus } from "../status"
import {
  ExecutionCancellationError,
  createExecutionCancellationOrigin,
  isExecutionCancellationError,
  type ExecutionCancellationOrigin,
} from "./cancellation"
import { AsyncLocalStorage } from "node:async_hooks"

export class SessionPromptLoopFinishedError extends Error {
  constructor(public readonly sessionID: string) {
    super(`Session ${sessionID} prompt loop finished before delivering an attached result`)
    this.name = "SessionPromptLoopFinishedError"
  }
}

export class SessionPromptReplyError extends Error {
  constructor(
    public readonly sessionID: string,
    public readonly messageID: string,
    public readonly assistantError: unknown,
  ) {
    const record = assistantError as { name?: unknown; data?: { message?: unknown } } | undefined
    const name = typeof record?.name === "string" ? record.name : "AssistantReplyError"
    const detail = typeof record?.data?.message === "string" ? `: ${record.data.message}` : ""
    super(`Session ${sessionID} assistant reply ${messageID} failed with ${name}${detail}`)
    this.name = "SessionPromptReplyError"
  }
}

export namespace SessionPromptState {
  export const log = Log.create({ service: "session.prompt" })
  export type ResultMode = "reply" | "summary"

  class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`)
      this.name = "BusyError"
    }
  }

  // Sessions manage their exact prompt controller via explicit cancel(sessionID).
  type PromptState = Record<
    string,
    {
      abort: AbortController
      callbacks: {
        resolve(input: Message.WithParts): void
        reject(reason?: any): void
        resultMode: ResultMode
        replyToMessageID?: string
      }[]
      finished: Promise<void>
      finish(): void
      timeCreated: number
      timeUpdated: number
      timeCancelled?: number
      cancellation?: ExecutionCancellationError
    }
  >

  function createPromptState(): PromptState {
    return {}
  }

  function createFinishSignal() {
    let finish!: () => void
    const finished = new Promise<void>((resolve) => {
      finish = resolve
    })
    return { finished, finish }
  }

  const statesByDirectory = new Map<string, PromptState>()
  const cancellationReceipts = new Map<
    string,
    {
      directory: string
      owner: AbortSignal
      error: ExecutionCancellationError
      finished: Promise<void>
    }
  >()
  const messageOwnersBySession = new Map<string, { owners: Map<string, AbortSignal>; latestMessageID?: string }>()
  const rootWakeQueues = new Map<
    string,
    {
      tail: Promise<void>
      entries: Map<string, Promise<unknown>>
      controllers: Map<string, AbortController>
      idleWaiters: Set<() => void>
    }
  >()
  type RootSessionDestructiveOrigin = Omit<ExecutionCancellationOrigin, "targetSessionID" | "wakeID">
  const rootSessionDestructiveScopes = new Map<string, Map<symbol, RootSessionDestructiveOrigin>>()
  const rootSessionProcessShutdownHandoffs = new Map<string, Set<symbol>>()
  const promptStartReservations = new Map<string, symbol>()
  const promptOwnerCapture = new AsyncLocalStorage<(owner: AbortSignal) => void>()

  function rootSessionDestructiveOrigin(rootSessionID: string): RootSessionDestructiveOrigin | undefined {
    return rootSessionDestructiveScopes.get(rootSessionID)?.values().next().value
  }

  export function withPromptOwnerCapture<Result>(capture: (owner: AbortSignal) => void, run: () => Result): Result {
    return promptOwnerCapture.run(capture, run)
  }

  function directoryKey(directory?: string) {
    return Filesystem.resolve(directory ?? Instance.directory)
  }

  function stateEntry(directory?: string) {
    const key = directoryKey(directory)
    let promptState = statesByDirectory.get(key)
    if (!promptState) {
      promptState = createPromptState()
      statesByDirectory.set(key, promptState)
    }
    return { key, promptState }
  }

  function existingStateEntry(directory?: string) {
    const key = directoryKey(directory)
    return { key, promptState: statesByDirectory.get(key) }
  }

  function existingStateEntryBySessionID(sessionID: string) {
    for (const [key, promptState] of statesByDirectory) {
      if (promptState[sessionID]) return { key, promptState }
    }
    return undefined
  }

  function existingStateEntryByAbort(sessionID: string, abort: AbortSignal) {
    for (const [key, promptState] of statesByDirectory) {
      const match = promptState[sessionID]
      if (match?.abort.signal === abort) return { key, promptState }
    }
    return undefined
  }

  function existingStateEntryForSession(sessionID: string, directory?: string) {
    if (directory !== undefined) return existingStateEntry(directory)
    return existingStateEntryBySessionID(sessionID) ?? { key: undefined, promptState: undefined }
  }

  function deleteDirectoryIfEmpty(key: string, promptState: PromptState) {
    if (Object.keys(promptState).length === 0 && statesByDirectory.get(key) === promptState) {
      statesByDirectory.delete(key)
    }
  }

  export function state(directory?: string) {
    return stateEntry(directory).promptState
  }

  export function assertNoOwnedPrompt(sessionID: string) {
    if (existingStateEntryBySessionID(sessionID)) throw new BusyError(sessionID)
  }

  export function start(sessionID: string, directory?: string) {
    if (existingStateEntryBySessionID(sessionID)) return
    if (promptStartReservations.has(sessionID)) throw new BusyError(sessionID)
    const { promptState: s } = stateEntry(directory)
    const controller = new AbortController()
    const finished = createFinishSignal()
    const now = Date.now()
    s[sessionID] = {
      abort: controller,
      callbacks: [],
      finished: finished.finished,
      finish: finished.finish,
      timeCreated: now,
      timeUpdated: now,
    }
    messageOwnersBySession.set(sessionID, { owners: new Map() })
    SessionStatus.beginPromptGeneration(sessionID, controller.signal)
    promptOwnerCapture.getStore()?.(controller.signal)
    return controller.signal
  }

  export function claimPromptStartReservation(sessionIDs: readonly string[]): Disposable {
    const identities = [...new Set(sessionIDs)]
    for (const sessionID of identities) {
      if (existingStateEntryBySessionID(sessionID) || promptStartReservations.has(sessionID)) {
        throw new BusyError(sessionID)
      }
    }
    const token = Symbol("prompt-start-reservation")
    for (const sessionID of identities) promptStartReservations.set(sessionID, token)
    return {
      [Symbol.dispose]: () => {
        for (const sessionID of identities) {
          if (promptStartReservations.get(sessionID) === token) promptStartReservations.delete(sessionID)
        }
      },
    }
  }

  export function bindMessageOwner(sessionID: string, messageID: string, owner: AbortSignal): void {
    const active = existingStateEntryByAbort(sessionID, owner)?.promptState[sessionID]
    if (!active) throw new Error(`Session ${sessionID} cannot bind message ${messageID} to an inactive prompt owner`)
    const messageOwners = messageOwnersBySession.get(sessionID)
    if (!messageOwners) throw new Error(`Session ${sessionID} prompt message-owner registry is missing`)
    messageOwners.owners.set(messageID, owner)
    messageOwners.latestMessageID = messageID
  }

  export function messageOwner(sessionID: string, messageID: string): AbortSignal | undefined {
    return messageOwnersBySession.get(sessionID)?.owners.get(messageID)
  }

  export function latestMessageID(sessionID: string, owner: AbortSignal): string | undefined {
    const messageOwners = messageOwnersBySession.get(sessionID)
    if (!messageOwners) return undefined
    return messageOwners.latestMessageID && messageOwners.owners.get(messageOwners.latestMessageID) === owner
      ? messageOwners.latestMessageID
      : undefined
  }

  export function touch(sessionID: string, directory?: string): void {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!match) return
    match.timeUpdated = Date.now()
  }

  export function activity(sessionID: string, directory?: string) {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!match) return undefined
    return {
      timeCreated: match.timeCreated,
      timeUpdated: match.timeUpdated,
      timeCancelled: match.timeCancelled,
    }
  }

  export function attach(
    sessionID: string,
    directory?: string,
    resultMode: ResultMode = "reply",
    replyToMessageID?: string,
  ): Promise<Message.WithParts> {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!match) {
      return Promise.reject(new Error(`Session ${sessionID} prompt owner missing during attach`))
    }
    promptOwnerCapture.getStore()?.(match.abort.signal)
    if (match.abort.signal.aborted || match.timeCancelled !== undefined) {
      if (!match.cancellation) {
        return Promise.reject(new Error(`Session ${sessionID} has an aborted prompt owner without typed cancellation`))
      }
      return Promise.reject(match.cancellation)
    }
    touch(sessionID, directory)
    return new Promise<Message.WithParts>((resolve, reject) => {
      match.callbacks.push({ resolve, reject, resultMode, replyToMessageID })
    })
  }

  export function hasOwnedPrompt(sessionID: string, directory?: string): boolean {
    return Boolean(existingStateEntryForSession(sessionID, directory).promptState?.[sessionID])
  }

  export function hasOwnedPromptInAnyDirectory(sessionID: string): boolean {
    for (const promptState of statesByDirectory.values()) {
      if (promptState[sessionID]) return true
    }
    return false
  }

  export function ownedPromptSessionIDs(): string[] {
    const ids = new Set<string>()
    for (const promptState of statesByDirectory.values()) {
      for (const sessionID of Object.keys(promptState)) ids.add(sessionID)
    }
    return [...ids]
  }

  /** Physical prompt ownership for one exact filesystem directory. */
  export function hasOwnedPromptInDirectory(directory: string): boolean {
    const promptState = statesByDirectory.get(directoryKey(directory))
    return Boolean(promptState && Object.keys(promptState).length > 0)
  }

  /**
   * Serialize persisted scheduler wakes by the Task root Session identity.
   * A wake ID is the durable artifact identity supplied by the caller; this
   * process-local queue owns ordering only and never decides whether work is
   * current, live, stale, or admissible.
   */
  export function enqueueRootWake<T>(input: {
    rootSessionID: string
    wakeID: string
    run: (signal: AbortSignal) => Promise<T>
  }): Promise<T> {
    const destructiveOrigin = rootSessionDestructiveOrigin(input.rootSessionID)
    if (destructiveOrigin) {
      return Promise.reject(
        new ExecutionCancellationError({
          source: "session_prompt",
          sessionID: input.rootSessionID,
          message: destructiveOrigin.reason,
          origin: {
            ...destructiveOrigin,
            targetSessionID: input.rootSessionID,
            wakeID: input.wakeID,
          },
        }),
      )
    }
    let queue = rootWakeQueues.get(input.rootSessionID)
    if (!queue) {
      queue = {
        tail: Promise.resolve(),
        entries: new Map(),
        controllers: new Map(),
        idleWaiters: new Set(),
      }
      rootWakeQueues.set(input.rootSessionID, queue)
    }
    const existing = queue.entries.get(input.wakeID)
    if (existing) return existing as Promise<T>

    const controller = new AbortController()
    queue.controllers.set(input.wakeID, controller)
    const execution = queue.tail
      .catch(() => undefined)
      .then(async () => {
        if (controller.signal.aborted) {
          if (!isExecutionCancellationError(controller.signal.reason)) {
            throw new Error(`Root Session wake ${input.wakeID} has an untyped cancellation reason`)
          }
          throw controller.signal.reason
        }
        return await input.run(controller.signal)
      })
    queue.entries.set(input.wakeID, execution)
    queue.tail = execution.then(
      () => undefined,
      () => undefined,
    )
    void execution
      .finally(() => {
        const current = rootWakeQueues.get(input.rootSessionID)
        if (!current || current.entries.get(input.wakeID) !== execution) return
        current.entries.delete(input.wakeID)
        current.controllers.delete(input.wakeID)
        if (current.entries.size > 0) return
        rootWakeQueues.delete(input.rootSessionID)
        for (const resolve of current.idleWaiters) resolve()
        current.idleWaiters.clear()
      })
      .catch(() => undefined)
    return execution
  }

  export function cancelRootWakeQueue(rootSessionID: string, origin: RootSessionDestructiveOrigin): number {
    const queue = rootWakeQueues.get(rootSessionID)
    if (!queue) return 0
    let cancelled = 0
    for (const [wakeID, controller] of queue.controllers) {
      if (controller.signal.aborted) continue
      controller.abort(
        new ExecutionCancellationError({
          source: "session_prompt",
          sessionID: rootSessionID,
          message: origin.reason,
          origin: {
            ...origin,
            targetSessionID: rootSessionID,
            wakeID,
          },
        }),
      )
      cancelled += 1
    }
    return cancelled
  }

  export function assertSessionCreationAllowed(ancestorSessionIDs: readonly string[]): void {
    const blocked = ancestorSessionIDs
      .map((sessionID) => ({ sessionID, origin: rootSessionDestructiveOrigin(sessionID) }))
      .find((candidate) => candidate.origin)
    if (!blocked?.origin) return
    throw new ExecutionCancellationError({
      source: "session_prompt",
      sessionID: blocked.sessionID,
      message: blocked.origin.reason,
      origin: { ...blocked.origin, targetSessionID: blocked.sessionID },
    })
  }

  export function beginRootSessionDestructiveScope(
    rootSessionID: string,
    origin: RootSessionDestructiveOrigin,
  ): {
    cancelledWakes: number
    close(): void
  } {
    const token = Symbol(rootSessionID)
    const scopes = rootSessionDestructiveScopes.get(rootSessionID) ?? new Map<symbol, RootSessionDestructiveOrigin>()
    scopes.set(token, origin)
    rootSessionDestructiveScopes.set(rootSessionID, scopes)
    const cancelledWakes = cancelRootWakeQueue(rootSessionID, origin)
    let closed = false
    return {
      cancelledWakes,
      close() {
        if (closed) return
        closed = true
        const current = rootSessionDestructiveScopes.get(rootSessionID)
        if (!current?.delete(token)) return
        if (current.size === 0) rootSessionDestructiveScopes.delete(rootSessionID)
      },
    }
  }

  /**
   * Process shutdown is the one destructive lifecycle that must leave its
   * durable Task wake for the replacement process. Keep that policy separate
   * from cancel/delete/archive/rewind scopes, whose concurrent wakes retain
   * their existing rejection semantics.
   */
  export function beginRootSessionProcessShutdownHandoff(
    rootSessionID: string,
    origin: RootSessionDestructiveOrigin,
  ): {
    cancelledWakes: number
    close(): void
  } {
    const destructive = beginRootSessionDestructiveScope(rootSessionID, origin)
    const token = Symbol(rootSessionID)
    const handoffs = rootSessionProcessShutdownHandoffs.get(rootSessionID) ?? new Set<symbol>()
    handoffs.add(token)
    rootSessionProcessShutdownHandoffs.set(rootSessionID, handoffs)
    let closed = false
    return {
      cancelledWakes: destructive.cancelledWakes,
      close() {
        if (closed) return
        closed = true
        const current = rootSessionProcessShutdownHandoffs.get(rootSessionID)
        current?.delete(token)
        if (current?.size === 0) rootSessionProcessShutdownHandoffs.delete(rootSessionID)
        destructive.close()
      },
    }
  }

  export function isRootSessionProcessShutdownHandoffActive(rootSessionID: string): boolean {
    return (rootSessionProcessShutdownHandoffs.get(rootSessionID)?.size ?? 0) > 0
  }

  export async function waitForRootWakeQueueIdle(rootSessionID: string, inactivityTimeoutMs: number): Promise<void> {
    if (!Number.isInteger(inactivityTimeoutMs) || inactivityTimeoutMs <= 0) {
      throw new Error(`Invalid root Session wake idle timeout ${inactivityTimeoutMs}`)
    }
    const queue = rootWakeQueues.get(rootSessionID)
    if (!queue || queue.entries.size === 0) return
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        new Promise<void>((resolve) => queue.idleWaiters.add(resolve)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`Root Session ${rootSessionID} wake queue did not settle within ${inactivityTimeoutMs}ms`),
              ),
            inactivityTimeoutMs,
          )
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  export function promptOwner(sessionID: string): AbortSignal | undefined {
    return existingStateEntryBySessionID(sessionID)?.promptState[sessionID]?.abort.signal
  }

  export function capturePromptOwner(sessionID: string, directory?: string): AbortSignal | undefined {
    const owner = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]?.abort.signal
    if (owner) promptOwnerCapture.getStore()?.(owner)
    return owner
  }

  export function hasGeneration(sessionID: string): boolean {
    return messageOwnersBySession.has(sessionID)
  }

  export function waitForFinish(sessionID: string, directory?: string): Promise<void> {
    return existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]?.finished ?? Promise.resolve()
  }

  export function cancellationReceipt(sessionID: string, directory?: string) {
    const receipt = cancellationReceipts.get(sessionID)
    if (!receipt) return undefined
    if (directory !== undefined && receipt.directory !== directoryKey(directory)) return undefined
    return receipt
  }

  export function clearCancellationReceipt(sessionID: string, owner: AbortSignal): void {
    if (cancellationReceipts.get(sessionID)?.owner === owner) cancellationReceipts.delete(sessionID)
  }

  export function resume(sessionID: string, directory?: string) {
    const { promptState: s } = existingStateEntryForSession(sessionID, directory)
    if (!s?.[sessionID]) return

    return s[sessionID].abort.signal
  }

  function cancelMatch(
    sessionID: string,
    directory: string | undefined,
    match: NonNullable<PromptState[string]>,
    options: { origin: ExecutionCancellationOrigin },
  ): boolean {
    log.info("cancel", { sessionID })
    if (match.cancellation) return true
    const error = new ExecutionCancellationError({
      source: "session_prompt",
      sessionID,
      message: options.origin.reason,
      origin: options.origin,
    })
    SessionStatus.abortActivityMonitor(sessionID, error)
    match.cancellation = error
    cancellationReceipts.set(sessionID, {
      directory: directoryKey(directory),
      owner: match.abort.signal,
      error,
      finished: match.finished,
    })
    match.abort.abort(error)
    const now = Date.now()
    match.timeCancelled = now
    match.timeUpdated = now
    // Reject all pending callbacks before deleting state so that
    // executePrompt() callers (task-queue-service) are unblocked.
    for (const cb of match.callbacks) {
      cb.reject(error)
    }
    match.callbacks = []
    // Keep the busy slot until the owning prompt loop observes the abort and
    // calls finish(sessionID, sameAbortSignal). Deleting here lets a retry
    // start in the same session while the old provider/tool stack is still
    // unwinding, which races runtime contracts and terminal collectors.
    return true
  }

  export function cancel(
    sessionID: string,
    directory: string | undefined,
    options: { origin: ExecutionCancellationOrigin },
  ): boolean {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!match) return false
    return cancelMatch(sessionID, directory, match, options)
  }

  export function cancelOwned(
    sessionID: string,
    directory: string,
    owner: AbortSignal,
    options: { origin: ExecutionCancellationOrigin },
  ): boolean {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!match || match.abort.signal !== owner) return false
    return cancelMatch(sessionID, directory, match, options)
  }

  export function waitForOwnedFinish(sessionID: string, directory: string, owner: AbortSignal): Promise<void> {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (match?.abort.signal === owner) return match.finished
    const receipt = cancellationReceipts.get(sessionID)
    if (receipt?.directory === directoryKey(directory) && receipt.owner === owner) return receipt.finished
    return Promise.resolve()
  }

  export function finish(sessionID: string, abort?: AbortSignal, directory?: string, reason?: unknown) {
    const entry =
      (abort ? existingStateEntryByAbort(sessionID, abort) : undefined) ??
      existingStateEntryForSession(sessionID, directory)
    const { key, promptState: s } = entry
    const match = s?.[sessionID]
    if (key === undefined) return
    if (!match) return
    if (abort && match.abort.signal !== abort) return
    const error = reason ?? new SessionPromptLoopFinishedError(sessionID)
    for (const cb of match.callbacks) {
      cb.reject(error)
    }
    match.callbacks = []
    match.finish()
    SessionStatus.finishPromptGeneration(sessionID, match.abort.signal)
    delete s[sessionID]
    messageOwnersBySession.delete(sessionID)
    deleteDirectoryIfEmpty(key, s)
  }

  export function release(sessionID: string): void {
    messageOwnersBySession.delete(sessionID)
    promptStartReservations.delete(sessionID)
    cancellationReceipts.delete(sessionID)
  }

  export function flushCallbacks(
    sessionID: string,
    result: Message.WithParts,
    directory?: string,
    resultMode: ResultMode = "reply",
    replayedReplyToMessageID?: string,
  ): number {
    const s = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!s) return 0
    s.timeUpdated = Date.now()
    const matches = (callback: (typeof s.callbacks)[number]) => {
      if (callback.resultMode !== resultMode) return false
      if (resultMode !== "reply") return true
      if (result.info.role !== "assistant") return false
      if (replayedReplyToMessageID !== undefined) {
        return callback.replyToMessageID === replayedReplyToMessageID && result.info.parentID === replayedReplyToMessageID
      }
      return callback.replyToMessageID === undefined || result.info.parentID === callback.replyToMessageID
    }
    const matching = s.callbacks.filter(matches)
    s.callbacks = s.callbacks.filter((callback) => !matches(callback))
    for (const callback of matching) callback.resolve(result)
    return matching.length
  }

  export function rejectAttachedCallbacks(
    sessionID: string,
    error: unknown,
    directory: string | undefined,
    resultMode: ResultMode,
    replyToMessageID: string | undefined,
  ): number {
    const s = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!s) return 0
    const matches = (callback: (typeof s.callbacks)[number]) =>
      callback.resultMode === resultMode && callback.replyToMessageID === replyToMessageID
    const matching = s.callbacks.filter(matches)
    s.callbacks = s.callbacks.filter((callback) => !matches(callback))
    for (const callback of matching) callback.reject(error)
    return matching.length
  }
}
