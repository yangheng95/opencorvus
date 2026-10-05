import { EngineTaskWaitRegistrationTable } from "@/engine/engine.sql"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import type { Message } from "@/session/message"
import { Database, eq } from "@/storage/db"
import { WaitToolParameters } from "@/tool/wait-contract"
import {
  AutomationDefinitionTombstoneTable,
  AutomationFireTable,
  AutomationTable,
} from "./automation.sql"
import { EventJobDefinitionTombstoneTable, EventJobTable } from "./event.sql"
import { assertScheduledToolOccurrenceInTransaction, scheduledToolInputDigest, scheduledToolOccurrenceConflict, type ScheduledToolOccurrence } from "./tool-occurrence"

type RecoveredToolResult = {
  title: string
  output: string
  metadata: Record<string, unknown>
}

function objectInput(part: Message.ToolPart): Record<string, unknown> {
  const input = part.state.input
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`Scheduled Tool request ${part.id} has no canonical object input`)
  }
  return input as Record<string, unknown>
}

function recoveryOccurrence(part: Message.ToolPart, toolName: ScheduledToolOccurrence["toolName"]): ScheduledToolOccurrence {
  return {
    sessionID: part.sessionID,
    messageID: part.messageID,
    toolPartID: part.id,
    toolCallID: part.callID,
    toolName,
  }
}

async function recoverWait(part: Message.ToolPart): Promise<RecoveredToolResult | undefined> {
  const { completedWaitToolResult } = await import("@/tool/wait-result")
  const input = WaitToolParameters.parse(objectInput(part))
  const facts = Database.use((db) => {
    const task = db
      .select()
      .from(EngineTaskWaitRegistrationTable)
      .where(eq(EngineTaskWaitRegistrationTable.tool_part_id, part.id))
      .get()
    const session = db.select().from(AutomationTable).where(eq(AutomationTable.tool_part_id, part.id)).get()
    return { task, session }
  })
  if (facts.task && facts.session) {
    throw scheduledToolOccurrenceConflict(recoveryOccurrence(part, "wait"), "owns multiple scheduling facts")
  }
  if (facts.task) {
    const expectedDigest = scheduledToolInputDigest("wait", {
      taskID: facts.task.task_id,
      executionEpoch: facts.task.execution_epoch,
      durationMs: input.duration_ms,
      reason: input.reason,
    })
    if (facts.task.input_digest !== expectedDigest || facts.task.reason !== input.reason) {
      throw scheduledToolOccurrenceConflict(recoveryOccurrence(part, "wait"), "does not match its native Task wait fact")
    }
    return completedWaitToolResult({
      jobID: facts.task.id,
      nextRun: facts.task.due_at,
      requestedMs: input.duration_ms,
      reason: input.reason,
      mode: "task",
    })
  }
  if (facts.session) {
    if (facts.session.kind !== "delay" || facts.session.due_at === null) {
      throw scheduledToolOccurrenceConflict(recoveryOccurrence(part, "wait"), "owns a non-delay Automation")
    }
    const prompt = [
      "Scheduled wait completed.",
      `Requested delay: ${input.duration_ms}ms.`,
      `Reason: ${input.reason}`,
      "Continue from the current visible conversation state.",
    ].join("\n")
    const expectedDigest = scheduledToolInputDigest("wait", {
      sessionID: part.sessionID,
      durationMs: input.duration_ms,
      prompt,
      surface: facts.session.surface ?? null,
    })
    if (facts.session.tool_input_digest !== expectedDigest || facts.session.session_id !== part.sessionID) {
      throw scheduledToolOccurrenceConflict(recoveryOccurrence(part, "wait"), "does not match its Session delay fact")
    }
    return completedWaitToolResult({
      jobID: facts.session.definition_id,
      nextRun: facts.session.due_at,
      requestedMs: input.duration_ms,
      reason: input.reason,
      mode: "session",
    })
  }
  return undefined
}

