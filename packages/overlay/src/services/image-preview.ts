import { createSignal } from "solid-js"

export interface ImagePreviewState {
  open: boolean
  src: string
  alt: string
  filename?: string
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

export function openImagePreview(input: { src: string; alt?: string; resourceUrl?: string; filename?: string }): void {
  if (!input.src) return
  const resource = input.resourceUrl ?? (input.src.startsWith("/") ? input.src : undefined)
  if (resource && !resource.startsWith("/")) throw new Error("Image preview resource must be host-relative")
  setImagePreviewState((current) => ({
    open: true, src: input.src, alt: input.alt ?? "", filename: input.filename, revision: current.revision + 1,
    ...(resource ? { resourceUrl: resource } : {}),
  }))
}

export function closeImagePreview(): void {
  setImagePreviewState((current) => ({ open: false, src: "", alt: "", revision: current.revision + 1 }))
}
