import z from "zod"
import {
  ArtifactLocatorReferenceSchema,
  ArtifactReadLocatorSchema,
  ArtifactReadReferenceSchema,
  artifactRequestValues,
  artifactReadLocatorKey,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { Database } from "@/storage/db"
import { PanelArtifactQuerySchema } from "@/panel/capability"
import {
  TaskArtifactObservationFields,
  refineTaskArtifactObservation,
  taskArtifactObservation,
  sameTaskArtifactObservation,
  type TaskArtifactObservation,
} from "@/engine/task-artifact-observation"
import type { TerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference-schema"

import {
  ArtifactReferenceAmbiguityError,
  ArtifactReferenceResolutionError,
  artifactProvenanceFactHighWatermarkForSessionInTransaction,
  artifactProvenanceForAgentTurnInTransaction,
  artifactProvenanceForSessionInTransaction,
  artifactReadReferenceLocatorsBeforeActionInTransaction,
  assistantActionFactScopeInTransaction,
  assistantTurnFactScopeInTransaction,
  completeArtifactReadLocatorsForSessionInTransaction,
  completeArtifactReadsBeforePanelActionInTransaction,
  completeArtifactReadsBeforePublicationInTransaction,
  completedToolOutputValuesBeforeActionInTransaction,
  resolveArtifactReadReferenceBeforeSelectionInTransaction,
  resolveMissionArtifactReadAcceptancesBeforeCompletionInTransaction,
  resolvePanelArtifactReadReferencesBeforeActionInTransaction,
  selectedArtifactLocatorsBeforePublicationInTransaction,
  selectedArtifactFactsForSessionInTransaction,
  type ArtifactFactScope,
  type ArtifactSelectionFact,
  type MissionArtifactReadAcceptanceInput,
  type MissionArtifactReadAcceptanceResolution,
} from "./artifact-provenance-facts"

export { ArtifactReferenceAmbiguityError, ArtifactReferenceResolutionError } from "./artifact-provenance-facts"
export type { ArtifactFactScope, ArtifactSelectionFact } from "./artifact-provenance-facts"

function locatorKey(locator: ArtifactReadLocator): string {
  return artifactReadLocatorKey(locator)
}

const PanelArtifactReferencePageFactSchema = z
  .object({
    taskID: z.string().min(1),
    ...TaskArtifactObservationFields,
    page_number: z.number().int().positive().optional(),
    entries: z.array(
      z
        .object({
          locator: ArtifactReadLocatorSchema,
          artifact_locator_ref: ArtifactLocatorReferenceSchema,
        })
        .passthrough(),
    ),
  })
  .passthrough()
  .superRefine(refineTaskArtifactObservation)

const PanelArtifactContinuationFactSchema = z.object({
  results: z.array(
    z.object({ request_index: z.number().int().nonnegative(), value: PanelArtifactReferencePageFactSchema }),
  ),
  next_queries: z.array(
    z.object({
      request_index: z.number().int().nonnegative(),
      cursor: z.string().min(1),
      page_number: z.number().int().min(2),
    }),
  ),
})

export function assistantTurnFactScope(sessionID: string, assistantMessageID: string) {
  return Database.use((db) => assistantTurnFactScopeInTransaction(db, sessionID, assistantMessageID))
}

export function assistantActionFactScope(sessionID: string, assistantMessageID: string, toolPartID: string) {
  return Database.use((db) => assistantActionFactScopeInTransaction(db, sessionID, assistantMessageID, toolPartID))
}

function completedToolOutputValuesBeforeAction(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  toolNames: readonly string[]
  acceptInput?: (input: unknown) => boolean
}): unknown[] {
  return Database.use((db) => completedToolOutputValuesBeforeActionInTransaction(db, input))
}

function collectArtifactLocatorReferences(value: unknown, found: Map<string, ArtifactReadLocator>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectArtifactLocatorReferences(item, found)
    return
  }
  if (!value || typeof value !== "object") return
  const record = value as Record<string, unknown>
  if (typeof record.artifact_locator_ref === "string" && record.locator !== undefined) {
    const locator = ArtifactReadLocatorSchema.parse(record.locator)
    const reference = record.artifact_locator_ref
    const prior = found.get(reference)
    if (prior && locatorKey(prior) !== locatorKey(locator)) {
      throw new ArtifactReferenceAmbiguityError(reference, "Persisted Artifact locator reference is ambiguous")
    }
    found.set(reference, locator)
  }
  for (const item of Object.values(record)) collectArtifactLocatorReferences(item, found)
}

