import z from "zod"
import {
  ArtifactLocatorReferenceSchema,
  ArtifactReadInputSchema,
  ArtifactReadChunkSchema,
  ArtifactReadLocatorSchema,
  ArtifactReadReferenceChunkSchema,
  ArtifactReadReferenceInputSchema,
  ArtifactReadReferenceSchema,
  ArtifactSelectInputSchema,
  ArtifactSelectOutputSchema,
  ArtifactSelectReferenceInputSchema,
  ArtifactSelectReferenceOutputSchema,
  artifactReadLocatorKey,
  auditArtifactReadLocatorsFromFacts,
  type ArtifactReadWindowFact,
  type ArtifactReadLocator,
  type ArtifactSelectOutput,
  type ArtifactSelectionReference,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { Database, and, asc, desc, eq, gt, or, sql } from "@/storage/db"
import { MessageTable, ToolPartRequestTable as PartTable, ToolPartOutcomeTable } from "@/session/session.sql"
import { MissionPanelActionSchema } from "@/panel/capability"
import { materializeToolExecutionInput } from "@/provider/tool-execution-input"
import {
  sameTerminalLifecycleReference,
  type TerminalLifecycleReference,
} from "@/engine/terminal-lifecycle-reference"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"

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

const PanelArtifactReadReferenceFactSchema = ArtifactReadReferenceChunkSchema.extend({
  taskID: z.string().min(1),
  terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
})

const LegacyPanelArtifactReadInputSchema = z
  .object({
    action: z.literal("read_task_artifact"),
    taskID: z.string().min(1),
    ...ArtifactReadInputSchema.shape,
  })
  .strict()

const PanelArtifactReadReferenceInputSchema = z
  .object({
    action: z.literal("read_task_artifact"),
    taskID: z.string().min(1),
    ...ArtifactReadReferenceInputSchema.shape,
  })
  .strict()

function unwrapPersistedProviderOperation(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input
  const entries = Object.entries(input as Record<string, unknown>)
  return entries.length === 1 && entries[0]?.[0] === "operation" ? entries[0][1] : input
}

export class ArtifactReferenceResolutionError extends Error {
  readonly code = "ARTIFACT_REFERENCE_UNRESOLVED"

  constructor(readonly reference: string, detail: string) {
    super(`${detail}: ${reference}`)
    this.name = "ArtifactReferenceResolutionError"
  }
}

export class ArtifactReferenceAmbiguityError extends Error {
  readonly code = "ARTIFACT_REFERENCE_AMBIGUOUS"

  constructor(readonly reference: string, detail: string) {
    super(`${detail}: ${reference}`)
    this.name = "ArtifactReferenceAmbiguityError"
  }
}

type ArtifactFactScope = {
  after?: { timeCreated: number; partID: string }
  turnParentMessageID?: string
  excludeMessageID?: string
  beforeMessage?: { timeCreated: number; messageID: string }
  panelTaskID?: string
}

function factScopeConditions(scope: ArtifactFactScope | undefined) {
  return [
    ...(scope?.after !== undefined
      ? [
          or(
            gt(PartTable.time_created, scope.after.timeCreated),
            and(eq(PartTable.time_created, scope.after.timeCreated), gt(PartTable.id, scope.after.partID)),
          )!,
        ]
      : []),
    ...(scope?.turnParentMessageID !== undefined
      ? [sql`json_extract(${MessageTable.data}, '$.parentID') = ${scope.turnParentMessageID}`]
      : []),
    ...(scope?.excludeMessageID !== undefined ? [sql`${PartTable.message_id} <> ${scope.excludeMessageID}`] : []),
    ...(scope?.beforeMessage !== undefined
      ? [
          or(
            sql`${MessageTable.time_created} < ${scope.beforeMessage.timeCreated}`,
            and(
              eq(MessageTable.time_created, scope.beforeMessage.timeCreated),
              sql`${MessageTable.id} < ${scope.beforeMessage.messageID}`,
            ),
          )!,
        ]
      : []),
  ]
}

export function assistantTurnFactScope(sessionID: string, assistantMessageID: string) {
  const row = Database.use((db) =>
    db
      .select({ data: MessageTable.data, timeCreated: MessageTable.time_created })
      .from(MessageTable)
      .where(and(eq(MessageTable.session_id, sessionID), eq(MessageTable.id, assistantMessageID)))
      .get(),
  )
  const message = row?.data as { role?: unknown; parentID?: unknown } | undefined
  const parentID = message?.parentID
  if (!row || message?.role !== "assistant" || typeof parentID !== "string") {
    throw new Error(
      `Artifact provenance requires persisted assistant message ${assistantMessageID} in Session ${sessionID}.`,
    )
  }
  return {
    turnParentMessageID: parentID,
    message: { timeCreated: row.timeCreated, messageID: assistantMessageID },
  }
}

function completedToolOutputValuesBeforeAction(input: {
  sessionID: string
  assistantMessageID: string
  toolNames: readonly string[]
}): unknown[] {
  const scope = assistantTurnFactScope(input.sessionID, input.assistantMessageID)
  const rows = Database.use((db) =>
    db
      .select({ id: PartTable.id, request: PartTable.data, outcome: ToolPartOutcomeTable.data })
      .from(PartTable)
      .innerJoin(ToolPartOutcomeTable, eq(ToolPartOutcomeTable.request_part_id, PartTable.id))
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(MessageTable.session_id, input.sessionID),
          ...factScopeConditions({
            turnParentMessageID: scope.turnParentMessageID,
            beforeMessage: scope.message,
          }),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
          sql`json_extract(${PartTable.data}, '$.tool') IN (${sql.join(
            input.toolNames.map((toolName) => sql`${toolName}`),
            sql`, `,
          )})`,
          sql`json_extract(${ToolPartOutcomeTable.data}, '$.outcome') = 'completed'`,
        ),
      )
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all(),
  )
  return rows.map((row) => {
    const output = (row.outcome as { output?: unknown }).output
    if (typeof output !== "string") {
      throw new Error(`Completed Artifact locator-producing tool part ${row.id} has no canonical string output.`)
    }
    try {
      return JSON.parse(output)
    } catch (cause) {
      throw new Error(`Completed Artifact locator-producing tool part ${row.id} output is not JSON.`, { cause })
    }
  })
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
}): Map<string, ArtifactReadLocator> {
  const found = new Map<string, ArtifactReadLocator>()
  for (const value of completedToolOutputValuesBeforeAction({
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
    toolNames: ["artifact_read"],
  })) {
    const parsed = ArtifactReadReferenceChunkSchema.safeParse(value)
    if (!parsed.success) continue
    const prior = found.get(parsed.data.artifact_read_ref)
    if (prior && locatorKey(prior) !== locatorKey(parsed.data.locator)) {
      throw new ArtifactReferenceAmbiguityError(
        parsed.data.artifact_read_ref,
        "Persisted Artifact read reference is ambiguous",
      )
    }
    found.set(parsed.data.artifact_read_ref, parsed.data.locator)
  }
  return found
}

