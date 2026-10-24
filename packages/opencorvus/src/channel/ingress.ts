import { EngineChannelBindingTable, EngineTaskTable, EngineControlActivationLeaseGrantTable } from "@/engine/engine.sql"
import { TaskChannelBindingProjectConflictError, TaskGlobalProjectBindingError } from "@/engine/task-project-error"
import { EngineService } from "@/task-api"
import { ControlMessage, controlFinalMessageText } from "@/control/message"
import { ControlMessageInput, ControlMessageResult } from "@/control/message-schema"
import { Database, NotFoundError, and, asc, desc, eq, gt, sql } from "@/storage/db"
import { Identifier } from "@/id/id"
import {
  ControlLeaseFenceLostError,
  acquireControlLeaseInTransaction,
  assertControlLeaseInTransaction,
  currentControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
} from "@/engine/control-lease"
import { Instance } from "@/project/instance"
import z from "zod"
import { ChannelId } from "./catalog"
import { isModelReference } from "@/provider/model-ref"
import { ChannelIngressAcceptedTable, ChannelIngressOutcomeTable, type ChannelIngressEffect } from "./channel.sql"
import { PermissionDecision } from "@/permission/decision"
import { Bus } from "@/bus"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { findInteraction, listInteractions } from "@/engine/store"
import { readPermissionRequestFacts } from "@/permission/ledger-facts"
import { Question } from "@/question"
import { ProjectTable } from "@/project/project.sql"
import { joinProcessLiveness, observeProcessLiveness } from "@/engine/process-liveness"
import { currentRuntimeOccurrenceID } from "@/runtime/process-occurrence"
import { Log } from "@/util/log"

type Accepted = typeof ChannelIngressAcceptedTable.$inferSelect
const CHANNEL_CAUSATION_SOURCE = "channel.ingress"
const log = Log.create({ service: "channel.ingress" })
const NO_BINDING_RESULT = {
  kind: "panel_response" as const,
  message: "No task is bound to this channel thread. Start a new thread to create a task.",
}

export const MessageAttachmentInput = z.object({
  filename: z.string().trim().min(1),
  mime: z.string().trim().min(1),
  url: z.string().optional(),
  data: z.string().optional(),
})

export const ChannelIngressInput = z
  .object({
    platform: ChannelId,
    channel: z.string().min(1),
    thread: z.string().min(1),
    text: z.string(),
    task_id: z.string().optional(),
    user_id: z.string().optional(),
    request_id: z.string().min(1),
    source: z.string().optional(),
    model: z
      .string()
      .refine(isModelReference, {
        message: 'Model must be in the format "provider/model".',
      })
      .optional(),
    allow_create: z.boolean().default(true),
    allow_session_mutation: z.boolean().default(false),
    bind: z.boolean().default(true),
    attachments: MessageAttachmentInput.array().default([]),
  })
  .strict()

const ChannelDirectResult = z
  .object({
    kind: z.enum(["panel_response", "interaction"]),
    message: z.string(),
    task_id: z.string().optional(),
    interaction_id: z.string().optional(),
    attachments: z.never().optional(),
  })
  .strict()

export const ChannelIngressResult = z.union([ControlMessageResult, ChannelDirectResult])

export const ChannelIngressInspectionQuery = z.object({
  projectID: z.string().min(1).optional(),
  field: z.enum(["input", "effect", "outcome"]).default("input"),
  byteOffset: z.coerce.number().int().min(0).default(0),
  afterSource: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(32).default(16),
})

export const ChannelIngressInspection = z.object({
  acceptedID: z.string(),
  requestID: z.string(),
  platform: z.string(),
  projectID: z.string(),
  projectGeneration: z.string().nullable(),
  currentProjectGeneration: z.string().nullable(),
  owner: z.enum(["current", "retired", "unknown"]),
  effect: z.enum(["control", "interaction"]).nullable(),
  acceptedAt: z.number(),
  outcomeRecorded: z.boolean(),
  body: z.object({
    field: ChannelIngressInspectionQuery.shape.field,
    encoding: z.literal("base64"),
    byteOffset: z.number(),
    totalBytes: z.number(),
    data: z.string(),
    nextByteOffset: z.number().nullable(),
  }),
  sourceOccurrences: z.array(z.object({ occurrenceID: z.string(), type: z.string() })),
  nextSource: z.string().nullable(),
  lease: z
    .object({
      id: z.string(),
      target: z.string(),
      target_id: z.string(),
      owner_occurrence_id: z.string(),
      time_activated: z.number(),
      expires_at: z.number(),
    })
    .nullable(),
})

