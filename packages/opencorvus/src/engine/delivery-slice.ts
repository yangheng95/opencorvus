/**
 * Immutable identity projected from the existing append-only Goal contract.
 *
 * A Goal row is one Delivery Slice revision. Its lineage root is the stable
 * Delivery Slice identity; the row id is the immutable revision identity.
 * This module deliberately derives identity from contract facts and owns no
 * execution, review, retry, or Task lifecycle state.
 */
export interface DeliverySliceRevisionRecord {
  id: string
  task_id: string
  supersede_of: string | null
}

export interface DeliverySliceRevisionIdentity {
  deliverySliceID: string
  deliverySliceRevisionID: string
  revision: number
  priorRevisionID: string | null
}

export function resolveDeliverySliceRevisionIdentity(
  revision: DeliverySliceRevisionRecord,
  taskRevisions: readonly DeliverySliceRevisionRecord[],
): DeliverySliceRevisionIdentity {
  const revisionsByID = new Map(taskRevisions.map((candidate) => [candidate.id, candidate]))
  const visited = new Set<string>()
  let root = revision
  let revisionNumber = 1

  while (root.supersede_of) {
    if (visited.has(root.id)) {
      throw new Error(`Delivery Slice revision lineage cycle detected at ${root.id}`)
    }
    visited.add(root.id)
    const ancestor = revisionsByID.get(root.supersede_of)
    if (!ancestor || ancestor.task_id !== revision.task_id) {
      throw new Error(
        `Delivery Slice revision ${root.id} supersedes missing or cross-Task revision ${root.supersede_of}`,
      )
    }
    root = ancestor
    revisionNumber += 1
  }

  return {
    deliverySliceID: root.id,
    deliverySliceRevisionID: revision.id,
    revision: revisionNumber,
    priorRevisionID: revision.supersede_of,
  }
}
