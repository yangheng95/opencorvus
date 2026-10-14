// ── Interaction → CardNode seed pipeline ──
//
// An interaction (permission / question) is a prompt the
// backend raised from inside a specific session. The overlay renders it as
// part of the conversation timeline by producing one or more "card seeds"
// that tree-writer.upsertInteractionCard turns into CardNodes — direct,
// no Message wrapper. Per project rule 22 (no duplicate message
// abstraction); the seed has only the shape upsertInteractionCard reads.
//
// Routing: an interaction whose `sessionID` matches a known agent card
// is "claimed" by that card; interactions without sessionID (or whose
// session has no card yet) are "unclaimed" and surfaced separately.

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

type InteractionHistoryPhase = "request" | "response"

function interactionHistorySeed(
  interaction: any,
  phase: InteractionHistoryPhase,
  orderKey: string,
  time: number,
): InteractionCardSeed {
  if (typeof interaction.id !== "string" || !interaction.id.trim()) {
    throw new Error("interaction history missing interaction identity")
  }
  if (!Number.isFinite(time) || !(time > 0)) throw new Error(`interaction ${interaction.id} ${phase} history missing time`)
  return {
    info: {
      id: `ctx:interaction:${interaction.id}:${phase}`,
      orderKey,
      role: "system",
      time: { created: time },
    },
    parts: [{ type: `interaction-${interaction.type}`, interaction, phase, orderKey }],
  }
}

/** Convert one interaction into the card seed(s) that render it.
 *
 *  - Pending permission/question → one seed carrying an `interaction-*`
 *    part so <CardParts> dispatches to <InteractionCard>.
 *  - Resolved permission/question → canonical request/response parts, formatted
 *    by the mounted renderer so locale changes retain their original identities.
 *  Unsupported history contracts are explicit errors. */
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
          parts: [{ type: partType, interaction, phase: "pending" }],
        },
      ]
    }
  }

  if (interaction?.type !== "question" && interaction?.type !== "permission") {
    throw new Error(`interaction ${interactionID} has unsupported history type ${String(interaction?.type)}`)
  }
  const statuses = interaction.type === "question" ? ["answered", "rejected", "expired"] : ["answered", "rejected"]
  if (!statuses.includes(interaction.status)) {
    throw new Error(`${interaction.type} ${interactionID} has unsupported history status ${interaction.status}`)
  }
  const responseOrderKey = requireTimelineOrderKeyDomain(
    interaction.responseOrderKey,
    `interaction ${interactionID} responseOrderKey`,
    "interaction",
  )
  return [
    interactionHistorySeed(interaction, "request", orderKey, requestTime),
    interactionHistorySeed(interaction, "response", responseOrderKey, Number(interaction.time?.resolved)),
  ]
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