function artifactReadReferenceLocatorsBeforeAction(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
}): Map<string, ArtifactReadLocator> {
  return Database.use((db) => artifactReadReferenceLocatorsBeforeActionInTransaction(db, input))
}

export function resolveArtifactLocatorReferenceBeforeRead(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  reference: string
}): ArtifactReadLocator {
  const found = new Map<string, ArtifactReadLocator>()
  for (const value of completedToolOutputValuesBeforeAction({
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
    toolPartID: input.toolPartID,
    toolNames: ["artifact_search", "artifact_snapshot"],
  })) {
    collectArtifactLocatorReferences(value, found)
  }
  const locator = found.get(input.reference)
  if (!locator) {
    throw new ArtifactReferenceResolutionError(
      input.reference,
      `Artifact locator reference is not a prior persisted catalog or snapshot fact in Session ${input.sessionID}`,
    )
  }
  return locator
}

export function resolvePanelArtifactLocatorReferenceBeforeRead(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  taskID: string
  reference: string
}): { locator: ArtifactReadLocator; observation: TaskArtifactObservation } {
  const found = new Map<string, { locator: ArtifactReadLocator; observation: TaskArtifactObservation }>()
  for (const value of completedToolOutputValuesBeforeAction({
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
    toolPartID: input.toolPartID,
    toolNames: ["panel_query_task_artifacts"],
    acceptInput: (rawInput) => {
      return artifactRequestValues(rawInput).some((item) => PanelArtifactQuerySchema.safeParse(item).success)
    },
  })) {
    const page = PanelArtifactReferencePageFactSchema.safeParse(value)
    if (!page.success || page.data.taskID !== input.taskID) continue
    for (const entry of page.data.entries) {
      const candidate = {
        locator: entry.locator,
        observation: taskArtifactObservation(page.data),
      }
      const prior = found.get(entry.artifact_locator_ref)
      if (
        prior &&
        (locatorKey(prior.locator) !== locatorKey(candidate.locator) ||
          !sameTaskArtifactObservation(prior.observation, candidate.observation))
      ) {
        throw new ArtifactReferenceAmbiguityError(
          entry.artifact_locator_ref,
          `Persisted panel Artifact locator reference is ambiguous for Task ${input.taskID}`,
        )
      }
      found.set(entry.artifact_locator_ref, candidate)
    }
  }
  const resolved = found.get(input.reference)
  if (!resolved) {
    throw new ArtifactReferenceResolutionError(
      input.reference,
      `Panel Artifact locator reference is not a prior persisted catalog fact for Task ${input.taskID}`,
    )
  }
  return resolved
}

export function requirePanelArtifactContinuationBeforeQuery(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  taskID: string
  cursor: string
  pageNumber: number
  observation: TaskArtifactObservation
}): void {
  for (const value of completedToolOutputValuesBeforeAction({ ...input, toolNames: ["panel_query_task_artifacts"] })) {
    const batch = PanelArtifactContinuationFactSchema.safeParse(value)
    if (!batch.success) continue
    for (const continuation of batch.data.next_queries) {
      if (continuation.cursor !== input.cursor || continuation.page_number !== input.pageNumber) continue
      const page = batch.data.results.find((result) => result.request_index === continuation.request_index)?.value
      if (
        page?.taskID === input.taskID &&
        page.page_number === input.pageNumber - 1 &&
        sameTaskArtifactObservation(taskArtifactObservation(page), input.observation)
      )
        return
    }
  }
  throw new ArtifactReferenceResolutionError(
    input.cursor,
    "Panel catalog continuation must name the preceding page of the same Task observation in this Turn",
  )
}

