import { BrowserRuntime } from "@/browser/runtime"
import { createPerf, getPerf as buildPerf, initPerf, isThirdParty, type PerfState } from "./perf.js"
import { VIRTUAL_CURSOR_SCRIPT } from "./scripts"

type Browser = any
type BrowserContext = any
type Page = any

export type ToolCallEntry = {
  tool: string
  at: number
  ms: number
  status: "ok" | "error" | "running"
  args: Record<string, unknown>
}

export type PerfMode = "close" | "silent" | "per_tool"

export type PerfSnap = {
  failListLen: number
  slowListLen: number
  longListLen: number
}

export type BrowserDiagnostics = {
  consoleErrors: Array<{ type: string; text: string; url?: string; lineNumber?: number; columnNumber?: number }>
  pageErrors: Array<{ message: string; stack?: string }>
  failedRequests: Array<{ url: string; method: string; resourceType: string; reason: string }>
  httpErrors: Array<{ url: string; status: number; statusText: string; resourceType: string }>
}

export type DialogPolicy = { action: "dismiss" | "accept"; promptText?: string }

export type DialogEntry = {
  at: number
  type: string
  message: string
  defaultValue: string
  action: DialogPolicy["action"]
  url: string
}

export type DownloadEntry = {
  at: number
  suggestedFilename: string
  path: string
  url: string
}

export type SessionTermination = {
  sessionId: string
  profileId: string
  reason: "page_closed" | "context_closed" | "browser_disconnected" | "destroyed"
  at: number
  url: string
  message: string
}

export type PreserveProfile = "30s" | "30min" | "2h" | "1d" | undefined

type Profile = {
  context: BrowserContext
  createdAt: number
  lastActive: number
  sessionIds: Set<string>
  expiresAt?: number
  viewport: { width: number; height: number }
  baseURL?: string
}

type Session = {
  profileId: string
  page: Page
  viewport: { width: number; height: number }
  createdAt: number
  lastActive: number
  toolCalls: ToolCallEntry[]
  virtualCursor: boolean
  perf: PerfState | null
  perfMode: PerfMode
  diagnostics: BrowserDiagnostics
  dialogPolicy: DialogPolicy
  dialogs: DialogEntry[]
  downloads: DownloadEntry[]
  baseURL?: string
}

type BrowserStorageState = Awaited<ReturnType<BrowserContext["storageState"]>>

type PageSessionOpts = {
  virtualCursor: boolean
  perfMode: PerfMode
}

export type TabInfo = {
  index: number
  sessionId: string
  profileId: string
  url: string
  title: string
  active: boolean
}

const sessions = new Map<string, Session>()
const profiles = new Map<string, Profile>()
const profileLocks = new Map<string, Promise<void>>()
const sessionOperationLocks = new Map<string, Promise<void>>()
const terminatedSessions = new Map<string, SessionTermination>()
const intentionalSessionClose = new Set<string>()
let browser: Browser | null = null
let browserLaunch: Promise<Browser> | null = null
let browserShutdownGeneration = 0

const log = (msg: string) => console.error(`[browser-mcp] ${new Date().toISOString()} ${msg}`)

export const resolveBrowserMcpHeadless = (
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): boolean => {
  const configured = env.BROWSER_HEADLESS?.trim().toLowerCase()
  if (configured === "true") return true
  if (configured === "false") return false
  return platform === "linux" && !env.DISPLAY?.trim() && !env.WAYLAND_DISPLAY?.trim()
}

const HEADLESS = resolveBrowserMcpHeadless()
const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MIN ?? 30) * 60 * 1000

const acquireBrowser = async (): Promise<Browser> => {
  if (browser?.isConnected()) return browser
  browser = null
  if (!browserLaunch) {
    const launchGeneration = browserShutdownGeneration
    browserLaunch = BrowserRuntime.launchPlaywrightBrowserInNodeProcess({
      headless: HEADLESS,
      args: BrowserRuntime.defaultLaunchArgs({ env: {} }),
    })
      .then(async (launched) => {
        if (launchGeneration !== browserShutdownGeneration) {
          await launched.close().catch(() => {})
          throw new Error("Browser launch cancelled by shutdown")
        }
        browser = launched
        launched.on("disconnected", () => {
          if (browser === launched) browser = null
          markAllSessionsTerminated("browser_disconnected", "Browser process disconnected")
        })
        return launched
      })
      .finally(() => {
        browserLaunch = null
      })
  }
  return browserLaunch
}

