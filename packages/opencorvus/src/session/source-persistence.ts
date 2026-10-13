import { Session } from "."
import type { Message } from "./message"

/** Persist source facts once per semantic source identity within a real assistant message. */
export async function persistMessageSources(input: {
  sessionID: string
  messageID: string
  sources: readonly unknown[]
}): Promise<Message.SourcePart[]> {
  return Session.persistMessageSources(input)
}
