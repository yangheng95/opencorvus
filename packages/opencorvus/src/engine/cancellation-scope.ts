import { Session } from "@/session"
import { Instance } from "@/project/instance"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionStatus } from "@/session/status"
import { publishSessionStatus } from "@/session/status-publication"
import { AwaitTimeoutError } from "@/util/await-with-timeout"
import { createTaskCancellationIncomplete } from "./cancellation-error"
import type { ExecutionCancellationOrigin } from "@/session/prompt/cancellation"

type SessionInfo = Awaited<ReturnType<typeof Session.get>>
type PromptSession = Pick<SessionInfo, "id" | "directory">
export type TaskAgentPromptSession = PromptSession

const DEFAULT_PROMPT_SETTLE_INACTIVITY_MS = 5_000

export function cancelSessionPromptInScope(input: {
  session: Pick<SessionInfo, "id" | "directory">
  taskID?: string
  handle?: string
  origin: ExecutionCancellationOrigin
  settleBeforeReuse: boolean
}): SessionPromptState.CancellationReceipt | undefined {
  const handle = input.handle ?? "SessionPrompt.cancel"
  const retained = SessionPromptState.joinCancellationSettlement({
    sessionID: input.session.id,
    directory: input.session.directory,
    settlementRequired: input.settleBeforeReuse,
  })
  if (retained.status === "mismatch") {
    throw createTaskCancellationIncomplete({
      taskID: input.taskID,
      handle,
      cause: new Error(`Session ${input.session.id} has retained cancellation outside its exact directory`),
    })
  }
  if (retained.status === "joined") return retained.receipt
  const cancelled = SessionPromptState.cancel(input.session.id, input.session.directory, {
    origin: input.origin,
    settlementRequired: input.settleBeforeReuse,
  })
  if (!cancelled && SessionPromptState.hasOwnedPromptInAnyDirectory(input.session.id)) {
    throw createTaskCancellationIncomplete({
      taskID: input.taskID,
      handle,
      cause: new Error(
        `Session ${input.session.id} has an exact prompt controller outside its persisted directory ${input.session.directory}`,
      ),
    })
  }
  return cancelled
}

export async function awaitSessionPromptFinishedInScope(input: {
  session: Pick<SessionInfo, "id" | "directory">
  taskID?: string
  handle?: string
  inactivityTimeoutMs?: number
  signal?: AbortSignal
}): Promise<boolean> {
  input.signal?.throwIfAborted()
  const handle = input.handle ?? "SessionPrompt.finish"
  const receipt = SessionPromptState.cancellationReceipt(input.session.id, input.session.directory)
  if (!receipt && !SessionPromptState.hasOwnedPrompt(input.session.id, input.session.directory)) return false
  try {
    await waitForPromptFinishAfterInactivity({
      sessionID: input.session.id,
      directory: input.session.directory,
      promptFinished: receipt?.finished,
      inactivityTimeoutMs: input.inactivityTimeoutMs ?? DEFAULT_PROMPT_SETTLE_INACTIVITY_MS,
      label: handle,
      signal: input.signal,
    })
    if (receipt) {
      input.signal?.throwIfAborted()
      await publishSessionStatus(
        input.session,
        { type: "terminal", reason: "aborted", error: receipt.error.message },
        { promptGenerationOwner: receipt.owner, signal: input.signal },
      )
      input.signal?.throwIfAborted()
      SessionPromptState.clearCancellationReceipt(input.session.id, receipt.owner)
    }
    return true
  } catch (cause) {
    throw createTaskCancellationIncomplete({
      taskID: input.taskID,
      handle,
      cause,
    })
  }
}

export async function cancelSessionPromptSubtreeInScope(input: {
  sessionID: string
  projectID: string
  taskID?: string
  handle?: string
  origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
  inactivityTimeoutMs?: number
}): Promise<{ sessionIDs: string[]; cancelledSessionIDs: string[] }> {
  const requested = await requestSessionPromptSubtreeCancellation(input)
  await assertSessionPromptSubtreeFinished({
    sessions: requested.cancelledSessions,
    failures: requested.failures,
    taskID: input.taskID,
    handle: input.handle,
    inactivityTimeoutMs: input.inactivityTimeoutMs,
  })
  return {
    sessionIDs: requested.sessionIDs,
    cancelledSessionIDs: requested.cancelledSessions.map((session) => session.id),
  }
}

export async function requestSessionPromptSubtreeCancellation(input: {
  sessionID: string
  projectID: string
  taskID?: string
  handle?: string
  origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
}): Promise<{ sessionIDs: string[]; cancelledSessions: PromptSession[]; failures: unknown[] }> {
  const handle = input.handle ?? "SessionPrompt.cancel"
  const sessionIDs = await Session.treeInProject({ sessionID: input.sessionID, projectID: input.projectID })
  const sessions = await Promise.all(
    sessionIDs.map((sessionID) => Session.getInProject({ sessionID, projectID: input.projectID })),
  )
  const cancelledSessions: PromptSession[] = []
  const failures: unknown[] = []

  for (const session of sessions.slice().reverse()) {
    try {
      const cancelled = await Instance.provide({
        directory: session.directory,
        fn: () =>
          cancelSessionPromptInScope({
            session,
            taskID: input.taskID,
            handle,
            origin: { ...input.origin, targetSessionID: session.id },
            settleBeforeReuse: true,
          }),
      })
      if (cancelled) {
        cancelledSessions.push(session)
      }
    } catch (error) {
      failures.push(error)
    }
  }

  return { sessionIDs, cancelledSessions, failures }
}