export type SessionCreateOpts = {
  profileId?: string
  viewport?: { width: number; height: number }
  userAgent?: string
  baseURL?: string
  proxy?: { server: string; bypass?: string; username?: string; password?: string }
  hosts?: Record<string, string>
  virtualCursor?: boolean
  perf?: PerfMode
  storageState?: BrowserStorageState
}

const parseDuration = (value: PreserveProfile) => {
  if (!value) return 0
  return {
    "30s": 30_000,
    "30min": 1_800_000,
    "2h": 7_200_000,
    "1d": 86_400_000,
  }[value]
}

const withProfileLock = async <T>(profileId: string, fn: () => Promise<T>): Promise<T> => {
  const previous = profileLocks.get(profileId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const current = previous.catch(() => {}).then(() => gate)
  profileLocks.set(profileId, current)
  await previous.catch(() => {})
  try {
    return await fn()
  } finally {
    release()
    if (profileLocks.get(profileId) === current) profileLocks.delete(profileId)
  }
}

export const withSessionOperationLock = async <T>(sessionId: string, fn: () => Promise<T>): Promise<T> => {
  const previous = sessionOperationLocks.get(sessionId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const current = previous.catch(() => {}).then(() => gate)
  sessionOperationLocks.set(sessionId, current)
  await previous.catch(() => {})
  try {
    return await fn()
  } finally {
    release()
    if (sessionOperationLocks.get(sessionId) === current) sessionOperationLocks.delete(sessionId)
  }
}

const closeProfileLocked = async (profileId: string, expectedProfile?: Profile) => {
  const profile = profiles.get(profileId)
  if (!profile || (expectedProfile && profile !== expectedProfile)) return false
  await profile.context.close()
  for (const sessionId of [...profile.sessionIds]) {
    sessions.delete(sessionId)
    sessionOperationLocks.delete(sessionId)
  }
  if (profiles.get(profileId) === profile) profiles.delete(profileId)
  return true
}

const closeProfile = (profileId: string) => withProfileLock(profileId, () => closeProfileLocked(profileId))

const closeEmptyProfile = (profileId: string, expectedProfile: Profile) =>
  withProfileLock(profileId, async () => {
    const profile = profiles.get(profileId)
    if (profile !== expectedProfile || profile.sessionIds.size !== 0) return false
    return closeProfileLocked(profileId, expectedProfile)
  })

const closeExpiredProfile = (profileId: string, expectedProfile: Profile, now: number) =>
  withProfileLock(profileId, async () => {
    const profile = profiles.get(profileId)
    if (
      profile !== expectedProfile ||
      profile.sessionIds.size !== 0 ||
      !profile.expiresAt ||
      profile.expiresAt > now
    ) {
      return false
    }
    return closeProfileLocked(profileId, expectedProfile)
  })

const getReusableProfile = async (profileId: string) => {
  const profile = profiles.get(profileId)
  if (!profile) throw new Error(`Profile not found or expired: ${profileId}`)
  if (profile.expiresAt && profile.expiresAt <= Date.now()) {
    await closeProfileLocked(profileId, profile)
    throw new Error(`Profile not found or expired: ${profileId}`)
  }
  profile.expiresAt = undefined
  profile.lastActive = Date.now()
  return profile
}

const createProfile = async (opts: SessionCreateOpts, now: number) => {
  const b = await acquireBrowser()
  const proxy = opts.proxy
  const profileId = "prof_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  const viewport = opts.viewport ?? { width: 1280, height: 720 }
  const context = await b.newContext({
    viewport,
    userAgent: opts.userAgent,
    baseURL: opts.baseURL,
    storageState: opts.storageState,
    acceptDownloads: true,
    ...(proxy ? { proxy } : {}),
  })
  if (opts.hosts) {
    const entries = Object.entries(opts.hosts)
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url())
      const mapped = entries.find(([hostname]) => hostname === url.hostname)
      if (!mapped) return route.continue()
      url.hostname = mapped[1]
      route.continue({ url: url.toString() })
    })
  }
  profiles.set(profileId, {
    context,
    createdAt: now,
    lastActive: now,
    sessionIds: new Set(),
    viewport,
    baseURL: opts.baseURL,
  })
  context.on("close", () => {
    const profile = profiles.get(profileId)
    if (!profile) return
    for (const sessionId of [...profile.sessionIds]) {
      detachSession(sessionId, "context_closed", "Browser context closed")
    }
    profiles.delete(profileId)
  })
  return { profileId, profile: profiles.get(profileId)! }
}

