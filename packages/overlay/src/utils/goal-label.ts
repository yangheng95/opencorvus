export function goalRevisionLabel(order: unknown, revision: unknown): string {
  const rawOrder = Number(order)
  const rawRevision = Number(revision)
  const safeOrder = Number.isFinite(rawOrder) ? Math.max(0, Math.trunc(rawOrder)) : 0
  const safeRevision = Number.isFinite(rawRevision) ? Math.max(1, Math.trunc(rawRevision)) : 1
  return safeOrder > 0 ? `#G${safeOrder}V${safeRevision}` : `V${safeRevision}`
}

export function goalRevisionLabelFromIndexes(orderIndex: unknown, revisionIndex: unknown): string {
  const order = Number.isFinite(Number(orderIndex)) ? Number(orderIndex) + 1 : 0
  const revision = Number.isFinite(Number(revisionIndex)) ? Number(revisionIndex) + 1 : 1
  return goalRevisionLabel(order, revision)
}

export function goalCompactLabel(order: unknown, revision: unknown): string {
  const rawOrder = Number(order)
  const rawRevision = Number(revision)
  const safeOrder = Number.isFinite(rawOrder) ? Math.max(0, Math.trunc(rawOrder)) : 0
  const safeRevision = Number.isFinite(rawRevision) ? Math.max(1, Math.trunc(rawRevision)) : 1
  if (safeOrder <= 0) return `V${safeRevision}`
  return safeRevision > 1 ? `#G${safeOrder}·${safeRevision}` : `#G${safeOrder}`
}

export function goalCompactLabelFromIndexes(orderIndex: unknown, revisionIndex: unknown): string {
  const order = Number.isFinite(Number(orderIndex)) ? Number(orderIndex) + 1 : 0
  const revision = Number.isFinite(Number(revisionIndex)) ? Number(revisionIndex) + 1 : 1
  return goalCompactLabel(order, revision)
}

export function goalCompactLabelForBoardGoal(goal: unknown, listIndex: number): string {
  const value = goal && typeof goal === "object" ? (goal as Record<string, unknown>) : {}
  const orderIndex = Number.isFinite(Number(value.orderIndex)) ? Number(value.orderIndex) : listIndex
  const revision = Number.isFinite(Number(value.revision)) ? Number(value.revision) : 1
  return goalCompactLabel(orderIndex + 1, revision)
}

export function goalCompactLabelForGoalID(goals: unknown, goalID: unknown): string {
  const targetID = typeof goalID === "string" ? goalID.trim() : ""
  if (!targetID || !Array.isArray(goals)) return ""
  const listIndex = goals.findIndex(
    (goal) => goal && typeof goal === "object" && String((goal as Record<string, unknown>).goalID || "") === targetID,
  )
  return listIndex >= 0 ? goalCompactLabelForBoardGoal(goals[listIndex], listIndex) : ""
}
