import { Bus } from "@/bus"
import { agentCoordinationQuestionID, listAgentCoordinationActions } from "./agent-coordination"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { Question } from "@/question"
import { Database, and, eq } from "@/storage/db"
import { MessageStore } from "@/session/message-store"
import {
  EngineInteractionRequestTable,
  EngineTaskTable,
  type EngineMetadata,
  type EngineInteractionStatus,
} from "./engine.sql"
import { insertEngineInteractionRequest, resolveEngineInteractionRequest } from "./interaction-request"
import { findInteractionByExternal, projectInteractionRowInTransaction, type InteractionRow } from "./store"
import { taskIDForSession } from "./task-session-lineage"
import z from "zod"
import { ProjectMemory, type InteractionUserInput } from "@/memory/project-memory"
import { PermissionLedgerTable } from "@/permission/permission.sql"

export namespace EngineInteraction {
  export function subscribe() {
    Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties, occurrenceID }) => upsertPermission(properties, occurrenceID), {
      durableID: "engine.interaction.permission-asked", effect: "idempotent_by_occurrence",
    })
    Bus.subscribe(PermissionAuthority.Event.Replied, ({ properties }) => resolvePermission(properties), {
      durableID: "engine.interaction.permission-replied", effect: "idempotent_by_occurrence",
    })
    Bus.subscribe(Question.Event.Asked, ({ properties, occurrenceID }) => upsertQuestion(properties, occurrenceID), {
      durableID: "engine.interaction.question-asked", effect: "idempotent_by_occurrence",
    })
    Bus.subscribe(Question.Event.Replied, ({ properties, occurrenceID }) => resolveQuestion(properties, occurrenceID), {
      durableID: "engine.interaction.question-replied", effect: "idempotent_by_occurrence",
    })
    Bus.subscribe(Question.Event.Rejected, ({ properties, occurrenceID }) => rejectQuestion(properties, occurrenceID), {
      durableID: "engine.interaction.question-rejected", effect: "idempotent_by_occurrence",
    })
    Bus.subscribe(Question.Event.Expired, ({ properties, occurrenceID }) => expireQuestion(properties, occurrenceID), {
      durableID: "engine.interaction.question-expired", effect: "idempotent_by_occurrence",
    })
    Bus.subscribe(Question.Event.Abandoned, ({ properties, occurrenceID }) => abandonQuestion(properties, occurrenceID), {
      durableID: "engine.interaction.question-abandoned", effect: "idempotent_by_occurrence",
    })
  }

  export async function reconcileRecoveredPendingWaiters(input: { projectID: string; timeResolved: number }): Promise<{
    abandoned: Array<{ interactionID: string; externalID: string; type: "question" | "permission" }>
    retainedRecoverableQuestions: Array<{ interactionID: string; externalID: string; actionID?: string }>
    retainedRecoverablePermissions: Array<{ interactionID: string; externalID: string }>
  }> {
    if (input.projectID !== Instance.project.id) {
      throw new Error(
        `Recovered interaction reconciliation project ${input.projectID} does not match active project ${Instance.project.id}`,
      )
    }
    const pending = Database.use((db) =>
      db
        .select()
        .from(EngineInteractionRequestTable)
        .orderBy(EngineInteractionRequestTable.time_created, EngineInteractionRequestTable.id)
        .all()
        .map((row) => projectInteractionRowInTransaction(db, row))
        .filter((row) => row.status === "pending" && db.select({ projectID: EngineTaskTable.project_id }).from(EngineTaskTable).where(eq(EngineTaskTable.id, row.task_id)).get()?.projectID === input.projectID),
    )
    const abandoned: Array<{
      interactionID: string
      externalID: string
      type: "question" | "permission"
    }> = []
    const retainedRecoverableQuestions: Array<{
      interactionID: string
      externalID: string
      actionID?: string
    }> = []
    const retainedRecoverablePermissions: Array<{ interactionID: string; externalID: string }> = []

    for (const interaction of pending) {
      if (!interaction.session_id) {
        throw new Error(`Pending interaction ${interaction.id} has no Session identity during project recovery`)
      }
      if (interaction.request_type === "question") {
        const payload = interaction.payload as {
          questions?: unknown
          tool?: unknown
          automatic?: unknown
          expiry?: unknown
        }
        await Question.restore(Question.Request.parse({
          id: interaction.external_id,
          sessionID: interaction.session_id,
          timeCreated: interaction.time_created,
          questions: payload.questions,
          ...(payload.tool ? { tool: payload.tool } : {}),
          ...(payload.automatic ? { automatic: payload.automatic } : {}),
          ...(payload.expiry ? { expiry: payload.expiry } : {}),
        }))
        const recoverableAction = await recoverableAgentCoordinationQuestion(interaction)
        if (recoverableAction) {
          retainedRecoverableQuestions.push({
            interactionID: interaction.id,
            externalID: interaction.external_id,
            actionID: recoverableAction,
          })
          continue
        }
        retainedRecoverableQuestions.push({
          interactionID: interaction.id,
          externalID: interaction.external_id,
        })
        continue
      }
      if (interaction.request_type === "permission") {
        retainedRecoverablePermissions.push({ interactionID: interaction.id, externalID: interaction.external_id })
        continue
      }
      throw new Error(`Pending interaction ${interaction.id} has unsupported type ${interaction.request_type}`)
    }
    return { abandoned, retainedRecoverableQuestions, retainedRecoverablePermissions }
  }
}

