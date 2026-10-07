import { ExpertSquadIDSchema, ExpertSquadNamespaceSchema } from "@opencorvus-ai/sdk/expert-squad-manifest-v2"
import type { ExpertSquadOption, ExpertSquadDetail, ExpertSquadInstallationScope } from "./expert-squad"
export type SquadInstallationIdentity =
  | { installationScope: "built_in"; id: string }
  | { installationScope: ExpertSquadInstallationScope; namespace: string; id: string }
export type SquadRefreshSelection = { kind: "installation"; key: string } | { kind: "effective" }
export function squadInstallationKey(identity: SquadInstallationIdentity): string {
  const id = ExpertSquadIDSchema.parse(identity.id)
  return identity.installationScope === "built_in"
    ? `built_in:${id}`
    : `${identity.installationScope}:${ExpertSquadNamespaceSchema.parse(identity.namespace)}:${id}`
}
export function parseSquadInstallationKey(key: string): SquadInstallationIdentity {
  const segments = key.split(":")
  if (segments[0] === "built_in" && segments.length === 2)
    return { installationScope: "built_in", id: ExpertSquadIDSchema.parse(segments[1]) }
  if ((segments[0] === "project" || segments[0] === "global") && segments.length === 3)
    return {
      installationScope: segments[0],
      namespace: ExpertSquadNamespaceSchema.parse(segments[1]),
      id: ExpertSquadIDSchema.parse(segments[2]),
    }
  throw new Error("Invalid expert squad physical selection key")
}
export function squadSelectionKey(squad: Pick<ExpertSquadOption | ExpertSquadDetail, "id" | "source">): string {
  return squadInstallationKey(
    squad.source.kind === "built_in"
      ? { installationScope: "built_in", id: squad.id }
      : { installationScope: squad.source.installation_scope, namespace: squad.source.namespace, id: squad.id },
  )
}