export namespace ChannelIngress {
  let afterEffectBeforeOutcome: (() => void) | undefined
  let beforeEffect: (() => void | Promise<void>) | undefined

  export async function message(raw: z.input<typeof ChannelIngressInput>) {
    const input = ChannelIngressInput.parse(raw)
    return executeOwnedMessage(input)
  }

  function payload(input: z.output<typeof ChannelIngressInput>): Record<string, unknown> {
    const { platform: _platform, request_id: _requestID, ...owned } = input
    return owned
  }

  async function executeOwnedMessage(input: z.output<typeof ChannelIngressInput>) {
    const acceptedID = Identifier.deterministic(
      "call",
      `channel-ingress\0${Instance.project.id}\0${input.platform}\0${input.request_id}`,
    )
    const serialized = JSON.stringify(payload(input))
    const processOwner = joinProcessLiveness(currentRuntimeOccurrenceID())
    try {
      const accepted = Database.immediateTransaction((db) => {
        const project = db.select().from(ProjectTable).where(eq(ProjectTable.id, Instance.project.id)).get()
        const current = db
          .select()
          .from(ChannelIngressAcceptedTable)
          .where(eq(ChannelIngressAcceptedTable.id, acceptedID))
          .get()
        if (current) {
          if (JSON.stringify(current.input) !== serialized) {
            throw new Error(`Channel ingress request ${input.request_id} replay changed its payload`)
          }
          return { row: current, created: false as const }
        }
        if (project?.generation !== Instance.projectGeneration)
          throw new ChannelIngressProjectContextConflictError({
            requestID: input.request_id,
            projectID: Instance.project.id,
            contextGeneration: Instance.projectGeneration,
            currentGeneration: project?.generation ?? null,
          })
        const selection = selectEffect(input)
        const row = {
          id: acceptedID,
          project_id: Instance.project.id,
          project_generation: Instance.projectGeneration,
          effect: selection.effect ?? null,
          platform: input.platform,
          request_id: input.request_id,
          input: JSON.parse(serialized) as Record<string, unknown>,
          time_created: Date.now(),
        }
        db.insert(ChannelIngressAcceptedTable).values(row).run()
        if (selection.result) {
          db.insert(ChannelIngressOutcomeTable)
            .values({ request_id: row.id, result: selection.result, time_created: row.time_created })
            .run()
          return { row, created: true as const, result: selection.result }
        }
        processOwner.assertOwnedInTransaction(db, processOwner.occurrenceID)
        const lease = acquireControlLeaseInTransaction(db, {
          target: "effect",
          targetID: row.id,
          ownerOccurrenceID: processOwner.occurrenceID,
          now: Date.now(),
          leaseMilliseconds: 120_000,
        })
        if (!lease.acquired) throw new Error(`New Channel ingress ${row.id} already has an effect owner`)
        return { row, created: true as const, lease: lease.lease }
      })
      assertCurrentOwner(accepted.row)
      const outcome = findOutcome(accepted.row.id)
      if (outcome) return ChannelIngressResult.parse(outcome.result)
      if (!accepted.created) return await recoverAccepted(accepted.row, processOwner)
      const lease = accepted.lease!
      try {
        await beforeEffect?.()
        assertCurrentOwner(accepted.row)
        const result = await Bus.withCausation(
          { source: CHANNEL_CAUSATION_SOURCE, occurrenceID: accepted.row.id },
          () => executeMessage(input, accepted.row.effect!),
        )
        afterEffectBeforeOutcome?.()
        return settleOutcome(accepted.row, result, lease, processOwner.occurrenceID)
      } catch (error) {
        endOriginalLeaseOnError(accepted.row, lease, processOwner.occurrenceID)
        throw error
      }
    } finally {
      processOwner.release()
    }
  }

