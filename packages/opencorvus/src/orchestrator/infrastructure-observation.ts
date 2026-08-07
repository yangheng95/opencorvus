import { recordTaskInfrastructureError } from "@/engine/persist"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import type { EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"

export type TaskInfrastructureObservationInput = Parameters<typeof recordTaskInfrastructureError>[0]

/**
 * Infrastructure diagnostics are optional Host facts. Failure to persist the
 * diagnostic must never replace the already-observed specialist Turn or its
 * domain artifact references.
 */
export function recordTaskInfrastructureErrorBestEffort(
  input: TaskInfrastructureObservationInput,
  options?: {
    write?: typeof recordTaskInfrastructureError
    onFailure?: (error: unknown) => void
  },
): EngineArtifactLocator | undefined {
  try {
    const artifactID = (options?.write ?? recordTaskInfrastructureError)(input)
    return exactEngineArtifactLocator({ taskID: input.taskID, artifactID })
  } catch (error) {
    options?.onFailure?.(error)
    return undefined
  }
}
