import z from "zod"
import { Instance } from "@/project/instance"
import { requireMissionSession } from "@/mission/session"
import { MessageStore } from "@/session/message-store"
import { sendSchedulerMessage } from "@/protocol/scheduler-message"
import { taskSchedulerEndpoint } from "@/protocol/delivery"
import { Tool } from "./tool"

const Parameters = z
  .object({
    kind: z.enum(["request", "reply", "notification"]),
    task_id: z.string().min(1).optional(),
    reply_to: z.string().startsWith("pev").optional(),
    subject: z.string().min(1).max(500),
    message: z.string().min(1),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.kind === "reply") {
      if (!input.reply_to) context.addIssue({ code: "custom", message: "reply requires reply_to" })
      if (input.task_id) context.addIssue({ code: "custom", message: "reply target is derived from reply_to" })
    } else {
      if (!input.task_id) context.addIssue({ code: "custom", message: `${input.kind} requires task_id` })
      if (input.reply_to) context.addIssue({ code: "custom", message: "only reply may set reply_to" })
    }
  })

async function exactToolPart(ctx: Tool.Context) {
  if (!ctx.callID) throw new Error(`scheduler_message requires its persisted tool-call identity.`)
  const message = await MessageStore.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
  const partID = typeof ctx.extra?.toolPartID === "string" ? ctx.extra.toolPartID : undefined
  const matches = message.parts.filter(
    (part) => part.type === "tool" && part.callID === ctx.callID && (!partID || part.id === partID),
  )
  if (matches.length !== 1) {
    throw new Error(`scheduler_message requires one exact persisted tool Part; found ${matches.length}.`)
  }
  const part = matches[0]!
  if (part.type !== "tool" || part.tool !== "scheduler_message") {
    throw new Error(`scheduler_message call ${ctx.callID} is not owned by the scheduler_message Tool Part.`)
  }
  return part
}

export const SchedulerMessageTool = Tool.define("scheduler_message", {
  description:
    "Send one durable scheduler message. Use request for a question/directive to an owned Task, reply with the exact request event_id, and notification for a one-way update. This is the only Mission-to-Task scheduler communication path; replies preserve the original thread automatically.",
  parameters: Parameters,
  async execute(input, ctx) {
    const mission = await requireMissionSession(ctx.sessionID)
    const part = await exactToolPart(ctx)
    const receipt = await sendSchedulerMessage({
      invocationID: `scheduler-message:${ctx.sessionID}:${ctx.messageID}:${ctx.callID}`,
      kind: input.kind,
      source: {
        kind: "mission_scheduler",
        project_id: Instance.project.id,
        mission_id: mission.missionID,
        session_id: mission.id,
      },
      ...(input.task_id ? { target: taskSchedulerEndpoint(input.task_id) } : {}),
      ...(input.reply_to ? { replyTo: input.reply_to } : {}),
      subject: input.subject,
      sourceMessageID: ctx.messageID,
      sourcePartID: part.id,
    })
    return {
      title: `scheduler_message ${input.kind}`,
      output: JSON.stringify(receipt),
      metadata: receipt,
    }
  },
})