  export async function recover(input: {
    platform: z.output<typeof ChannelId>
    requestID: string
  }): Promise<z.output<typeof ChannelIngressResult>> {
    const accepted = Database.use((db) =>
      db
        .select()
        .from(ChannelIngressAcceptedTable)
        .where(
          and(
            eq(ChannelIngressAcceptedTable.project_id, Instance.project.id),
            eq(ChannelIngressAcceptedTable.platform, input.platform),
            eq(ChannelIngressAcceptedTable.request_id, input.requestID),
          ),
        )
        .get(),
    )
    if (!accepted) throw new Error(`Channel ingress request not found: ${input.requestID}`)
    assertCurrentOwner(accepted)
    const existing = findOutcome(accepted.id)
    if (existing) return ChannelIngressResult.parse(existing.result)
    const processOwner = joinProcessLiveness(currentRuntimeOccurrenceID())
    try {
      return await recoverAccepted(accepted, processOwner)
    } finally {
      processOwner.release()
    }
  }

  export function inspect(
    input: { platform: z.output<typeof ChannelId>; requestID: string } & z.input<typeof ChannelIngressInspectionQuery>,
  ) {
    const accepted = Database.use((db) =>
      db
        .select()
        .from(ChannelIngressAcceptedTable)
        .where(
          and(
            eq(ChannelIngressAcceptedTable.project_id, input.projectID ?? Instance.project.id),
            eq(ChannelIngressAcceptedTable.platform, input.platform),
            eq(ChannelIngressAcceptedTable.request_id, input.requestID),
          ),
        )
        .get(),
    )
    if (!accepted) throw new NotFoundError({ message: `Channel ingress request not found: ${input.requestID}` })
    return inspectAccepted(accepted, ChannelIngressInspectionQuery.parse(input))
  }

  export namespace TestHooks {
    export function replaceBeforeEffect(fn: () => void | Promise<void>) {
      const previous = beforeEffect
      beforeEffect = fn
      return {
        [Symbol.dispose]() {
          beforeEffect = previous
        },
      }
    }
    export function replaceAfterEffectBeforeOutcome(fn: () => void) {
      const previous = afterEffectBeforeOutcome
      afterEffectBeforeOutcome = fn
      return {
        [Symbol.dispose]() {
          afterEffectBeforeOutcome = previous
        },
      }
    }
  }

  async function executeMessage(input: z.output<typeof ChannelIngressInput>, effect: ChannelIngressEffect) {
    if (effect.kind === "interaction") return ChannelIngressResult.parse(await replyInteraction(effect, input.text))

    const result = await ControlMessage.handle(
      ControlMessageInput.parse({
        surface: input.platform,
        text: input.text,
        taskID: effect.taskID,
        model: input.model,
        channel: input.channel,
        thread: input.thread,
        user_id: input.user_id,
        request_id: input.request_id,
        source: input.source,
        allow_create: input.allow_create,
        // Forward channel attachments — without this, slack/feishu/etc.
        // file uploads disappear at the control-plane boundary before
        // panel.create_task / panel.send_task_message can do anything
        // with them. Each MessageAttachmentInput (`{filename, mime, url?,
        // data?}`) is normalized into ControlAttachment's required data-URL
        // form so the downstream control-plane LLM session sees the bytes
        // as multimodal file parts and panel.* tools can decode them
        // strictly via decodeDataUrlBase64.
        ...(input.attachments.length > 0 ? { attachments: input.attachments.map(toControlAttachment) } : {}),
      }),
    )
    return ChannelIngressResult.parse(result)
  }

  export async function resultText(result: z.infer<typeof ChannelIngressResult>): Promise<string> {
    return "message" in result ? result.message : controlFinalMessageText(result)
  }

  export function findBinding(platform: string, channel: string, thread: string) {
    return find(platform, channel, thread)
  }

  /**
   * Reverse lookup: every channel/thread binding pointing at the given
   * task. Powers the Gateway page's "selected task bindings" surface
   * (template §10) and any future audit that needs the inbound-message
   * provenance for a task. The `engine_channel_task_idx` index on
   * `task_id` keeps this O(matching rows) — typical tasks have 0-1
   * bindings so the query cost is negligible.
   */
  export function bindingsByTaskID(taskID: string) {
    if (!taskID)
      return [] as Array<{
        id: string
        task_id: string
        platform: string
        channel: string
        thread: string
        payload: Record<string, unknown> | null
        time_created: number | null
        time_updated: number | null
      }>
    return Database.use((db) =>
      db.select().from(EngineChannelBindingTable).where(eq(EngineChannelBindingTable.task_id, taskID)).all(),
    )
  }
}

function findOutcome(requestID: string) {
  return Database.use((db) =>
    db.select().from(ChannelIngressOutcomeTable).where(eq(ChannelIngressOutcomeTable.request_id, requestID)).get(),
  )
}

