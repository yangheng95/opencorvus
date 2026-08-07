// Upstream source: anomalyco/opencode packages/core/src/github-copilot/responses/openai-error.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import { z } from "zod/v4"
import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils"

export const openaiErrorDataSchema = z.object({
  error: z.object({
    message: z.string(),

    // The additional information below is handled loosely to support
    // OpenAI-compatible providers that have slightly different error
    // responses:
    type: z.string().nullish(),
    param: z.any().nullish(),
    code: z.union([z.string(), z.number()]).nullish(),
  }),
})

export type OpenAIErrorData = z.infer<typeof openaiErrorDataSchema>

export const openaiFailedResponseHandler: any = createJsonErrorResponseHandler({
  errorSchema: openaiErrorDataSchema,
  errorToMessage: (data) => data.error.message,
})
