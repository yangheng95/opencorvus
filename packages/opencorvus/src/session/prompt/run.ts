import { clearRewindCursorForSession } from "@/engine/rewind"
import { PermissionNext } from "@/permission/next"
import { provideInitializedProjectExecution } from "../../project/independent-project-owner"
import { Session } from ".."
import { SessionContext } from "../context"
import {
  consumePreparedUserMessage,
  consumePreparedUserMessageRuntimeClaim,
  consumePersistedUserMessageReceipt,
  claimPreparedUserMessageRuntime,
  materializeUserMessage,
  persistMaterializedUserMessage,
  prepareUserMessage,
  type PersistedUserMessageReceipt,
  type PreparedUserMessageRuntimeClaim,
  type UserMessagePersistenceHooks,
} from "./parts"
import type { PromptInput } from "./schema"
import type { Message } from "../message"
import { setSessionTitleFromFirstUserMessage } from "../first-message-title"

export type PromptRuntimeHooks = UserMessagePersistenceHooks & {
  beforeLoop?: (signal?: AbortSignal) => void | Promise<void>
  signal?: AbortSignal
  runtimeClaim?: PreparedUserMessageRuntimeClaim
}

async function continueUserMessage(
  input: PromptInput,
  message: Message.WithParts,
  runtime: PromptRuntimeHooks & {
    loop: (input: { sessionID: string; reply_to_message_id: string }) => Promise<Message.WithParts>
  },
) {
  const prepared = consumePreparedUserMessage(input, runtime.prepared ?? (await prepareUserMessage(input)))
  using _runtimeWrite = runtime.runtimeClaim
    ? consumePreparedUserMessageRuntimeClaim(prepared, runtime.runtimeClaim)
    : claimPreparedUserMessageRuntime(prepared)
  const session = await Session.get(input.sessionID)
  await clearRewindCursorForSession(session.id)
  return await SessionContext.provide(session, async () => {
    await setSessionTitleFromFirstUserMessage({
      sessionID: input.sessionID,
      messageID: message.info.id,
      parts: message.parts,
    })
    await Session.touch(input.sessionID)

    const permissions: PermissionNext.Ruleset = []
    for (const [tool, enabled] of Object.entries(input.tools ?? {})) {
      permissions.push({
        permission: tool,
        action: enabled ? "allow" : "deny",
        pattern: "*",
      })
    }
    if (permissions.length > 0) {
      session.permission = permissions
      await Session.setPermission({ sessionID: session.id, permission: permissions })
    }

    if (input.noReply === true) {
      return message
    }

    runtime.signal?.throwIfAborted()
    const beforeLoop = runtime.beforeLoop?.(runtime.signal)
    if (beforeLoop) await beforeLoop
    runtime.signal?.throwIfAborted()
    return provideInitializedProjectExecution({
      directory: session.directory,
      signal: runtime.signal,
      fn: () => runtime.loop({ sessionID: input.sessionID, reply_to_message_id: message.info.id }),
    })
  })
}

export async function continuePersistedUserMessage(
  input: PromptInput,
  receipt: PersistedUserMessageReceipt,
  runtime: PromptRuntimeHooks & {
    loop: (input: { sessionID: string; reply_to_message_id: string }) => Promise<Message.WithParts>
  },
) {
  const message = consumePersistedUserMessageReceipt(input, receipt)
  if (
    message.info.role !== "user" ||
    message.info.sessionID !== input.sessionID ||
    (input.messageID !== undefined && message.info.id !== input.messageID)
  ) {
    throw new Error(`Persisted user message does not match prompt input for session ${input.sessionID}`)
  }
  return continueUserMessage(input, message, runtime)
}

export async function runSessionPrompt(
  input: PromptInput,
  runtime: PromptRuntimeHooks & {
    loop: (input: { sessionID: string; reply_to_message_id: string }) => Promise<Message.WithParts>
  },
) {
  const prepared = consumePreparedUserMessage(input, runtime.prepared ?? (await prepareUserMessage(input)))
  using runtimeClaim = claimPreparedUserMessageRuntime(prepared)
  const materialized = await materializeUserMessage(input, { prepared })
  const receipt = await persistMaterializedUserMessage(materialized, runtime)
  return await continuePersistedUserMessage(input, receipt, {
    ...runtime,
    prepared,
    runtimeClaim,
    loop: runtime.loop,
  })
}