export class ChannelIngressOutcomeUnknownError extends Error {
  constructor(
    readonly requestID: string,
    readonly diagnostic?: ReturnType<typeof inspectAccepted>,
  ) {
    super(
      `Channel ingress request ${requestID} has an unknown outcome; original effect evidence is available for review`,
    )
    this.name = "ChannelIngressOutcomeUnknownError"
  }
  toObject() {
    return {
      name: this.name,
      data: {
        code: "CHANNEL_INGRESS_OUTCOME_UNKNOWN",
        requestID: this.requestID,
        message: this.message,
        diagnostic: this.diagnostic,
      },
    }
  }
}

export class ChannelIngressProcessingError extends Error {
  override readonly name = "ChannelIngressProcessingError"
  constructor(readonly diagnostic: ReturnType<typeof inspectAccepted>) {
    super(`Channel ingress request ${diagnostic.requestID} is owned by an active process`)
  }
  toObject() {
    return {
      name: this.name,
      data: { code: "CHANNEL_INGRESS_PROCESSING", message: this.message, diagnostic: this.diagnostic },
    }
  }
}

export class ChannelIngressOwnerConflictError extends Error {
  override readonly name = "ChannelIngressOwnerConflictError"
  constructor(readonly diagnostic: ReturnType<typeof inspectAccepted>) {
    super(`Channel ingress request ${diagnostic.requestID} belongs to an unavailable original Project occurrence`)
  }
  toObject() {
    return {
      name: this.name,
      data: { code: "CHANNEL_INGRESS_OWNER_CONFLICT", message: this.message, diagnostic: this.diagnostic },
    }
  }
}

export class ChannelIngressProjectContextConflictError extends Error {
  override readonly name = "ChannelIngressProjectContextConflictError"
  constructor(
    readonly context: {
      requestID: string
      projectID: string
      contextGeneration: string
      currentGeneration: string | null
    },
  ) {
    super(`Channel ingress Project ${context.projectID} execution context belongs to an unavailable occurrence`)
  }
  toObject() {
    return {
      name: this.name,
      data: { code: "CHANNEL_INGRESS_PROJECT_CONTEXT_CONFLICT", message: this.message, ...this.context },
    }
  }
}

function inspectAccepted(accepted: Accepted, query = ChannelIngressInspectionQuery.parse({})) {
  const current = Database.use((db) =>
    db
      .select({ generation: ProjectTable.generation })
      .from(ProjectTable)
      .where(eq(ProjectTable.id, accepted.project_id))
      .get(),
  )
  const raw = Database.use((db) => {
    const column =
      query.field === "outcome"
        ? ChannelIngressOutcomeTable.result
        : query.field === "effect"
          ? ChannelIngressAcceptedTable.effect
          : ChannelIngressAcceptedTable.input
    const fields = {
      total: sql<number>`coalesce(length(cast(${column} AS BLOB)),0)`,
      chunk: sql<Uint8Array | null>`substr(cast(${column} AS BLOB),${query.byteOffset + 1},4096)`,
    }
    return query.field === "outcome"
      ? db
          .select(fields)
          .from(ChannelIngressOutcomeTable)
          .where(eq(ChannelIngressOutcomeTable.request_id, accepted.id))
          .get()
      : db.select(fields).from(ChannelIngressAcceptedTable).where(eq(ChannelIngressAcceptedTable.id, accepted.id)).get()
  })
  const bytes = Buffer.from(raw?.chunk ?? [])
  const sources = Database.use((db) =>
    db
      .select({ occurrenceID: BusPublicationOutboxTable.occurrence_id, type: BusPublicationOutboxTable.event_type })
      .from(BusPublicationOutboxTable)
      .where(
        and(
          eq(BusPublicationOutboxTable.project_id, accepted.project_id),
          sql`json_extract(${BusPublicationOutboxTable.causation}, '$.source') = ${CHANNEL_CAUSATION_SOURCE}`,
          sql`json_extract(${BusPublicationOutboxTable.causation}, '$.occurrenceID') = ${accepted.id}`,
          query.afterSource ? gt(BusPublicationOutboxTable.occurrence_id, query.afterSource) : undefined,
        ),
      )
      .orderBy(asc(BusPublicationOutboxTable.occurrence_id))
      .limit(query.limit + 1)
      .all(),
  )
  return {
    acceptedID: accepted.id,
    requestID: accepted.request_id,
    platform: accepted.platform,
    projectID: accepted.project_id,
    projectGeneration: accepted.project_generation,
    currentProjectGeneration: current?.generation ?? null,
    owner:
      accepted.project_generation === null
        ? ("unknown" as const)
        : current?.generation === accepted.project_generation
          ? ("current" as const)
          : ("retired" as const),
    effect: accepted.effect?.kind ?? null,
    acceptedAt: accepted.time_created,
    outcomeRecorded: Database.use((db) =>
      Boolean(
        db
          .select({ id: ChannelIngressOutcomeTable.request_id })
          .from(ChannelIngressOutcomeTable)
          .where(eq(ChannelIngressOutcomeTable.request_id, accepted.id))
          .get(),
      ),
    ),
    body: {
      field: query.field,
      encoding: "base64" as const,
      byteOffset: query.byteOffset,
      totalBytes: raw?.total ?? 0,
      data: bytes.toString("base64"),
      nextByteOffset: query.byteOffset + bytes.length < (raw?.total ?? 0) ? query.byteOffset + bytes.length : null,
    },
    sourceOccurrences: sources.slice(0, query.limit),
    nextSource: sources.length > query.limit ? sources[query.limit - 1]!.occurrenceID : null,
    lease: Database.use((db) => currentControlLeaseInTransaction(db, "effect", accepted.id)) ?? null,
  }
}