export async function assertSessionPromptSubtreeFinished(input: {
  sessions: PromptSession[]
  failures?: unknown[]
  taskID?: string
  handle?: string
  inactivityTimeoutMs?: number
  signal?: AbortSignal
}): Promise<void> {
  input.signal?.throwIfAborted()
  const handle = input.handle ?? "SessionPrompt.cancel"
  const failures = [...(input.failures ?? [])]
  const settled = await Promise.allSettled(
    input.sessions.map((session) =>
      awaitSessionPromptFinishedInScope({
        session,
        taskID: input.taskID,
        handle: `${handle}.finish`,
        inactivityTimeoutMs: input.inactivityTimeoutMs,
        signal: input.signal,
      }),
    ),
  )
  for (const result of settled) {
    if (result.status === "rejected") failures.push(result.reason)
  }

  if (failures.length > 0) {
    throw createTaskCancellationIncomplete({
      taskID: input.taskID,
      handle,
      cause: new Error(failures.map(cancellationFailureMessage).join("; ")),
    })
  }
}

export async function terminateSessionPromptInScope(input: {
  session: Pick<SessionInfo, "id" | "directory">
  origin: ExecutionCancellationOrigin
}): Promise<boolean> {
  const settlement = cancelSessionPromptInScope({
    session: input.session,
    origin: input.origin,
    handle: "SessionPrompt.terminate",
    settleBeforeReuse: true,
  })
  if (settlement) {
    await awaitSessionPromptFinishedInScope({
      session: input.session,
      handle: "SessionPrompt.terminate",
    })
  }
  return Boolean(settlement)
}

export async function terminateOwnedSessionPromptInScope(input: {
  session: Pick<SessionInfo, "id" | "directory">
  owner: AbortSignal
  origin: ExecutionCancellationOrigin
  handle?: string
  inactivityTimeoutMs?: number
}): Promise<boolean> {
  const handle = input.handle ?? "SessionPrompt.terminateOwned"
  try {
    const retained = SessionPromptState.joinCancellationSettlement({
      sessionID: input.session.id,
      directory: input.session.directory,
      owner: input.owner,
      settlementRequired: true,
    })
    if (retained.status === "mismatch") {
      throw new Error(`Session ${input.session.id} retained cancellation does not match its exact owner and directory`)
    }
    let receipt = retained.status === "joined" ? retained.receipt : undefined
    if (!receipt) {
      const cancelled = SessionPromptState.cancelOwned(input.session.id, input.session.directory, input.owner, {
        origin: input.origin,
        settlementRequired: true,
      })
      if (!cancelled) return false
      receipt = SessionPromptState.cancellationReceipt(input.session.id, input.session.directory)
      if (!receipt || receipt.owner !== input.owner) {
        throw new Error(`Session ${input.session.id} cancelled without its exact prompt-owner receipt`)
      }
    }
    await waitForPromptFinishAfterInactivity({
      sessionID: input.session.id,
      directory: input.session.directory,
      promptFinished: receipt.finished,
      inactivityTimeoutMs: input.inactivityTimeoutMs ?? DEFAULT_PROMPT_SETTLE_INACTIVITY_MS,
      label: handle,
    })
    await publishSessionStatus(
      input.session,
      { type: "terminal", reason: "aborted", error: receipt.error.message },
      { promptGenerationOwner: input.owner },
    )
    SessionPromptState.clearCancellationReceipt(input.session.id, input.owner)
    return true
  } catch (cause) {
    throw createTaskCancellationIncomplete({ handle, cause })
  }
}

export async function cancelSessionPromptByID(input: {
  sessionID: string
  taskID?: string
  handle?: string
  origin: ExecutionCancellationOrigin
}): Promise<boolean> {
  return Boolean(
    cancelSessionPromptInScope({
      session: await Session.get(input.sessionID),
      taskID: input.taskID,
      handle: input.handle,
      origin: input.origin,
      settleBeforeReuse: false,
    }),
  )
}

function waitForPromptFinishAfterInactivity(input: {
  sessionID: string
  directory: string
  promptFinished?: Promise<void>
  inactivityTimeoutMs: number
  label: string
  signal?: AbortSignal
}): Promise<void> {
  input.signal?.throwIfAborted()
  if (!input.promptFinished && !SessionPromptState.hasOwnedPrompt(input.sessionID, input.directory))
    return Promise.resolve()

  const promptFinished = input.promptFinished ?? SessionPromptState.waitForFinish(input.sessionID, input.directory)
  const pollMs = Math.min(250, Math.max(25, Math.floor(input.inactivityTimeoutMs / 10)))
  let lastSignature = ""
  let idleDeadline = Date.now() + input.inactivityTimeoutMs

  const observeActivity = () => {
    const status = SessionStatus.get(input.sessionID)
    const activity = SessionStatus.getActivity(input.sessionID)
    const signature = `${status.type}:${status.type === "terminal" ? status.reason : ""}:${
      activity?.last_activity_at ?? 0
    }`
    if (signature !== lastSignature) {
      lastSignature = signature
      idleDeadline = Date.now() + input.inactivityTimeoutMs
    }
  }

  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false

    const complete = (fn: () => void) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      input.signal?.removeEventListener("abort", abort)
      fn()
    }
    const abort = () => complete(() => reject(input.signal?.reason))
    const tick = () => {
      if (settled) return
      observeActivity()
      if (Date.now() > idleDeadline) {
        complete(() =>
          reject(new AwaitTimeoutError(`${input.label} ${input.sessionID} inactive`, input.inactivityTimeoutMs)),
        )
        return
      }
      timer = setTimeout(tick, pollMs)
    }

    observeActivity()
    input.signal?.addEventListener("abort", abort, { once: true })
    if (input.signal?.aborted) abort()
    if (!settled) timer = setTimeout(tick, pollMs)
    promptFinished.then(
      () => complete(() => resolve()),
      (error) => complete(() => reject(error)),
    )
  })
}

function cancellationFailureMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
