import type { OverlayPage } from "../../overlay/test/launch"

type NavigationAction<T> = () => Promise<T>

type ActivityPayload = {
  url?: () => string
  text?: () => string
  message?: string
  errorText?: string
}

function activityLabel(event: string, payload: unknown): string {
  const record = payload as ActivityPayload | undefined
  if (record?.url) return `${event} ${record.url()}`
  if (typeof record?.message === "string") return `${event} ${record.message}`
  if (typeof record?.errorText === "string") return `${event} ${record.errorText}`
  if (record?.text) return `${event} ${record.text()}`
  return event
}

export async function withBrowserInactivityTimeout<T>(
  page: OverlayPage,
  label: string,
  inactivityTimeoutMs: number,
  action: NavigationAction<T>,
): Promise<T> {
  let settled = false
  let lastActivity = "start"
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectInactive: ((error: Error) => void) | undefined
  const inactive = new Promise<never>((_, reject) => {
    rejectInactive = reject
  })
  const clearTimer = () => {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  const reset = (source: string) => {
    if (settled) return
    lastActivity = source
    clearTimer()
    timer = setTimeout(() => {
      rejectInactive?.(new Error(`${label} browser inactive for ${inactivityTimeoutMs}ms after ${lastActivity}`))
    }, inactivityTimeoutMs)
  }
  const fail = (source: string) => {
    if (settled) return
    lastActivity = source
    clearTimer()
    rejectInactive?.(new Error(`${label} browser error before idle: ${source}`))
  }
  const onConsole = (payload: unknown) => reset(activityLabel("console", payload))
  const onResponse = (payload: unknown) => {
    const response = payload as { status?: () => number }
    if (typeof response.status === "function" && response.status() >= 400) {
      fail(activityLabel("response", payload))
      return
    }
    reset(activityLabel("response", payload))
  }
  const onRequestFailed = (payload: unknown) => fail(activityLabel("requestfailed", payload))
  const onPageError = (payload: unknown) => fail(activityLabel("pageerror", payload))
  page.on("console", onConsole)
  page.on("response", onResponse)
  page.on("requestfailed", onRequestFailed)
  page.on("pageerror", onPageError)
  reset("start")
  try {
    return await Promise.race([action(), inactive])
  } finally {
    settled = true
    clearTimer()
    page.off("console", onConsole)
    page.off("response", onResponse)
    page.off("requestfailed", onRequestFailed)
    page.off("pageerror", onPageError)
  }
}

export async function gotoWithBrowserInactivity(
  page: OverlayPage,
  url: string,
  waitUntil: string,
  inactivityTimeoutMs: number,
): Promise<unknown> {
  return await withBrowserInactivityTimeout(page, `goto ${url}`, inactivityTimeoutMs, () =>
    page.goto(url, { waitUntil, timeout: 0 }),
  )
}

export async function reloadWithBrowserInactivity(
  page: OverlayPage,
  waitUntil: string,
  inactivityTimeoutMs: number,
): Promise<unknown> {
  return await withBrowserInactivityTimeout(page, "reload", inactivityTimeoutMs, () =>
    page.reload({ waitUntil, timeout: 0 }),
  )
}
