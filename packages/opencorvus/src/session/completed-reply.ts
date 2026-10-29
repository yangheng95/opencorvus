import { Message } from "./message"
import { MessageStore } from "./message-store"
import { toolResultControl } from "./tool-result-control"
import { sql, type SQL } from "drizzle-orm"
import { TOOL_RESULT_CONTROL_METADATA_KEY } from "./tool-result-control"

/** Storage projection of this module's reply boundary. Scheduler readers use
 * the same final-step, accepted-input and typed-control semantics as the loop.
 * Tool completion alone is a step receipt, never a reply receipt. */
export function completedReplyPredicateSql(input: {
  data: SQL
  messageID: SQL
  userMessageID: SQL
  includeFailedReply?: boolean
}): SQL {
  const control = sql`json_extract(reply_control_outcome.data, ${`$.metadata.${TOOL_RESULT_CONTROL_METADATA_KEY}`})`
  const committedControl = sql`EXISTS (
    SELECT 1 FROM tool_part_request AS reply_control_request
    JOIN tool_part_outcome AS reply_control_outcome ON reply_control_outcome.request_part_id=reply_control_request.id
    WHERE reply_control_request.message_id=${input.messageID}
      AND json_extract(reply_control_outcome.data,'$.outcome')='completed'
      AND json_type(reply_control_outcome.data,${`$.metadata.${TOOL_RESULT_CONTROL_METADATA_KEY}`})='object'
      AND (
        (json_extract(${control},'$.kind')='immediate_park' AND (SELECT count(*) FROM json_each(${control}))=1)
        OR (json_extract(${control},'$.kind')='handoff_drain' AND (SELECT count(*) FROM json_each(${control}))=3
          AND json_type(${control},'$.request_id')='text' AND length(json_extract(${control},'$.request_id'))>0
          AND json_type(${control},'$.dispatch_lineage_id')='text' AND length(json_extract(${control},'$.dispatch_lineage_id'))>0)
      )
  )`
  return sql`(
    json_extract(${input.data},'$.role')='assistant'
    AND (
      (json_type(${input.data},'$.acceptedInputMessageIDs') IS NULL AND json_extract(${input.data},'$.parentID')=${input.userMessageID})
      OR (json_type(${input.data},'$.acceptedInputMessageIDs')='array' AND EXISTS (
        SELECT 1 FROM json_each(${input.data},'$.acceptedInputMessageIDs') AS reply_input
        WHERE reply_input.type='text' AND reply_input.value=${input.userMessageID}
      ))
    )
    AND json_extract(${input.data},'$.time.completed') IS NOT NULL
    AND json_type(${input.data},'$.finish')='text' AND length(json_extract(${input.data},'$.finish'))>0
    AND (json_extract(${input.data},'$.finish')<>'tool-calls' OR ${committedControl})
    AND coalesce(json_extract(${input.data},'$.summary'),0)<>1
    ${input.includeFailedReply ? sql`` : sql`AND json_extract(${input.data},'$.finish')<>'error' AND json_type(${input.data},'$.error') IS NULL`}
  )`
}

/** A completed business error settles its wake. Only the runtime's exact
 * process-interruption receipt leaves physical recovery work. */
export function settledRecoveryReplyPredicateSql(input: {
  data: SQL
  messageID: SQL
  userMessageID: SQL
}): SQL {
  return sql`(
    ${completedReplyPredicateSql({ ...input, includeFailedReply: true })}
    AND NOT coalesce((
      json_extract(${input.data}, '$.finish') = 'error'
      AND json_extract(${input.data}, '$.error.name') = 'ProcessExecutionInterruptedError'
      AND json_type(${input.data}, '$.error') = 'object'
      AND (SELECT count(*) FROM json_each(json_extract(${input.data}, '$.error'))) = 2
      AND json_type(${input.data}, '$.error.data') = 'object'
      AND (SELECT count(*) FROM json_each(json_extract(${input.data}, '$.error.data'))) = 1
      AND json_type(${input.data}, '$.error.data.message') = 'text'
      AND length(json_extract(${input.data}, '$.error.data.message')) > 0
    ), 0)
  )`
}

export function isSettledReplyToUserMessage(
  message: Message.WithParts,
  userMessageID: string,
): message is Message.WithParts & { info: Message.Assistant } {
  const committedTurnControl = message.parts.some(
    (part) =>
      part.type === "tool" && part.state.status === "completed" && toolResultControl(part.state.metadata) !== undefined,
  )
  return (
    message.info.role === "assistant" &&
    Message.acceptsInputMessage(message.info, userMessageID) &&
    message.info.time.completed !== undefined &&
    Boolean(message.info.finish) &&
    (message.info.finish !== "tool-calls" || committedTurnControl) &&
    message.info.summary !== true
  )
}

export function isCompletedReplyToUserMessage(
  message: Message.WithParts,
  userMessageID: string,
): message is Message.WithParts & { info: Message.Assistant } {
  return (
    isSettledReplyToUserMessage(message, userMessageID) &&
    message.info.finish !== "error" &&
    message.info.error === undefined
  )
}

export async function completedReplyToUserMessage(
  sessionID: string,
  userMessageID: string,
  includeFailedReply: boolean,
): Promise<Message.WithParts | undefined> {
  for await (const message of MessageStore.stream(sessionID)) {
    if (
      isCompletedReplyToUserMessage(message, userMessageID) ||
      (includeFailedReply && isSettledReplyToUserMessage(message, userMessageID))
    ) {
      return message
    }
    if (message.info.id === userMessageID) return undefined
  }
  return undefined
}
