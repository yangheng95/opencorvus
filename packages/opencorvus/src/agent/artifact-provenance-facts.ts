import {
  ArtifactReadChunkSchema,
  ArtifactReadInputSchema,
  ArtifactReadReferenceChunkSchema,
  ArtifactReadReferenceInputSchema,
  ArtifactReadReferenceSchema,
  ArtifactSelectInputSchema,
  ArtifactSelectOutputSchema,
  ArtifactSelectReferenceInputSchema,
  ArtifactSelectReferenceOutputSchema,
  artifactReadLocatorKey,
  auditArtifactReadLocatorsFromFacts,
  type ArtifactReadLocator,
  type ArtifactReadWindowFact,
  type ArtifactSelectionReference,
  type ArtifactSelectOutput,
} from "@opencorvus-ai/plugin/artifact-catalog"
import {
  sameTerminalLifecycleReference,
  TerminalLifecycleReferenceSchema,
  type TerminalLifecycleReference,
} from "@/engine/terminal-lifecycle-reference-schema"
import { MissionPanelActionSchema } from "@/panel/capability"
import { materializeToolExecutionInput } from "@/provider/tool-execution-input"
import {
  MessageTable,
  PartTable as SessionPartTable,
  ToolPartOutcomeTable,
  ToolPartRequestTable as PartTable,
  type ToolOutcomePartData,
} from "@/session/session.sql"
import { completedToolOutcomeOutput } from "@/session/tool-outcome-facts"
import type { Database } from "@/storage/db"
import { and, asc, desc, eq, gt, or, sql } from "drizzle-orm"
import z from "zod"

export const PanelArtifactReadReferenceFactSchema = ArtifactReadReferenceChunkSchema.extend({
  taskID: z.string().min(1),
  terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
})

export const LegacyPanelArtifactReadInputSchema = z
  .object({
    action: z.literal("read_task_artifact"),
    taskID: z.string().min(1),
    ...ArtifactReadInputSchema.shape,
  })
  .strict()

export const PanelArtifactReadReferenceInputSchema = z
  .object({
    action: z.literal("read_task_artifact"),
    taskID: z.string().min(1),
    ...ArtifactReadReferenceInputSchema.shape,
  })
  .strict()

