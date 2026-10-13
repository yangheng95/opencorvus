import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { canonicalDigestSource } from "@/util/canonical-digest"
import { CompactionHandoff } from "./compaction-handoff"
import { AssistantDiagnostics } from "./assistant-diagnostics"
import type { Message } from "./message"

/** Exact coverage of a Message that can outlive a compaction checkpoint. */
export namespace CompactionCoverage {
  export const Schema = z.array(
    z
      .object({
        messageID: z.string().min(1),
        diagnostics_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        parts: z.array(
          z
            .object({
              partID: z.string().min(1),
              sha256: z.string().regex(/^[a-f0-9]{64}$/),
            })
            .strict(),
        ),
      })
      .strict(),
  )
  export type Info = z.infer<typeof Schema>
  export type Entry = Info[number]
  export const IntegrityError = NamedError.create(
    "CompactionCoverageIntegrityError",
    z.object({
      message: z.string(),
      messageID: z.string(),
      partID: z.string().optional(),
    }),
  )

  export function digest(owner: Pick<Message.Info, "role" | "author">, part: Message.Part) {
    const { id: _id, sessionID: _sessionID, messageID: _messageID, orderKey: _orderKey, ...payload } = part
    return canonicalDigestSource(
      "compaction-covered-part-v1",
      JSON.parse(
        JSON.stringify({
          role: owner.role,
          author: owner.author,
          part: payload,
        }),
      ),
    ).sha256
  }

  export function diagnosticsDigest(info: Message.Assistant) {
    return canonicalDigestSource(
      "compaction-covered-diagnostics-v1",
      JSON.parse(JSON.stringify(AssistantDiagnostics.facts(info) ?? null)),
    ).sha256
  }

  export function snapshot(head: readonly Message.WithParts[]): Info | undefined {
    const covered = new Map<string, Entry>()
    for (const message of head) {
      if (message.info.role !== "assistant" || !CompactionHandoff.isValidSummaryMessage(message.info)) continue
      for (const part of message.parts) {
        if (part.type !== "compaction") continue
        for (const entry of part.covered_parts ?? []) covered.set(entry.messageID, entry)
      }
    }
    for (const message of head) {
      if (message.info.role !== "assistant") continue
      const previous = covered.get(message.info.id)
      if (message.info.time.completed !== undefined && !previous) continue
      const parts = new Map(previous?.parts.map((part) => [part.partID, part]))
      for (const part of message.parts) parts.set(part.id, { partID: part.id, sha256: digest(message.info, part) })
      covered.set(message.info.id, {
        messageID: message.info.id,
        diagnostics_sha256: diagnosticsDigest(message.info),
        parts: [...parts.values()],
      })
    }
    return covered.size ? [...covered.values()] : undefined
  }

  export function coveredDiagnostics(messages: readonly Message.WithParts[]) {
    const bindings = new Map<string, string>()
    for (const message of messages) {
      if (message.info.role !== "assistant" || !CompactionHandoff.isValidSummaryMessage(message.info)) continue
      for (const part of message.parts) {
        if (part.type !== "compaction") continue
        for (const entry of part.covered_parts ?? []) bindings.set(entry.messageID, entry.diagnostics_sha256)
      }
    }
    return new Set(
      messages
        .filter(
          (message) =>
            message.info.role === "assistant" && bindings.get(message.info.id) === diagnosticsDigest(message.info),
        )
        .map((message) => message.info.id),
    )
  }

  export function assertSource(
    entry: Entry,
    source: Message.WithParts | undefined,
  ): asserts source is Message.WithParts {
    if (!source || source.info.id !== entry.messageID || source.info.role !== "assistant")
      throw new IntegrityError({ message: "Covered assistant Message is missing", messageID: entry.messageID })
    const ids = new Set(source.parts.map((part) => part.id))
    for (const part of entry.parts) {
      if (!ids.has(part.partID))
        throw new IntegrityError({
          message: "Covered Part is missing from its original Message",
          messageID: entry.messageID,
          partID: part.partID,
        })
    }
  }

  export function matchingPartIDs(entry: Entry, source: Message.WithParts) {
    const bindings = new Map(entry.parts.map((part) => [part.partID, part.sha256]))
    return new Set(
      source.parts
        .filter((part) => bindings.has(part.id) && bindings.get(part.id) === digest(source.info, part))
        .map((part) => part.id),
    )
  }

  export function suffix(entry: Entry, source: Message.WithParts | undefined): Message.WithParts {
    assertSource(entry, source)
    const covered = matchingPartIDs(entry, source)
    return { info: source.info, parts: source.parts.filter((part) => !covered.has(part.id)) }
  }

  export function copy(
    entry: Entry,
    source: Message.WithParts | undefined,
    target: Message.WithParts,
    partIDs: ReadonlyMap<string, string>,
  ): Entry {
    assertSource(entry, source)
    const covered = matchingPartIDs(entry, source)
    const targets = new Map(target.parts.map((part) => [part.id, part]))
    const diagnostics =
      source.info.role === "assistant" &&
      target.info.role === "assistant" &&
      diagnosticsDigest(source.info) === entry.diagnostics_sha256
        ? diagnosticsDigest(target.info)
        : entry.diagnostics_sha256
    return {
      messageID: target.info.id,
      diagnostics_sha256: diagnostics,
      parts: entry.parts.map((bound) => {
        const copiedID = partIDs.get(bound.partID)
        const copied = copiedID ? targets.get(copiedID) : undefined
        if (!copied)
          throw new IntegrityError({
            message: "Covered Part is outside the copied history",
            messageID: entry.messageID,
            partID: bound.partID,
          })
        // A changed source must remain changed after copying. Rebinding it to
        // today's payload would incorrectly claim that the old summary saw it.
        return { partID: copied.id, sha256: covered.has(bound.partID) ? digest(target.info, copied) : bound.sha256 }
      }),
    }
  }
}