export function resolveArtifactLocatorReferenceBeforeRead(input: {
  sessionID: string
  assistantMessageID: string
  reference: string
}): ArtifactReadLocator {
  const found = new Map<string, ArtifactReadLocator>()
  for (const value of completedToolOutputValuesBeforeAction({
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
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
    toolNames: ["panel"],
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

function panelArtifactReadReferenceLocatorsBeforeAction(input: {
  sessionID: string
  assistantMessageID: string
  taskID: string
}): Map<string, { locator: ArtifactReadLocator; terminalLifecycleReference: TerminalLifecycleReference }> {
  const found = new Map<
    string,
    { locator: ArtifactReadLocator; terminalLifecycleReference: TerminalLifecycleReference }
  >()
  for (const value of completedToolOutputValuesBeforeAction({
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
    toolNames: ["panel"],
  })) {
    const chunk = PanelArtifactReadReferenceFactSchema.safeParse(value)
    if (!chunk.success || chunk.data.taskID !== input.taskID) continue
    const candidate = {
      locator: chunk.data.locator,
      terminalLifecycleReference: chunk.data.terminal_lifecycle_reference,
    }
    const prior = found.get(chunk.data.artifact_read_ref)
    if (
      prior &&
      (locatorKey(prior.locator) !== locatorKey(candidate.locator) ||
        !sameTerminalLifecycleReference(
          prior.terminalLifecycleReference,
          candidate.terminalLifecycleReference,
        ))
    ) {
      throw new ArtifactReferenceAmbiguityError(
        chunk.data.artifact_read_ref,
        `Persisted panel Artifact read reference is ambiguous for Task ${input.taskID}`,
      )
    }
    found.set(chunk.data.artifact_read_ref, candidate)
  }
  return found
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
  if (options?.afterTimeCreated !== undefined && options.after !== undefined) {
    throw new Error("Artifact read fact boundary must use either afterTimeCreated or after, not both.")
  }
  const rows = Database.use((db) =>
    db
      .select({
        id: PartTable.id,
        messageID: PartTable.message_id,
        messageTimeCreated: MessageTable.time_created,
        request: PartTable.data,
        outcome: ToolPartOutcomeTable.data,
      })
      .from(PartTable)
      .innerJoin(ToolPartOutcomeTable, eq(ToolPartOutcomeTable.request_part_id, PartTable.id))
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(MessageTable.session_id, sessionID),
          ...(options?.afterTimeCreated !== undefined ? [gt(PartTable.time_created, options.afterTimeCreated)] : []),
          ...factScopeConditions(options),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
          sql`json_extract(${PartTable.data}, '$.tool') IN ('artifact_read', 'panel')`,
          sql`json_extract(${ToolPartOutcomeTable.data}, '$.outcome') = 'completed'`,
        ),
      )
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all(),
  )
  const facts: ArtifactReadWindowFact[] = []
  for (const row of rows) {
    const data = row.request as {
      tool?: unknown
      input?: unknown
    }
    const state = { input: data.input, output: (row.outcome as { output?: unknown }).output }
    const rawInput = state.input
    if (data.tool === "panel") {
      if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) continue
      const unwrappedInput = unwrapPersistedProviderOperation(rawInput)
      const materialized = materializeToolExecutionInput(MissionPanelActionSchema, rawInput)
      const parsed = PanelArtifactReadReferenceInputSchema.safeParse(materialized)
      const legacy = parsed.success ? undefined : LegacyPanelArtifactReadInputSchema.safeParse(unwrappedInput)
      let panelInput:
        | z.infer<typeof PanelArtifactReadReferenceInputSchema>
        | z.infer<typeof LegacyPanelArtifactReadInputSchema>
      if (parsed.success) panelInput = parsed.data
      else if (legacy?.success) panelInput = legacy.data
      else continue
      const { action: _action, taskID, ...read } = panelInput
      if (options?.panelTaskID !== undefined && taskID !== options.panelTaskID) continue
      if (typeof state?.output !== "string") {
        throw new Error(`Completed panel.read_task_artifact tool part ${row.id} has no canonical string output.`)
      }
      let decoded: unknown
      try {
        decoded = JSON.parse(state.output)
      } catch (cause) {
        throw new Error(`Completed panel.read_task_artifact tool part ${row.id} output is not JSON.`, { cause })
      }
      if ("artifact_transport_version" in read && read.artifact_transport_version === 2) {
        const transportInput = ArtifactReadReferenceInputSchema.parse(read)
        const chunk = PanelArtifactReadReferenceFactSchema.parse(decoded)
        if (chunk.taskID !== taskID || chunk.artifact_locator_ref !== transportInput.artifact_locator_ref) {
          throw new Error(`Completed panel.read_task_artifact tool part ${row.id} input does not identify its output.`)
        }
        const request = ArtifactReadInputSchema.parse({
          locator: chunk.locator,
          byte_offset: transportInput.byte_offset,
          max_bytes: transportInput.max_bytes,
          delivery: transportInput.delivery,
        })
        const {
          taskID: _taskID,
          terminal_lifecycle_reference: _terminalLifecycleReference,
          artifact_transport_version: _artifactTransportVersion,
          artifact_locator_ref: _artifactLocatorReference,
          artifact_read_ref: _artifactReadReference,
          ...canonicalChunk
        } = chunk
        facts.push({ request, chunk: ArtifactReadChunkSchema.parse(canonicalChunk) })
      } else {
        // Immutable pre-v2 panel event decoding only.
        facts.push({ request: ArtifactReadInputSchema.parse(read), chunk: ArtifactReadChunkSchema.parse(decoded) })
      }
      continue
    }
    if (options?.panelTaskID !== undefined) continue
    if (typeof state?.output !== "string") {
      throw new Error(`Completed artifact_read tool part ${row.id} has no canonical string output.`)
    }
    let decoded: unknown
    try {
      decoded = JSON.parse(state.output)
    } catch (cause) {
      throw new Error(`Completed artifact_read tool part ${row.id} output is not JSON.`, { cause })
    }
    const transportVersion =
      rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)
        ? (rawInput as { artifact_transport_version?: unknown }).artifact_transport_version
        : undefined
    if (transportVersion === 2) {
      const transportInput = ArtifactReadReferenceInputSchema.parse(rawInput)
      const chunk = ArtifactReadReferenceChunkSchema.parse(decoded)
      if (transportInput.artifact_locator_ref !== chunk.artifact_locator_ref) {
        throw new Error(`Completed artifact_read tool part ${row.id} input does not identify its canonical output.`)
      }
      const request = ArtifactReadInputSchema.parse({
        locator: chunk.locator,
        byte_offset: transportInput.byte_offset,
        max_bytes: transportInput.max_bytes,
        delivery: transportInput.delivery,
      })
      const {
        artifact_transport_version: _artifactTransportVersion,
        artifact_locator_ref: _artifactLocatorReference,
        artifact_read_ref: _artifactReadReference,
        ...canonicalChunk
      } = chunk
      facts.push({ request, chunk: ArtifactReadChunkSchema.parse(canonicalChunk) })
      continue
    }
    // Immutable pre-v2 event decoding. Current provider schemas never expose
    // this structural input; it exists only to preserve already-persisted facts.
    facts.push({
      request: ArtifactReadInputSchema.parse(rawInput),
      chunk: ArtifactReadChunkSchema.parse(decoded),
    })
  }
  return auditArtifactReadLocatorsFromFacts(facts).completeLocators
}