export function unwrapPersistedProviderOperation(input: unknown): unknown {
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

export type ArtifactFactScope = {
  after?: { timeCreated: number; partID: string }
  before?: { timeCreated: number; partID: string }
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
    ...(scope?.before !== undefined
      ? [
          or(
            sql`${PartTable.time_created} < ${scope.before.timeCreated}`,
            and(eq(PartTable.time_created, scope.before.timeCreated), sql`${PartTable.id} < ${scope.before.partID}`),
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

export function assistantTurnFactScopeInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  assistantMessageID: string,
) {
  const row = db
    .select({ data: MessageTable.data, timeCreated: MessageTable.time_created })
    .from(MessageTable)
    .where(and(eq(MessageTable.session_id, sessionID), eq(MessageTable.id, assistantMessageID)))
    .get()
  const message = row?.data as { role?: unknown; parentID?: unknown } | undefined
  const parentID = message?.parentID
  if (!row || message?.role !== "assistant" || typeof parentID !== "string") {
    throw new Error(`Artifact provenance requires persisted assistant message ${assistantMessageID} in Session ${sessionID}.`)
  }
  return {
    turnParentMessageID: parentID,
    message: { timeCreated: row.timeCreated, messageID: assistantMessageID },
  }
}

export function assistantActionFactScopeInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  assistantMessageID: string,
  toolPartID: string,
) {
  const scope = assistantTurnFactScopeInTransaction(db, sessionID, assistantMessageID)
  const part = db
    .select({ messageID: PartTable.message_id, timeCreated: PartTable.time_created })
    .from(PartTable)
    .where(and(eq(PartTable.id, toolPartID), eq(PartTable.message_id, assistantMessageID)))
    .get()
  if (!part || part.messageID !== assistantMessageID) {
    throw new Error(
      `Artifact provenance requires persisted Tool Part ${toolPartID} on assistant ${assistantMessageID} in Session ${sessionID}.`,
    )
  }
  const stepStart = db
    .select({ id: SessionPartTable.id, timeCreated: SessionPartTable.time_created })
    .from(SessionPartTable)
    .where(
      and(
        eq(SessionPartTable.message_id, assistantMessageID),
        sql`json_extract(${SessionPartTable.data}, '$.type') = 'step-start'`,
        or(
          sql`${SessionPartTable.time_created} < ${part.timeCreated}`,
          and(eq(SessionPartTable.time_created, part.timeCreated), sql`${SessionPartTable.id} < ${toolPartID}`),
        ),
      ),
    )
    .orderBy(desc(SessionPartTable.time_created), desc(SessionPartTable.id))
    .get()
  if (!stepStart) {
    throw new Error(
      `Artifact provenance requires a persisted Provider step boundary before Tool Part ${toolPartID} on assistant ${assistantMessageID}.`,
    )
  }
  return {
    turnParentMessageID: scope.turnParentMessageID,
    before: { timeCreated: stepStart.timeCreated, partID: stepStart.id },
  }
}

export function completedToolOutputValuesBeforeActionInTransaction(
  db: Database.TxOrDb,
  input: {
    sessionID: string
    assistantMessageID: string
    toolPartID: string
    toolNames: readonly string[]
    acceptInput?: (input: unknown) => boolean
  },
): unknown[] {
  const scope = assistantActionFactScopeInTransaction(
    db,
    input.sessionID,
    input.assistantMessageID,
    input.toolPartID,
  )
  const rows = db
    .select({ id: PartTable.id, request: PartTable.data, outcome: ToolPartOutcomeTable.data })
    .from(PartTable)
    .innerJoin(ToolPartOutcomeTable, eq(ToolPartOutcomeTable.request_part_id, PartTable.id))
    .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
    .where(
      and(
        eq(MessageTable.session_id, input.sessionID),
        ...factScopeConditions({ turnParentMessageID: scope.turnParentMessageID, before: scope.before }),
        sql`json_extract(${PartTable.data}, '$.type') = 'tool-request'`,
        sql`json_extract(${PartTable.data}, '$.tool') IN (${sql.join(
          input.toolNames.map((toolName) => sql`${toolName}`),
          sql`, `,
        )})`,
        sql`json_extract(${ToolPartOutcomeTable.data}, '$.outcome') = 'completed'`,
      ),
    )
    .orderBy(asc(PartTable.time_created), asc(PartTable.id))
    .all()
    .map((row) => ({
      ...row,
      canonicalOutput: completedToolOutcomeOutput(
        db,
        row.outcome as ToolOutcomePartData,
        () => `Completed Artifact locator-producing tool part ${row.id}`,
      ),
    }))
  return rows.flatMap((row) => {
    const requestInput = (row.request as { input?: unknown }).input
    if (input.acceptInput && !input.acceptInput(requestInput)) return []
    if (typeof row.canonicalOutput !== "string") {
      throw new Error(`Completed Artifact locator-producing tool part ${row.id} has no canonical string output.`)
    }
    try {
      return [JSON.parse(row.canonicalOutput)]
    } catch (cause) {
      throw new Error(`Completed Artifact locator-producing tool part ${row.id} output is not JSON.`, { cause })
    }
  })
}

export function artifactReadReferenceLocatorsBeforeActionInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; assistantMessageID: string; toolPartID: string },
): Map<string, ArtifactReadLocator> {
  const found = new Map<string, ArtifactReadLocator>()
  for (const value of completedToolOutputValuesBeforeActionInTransaction(db, {
    ...input,
    toolNames: ["artifact_read"],
  })) {
    const parsed = ArtifactReadReferenceChunkSchema.safeParse(value)
    if (!parsed.success) continue
    const prior = found.get(parsed.data.artifact_read_ref)
    if (prior && artifactReadLocatorKey(prior) !== artifactReadLocatorKey(parsed.data.locator)) {
      throw new ArtifactReferenceAmbiguityError(
        parsed.data.artifact_read_ref,
        "Persisted Artifact read reference is ambiguous",
      )
    }
    found.set(parsed.data.artifact_read_ref, parsed.data.locator)
  }
  return found
}

export function completeArtifactReadLocatorsForSessionInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  options?: ArtifactFactScope & { afterTimeCreated?: number },
): ArtifactReadLocator[] {
  if (options?.afterTimeCreated !== undefined && options.after !== undefined) {
    throw new Error("Artifact read fact boundary must use either afterTimeCreated or after, not both.")
  }
  const rows = db
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
    .all()
    .map((row) => ({
      ...row,
      canonicalOutput: completedToolOutcomeOutput(
        db,
        row.outcome as ToolOutcomePartData,
        () => `Completed Artifact read tool part ${row.id}`,
      ),
    }))
  const facts: ArtifactReadWindowFact[] = []
  for (const row of rows) {
    const data = row.request as { tool?: unknown; input?: unknown }
    const rawInput = data.input
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
      if (typeof row.canonicalOutput !== "string") {
        throw new Error(`Completed panel.read_task_artifact tool part ${row.id} has no canonical string output.`)
      }
      let decoded: unknown
      try {
        decoded = JSON.parse(row.canonicalOutput)
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
        facts.push({ request: ArtifactReadInputSchema.parse(read), chunk: ArtifactReadChunkSchema.parse(decoded) })
      }
      continue
    }
    if (options?.panelTaskID !== undefined) continue
    if (typeof row.canonicalOutput !== "string") {
      throw new Error(`Completed artifact_read tool part ${row.id} has no canonical string output.`)
    }
    let decoded: unknown
    try {
      decoded = JSON.parse(row.canonicalOutput)
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
    facts.push({ request: ArtifactReadInputSchema.parse(rawInput), chunk: ArtifactReadChunkSchema.parse(decoded) })
  }
  return auditArtifactReadLocatorsFromFacts(facts).completeLocators
}