const setupPage = async (page: Page, opts: PageSessionOpts) => {
  if (opts.virtualCursor) {
    await page.addInitScript({ content: VIRTUAL_CURSOR_SCRIPT })
  }
  const perf = opts.perfMode !== "close" ? createPerf(Date.now()) : null
  if (perf) await initPerf(page, perf)
  return perf
}

const createDiagnostics = (): BrowserDiagnostics => ({
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  httpErrors: [],
})

const defaultDialogPolicy = (): DialogPolicy => ({ action: "dismiss" })

const pushCapped = <T>(items: T[], item: T, limit = 100) => {
  items.push(item)
  if (items.length > limit) items.splice(0, items.length - limit)
}

const rememberTermination = (
  sessionId: string,
  session: Session,
  input: Omit<SessionTermination, "sessionId" | "profileId" | "at" | "url">,
) => {
  terminatedSessions.set(sessionId, {
    sessionId,
    profileId: session.profileId,
    at: Date.now(),
    url: session.page.url(),
    ...input,
  })
  if (terminatedSessions.size > 500) {
    const first = terminatedSessions.keys().next().value
    if (first) terminatedSessions.delete(first)
  }
}

const detachSession = (sessionId: string, reason: SessionTermination["reason"], message: string) => {
  const session = sessions.get(sessionId)
  if (!session) return
  if (reason !== "destroyed") rememberTermination(sessionId, session, { reason, message })
  sessions.delete(sessionId)
  sessionOperationLocks.delete(sessionId)
  const profile = profiles.get(session.profileId)
  profile?.sessionIds.delete(sessionId)
  if (reason !== "destroyed" && profile?.sessionIds.size === 0) {
    void closeEmptyProfile(session.profileId, profile).catch((error) => {
      log(
        `empty profile cleanup failed  ${session.profileId}  ${error instanceof Error ? error.message : String(error)}`,
      )
    })
  }
}

const markAllSessionsTerminated = (reason: SessionTermination["reason"], message: string) => {
  for (const sessionId of [...sessions.keys()]) detachSession(sessionId, reason, message)
  profiles.clear()
}

const attachDiagnostics = (sessionId: string, page: Page) => {
  page.on("console", (message) => {
    if (!["error", "warning"].includes(message.type())) return
    const session = sessions.get(sessionId)
    if (!session) return
    const location = message.location()
    pushCapped(session.diagnostics.consoleErrors, {
      type: message.type(),
      text: message.text(),
      url: location.url || undefined,
      lineNumber: location.lineNumber || undefined,
      columnNumber: location.columnNumber || undefined,
    })
  })

  page.on("pageerror", (error) => {
    const session = sessions.get(sessionId)
    if (!session) return
    pushCapped(session.diagnostics.pageErrors, {
      message: error.message,
      stack: error.stack,
    })
  })

  page.on("requestfailed", (request) => {
    const session = sessions.get(sessionId)
    if (!session) return
    pushCapped(session.diagnostics.failedRequests, {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      reason: request.failure()?.errorText ?? "unknown",
    })
  })

  page.on("response", (response) => {
    if (response.status() < 400) return
    const session = sessions.get(sessionId)
    if (!session) return
    const request = response.request()
    pushCapped(session.diagnostics.httpErrors, {
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      resourceType: request.resourceType(),
    })
  })

  page.on("dialog", async (dialog) => {
    const session = sessions.get(sessionId)
    const policy = session?.dialogPolicy ?? defaultDialogPolicy()
    if (session) {
      pushCapped(session.dialogs, {
        at: Date.now(),
        type: dialog.type(),
        message: dialog.message(),
        defaultValue: dialog.defaultValue(),
        action: policy.action,
        url: page.url(),
      })
    }
    try {
      if (policy.action === "accept") {
        await dialog.accept(policy.promptText)
      } else {
        await dialog.dismiss()
      }
    } catch {}
  })
}

