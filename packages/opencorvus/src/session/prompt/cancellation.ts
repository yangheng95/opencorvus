import z from "zod"
import { randomUUID } from "node:crypto"

export type ExecutionCancellationSource = "session_prompt" | "dispatch_preparation"

export const ExecutionCancellationActor = z.enum([
  "user",
  "mission",
  "control_agent",
  "right_sidebar_conversation",
  "orchestrator",
  "scheduler",
  "runtime",
])

export const ExecutionCancellationSourceIdentity = z.enum([
  "control.message_stream_disconnect",
  "mission.abort",
  "mission.archive",
  "mission.delete",
  "session.abort",
  "session.delete",
  "right_sidebar.abort",
  "right_sidebar.archive",
  "project.delete",
  "task.cancel",
  "task.delete",
  "task.archive",
  "panel.cancel_task",
  "orchestrator.cancel_task",
  "task.lifecycle",
  "task.queue_timeout",
  "process.shutdown",
  "agent.parent_signal",
  "agent.coordination_signal",
  "orchestrator.abort_cascade",
  "orchestrator.inactivity",
  "delegate_agent.parent_signal",
  "engine.child_execution_abort",
  "dispatch.preparation",
  "runtime.prompt_owner",
])

export const ExecutionCancellationSurface = z.string().trim().min(1)

export const ExecutionCancellationOrigin = z
  .object({
    actor: ExecutionCancellationActor,
    source: ExecutionCancellationSourceIdentity,
    surface: ExecutionCancellationSurface,
    requestID: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    targetSessionID: z.string().trim().min(1).optional(),
    taskID: z.string().trim().min(1).optional(),
    missionID: z.string().trim().min(1).optional(),
    messageID: z.string().trim().min(1).optional(),
    toolCallID: z.string().trim().min(1).optional(),
    toolPartID: z.string().trim().min(1).optional(),
    wakeID: z.string().trim().min(1).optional(),
    queueOccurrenceID: z.string().trim().min(1).optional(),
    causationEventID: z.string().trim().min(1).optional(),
  })
  .strict()

export type ExecutionCancellationOrigin = z.infer<typeof ExecutionCancellationOrigin>

export function createExecutionCancellationOrigin(
  input: Omit<ExecutionCancellationOrigin, "requestID"> & { requestID?: string },
): ExecutionCancellationOrigin {
  return ExecutionCancellationOrigin.parse({
    ...input,
    requestID: input.requestID ?? randomUUID(),
  })
}

export class ExecutionCancellationError extends Error {
  readonly source: ExecutionCancellationSource
  readonly sessionID?: string
  readonly origin: ExecutionCancellationOrigin

  constructor(input: {
    source: ExecutionCancellationSource
    message: string
    origin: ExecutionCancellationOrigin
    sessionID?: string
    cause?: unknown
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause })
    this.name = "ExecutionCancellationError"
    this.source = input.source
    this.sessionID = input.sessionID
    this.origin = ExecutionCancellationOrigin.parse(input.origin)
  }
}

export function isExecutionCancellationError(value: unknown): value is ExecutionCancellationError {
  return value instanceof ExecutionCancellationError
}
