export interface FactCheckInputRefs {
  taskID: string
}

export type FactCheckFactProjection = {
  discoveryInstruction: string
}

/**
 * Project exact selected Artifact identities only. The Fact Check Agent owns
 * semantic inspection through artifact_read; the Host must not parse and copy
 * domain-specific claim bodies into a second prompt transport.
 */
export function projectFactCheckFacts(input: FactCheckInputRefs): FactCheckFactProjection {
  return {
    discoveryInstruction:
      `Search Task ${input.taskID}'s Artifact catalog yourself by exact name/kind, current or historical version, ` +
      "recency, and fuzzy relevance. Completely read every Artifact you use with artifact_read. " +
      "No upstream participant selected or copied an Artifact body for this review; an empty result is a visible missing-evidence fact.",
  }
}
