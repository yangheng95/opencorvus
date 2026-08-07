import { createSignal } from "solid-js"
import type { ChangeGroup, DiffTarget } from "./diff"

export type ReviewFocusTarget = Readonly<{
  taskID: string
  groupID: string
  filePath: string
}>

export type ReviewFocusRequest = Readonly<{
  id: number
  target: ReviewFocusTarget
}>

export type ReviewFocusFailure = Readonly<{
  target: ReviewFocusTarget
}>

let nextRequestID = 0
let presentReviewPanel: (() => void) | undefined
const [pending, setPending] = createSignal<ReviewFocusRequest>()
const [failure, setFailure] = createSignal<ReviewFocusFailure>()

export function registerReviewPanelPresenter(presenter: () => void): () => void {
  if (presentReviewPanel) throw new Error("Review panel presenter is already registered")
  presentReviewPanel = presenter
  return () => {
    if (presentReviewPanel === presenter) presentReviewPanel = undefined
  }
}

export function requestReviewPanel(): void {
  if (!presentReviewPanel) throw new Error("Review panel presenter is not registered")
  presentReviewPanel()
}

export function pendingReviewFocus(): ReviewFocusRequest | undefined {
  return pending()
}

export function reviewFocusFailure(): ReviewFocusFailure | undefined {
  return failure()
}

export function requestReviewFocus(target: ReviewFocusTarget): ReviewFocusRequest {
  const request = Object.freeze({ id: ++nextRequestID, target: Object.freeze({ ...target }) })
  setFailure(undefined)
  setPending(request)
  requestReviewPanel()
  return request
}

export function completeReviewFocus(requestID: number): void {
  if (pending()?.id === requestID) setPending(undefined)
}

export function failReviewFocus(requestID: number): void {
  const request = pending()
  if (request?.id !== requestID) return
  setPending(undefined)
  setFailure({ target: request.target })
}

export function resolveReviewFocusTarget(
  groups: readonly ChangeGroup[],
  target: ReviewFocusTarget,
): DiffTarget | undefined {
  const group = groups.find((candidate) => candidate.id === target.groupID)
  const change = group?.changes.find((candidate) => candidate.file === target.filePath)
  if (!group || !change) return undefined
  return {
    filePath: change.file,
    groupID: group.id,
    ...(group.sessionID ? { sessionID: group.sessionID } : {}),
    ...(group.agentID ? { agentID: group.agentID } : {}),
  }
}
