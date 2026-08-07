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
}): boolean {
  const handle = input.handle ?? "SessionPrompt.cancel"
  const cancelled = SessionPromptState.cancel(input.session.id, input.session.directory, {
    origin: input.origin,
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
}): Promise<boolean> {
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
    })
    if (receipt) {
      await publishSessionStatus(
        input.session,
        { type: "terminal", reason: "aborted", error: receipt.error.message },
        { promptGenerationOwner: receipt.owner },
      )
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
}): Promise<void> {
  const handle = input.handle ?? "SessionPrompt.cancel"
  const failures = [...(input.failures ?? [])]
  const settled = await Promise.allSettled(
    input.sessions.map((session) =>
      awaitSessionPromptFinishedInScope({
        session,
        taskID: input.taskID,
        handle: `${handle}.finish`,
        inactivityTimeoutMs: input.inactivityTimeoutMs,
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
  const cancelled = SessionPromptState.cancel(input.session.id, input.session.directory, { origin: input.origin })
  if (cancelled) {
    await awaitSessionPromptFinishedInScope({
      session: input.session,
      handle: "SessionPrompt.terminate",
    })
  }
  return cancelled
}

export async function terminateOwnedSessionPromptInScope(input: {
  session: Pick<SessionInfo, "id" | "directory">
  owner: AbortSignal
  origin: ExecutionCancellationOrigin
  handle?: string
  inactivityTimeoutMs?: number
}): Promise<boolean> {
  const handle = input.handle ?? "SessionPrompt.terminateOwned"
  const cancelled = SessionPromptState.cancelOwned(input.session.id, input.session.directory, input.owner, {
    origin: input.origin,
  })
  if (!cancelled) return false
  try {
    await waitForPromptFinishAfterInactivity({
      sessionID: input.session.id,
      directory: input.session.directory,
      promptFinished: SessionPromptState.waitForOwnedFinish(input.session.id, input.session.directory, input.owner),
      inactivityTimeoutMs: input.inactivityTimeoutMs ?? DEFAULT_PROMPT_SETTLE_INACTIVITY_MS,
      label: handle,
    })
    const receipt = SessionPromptState.cancellationReceipt(input.session.id, input.session.directory)
    if (receipt?.owner === input.owner) {
      await publishSessionStatus(
        input.session,
        { type: "terminal", reason: "aborted", error: receipt.error.message },
        { promptGenerationOwner: input.owner },
      )
      SessionPromptState.clearCancellationReceipt(input.session.id, input.owner)
    }
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
  return cancelSessionPromptInScope({
    session: await Session.get(input.sessionID),
    taskID: input.taskID,
    handle: input.handle,
    origin: input.origin,
  })
}

function waitForPromptFinishAfterInactivity(input: {
  sessionID: string
  directory: string
  promptFinished?: Promise<void>
  inactivityTimeoutMs: number
  label: string
}): Promise<void> {
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
      fn()
    }
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
    timer = setTimeout(tick, pollMs)
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