/**
 * Return only exact locators whose persisted completed `artifact_read` calls
 * prove contiguous byte coverage from zero through the canonical total.
 *
 * This is an audit of consumer-owned tool facts, not a lookup or selector.
 * Missing, partial, or contradictory reads remain absent. A contradictory
 * locator cannot be selected, but it does not invalidate an independent exact
 * locator from the same physical Turn.
 */
export function completeArtifactReadLocatorsForSession(
  sessionID: string,
  options?: ArtifactFactScope & {
    afterTimeCreated?: number
  },
): ArtifactReadLocator[] {
  return Database.use((db) => completeArtifactReadLocatorsForSessionInTransaction(db, sessionID, options))
}

export function selectedArtifactFactsForSession(
  sessionID: string,
  options?: ArtifactFactScope,
): ArtifactSelectionFact[] {
  return Database.use((db) => selectedArtifactFactsForSessionInTransaction(db, sessionID, options))
}

export function artifactProvenanceForSession(
  sessionID: string,
  options?: ArtifactFactScope,
): {
  observedArtifactLocators: ArtifactReadLocator[]
  sourceArtifactLocators: ArtifactReadLocator[]
  selections: ArtifactSelectionFact[]
} {
  return Database.use((db) => artifactProvenanceForSessionInTransaction(db, sessionID, options))
}

export function artifactProvenanceForAgentTurn(sessionID: string, finalAssistantMessageID: string) {
  return Database.use((db) => artifactProvenanceForAgentTurnInTransaction(db, sessionID, finalAssistantMessageID))
}

export function completeArtifactReadsBeforePublication(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
}): ArtifactReadLocator[] {
  return Database.use((db) => completeArtifactReadsBeforePublicationInTransaction(db, input))
}

export function resolveArtifactReadReferenceBeforeSelection(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  reference: string
}): ArtifactReadLocator {
  return Database.use((db) => resolveArtifactReadReferenceBeforeSelectionInTransaction(db, input))
}

export function completeArtifactReadsBeforePanelAction(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  taskID: string
}): ArtifactReadLocator[] {
  return Database.use((db) => completeArtifactReadsBeforePanelActionInTransaction(db, input))
}

export function resolvePanelArtifactReadReferencesBeforeAction(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  taskID: string
  observation: TaskArtifactObservation
  references: readonly z.infer<typeof ArtifactReadReferenceSchema>[]
}): ArtifactReadLocator[] {
  return Database.use((db) => resolvePanelArtifactReadReferencesBeforeActionInTransaction(db, input))
}

export function resolveMissionArtifactReadAcceptancesBeforeCompletion(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  acceptances: readonly MissionArtifactReadAcceptanceInput[]
}): MissionArtifactReadAcceptanceResolution[] {
  return Database.use((db) => resolveMissionArtifactReadAcceptancesBeforeCompletionInTransaction(db, input))
}

export function selectedArtifactLocatorsBeforePublication(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
}): ArtifactReadLocator[] {
  return Database.use((db) => selectedArtifactLocatorsBeforePublicationInTransaction(db, input))
}

/**
 * Capture the exact persisted Artifact-read high-water mark before a reused
 * provider Session starts another turn. Pair ordering prevents same-millisecond
 * reads from leaking across the turn boundary.
 */
export function artifactProvenanceFactHighWatermarkForSession(
  sessionID: string,
): { timeCreated: number; partID: string } | undefined {
  return Database.use((db) => artifactProvenanceFactHighWatermarkForSessionInTransaction(db, sessionID))
}
