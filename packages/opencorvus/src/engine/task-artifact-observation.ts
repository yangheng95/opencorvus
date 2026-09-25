import z from "zod"
import { Identifier } from "@/id/id"
import { taskLifecycleProjection } from "./task-lifecycle"
import { TerminalLifecycleReferenceSchema, sameTerminalLifecycleReference } from "./terminal-lifecycle-reference-schema"

export const ActiveTaskExecutionReferenceSchema = z
  .object({
    openedEventID: Identifier.schema("protocol_event"),
    executionEpoch: z.number().int().positive(),
  })
  .strict()

export const TaskArtifactObservationFields = {
  terminal_lifecycle_reference: TerminalLifecycleReferenceSchema.nullable(),
  active_execution_reference: ActiveTaskExecutionReferenceSchema.optional(),
}

export function refineTaskArtifactObservation(
  value: { terminal_lifecycle_reference: unknown; active_execution_reference?: unknown },
  context: z.RefinementCtx,
) {
  if ((value.terminal_lifecycle_reference === null) !== (value.active_execution_reference !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["active_execution_reference"],
      message: "A Task Artifact observation must bind exactly one active execution or terminal occurrence.",
    })
  }
}

export const TaskArtifactObservationSchema = z
  .object(TaskArtifactObservationFields)
  .strict()
  .superRefine(refineTaskArtifactObservation)
export type TaskArtifactObservation = z.infer<typeof TaskArtifactObservationSchema>

export function taskArtifactObservation(value: TaskArtifactObservation): TaskArtifactObservation {
  return TaskArtifactObservationSchema.parse({
    terminal_lifecycle_reference: value.terminal_lifecycle_reference,
    ...(value.active_execution_reference ? { active_execution_reference: value.active_execution_reference } : {}),
  })
}

export function currentTaskArtifactObservation(taskID: string): TaskArtifactObservation {
  const lifecycle = taskLifecycleProjection(taskID)
  return lifecycle.terminalEventID
    ? { terminal_lifecycle_reference: { terminalEventID: lifecycle.terminalEventID } }
    : {
        terminal_lifecycle_reference: null,
        active_execution_reference: {
          openedEventID: lifecycle.openedEventID,
          executionEpoch: lifecycle.epoch,
        },
      }
}

export function sameTaskArtifactObservation(left: TaskArtifactObservation, right: TaskArtifactObservation): boolean {
  if (left.terminal_lifecycle_reference && right.terminal_lifecycle_reference) {
    return sameTerminalLifecycleReference(left.terminal_lifecycle_reference, right.terminal_lifecycle_reference)
  }
  return (
    left.terminal_lifecycle_reference === null &&
    right.terminal_lifecycle_reference === null &&
    left.active_execution_reference?.openedEventID === right.active_execution_reference?.openedEventID &&
    left.active_execution_reference?.executionEpoch === right.active_execution_reference?.executionEpoch
  )
}

export function assertCurrentTaskArtifactObservation(
  taskID: string,
  expected: TaskArtifactObservation,
  context: string,
) {
  TaskArtifactObservationSchema.parse(expected)
  const current = currentTaskArtifactObservation(taskID)
  if (!sameTaskArtifactObservation(current, expected)) {
    throw new Error(
      `${context} ${expected.terminal_lifecycle_reference ? "terminal occurrence" : "active execution"} changed for Task ${taskID}; query the current Task and its Artifact catalog again`,
    )
  }
  return current
}