function assertCurrentOwner(accepted: Accepted) {
  const current = Database.use((db) =>
    db
      .select({ generation: ProjectTable.generation })
      .from(ProjectTable)
      .where(eq(ProjectTable.id, accepted.project_id))
      .get(),
  )
  if (
    accepted.project_id !== Instance.project.id ||
    (accepted.project_generation !== null &&
      (current?.generation !== accepted.project_generation ||
        Instance.projectGeneration !== accepted.project_generation))
  )
    throw new ChannelIngressOwnerConflictError(inspectAccepted(accepted))
  if (accepted.project_generation === null)
    throw new ChannelIngressOutcomeUnknownError(accepted.request_id, inspectAccepted(accepted))
}

function selectEffect(input: z.output<typeof ChannelIngressInput>): {
  effect?: ChannelIngressEffect
  result?: z.output<typeof ChannelDirectResult>
} {
  const binding = find(input.platform, input.channel, input.thread)
  if (!binding && !input.allow_create) return { result: NO_BINDING_RESULT }
  const pending = binding ? listInteractions(binding.task_id).find((item) => item.status === "pending") : undefined
  if (!pending)
    return {
      effect: {
        kind: "control",
        ...((input.task_id ?? binding?.task_id) ? { taskID: input.task_id ?? binding?.task_id } : {}),
      },
    }
  if (pending.request_type === "permission" && permissionDecision(input.text) === undefined)
    return {
      result: {
        kind: "panel_response",
        message: "Permission reply not recognized. Reply with allow, always, or reject.",
        task_id: pending.task_id,
        interaction_id: pending.id,
      },
    }
  return {
    effect: {
      kind: "interaction",
      interactionID: pending.id,
      taskID: pending.task_id,
      sessionID: pending.session_id,
      requestID: pending.external_id,
      type: pending.request_type,
    },
  }
}

function permissionDecision(text: string) {
  const value = text.trim().toLowerCase()
  if (["allow", "approve", "yes", "y", "once"].includes(value)) return "allow_once" as const
  if (["always", "allow always", "approve always"].includes(value)) return "allow_project" as const
  if (["reject", "deny", "no", "n"].includes(value)) return "deny" as const
}

function originalInteraction(effect: Extract<ChannelIngressEffect, { kind: "interaction" }>) {
  const interaction = findInteraction(effect.interactionID)
  if (
    !interaction ||
    interaction.task_id !== effect.taskID ||
    interaction.session_id !== effect.sessionID ||
    interaction.external_id !== effect.requestID ||
    interaction.request_type !== effect.type
  )
    throw new Error(`Channel ingress original Interaction ${effect.interactionID} has conflicting request ownership`)
  return interaction
}