async function recoverSchedule(part: Message.ToolPart): Promise<RecoveredToolResult | undefined> {
  const { AutomationService } = await import("./automation-service")
  const { EventService } = await import("./event-service")
  const {
    executeScheduleToolInput,
    normalizeScheduleToolInputForDigest,
    formatScheduleDefinitionResult,
    formatScheduleDeletionResult,
    formatScheduleEventCreationResult,
    formatScheduleEventCancellationResult,
  } = await import("@/tool/schedule")
  const occurrence = recoveryOccurrence(part, "schedule")
  const recovered = Database.immediateTransaction((db) => {
    assertScheduledToolOccurrenceInTransaction(db, occurrence)
    const facts = {
      definition: db.select().from(AutomationTable).where(eq(AutomationTable.tool_part_id, part.id)).get(),
      tombstone: db
        .select()
        .from(AutomationDefinitionTombstoneTable)
        .where(eq(AutomationDefinitionTombstoneTable.tool_part_id, part.id))
        .get(),
      fire: db.select().from(AutomationFireTable).where(eq(AutomationFireTable.tool_part_id, part.id)).get(),
      eventDefinition: db.select().from(EventJobTable).where(eq(EventJobTable.tool_part_id, part.id)).get(),
      eventTombstone: db
        .select()
        .from(EventJobDefinitionTombstoneTable)
        .where(eq(EventJobDefinitionTombstoneTable.tool_part_id, part.id))
        .get(),
    }
    const count = Object.values(facts).filter(Boolean).length
    if (count === 0) return undefined
    if (count !== 1) throw scheduledToolOccurrenceConflict(occurrence, `owns ${count} domain facts`)
    let input: Record<string, unknown>
    try {
      input = normalizeScheduleToolInputForDigest(objectInput(part))
    } catch {
      throw scheduledToolOccurrenceConflict(occurrence, "has invalid persisted scheduling input")
    }
    const digest =
      facts.definition?.tool_input_digest ??
      facts.tombstone?.tool_input_digest ??
      facts.fire?.input_digest ??
      facts.eventDefinition?.tool_input_digest ??
      facts.eventTombstone?.tool_input_digest
    if (digest !== scheduledToolInputDigest("schedule", input)) {
      throw scheduledToolOccurrenceConflict(occurrence, `does not match its persisted ${input.action} request`)
    }
    if (facts.definition) {
      const action = input.action
      if (facts.definition.kind !== "recurring" || !facts.definition.recurrence) {
        throw scheduledToolOccurrenceConflict(occurrence, "owns a non-recurring Automation definition")
      }
      if (action !== "create" && action !== "update" && action !== "pause" && action !== "resume") {
        throw scheduledToolOccurrenceConflict(occurrence, "has an action inconsistent with its Automation definition")
      }
      if (action !== "create" && input.automationId !== facts.definition.definition_id) {
        throw scheduledToolOccurrenceConflict(occurrence, "changed its Automation definition identity")
      }
      if (
        action === "create" &&
        facts.definition.definition_id !==
          Identifier.deterministic("automation", `automation-definition-v1\0${occurrence.toolPartID}`)
      ) {
        throw scheduledToolOccurrenceConflict(occurrence, "changed its Automation creation identity")
      }
      return {
        kind: "receipt" as const,
        result: formatScheduleDefinitionResult(
          action,
          AutomationService.definitionReceiptInTransaction(db, facts.definition),
        ),
      }
    }
    if (facts.tombstone) {
      if (input.action !== "delete" || input.automationId !== facts.tombstone.definition_id) {
        throw scheduledToolOccurrenceConflict(occurrence, "changed its Automation deletion identity")
      }
      return {
        kind: "receipt" as const,
        result: formatScheduleDeletionResult(AutomationService.deletionReceiptInTransaction(db, facts.tombstone)),
      }
    }
    if (facts.eventDefinition) {
      if (input.action !== "create_event")
        throw scheduledToolOccurrenceConflict(occurrence, "has an action inconsistent with its Event definition")
      if (
        facts.eventDefinition.id !==
        Identifier.deterministic("event_job", `event-job-definition-v1\0${occurrence.toolPartID}`)
      ) {
        throw scheduledToolOccurrenceConflict(occurrence, "changed its Event creation identity")
      }
      return {
        kind: "receipt" as const,
        result: formatScheduleEventCreationResult(EventService.definitionReceiptInTransaction(facts.eventDefinition)),
      }
    }
    if (facts.eventTombstone) {
      if (input.action !== "cancel_event" || input.jobId !== facts.eventTombstone.definition_id) {
        throw scheduledToolOccurrenceConflict(occurrence, "changed its Event deletion identity")
      }
      const deleted = EventService.deletionReceiptInTransaction(db, facts.eventTombstone)
      if (deleted.projectID !== Instance.project.id)
        throw scheduledToolOccurrenceConflict(occurrence, "changed its Event project identity")
      return { kind: "receipt" as const, result: formatScheduleEventCancellationResult(deleted) }
    }
    if (input.action !== "run" || typeof input.automationId !== "string") {
      throw scheduledToolOccurrenceConflict(occurrence, "has an action inconsistent with its manual Fire")
    }
    return { kind: "run" as const, input: { action: "run" as const, automationId: input.automationId } }
  })
  if (!recovered) return undefined
  if (recovered.kind === "receipt") return recovered.result
  return executeScheduleToolInput(recovered.input, {
    sessionID: part.sessionID,
    projectID: Instance.project.id,
    occurrence,
  })
}

export async function recoverScheduledToolPart(part: Message.ToolPart): Promise<RecoveredToolResult | undefined> {
  if (part.tool === "wait") return recoverWait(part)
  if (part.tool === "schedule") return recoverSchedule(part)
  return undefined
}