export type ArtifactSelectionFact = {
  locator: ArtifactReadLocator
  purpose: string
  references: ArtifactSelectionReference[]
}

export function selectedArtifactFactsForSession(
  sessionID: string,
  options?: ArtifactFactScope,
): ArtifactSelectionFact[] {
  const rows = Database.use((db) =>
    db
      .select({
        id: PartTable.id,
        messageID: PartTable.message_id,
        messageTimeCreated: MessageTable.time_created,
        request: PartTable.data,
        outcome: ToolPartOutcomeTable.data,
      })
      .from(PartTable)
      .innerJoin(ToolPartOutcomeTable, eq(ToolPartOutcomeTable.request_part_id, PartTable.id))
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(MessageTable.session_id, sessionID),
          ...factScopeConditions(options),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
          sql`json_extract(${PartTable.data}, '$.tool') = 'artifact_select'`,
          sql`json_extract(${ToolPartOutcomeTable.data}, '$.outcome') = 'completed'`,
        ),
      )
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all(),
  )
  const facts = new Map<string, ArtifactSelectionFact>()
  for (const row of rows) {
    const state = {
      input: (row.request as { input?: unknown }).input,
      output: (row.outcome as { output?: unknown }).output,
    }
    if (typeof state.output !== "string") {
      throw new Error(`Completed artifact_select tool part ${row.id} has no canonical string output.`)
    }
    let decoded: unknown
    try {
      decoded = JSON.parse(state.output)
    } catch (cause) {
      throw new Error(`Completed artifact_select tool part ${row.id} output is not JSON.`, {
        cause,
      })
    }
    const transportVersion =
      state?.input && typeof state.input === "object" && !Array.isArray(state.input)
        ? (state.input as { artifact_transport_version?: unknown }).artifact_transport_version
        : undefined
    let canonical: ArtifactSelectOutput
    let reference: ArtifactSelectionReference | undefined
    let readReference: string | undefined
    if (transportVersion === 2) {
      const selected = ArtifactSelectReferenceInputSchema.parse(state.input)
      const output = ArtifactSelectReferenceOutputSchema.parse(decoded)
      canonical = output.selection
      reference = output.artifact_selection_ref
      readReference = selected.artifact_read_ref
      if (canonical.purpose !== selected.purpose) {
        throw new Error(`Completed artifact_select tool part ${row.id} output differs from its input.`)
      }
    } else {
      // Immutable pre-v2 event decoding. Current provider schemas are ref-only.
      const selected = ArtifactSelectInputSchema.parse(state?.input)
      canonical = ArtifactSelectOutputSchema.parse(decoded)
      if (locatorKey(canonical.locator) !== locatorKey(selected.locator) || canonical.purpose !== selected.purpose) {
        throw new Error(`Completed artifact_select tool part ${row.id} output differs from its input.`)
      }
    }
    const key = locatorKey(canonical.locator)
    const selectionMessageScope = assistantTurnFactScope(sessionID, row.messageID)
    const completedBeforeSelection = completeArtifactReadLocatorsForSession(sessionID, {
      turnParentMessageID: selectionMessageScope.turnParentMessageID,
      beforeMessage: {
        timeCreated: row.messageTimeCreated,
        messageID: row.messageID,
      },
    })
    if (!completedBeforeSelection.some((locator) => locatorKey(locator) === key)) {
      throw new Error(
        `Completed artifact_select tool part ${row.id} selected a locator that was not completely read in the same Turn.`,
      )
    }
    if (readReference) {
      const priorReadLocator = artifactReadReferenceLocatorsBeforeAction({
        sessionID,
        assistantMessageID: row.messageID,
      }).get(readReference)
      if (!priorReadLocator || locatorKey(priorReadLocator) !== key) {
        throw new Error(`Completed artifact_select tool part ${row.id} does not reference its canonical prior read.`)
      }
    }
    const factKey = `${key}\u0000${canonical.purpose}`
    const prior = facts.get(factKey)
    const references = new Set(prior?.references ?? [])
    if (reference) references.add(reference)
    facts.set(factKey, {
      locator: canonical.locator,
      purpose: canonical.purpose,
      references: [...references].sort(),
    })
  }
  return [...facts.values()].sort(
    (left, right) =>
      locatorKey(left.locator).localeCompare(locatorKey(right.locator)) || left.purpose.localeCompare(right.purpose),
  )
}