export const adoptPage = async (profileId: string, page: Page, opts: PageSessionOpts) => {
  const existing = [...sessions.entries()].find(([, session]) => session.page === page)
  if (existing) return { sessionId: existing[0], profileId, existing: true }
  const profile = profiles.get(profileId)
  if (!profile) throw new Error(`Profile not found or expired: ${profileId}`)
  const now = Date.now()
  const sessionId = "sess_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  const perf = await setupPage(page, opts)
  profile.sessionIds.add(sessionId)
  profile.lastActive = now
  sessions.set(sessionId, {
    profileId,
    page,
    viewport: profile.viewport,
    createdAt: now,
    lastActive: now,
    toolCalls: [],
    virtualCursor: opts.virtualCursor,
    perf,
    perfMode: opts.perfMode,
    diagnostics: createDiagnostics(),
    dialogPolicy: defaultDialogPolicy(),
    dialogs: [],
    downloads: [],
    baseURL: profile.baseURL,
  })
  attachDiagnostics(sessionId, page)
  page.on("close", () => {
    const intentional = intentionalSessionClose.delete(sessionId)
    detachSession(
      sessionId,
      intentional ? "destroyed" : "page_closed",
      intentional ? "Session destroyed" : "Page closed unexpectedly",
    )
  })
  creationLog.push(now)
  log(`page adopted     ${sessionId}  profile=${profileId}  url=${page.url()}  perf=${opts.perfMode}`)
  return { sessionId, profileId, existing: false }
}

export const createSession = async (opts: SessionCreateOpts) => {
  const now = Date.now()
  if (opts.profileId) {
    return withProfileLock(opts.profileId, async () => {
      const profile = await getReusableProfile(opts.profileId!)
      return createSessionForProfile(opts, now, { profileId: opts.profileId!, profile }, false)
    })
  }
  const target = await createProfile(opts, now)
  return createSessionForProfile(opts, now, target, true)
}

const createSessionForProfile = async (
  opts: SessionCreateOpts,
  now: number,
  target: { profileId: string; profile: Profile },
  createdProfile: boolean,
) => {
  let page: Page | undefined
  try {
    page = await target.profile.context.newPage()
    const virtualCursor = opts.virtualCursor ?? true
    const sessionId = "sess_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    const perfMode = opts.perf ?? "close"
    const perf = await setupPage(page, { virtualCursor, perfMode })
    target.profile.sessionIds.add(sessionId)
    target.profile.lastActive = now
    sessions.set(sessionId, {
      profileId: target.profileId,
      page,
      viewport: target.profile.viewport,
      createdAt: now,
      lastActive: now,
      toolCalls: [],
      virtualCursor,
      perf,
      perfMode,
      diagnostics: createDiagnostics(),
      dialogPolicy: defaultDialogPolicy(),
      dialogs: [],
      downloads: [],
      baseURL: target.profile.baseURL,
    })
    attachDiagnostics(sessionId, page)
    page.on("close", () => {
      const intentional = intentionalSessionClose.delete(sessionId)
      detachSession(
        sessionId,
        intentional ? "destroyed" : "page_closed",
        intentional ? "Session destroyed" : "Page closed unexpectedly",
      )
    })
    creationLog.push(now)
    log(
      `session created  ${sessionId}  profile=${target.profileId}  viewport=${JSON.stringify(target.profile.viewport)}  perf=${perfMode}`,
    )
    return { sessionId, profileId: target.profileId }
  } catch (e) {
    await page?.close().catch(() => {})
    if (createdProfile) await closeProfile(target.profileId)
    throw e
  }
}

