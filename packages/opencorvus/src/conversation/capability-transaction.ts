import type { InstanceInit } from "@/project/instance-context"
import { Context } from "@/util/context"
import { Lock } from "@/util/lock"

const CONVERSATION_CAPABILITY_REFERENCE_LOCK = "native-conversation-capability-reference"
const initializerPreflights = new WeakMap<InstanceInit, () => Promise<unknown>>()
const conversationCapabilityTransactionContext = Context.create<boolean>("conversation-capability-transaction")
const conversationCapabilityReferenceReadContext = Context.create<boolean>("conversation-capability-reference-read")

export function withConversationCapabilityReferenceMutation<T>(run: () => Promise<T>): Promise<T> {
  if (conversationCapabilityTransactionContext.tryUse()) return run()
  if (conversationCapabilityReferenceReadContext.tryUse()) {
    throw new Error("Cannot mutate native conversation capability references while holding a reference read.")
  }
  return (async () => {
    using _lock = await Lock.write(CONVERSATION_CAPABILITY_REFERENCE_LOCK)
    return conversationCapabilityTransactionContext.provide(true, run)
  })()
}

export function withConversationCapabilityReferenceRead<T>(run: () => Promise<T>): Promise<T> {
  if (conversationCapabilityTransactionContext.tryUse() || conversationCapabilityReferenceReadContext.tryUse()) {
    return run()
  }
  return (async () => {
    using _lock = await Lock.read(CONVERSATION_CAPABILITY_REFERENCE_LOCK)
    return conversationCapabilityReferenceReadContext.provide(true, run)
  })()
}

export function markConversationCapabilityTransactionalInit<T extends InstanceInit>(
  init: T,
  preflight: () => Promise<unknown>,
): T {
  initializerPreflights.set(init, preflight)
  return init
}

export function conversationCapabilityInitPreflight(
  init: InstanceInit | undefined,
): (() => Promise<unknown>) | undefined {
  return init === undefined ? undefined : initializerPreflights.get(init)
}
