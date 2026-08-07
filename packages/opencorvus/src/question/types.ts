import z from "zod"
import { Identifier } from "@/id/id"

/**
 * Pure zod schemas for question data shapes — extracted from
 * `question/index.ts` so that consumers who only need the schemas (e.g.
 * `engine/model.ts`) don't pull in the full Question module's runtime
 * dependencies (`@/bus`, `@/project/instance`, etc.).
 *
 * Same rationale as `snapshot/types.ts`: a barrel-loaded module that only
 * needs a schema must not be forced through the runtime module's import
 * chain, which can transitively load `Instance.state(...)` callsites before
 * Instance has finished its own init.
 *
 * `question/index.ts` re-exports these inside its `Question` namespace so
 * existing `Question.Option` / `Question.Info` / `Question.Request` /
 * `Question.Answer` callsites work unchanged.
 */

export const Option = z
  .object({
    value: z.string().describe("Stable value returned when this option is selected"),
    label: z.string().describe("Display text (1-5 words, concise)"),
    description: z.string().describe("Explanation of choice"),
    disabled: z.boolean().optional().describe("Display this option as unavailable and prevent selection"),
  })
  .meta({
    ref: "QuestionOption",
  })
export type Option = z.infer<typeof Option>

export const Info = z
  .object({
    question: z.string().describe("Complete question"),
    header: z.string().describe("Very short label (max 30 chars)"),
    options: z.array(Option).describe("Available choices"),
    multiple: z.boolean().optional().describe("Allow selecting multiple choices"),
    custom: z.boolean().optional().describe("Allow typing a custom answer"),
  })
  .meta({
    ref: "QuestionInfo",
  })
export type Info = z.infer<typeof Info>

export const Answer = z.array(z.string()).meta({
  ref: "QuestionAnswer",
})
export type Answer = z.infer<typeof Answer>

export const Expiry = z
  .object({
    origin: z.literal("deadline"),
    timeoutMs: z.number().int().positive().describe("Configured unanswered-question deadline in milliseconds"),
    timeExpires: z.number().int().positive().describe("Absolute unanswered-question deadline in Unix milliseconds"),
  })
  .meta({ ref: "QuestionExpiry" })
export type Expiry = z.infer<typeof Expiry>

export const Request = z
  .object({
    id: Identifier.schema("question"),
    sessionID: Identifier.schema("session"),
    timeCreated: z.number().int().positive(),
    questions: z.array(Info).describe("Questions to ask"),
    tool: z
      .object({
        messageID: z.string(),
        callID: z.string(),
      })
      .optional(),
    automatic: z
      .object({
        answers: z.array(Answer).describe("Default answers submitted when the deadline expires"),
        timeoutMs: z.number().int().positive().describe("Configured automatic-answer delay in milliseconds"),
        timeExpires: z.number().int().positive().describe("Absolute automatic-answer deadline in Unix milliseconds"),
      })
      .optional()
      .describe("Explicit automatic answer contract for this question request"),
    expiry: Expiry.optional().describe("Automatic unanswered-question expiry fixed when this request is created"),
  })
  .meta({
    ref: "QuestionRequest",
  })
export type Request = z.infer<typeof Request>
