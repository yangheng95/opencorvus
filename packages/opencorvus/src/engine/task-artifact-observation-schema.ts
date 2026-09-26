import z from "zod"
import { Identifier } from "@/id/id"
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