async function recoverEffect(accepted: Accepted): Promise<z.output<typeof ChannelIngressResult> | undefined> {
  if (!accepted.effect) return
  if (accepted.effect.kind === "control")
    return ControlMessage.recover({
      projectID: accepted.project_id,
      causation: { source: CHANNEL_CAUSATION_SOURCE, occurrenceID: accepted.id },
    })
  const effect = accepted.effect
  const interaction = originalInteraction(effect)
  if (effect.type === "permission") {
    const facts = Database.use((db) => readPermissionRequestFacts(db, effect.requestID))
    if (
      !facts?.authority ||
      facts.request.projectID !== accepted.project_id ||
      facts.request.taskID !== effect.taskID ||
      facts.request.sessionID !== effect.sessionID ||
      interaction.status === "pending"
    )
      return
    const message = permissionResolutionMessage({
      id: interaction.id,
      type: "permission",
      status: interaction.status,
      response: interaction.response,
    } as Awaited<ReturnType<typeof EngineService.replyUserInteraction>>)
    return { kind: "interaction", message, task_id: effect.taskID, interaction_id: effect.interactionID }
  }
  if (interaction.source_kind !== "bus_question") {
    if (
      interaction.source_kind !== null ||
      interaction.source_id !== null ||
      !interaction.payload.activity_reconciliation ||
      interaction.status !== "answered"
    )
      return
    const owner = Database.use((db) =>
      db
        .select({ projectID: EngineTaskTable.project_id })
        .from(EngineTaskTable)
        .where(eq(EngineTaskTable.id, effect.taskID))
        .get(),
    )
    if (owner?.projectID !== accepted.project_id) return
    const acknowledgement = z
      .object({
        answers: z.array(z.array(z.literal("acknowledge_unknown")).length(1)).length(1),
        user_input: z.object({
          surface: z.literal("channel.question"),
          text: z.string(),
          structured: z.object({ message: z.string() }),
        }),
      })
      .safeParse(interaction.response)
    if (
      !acknowledgement.success ||
      acknowledgement.data.user_input.text !== accepted.input.text ||
      acknowledgement.data.user_input.structured.message !== accepted.input.text
    )
      return
    return {
      kind: "interaction",
      message: "Answer recorded.",
      task_id: effect.taskID,
      interaction_id: effect.interactionID,
    }
  }
  const facts = Question.publicationFacts({
    projectID: accepted.project_id,
    sessionID: effect.sessionID,
    requestID: effect.requestID,
  })
  if (facts.terminal?.type !== "question.replied" || interaction.status !== "answered") return
  const terminal = Database.use((db) =>
    db
      .select()
      .from(BusPublicationOutboxTable)
      .where(eq(BusPublicationOutboxTable.occurrence_id, facts.terminal!.occurrenceID))
      .get(),
  )
  if (
    terminal?.causation?.source !== CHANNEL_CAUSATION_SOURCE ||
    terminal.causation.occurrenceID !== accepted.id ||
    facts.terminal.properties.userInput?.surface !== "channel.question" ||
    facts.terminal.properties.userInput.text !== accepted.input.text
  )
    return
  return {
    kind: "interaction",
    message: "Answer recorded.",
    task_id: effect.taskID,
    interaction_id: effect.interactionID,
  }
}

async function recoverAccepted(accepted: Accepted, processOwner: ReturnType<typeof joinProcessLiveness>) {
  assertCurrentOwner(accepted)
  const previousLease = Database.use((db) => currentControlLeaseInTransaction(db, "effect", accepted.id))
  let supersedeLeaseID: string | undefined
  const released =
    previousLease &&
    Database.use((db) => {
      const grant = db
        .select({ expiresAt: EngineControlActivationLeaseGrantTable.expires_at })
        .from(EngineControlActivationLeaseGrantTable)
        .where(eq(EngineControlActivationLeaseGrantTable.lease_id, previousLease.id))
        .orderBy(desc(EngineControlActivationLeaseGrantTable.ordinal))
        .get()
      return grant && previousLease.expires_at < grant.expiresAt
    })
  if (previousLease && !released) {
    let liveness: string
    try {
      liveness = observeProcessLiveness(previousLease.owner_occurrence_id)
    } catch {
      throw new ChannelIngressOutcomeUnknownError(accepted.request_id, inspectAccepted(accepted))
    }
    if (liveness !== "dead_or_reused") throw new ChannelIngressProcessingError(inspectAccepted(accepted))
    supersedeLeaseID = previousLease.id
  }
  const result = await recoverEffect(accepted)
  if (!result) throw new ChannelIngressOutcomeUnknownError(accepted.request_id, inspectAccepted(accepted))
  const claim = Database.immediateTransaction((db) => {
    assertCurrentOwner(accepted)
    const existing = db
      .select()
      .from(ChannelIngressOutcomeTable)
      .where(eq(ChannelIngressOutcomeTable.request_id, accepted.id))
      .get()
    if (existing) return { result: ChannelIngressResult.parse(existing.result) }
    processOwner.assertOwnedInTransaction(db, processOwner.occurrenceID)
    const current = currentControlLeaseInTransaction(db, "effect", accepted.id)
    if (current?.id !== previousLease?.id) throw new ChannelIngressProcessingError(inspectAccepted(accepted))
    const lease = acquireControlLeaseInTransaction(db, {
      target: "effect",
      targetID: accepted.id,
      ownerOccurrenceID: processOwner.occurrenceID,
      now: Date.now(),
      leaseMilliseconds: 120_000,
      supersedeLeaseID,
    })
    if (!lease.acquired) throw new ChannelIngressProcessingError(inspectAccepted(accepted))
    return { lease: lease.lease }
  })
  if (claim.result) return claim.result
  try {
    return settleOutcome(accepted, result, claim.lease!, processOwner.occurrenceID)
  } catch (error) {
    endOriginalLeaseOnError(accepted, claim.lease!, processOwner.occurrenceID)
    throw error
  }
}