export type ArtifactSelectionFact = {
  locator: ArtifactReadLocator
  purpose: string
  references: ArtifactSelectionReference[]
}

export function selectedArtifactFactsForSessionInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  options?: ArtifactFactScope,
): ArtifactSelectionFact[] {
  const rows = db
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
    .all()
    .map((row) => ({
      ...row,
      canonicalOutput: completedToolOutcomeOutput(
        db,
        row.outcome as ToolOutcomePartData,
        () => `Completed artifact_select tool part ${row.id}`,
      ),
    }))
  const facts = new Map<string, ArtifactSelectionFact>()
  for (const row of rows) {
    const state = { input: (row.request as { input?: unknown }).input, output: row.canonicalOutput }
    if (typeof state.output !== "string") {
      throw new Error(`Completed artifact_select tool part ${row.id} has no canonical string output.`)
    }
    let decoded: unknown
    try {
      decoded = JSON.parse(state.output)
    } catch (cause) {
      throw new Error(`Completed artifact_select tool part ${row.id} output is not JSON.`, { cause })
    }
    const transportVersion =
      state.input && typeof state.input === "object" && !Array.isArray(state.input)
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
      const selected = ArtifactSelectInputSchema.parse(state.input)
      canonical = ArtifactSelectOutputSchema.parse(decoded)
      if (
        artifactReadLocatorKey(canonical.locator) !== artifactReadLocatorKey(selected.locator) ||
        canonical.purpose !== selected.purpose
      ) {
        throw new Error(`Completed artifact_select tool part ${row.id} output differs from its input.`)
      }
    }
    const key = artifactReadLocatorKey(canonical.locator)
    const selectionScope = assistantActionFactScopeInTransaction(db, sessionID, row.messageID, row.id)
    const completedBeforeSelection = completeArtifactReadLocatorsForSessionInTransaction(db, sessionID, {
      turnParentMessageID: selectionScope.turnParentMessageID,
      before: selectionScope.before,
    })
    if (!completedBeforeSelection.some((locator) => artifactReadLocatorKey(locator) === key)) {
      throw new Error(
        `Completed artifact_select tool part ${row.id} selected a locator that was not completely read in the same Turn.`,
      )
    }
    if (readReference) {
      const prior = artifactReadReferenceLocatorsBeforeActionInTransaction(db, {
        sessionID,
        assistantMessageID: row.messageID,
        toolPartID: row.id,
      }).get(readReference)
      if (!prior || artifactReadLocatorKey(prior) !== key) {
        throw new Error(`Completed artifact_select tool part ${row.id} does not reference its canonical prior read.`)
      }
    }
    const factKey = `${key}\0${canonical.purpose}`
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
      artifactReadLocatorKey(left.locator).localeCompare(artifactReadLocatorKey(right.locator)) ||
      left.purpose.localeCompare(right.purpose),
  )
}

export function completeArtifactReadsBeforePublicationInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; assistantMessageID: string; toolPartID: string },
): ArtifactReadLocator[] {
  const scope = assistantActionFactScopeInTransaction(
    db,
    input.sessionID,
    input.assistantMessageID,
    input.toolPartID,
  )
  return completeArtifactReadLocatorsForSessionInTransaction(db, input.sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
    before: scope.before,
  })
}

export function resolveArtifactReadReferenceBeforeSelectionInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; assistantMessageID: string; toolPartID: string; reference: string },
): ArtifactReadLocator {
  const locator = artifactReadReferenceLocatorsBeforeActionInTransaction(db, input).get(input.reference)
  const complete = completeArtifactReadsBeforePublicationInTransaction(db, input)
  if (!locator || !complete.some((candidate) => artifactReadLocatorKey(candidate) === artifactReadLocatorKey(locator))) {
    throw new ArtifactReferenceResolutionError(
      input.reference,
      `Artifact read reference is not backed by complete persisted reads in Session ${input.sessionID}`,
    )
  }
  return locator
}

export function completeArtifactReadsBeforePanelActionInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; assistantMessageID: string; toolPartID: string; taskID: string },
): ArtifactReadLocator[] {
  const scope = assistantActionFactScopeInTransaction(
    db,
    input.sessionID,
    input.assistantMessageID,
    input.toolPartID,
  )
  return completeArtifactReadLocatorsForSessionInTransaction(db, input.sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
    before: scope.before,
    panelTaskID: input.taskID,
  })
}

