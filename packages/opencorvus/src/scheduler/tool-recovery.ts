import { EngineTaskWaitRegistrationTable } from "@/engine/engine.sql"
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
import { scheduledToolInputDigest, scheduledToolOccurrenceConflict, type ScheduledToolOccurrence } from "./tool-occurrence"

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
  const { executeScheduleToolInput, ScheduleToolParameters } = await import("@/tool/schedule")
  const input = ScheduleToolParameters.parse(objectInput(part))
  const facts = Database.use((db) => ({
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
  }))
  const count = Object.values(facts).filter(Boolean).length
  if (count === 0) return undefined
  if (count !== 1) {
    throw scheduledToolOccurrenceConflict(recoveryOccurrence(part, "schedule"), `owns ${count} domain facts`)
  }

  const storedDigest =
    facts.definition?.tool_input_digest ??
    facts.tombstone?.tool_input_digest ??
    facts.fire?.input_digest ??
    facts.eventDefinition?.tool_input_digest ??
    facts.eventTombstone?.tool_input_digest
  const expectedDigest = scheduledToolInputDigest("schedule", input)
  if (!storedDigest || storedDigest !== expectedDigest) {
    throw scheduledToolOccurrenceConflict(
      recoveryOccurrence(part, "schedule"),
      `does not match its persisted ${input.action} request`,
    )
  }
  return executeScheduleToolInput(input, {
    sessionID: part.sessionID,
    projectID: Instance.project.id,
    occurrence: {
      sessionID: part.sessionID,
      messageID: part.messageID,
      toolPartID: part.id,
      toolCallID: part.callID,
      toolName: "schedule",
    },
  })
}

export async function recoverScheduledToolPart(part: Message.ToolPart): Promise<RecoveredToolResult | undefined> {
  if (part.tool === "wait") return recoverWait(part)
  if (part.tool === "schedule") return recoverSchedule(part)
  return undefined
}
