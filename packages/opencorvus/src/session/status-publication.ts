import {
  awaitTaskMessageProtocolBridgeIdle,
  ensureTaskMessageProtocolBridge,
  persistTaskSessionLifecycle,
} from "@/orchestrator/protocol/message-bridge"
import { Instance } from "@/project/instance"
import { runWithIndependentProjectIdentity } from "@/project/independent-project-owner"
import type { Session } from "@/session"
import { executionLifecycleOrderKey, SessionStatus } from "@/session/status"
import { awaitWithAbort } from "@/util/abort"

type SettledSessionTerminalStatusInput = {
  session: Pick<Session.Info, "id" | "directory" | "projectID">
  taskID: string
  inputMessageID: string
  status: Extract<SessionStatus.Info, { type: "terminal" }>
  signal?: AbortSignal
}

/**
 * Publish lifecycle state from the session's own project directory and wait
 * for the local Bus subscribers to finish. Worker completion can outlive the
 * caller's Instance lease, so inheriting that lease can either reject the
 * publish or let the lease close before the durable protocol bridge settles.
 */
export async function publishSessionStatus(
  session: Pick<Session.Info, "id" | "directory">,
  status: SessionStatus.Info,
  options?: { promptGenerationOwner?: AbortSignal; inputMessageID?: string; taskID?: string; signal?: AbortSignal },
): Promise<void> {
  options?.signal?.throwIfAborted()
  await awaitWithAbort(
    runWithIndependentProjectIdentity({
      directory: session.directory,
      fn: () => {
        options?.signal?.throwIfAborted()
        ensureTaskMessageProtocolBridge()
        return SessionStatus.set(session.id, status, options)
      },
    }),
    options?.signal,
  )
  options?.signal?.throwIfAborted()
  if (options?.taskID) await awaitWithAbort(awaitTaskMessageProtocolBridgeIdle(), options.signal)
}

/**
 * Close one Session after its physical prompt and queue ownership have already
 * settled. This is the restart-safe complement to publishSessionStatus:
 * process-local state can be empty while the durable Task ledger still ends in
 * streaming/retry. Persist the process latch's first terminal fact when one
 * exists; otherwise make the requested terminal fact the latch owner.
 */
async function persistSettledSessionTerminalStatus(
  input: SettledSessionTerminalStatusInput,
): Promise<Extract<SessionStatus.Info, { type: "terminal" }>> {
  input.signal?.throwIfAborted()
  const currentOccurrence = SessionStatus.executionOccurrence(input.session.id)
  if (!currentOccurrence) {
    SessionStatus.beginExecutionOccurrence(input.session.id, input.inputMessageID)
  }
  const isCurrentOccurrence =
    SessionStatus.executionOccurrence(input.session.id)?.inputMessageID === input.inputMessageID
  const current = SessionStatus.getExecution(input.session.id, input.inputMessageID)
  if (!isCurrentOccurrence) {
    // Validate the historical occurrence against its durable user Message
    // without replacing the Session's live process occurrence or activity.
    await SessionStatus.set(input.session.id, input.status, {
      publish: false,
      taskID: input.taskID,
      inputMessageID: input.inputMessageID,
    })
  } else if (current.type !== "terminal") {
    await SessionStatus.set(input.session.id, input.status, {
      publish: false,
      taskID: input.taskID,
      inputMessageID: input.inputMessageID,
    })
  }
  input.signal?.throwIfAborted()
  const terminal = isCurrentOccurrence ? SessionStatus.getExecution(input.session.id, input.inputMessageID) : input.status
  if (terminal.type !== "terminal") {
    throw new Error(`settled Session ${input.session.id} did not acquire a terminal lifecycle fact`)
  }
  await persistTaskSessionLifecycle(SessionStatus.Event.Status.type, {
    sessionID: input.session.id,
    inputMessageID: input.inputMessageID,
    taskID: input.taskID,
    orderKey: executionLifecycleOrderKey(input.session.id, input.inputMessageID),
    status: terminal,
  })
  input.signal?.throwIfAborted()
  return terminal
}

export async function publishSettledSessionTerminalStatus(
  input: SettledSessionTerminalStatusInput,
): Promise<Extract<SessionStatus.Info, { type: "terminal" }>> {
  input.signal?.throwIfAborted()
  return await awaitWithAbort(
    runWithIndependentProjectIdentity({
      directory: input.session.directory,
      fn: () => {
        input.signal?.throwIfAborted()
        return persistSettledSessionTerminalStatus(input)
      },
    }),
    input.signal,
  )
}

/**
 * Publish from recovery that already owns the Session's exact project
 * initialization context. Re-acquiring that identity would recursively enter
 * an unfinished Instance lifecycle; lease-independent callers must use
 * publishSettledSessionTerminalStatus instead.
 */
export async function publishSettledSessionTerminalStatusInCurrentProject(
  input: SettledSessionTerminalStatusInput,
): Promise<Extract<SessionStatus.Info, { type: "terminal" }>> {
  const current = Instance.current()
  if (!current) {
    throw new Error(`settled Session ${input.session.id} requires an active project context`)
  }
  if (input.session.projectID !== current.project.id) {
    throw new Error(
      `settled Session ${input.session.id} belongs to project ${input.session.projectID}, ` +
        `not active project ${current.project.id}`,
    )
  }
  return persistSettledSessionTerminalStatus(input)
}
