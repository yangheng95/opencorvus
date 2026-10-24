import { Bus } from "@/bus"
import { readPermissionRequestFacts } from "@/permission/ledger-facts"
import { Identifier } from "@/id/id"
import {
  agentCoordinationQuestionID,
  findAgentCoordinationActionsByIDs,
  type AgentCoordinationActionRow,
} from "./agent-coordination"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { Question } from "@/question"
import { Database, and, asc, eq, gt } from "@/storage/db"
import { MessageStore } from "@/session/message-store"
import {
  EngineInteractionRequestTable,
  EngineTaskTable,
  type EngineMetadata,
  type EngineInteractionStatus,
} from "./engine.sql"
import { insertEngineInteractionRequest, resolveEngineInteractionRequest } from "./interaction-request"
import { requestTaskControlScanInBackground } from "./task-root-ingress-delivery"
import { findInteractionByExternal, projectInteractionRowInTransaction, type InteractionRow } from "./store"
import { taskIDForSession } from "./task-session-lineage"
import z from "zod"
import { ProjectMemory } from "@/memory/project-memory"
import type { InteractionUserInput } from "@/memory/interaction-user-input"
import { PermissionLedgerTable } from "@/permission/permission.sql"
import { Log } from "@/util/log"
import { ProtocolStore } from "@/protocol/store"
import { timelineInteractionResponseOrderKey } from "@/timeline/order"
import { ensurePermissionInteractionInTransaction } from "@/permission/interaction-record"

const log = Log.create({ service: "engine.interaction" })

