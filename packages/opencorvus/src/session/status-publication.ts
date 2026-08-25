import {
  awaitTaskMessageProtocolBridgeIdle,
  ensureTaskMessageProtocolBridge,
  provideTaskMessageProtocolBridgeProjectDeletionAdmission,
} from "@/orchestrator/protocol/message-bridge"
import { Instance, type ProjectDeletionAdmission } from "@/project/instance"
import { runWithIndependentProjectIdentity, runWithProjectDeletionIdentity } from "@/project/independent-project-owner"
import type { Session } from "@/session"
import { SessionStatus } from "@/session/status"
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
  options?: {
    promptGenerationOwner?: AbortSignal
    inputMessageID?: string
    taskID?: string
    signal?: AbortSignal
    projectDeletionAdmission?: ProjectDeletionAdmission
  },
): Promise<void> {
  options?.signal?.throwIfAborted()
  const publishStatus = () => {
    options?.signal?.throwIfAborted()
    ensureTaskMessageProtocolBridge()
    return SessionStatus.set(session.id, status, options)
  }
  const publish = () =>
    options?.projectDeletionAdmission
      ? provideTaskMessageProtocolBridgeProjectDeletionAdmission(options.projectDeletionAdmission, publishStatus)
      : publishStatus()
  const publication = options?.projectDeletionAdmission
    ? runWithProjectDeletionIdentity({
        directory: session.directory,
        projectDeletionAdmission: options.projectDeletionAdmission,
        fn: publish,
      })
    : runWithIndependentProjectIdentity({ directory: session.directory, fn: publish })
  await awaitWithAbort(publication, options?.signal)
  options?.signal?.throwIfAborted()
  if (options?.taskID) await awaitWithAbort(awaitTaskMessageProtocolBridgeIdle(), options.signal)
}

/**
 * Close one Session after its physical prompt and ingress ownership have already
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
  // One publication owner for both settlement paths: `SessionStatus.set`
  // publishes the lifecycle fact on the Bus, and the protocol bridge
  // subscriber persists it — exactly how a live prompt's own terminal
  // travels. Suppressing the publication here and persisting directly was
  // the split that left every Bus subscriber, including an attached public
  // client, without the settled path's terminal receipt.
  ensureTaskMessageProtocolBridge()
  if (!isCurrentOccurrence || current.type !== "terminal") {
    await SessionStatus.set(input.session.id, input.status, {
      taskID: input.taskID,
      inputMessageID: input.inputMessageID,
      settledOccurrence: true,
    })
  }
  input.signal?.throwIfAborted()
  const terminal = isCurrentOccurrence
    ? SessionStatus.getExecution(input.session.id, input.inputMessageID)
    : input.status
  if (terminal.type !== "terminal") {
    throw new Error(`settled Session ${input.session.id} did not acquire a terminal lifecycle fact`)
  }
  await awaitWithAbort(awaitTaskMessageProtocolBridgeIdle(), input.signal)
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
