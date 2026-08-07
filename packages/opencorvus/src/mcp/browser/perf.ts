import { PERF_INIT_SCRIPT } from "./scripts"

type Page = any

// ── Public types ──────────────────────────────────────────────────────────────

export type PerfIssue = {
  kind: "net_fail" | "slow" | "long_task" | "lcp" | "cls" | "inp" | "ttfb" | "redirect"
  msg: string
  nearStep?: string
  thirdParty?: boolean
}

export type PerfResult = {
  ok: boolean // true = no same-origin issues
  windowMs: number // duration ms (not epoch)
  requests: { total: number; failed: number; slow: number }
  longTasks: { count: number; maxMs: number; p95Ms: number; totalBlockedMs: number } | null
  vitals: { lcp?: number; cls?: number; inp?: number; fcp?: number; ttfb?: number }
  issues: PerfIssue[]
}

export type PerfNetItem = {
  url: string
  type: string
  ttfb: number
  total: number
  status?: number
  size?: number
  error?: string
}

type PerfLongItem = {
  at: number
  duration: number
}

type PerfRedirectItem = {
  url: string
  status: number
}

export type PerfState = {
  start: number
  end: number
  vitals: { lcp?: number; cls?: number; inp?: number; fcp?: number; ttfb?: number }
  longtask: { count: number; max: number; sum: number; list: PerfLongItem[] }
  net: { req: number; fail: number; slow: number; slowList: PerfNetItem[]; failList: PerfNetItem[] }
  nav: { duration?: number; dom?: number; load?: number; url?: string; redirects: PerfRedirectItem[] }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// beacon/ping = 几乎必然是第三方分析请求；有 baseURL 时对比 origin
export const isThirdParty = (url: string, resourceType: string, baseURL?: string): boolean => {
  if (resourceType === "beacon" || resourceType === "ping") return true
  if (!baseURL) return false
  try {
    return new URL(url).origin !== new URL(baseURL).origin
  } catch {
    return false
  }
}

// 供 get_perf 工具和 per_tool 注入使用的文本摘要（只展示 same-origin issues）
export const formatPerfText = (result: PerfResult): string => {
  const own = result.issues.filter((i) => !i.thirdParty)
  const head = `(${(result.windowMs / 1000).toFixed(1)}s, ${result.requests.total} req)`
  if (own.length === 0) return `ok ${head}`
  const lines = own.map(
    (i) => ` ${i.kind.toUpperCase().padEnd(9)} ${i.msg}${i.nearStep ? ` [after: ${i.nearStep}]` : ""}`,
  )
  return `${own.length} issue${own.length > 1 ? "s" : ""} ${head}:\n${lines.join("\n")}`
}

// ── State factory ─────────────────────────────────────────────────────────────

export const createPerf = (now: number): PerfState => ({
  start: now,
  end: now,
  vitals: {},
  longtask: { count: 0, max: 0, sum: 0, list: [] },
  net: { req: 0, fail: 0, slow: 0, slowList: [], failList: [] },
  nav: { redirects: [] },
})

// ── Page instrumentation ──────────────────────────────────────────────────────

export const initPerf = async (page: Page, perf: PerfState) => {
  await page.exposeBinding("__mcpPerf", (_src, data) => {
    perf.end = Date.now()
    if (!data || typeof data !== "object") return
    const d = data as { type?: string; name?: string; value?: number | string; duration?: number; at?: number }
    if (d.type === "vital") {
      if (d.name === "lcp") perf.vitals.lcp = d.value as number
      if (d.name === "cls") perf.vitals.cls = d.value as number
      if (d.name === "inp") perf.vitals.inp = d.value as number
      if (d.name === "fcp") perf.vitals.fcp = d.value as number
      if (d.name === "ttfb") perf.vitals.ttfb = d.value as number
      return
    }
    if (d.type === "nav") {
      if (d.name === "duration" && typeof d.value === "number") perf.nav.duration = d.value
      if (d.name === "dom" && typeof d.value === "number") perf.nav.dom = d.value
      if (d.name === "load" && typeof d.value === "number") perf.nav.load = d.value
      if (d.name === "url" && typeof d.value === "string") perf.nav.url = d.value
      return
    }
    if (d.type === "longtask") {
      const val = Number(d.duration) || 0
      const at = typeof d.at === "number" ? d.at : Date.now()
      perf.longtask.count += 1
      perf.longtask.sum += val
      if (val > perf.longtask.max) perf.longtask.max = val
      perf.longtask.list.push({ at, duration: val })
      if (perf.longtask.list.length > 50) perf.longtask.list.shift()
    }
  })

  await page.addInitScript({ content: PERF_INIT_SCRIPT })

  page.on("requestfailed", (req) => {
    perf.end = Date.now()
    perf.net.fail += 1
    perf.net.failList.push({
      url: req.url(),
      type: req.resourceType(),
      ttfb: 0,
      total: 0,
      error: req.failure()?.errorText,
    })
    if (perf.net.failList.length > 20) perf.net.failList.shift()
  })

  page.on("response", (res) => {
    perf.end = Date.now()
    type WithTiming = { timing: () => { requestStart: number; responseStart: number; responseEnd: number } }
    const timing =
      typeof (res as unknown as WithTiming).timing === "function"
        ? (res as unknown as WithTiming).timing()
        : typeof (res.request() as unknown as WithTiming).timing === "function"
          ? (res.request() as unknown as WithTiming).timing()
          : null
    perf.net.req += 1
    const status = res.status()
    if (status >= 300 && status < 400 && res.request().resourceType() === "document") {
      perf.nav.redirects.push({ url: res.url(), status })
      if (perf.nav.redirects.length > 10) perf.nav.redirects.shift()
    }
    if (status >= 400) {
      perf.net.fail += 1
      perf.net.failList.push({
        url: res.url(),
        type: res.request().resourceType(),
        ttfb: 0,
        total: 0,
        status,
      })
      if (perf.net.failList.length > 20) perf.net.failList.shift()
    }
    if (!timing) return
    const ttfb = Math.max(0, timing.responseStart - timing.requestStart)
    const total = Math.max(0, timing.responseEnd - timing.requestStart)
    if (total <= 2000 && ttfb <= 800) return
    perf.net.slow += 1
    perf.net.slowList.push({
      url: res.url(),
      type: res.request().resourceType(),
      ttfb,
      total: total > 0 ? total : 0,
      status,
      size: Number(res.headers()["content-length"] ?? 0) || undefined,
    })
    if (perf.net.slowList.length > 20) perf.net.slowList.shift()
  })
}

// ── Result builder ────────────────────────────────────────────────────────────

export const getPerf = (perf: PerfState, tools: { tool: string; at: number }[], baseURL?: string): PerfResult => {
  const issues: PerfIssue[] = []

  // 失败请求（最近 5 条）
  for (const f of perf.net.failList.slice(-5)) {
    const tp = isThirdParty(f.url, f.type, baseURL)
    const status = f.status ? ` ${f.status}` : ""
    const err = f.error ? ` (${f.error})` : ""
    issues.push({ kind: "net_fail", msg: `${f.url}${status}${err}`, thirdParty: tp || undefined })
  }

  // 慢请求（最近 3 条）
  for (const s of perf.net.slowList.slice(-3)) {
    const tp = isThirdParty(s.url, s.type, baseURL)
    const total = s.total > 0 ? `${Math.round(s.total)}ms` : ""
    const ttfb = s.ttfb > 0 ? ` ttfb=${Math.round(s.ttfb)}ms` : ""
    issues.push({ kind: "slow", msg: `${s.url} ${total}${ttfb}`.trim(), thirdParty: tp || undefined })
  }

  // 重定向
  for (const r of perf.nav.redirects.slice(-3)) {
    issues.push({ kind: "redirect", msg: `${r.url} → ${r.status}` })
  }

  // Long tasks
  let longTasks: PerfResult["longTasks"] = null
  if (perf.longtask.count > 0) {
    const durations = perf.longtask.list.map((i) => i.duration).sort((a, b) => a - b)
    const p95 =
      durations.length === 0 ? 0 : durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
    longTasks = {
      count: perf.longtask.count,
      maxMs: Math.round(perf.longtask.max),
      p95Ms: Math.round(p95),
      totalBlockedMs: Math.round(perf.longtask.sum),
    }
    if (perf.longtask.max > 100) {
      // 找最长 task 附近的工具调用
      const worst = perf.longtask.list.slice().sort((a, b) => b.duration - a.duration)[0]
      const nearStep = worst ? tools.filter((t) => t.at <= worst.at).slice(-1)[0]?.tool : undefined
      issues.push({
        kind: "long_task",
        msg: `${perf.longtask.count} tasks max=${longTasks.maxMs}ms p95=${longTasks.p95Ms}ms total=${longTasks.totalBlockedMs}ms`,
        nearStep,
      })
    }
  }

  // Web Vitals
  const { vitals } = perf
  if (vitals.inp && vitals.inp > 200) issues.push({ kind: "inp", msg: `${Math.round(vitals.inp)}ms` })
  if (vitals.lcp && vitals.lcp > 2500) issues.push({ kind: "lcp", msg: `${Math.round(vitals.lcp)}ms` })
  if (vitals.cls && vitals.cls > 0.1) issues.push({ kind: "cls", msg: vitals.cls.toFixed(2) })
  if (vitals.ttfb && vitals.ttfb > 800) issues.push({ kind: "ttfb", msg: `${Math.round(vitals.ttfb)}ms` })

  const ownIssues = issues.filter((i) => !i.thirdParty)
  return {
    ok: ownIssues.length === 0,
    windowMs: Math.max(0, perf.end - perf.start),
    requests: { total: perf.net.req, failed: perf.net.fail, slow: perf.net.slow },
    longTasks,
    vitals: perf.vitals,
    issues,
  }
}