export namespace EngineInteraction {
  export function subscribe() {
    Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties, occurrenceID }) => upsertPermission(properties, occurrenceID), {
      durableID: "engine.interaction.permission-asked", effect: "idempotent_by_occurrence",
    })
    Bus.subscribeInTransaction(PermissionAuthority.Event.Replied, ({ properties }, db) => projectPermissionReply(db, properties), {
      durableID: "engine.interaction.permission-replied", effect: "idempotent_by_occurrence",
    })
    Bus.subscribe(PermissionAuthority.Event.Terminated, ({ properties }) => projectPermissionTermination(properties), {
      durableID: "engine.interaction.permission-terminated", effect: "idempotent_by_occurrence",
    })
    Bus.subscribe(
      Question.Event.Asked,
      ({ properties, occurrenceID }) =>
        projectQuestion({ sessionID: properties.sessionID, requestID: properties.id, askedOccurrenceID: occurrenceID }),
      {
        durableID: "engine.interaction.question-asked",
        effect: "idempotent_by_occurrence",
      },
    )
    Bus.subscribe(
      Question.Event.Replied,
      ({ properties, occurrenceID }) =>
        projectQuestion({
          sessionID: properties.sessionID,
          requestID: properties.requestID,
          terminalOccurrenceID: occurrenceID,
        }),
      {
        durableID: "engine.interaction.question-replied",
        effect: "idempotent_by_occurrence",
      },
    )
    Bus.subscribe(
      Question.Event.Rejected,
      ({ properties, occurrenceID }) =>
        projectQuestion({
          sessionID: properties.sessionID,
          requestID: properties.requestID,
          terminalOccurrenceID: occurrenceID,
        }),
      {
        durableID: "engine.interaction.question-rejected",
        effect: "idempotent_by_occurrence",
      },
    )
    Bus.subscribe(
      Question.Event.Expired,
      ({ properties, occurrenceID }) =>
        projectQuestion({
          sessionID: properties.sessionID,
          requestID: properties.requestID,
          terminalOccurrenceID: occurrenceID,
        }),
      {
        durableID: "engine.interaction.question-expired",
        effect: "idempotent_by_occurrence",
      },
    )
    Bus.subscribe(
      Question.Event.Abandoned,
      ({ properties, occurrenceID }) =>
        projectQuestion({
          sessionID: properties.sessionID,
          requestID: properties.requestID,
          terminalOccurrenceID: occurrenceID,
        }),
      {
        durableID: "engine.interaction.question-abandoned",
        effect: "idempotent_by_occurrence",
      },
    )
  }

  /** Interactions inserted directly by the Task-root control plane rather than
   * registered with the Question subsystem. Their external identity is a
   * durable locator, not a Question ID, and they are answered through the
   * Task API's activity-reconciliation branch — restoring them as Questions
   * would reject the locator and fail the whole recovery pass. */
  function isDirectControlPlaneGate(interaction: InteractionRow): boolean {
    const payload = interaction.payload as { activity_reconciliation?: unknown } | null
    return Boolean(payload && typeof payload === "object" && payload.activity_reconciliation)
  }

  export async function reconcileRecoveredPendingWaiters(input: { projectID: string; timeResolved: number }): Promise<{
    abandoned: Array<{ interactionID: string; externalID: string; type: "question" | "permission" }>
    retainedRecoverableQuestions: Array<{ interactionID: string; externalID: string; actionID?: string }>
    retainedRecoverablePermissions: Array<{ interactionID: string; externalID: string }>
    retainedControlPlaneGates: Array<{ interactionID: string; externalID: string }>
    /** Rows this pass could not reconcile. They stay pending and are reported;
     * one unreconcilable row must never keep the whole project from opening. */
    unreconciled: Array<{ interactionID: string; externalID: string; error: string }>
  }> {
    if (input.projectID !== Instance.project.id) {
      throw new Error(
        `Recovered interaction reconciliation project ${input.projectID} does not match active project ${Instance.project.id}`,
      )
    }
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
    const retainedControlPlaneGates: Array<{ interactionID: string; externalID: string }> = []
    const unreconciled: Array<{ interactionID: string; externalID: string; error: string }> = []

    let cursor = ""
    while (true) {
      const rawPage = Database.use((db) =>
        db
          .select()
          .from(EngineInteractionRequestTable)
          .where(cursor ? gt(EngineInteractionRequestTable.id, cursor) : undefined)
          .orderBy(asc(EngineInteractionRequestTable.id))
          .limit(64)
          .all(),
      )
      if (rawPage.length === 0) break
      cursor = rawPage.at(-1)!.id
      const pending = Database.use((db) =>
        rawPage
          .map((row) => projectInteractionRowInTransaction(db, row))
          .filter(
            (row) =>
              row.status === "pending" &&
              db
                .select({ projectID: EngineTaskTable.project_id })
                .from(EngineTaskTable)
                .where(eq(EngineTaskTable.id, row.task_id))
                .get()?.projectID === input.projectID,
          ),
      )
      const actionIDs = pending.flatMap((interaction) => {
        if (interaction.request_type !== "question") return []
        const prefix = "que_agent_coordination_"
        if (!interaction.external_id.startsWith(prefix)) return []
        const parsed = Identifier.schema("artifact").safeParse(interaction.external_id.slice(prefix.length))
        return parsed.success ? [parsed.data] : []
      })
      const actionsByID = new Map(
        findAgentCoordinationActionsByIDs(actionIDs).map((action) => [action.artifactID, action]),
      )

      for (const interaction of pending) {
        try {
          if (!interaction.session_id) {
            throw new Error(`Pending interaction ${interaction.id} has no Session identity during project recovery`)
          }
          if (isDirectControlPlaneGate(interaction)) {
            retainedControlPlaneGates.push({
              interactionID: interaction.id,
              externalID: interaction.external_id,
            })
            continue
          }
          if (interaction.request_type === "question") {
            const projected = projectQuestion({ sessionID: interaction.session_id, requestID: interaction.external_id })
            if (!projected || projected.interaction.id !== interaction.id)
              throw new Error(`Question ${interaction.external_id} recovery changed its Task interaction owner`)
            if (projected.facts.terminal) continue
            await Question.restore(projected.facts.request)
            const recoverableAction = await recoverableAgentCoordinationQuestion(interaction, actionsByID)
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
        } catch (error) {
          // The row keeps its pending fact: this pass has no proof of any
          // terminal outcome, and inventing one would discard a real waiter.
          // It is reported instead, so a single unreconcilable row degrades one
          // Task rather than making the project permanently unopenable.
          const message = error instanceof Error ? error.message : String(error)
          unreconciled.push({
            interactionID: interaction.id,
            externalID: interaction.external_id,
            error: message,
          })
          log.error("pending interaction could not be reconciled during project recovery", {
            interactionID: interaction.id,
            externalID: interaction.external_id,
            requestType: interaction.request_type ?? "unknown",
            taskID: interaction.task_id,
            error: message,
          })
        }
      }
      if (rawPage.length < 64) break
    }
    return {
      abandoned,
      retainedRecoverableQuestions,
      retainedRecoverablePermissions,
      retainedControlPlaneGates,
      unreconciled,
    }
  }
}

