import {
  ArtifactReadInputSchema,
  ArtifactReadChunkSchema,
  ArtifactSelectInputSchema,
  ArtifactSelectOutputSchema,
  artifactReadLocatorKey,
  auditArtifactReadLocatorsFromFacts,
  type ArtifactReadWindowFact,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { Database, and, asc, desc, eq, gt, or, sql } from "@/storage/db"
import { MessageTable, PartTable } from "@/session/session.sql"
import { MissionPanelActionSchema } from "@/panel/capability"
import { materializeToolExecutionInput } from "@/provider/tool-execution-input"

function locatorKey(locator: ArtifactReadLocator): string {
  return artifactReadLocatorKey(locator)
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
        data: PartTable.data,
      })
      .from(PartTable)
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(PartTable.session_id, sessionID),
          ...(options?.afterTimeCreated !== undefined ? [gt(PartTable.time_created, options.afterTimeCreated)] : []),
          ...factScopeConditions(options),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool'`,
          sql`json_extract(${PartTable.data}, '$.tool') IN ('artifact_read', 'panel')`,
          sql`json_extract(${PartTable.data}, '$.state.status') = 'completed'`,
        ),
      )
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all(),
  )
  const facts: ArtifactReadWindowFact[] = []
  for (const row of rows) {
    const data = row.data as {
      tool?: unknown
      state?: { input?: unknown; output?: unknown }
    }
    const state = (
      row.data as {
        state?: { input?: unknown; output?: unknown }
      }
    ).state
    const rawInput = state?.input
    if (data.tool === "panel") {
      if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) continue
      const parsed = MissionPanelActionSchema.safeParse(
        materializeToolExecutionInput(MissionPanelActionSchema, rawInput),
      )
      if (!parsed.success) continue
      const panelInput = parsed.data
      if (panelInput.action !== "read_task_artifact") continue
      const { action: _action, taskID, ...read } = panelInput
      if (options?.panelTaskID !== undefined && taskID !== options.panelTaskID) continue
      const request = ArtifactReadInputSchema.parse(read)
      if (typeof state?.output !== "string") {
        throw new Error(`Completed panel.read_task_artifact tool part ${row.id} has no canonical string output.`)
      }
      let decoded: unknown
      try {
        decoded = JSON.parse(state.output)
      } catch (cause) {
        throw new Error(`Completed panel.read_task_artifact tool part ${row.id} output is not JSON.`, { cause })
      }
      facts.push({ request, chunk: ArtifactReadChunkSchema.parse(decoded) })
      continue
    }
    if (options?.panelTaskID !== undefined) continue
    const request = ArtifactReadInputSchema.parse(rawInput)
    if (typeof state?.output !== "string") {
      throw new Error(`Completed artifact_read tool part ${row.id} has no canonical string output.`)
    }
    let decoded: unknown
    try {
      decoded = JSON.parse(state.output)
    } catch (cause) {
      throw new Error(`Completed artifact_read tool part ${row.id} output is not JSON.`, { cause })
    }
    const chunk = ArtifactReadChunkSchema.parse(decoded)
    facts.push({ request, chunk })
  }
  return auditArtifactReadLocatorsFromFacts(facts).completeLocators
}

export type ArtifactSelectionFact = {
  locator: ArtifactReadLocator
  purpose: string
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
        data: PartTable.data,
      })
      .from(PartTable)
      .innerJoin(MessageTable, eq(MessageTable.id, PartTable.message_id))
      .where(
        and(
          eq(PartTable.session_id, sessionID),
          ...factScopeConditions(options),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool'`,
          sql`json_extract(${PartTable.data}, '$.tool') = 'artifact_select'`,
          sql`json_extract(${PartTable.data}, '$.state.status') = 'completed'`,
        ),
      )
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all(),
  )
  const facts = new Map<string, ArtifactSelectionFact>()
  for (const row of rows) {
    const state = (row.data as { state?: { input?: unknown; output?: unknown } }).state
    const selected = ArtifactSelectInputSchema.parse(state?.input)
    if (typeof state?.output !== "string") {
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
    const output = ArtifactSelectOutputSchema.parse(decoded)
    if (locatorKey(output.locator) !== locatorKey(selected.locator) || output.purpose !== selected.purpose) {
      throw new Error(`Completed artifact_select tool part ${row.id} output differs from its input.`)
    }
    const key = locatorKey(selected.locator)
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
    facts.set(`${key}\u0000${selected.purpose}`, selected)
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
      .where(
        and(
          eq(PartTable.session_id, sessionID),
          sql`json_extract(${PartTable.data}, '$.type') = 'tool'`,
          sql`json_extract(${PartTable.data}, '$.tool') IN ('artifact_read', 'artifact_select', 'panel')`,
        ),
      )
      .orderBy(desc(PartTable.time_created), desc(PartTable.id))
      .limit(1)
      .get(),
  )
  return row ? { timeCreated: row.timeCreated, partID: row.partID } : undefined
}
