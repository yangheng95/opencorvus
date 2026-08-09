import { Bus } from "@/bus"
import { agentCoordinationQuestionID, listAgentCoordinationActions } from "./agent-coordination"
import { PermissionNext } from "@/permission/next"
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
import { findInteractionByExternal, type InteractionRow } from "./store"
import { taskIDForSession } from "./task-session-lineage"
import z from "zod"

export namespace EngineInteraction {
  export function subscribe() {
    Bus.subscribe(PermissionNext.Event.Asked, ({ properties }) => upsertPermission(properties))
    Bus.subscribe(PermissionNext.Event.Replied, ({ properties }) => resolvePermission(properties))
    Bus.subscribe(PermissionNext.Event.Abandoned, ({ properties }) => abandonPermission(properties))
    Bus.subscribe(Question.Event.Asked, ({ properties }) => upsertQuestion(properties))
    Bus.subscribe(Question.Event.Replied, ({ properties }) => resolveQuestion(properties))
    Bus.subscribe(Question.Event.Rejected, ({ properties }) => rejectQuestion(properties))
    Bus.subscribe(Question.Event.Expired, ({ properties }) => expireQuestion(properties))
    Bus.subscribe(Question.Event.Abandoned, ({ properties }) => abandonQuestion(properties))
  }

  export async function reconcileRecoveredPendingWaiters(input: {
    projectID: string
    timeResolved: number
  }): Promise<{
    abandoned: Array<{ interactionID: string; externalID: string; type: "question" | "permission" }>
    retainedRecoverableQuestions: Array<{ interactionID: string; externalID: string; actionID: string }>
  }> {
    if (input.projectID !== Instance.project.id) {
      throw new Error(
        `Recovered interaction reconciliation project ${input.projectID} does not match active project ${Instance.project.id}`,
      )
    }
    const pending = Database.use((db) =>
      db
        .select({ interaction: EngineInteractionRequestTable })
        .from(EngineInteractionRequestTable)
        .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineInteractionRequestTable.task_id))
        .where(
          and(
            eq(EngineTaskTable.project_id, input.projectID),
            eq(EngineInteractionRequestTable.status, "pending"),
          ),
        )
        .orderBy(EngineInteractionRequestTable.time_created, EngineInteractionRequestTable.id)
        .all()
        .map((row) => row.interaction),
    )
    const abandoned: Array<{
      interactionID: string
      externalID: string
      type: "question" | "permission"
    }> = []
    const retainedRecoverableQuestions: Array<{
      interactionID: string
      externalID: string
      actionID: string
    }> = []

    for (const interaction of pending) {
      if (!interaction.session_id) {
        throw new Error(`Pending interaction ${interaction.id} has no Session identity during project recovery`)
      }
      if (interaction.request_type === "question") {
        const recoverableAction = await recoverableAgentCoordinationQuestion(interaction)
        if (recoverableAction) {
          retainedRecoverableQuestions.push({
            interactionID: interaction.id,
            externalID: interaction.external_id,
            actionID: recoverableAction,
          })
          continue
        }
        await Question.abandonRecovered({
          sessionID: interaction.session_id,
          requestID: interaction.external_id,
          timeResolved: input.timeResolved,
        })
        abandoned.push({ interactionID: interaction.id, externalID: interaction.external_id, type: "question" })
        continue
      }
      if (interaction.request_type === "permission") {
        await PermissionNext.abandonRecovered({
          sessionID: interaction.session_id,
          requestID: interaction.external_id,
          timeResolved: input.timeResolved,
        })
        abandoned.push({ interactionID: interaction.id, externalID: interaction.external_id, type: "permission" })
        continue
      }
      throw new Error(`Pending interaction ${interaction.id} has unsupported type ${interaction.request_type}`)
    }
    return { abandoned, retainedRecoverableQuestions }
  }
}

type RecoveredAbandonment = {
  sessionID: string
  requestID: string
  origin: "infrastructure"
  timeResolved: number
}

