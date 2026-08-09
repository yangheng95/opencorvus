import { VcsCommitMessageStreamEvent } from "@opencorvus-ai/transport-protocol"
import { publicUnknownStreamError } from "./error-handler"

export async function writeVcsCommitMessageStreamError(input: {
  stream: { writeSSE(event: { data: string }): Promise<unknown> }
  error: unknown
  requestID: string
  logError: (message: string, fields: { requestID: string; error: unknown }) => void
}) {
  input.logError("commit message stream failed", { requestID: input.requestID, error: input.error })
  const event = VcsCommitMessageStreamEvent.parse(publicUnknownStreamError())
  await input.stream.writeSSE({ data: JSON.stringify(event) })
  return event
}