export function artifactProvenanceForSession(
  sessionID: string,
  options?: ArtifactFactScope,
): {
  observedArtifactLocators: ArtifactReadLocator[]
  sourceArtifactLocators: ArtifactReadLocator[]
  selections: ArtifactSelectionFact[]
} {
  const observedArtifactLocators = completeArtifactReadLocatorsForSession(sessionID, options)
  const selections = selectedArtifactFactsForSession(sessionID, options)
  const selected = new Map<string, ArtifactReadLocator>()
  for (const fact of selections) selected.set(locatorKey(fact.locator), fact.locator)
  return {
    observedArtifactLocators,
    sourceArtifactLocators: [...selected.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, locator]) => locator),
    selections,
  }
}

export function artifactProvenanceForAgentTurn(sessionID: string, finalAssistantMessageID: string) {
  return artifactProvenanceForSession(sessionID, {
    turnParentMessageID: assistantTurnFactScope(sessionID, finalAssistantMessageID).turnParentMessageID,
  })
}

export function completeArtifactReadsBeforePublication(input: {
  sessionID: string
  assistantMessageID: string
}): ArtifactReadLocator[] {
  const scope = assistantTurnFactScope(input.sessionID, input.assistantMessageID)
  return completeArtifactReadLocatorsForSession(input.sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
    beforeMessage: scope.message,
  })
}