async function abandonQuestion(input: RecoveredAbandonment) {
  await abandonPendingInteraction(input, "question")
}

async function abandonPermission(input: RecoveredAbandonment) {
  await abandonPendingInteraction(input, "permission")
}

async function abandonPendingInteraction(input: RecoveredAbandonment, requestType: "question" | "permission") {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireInteractionSession(interaction, input.sessionID, requestType, "abandonment")
  Database.transaction((db) => {
    const deleted = db
      .delete(EngineInteractionRequestTable)
      .where(
        and(
          eq(EngineInteractionRequestTable.id, interaction.id),
          eq(EngineInteractionRequestTable.external_id, input.requestID),
          eq(EngineInteractionRequestTable.session_id, input.sessionID),
          eq(EngineInteractionRequestTable.status, "pending"),
        ),
      )
      .returning({ id: EngineInteractionRequestTable.id })
      .get()
    if (!deleted) {
      throw new Error(`${requestType} abandonment lost pending interaction ownership: ${interaction.id}`)
    }
  })
}

function requireInteractionSession(
  interaction: InteractionRow,
  sessionID: string,
  requestType: "question" | "permission",
  terminal: "answer" | "rejection" | "expiry" | "abandonment",
) {
  if (interaction.request_type !== requestType) {
    throw new Error(`${requestType} ${terminal} type mismatch for interaction ${interaction.id}: ${interaction.request_type}`)
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

async function upsertPermission(request: PermissionNext.Request) {
  const owner = resolveOwner(request.sessionID)
  if (!owner) return
  if (findInteractionByExternal(request.id)) return
  const now = Date.now()
  Database.transaction((db) => {
    insertEngineInteractionRequest(db, {
      taskID: owner.taskID,
      sessionID: request.sessionID,
      externalID: request.id,
      requestType: "permission",
      title: `Permission: ${request.permission}`,
      body: request.patterns.join("\n") || request.permission,
      payload: {
        permission: request.permission,
        patterns: request.patterns,
        metadata: request.metadata,
        always: request.always,
        tool: request.tool,
      },
      eventSource: "interaction.permission",
      eventSummary: `Permission requested: ${request.permission}`,
      timeCreated: now,
    })
  })
}

async function resolvePermission(input: {
  sessionID: string
  requestID: string
  reply: PermissionNext.Reply
  autoReply?: boolean
}) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  const response: EngineMetadata = {
    reply: input.reply,
    ...(input.autoReply ? { auto_reply: true } : {}),
  }
  await resolveInteraction(interaction, input.reply === "reject" ? "rejected" : "answered", response, Date.now())
}

async function upsertQuestion(request: Question.Request) {
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
}) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireInteractionSession(interaction, input.sessionID, "question", "answer")
  await resolveInteraction(
    interaction,
    "answered",
    { answers: input.answers, ...(input.automatic ? { auto_reply: true } : {}) },
    input.timeResolved,
  )
}

async function rejectQuestion(input: {
  sessionID: string
  requestID: string
  origin: "operator"
  timeResolved: number
}) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireInteractionSession(interaction, input.sessionID, "question", "rejection")
  await resolveInteraction(interaction, "rejected", { origin: input.origin }, input.timeResolved)
}

async function expireQuestion(input: {
  sessionID: string
  requestID: string
  origin: "deadline"
  timeExpires: number
  timeResolved: number
}) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireInteractionSession(interaction, input.sessionID, "question", "expiry")
  await resolveInteraction(
    interaction,
    "expired",
    { origin: input.origin, time_expires: input.timeExpires },
    input.timeResolved,
  )
}

async function resolveInteraction(
  interaction: InteractionRow,
  status: Exclude<EngineInteractionStatus, "pending">,
  response: EngineMetadata,
  timeResolved: number,
) {
  Database.transaction((db) => {
    resolveEngineInteractionRequest(db, {
      row: interaction,
      status,
      response,
      eventSource: "interaction.resolve",
      timeResolved,
    })
  })
}
