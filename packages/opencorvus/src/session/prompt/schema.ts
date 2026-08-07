import z from "zod"
import { Identifier } from "../../id/id"
import { Message } from "../message"

export const PromptInput = z
  .object({
    sessionID: Identifier.schema("session"),
    messageID: Identifier.schema("message").optional(),
    model: z
      .object({
        providerID: z.string(),
        modelID: z.string(),
      })
      .optional(),
    agent: z.string().optional(),
    author: z.string().min(1),
    noReply: z.boolean().optional(),
    tools: z.record(z.string(), z.boolean()).optional(),
    includeMcpTools: z.boolean().optional(),
    format: Message.Format.optional(),
    variant: z.string().optional(),
    extra: z.record(z.string(), z.any()).optional(),
    byteMaterializationProjectID: z.string().min(1).optional(),
    parts: z.array(
      z.discriminatedUnion("type", [
        Message.TextPart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "TextPartInput",
          }),
        Message.FilePart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .meta({
            ref: "FilePartInput",
          }),
      ]),
    ),
  })
  .strict()
export type PromptInput = z.infer<typeof PromptInput>
