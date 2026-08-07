import { Orchestrator } from "@/orchestrator/agent"
import { createTerminalConversationAuthority } from "@/orchestrator/terminal-conversation-authority"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Message } from "@/session/message"
import { isExecutionCancellationError } from "@/session/prompt/cancellation"
import { SessionPromptState } from "@/session/prompt/state"
import { Database, and, eq } from "@/storage/db"
import { listAgentCoordinationActions } from "./agent-coordination"
import { updateEngineArtifactWhereReturning } from "./artifact"
import { EngineArtifactTable, EngineTaskTable } from "./engine.sql"
import {
  QueuedTaskIngressSchema,
  TerminalIngressResultSchema,
  sameTerminalIngressResult,
  type QueuedTaskIngress,
  type TerminalIngressResult,
} from "./queued-task-ingress"
import {
  TerminalLifecycleReferenceSchema,
  requireCurrentTerminalLifecycleReference,
  sameTerminalLifecycleReference,
  terminalLifecycleReferenceMatchesTaskRow,
  type TerminalLifecycleReference,
} from "./terminal-lifecycle-reference"
import type { TaskRow } from "./store"

export class TerminalIngressIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TerminalIngressIntegrityError"
  }
}

type DurableTerminalResultCandidate = {
  result: TerminalIngressResult
  terminalLifecycleReference?: TerminalLifecycleReference
  source: string
}

function assistantFailureResult(
  error: NonNullable<Message.Assistant["error"]>,
  timeCompleted: number,
): TerminalIngressResult {
  const message =
    typeof error.data?.message === "string" && error.data.message.length > 0
      ? error.data.message
      : `Assistant delivery failed with ${error.name}`
  return {
    status: "delivery_failed",
    error_name: error.name,
    message,
    time_completed: timeCompleted,
  }
}

function assertConsistentCandidates(
  ingressID: string,
  candidates: DurableTerminalResultCandidate[],
): DurableTerminalResultCandidate | undefined {
  if (candidates.length === 0) return undefined
  const ingressCandidate = candidates.find((candidate) => candidate.source.startsWith("ingress:"))
  const actionCandidate = candidates.find((candidate) => candidate.source.startsWith("coordination_action:"))
  const authority = ingressCandidate ?? actionCandidate ?? candidates[0]!
  for (const candidate of candidates) {
    const sameCompletedAssistant =
      authority.result.status === "completed" &&
      candidate.result.status === "completed" &&
      authority.result.assistant_message_id === candidate.result.assistant_message_id
    if (!sameCompletedAssistant && !sameTerminalIngressResult(authority.result, candidate.result)) {
      throw new TerminalIngressIntegrityError(
        `Terminal ingress ${ingressID} has conflicting durable results from ${authority.source} and ${candidate.source}`,
      )
    }
    if (
      authority.terminalLifecycleReference &&
      candidate.terminalLifecycleReference &&
      !sameTerminalLifecycleReference(authority.terminalLifecycleReference, candidate.terminalLifecycleReference)
    ) {
      throw new TerminalIngressIntegrityError(
        `Terminal ingress ${ingressID} has conflicting terminal lifecycle references`,
      )
    }
  }
  return authority
}