type RecoveredAbandonment = {
  sessionID: string
  requestID: string
  origin: "infrastructure"
  timeResolved: number
}

async function abandonQuestion(input: RecoveredAbandonment, sourceOccurrenceID: string) {
  await abandonPendingInteraction(input, "question", sourceOccurrenceID)
}

async function abandonPendingInteraction(input: RecoveredAbandonment, requestType: "question" | "permission", sourceOccurrenceID: string) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireInteractionSession(interaction, input.sessionID, requestType, "abandonment")
  Database.transaction((db) => resolveEngineInteractionRequest(db, {
    row: interaction,
    status: "expired",
    response: { origin: "infrastructure" },
    eventSource: `interaction.${requestType}.abandoned`,
    timeResolved: input.timeResolved,
    sourceOccurrenceID,
  }))
}

function requireInteractionSession(
  interaction: InteractionRow,
  sessionID: string,
  requestType: "question" | "permission",
  terminal: "answer" | "rejection" | "expiry" | "abandonment",
) {
  if (interaction.request_type !== requestType) {
    throw new Error(
      `${requestType} ${terminal} type mismatch for interaction ${interaction.id}: ${interaction.request_type}`,
    )
  }
  if (interaction.session_id !== sessionID) {
    throw new Error(`${requestType} ${terminal} session mismatch for interaction ${interaction.id}: ${sessionID}`)
  }
}

async function recoverableAgentCoordinationQuestion(interaction: InteractionRow): Promise<string | undefined> {
  const candidates = listAgentCoordinationActions(interaction.task_id).filter(
    (action) =>
      action.payload.action === "ask_user" &&
      agentCoordinationQuestionID(action.payload.action_id) === interaction.external_id,
  )
  if (candidates.length === 0) return undefined
  if (candidates.length !== 1) {
    throw new Error(
      `Pending interaction ${interaction.id} matches ${candidates.length} A2A ask_user actions; refusing ambiguous recovery`,
    )
  }
  const action = candidates[0]!
  if (action.payload.status !== "pending" || action.payload.decision !== "ask_user") {
    throw new Error(
      `Pending A2A interaction ${interaction.id} points to ${action.payload.status}/${action.payload.decision} action ${action.artifactID}`,
    )
  }
  if (action.taskID !== interaction.task_id || action.payload.task_id !== interaction.task_id) {
    throw new Error(`Pending A2A interaction ${interaction.id} changed Task lineage for action ${action.artifactID}`)
  }
  if (interaction.request_type !== "question" || interaction.session_id !== action.payload.orchestrator_session_id) {
    throw new Error(`Pending A2A interaction ${interaction.id} changed Orchestrator Session lineage`)
  }
  if (taskIDForSession(action.payload.orchestrator_session_id) !== interaction.task_id) {
    throw new Error(`Pending A2A interaction ${interaction.id} Orchestrator Session is not owned by its Task`)
  }
  const result = action.payload.result
  const recordedQuestionID = typeof result?.question_id === "string" ? result.question_id : undefined
  const recordedInteractionID = typeof result?.interaction_id === "string" ? result.interaction_id : undefined
  if ((recordedQuestionID === undefined) !== (recordedInteractionID === undefined)) {
    throw new Error(`Pending A2A action ${action.artifactID} has incomplete question interaction pointers`)
  }
  if (recordedQuestionID && recordedQuestionID !== interaction.external_id) {
    throw new Error(`Pending A2A action ${action.artifactID} changed its deterministic Question identity`)
  }
  if (recordedInteractionID && recordedInteractionID !== interaction.id) {
    throw new Error(`Pending A2A action ${action.artifactID} changed its Engine interaction identity`)
  }
  const payload = z
    .object({
      tool: z.object({ messageID: z.string().min(1), callID: z.string().min(1) }),
    })
    .passthrough()
    .parse(interaction.payload)
  if (
    payload.tool.messageID !== action.payload.orchestrator_message_id ||
    payload.tool.callID !== action.payload.orchestrator_tool_call_id
  ) {
    throw new Error(`Pending A2A interaction ${interaction.id} changed its persisted Tool binding`)
  }
  const message = await MessageStore.get({
    sessionID: action.payload.orchestrator_session_id,
    messageID: action.payload.orchestrator_message_id,
  })
  if (message.info.role !== "assistant") {
    throw new Error(`Pending A2A action ${action.artifactID} message is not an assistant message`)
  }
  const part = message.parts.find((candidate) => candidate.id === action.payload.orchestrator_tool_part_id)
  if (
    !part ||
    part.type !== "tool" ||
    part.tool !== "respond_agent_coordination" ||
    part.callID !== action.payload.orchestrator_tool_call_id
  ) {
    throw new Error(`Pending A2A action ${action.artifactID} changed its persisted respond_agent_coordination ToolPart`)
  }
  return action.artifactID
}

