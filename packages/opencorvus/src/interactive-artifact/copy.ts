import { Identifier } from "@/id/id"

/** Each copied Message owns one snapshot per referenced original artifact. */
export function prepareInteractiveArtifactCopies(artifactIDs: Iterable<string>): Map<string, string> {
  return new Map([...new Set(artifactIDs)].map((id) => [id, Identifier.ascending("artifact")]))
}
