import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import type { ProductPillar } from "@opencorvus-ai/sdk/expert-squad-authoring"
import {
  MissionRequestedExpertSquadIDs,
  MissionVisibleExpertSquadIDs,
  type MissionVisibleExpertSquadIDs as MissionVisibleExpertSquadIDList,
} from "./schema"

export async function resolveMissionLaunchExpertSquadIDs(input: {
  projectDirectory: string
  productPillar: ProductPillar
  requestedExpertSquadIDs?: MissionRequestedExpertSquadIDs
}): Promise<MissionVisibleExpertSquadIDList> {
  const catalog = await PromptProfileResolver.recommendationCatalog({
    projectDirectory: input.projectDirectory,
    productPillar: input.productPillar,
    visibleExpertSquadIDs: input.requestedExpertSquadIDs,
  })
  return MissionVisibleExpertSquadIDs.parse(catalog.map((squad) => squad.id))
}

export function missionExpertSquadSnapshotsMatch(
  heldExpertSquadIDs: MissionVisibleExpertSquadIDList,
  requestedExpertSquadIDs: MissionVisibleExpertSquadIDList,
): boolean {
  const requested = new Set(requestedExpertSquadIDs)
  return requested.size === heldExpertSquadIDs.length && heldExpertSquadIDs.every((id) => requested.has(id))
}