export const createTab = async (sessionId: string) => {
  const session = getSession(sessionId)
  const result = await createSession({
    profileId: session.profileId,
    virtualCursor: session.virtualCursor,
    perf: session.perfMode,
  })
  return getTabInfo(result.sessionId, result.sessionId)
}

export const destroySession = async (sessionId: string, preserveProfile?: PreserveProfile) => {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Session not found: ${sessionId}`)
  return withProfileLock(session.profileId, () => destroySessionLocked(sessionId, preserveProfile))
}

const destroySessionLocked = async (sessionId: string, preserveProfile?: PreserveProfile) => {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Session not found: ${sessionId}`)
  const profile = profiles.get(session.profileId)
  const url = session.page.url()
  intentionalSessionClose.add(sessionId)
  try {
    await session.page.close()
  } catch (error) {
    intentionalSessionClose.delete(sessionId)
    throw error
  }
  sessions.delete(sessionId)
  sessionOperationLocks.delete(sessionId)
  profile?.sessionIds.delete(sessionId)
  if (!profile) return { profileId: session.profileId, profilePreserved: false }
  profile.lastActive = Date.now()
  if (profile.sessionIds.size > 0) {
    log(
      `session destroyed ${sessionId}  profile=${session.profileId}  url=${url}  remaining=${profile.sessionIds.size}`,
    )
    return { profileId: session.profileId, profilePreserved: true }
  }
  const ttl = parseDuration(preserveProfile)
  if (ttl > 0) {
    profile.expiresAt = Date.now() + ttl
    log(`session destroyed ${sessionId}  profile=${session.profileId}  url=${url}  preserve=${ttl}ms`)
    return { profileId: session.profileId, profilePreserved: true, profileExpiresAt: profile.expiresAt }
  }
  await closeProfileLocked(session.profileId, profile)
  log(`session destroyed ${sessionId}  profile=${session.profileId}  url=${url}  profileClosed=true`)
  return { profileId: session.profileId, profilePreserved: false }
}

export const getSession = (sessionId: string) => {
  const session = sessions.get(sessionId)
  if (!session) {
    const terminated = terminatedSessions.get(sessionId)
    if (terminated) throw new Error(`Session unavailable: ${sessionId} (${terminated.reason}) ${terminated.message}`)
    throw new Error(`Session not found: ${sessionId}`)
  }
  session.lastActive = Date.now()
  const profile = profiles.get(session.profileId)
  if (profile) profile.lastActive = session.lastActive
  return session
}

export const getSessionStatus = (sessionId: string) => {
  const session = sessions.get(sessionId)
  if (session) {
    return {
      sessionId,
      profileId: session.profileId,
      status: "active" as const,
      url: session.page.url(),
      lastActive: session.lastActive,
      dialogPolicy: session.dialogPolicy,
      dialogCount: session.dialogs.length,
      downloadCount: session.downloads.length,
    }
  }
  const terminated = terminatedSessions.get(sessionId)
  if (terminated) {
    return {
      sessionId,
      profileId: terminated.profileId,
      status: "unavailable" as const,
      reason: terminated.reason,
      message: terminated.message,
      url: terminated.url,
      terminatedAt: terminated.at,
    }
  }
  return { sessionId, status: "not_found" as const }
}

export const getTabInfo = async (sessionId: string, activeSessionId: string): Promise<TabInfo> => {
  const session = getSession(sessionId)
  const profile = profiles.get(session.profileId)
  return {
    index: profile ? profile.context.pages().indexOf(session.page) : -1,
    sessionId,
    profileId: session.profileId,
    url: session.page.url(),
    title: await session.page.title().catch(() => ""),
    active: sessionId === activeSessionId,
  }
}

export const listTabs = async (sessionId: string) => {
  const session = getSession(sessionId)
  const profile = profiles.get(session.profileId)
  if (!profile) throw new Error(`Profile not found or expired: ${session.profileId}`)
  return Promise.all(
    profile.context
      .pages()
      .flatMap((page, index) => {
        const entry = [...sessions.entries()].find(([, candidate]) => candidate.page === page)
        return entry ? [{ sessionId: entry[0], index }] : []
      })
      .map(async (tab) => ({
        ...(await getTabInfo(tab.sessionId, sessionId)),
        index: tab.index,
      })),
  )
}