async function upsertPermission(request: PermissionAuthority.Request, _sourceOccurrenceID: string) {
  const owner = resolveOwner(request.sessionID)
  if (!owner) return
  if (findInteractionByExternal(request.id)) return
  const source = Database.use((db) => db.select({ id: PermissionLedgerTable.id }).from(PermissionLedgerTable).where(and(
    eq(PermissionLedgerTable.request_id, request.id),
    eq(PermissionLedgerTable.event_type, "requested"),
  )).get())
  if (!source) throw new Error(`Permission ${request.id} has no immutable requested ledger fact`)
  Database.transaction((db) => {
    insertEngineInteractionRequest(db, {
      taskID: owner.taskID,
      sessionID: request.sessionID,
      externalID: request.id,
      requestType: "permission",
      title: `Permission: ${request.toolName}`,
      body: `${request.summary}\n\n${JSON.stringify(request.scope, null, 2)}`,
      payload: {
        mode: request.mode,
        policyRevision: request.policyRevision,
        providerKind: request.providerKind,
        providerID: request.providerID,
        providerDigest: request.providerDigest,
        toolName: request.toolName,
        effectClass: request.effectClass,
        scopeVersion: request.scopeVersion,
        scope: request.scope,
        fingerprint: request.fingerprint,
        choices: request.choices,
        tool: { messageID: request.messageID, callID: request.toolCallID },
      },
      eventSource: "interaction.permission",
      eventSummary: `Permission requested: ${request.toolName}`,
      timeCreated: request.timeCreated,
      source: { kind: "permission_request", id: source.id },
    })
  })
}

async function resolvePermission(input: {
  sessionID: string
  requestID: string
  decision: PermissionAuthority.Decision
  autoReply?: boolean
  userInput?: InteractionUserInput
}) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  // The Permission ledger decision is already the one terminal authority.
  // This subscriber only projects/captures optional authored user evidence.
  if (interaction.status === "pending") throw new Error(`Permission ${input.requestID} reply has no authoritative ledger decision`)
  assertResolvedReplay(interaction, input.userInput)
}

