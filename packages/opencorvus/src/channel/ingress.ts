import { EngineChannelBindingTable, EngineTaskTable } from "@/engine/engine.sql"
import { TaskChannelBindingProjectConflictError, TaskGlobalProjectBindingError } from "@/engine/task-project-error"
import { EngineService } from "@/task-api"
import { ControlMessage, controlFinalMessageText } from "@/control/message"
import { ControlMessageInput, ControlMessageResult } from "@/control/message-schema"
import { Database, and, eq } from "@/storage/db"
import { Identifier } from "@/id/id"
import { acquireControlLease, assertControlLeaseInTransaction, releaseControlLease, releaseControlLeaseInTransaction, releaseControlLeaseOnErrorPath } from "@/engine/control-lease"
import { Instance } from "@/project/instance"
import z from "zod"
import { ChannelId } from "./catalog"
import { isModelReference } from "@/provider/model-ref"
import { ChannelIngressAcceptedTable, ChannelIngressOutcomeTable } from "./channel.sql"

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

export namespace ChannelIngress {
  let afterEffectBeforeOutcome: (() => void) | undefined

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
    const accepted = Database.immediateTransaction((db) => {
      const current = db.select().from(ChannelIngressAcceptedTable)
        .where(eq(ChannelIngressAcceptedTable.id, acceptedID)).get()
      if (current) {
        if (JSON.stringify(current.input) !== serialized) {
          throw new Error(`Channel ingress request ${input.request_id} replay changed its payload`)
        }
        return { row: current, created: false }
      }
      const row = {
        id: acceptedID,
        project_id: Instance.project.id,
        platform: input.platform,
        request_id: input.request_id,
        input: JSON.parse(serialized) as Record<string, unknown>,
        time_created: Date.now(),
      }
      db.insert(ChannelIngressAcceptedTable).values(row).run()
      return { row, created: true }
    })
    const outcome = findOutcome(accepted.row.id)
    if (outcome) return ChannelIngressResult.parse(outcome.result)
    if (!accepted.created) throw new ChannelIngressOutcomeUnknownError(input.request_id)
    const owner = Identifier.ascending("call")
    const now = Date.now()
    const lease = acquireControlLease({
      target: "effect",
      targetID: accepted.row.id,
      ownerOccurrenceID: owner,
      now,
      leaseMilliseconds: 120_000,
    })
    if (!lease.acquired) throw new ChannelIngressOutcomeUnknownError(input.request_id)
    let result: z.output<typeof ChannelIngressResult>
    try {
      result = await executeMessage(input)
    } catch (error) {
      // This request has no outcome and this process is no longer executing
      // it. Holding the lease would make the whole lease duration the retry
      // period and leave `reconcile` unable to take the request, so ownership
      // goes back before the failure propagates.
      releaseControlLeaseOnErrorPath({
        target: "effect",
        targetID: accepted.row.id,
        leaseID: lease.lease.id,
        ownerOccurrenceID: owner,
        now: Date.now(),
      })
      throw error
    }
    afterEffectBeforeOutcome?.()
    Database.immediateTransaction((db) => {
      const settledAt = Date.now()
      assertControlLeaseInTransaction(db, {
        target: "effect",
        targetID: accepted.row.id,
        leaseID: lease.lease.id,
        ownerOccurrenceID: owner,
        now: settledAt,
      })
      db.insert(ChannelIngressOutcomeTable).values({
        request_id: accepted.row.id,
        result,
        time_created: settledAt,
      }).run()
      // The outcome is the terminal receipt. Its lease ends with it.
      releaseControlLeaseInTransaction(db, {
        target: "effect",
        targetID: accepted.row.id,
        leaseID: lease.lease.id,
        ownerOccurrenceID: owner,
        now: settledAt,
      })
    })
    return result
  }

  export function reconcile(input: {
    platform: z.output<typeof ChannelId>
    requestID: string
    result: z.input<typeof ChannelIngressResult>
  }): z.output<typeof ChannelIngressResult> {
    const accepted = Database.use((db) => db.select().from(ChannelIngressAcceptedTable).where(and(
      eq(ChannelIngressAcceptedTable.project_id, Instance.project.id),
      eq(ChannelIngressAcceptedTable.platform, input.platform),
      eq(ChannelIngressAcceptedTable.request_id, input.requestID),
    )).get())
    if (!accepted) throw new Error(`Channel ingress request not found: ${input.requestID}`)
    const result = ChannelIngressResult.parse(input.result)
    Database.immediateTransaction((db) => {
      const existing = db.select().from(ChannelIngressOutcomeTable)
        .where(eq(ChannelIngressOutcomeTable.request_id, accepted.id)).get()
      if (existing) {
        if (JSON.stringify(existing.result) !== JSON.stringify(result)) {
          throw new Error(`Channel ingress request ${input.requestID} reconciliation changed its result`)
        }
        return
      }
      db.insert(ChannelIngressOutcomeTable).values({
        request_id: accepted.id,
        result,
        time_created: Date.now(),
      }).run()
    })
    return result
  }

  export namespace TestHooks {
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

  async function executeMessage(input: z.output<typeof ChannelIngressInput>) {
    const binding = find(input.platform, input.channel, input.thread)
    if (!binding && !input.allow_create) {
      return ChannelIngressResult.parse({
        kind: "panel_response",
        message: "No task is bound to this channel thread. Start a new thread to create a task.",
      })
    }

    // Deterministic interaction reply: if the bound task has a pending
    // interaction, route the message directly instead of going through LLM.
    if (binding) {
      const result = await tryReplyInteraction(binding.task_id, input.text)
      if (result) return ChannelIngressResult.parse(result)
    }

    const result = await ControlMessage.handle(
      ControlMessageInput.parse({
        surface: input.platform,
        text: input.text,
        taskID: input.task_id ?? binding?.task_id ?? undefined,
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

  export function bindThread(input: {
    platform: string
    channel: string
    thread: string
    taskID: string
    payload?: Record<string, unknown>
  }) {
    const { EngineChannelBindingTable: T } = require("@/engine/engine.sql")
    const { Identifier } = require("@/id/id")
    Database.use((db) => {
      const existing = db
        .select({ task_id: T.task_id })
        .from(T)
        .where(and(eq(T.platform, input.platform), eq(T.channel, input.channel), eq(T.thread, input.thread)))
        .get()
      const now = Date.now()
      if (existing) {
        db.update(T)
          .set({ task_id: input.taskID, payload: input.payload ?? {}, time_updated: now })
          .where(and(eq(T.platform, input.platform), eq(T.channel, input.channel), eq(T.thread, input.thread)))
          .run()
      } else {
        db.insert(T)
          .values({
            id: Identifier.ascending("binding"),
            task_id: input.taskID,
            platform: input.platform,
            channel: input.channel,
            thread: input.thread,
            payload: input.payload ?? {},
            time_created: now,
            time_updated: now,
          })
          .run()
      }
    })
  }
}

function findOutcome(requestID: string) {
  return Database.use((db) =>
    db.select().from(ChannelIngressOutcomeTable).where(eq(ChannelIngressOutcomeTable.request_id, requestID)).get(),
  )
}

export class ChannelIngressOutcomeUnknownError extends Error {
  constructor(readonly requestID: string) {
    super(`Channel ingress request ${requestID} has an unknown outcome and requires reconciliation`)
    this.name = "ChannelIngressOutcomeUnknownError"
  }
}

async function tryReplyInteraction(
  taskID: string,
  text: string,
): Promise<z.infer<typeof ChannelDirectResult> | undefined> {
  const interactions = await EngineService.listTaskInteractions(taskID)
  const pending = interactions.find((item) => item.status === "pending")
  if (!pending) return undefined

  const value = text.trim().toLowerCase()
  if (pending.type === "permission") {
    if (["allow", "approve", "yes", "y", "once"].includes(value)) {
      const result = await EngineService.replyUserInteraction(pending.id, {
        decision: "allow_once",
        message: text,
        userInput: { surface: "channel.permission", text, structured: { decision: "allow_once" } },
      })
      return { kind: "interaction", message: "Permission granted.", task_id: taskID, interaction_id: result.id }
    }
    if (["always", "allow always", "approve always"].includes(value)) {
      const result = await EngineService.replyUserInteraction(pending.id, {
        decision: "allow_project",
        message: text,
        userInput: { surface: "channel.permission", text, structured: { decision: "allow_project" } },
      })
      return {
        kind: "interaction",
        message: "Permission granted (always).",
        task_id: taskID,
        interaction_id: result.id,
      }
    }
    if (["reject", "deny", "no", "n"].includes(value)) {
      const result = await EngineService.rejectUserInteraction(pending.id, {
        message: text,
        userInput: { surface: "channel.permission", text, structured: { decision: "deny" } },
      })
      return { kind: "interaction", message: "Permission rejected.", task_id: taskID, interaction_id: result.id }
    }
    return {
      kind: "panel_response",
      message: "Permission reply not recognized. Reply with allow, always, or reject.",
      task_id: taskID,
      interaction_id: pending.id,
    }
  }

  // Question interaction — pass message text; service will derive answers
  const result = await EngineService.replyUserInteraction(pending.id, {
    message: text,
    userInput: { surface: "channel.question", text, structured: { message: text } },
  })
  return { kind: "interaction", message: "Answer recorded.", task_id: taskID, interaction_id: result.id }
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
