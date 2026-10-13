import z from "zod"
import { canonicalDigestSource } from "@/util/canonical-digest"
import type { Message } from "./message"
import { AssistantDiagnostics } from "./assistant-diagnostics"

/** Exact ancestry of copied evidence, never execution or cross-Session access authority. */
export namespace MessageCopyEvidence {
  const Source = z
    .object({
      sessionID: z.string().min(1),
      messageID: z.string().min(1),
      partID: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
  export type Source = z.infer<typeof Source>

  const DiagnosticSource = Source.omit({ partID: true })
    .extend({
      parentID: z.string().min(1),
      acceptedInputMessageIDs: z.array(z.string().min(1)).min(1).optional(),
    })
    .strict()
  export type DiagnosticSource = z.infer<typeof DiagnosticSource>

  export const Schema = z
    .array(
      z.union([
        z
          .object({
            partID: z.string().min(1),
            sources: z.array(Source).min(1),
          })
          .strict(),
        z.object({ field: z.literal("diagnostics"), sources: z.array(DiagnosticSource).min(1) }).strict(),
      ]),
    )
    .meta({ ref: "MessageCopyEvidence" })
  export type Info = z.infer<typeof Schema>
  export type ReadablePart = Message.TextPart | Message.ToolPart

  export function digest(owner: Pick<Message.Info, "role" | "author">, part: ReadablePart): string {
    const { id: _id, sessionID: _sessionID, messageID: _messageID, orderKey: _orderKey, ...payload } = part
    // Match persisted JSON semantics before canonical serialization. The fixed
    // digest belongs to the copy-time evidence, not to a later mutable draft.
    return canonicalDigestSource(
      "message-copy-evidence-v1",
      JSON.parse(
        JSON.stringify({
          role: owner.role,
          author: owner.author,
          part: payload,
        }),
      ),
    ).sha256
  }

  export function copy(message: Message.WithParts, partIDs: ReadonlyMap<string, string>): Info {
    const inherited = new Map(
      message.info.copySources?.flatMap((item) => ("partID" in item ? [[item.partID, item.sources] as const] : [])),
    )
    const result: Info = message.parts.flatMap((part) => {
      if (part.type !== "text" && part.type !== "tool") return []
      const partID = partIDs.get(part.id)
      if (!partID) throw new Error(`Copied evidence Part ${part.id} has no target identity`)
      return [
        {
          partID,
          sources: [
            ...(inherited.get(part.id) ?? []),
            {
              sessionID: message.info.sessionID,
              messageID: message.info.id,
              partID: part.id,
              sha256: digest(message.info, part),
            },
          ],
        },
      ]
    })
    if (message.info.role === "assistant") {
      const sha256 = diagnosticDigest(message.info)
      if (sha256)
        result.push({
          field: "diagnostics",
          sources: [
            ...(message.info.copySources?.flatMap((entry) => ("field" in entry ? entry.sources : [])) ?? []),
            { ...AssistantDiagnostics.identity(message.info), sha256 },
          ],
        })
    }
    return result
  }

  export function diagnosticDigest(info: Message.Assistant): string | undefined {
    const facts = AssistantDiagnostics.facts(info)
    if (!facts) return
    return canonicalDigestSource("message-copy-diagnostics-v1", JSON.parse(JSON.stringify(facts))).sha256
  }
}
