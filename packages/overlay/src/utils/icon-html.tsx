import type { IconSizeTier } from "../components/ui/Icon.types"

type IconHtmlRenderer = (input: { name: string; size: IconSizeTier; className?: string }) => string

let iconHtmlRenderer: IconHtmlRenderer | undefined

export function installIconHtmlRenderer(renderer: IconHtmlRenderer): () => void {
  iconHtmlRenderer = renderer
  return () => {
    if (iconHtmlRenderer === renderer) iconHtmlRenderer = undefined
  }
}

export function iconHtml(name: string, size: IconSizeTier = "standard", className?: string): string {
  if (!iconHtmlRenderer) throw new Error("iconHtml renderer has not been installed")
  return iconHtmlRenderer({ name, size, className })
}

export function hydrateIconPlaceholders(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>("[data-oc-icon]")) {
    const name = node.dataset.ocIcon
    if (!name) continue
    node.innerHTML = iconHtml(name)
  }
}