function panelArtifactReadReferenceLocatorsBeforeActionInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; assistantMessageID: string; toolPartID: string; taskID: string },
): Map<string, { locator: ArtifactReadLocator; terminalLifecycleReference: TerminalLifecycleReference }> {
  const found = new Map<
    string,
    { locator: ArtifactReadLocator; terminalLifecycleReference: TerminalLifecycleReference }
  >()
  for (const value of completedToolOutputValuesBeforeActionInTransaction(db, {
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
    toolPartID: input.toolPartID,
    toolNames: ["panel"],
    acceptInput: (rawInput) => {
      const parsed = MissionPanelActionSchema.safeParse(
        materializeToolExecutionInput(MissionPanelActionSchema, rawInput),
      )
      return parsed.success && parsed.data.action === "read_task_artifact"
    },
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
      (artifactReadLocatorKey(prior.locator) !== artifactReadLocatorKey(candidate.locator) ||
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

export function resolvePanelArtifactReadReferencesBeforeActionInTransaction(
  db: Database.TxOrDb,
  input: {
    sessionID: string
    assistantMessageID: string
    toolPartID: string
    taskID: string
    terminalLifecycleReference: TerminalLifecycleReference
    references: readonly z.infer<typeof ArtifactReadReferenceSchema>[]
  },
): ArtifactReadLocator[] {
  const byReference = panelArtifactReadReferenceLocatorsBeforeActionInTransaction(db, input)
  const complete = new Set(
    completeArtifactReadsBeforePanelActionInTransaction(db, input).map((locator) =>
      artifactReadLocatorKey(locator),
    ),
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
      !complete.has(artifactReadLocatorKey(resolvedReference.locator))
    ) {
      throw new ArtifactReferenceResolutionError(
        reference,
        `Panel Artifact read reference is not backed by a complete persisted read for Task ${input.taskID}`,
      )
    }
    resolved.set(artifactReadLocatorKey(resolvedReference.locator), resolvedReference.locator)
  }
  return [...resolved.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, locator]) => locator)
}

export function selectedArtifactLocatorsBeforePublicationInTransaction(
  db: Database.TxOrDb,
  input: { sessionID: string; assistantMessageID: string; toolPartID: string },
): ArtifactReadLocator[] {
  const scope = assistantActionFactScopeInTransaction(
    db,
    input.sessionID,
    input.assistantMessageID,
    input.toolPartID,
  )
  const selected = new Map<string, ArtifactReadLocator>()
  for (const fact of selectedArtifactFactsForSessionInTransaction(db, input.sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
    before: scope.before,
  })) {
    selected.set(artifactReadLocatorKey(fact.locator), fact.locator)
  }
  return [...selected.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, locator]) => locator)
}

export function resolveArtifactSelectionReferencesBeforePublicationInTransaction(
  db: Database.TxOrDb,
  input: {
    sessionID: string
    assistantMessageID: string
    toolPartID: string
    references: readonly string[]
  },
): ArtifactReadLocator[] {
  const scope = assistantActionFactScopeInTransaction(
    db,
    input.sessionID,
    input.assistantMessageID,
    input.toolPartID,
  )
  const facts = selectedArtifactFactsForSessionInTransaction(db, input.sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
    before: scope.before,
  })
  const byReference = new Map<string, ArtifactReadLocator>()
  for (const fact of facts) {
    for (const reference of fact.references) {
      const prior = byReference.get(reference)
      if (prior && artifactReadLocatorKey(prior) !== artifactReadLocatorKey(fact.locator)) {
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
    resolved.set(artifactReadLocatorKey(locator), locator)
  }
  return [...resolved.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, locator]) => locator)
}

export function artifactProvenanceForSessionInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  options?: ArtifactFactScope,
) {
  const observedArtifactLocators = completeArtifactReadLocatorsForSessionInTransaction(db, sessionID, options)
  const selections = selectedArtifactFactsForSessionInTransaction(db, sessionID, options)
  const selected = new Map<string, ArtifactReadLocator>()
  for (const fact of selections) selected.set(artifactReadLocatorKey(fact.locator), fact.locator)
  return {
    observedArtifactLocators,
    sourceArtifactLocators: [...selected.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, locator]) => locator),
    selections,
  }
}

export function artifactProvenanceForAgentTurnInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  finalAssistantMessageID: string,
) {
  const scope = assistantTurnFactScopeInTransaction(db, sessionID, finalAssistantMessageID)
  return artifactProvenanceForSessionInTransaction(db, sessionID, {
    turnParentMessageID: scope.turnParentMessageID,
  })
}

export function artifactProvenanceFactHighWatermarkForSessionInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
): { timeCreated: number; partID: string } | undefined {
  const row = db
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
    .get()
  return row ? { timeCreated: row.timeCreated, partID: row.partID } : undefined
}
