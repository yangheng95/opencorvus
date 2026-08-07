export interface ExpertSquadPackageRevision {
  scope: "built_in" | "project" | "global"
  projectID: string | null
  namespace: string
  id: string
  version: string
  packageDigest: string
}

export function sameExpertSquadPackageRevision(
  left: ExpertSquadPackageRevision,
  right: ExpertSquadPackageRevision,
): boolean {
  return (
    left.scope === right.scope &&
    left.projectID === right.projectID &&
    left.namespace === right.namespace &&
    left.id === right.id &&
    left.version === right.version &&
    left.packageDigest === right.packageDigest
  )
}