async function recoverableAgentCoordinationQuestion(
  interaction: InteractionRow,
  actionsByID: ReadonlyMap<string, AgentCoordinationActionRow>,
): Promise<string | undefined> {
  const questionID = interaction.external_id
  const prefix = "que_agent_coordination_"
  if (!questionID?.startsWith(prefix)) return undefined
  const actionID = questionID.slice(prefix.length)
  const parsedActionID = Identifier.schema("artifact").safeParse(actionID)
  if (!parsedActionID.success) return undefined
  const action = actionsByID.get(parsedActionID.data)
  if (!action || action.payload.action !== "ask_user") return undefined
  if (agentCoordinationQuestionID(action.payload.action_id) !== questionID) {
    throw new Error(`Pending interaction ${interaction.id} changed its deterministic A2A action identity`)
  }
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
  const binding = Database.immediateTransaction(db => ensurePermissionInteractionInTransaction(db, {
    request, projectID: Instance.project.id,
  }))
  if (!binding) return
  const facts = Database.use(db => readPermissionRequestFacts(db, request.id))
  if (!facts)
    throw new Error(`Permission ${request.id} has inconsistent immutable requested ledger facts`)
  if (facts.decision) await resolvePermission({ sessionID: request.sessionID, requestID: request.id, decision: facts.decision })
}

async function projectPermissionTermination(input: z.infer<typeof PermissionAuthority.Event.Terminated.properties>) {
  const fact = Database.use((db) => {
    const facts = readPermissionRequestFacts(db, input.requestID)
    const terminal = facts?.authority, requested = facts?.requested
    if (!terminal || !requested || terminal.id !== input.ledgerEventID || terminal.request_id !== input.requestID || terminal.decision_slot !== input.requestID
      || terminal.event_type !== input.status || requested.project_id !== input.projectID || requested.session_id !== input.sessionID) {
      throw new Error("Permission " + input.requestID + " terminal notification differs from its immutable ledger authority")
    }
    return { terminal, requested }
  })
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  const task = Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, interaction.task_id)).get())
  if (interaction.request_type !== "permission" || interaction.session_id !== input.sessionID || task?.project_id !== input.projectID
    || interaction.task_id !== fact.requested.task_id || interaction.status !== "rejected" || interaction.time_resolved !== fact.terminal.time_created) {
    throw new Error("Permission " + input.requestID + " terminal notification differs from its Task interaction owner")
  }
  ProtocolStore.dispatchEphemeral({
    type: "interaction.resolved", aggregate: "task", taskID: interaction.task_id, sessionID: input.sessionID,
    source: "interaction.permission.terminated",
    orderKey: timelineInteractionResponseOrderKey({ id: interaction.id, timeResolved: fact.terminal.time_created }),
    payload: { taskID: interaction.task_id, interactionID: interaction.id, requestType: "permission", status: interaction.status,
      requestID: input.requestID, ledgerEventID: input.ledgerEventID, summary: "Permission " + input.status },
  })
}

type PermissionReply = {
  sessionID: string
  requestID: string
  decision: PermissionAuthority.Decision
  autoReply?: boolean
  userInput?: InteractionUserInput
}

function projectPermissionReply(db: Database.TxOrDb, input: PermissionReply) {
  const facts = readPermissionRequestFacts(db, input.requestID)
  if (!facts) throw new Error(`Permission ${input.requestID} has no immutable request`)
  ensurePermissionInteractionInTransaction(db, { request: facts.request, projectID: Instance.project.id })
  const projected = resolvePermission(input)
  if (!projected || !input.userInput) return
  ProjectMemory.captureOccurrenceInTransaction(db, {
    occurrenceKind: projected.interaction.status === "rejected" ? "interaction_reject" : "interaction_reply",
    occurrenceID: projected.interaction.id,
    projectID: facts.request.projectID,
    sessionID: input.sessionID,
    taskID: projected.interaction.task_id,
    surface: input.userInput.surface,
    timeCreated: facts.authority!.time_created,
    text: input.userInput.text,
    structured: input.userInput.structured,
  })
}

function resolvePermission(input: PermissionReply) {
  const facts = Database.use(db => readPermissionRequestFacts(db, input.requestID))
  if (!facts?.authority || facts.request.sessionID !== input.sessionID || facts.decision !== input.decision)
    throw new Error(`Permission ${input.requestID} reply differs from its immutable ledger decision`)
  const interaction = findInteractionByExternal(input.requestID)
  if (!interaction) return
  // The Permission ledger decision is already the one terminal authority.
  // Asked and Replied may both project it; only Replied owns memory admission.
  if (interaction.status === "pending") throw new Error(`Permission ${input.requestID} reply has no authoritative ledger decision`)
  const task = Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, interaction.task_id)).get())
  if (interaction.request_type !== "permission" || interaction.session_id !== input.sessionID ||
    interaction.task_id !== facts.request.taskID || task?.project_id !== facts.request.projectID ||
    interaction.time_resolved !== facts.authority.time_created)
    throw new Error(`Permission ${input.requestID} reply differs from its Task interaction owner`)
  Database.effect(() => ProtocolStore.dispatchEphemeral({
    type: "interaction.resolved", aggregate: "task", taskID: interaction.task_id, sessionID: input.sessionID,
    source: "interaction.permission.replied",
    orderKey: timelineInteractionResponseOrderKey({ id: interaction.id, timeResolved: facts.authority.time_created }),
    payload: { taskID: interaction.task_id, interactionID: interaction.id, requestType: "permission", status: interaction.status,
      requestID: input.requestID, ledgerEventID: facts.authority.id, summary: "Permission " + facts.decision },
  }))
  return { interaction, facts }
}

