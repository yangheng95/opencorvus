export const PERF_INIT_SCRIPT = String.raw`
;(function () {
  if (window.__mcpPerfInit) return
  window.__mcpPerfInit = true

  const send = (type, name, value) => {
    const fn = window.__mcpPerf
    if (typeof fn !== "function") return
    fn({ type, name, value })
  }

  const sendLong = (duration, at) => {
    const fn = window.__mcpPerf
    if (typeof fn !== "function") return
    fn({ type: "longtask", duration, at })
  }

  const Obs = window.PerformanceObserver
  const types = (Obs && Obs.supportedEntryTypes) || []

  if (Obs && types.includes("largest-contentful-paint")) {
    const obs = new Obs((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1]
      if (!last || typeof last.startTime !== "number") return
      send("vital", "lcp", last.startTime)
    })
    obs.observe({ type: "largest-contentful-paint", buffered: true })
  }

  if (Obs && types.includes("layout-shift")) {
    let cls = 0
    const obs = new Obs((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue
        if (typeof e.value === "number") cls += e.value
      }
      send("vital", "cls", cls)
    })
    obs.observe({ type: "layout-shift", buffered: true })
  }

  if (Obs && types.includes("event")) {
    let inp = 0
    const obs = new Obs((list) => {
      for (const e of list.getEntries()) {
        if (!e.interactionId) continue
        if (typeof e.duration === "number" && e.duration > inp) inp = e.duration
      }
      if (inp > 0) send("vital", "inp", inp)
    })
    obs.observe({ type: "event", buffered: true, durationThreshold: 40 })
  }

  if (Obs && types.includes("paint")) {
    const obs = new Obs((list) => {
      for (const e of list.getEntries()) {
        if (e.name !== "first-contentful-paint") continue
        if (typeof e.startTime === "number") send("vital", "fcp", e.startTime)
      }
    })
    obs.observe({ type: "paint", buffered: true })
  }

  if (Obs && types.includes("longtask")) {
    const obs = new Obs((list) => {
      for (const e of list.getEntries()) {
        if (typeof e.duration === "number") sendLong(e.duration, performance.timeOrigin + e.startTime)
      }
    })
    obs.observe({ type: "longtask", buffered: true })
  }

  const nav = performance.getEntriesByType("navigation")[0]
  if (nav && typeof nav.responseStart === "number") send("vital", "ttfb", nav.responseStart)
  if (nav && typeof nav.duration === "number") send("nav", "duration", nav.duration)
  if (nav && typeof nav.domContentLoadedEventEnd === "number") send("nav", "dom", nav.domContentLoadedEventEnd)
  if (nav && typeof nav.loadEventEnd === "number") send("nav", "load", nav.loadEventEnd)
  if (typeof location?.href === "string") send("nav", "url", location.href)
})()
`

export const VIRTUAL_CURSOR_SCRIPT = String.raw`
;(function () {
  const isTop = window === window.top
  let output

  if (isTop) {
    if (window.__vtCursor) return
    const el = document.createElement("div")
    el.id = "__vt-cursor__"
    el.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:20px",
      "height:20px",
      "pointer-events:none",
      "z-index:2147483647",
      "transform:translate(-2px,-2px)",
      "background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E%3Cpolygon points='2,2 2,16 6,12 9,18 11,17 8,11 13,11' fill='white' stroke='black' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E\")",
      "background-repeat:no-repeat",
      "background-size:contain",
    ].join(";")
    const attach = () => document.body.appendChild(el)
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", attach) : attach()
    output = (x, y) => {
      el.style.left = x + "px"
      el.style.top = y + "px"
    }
    window.__vtCursor = { el }
  } else {
    output = (x, y) => window.parent.postMessage({ __vtCursorMove: { x, y } }, "*")
  }

  document.addEventListener("mousemove", (e) => output(e.clientX, e.clientY))

  window.addEventListener("message", (e) => {
    if (!e.data || !e.data.__vtCursorMove) return
    const sourceFrame = [...document.querySelectorAll("iframe")].find((f) => f.contentWindow === e.source)
    if (!sourceFrame) return
    const rect = sourceFrame.getBoundingClientRect()
    output(rect.left + e.data.__vtCursorMove.x, rect.top + e.data.__vtCursorMove.y)
  })
})()
`