async function upsertQuestion(request: Question.Request, sourceOccurrenceID: string) {
  const owner = resolveOwner(request.sessionID)
  if (!owner) return
  if (findInteractionByExternal(request.id)) return
  const title = request.questions.map((item) => item.header).join(" / ") || "Question"
  const body = request.questions.map((item) => item.question).join("\n\n")
  Database.transaction((db) => {
    // Always emit — overlay only filters by taskID, and a Task-Agent clarification
    // before any run has started still needs to surface in the InteractionPanel.
    insertEngineInteractionRequest(db, {
      taskID: owner.taskID,
      sessionID: request.sessionID,
      externalID: request.id,
      requestType: "question",
      title,
      body,
      payload: {
        questions: request.questions,
        tool: request.tool,
        ...(request.automatic ? { automatic: request.automatic } : {}),
        ...(request.expiry ? { expiry: request.expiry } : {}),
      },
      eventSource: "interaction.question",
      eventSummary: title,
      timeCreated: request.timeCreated,
      source: { kind: "bus_question", id: sourceOccurrenceID },
    })
  })
}

function resolveOwner(sessionID: string) {
  const taskID = taskIDForSession(sessionID)
  if (!taskID) return undefined
  return { taskID }
}

async function resolveQuestion(input: {
  sessionID: string
  requestID: string
  answers: Question.Answer[]
  timeResolved: number
  automatic?: boolean
  userInput?: InteractionUserInput
}, sourceOccurrenceID: string) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireInteractionSession(interaction, input.sessionID, "question", "answer")
  if (interaction.status !== "pending") return assertResolvedReplay(interaction, input.userInput)
  await resolveInteraction(
    interaction,
    "answered",
    { answers: input.answers, ...(input.automatic ? { auto_reply: true } : {}) },
    input.timeResolved,
    input.userInput,
    sourceOccurrenceID,
  )
}

async function rejectQuestion(input: {
  sessionID: string
  requestID: string
  origin: "operator"
  timeResolved: number
  userInput?: InteractionUserInput
}, sourceOccurrenceID: string) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireInteractionSession(interaction, input.sessionID, "question", "rejection")
  if (interaction.status !== "pending") return assertResolvedReplay(interaction, input.userInput)
  await resolveInteraction(interaction, "rejected", { origin: input.origin }, input.timeResolved, input.userInput, sourceOccurrenceID)
}

async function expireQuestion(input: {
  sessionID: string
  requestID: string
  origin: "deadline"
  timeExpires: number
  timeResolved: number
}, sourceOccurrenceID: string) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireInteractionSession(interaction, input.sessionID, "question", "expiry")
  await resolveInteraction(
    interaction,
    "expired",
    { origin: input.origin, time_expires: input.timeExpires },
    input.timeResolved,
    undefined,
    sourceOccurrenceID,
  )
}

async function resolveInteraction(
  interaction: InteractionRow,
  status: Exclude<EngineInteractionStatus, "pending">,
  response: EngineMetadata,
  timeResolved: number,
  userInput?: InteractionUserInput,
  sourceOccurrenceID?: string,
) {
  Database.transaction((db) => {
    resolveEngineInteractionRequest(db, {
      row: interaction,
      status,
      response,
      eventSource: "interaction.resolve",
      timeResolved,
      sourceOccurrenceID,
    })
    if (userInput) {
      const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, interaction.task_id)).get()
      if (!task) throw new Error(`Interaction ${interaction.id} Task owner not found`)
      ProjectMemory.captureOccurrenceInTransaction(db, {
        occurrenceKind: status === "rejected" ? "interaction_reject" : "interaction_reply",
        occurrenceID: interaction.id,
        projectID: task.project_id,
        sessionID: interaction.session_id ?? undefined,
        taskID: interaction.task_id,
        surface: userInput.surface,
        timeCreated: timeResolved,
        text: userInput.text,
        structured: userInput.structured,
      })
    }
  })
}

function assertResolvedReplay(interaction: InteractionRow, userInput?: InteractionUserInput) {
  if (!userInput) return
  const timeResolved = interaction.time_resolved
  if (!timeResolved) throw new Error(`Interaction ${interaction.id} terminal replay has no resolution time`)
  Database.transaction((db) => {
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, interaction.task_id)).get()
    if (!task) throw new Error(`Interaction ${interaction.id} replay Task owner not found`)
    ProjectMemory.captureOccurrenceInTransaction(db, {
      occurrenceKind: interaction.status === "rejected" ? "interaction_reject" : "interaction_reply",
      occurrenceID: interaction.id,
      projectID: task.project_id,
      sessionID: interaction.session_id ?? undefined,
      taskID: interaction.task_id,
      surface: userInput.surface,
      timeCreated: timeResolved,
      text: userInput.text,
      structured: userInput.structured,
    })
  })
}