export function resolveArtifactReadReferenceBeforeSelection(input: {
  sessionID: string
  assistantMessageID: string
  reference: string
}): ArtifactReadLocator {
  const locator = artifactReadReferenceLocatorsBeforeAction(input).get(input.reference)
  const complete = completeArtifactReadsBeforePublication(input)
  if (!locator || !complete.some((candidate) => locatorKey(candidate) === locatorKey(locator))) {
    throw new ArtifactReferenceResolutionError(
      input.reference,
      `Artifact read reference is not backed by complete persisted reads in Session ${input.sessionID}`,
    )
  }
  return locator
}

export function completeArtifactReadsBeforePanelAction(input: {
  sessionID: string
  assistantMessageID: string
  taskID: string
}): ArtifactReadLocator[] {
  const scope = assistantTurnFactScope(input.sessionID, input.assistantMessageID)
  return completeArtifactReadLocatorsForSession(input.sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
    beforeMessage: scope.message,
    panelTaskID: input.taskID,
  })
}

export function resolvePanelArtifactReadReferencesBeforeAction(input: {
  sessionID: string
  assistantMessageID: string
  taskID: string
  terminalLifecycleReference: TerminalLifecycleReference
  references: readonly z.infer<typeof ArtifactReadReferenceSchema>[]
}): ArtifactReadLocator[] {
  const byReference = panelArtifactReadReferenceLocatorsBeforeAction(input)
  const complete = new Set(
    completeArtifactReadsBeforePanelAction(input).map((locator) => locatorKey(locator)),
  )
  const resolved = new Map<string, ArtifactReadLocator>()
  for (const reference of input.references) {
    const resolvedReference = byReference.get(reference)
    if (
      !resolvedReference ||
      !sameTerminalLifecycleReference(
        resolvedReference.terminalLifecycleReference,
        input.terminalLifecycleReference,
      ) ||
      !complete.has(locatorKey(resolvedReference.locator))
    ) {
      throw new ArtifactReferenceResolutionError(
        reference,
        `Panel Artifact read reference is not backed by a complete persisted read for Task ${input.taskID}`,
      )
    }
    resolved.set(locatorKey(resolvedReference.locator), resolvedReference.locator)
  }
  return [...resolved.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, locator]) => locator)
}

