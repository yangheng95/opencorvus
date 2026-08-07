export type DeliverySliceReviewJudgment = "accepted" | "rejected" | "inconclusive"

export interface DeliverySliceReviewAssociation {
  /** ID means identifier. */
  artifactID: string
  /** ID means identifier. */
  deliverySliceRevisionID: string
  judgment: DeliverySliceReviewJudgment
}

export interface DeliverySliceFactProjectionInput {
  /** ID means identifier. */
  deliverySliceRevisionID: string
  /** IDs means identifiers. */
  associatedSessionIDs: readonly string[]
  /** IDs means identifiers. */
  activeSessionIDs: readonly string[]
  /** IDs means identifiers. */
  evidenceArtifactIDs: readonly string[]
  reviewAssociations: readonly DeliverySliceReviewAssociation[]
  completionDecision?: {
    /** ID means identifier. */
    artifactID: string
    /** IDs means identifiers. */
    acceptedDeliverySliceRevisionIDs: readonly string[]
  }
}

export interface DeliverySliceFacts {
  activity: {
    /** IDs means identifiers. */
    sessionIDs: readonly string[]
    /** IDs means identifiers. */
    activeSessionIDs: readonly string[]
    /** IDs means identifiers. */
    evidenceArtifactIDs: readonly string[]
  }
  reviewAssociations: readonly DeliverySliceReviewAssociation[]
  acceptance: {
    accepted: boolean
    /** ID means identifier. */
    completionDecisionArtifactID?: string
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

/** Projects independent read-only fact facets without synthesizing a Goal lifecycle. */
export function deriveDeliverySliceFacts(input: DeliverySliceFactProjectionInput): DeliverySliceFacts {
  const reviewAssociations = input.reviewAssociations.filter(
    (review) => review.deliverySliceRevisionID === input.deliverySliceRevisionID,
  )
  const completionDecisionArtifactID = input.completionDecision?.artifactID
  return {
    activity: {
      sessionIDs: unique(input.associatedSessionIDs),
      activeSessionIDs: unique(input.activeSessionIDs),
      evidenceArtifactIDs: unique(input.evidenceArtifactIDs),
    },
    reviewAssociations,
    acceptance: {
      accepted:
        input.completionDecision?.acceptedDeliverySliceRevisionIDs.includes(input.deliverySliceRevisionID) ?? false,
      ...(completionDecisionArtifactID ? { completionDecisionArtifactID } : {}),
    },
  }
}
