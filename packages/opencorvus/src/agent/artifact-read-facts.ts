import z from "zod"
import {
  ArtifactLocatorReferenceSchema,
  ArtifactReadLocatorSchema,
  ArtifactReadReferenceSchema,
  artifactReadLocatorKey,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { Database } from "@/storage/db"
import { panelLeafActionSchemaForAgent } from "@/panel/capability"
import {
  sameTerminalLifecycleReference,
  TerminalLifecycleReferenceSchema,
  type TerminalLifecycleReference,
} from "@/engine/terminal-lifecycle-reference-schema"

const MissionPanelQueryTaskArtifactsInput = panelLeafActionSchemaForAgent("query_task_artifacts", "mission")
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
  resolveArtifactSelectionReferencesBeforePublicationInTransaction,
  resolvePanelArtifactReadReferencesBeforeActionInTransaction,
  selectedArtifactLocatorsBeforePublicationInTransaction,
  selectedArtifactFactsForSessionInTransaction,
  type ArtifactFactScope,
  type ArtifactSelectionFact,
} from "./artifact-provenance-facts"

export { ArtifactReferenceAmbiguityError, ArtifactReferenceResolutionError } from "./artifact-provenance-facts"
export type { ArtifactFactScope, ArtifactSelectionFact } from "./artifact-provenance-facts"

function locatorKey(locator: ArtifactReadLocator): string {
  return artifactReadLocatorKey(locator)
}

const PanelArtifactReferencePageFactSchema = z
  .object({
    taskID: z.string().min(1),
    terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
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


export function assistantTurnFactScope(sessionID: string, assistantMessageID: string) {
  return Database.use((db) => assistantTurnFactScopeInTransaction(db, sessionID, assistantMessageID))
}

export function assistantActionFactScope(sessionID: string, assistantMessageID: string, toolPartID: string) {
  return Database.use((db) =>
    assistantActionFactScopeInTransaction(db, sessionID, assistantMessageID, toolPartID),
  )
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
}): { locator: ArtifactReadLocator; terminalLifecycleReference: TerminalLifecycleReference } {
  const found = new Map<
    string,
    { locator: ArtifactReadLocator; terminalLifecycleReference: TerminalLifecycleReference }
  >()
  for (const value of completedToolOutputValuesBeforeAction({
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
    toolPartID: input.toolPartID,
    toolNames: ["panel_query_task_artifacts"],
    acceptInput: (rawInput) => {
      return MissionPanelQueryTaskArtifactsInput.safeParse(rawInput).success
    },
  })) {
    const page = PanelArtifactReferencePageFactSchema.safeParse(value)
    if (!page.success || page.data.taskID !== input.taskID) continue
    for (const entry of page.data.entries) {
      const candidate = {
        locator: entry.locator,
        terminalLifecycleReference: page.data.terminal_lifecycle_reference,
      }
      const prior = found.get(entry.artifact_locator_ref)
      if (
        prior &&
        (locatorKey(prior.locator) !== locatorKey(candidate.locator) ||
          !sameTerminalLifecycleReference(
            prior.terminalLifecycleReference,
            candidate.terminalLifecycleReference,
          ))
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
  return Database.use((db) =>
    artifactProvenanceForAgentTurnInTransaction(db, sessionID, finalAssistantMessageID),
  )
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
  terminalLifecycleReference: TerminalLifecycleReference
  references: readonly z.infer<typeof ArtifactReadReferenceSchema>[]
}): ArtifactReadLocator[] {
  return Database.use((db) => resolvePanelArtifactReadReferencesBeforeActionInTransaction(db, input))
}

export function selectedArtifactLocatorsBeforePublication(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
}): ArtifactReadLocator[] {
  return Database.use((db) => selectedArtifactLocatorsBeforePublicationInTransaction(db, input))
}

export function resolveArtifactSelectionReferencesBeforePublication(input: {
  sessionID: string
  assistantMessageID: string
  toolPartID: string
  references: readonly string[]
}): ArtifactReadLocator[] {
  return Database.use((db) =>
    resolveArtifactSelectionReferencesBeforePublicationInTransaction(db, input),
  )
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
