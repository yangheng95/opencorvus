import { createSignal } from "solid-js"

export interface ImagePreviewState {
  open: boolean
  src: string
  alt: string
  revision: number
}

let imagePreviewRevision = 0

const [imagePreviewState, setImagePreviewState] = createSignal<ImagePreviewState>({
  open: false,
  src: "",
  alt: "",
  revision: imagePreviewRevision,
})

export { imagePreviewState }

export function beginImagePreviewRequest(): number {
  imagePreviewRevision += 1
  return imagePreviewRevision
}

export function imagePreviewRequestIsCurrent(requestRevision: number): boolean {
  return requestRevision === imagePreviewRevision
}

export function cancelImagePreviewRequest(requestRevision: number): void {
  if (!imagePreviewRequestIsCurrent(requestRevision)) return
  imagePreviewRevision += 1
}

export function openImagePreviewForRequest(requestRevision: number, src: string, alt = ""): boolean {
  if (!src || !imagePreviewRequestIsCurrent(requestRevision)) return false
  setImagePreviewState({ open: true, src, alt, revision: requestRevision })
  return true
}

export function openImagePreview(src: string, alt = ""): void {
  if (!src) return
  const revision = beginImagePreviewRequest()
  setImagePreviewState({ open: true, src, alt, revision })
}

export function closeImagePreview(): void {
  const revision = beginImagePreviewRequest()
  setImagePreviewState({ open: false, src: "", alt: "", revision })
}
