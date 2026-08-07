import { Bus } from "@/bus"
import { PermissionNext } from "@/permission/next"
import { Question } from "@/question"
import { Database, and, eq } from "@/storage/db"
import { EngineInteractionRequestTable, type EngineMetadata, type EngineInteractionStatus } from "./engine.sql"
import { insertEngineInteractionRequest, resolveEngineInteractionRequest } from "./interaction-request"
import { findInteractionByExternal, type InteractionRow } from "./store"
import { taskIDForSession } from "./task-session-lineage"

export namespace EngineInteraction {
  export function subscribe() {
    Bus.subscribe(PermissionNext.Event.Asked, ({ properties }) => upsertPermission(properties))
    Bus.subscribe(PermissionNext.Event.Replied, ({ properties }) => resolvePermission(properties))
    Bus.subscribe(Question.Event.Asked, ({ properties }) => upsertQuestion(properties))
    Bus.subscribe(Question.Event.Replied, ({ properties }) => resolveQuestion(properties))
    Bus.subscribe(Question.Event.Rejected, ({ properties }) => rejectQuestion(properties))
    Bus.subscribe(Question.Event.Expired, ({ properties }) => expireQuestion(properties))
    Bus.subscribe(Question.Event.Abandoned, ({ properties }) => abandonQuestion(properties))
  }
}

async function abandonQuestion(input: {
  sessionID: string
  requestID: string
  origin: "infrastructure"
  timeResolved: number
}) {
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  requireQuestionInteractionSession(interaction, input.sessionID, "abandonment")
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
      throw new Error(`Question abandonment lost pending interaction ownership: ${interaction.id}`)
    }
  })
}

function requireQuestionInteractionSession(
  interaction: InteractionRow,
  sessionID: string,
  terminal: "answer" | "rejection" | "expiry" | "abandonment",
) {
  if (interaction.request_type !== "question") {
    throw new Error(`Question ${terminal} type mismatch for interaction ${interaction.id}: ${interaction.request_type}`)
  }
  if (interaction.session_id !== sessionID) {
    throw new Error(`Question ${terminal} session mismatch for interaction ${interaction.id}: ${sessionID}`)
  }
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
  requireQuestionInteractionSession(interaction, input.sessionID, "answer")
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
  requireQuestionInteractionSession(interaction, input.sessionID, "rejection")
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
  requireQuestionInteractionSession(interaction, input.sessionID, "expiry")
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