export async function resolveDurableTerminalIngressResult(input: {
  task: TaskRow
  ingressArtifactID: string
  ingress: QueuedTaskIngress
}): Promise<DurableTerminalResultCandidate | undefined> {
  const candidates: DurableTerminalResultCandidate[] = []
  if (input.ingress.delivery_result) {
    candidates.push({
      result: TerminalIngressResultSchema.parse(input.ingress.delivery_result),
      source: `ingress:${input.ingressArtifactID}`,
    })
  }
  for (const action of listAgentCoordinationActions(input.task.id)) {
    if (
      action.payload.action !== "acknowledge_terminal" ||
      action.payload.status !== "completed" ||
      action.payload.result?.terminal_ingress_id !== input.ingressArtifactID
    ) {
      continue
    }
    if (
      input.ingress.source_kind !== "coordination_request" ||
      action.payload.request_id !== input.ingress.request_id
    ) {
      throw new TerminalIngressIntegrityError(
        `Terminal acknowledgement ${action.artifactID} conflicts with ingress ${input.ingressArtifactID} provenance`,
      )
    }
    if (!action.payload.completed_at) {
      throw new TerminalIngressIntegrityError(
        `Completed terminal acknowledgement ${action.artifactID} has no completion time`,
      )
    }
    if (!input.task.session_id) {
      throw new TerminalIngressIntegrityError(
        `Terminal acknowledgement ${action.artifactID} Task has no root Session`,
      )
    }
    let orchestratorSession: Awaited<ReturnType<typeof Session.get>>
    let assistantMessage: Awaited<ReturnType<typeof MessageStore.get>>
    try {
      orchestratorSession = await Session.get(action.payload.orchestrator_session_id)
      assistantMessage = await MessageStore.get({
        sessionID: action.payload.orchestrator_session_id,
        messageID: action.payload.orchestrator_message_id,
      })
    } catch (error) {
      throw new TerminalIngressIntegrityError(
        `Terminal acknowledgement ${action.artifactID} has no durable assistant anchor: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (
      orchestratorSession.kind !== "orchestrator" ||
      orchestratorSession.parentID !== input.task.session_id ||
      assistantMessage.info.role !== "assistant" ||
      assistantMessage.info.taskIngress?.id !== input.ingressArtifactID ||
      assistantMessage.info.taskIngress.kind !== "coordination_request"
    ) {
      throw new TerminalIngressIntegrityError(
        `Terminal acknowledgement ${action.artifactID} assistant anchor conflicts with Task ingress authority`,
      )
    }
    const reference = TerminalLifecycleReferenceSchema.parse(
      action.payload.result.terminal_lifecycle_reference,
    )
    if (!terminalLifecycleReferenceMatchesTaskRow(reference, input.task)) {
      throw new TerminalIngressIntegrityError(
        `Terminal acknowledgement ${action.artifactID} does not match the current Task occurrence`,
      )
    }
    candidates.push({
      result: {
        status: "completed",
        assistant_message_id: action.payload.orchestrator_message_id,
        time_completed: action.payload.completed_at,
      },
      terminalLifecycleReference: reference,
      source: `coordination_action:${action.artifactID}`,
    })
  }

  if (input.task.session_id) {
    const orchestratorSessions = (await Session.children(input.task.session_id)).filter(
      (session) => session.kind === "orchestrator",
    )
    for (const session of orchestratorSessions) {
      for await (const message of MessageStore.stream(session.id)) {
        if (
          message.info.role !== "assistant" ||
          message.info.taskIngress?.id !== input.ingressArtifactID ||
          message.info.taskIngress.kind !== input.ingress.source_kind ||
          message.info.time.completed === undefined
        ) {
          continue
        }
        candidates.push({
          result: message.info.error
            ? assistantFailureResult(message.info.error, message.info.time.completed)
            : {
                status: "completed",
                assistant_message_id: message.info.id,
                time_completed: message.info.time.completed,
              },
          source: `assistant_message:${message.info.id}`,
        })
      }
    }
  }
  return assertConsistentCandidates(input.ingressArtifactID, candidates)
}

export function settleTerminalIngress(input: {
  taskID: string
  ingressArtifactID: string
  result: TerminalIngressResult
  terminalLifecycleReference: TerminalLifecycleReference
}): boolean {
  return Database.transaction((db) => {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.ingressArtifactID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          eq(EngineArtifactTable.label, "pending"),
        ),
      )
      .get()
    if (!row) return false
    const ingress = QueuedTaskIngressSchema.parse(row.payload)
    if (ingress.delivery_result) {
      throw new TerminalIngressIntegrityError(
        `Pending terminal ingress ${input.ingressArtifactID} already contains a delivery result`,
      )
    }
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
    if (!task || !terminalLifecycleReferenceMatchesTaskRow(input.terminalLifecycleReference, task)) return false
    return Boolean(
      updateEngineArtifactWhereReturning(db, {
        where: and(
          eq(EngineArtifactTable.id, row.id),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "queued_operator_wake"),
          eq(EngineArtifactTable.label, "pending"),
        )!,
        kind: "queued_operator_wake",
        label: input.result.status === "delivery_failed" ? "delivery_failed" : "drained",
        payload: { ...ingress, delivery_result: input.result },
        timeUpdated: input.result.time_completed,
      }),
    )
  })
}

async function executeTerminalIngress(input: {
  task: TaskRow
  ingressArtifactID: string
  ingress: QueuedTaskIngress
  signal: AbortSignal
  terminalLifecycleReference: TerminalLifecycleReference
}): Promise<DurableTerminalResultCandidate & { terminalLifecycleReference: TerminalLifecycleReference }> {
  const durable = await resolveDurableTerminalIngressResult(input)
  if (durable) {
    if (
      durable.terminalLifecycleReference &&
      !sameTerminalLifecycleReference(
        durable.terminalLifecycleReference,
        input.terminalLifecycleReference,
      )
    ) {
      throw new TerminalIngressIntegrityError(
        `Terminal ingress ${input.ingressArtifactID} durable result references another terminal occurrence`,
      )
    }
    return { ...durable, terminalLifecycleReference: input.terminalLifecycleReference }
  }
  const timeCompleted = () => Date.now()
  if (input.ingress.source_kind === "orchestrator_message") {
    return {
      result: { status: "passive_delivered", time_completed: timeCompleted() },
      terminalLifecycleReference: input.terminalLifecycleReference,
      source: "passive",
    }
  }
  if (
    input.ingress.source_kind !== "operator_message" &&
    input.ingress.source_kind !== "coordination_request"
  ) {
    return {
      result: {
        status: "terminal_inapplicable",
        reason: `${input.ingress.source_kind} carries no terminal conversation authority`,
        time_completed: timeCompleted(),
      },
      terminalLifecycleReference: input.terminalLifecycleReference,
      source: "inapplicable",
    }
  }
  const authority = createTerminalConversationAuthority({
    taskID: input.task.id,
    ingressID: input.ingressArtifactID,
    ingress: input.ingress,
  })
  const assistantMessageID = await Orchestrator.processTerminalConversation({
    taskID: input.task.id,
    event: input.ingress.event,
    authority,
    signal: input.signal,
  })
  return {
    result: {
      status: "completed",
      assistant_message_id: assistantMessageID,
      time_completed: timeCompleted(),
    },
    terminalLifecycleReference: authority.terminalLifecycleReference,
    source: `assistant_message:${assistantMessageID}`,
  }
}

export interface TerminalIngressDelivery {
  result: TerminalIngressResult
  settled: boolean
}

export async function deliverTerminalTaskIngress(input: {
  task: TaskRow
  ingressArtifactID: string
  ingress: QueuedTaskIngress
}): Promise<TerminalIngressDelivery> {
  if (!input.task.session_id) throw new Error(`Terminal Task ${input.task.id} has no root Session`)
  const terminalLifecycleReference = requireCurrentTerminalLifecycleReference(input.task.id)
  return SessionPromptState.enqueueRootWake({
    rootSessionID: input.task.session_id,
    wakeID: input.ingressArtifactID,
    run: async (signal) => {
      let delivery: DurableTerminalResultCandidate & { terminalLifecycleReference: TerminalLifecycleReference }
      try {
        delivery = await executeTerminalIngress({ ...input, signal, terminalLifecycleReference })
      } catch (error) {
        if (signal.aborted || isExecutionCancellationError(error) || isExecutionCancellationError(signal.reason)) {
          throw signal.reason ?? error
        }
        delivery = {
          result: {
            status: "delivery_failed",
            error_name: error instanceof Error && error.name ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
            time_completed: Date.now(),
          },
          terminalLifecycleReference,
          source: "delivery_attempt",
        }
      }
      return {
        result: delivery.result,
        settled: settleTerminalIngress({
          taskID: input.task.id,
          ingressArtifactID: input.ingressArtifactID,
          result: delivery.result,
          terminalLifecycleReference: delivery.terminalLifecycleReference,
        }),
      }
    },
  })
}