export const getTabByIndex = (sessionId: string, index: number) => {
  const session = getSession(sessionId)
  const profile = profiles.get(session.profileId)
  if (!profile) throw new Error(`Profile not found or expired: ${session.profileId}`)
  const page = profile.context.pages()[index]
  const entry = page ? [...sessions.entries()].find(([, candidate]) => candidate.page === page) : undefined
  if (!entry) throw new Error(`Tab not found: ${index}`)
  return entry[0]
}

export const recordToolCall = (sessionId: string, entry: ToolCallEntry) => {
  const session = sessions.get(sessionId)
  if (!session) return
  session.toolCalls.push(entry)
  if (session.toolCalls.length > 300) session.toolCalls.shift()
}

export const updateToolCall = (sessionId: string, at: number, updates: Pick<ToolCallEntry, "ms" | "status">) => {
  const session = sessions.get(sessionId)
  if (!session) return
  const entry = [...session.toolCalls].reverse().find((e) => e.at === at)
  if (entry) Object.assign(entry, updates)
}

export const getToolCalls = (sessionId: string): ToolCallEntry[] => sessions.get(sessionId)?.toolCalls ?? []

export const getDiagnostics = (sessionId: string): BrowserDiagnostics => {
  const session = getSession(sessionId)
  return {
    consoleErrors: [...session.diagnostics.consoleErrors],
    pageErrors: [...session.diagnostics.pageErrors],
    failedRequests: [...session.diagnostics.failedRequests],
    httpErrors: [...session.diagnostics.httpErrors],
  }
}

export const setDialogPolicy = (sessionId: string, policy: DialogPolicy) => {
  const session = getSession(sessionId)
  session.dialogPolicy = policy
  return { sessionId, policy }
}

export const getDialogHistory = (sessionId: string) => {
  const session = getSession(sessionId)
  return { sessionId, policy: session.dialogPolicy, dialogs: [...session.dialogs] }
}

export const recordDownload = (sessionId: string, entry: DownloadEntry) => {
  const session = getSession(sessionId)
  pushCapped(session.downloads, entry)
  return entry
}

export const getDownloadHistory = (sessionId: string) => {
  const session = getSession(sessionId)
  return { sessionId, downloads: [...session.downloads] }
}

export const clearSuccessfulDownloadRequestDiagnostic = (sessionId: string, url: string): void => {
  const session = sessions.get(sessionId)
  if (!session) return
  session.diagnostics.failedRequests = session.diagnostics.failedRequests.filter(
    (item) => !(item.url === url && item.reason === "net::ERR_ABORTED"),
  )
}

export const setViewport = async (sessionId: string, viewport: { width: number; height: number }) => {
  const session = getSession(sessionId)
  await session.page.setViewportSize(viewport)
  session.viewport = viewport
  const profile = profiles.get(session.profileId)
  if (profile) {
    profile.viewport = viewport
    profile.lastActive = Date.now()
  }
  return { sessionId, profileId: session.profileId, viewport }
}

export const exportStorageState = async (sessionId: string) => {
  const session = getSession(sessionId)
  const profile = profiles.get(session.profileId)
  if (!profile) throw new Error(`Profile not found or expired: ${session.profileId}`)
  return {
    sessionId,
    profileId: session.profileId,
    storageState: await profile.context.storageState(),
  }
}

export const getSessions = () =>
  [...sessions.entries()].map(([id, s]) => ({
    id,
    profileId: s.profileId,
    url: s.page.url(),
    createdAt: s.createdAt,
    lastActive: s.lastActive,
  }))

const creationLog: number[] = []

export const getSessionStats = () => {
  const now = Date.now()
  const cutoff31d = now - 31 * 24 * 60 * 60 * 1000
  while (creationLog.length > 0 && creationLog[0] < cutoff31d) creationLog.shift()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const mem = process.memoryUsage()
  const bytes = (n: number) => {
    if (n < 1024) return `${n} B`
    const kb = n / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    return `${(mb / 1024).toFixed(2)} GB`
  }
  return {
    active: sessions.size,
    profiles: profiles.size,
    todayTotal: creationLog.filter((t) => t >= todayStart.getTime()).length,
    monthTotal: creationLog.filter((t) => t >= monthStart.getTime()).length,
    rss: bytes(mem.rss),
    heap: `${bytes(mem.heapUsed)} / ${bytes(mem.heapTotal)}`,
  }
}

