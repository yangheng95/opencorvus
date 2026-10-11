// Temporary observer attribution for the isolated 295 real-page investigation.
// It preserves the native observer and callback scheduling; no content is read.
type Size = { width: number; height: number }
type Trace = { at: number; label: string; targets: { element: string; before: Size; after: Size }[] }
const recent: Trace[] = []
const size = (element: Element): Size => {
  const rect = element.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

export function traceResize295(label: string, callback: ResizeObserverCallback): ResizeObserverCallback {
  return (entries, observer) => {
    const elements = new Set<Element>()
    for (const { target } of entries) {
      elements.add(target)
      if (target.parentElement) elements.add(target.parentElement)
      if (target.parentElement?.parentElement) elements.add(target.parentElement.parentElement)
    }
    const targets = [...elements].map((target) => ({
      element: `${target.tagName}#${target.id}.${target.getAttribute("class") ?? ""}`,
      before: size(target),
      target,
    }))
    try {
      callback.call(observer, entries, observer)
    } finally {
      recent.push({ at: performance.now(), label, targets: targets.map(({ element, before, target }) => ({ element, before, after: size(target) })) })
      if (recent.length > 24) recent.splice(0, recent.length - 24)
    }
  }
}

export function recentResize295(): { at: number; recent: Trace[] } {
  return { at: performance.now(), recent: recent.slice() }
}
