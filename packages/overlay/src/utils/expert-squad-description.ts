import type { ExpertSquadMarketIndexItem, ExpertSquadOption } from "../services/expert-squad"
import { expertSquadDescriptions } from "../generated/expert-squad-descriptions"
import { getLocale } from "./i18n"

export function expertSquadDescription(
  squad:
    | Pick<ExpertSquadOption, "id" | "source" | "description">
    | Pick<ExpertSquadMarketIndexItem, "namespace" | "id" | "description">,
): string | undefined {
  const original = squad.description
  if (getLocale() !== "zh-CN" || !original) return original
  const namespace =
    "source" in squad ? (squad.source.kind === "built_in" ? "builtin" : squad.source.namespace) : squad.namespace
  const reviewed = expertSquadDescriptions[`${namespace}/${squad.id}`]
  return reviewed?.source === original ? reviewed["zh-CN"] : original
}