function settleOutcome(
  accepted: Accepted,
  raw: z.output<typeof ChannelIngressResult>,
  lease: { id: string },
  ownerOccurrenceID: string,
) {
  const result = ChannelIngressResult.parse(raw)
  return Database.immediateTransaction((db) => {
    assertCurrentOwner(accepted)
    const existing = db
      .select()
      .from(ChannelIngressOutcomeTable)
      .where(eq(ChannelIngressOutcomeTable.request_id, accepted.id))
      .get()
    if (existing) {
      if (JSON.stringify(existing.result) !== JSON.stringify(result))
        throw new Error(`Channel ingress ${accepted.id} immutable outcome conflicts with original effect`)
      return ChannelIngressResult.parse(existing.result)
    }
    const now = Date.now()
    const settlementLease = currentOriginalLease(db, accepted, lease, ownerOccurrenceID, now)
    assertControlLeaseInTransaction(db, {
      target: "effect",
      targetID: accepted.id,
      leaseID: settlementLease.id,
      ownerOccurrenceID,
      now,
    })
    db.insert(ChannelIngressOutcomeTable).values({ request_id: accepted.id, result, time_created: now }).run()
    releaseControlLeaseInTransaction(db, {
      target: "effect",
      targetID: accepted.id,
      leaseID: settlementLease.id,
      ownerOccurrenceID,
      now,
    })
    return result
  })
}

function currentOriginalLease(
  db: Database.TxOrDb,
  accepted: Accepted,
  lease: { id: string },
  ownerOccurrenceID: string,
  now: number,
) {
  const current = currentControlLeaseInTransaction(db, "effect", accepted.id)
  if (current?.id !== lease.id || current.owner_occurrence_id !== ownerOccurrenceID)
    throw new ControlLeaseFenceLostError(`Channel ingress ${accepted.id} original lease was superseded`)
  if (current.expires_at > now) return current
  const acquired = acquireControlLeaseInTransaction(db, {
    target: "effect",
    targetID: accepted.id,
    ownerOccurrenceID,
    now,
    leaseMilliseconds: 120_000,
  })
  if (!acquired.acquired)
    throw new ControlLeaseFenceLostError(`Channel ingress ${accepted.id} settlement lease is owned by another caller`)
  return acquired.lease
}

