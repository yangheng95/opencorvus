import z from "zod"
import { ChannelSurface } from "@/channel/catalog"
import { isModelReference } from "@/provider/model-ref"
import { panelMessageStreamEventSchema } from "@opencorvus-ai/transport-protocol"

const STORED_ATTACHMENT_URL = /^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/

export const ControlLocalAction = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("select_task"),
      taskID: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("select_session"),
      sessionID: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("invalidate_session"),
      sessionID: z.string(),
    })
    .strict(),
])

export const ControlAttachment = z.object({
  mime: z.string(),
  url: z.string(),
  filename: z.string().optional(),
})

export const ControlStoredAttachment = ControlAttachment.extend({
  url: z
    .string()
    .regex(
      STORED_ATTACHMENT_URL,
      "Control result attachments must reference stored /attachment/<projectID>/<name> resources",
    ),
})

export const ControlToolResultRef = z
  .object({
    session_id: z.string(),
    message_id: z.string(),
    part_id: z.string(),
    call_id: z.string(),
    tool_name: z.string(),
  })
  .strict()

export const ControlMessageResult = z
  .object({
    kind: z.enum(["panel_response", "created", "message", "interaction", "progress", "task_list", "cancelled"]),
    message_id: z.string(),
    control_session_id: z.string(),
    tool_result_refs: ControlToolResultRef.array(),
    task_id: z.string().optional(),
    interaction_id: z.string().optional(),
    session_id: z.string().optional(),
    local_action: ControlLocalAction.optional(),
    attachments: ControlStoredAttachment.array().optional(),
  })
  .strict()

export const PanelMessageStreamEvent = panelMessageStreamEventSchema(ControlMessageResult)
export type PanelMessageStreamEvent = z.infer<typeof PanelMessageStreamEvent>

export const ControlMessageInput = z
  .object({
    surface: ChannelSurface,
    text: z.string(),
    taskID: z.string().optional(),
    sessionID: z.string().optional(),
    model: z
      .string()
      .refine(isModelReference, {
        message: 'Model must be in the format "provider/model".',
      })
      .optional(),
    channel: z.string().optional(),
    thread: z.string().optional(),
    user_id: z.string().optional(),
    request_id: z.string().optional(),
    source: z.string().optional(),
    allow_create: z.boolean().default(true),
    attachments: ControlAttachment.array().optional(),
  })
  .strict()