function resolveOwner(sessionID: string) {
  const taskID = taskIDForSession(sessionID)
  if (!taskID) return undefined
  return { taskID }
}

function projectQuestion(input: {
  sessionID: string
  requestID: string
  askedOccurrenceID?: string
  terminalOccurrenceID?: string
}) {
  const owner = resolveOwner(input.sessionID)
  if (!owner) return
  const projectID = Instance.project.id
  const projected = Database.immediateTransaction((db) => {
    const facts = Question.publicationFacts({ ...input, projectID })
    const request = facts.request
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, owner.taskID)).get()
    if (!task || task.project_id !== projectID)
      throw new Error(`Question ${request.id} has a different Task Project owner`)
    let interaction = findInteractionByExternal(request.id)
    if (!interaction) {
      const title = request.questions.map((item) => item.header).join(" / ") || "Question"
      insertEngineInteractionRequest(db, {
        taskID: owner.taskID,
        sessionID: request.sessionID,
        externalID: request.id,
        requestType: "question",
        title,
        body: request.questions.map((item) => item.question).join("\n\n"),
        payload: {
          questions: request.questions,
          tool: request.tool,
          ...(request.automatic ? { automatic: request.automatic } : {}),
          ...(request.expiry ? { expiry: request.expiry } : {}),
        },
        eventSource: "interaction.question",
        eventSummary: title,
        timeCreated: request.timeCreated,
        source: { kind: "bus_question", id: facts.askedOccurrenceID },
      })
      interaction = findInteractionByExternal(request.id)
    }
    if (
      !interaction ||
      interaction.task_id !== owner.taskID ||
      interaction.session_id !== request.sessionID ||
      interaction.request_type !== "question"
    ) {
      throw new Error(`Question ${request.id} has a different immutable Task interaction owner`)
    }
    const row = db
      .select()
      .from(EngineInteractionRequestTable)
      .where(eq(EngineInteractionRequestTable.id, interaction.id))
      .get()
    if (row?.source_kind !== "bus_question" || row.source_id !== facts.askedOccurrenceID) {
      throw new Error(`Question ${request.id} interaction refers to a different original Asked publication`)
    }
    const terminal = facts.terminal
    if (terminal) {
      const status: Exclude<EngineInteractionStatus, "pending"> =
        terminal.type === "question.replied"
          ? "answered"
          : terminal.type === "question.rejected"
            ? "rejected"
            : "expired"
      const response: EngineMetadata =
        terminal.type === "question.replied"
          ? { answers: terminal.properties.answers, ...(terminal.properties.automatic ? { auto_reply: true } : {}) }
          : terminal.type === "question.expired"
            ? { origin: terminal.properties.origin, time_expires: terminal.properties.timeExpires }
            : { origin: terminal.properties.origin }
      const createdOutcome = resolveEngineInteractionRequest(db, {
        row: interaction,
        status,
        response,
        eventSource: "interaction.resolve",
        timeResolved: terminal.properties.timeResolved,
        sourceOccurrenceID: terminal.occurrenceID,
      })
      const userInput = "userInput" in terminal.properties ? terminal.properties.userInput : undefined
      if (createdOutcome && userInput) {
        ProjectMemory.captureOccurrenceInTransaction(db, {
          occurrenceKind: status === "rejected" ? "interaction_reject" : "interaction_reply",
          occurrenceID: interaction.id,
          projectID: task.project_id,
          sessionID: request.sessionID,
          taskID: task.id,
          surface: userInput.surface,
          timeCreated: terminal.properties.timeResolved,
          text: userInput.text,
          structured: userInput.structured,
        })
      }
    }
    return { facts, interaction: projectInteractionRowInTransaction(db, row) }
  })
  if (projected.facts.terminal)
    requestTaskControlScanInBackground(projected.interaction.task_id, `interaction.${projected.interaction.status}`)
  return projected
}
