let layoutTokenProbe: HTMLElement | null = null
const layoutTokenCache = new Map<string, { signature: string; value: number }>()

export interface LayoutTokenResolver {
  tokenNumber(name: string): number
  tokenPx(name: string): number
}

function tokenSignature(root: HTMLElement, container: HTMLElement): string {
  const scale = getComputedStyle(root).getPropertyValue("--ui-scale").trim()
  const containerInlineSize = container.getBoundingClientRect().width
  if (!Number.isFinite(containerInlineSize) || containerInlineSize <= 0) {
    throw new Error(`Layout token cache container resolved to invalid width: ${containerInlineSize}`)
  }
  return `${scale}|${containerInlineSize.toFixed(3)}`
}

function probeElement(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("Layout token resolution requires a document.")
  }
  if (!document.body) {
    throw new Error("Layout token resolution requires document.body.")
  }
  if (layoutTokenProbe?.isConnected) return layoutTokenProbe

  const probe = document.createElement("div")
  probe.setAttribute("aria-hidden", "true")
  probe.style.position = "absolute"
  probe.style.left = "-10000px"
  probe.style.top = "-10000px"
  probe.style.height = "0"
  probe.style.overflow = "hidden"
  probe.style.pointerEvents = "none"
  probe.style.visibility = "hidden"
  document.body.appendChild(probe)
  layoutTokenProbe = probe
  return probe
}

export function currentUIScale(): number {
  if (typeof document === "undefined") {
    throw new Error("UI scale cannot be resolved without a document.")
  }
  const root = document.documentElement
  if (!root) {
    throw new Error("UI scale cannot be resolved without documentElement.")
  }
  const raw = getComputedStyle(root).getPropertyValue("--ui-scale").trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`UI scale resolved to invalid value: ${raw}`)
  }
  return value
}

export function layoutTokenPx(name: string): number {
  return createLayoutTokenResolver().tokenPx(name)
}

export function layoutTokenNumber(name: string): number {
  return createLayoutTokenResolver().tokenNumber(name)
}

function resolveProbeWidth(signature: string, cacheKey: string, width: string): number {
  const cached = layoutTokenCache.get(cacheKey)
  if (cached?.signature === signature) return cached.value

  const probe = probeElement()
  probe.style.width = "0px"
  probe.style.width = width
  const value = probe.getBoundingClientRect().width
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Layout token ${cacheKey} resolved to invalid width: ${value}`)
  }
  layoutTokenCache.set(cacheKey, { signature, value })
  return value
}

export function createLayoutTokenResolver(): LayoutTokenResolver {
  if (typeof document === "undefined") {
    throw new Error("Layout token resolution requires a document.")
  }
  const root = document.documentElement
  if (!root) {
    throw new Error("Layout token resolution requires documentElement.")
  }
  const signature = tokenSignature(root, document.body)

  return {
    tokenNumber(name: string): number {
      return resolveProbeWidth(signature, `number:${name}`, `calc(var(${name}) * 1px)`)
    },
    tokenPx(name: string): number {
      return resolveProbeWidth(signature, `px:${name}`, `var(${name})`)
    },
  }
}
