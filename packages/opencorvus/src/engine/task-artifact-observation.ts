import { taskLifecycleProjection } from "./task-lifecycle"
import {
  TaskArtifactObservationSchema,
  sameTaskArtifactObservation,
  type TaskArtifactObservation,
} from "./task-artifact-observation-schema"

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
