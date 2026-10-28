import { createSignal } from "solid-js"
import { assertApiAuthorityCurrent, captureApiAuthority, type ApiAuthority } from "./api-state"

export interface ImagePreviewResource {
  resourceUrl: string
  authority: ApiAuthority
}

export interface ImagePreviewState {
  open: boolean
  src: string
  alt: string
  revision: number
  resourceUrl?: string
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

export function openImagePreviewForRequest(
  requestRevision: number,
  src: string,
  alt = "",
  resource?: ImagePreviewResource,
): boolean {
  if (!src || !imagePreviewRequestIsCurrent(requestRevision)) return false
  if (resource) assertApiAuthorityCurrent(resource.authority)
  const resourceUrl = resource?.resourceUrl ?? (src.startsWith("/") ? src : undefined)
  if (resourceUrl && !resourceUrl.startsWith("/")) throw new Error("Image preview resource must be host-relative")
  setImagePreviewState({ open: true, src, alt, revision: requestRevision, ...(resourceUrl ? { resourceUrl } : {}) })
  return true
}

export function openImagePreview(src: string, alt = "", resourceUrl?: string): void {
  if (!src) return
  const revision = beginImagePreviewRequest()
  openImagePreviewForRequest(
    revision,
    src,
    alt,
    resourceUrl ? { resourceUrl, authority: captureApiAuthority() } : undefined,
  )
}

export function closeImagePreview(): void {
  const revision = beginImagePreviewRequest()
  setImagePreviewState({ open: false, src: "", alt: "", revision })
}