export function selectedArtifactLocatorsBeforePublication(input: {
  sessionID: string
  assistantMessageID: string
}): ArtifactReadLocator[] {
  const scope = assistantTurnFactScope(input.sessionID, input.assistantMessageID)
  const selected = new Map<string, ArtifactReadLocator>()
  for (const fact of selectedArtifactFactsForSession(input.sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
    beforeMessage: scope.message,
  })) {
    selected.set(locatorKey(fact.locator), fact.locator)
  }
  return [...selected.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, locator]) => locator)
}

export function resolveArtifactSelectionReferencesBeforePublication(input: {
  sessionID: string
  assistantMessageID: string
  references: readonly string[]
}): ArtifactReadLocator[] {
  const scope = assistantTurnFactScope(input.sessionID, input.assistantMessageID)
  const facts = selectedArtifactFactsForSession(input.sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
    beforeMessage: scope.message,
  })
  const byReference = new Map<string, ArtifactReadLocator>()
  for (const fact of facts) {
    for (const reference of fact.references) {
      const prior = byReference.get(reference)
      if (prior && locatorKey(prior) !== locatorKey(fact.locator)) {
        throw new ArtifactReferenceAmbiguityError(
          reference,
          `Artifact selection reference is ambiguous in Session ${input.sessionID}`,
        )
      }
      byReference.set(reference, fact.locator)
    }
  }
  const resolved = new Map<string, ArtifactReadLocator>()
  for (const reference of input.references) {
    const locator = byReference.get(reference)
    if (!locator) {
      throw new ArtifactReferenceResolutionError(
        reference,
        `Artifact selection reference is not a prior persisted selection in Session ${input.sessionID}`,
      )
    }
    resolved.set(locatorKey(locator), locator)
  }
  return [...resolved.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, locator]) => locator)
}

/**
 * Capture the exact persisted Artifact-read high-water mark before a reused
 * provider Session starts another turn. Pair ordering prevents same-millisecond
 * reads from leaking across the turn boundary.
 */
export function artifactProvenanceFactHighWatermarkForSession(
  sessionID: string,
): { timeCreated: number; partID: string } | undefined {
  const row = Database.use((db) =>
    db
      .select({ partID: PartTable.id, timeCreated: PartTable.time_created })
      .from(PartTable)
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(MessageTable.session_id, sessionID),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
          sql`json_extract(${PartTable.data}, '$.tool') IN ('artifact_read', 'artifact_select', 'panel')`,
        ),
      )
      .orderBy(desc(PartTable.time_created), desc(PartTable.id))
      .limit(1)
      .get(),
  )
  return row ? { timeCreated: row.timeCreated, partID: row.partID } : undefined
}
