import { clearRewindCursorForSession } from "@/engine/rewind"
import { CapabilityRules } from "@/capability/rules"
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
  persistMaterializedUserMessageInTransaction,
  prepareUserMessage,
  type PersistedUserMessageReceipt,
  type PreparedUserMessageRuntimeClaim,
  type UserMessagePersistenceHooks,
} from "./parts"
import type { PromptInput } from "./schema"
import type { Message } from "../message"
import { setSessionTitleFromFirstUserMessage } from "../first-message-title"
import { Database } from "@/storage/db"

export type PromptRuntimeHooks = UserMessagePersistenceHooks & {
  beforeLoop?: (signal?: AbortSignal) => void | Promise<void>
  signal?: AbortSignal
  runtimeClaim?: PreparedUserMessageRuntimeClaim
}

export type NoReplyUserMessageSequenceEntry = {
  input: PromptInput
  hooks?: Omit<UserMessagePersistenceHooks, "prepared">
}

/**
 * Publish a bounded sequence of real user Messages as one durable visibility
 * cut. This is reserved for host-authored participant sequences that must be
 * visible together before a runtime wake is allowed to start generation.
 */
export async function persistNoReplyUserMessageSequence(
  entries: readonly NoReplyUserMessageSequenceEntry[],
): Promise<Message.WithParts[]> {
  if (entries.length === 0) throw new Error("No-reply user Message sequence must not be empty")
  const sessionID = entries[0]!.input.sessionID
  for (const entry of entries) {
    if (entry.input.sessionID !== sessionID) {
      throw new Error("No-reply user Message sequence must target exactly one Session")
    }
    if (entry.input.noReply !== true) {
      throw new Error(`No-reply user Message sequence entry for Session ${sessionID} must set noReply=true`)
    }
    if (entry.input.tools && Object.keys(entry.input.tools).length > 0) {
      throw new Error(`No-reply user Message sequence cannot mutate Session capability rules`)
    }
  }

  const prepared = [await prepareUserMessage(entries[0]!.input)]
  using runtimeClaim = claimPreparedUserMessageRuntime(prepared[0]!)
  for (const entry of entries.slice(1)) prepared.push(await prepareUserMessage(entry.input))

  const materialized: Awaited<ReturnType<typeof materializeUserMessage>>[] = []
  for (let index = 0; index < entries.length; index++) {
    materialized.push(await materializeUserMessage(entries[index]!.input, { prepared: prepared[index]! }))
  }

  const persisted = Database.immediateTransaction(() =>
    materialized.map((message, index) => {
      const hooks = entries[index]!.hooks
      return persistMaterializedUserMessageInTransaction(message, {
        ...hooks,
        commitBundle: hooks?.commitBundle ?? (() => undefined),
      })
    }),
  )
  const messages: Message.WithParts[] = []
  for (let index = 0; index < persisted.length; index++) {
    const receipt = await persisted[index]!.complete()
    messages.push(consumePersistedUserMessageReceipt(entries[index]!.input, receipt))
  }

  await clearRewindCursorForSession(sessionID)
  for (const message of messages) {
    await setSessionTitleFromFirstUserMessage({
      sessionID,
      messageID: message.info.id,
      parts: message.parts,
    })
  }
  await Session.touch(sessionID)
  return messages
}

async function continueUserMessage(
  input: PromptInput,
  message: Message.WithParts,
  runtime: PromptRuntimeHooks & {
    loop: (input: { sessionID: string; reply_to_message_id: string }) => Promise<Message.WithParts>
  },
) {
  const prepared = consumePreparedUserMessage(input, runtime.prepared ?? (await prepareUserMessage(input)))
  // A message-write claim protects only the atomic user-message commit.  A
  // persisted input must be able to attach to the existing Session owner while
  // that owner is streaming an earlier input; retaining this claim across the
  // physical model turn would turn the runtime-contract guard into a hidden
  // per-Session admission gate.
  if (runtime.runtimeClaim) {
    using _runtimeWrite = consumePreparedUserMessageRuntimeClaim(prepared, runtime.runtimeClaim)
  }
  const session = await Session.get(input.sessionID)
  await clearRewindCursorForSession(session.id)
  return await SessionContext.provide(session, async () => {
    await setSessionTitleFromFirstUserMessage({
      sessionID: input.sessionID,
      messageID: message.info.id,
      parts: message.parts,
    })
    await Session.touch(input.sessionID)

    const permissions: CapabilityRules.Ruleset = []
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
