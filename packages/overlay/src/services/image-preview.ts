import { createSignal } from "solid-js"

export interface ImagePreviewState {
  open: boolean
  src: string
  alt: string
  revision: number
  resourceUrl?: string
}

const [imagePreviewState, setImagePreviewState] = createSignal<ImagePreviewState>({
  open: false,
  src: "",
  alt: "",
  revision: 0,
})

export { imagePreviewState }

export function openImagePreview(src: string, alt = "", resourceUrl?: string): void {
  if (!src) return
  const resource = resourceUrl ?? (src.startsWith("/") ? src : undefined)
  if (resource && !resource.startsWith("/")) throw new Error("Image preview resource must be host-relative")
  setImagePreviewState((current) => ({
    open: true, src, alt, revision: current.revision + 1,
    ...(resource ? { resourceUrl: resource } : {}),
  }))
}

export function closeImagePreview(): void {
  setImagePreviewState((current) => ({ open: false, src: "", alt: "", revision: current.revision + 1 }))
}