export const getPerf = (sessionId: string) => {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Session not found: ${sessionId}`)
  if (!session.perf)
    throw new Error(
      `Perf tracking is disabled for this session. Pass perf: "silent" or "per_tool" when calling session_create.`,
    )
  return buildPerf(session.perf, session.toolCalls, session.baseURL)
}

export const snapshotPerf = (sessionId: string): PerfSnap | null => {
  const session = sessions.get(sessionId)
  if (!session?.perf || session.perfMode !== "per_tool") return null
  return {
    failListLen: session.perf.net.failList.length,
    slowListLen: session.perf.net.slowList.length,
    longListLen: session.perf.longtask.list.length,
  }
}

export const diffPerfText = (sessionId: string, snap: PerfSnap, toolName: string): string | null => {
  const session = sessions.get(sessionId)
  if (!session?.perf) return null

  const newFails = session.perf.net.failList.slice(snap.failListLen)
  const newSlows = session.perf.net.slowList.slice(snap.slowListLen)
  const newLongs = session.perf.longtask.list.slice(snap.longListLen)

  const parts: string[] = []

  for (const f of newFails) {
    if (isThirdParty(f.url, f.type, session.baseURL)) continue
    const status = f.status ? ` ${f.status}` : ""
    const err = f.error ? ` (${f.error})` : ""
    parts.push(`FAIL ${f.url}${status}${err}`)
  }

  for (const s of newSlows) {
    if (isThirdParty(s.url, s.type, session.baseURL)) continue
    const total = s.total > 0 ? `${Math.round(s.total)}ms` : ""
    parts.push(`SLOW ${total} ${s.url}`.trim())
  }

  if (newLongs.length > 0) {
    const max = Math.max(...newLongs.map((l) => l.duration))
    parts.push(`BLOCK ${newLongs.length} long task${newLongs.length > 1 ? "s" : ""} max=${Math.round(max)}ms`)
  }

  return parts.length > 0 ? `[perf/${toolName}] ${parts.join("; ")}` : null
}

setInterval(() => {
  void (async () => {
    const cutoff = Date.now() - SESSION_TIMEOUT_MS
    for (const [id, session] of sessions) {
      if (session.lastActive < cutoff) {
        try {
          await destroySession(id)
          log(`session expired  ${id}  idle=${Math.round(SESSION_TIMEOUT_MS / 60000)}min`)
        } catch (error) {
          log(`session expiration cleanup failed  ${id}  ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    for (const [id, profile] of profiles) {
      if (profile.sessionIds.size === 0 && profile.expiresAt && profile.expiresAt <= Date.now()) {
        await closeExpiredProfile(id, profile, Date.now())
        log(`profile expired  ${id}`)
      }
    }
  })().catch((error) => {
    log(`session cleanup failed  ${error instanceof Error ? error.message : String(error)}`)
  })
}, 60_000).unref()

export const shutdownBrowserSessions = async () => {
  browserShutdownGeneration++
  const pendingLaunch = browserLaunch
  await Promise.all([...profiles.keys()].map(closeProfile))
  const launched = await pendingLaunch?.catch(() => undefined)
  if (launched && launched !== browser) await launched.close()
  if (browser) await browser.close()
  browser = null
  browserLaunch = null
}
process.on("exit", () => {
  void browser?.close().catch(() => {})
})
process.on("SIGINT", async () => {
  await shutdownBrowserSessions().catch((error) => {
    log(`SIGINT shutdown failed  ${error instanceof Error ? error.message : String(error)}`)
  })
  process.exit(0)
})
process.on("SIGTERM", async () => {
  await shutdownBrowserSessions().catch((error) => {
    log(`SIGTERM shutdown failed  ${error instanceof Error ? error.message : String(error)}`)
  })
  process.exit(0)
})
