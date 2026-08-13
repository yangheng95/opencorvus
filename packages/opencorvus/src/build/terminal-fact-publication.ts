import { createHash } from "node:crypto"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import {
  recordTaskInfrastructureError,
  recordTaskLevelBuildHostObservation,
} from "@/engine/persist"
import type { EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"

export type BuildTerminalFactPublicationInput = {
  observation: Parameters<typeof recordTaskLevelBuildHostObservation>[0]
  observationErrors: readonly string[]
}

export type BuildTerminalFactPublicationReceipt =
  | {
      kind: "terminal_success"
      observationID: string
      artifactLocator: EngineArtifactLocator
    }
  | {
      kind: "partial"
      observationID: string
      artifactLocator: EngineArtifactLocator
    }
  | {
      kind: "publication_failed"
      observationID: string
      operation: "persist-git-workspace" | "persist-git-workspace-infrastructure" | "cleanup-git-observation-refs"
      message: string
      errorName?: string
      attempts: number
    }

export type BuildTerminalFactWriter = (input: BuildTerminalFactPublicationInput, attempt: number) => {
  kind: "terminal_success" | "partial"
  artifactID: string
}

export function buildTerminalFactObservationID(input: { taskID: string; dispatchID: string }): string {
  const digest = createHash("sha256")
    .update(`build-terminal-fact\0${input.taskID}\0${input.dispatchID}`)
    .digest("hex")
  return `art_build_terminal_${digest}`
}

function writeBuildTerminalFact(input: BuildTerminalFactPublicationInput): ReturnType<BuildTerminalFactWriter> {
  const observationID = input.observation.id
  if (input.observationErrors.length === 0) {
    return {
      kind: "terminal_success",
      artifactID: recordTaskLevelBuildHostObservation(input.observation),
    }
  }
  return {
    kind: "partial",
    artifactID: recordTaskInfrastructureError({
      id: observationID,
      taskID: input.observation.taskID,
      component: "build-host-observation",
      operation: "collect-git-workspace",
      reason: input.observationErrors.join("\n"),
      sessionID: input.observation.sessionID ?? undefined,
      context: { observation_id: observationID },
      now: input.observation.now,
    }),
  }
}

/**
 * Required publication boundary for one physical Build result. The dispatch-derived
 * observation ID is the occurrence identity; the one selected Engine Artifact is
 * its receipt. A writer exception never changes fact kind or falls back to a second
 * writer.
 */
export function publishBuildTerminalFact(
  input: BuildTerminalFactPublicationInput,
  options?: { write?: BuildTerminalFactWriter },
): BuildTerminalFactPublicationReceipt {
  const operation = input.observationErrors.length === 0
    ? "persist-git-workspace" as const
    : "persist-git-workspace-infrastructure" as const
  const maxAttempts = 2
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const written = (options?.write ?? writeBuildTerminalFact)(input, attempt)
      return {
        kind: written.kind,
        observationID: input.observation.id,
        artifactLocator: exactEngineArtifactLocator({
          taskID: input.observation.taskID,
          artifactID: written.artifactID,
        }),
      }
    } catch (error) {
      lastError = error
    }
  }
  return {
    kind: "publication_failed",
    observationID: input.observation.id,
    operation,
    message: lastError instanceof Error ? lastError.message : String(lastError),
    ...(lastError instanceof Error ? { errorName: lastError.name } : {}),
    attempts: maxAttempts,
  }
}