function endOriginalLeaseOnError(accepted: Accepted, lease: { id: string }, ownerOccurrenceID: string) {
  try {
    Database.immediateTransaction((db) => {
      const current = currentControlLeaseInTransaction(db, "effect", accepted.id)
      if (current?.id !== lease.id || current.owner_occurrence_id !== ownerOccurrenceID) return
      const now = Date.now()
      const ending = currentOriginalLease(db, accepted, lease, ownerOccurrenceID, now)
      releaseControlLeaseInTransaction(db, {
        target: "effect",
        targetID: accepted.id,
        leaseID: ending.id,
        ownerOccurrenceID,
        now,
      })
    })
  } catch (error) {
    log.warn("Channel ingress effect lease could not be ended after its original failure", {
      acceptedID: accepted.id,
      leaseID: lease.id,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function permissionResolutionMessage(result: Awaited<ReturnType<typeof EngineService.replyUserInteraction>>): string {
  const decision = PermissionDecision.safeParse(result.response?.decision)
  if (
    !decision.success ||
    result.type !== "permission" ||
    result.status !== (decision.data === "deny" ? "rejected" : "answered")
  )
    throw new Error(`Permission interaction ${result.id} has no exact canonical decision response`)
  switch (decision.data) {
    case "allow_once":
      return "Permission granted (once)."
    case "allow_task":
      return "Permission granted for this task."
    case "allow_project":
      return "Permission granted for this exact scope in this project."
    case "deny":
      return "Permission rejected."
  }
}

async function replyInteraction(
  effect: Extract<ChannelIngressEffect, { kind: "interaction" }>,
  text: string,
): Promise<z.infer<typeof ChannelDirectResult>> {
  originalInteraction(effect)
  if (effect.type === "permission") {
    const decision = permissionDecision(text)
    if (!decision) throw new Error(`Channel ingress ${effect.interactionID} has no exact Permission choice`)
    const result = await EngineService.replyUserInteraction(effect.interactionID, {
      decision,
      message: text,
      userInput: { surface: "channel.permission", text, structured: { decision } },
    })
    return {
      kind: "interaction",
      message: permissionResolutionMessage(result),
      task_id: effect.taskID,
      interaction_id: result.id,
    }
  }

  const result = await EngineService.replyUserInteraction(effect.interactionID, {
    message: text,
    userInput: { surface: "channel.question", text, structured: { message: text } },
  })
  return { kind: "interaction", message: "Answer recorded.", task_id: effect.taskID, interaction_id: result.id }
}

function find(platform: string, channel: string, thread: string) {
  const row = Database.use((db) =>
    db
      .select({
        binding: EngineChannelBindingTable,
        project_id: EngineTaskTable.project_id,
      })
      .from(EngineChannelBindingTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineChannelBindingTable.task_id))
      .where(
        and(
          eq(EngineChannelBindingTable.platform, platform),
          eq(EngineChannelBindingTable.channel, channel),
          eq(EngineChannelBindingTable.thread, thread),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  if (row.project_id === "global") {
    throw new TaskGlobalProjectBindingError({
      message: `Channel binding ${platform}/${channel}/${thread} points to task ${row.binding.task_id} bound to project global. Task execution requires a concrete Git project.`,
      taskID: row.binding.task_id,
      projectID: row.project_id,
    })
  }
  if (row.project_id !== Instance.project.id) {
    throw new TaskChannelBindingProjectConflictError({
      message: `Channel binding ${platform}/${channel}/${thread} points to task ${row.binding.task_id} in project ${row.project_id}, but the active project is ${Instance.project.id}.`,
      platform,
      channel,
      thread,
      taskID: row.binding.task_id,
      projectID: row.project_id,
      activeProjectID: Instance.project.id,
    })
  }
  return row.binding
}

/**
 * Normalize a channel attachment into a ControlAttachment (data-URL form).
 *
 * - `data` field: build `data:<mime>;base64,<data>` so the control-plane LLM
 *   session and `panel.create_task` see the canonical strict shape.
 * - `url` already a data URL: pass through.
 * - Anything else (`http(s)://...`, `/attachment/...`, missing both fields):
 *   throw. Pre-fix, these silently became "the user's reference image" with
 *   garbage bytes once panel.* did its lenient base64 cast. Rule 7.
 */
function toControlAttachment(att: z.infer<typeof MessageAttachmentInput>): {
  mime: string
  url: string
  filename?: string
} {
  const filename = att.filename
  if (typeof att.data === "string" && att.data.length > 0) {
    return {
      mime: att.mime,
      url: `data:${att.mime};base64,${att.data}`,
      ...(filename ? { filename } : {}),
    }
  }
  if (typeof att.url === "string" && att.url.startsWith("data:")) {
    return {
      mime: att.mime,
      url: att.url,
      ...(filename ? { filename } : {}),
    }
  }
  throw new Error(
    `ChannelIngress attachment "${filename ?? att.mime}": expected base64 \`data\` field or \`url\` of form "data:<mime>;base64,<bytes>"; got ${
      typeof att.url === "string" && att.url.length > 60 ? `${att.url.slice(0, 60)}…` : JSON.stringify(att.url)
    }`,
  )
}
