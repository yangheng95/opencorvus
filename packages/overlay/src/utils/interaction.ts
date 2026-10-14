// ── Interaction → CardNode seed pipeline ──
//
// An interaction (permission / question / clarification) is a prompt the
// backend raised from inside a specific session. The overlay renders it as
// part of the conversation timeline by producing one or more "card seeds"
// that tree-writer.upsertInteractionCard turns into CardNodes — direct,
// no Message wrapper. Per project rule 22 (no duplicate message
// abstraction); the seed has only the shape upsertInteractionCard reads.
//
// Routing: an interaction whose `sessionID` matches a known agent card
// is "claimed" by that card; interactions without sessionID (or whose
// session has no card yet) are "unclaimed" and surfaced separately.

import { interactionRequestText, interactionResponseText, hashText } from "./transcript"
import { requireTimelineOrderKeyDomain } from "./timeline-order"

export interface InteractionCardSeed {
  info: {
    id: string
    orderKey: string
    role: string
    time: { created: number }
  }
  parts: any[]
}

type QuestionHistoryPhase = "request" | "response"

function questionHistorySeed(
  interaction: any,
  phase: QuestionHistoryPhase,
  orderKey: string,
  time: number,
): InteractionCardSeed {
  if (typeof interaction.id !== "string" || !interaction.id.trim()) {
    throw new Error("question history missing interaction identity")
  }
  if (!(time > 0)) throw new Error(`question ${interaction.id} ${phase} history missing time`)
  return {
    info: {
      id: `ctx:interaction:${interaction.id}:${phase}`,
      orderKey,
      role: "system",
      time: { created: time },
    },
    parts: [{ type: "interaction-question", interaction, phase, orderKey }],
  }
}

function textSeed(role: string, orderKey: string, time: number, text: string): InteractionCardSeed | null {
  if (typeof text !== "string" || !text.trim()) return null
  const created = Number(time)
  if (!(created > 0)) throw new Error(`interaction text seed missing created time`)
  if (!orderKey) throw new Error("interaction text seed missing orderKey")
  return {
    info: {
      id: `interaction-text:${role}:${created}:${hashText(text)}`,
      orderKey,
      role,
      time: { created },
    },
    parts: [{ type: "text", orderKey, text }],
  }
}

/** Convert one interaction into the card seed(s) that render it.
 *
 *  - Pending permission/question → one seed carrying an `interaction-*`
 *    part so <CardParts> dispatches to <InteractionCard>.
 *  - Resolved Questions → canonical request/response parts, formatted by the
 *    mounted renderer so locale changes retain their original identities.
 *  - Other answered/rejected interactions → request and response text bubbles.
 *  - Pending interactions of other types (no `interaction-*` part) fall
 *    through to the transcript path with just a request bubble.
 *
 *  Returns [] when the interaction produces no visible seed. */
export function interactionToCardSeeds(interaction: any): InteractionCardSeed[] {
  const role = "system"
  const requestTime = Number(interaction?.time?.created)
  const interactionID = interaction?.id || "<unknown>"
  const orderKey = requireTimelineOrderKeyDomain(
    interaction?.orderKey,
    `interaction ${interactionID} orderKey`,
    "interaction",
  )

  if (interaction?.status === "pending") {
    const partType =
      interaction.type === "question"
        ? "interaction-question"
        : interaction.type === "permission"
          ? "interaction-permission"
          : null
    if (partType) {
      return [
        {
          info: {
            id: `ctx:interaction:${interaction.id}`,
            orderKey,
            role,
            time: { created: requestTime },
          },
          parts: [{ type: partType, interaction }],
        },
      ]
    }
  }

  if (interaction?.type === "question") {
    if (!["answered", "rejected", "expired"].includes(interaction.status)) {
      throw new Error(`question ${interactionID} has unsupported history status ${interaction.status}`)
    }
    const responseOrderKey = requireTimelineOrderKeyDomain(
      interaction.responseOrderKey,
      `interaction ${interactionID} responseOrderKey`,
      "interaction",
    )
    return [
      questionHistorySeed(interaction, "request", orderKey, requestTime),
      questionHistorySeed(interaction, "response", responseOrderKey, Number(interaction.time?.resolved)),
    ]
  }

  const seeds: InteractionCardSeed[] = []
  const request = textSeed(role, orderKey, requestTime, interactionRequestText(interaction))
  if (request) seeds.push(request)
  if (interaction?.status === "answered" || interaction?.status === "rejected") {
    const resolvedTime = Number(interaction.time?.resolved)
    const responseOrderKey = requireTimelineOrderKeyDomain(
      interaction?.responseOrderKey,
      `interaction ${interactionID} responseOrderKey`,
      "interaction",
    )
    const response = textSeed(role, responseOrderKey, resolvedTime, interactionResponseText(interaction))
    if (response) seeds.push(response)
  }
  return seeds
}

/** Split a list of interactions into per-session buckets (for interactions
 *  whose `sessionID` is a known agent session) and an orphan list for the
 *  rest. `knownSessionIDs` comes from the projected conversation sessions. */
export function partitionInteractions(
  interactions: any[] | null | undefined,
  knownSessionIDs: ReadonlySet<string>,
): { bySession: Map<string, any[]>; orphan: any[] } {
  const bySession = new Map<string, any[]>()
  const orphan: any[] = []
  if (!Array.isArray(interactions)) return { bySession, orphan }
  for (const it of interactions) {
    const sid = typeof it?.sessionID === "string" ? it.sessionID : ""
    if (sid && knownSessionIDs.has(sid)) {
      const list = bySession.get(sid)
      if (list) list.push(it)
      else bySession.set(sid, [it])
    } else {
      orphan.push(it)
    }
  }
  return { bySession, orphan }
}
