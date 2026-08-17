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
import { WorktreeOwnershipCriticalSection } from "@/worktree/ownership-critical-section"
import {
  releaseManagedWorktreeSessionOwner,
  type ManagedWorktreeSessionOwnerAuthority,
} from "@/worktree/managed-session-owner"
import { awaitWithAbort } from "@/util/abort"

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
      finish(error?: unknown): void
      reusable: Promise<void>
      reuse(): void
      terminating?: boolean
      cancellationSettlementRequired?: boolean
      timeCreated: number
      timeUpdated: number
      timeCancelled?: number
      cancellation?: ExecutionCancellationError
      directoryOwnership: Disposable
      worktreeOwnerAuthority: ManagedWorktreeSessionOwnerAuthority
    }
  >

  function createPromptState(): PromptState {
    return {}
  }

  function createFinishSignal() {
    let settle!: (error?: unknown) => void
    const finished = new Promise<void>((resolve, reject) => {
      settle = (error) => (error === undefined ? resolve() : reject(error))
    })
    void finished.catch(() => undefined)
    return { finished, finish: settle }
  }

  const statesByDirectory = new Map<string, PromptState>()
  export type CancellationReceipt = {
    directory: string
    owner: AbortSignal
    error: ExecutionCancellationError
    finished: Promise<void>
    outcome: "pending" | "succeeded" | "failed"
    retryCleanup?: () => Promise<void>
    settle: (error?: unknown) => void
    reusable: Promise<void>
    reuse(): void
    settlementRequired: boolean
    retryRunning?: boolean
    retryTimer?: ReturnType<typeof setTimeout>
  }
  const cancellationReceipts = new Map<string, CancellationReceipt>()
  let processSettlementGate: symbol | undefined
  const messageOwnersBySession = new Map<string, { owners: Map<string, AbortSignal>; latestMessageID?: string }>()
  const taskRootIngressOwners = new Map<
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
  const promptSettlementReservations = new Map<string, { token: symbol; owner?: AbortSignal }>()
  const promptOwnerCapture = new AsyncLocalStorage<{
    sessionID: string
    capture(owner: AbortSignal): void
  }>()

  function rootSessionDestructiveOrigin(rootSessionID: string): RootSessionDestructiveOrigin | undefined {
    return rootSessionDestructiveScopes.get(rootSessionID)?.values().next().value
  }

  export function withPromptOwnerCapture<Result>(
    sessionID: string,
    capture: (owner: AbortSignal) => void,
    run: () => Result,
  ): Result {
    return promptOwnerCapture.run({ sessionID, capture }, run)
  }

  function publishPromptOwnerCapture(sessionID: string, owner: AbortSignal): void {
    const target = promptOwnerCapture.getStore()
    if (target?.sessionID === sessionID) target.capture(owner)
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
    if (processSettlementGate) throw new Error("Cannot start a Session prompt during runtime settlement")
    const priorCancellation = cancellationReceipts.get(sessionID)
    if (priorCancellation?.outcome === "succeeded" && !priorCancellation.settlementRequired) {
      priorCancellation.reuse()
      cancellationReceipts.delete(sessionID)
    }
    if (priorCancellation && priorCancellation.outcome !== "succeeded") {
      if (!hasAdoptableRetainedCleanup(priorCancellation)) throw new BusyError(sessionID)
      adoptRetainedCleanup(sessionID, priorCancellation)
    }
    if (priorCancellation?.settlementRequired) throw new BusyError(sessionID)
    const existing = existingStateEntryBySessionID(sessionID)?.promptState[sessionID]
    if (existing?.terminating) throw new BusyError(sessionID)
    if (existing) return
    if (promptStartReservations.has(sessionID) || promptSettlementReservations.has(sessionID)) {
      throw new BusyError(sessionID)
    }
    const { key, promptState: s } = stateEntry(directory)
    const directoryOwnership = WorktreeOwnershipCriticalSection.acquire(key)
    const controller = new AbortController()
    const finished = createFinishSignal()
    const settlement = createFinishSignal()
    const now = Date.now()
    s[sessionID] = {
      abort: controller,
      callbacks: [],
      finished: finished.finished,
      finish: finished.finish,
      reusable: Promise.all([finished.finished.catch(() => undefined), settlement.finished]).then(() => undefined),
      reuse: settlement.finish,
      timeCreated: now,
      timeUpdated: now,
      directoryOwnership,
      worktreeOwnerAuthority: {
        projectID: Instance.project.id,
        primaryWorktreeDir: Instance.project.worktree,
        directory: key,
        sessionID,
      },
    }
    messageOwnersBySession.set(sessionID, { owners: new Map() })
    try {
      SessionStatus.beginPromptGeneration(sessionID, controller.signal)
    } catch (error) {
      delete s[sessionID]
      messageOwnersBySession.delete(sessionID)
      directoryOwnership[Symbol.dispose]()
      deleteDirectoryIfEmpty(key, s)
      throw error
    }
    publishPromptOwnerCapture(sessionID, controller.signal)
    return controller.signal
  }

  export function claimPromptStartReservation(sessionIDs: readonly string[]): Disposable {
    if (processSettlementGate) throw new Error("Cannot reserve a Session prompt start during runtime settlement")
    const identities = [...new Set(sessionIDs)]
    for (const sessionID of identities) {
      if (
        existingStateEntryBySessionID(sessionID) ||
        promptStartReservations.has(sessionID) ||
        promptSettlementReservations.has(sessionID)
      ) {
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

  export function acquireProcessSettlementGate(): Disposable {
    if (processSettlementGate) throw new Error("Session prompt runtime settlement is already in progress")
    const token = Symbol("session-prompt-runtime-settlement")
    processSettlementGate = token
    return {
      [Symbol.dispose]() {
        if (processSettlementGate === token) processSettlementGate = undefined
      },
    }
  }

  /**
   * Hold generation admission while one exact prompt owner crosses from
   * physical cleanup to durable terminal publication. Unlike a start
   * reservation, this may be claimed while that owner is still live.
   */
  export function claimPromptSettlementReservation(
    sessionID: string,
    directory: string,
    owner?: AbortSignal,
  ): Disposable {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (
      (match && match.abort.signal !== owner) ||
      promptStartReservations.has(sessionID) ||
      promptSettlementReservations.has(sessionID)
    ) {
      throw new BusyError(sessionID)
    }
    const token = Symbol("prompt-settlement-reservation")
    promptSettlementReservations.set(sessionID, { token, owner })
    return {
      [Symbol.dispose]: () => {
        if (promptSettlementReservations.get(sessionID)?.token === token) {
          promptSettlementReservations.delete(sessionID)
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
    if (match.terminating) return Promise.reject(new BusyError(sessionID))
    publishPromptOwnerCapture(sessionID, match.abort.signal)
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

  export function attachedReplyTargets(sessionID: string, directory?: string): string[] {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    return (
      match?.callbacks.flatMap((callback) =>
        callback.resultMode === "reply" && callback.replyToMessageID !== undefined ? [callback.replyToMessageID] : [],
      ) ?? []
    )
  }

  export function hasAttachedPromptWork(sessionID: string, directory?: string): boolean {
    return (existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]?.callbacks.length ?? 0) > 0
  }

  export async function enterLoop(input: {
    sessionID: string
    directory: string
    resumeExisting: boolean
    resultMode: ResultMode
    replyToMessageID?: string
  }): Promise<{ abort: AbortSignal | undefined; startedOwner: boolean; firstResult: Promise<Message.WithParts> }> {
    while (true) {
      const match = existingStateEntryForSession(input.sessionID, input.directory).promptState?.[input.sessionID]
      if (match?.terminating) {
        await match.reusable
        continue
      }
      const receipt = cancellationReceipts.get(input.sessionID)
      if (
        receipt?.directory === directoryKey(input.directory) &&
        !(!input.resumeExisting && hasAdoptableRetainedCleanup(receipt))
      ) {
        // A retained-cleanup receipt must reach start(), which adopts it and
        // re-attempts the release; waiting on it here would park this entry
        // until a background retry happens to succeed.
        await receipt.reusable
        continue
      }
      const abort = input.resumeExisting
        ? resume(input.sessionID, input.directory)
        : start(input.sessionID, input.directory)
      return {
        abort,
        startedOwner: !input.resumeExisting && abort !== undefined,
        firstResult: attach(input.sessionID, input.directory, input.resultMode, input.replyToMessageID),
      }
    }
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

  export function hasTaskRootIngressOwner(rootSessionID: string, ingressID: string): boolean {
    return taskRootIngressOwners.get(rootSessionID)?.entries.has(ingressID) === true
  }

  /**
   * Wait for the current physical owner of one durable wake identity to
   * settle. Callers may then re-evaluate durable state before deciding
   * whether the same wake still requires a different delivery phase.
   */
  export async function waitForRootWakeSettlement(rootSessionID: string, wakeID: string): Promise<void> {
    const execution = taskRootIngressOwners.get(rootSessionID)?.entries.get(wakeID)
    if (!execution) return
    await execution.catch(() => undefined)
  }

  /**
   * Preserve one physical writer for persisted Task ingress within a root
   * Session. The durable ingress ID is supplied by the caller; this owner
   * chain does not rank work or decide whether another Task may execute.
   */
  export function runTaskRootIngress<T>(input: {
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
    let ownership = taskRootIngressOwners.get(input.rootSessionID)
    if (!ownership) {
      ownership = {
        tail: Promise.resolve(),
        entries: new Map(),
        controllers: new Map(),
        idleWaiters: new Set(),
      }
      taskRootIngressOwners.set(input.rootSessionID, ownership)
    }
    const existing = ownership.entries.get(input.wakeID)
    if (existing) return existing as Promise<T>

    const controller = new AbortController()
    ownership.controllers.set(input.wakeID, controller)
    const execution = ownership.tail
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
    ownership.entries.set(input.wakeID, execution)
    ownership.tail = execution.then(
      () => undefined,
      () => undefined,
    )
    void execution
      .finally(() => {
        const current = taskRootIngressOwners.get(input.rootSessionID)
        if (!current || current.entries.get(input.wakeID) !== execution) return
        current.entries.delete(input.wakeID)
        current.controllers.delete(input.wakeID)
        if (current.entries.size > 0) return
        taskRootIngressOwners.delete(input.rootSessionID)
        for (const resolve of current.idleWaiters) resolve()
        current.idleWaiters.clear()
      })
      .catch(() => undefined)
    return execution
  }

  export function cancelTaskRootIngresses(rootSessionID: string, origin: RootSessionDestructiveOrigin): number {
    const ownership = taskRootIngressOwners.get(rootSessionID)
    if (!ownership) return 0
    let cancelled = 0
    for (const [wakeID, controller] of ownership.controllers) {
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
    const cancelledWakes = cancelTaskRootIngresses(rootSessionID, origin)
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

  export async function waitForTaskRootIngressIdle(
    rootSessionID: string,
    inactivityTimeoutMs: number,
    signal?: AbortSignal,
  ): Promise<void> {
    signal?.throwIfAborted()
    if (!Number.isInteger(inactivityTimeoutMs) || inactivityTimeoutMs <= 0) {
      throw new Error(`Invalid root Session wake idle timeout ${inactivityTimeoutMs}`)
    }
    let remaining = taskRootIngressOwners.get(rootSessionID)?.entries.size ?? 0
    if (remaining === 0) return
    let inactiveAt = Date.now() + inactivityTimeoutMs
    const pollMs = Math.min(250, Math.max(25, Math.floor(inactivityTimeoutMs / 10)))
    while (remaining > 0) {
      await awaitWithAbort(new Promise((resolve) => setTimeout(resolve, pollMs)), signal)
      signal?.throwIfAborted()
      const next = taskRootIngressOwners.get(rootSessionID)?.entries.size ?? 0
      if (next === 0) return
      if (next !== remaining) {
        remaining = next
        inactiveAt = Date.now() + inactivityTimeoutMs
        continue
      }
      if (Date.now() >= inactiveAt) {
        throw new Error(
          `Root Session ${rootSessionID} root ingress delivery made no settlement progress for ${inactivityTimeoutMs}ms; ${remaining} wake(s) remain`,
        )
      }
    }
  }

  export function promptOwner(sessionID: string): AbortSignal | undefined {
    return existingStateEntryBySessionID(sessionID)?.promptState[sessionID]?.abort.signal
  }

  export function capturePromptOwner(sessionID: string, directory?: string): AbortSignal | undefined {
    const owner = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]?.abort.signal
    if (owner) publishPromptOwnerCapture(sessionID, owner)
    return owner
  }

  export function hasGeneration(sessionID: string): boolean {
    return messageOwnersBySession.has(sessionID)
  }

  export function waitForFinish(sessionID: string, directory?: string): Promise<void> {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (match) return match.finished
    return cancellationReceipt(sessionID, directory)?.finished ?? Promise.resolve()
  }

  /**
   * A receipt whose only unfinished obligation is the retained physical
   * worktree-owner release. Everything else about the cancelled prompt has
   * already terminated, so the retained failure is recovery evidence and must
   * not gate new prompt admission.
   */
  function hasAdoptableRetainedCleanup(receipt: CancellationReceipt): boolean {
    return receipt.outcome !== "succeeded" && !receipt.settlementRequired && receipt.retryCleanup !== undefined
  }

  /**
   * Exit for the retained-cleanup quarantine, tied to the ordinary next
   * prompt start: re-attempt the release now and let the receipt settle (and
   * clear) on success, instead of refusing admission until a restart.
   */
  function adoptRetainedCleanup(sessionID: string, receipt: CancellationReceipt): void {
    log.warn("retrying retained cancellation cleanup on prompt start", {
      sessionID,
      directory: receipt.directory,
    })
    cancellationReceipts.delete(sessionID)
    if (receipt.retryTimer) {
      clearTimeout(receipt.retryTimer)
      receipt.retryTimer = undefined
    }
    startCancellationReceiptRetry(sessionID, receipt)
  }

  function startCancellationReceiptRetry(sessionID: string, receipt: CancellationReceipt): void {
    if (receipt.outcome !== "failed" || !receipt.retryCleanup || receipt.retryRunning || receipt.retryTimer) return
    const retry = receipt.retryCleanup
    receipt.outcome = "pending"
    receipt.retryRunning = true
    void Promise.resolve()
      .then(retry)
      .then(
        () => {
          receipt.retryRunning = false
          receipt.outcome = "succeeded"
          receipt.retryCleanup = undefined
          receipt.settle()
          if (!receipt.settlementRequired) {
            receipt.reuse()
            if (cancellationReceipts.get(sessionID) === receipt) cancellationReceipts.delete(sessionID)
          }
        },
        () => {
          receipt.retryRunning = false
          receipt.outcome = "failed"
          const timer = setTimeout(() => {
            if (receipt.retryTimer === timer) receipt.retryTimer = undefined
            startCancellationReceiptRetry(sessionID, receipt)
          }, 250)
          timer.unref()
          receipt.retryTimer = timer
        },
      )
  }

  export function cancellationReceipt(sessionID: string, directory?: string, owner?: AbortSignal) {
    const receipt = cancellationReceipts.get(sessionID)
    if (!receipt) return undefined
    if (directory !== undefined && receipt.directory !== directoryKey(directory)) return undefined
    if (owner !== undefined && receipt.owner !== owner) return undefined
    startCancellationReceiptRetry(sessionID, receipt)
    return receipt
  }

  export function joinCancellationSettlement(input: {
    sessionID: string
    directory: string
    owner?: AbortSignal
    settlementRequired: boolean
  }) {
    const receipt = cancellationReceipts.get(input.sessionID)
    if (!receipt) return { status: "missing" as const }
    if (receipt.directory !== directoryKey(input.directory) || (input.owner && receipt.owner !== input.owner)) {
      return { status: "mismatch" as const }
    }
    const match = existingStateEntryForSession(input.sessionID, input.directory).promptState?.[input.sessionID]
    if (match) {
      if (match.abort.signal !== receipt.owner) return { status: "mismatch" as const }
      if (input.settlementRequired) {
        match.cancellationSettlementRequired = true
        receipt.settlementRequired = true
      }
    }
    return { status: "joined" as const, receipt }
  }

  export function clearCancellationReceipt(sessionID: string, owner: AbortSignal): void {
    const receipt = cancellationReceipts.get(sessionID)
    // A failed cleanup stays visible to later cancellation barriers until its
    // retained release succeeds — through the background retry or through
    // adoption by the next prompt start — so an explicit clear only applies
    // to receipts that already settled successfully.
    if (receipt?.owner !== owner || receipt.outcome !== "succeeded") return
    receipt.reuse()
    cancellationReceipts.delete(sessionID)
  }

  export function resume(sessionID: string, directory?: string) {
    if (cancellationReceipts.has(sessionID)) throw new BusyError(sessionID)
    const { promptState: s } = existingStateEntryForSession(sessionID, directory)
    if (!s?.[sessionID]) return
    if (s[sessionID].terminating) throw new BusyError(sessionID)

    return s[sessionID].abort.signal
  }

  function cancelMatch(
    sessionID: string,
    directory: string | undefined,
    match: NonNullable<PromptState[string]>,
    options: { origin: ExecutionCancellationOrigin; settlementRequired?: boolean },
  ): CancellationReceipt {
    log.info("cancel", { sessionID })
    if (match.cancellation) {
      const receipt = cancellationReceipts.get(sessionID)
      if (receipt?.owner === match.abort.signal) {
        if (options.settlementRequired) {
          match.cancellationSettlementRequired = true
          receipt.settlementRequired = true
        }
        startCancellationReceiptRetry(sessionID, receipt)
        return receipt
      }
      throw new Error(`Session ${sessionID} cancelled prompt owner is missing its settlement receipt`)
    }
    const error = new ExecutionCancellationError({
      source: "session_prompt",
      sessionID,
      message: options.origin.reason,
      origin: options.origin,
    })
    if (options.settlementRequired) match.cancellationSettlementRequired = true
    SessionStatus.abortActivityMonitor(sessionID, error)
    match.cancellation = error
    const resourceSettlement = createFinishSignal()
    const reuseSettlement = createFinishSignal()
    const receipt: CancellationReceipt = {
      directory: directoryKey(directory),
      owner: match.abort.signal,
      error,
      finished: resourceSettlement.finished,
      outcome: "pending",
      settle: resourceSettlement.finish,
      reusable: Promise.all([resourceSettlement.finished.catch(() => undefined), reuseSettlement.finished]).then(
        () => undefined,
      ),
      reuse() {
        match.reuse()
        reuseSettlement.finish()
      },
      settlementRequired: options.settlementRequired === true,
    }
    cancellationReceipts.set(sessionID, receipt)
    match.abort.abort(error)
    const now = Date.now()
    match.timeCancelled = now
    match.timeUpdated = now
    // Reject all pending callbacks before deleting state so that
    // Exact prompt callers are unblocked after the owner settles.
    for (const cb of match.callbacks) {
      cb.reject(error)
    }
    match.callbacks = []
    // Keep the busy slot until the owning prompt loop observes the abort and
    // calls finish(sessionID, sameAbortSignal). Deleting here lets a retry
    // start in the same session while the old provider/tool stack is still
    // unwinding, which races runtime contracts and terminal collectors.
    return receipt
  }

  export function cancel(
    sessionID: string,
    directory: string | undefined,
    options: { origin: ExecutionCancellationOrigin; settlementRequired?: boolean },
  ): CancellationReceipt | undefined {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!match) return undefined
    return cancelMatch(sessionID, directory, match, options)
  }

  export function cancelOwned(
    sessionID: string,
    directory: string,
    owner: AbortSignal,
    options: { origin: ExecutionCancellationOrigin; settlementRequired?: boolean },
  ): CancellationReceipt | undefined {
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (!match || match.abort.signal !== owner) return undefined
    return cancelMatch(sessionID, directory, match, options)
  }

  export function waitForOwnedFinish(sessionID: string, directory: string, owner: AbortSignal): Promise<void> {
    const receipt = cancellationReceipts.get(sessionID)
    if (receipt?.directory === directoryKey(directory) && receipt.owner === owner) return receipt.finished
    const match = existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]
    if (match?.abort.signal === owner) return match.finished
    return Promise.resolve()
  }

  export const TestHooks = {
    taskRootIngressSnapshot(rootSessionID: string) {
      const ownership = taskRootIngressOwners.get(rootSessionID)
      return ownership ? { entries: ownership.entries.size, idleWaiters: ownership.idleWaiters.size } : undefined
    },
    promptResourceSnapshot(sessionID: string) {
      const entry = existingStateEntryBySessionID(sessionID)
      return {
        promptOwners: entry?.promptState[sessionID] ? 1 : 0,
        messageOwnerRegistries: messageOwnersBySession.has(sessionID) ? 1 : 0,
        startReservations:
          (promptStartReservations.has(sessionID) ? 1 : 0) + (promptSettlementReservations.has(sessionID) ? 1 : 0),
        cancellationReceipts: cancellationReceipts.has(sessionID) ? 1 : 0,
      }
    },
    isPromptTerminating(sessionID: string, directory?: string) {
      return existingStateEntryForSession(sessionID, directory).promptState?.[sessionID]?.terminating === true
    },
  }

  async function terminatePromptResources(input: {
    sessionID: string
    abort?: AbortSignal
    directory?: string
    reason?: unknown
  }): Promise<boolean> {
    const entry =
      (input.abort ? existingStateEntryByAbort(input.sessionID, input.abort) : undefined) ??
      existingStateEntryForSession(input.sessionID, input.directory)
    const { key, promptState } = entry
    const match = promptState?.[input.sessionID]
    if (input.abort && match && match.abort.signal !== input.abort) return false
    if (match?.terminating) {
      await match.finished
      return true
    }
    if (match) match.terminating = true
    const errors: unknown[] = []
    let worktreeReleaseError: unknown
    try {
      if (match && key !== undefined) {
        const error = input.reason ?? new SessionPromptLoopFinishedError(input.sessionID)
        for (const callback of match.callbacks) {
          try {
            callback.reject(error)
          } catch (callbackError) {
            errors.push(callbackError)
          }
        }
        match.callbacks = []
        try {
          SessionStatus.finishPromptGeneration(input.sessionID, match.abort.signal)
        } catch (statusError) {
          errors.push(statusError)
        }
      }
    } finally {
      if (match && key !== undefined) {
        try {
          match.directoryOwnership[Symbol.dispose]()
        } catch (ownershipError) {
          errors.push(ownershipError)
        }
        try {
          await releaseManagedWorktreeSessionOwner(match.worktreeOwnerAuthority)
        } catch (releaseError) {
          worktreeReleaseError = releaseError
          errors.push(releaseError)
        }
        delete promptState[input.sessionID]
        deleteDirectoryIfEmpty(key, promptState)
      }
      messageOwnersBySession.delete(input.sessionID)
      promptStartReservations.delete(input.sessionID)
    }
    const terminalError =
      errors.length === 1
        ? errors[0]
        : errors.length > 1
          ? new AggregateError(errors, `Failed to terminate prompt resources for ${input.sessionID}`)
          : undefined
    const receipt = match ? cancellationReceipts.get(input.sessionID) : undefined
    if (receipt && match && receipt.owner === match.abort.signal) {
      receipt.outcome = terminalError ? "failed" : "succeeded"
      if (terminalError && errors.length === 1 && worktreeReleaseError !== undefined) {
        receipt.retryCleanup = async () => {
          await releaseManagedWorktreeSessionOwner(match.worktreeOwnerAuthority)
        }
        startCancellationReceiptRetry(input.sessionID, receipt)
      } else {
        receipt.settle(terminalError)
      }
    }
    if (!terminalError && match) {
      if (!receipt || !receipt.settlementRequired) {
        match.reuse()
        if (receipt?.owner === match.abort.signal) {
          receipt.reuse()
          cancellationReceipts.delete(input.sessionID)
        }
      }
    }
    match?.finish(terminalError)
    if (terminalError) throw terminalError
    return Boolean(match)
  }

  export async function finish(sessionID: string, abort?: AbortSignal, directory?: string, reason?: unknown) {
    await terminatePromptResources({ sessionID, abort, directory, reason })
  }

  export async function release(sessionID: string, directory?: string): Promise<void> {
    await terminatePromptResources({ sessionID, directory })
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
        return (
          callback.replyToMessageID === replayedReplyToMessageID && result.info.parentID === replayedReplyToMessageID
        )
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
