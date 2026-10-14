import { VcsCommitMessageStreamEvent } from "@opencorvus-ai/transport-protocol"
import { publicUnknownStreamError } from "./error-handler"
import { MissingModelConfigError } from "@/config/model-resolution-error"

export async function writeVcsCommitMessageStreamError(input: {
  stream: { writeSSE(event: { data: string }): Promise<unknown> }
  error: unknown
  requestID: string
  logError: (message: string, fields: { requestID: string; error: unknown }) => void
}) {
  input.logError("commit message stream failed", { requestID: input.requestID, error: input.error })
  const event = VcsCommitMessageStreamEvent.parse(
    input.error instanceof MissingModelConfigError
      ? {
          type: "error",
          code: "model_not_configured",
          message: "Configure a model for this project, or enter the commit message manually.",
        }
      : { ...publicUnknownStreamError(), code: "generation_failed" },
  )
  await input.stream.writeSSE({ data: JSON.stringify(event) })
  return event
}
