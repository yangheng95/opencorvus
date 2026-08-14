import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Global } from "../../global"
import { z } from "zod"
import {
  adoptPage,
  clearSuccessfulDownloadRequestDiagnostic,
  createTab,
  createSession,
  destroySession,
  diffPerfText,
  exportStorageState,
  getDiagnostics,
  getDialogHistory,
  getDownloadHistory,
  getTabByIndex,
  getPerf,
  getSession,
  getSessionStatus,
  getTabInfo,
  listTabs,
  recordDownload,
  recordToolCall,
  setDialogPolicy,
  setViewport,
  snapshotPerf,
  updateToolCall,
  trackPendingBrowserMcpPage,
  withBrowserMcpOperation,
  withSessionOperationLock,
  type BrowserDiagnostics,
  resolveBrowserMcpConnectionConfig,
} from "./sessions.js"
import { formatPerfText } from "./perf.js"
import { clickGuardProfile, doubleClickGuardProfile, runPointGuard, type GuardResult } from "./guard.js"
import { captureBrowserMcpViewportScreenshot, pngDimensionsStrict } from "./screenshot.js"
import { resolveBrowserMcpSessionProxy } from "./session-proxy.js"
import {
  modelImagePixelSummary,
  modelImagePixelSummarySchema,
  type ModelImagePixelSummary,
} from "@/session/model-image-pixel-summary"

type Download = any

// ─── 工具调用 tracing ────────────────────────────────────────────────────────

// 保留有意义的参数键，截断过长字符串
const summarizeArgs = (args: Record<string, unknown>): Record<string, unknown> => {
  const pick = [
    "url",
    "selector",
    "key",
    "pattern",
    "state",
    "attribute",
    "value",
    "x",
    "y",
    "deltaX",
    "deltaY",
    "all",
    "filePath",
    "format",
    "waitUntil",
    "timeout",
    "force",
    "profileId",
    "preserveProfile",
    "action",
    "frameSelector",
    "sourceSelector",
    "targetSelector",
    "sourceX",
    "sourceY",
    "targetX",
    "targetY",
    "clip",
    "promptText",
  ] as const
  const out: Record<string, unknown> = {}
  for (const k of pick) {
    if (k in args && args[k] !== undefined) {
      const v = args[k]
      out[k] = typeof v === "string" && v.length > 80 ? v.slice(0, 80) + "…" : v
    }
  }
  const trunc = (k: "text" | "expression") => {
    if (k in args && args[k] !== undefined) {
      const v = args[k]
      out[k] = typeof v === "string" && v.length > 50 ? v.slice(0, 50) + "…" : v
    }
  }
  trunc("text")
  trunc("expression")
  return out
}

// 包装工具 handler，自动记录耗时 + 状态到对应 session；per_tool 模式下追加 perf 增量到 content
const traced =
  <T extends { sessionId?: string }>(
    tool: string,
    fn: (args: T) => Promise<{ isError?: boolean; content: unknown[] }>,
  ) =>
  async (args: T) => {
    return withBrowserMcpOperation(async () => {
      const start = Date.now()
      let snap: ReturnType<typeof snapshotPerf> = null
      if (args.sessionId) {
        recordToolCall(args.sessionId, {
          tool,
          at: start,
          ms: 0,
          status: "running",
          args: summarizeArgs(args as Record<string, unknown>),
        })
      }
      try {
        const run = () => {
          snap = args.sessionId ? snapshotPerf(args.sessionId) : null
          return fn(args)
        }
        const result = args.sessionId ? await withSessionOperationLock(args.sessionId, run) : await run()
        if (args.sessionId) {
          updateToolCall(args.sessionId, start, {
            ms: Date.now() - start,
            status: (result as { isError?: boolean }).isError ? "error" : "ok",
          })
          if (snap) {
            const perfText = diffPerfText(args.sessionId, snap, tool)
            if (perfText) result.content.push({ type: "text" as const, text: perfText })
          }
        }
        return result
      } catch (e) {
        if (args.sessionId) {
          updateToolCall(args.sessionId, start, {
            ms: Date.now() - start,
            status: "error",
          })
        }
        throw e
      }
    })
  }

// ─── 辅助函数 ───────────────────────────────────────────────────────────────

// 成功响应：同时返回 content（文本备用）和 structuredContent（结构化数据，供客户端直接使用）
const ok = <T extends Record<string, unknown>>(data: T) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
  structuredContent: data,
})

const failJson = <T extends Record<string, unknown>>(data: T) => ({
  isError: true as const,
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
  structuredContent: data,
})

const screenshotPixelSummarySchema = modelImagePixelSummarySchema

type ScreenshotPixelSummary = ModelImagePixelSummary

export const screenshotPixelSummary = modelImagePixelSummary

// 图片响应：content 放 image 类型（模型可视化）+ 像素摘要文本（防止模型压缩图片后坐标失准），structuredContent 放 base64 数据（script.ts 可编程访问）
const okImage = (base64: string, width: number, height: number) => {
  const pixelSummary = screenshotPixelSummary(width, height)
  return {
    content: [
      { type: "image" as const, data: base64, mimeType: "image/png" as const },
      { type: "text" as const, text: pixelSummary.text },
    ],
    structuredContent: { data: base64, mimeType: "image/png", width, height, pixelSummary },
  }
}

const diagnosticsSchema = {
  consoleErrors: z.array(
    z.object({
      type: z.string(),
      text: z.string(),
      url: z.string().optional(),
      lineNumber: z.number().optional(),
      columnNumber: z.number().optional(),
    }),
  ),
  pageErrors: z.array(z.object({ message: z.string(), stack: z.string().optional() })),
  failedRequests: z.array(
    z.object({
      url: z.string(),
      method: z.string(),
      resourceType: z.string(),
      reason: z.string(),
    }),
  ),
  httpErrors: z.array(
    z.object({
      url: z.string(),
      status: z.number(),
      statusText: z.string(),
      resourceType: z.string(),
    }),
  ),
}

const storageStateSchema = z.object({
  cookies: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      domain: z.string(),
      path: z.string(),
      expires: z.number(),
      httpOnly: z.boolean(),
      secure: z.boolean(),
      sameSite: z.enum(["Strict", "Lax", "None"]),
    }),
  ),
  origins: z.array(
    z.object({
      origin: z.string(),
      localStorage: z.array(z.object({ name: z.string(), value: z.string() })),
    }),
  ),
})

// 用坐标获取命中元素的 DOM 信息，辅助模型将坐标转换为稳定 selector
const elementInfoAt = async (page: Awaited<ReturnType<typeof getSession>>["page"], x: number, y: number) =>
  page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null
      if (!el) return null
      const attrs = (names: string[]) =>
        Object.fromEntries(
          names.flatMap((n) => {
            const v = el.getAttribute(n)
            return v ? [[n, v]] : []
          }),
        )
      const text = el.textContent?.trim().slice(0, 80) ?? ""
      const tag = el.tagName.toLowerCase()
      const id = el.id || null
      const testId =
        el.getAttribute("data-testid") ?? el.getAttribute("data-test") ?? el.getAttribute("data-cy") ?? null
      const ariaLabel = el.getAttribute("aria-label") ?? null
      const role = el.getAttribute("role") ?? null
      const classes = [...el.classList].slice(0, 5)
      const suggestedSelector = id
        ? `#${id}`
        : testId
          ? `[data-testid="${testId}"]`
          : ariaLabel
            ? `[aria-label="${ariaLabel}"]`
            : classes.length
              ? `${tag}.${classes[0]}`
              : tag
      return {
        tag,
        id,
        testId,
        ariaLabel,
        role,
        classes,
        text,
        suggestedSelector,
        attrs: attrs(["href", "type", "name", "value", "placeholder"]),
      }
    },
    [x, y] as [number, number],
  )

// 查询工具：先 count() 检查存在性（不等待），不存在立即返回清晰错误
const summarizeDom = async (page: ReturnType<typeof getSession>["page"]) =>
  page.evaluate(() => {
    const normalize = (value: string | null | undefined, limit: number) =>
      (value ?? "").replace(/\s+/g, " ").trim().slice(0, limit)
    const selectorFor = (el: Element) => {
      const html = el as HTMLElement
      if (html.id) return `#${html.id}`
      const testId = el.getAttribute("data-testid") ?? el.getAttribute("data-test") ?? el.getAttribute("data-cy")
      if (testId) return `[data-testid="${testId}"]`
      const ariaLabel = el.getAttribute("aria-label")
      if (ariaLabel) return `[aria-label="${ariaLabel}"]`
      const tag = el.tagName.toLowerCase()
      const name = el.getAttribute("name")
      if (name) return `${tag}[name="${name}"]`
      const firstClass = [...html.classList][0]
      return firstClass ? `${tag}.${firstClass}` : tag
    }
    const interactive = [
      ...document.querySelectorAll<HTMLElement>(
        'a,button,input,select,textarea,[role="button"],[role="link"],[role="menuitem"],[tabindex]',
      ),
    ]
      .filter((el) => {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
      })
      .slice(0, 40)
      .map((el) => {
        const rect = el.getBoundingClientRect()
        const role = el.getAttribute("role") ?? el.tagName.toLowerCase()
        const name =
          el.getAttribute("aria-label") ??
          el.getAttribute("title") ??
          el.getAttribute("placeholder") ??
          el.getAttribute("value") ??
          el.textContent
        return {
          tag: el.tagName.toLowerCase(),
          role,
          name: normalize(name, 80),
          text: normalize(el.textContent, 80),
          selector: selectorFor(el),
          disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        }
      })
    return {
      title: document.title,
      readyState: document.readyState,
      visibleText: normalize(document.body?.innerText, 1600),
      interactive,
    }
  })

const withElement = async (
  page: Awaited<ReturnType<typeof getSession>>["page"],
  selector: string,
  fn: () => Promise<Record<string, unknown>>,
) => {
  const n = await page.locator(selector).count()
  if (n === 0)
    return { isError: true as const, content: [{ type: "text" as const, text: `Element not found: "${selector}"` }] }
  return ok(await fn())
}

// 交互工具：catch Playwright 异常，只保留首行可读信息
const translateError = (e: unknown, selector?: string) => {
  const raw = e instanceof Error ? e.message : String(e)
  const firstLine = raw.split("\n")[0].replace(/^Error:\s*/, "")
  const detail = selector ? `${firstLine} (selector: "${selector}")` : firstLine
  return { isError: true as const, content: [{ type: "text" as const, text: detail }] }
}

const BROWSER_MCP_DEFAULT_INACTIVITY_TIMEOUT_MS = 30_000

const isBrowserMcpImplicitAssetUrl = (rawUrl: string | undefined): boolean => {
  if (!rawUrl) return false
  try {
    return new URL(rawUrl).pathname === "/favicon.ico"
  } catch {
    return false
  }
}

const isBrowserMcpResourceLoadConsoleError = (text: string): boolean => /^Failed to load resource:/i.test(text)

const browserDiagnosticsIssues = (diagnostics: BrowserDiagnostics): string[] => [
  ...diagnostics.consoleErrors
    .filter((item) => !isBrowserMcpResourceLoadConsoleError(item.text))
    .map((item) => `console ${item.type}: ${item.text}`),
  ...diagnostics.pageErrors.map((item) => `pageerror: ${item.message}`),
  ...diagnostics.failedRequests
    .filter((item) => !isBrowserMcpImplicitAssetUrl(item.url))
    .map((item) => `requestfailed ${item.method} ${item.url}: ${item.reason}`),
  ...diagnostics.httpErrors
    .filter((item) => !isBrowserMcpImplicitAssetUrl(item.url))
    .map((item) => `http ${item.status} ${item.url}: ${item.statusText}`),
]

export const browserDiagnosticsIssueCount = (diagnostics: BrowserDiagnostics): number =>
  browserDiagnosticsIssues(diagnostics).length

const browserMcpActivityLabel = (event: string, payload: unknown): string => {
  const candidate = payload as {
    url?: () => string
    message?: () => string
    text?: () => string
    status?: () => number
    statusText?: () => string
    failure?: () => { errorText?: string } | null
  }
  if (typeof candidate?.url === "function") {
    const status = typeof candidate.status === "function" ? ` ${candidate.status()}` : ""
    const statusText = typeof candidate.statusText === "function" ? ` ${candidate.statusText()}` : ""
    const failure = typeof candidate.failure === "function" ? ` ${candidate.failure()?.errorText ?? ""}` : ""
    return `${event} ${candidate.url()}${status}${statusText}${failure}`.trim()
  }
  if (typeof candidate?.message === "function") return `${event} ${candidate.message()}`
  if (typeof candidate?.text === "function") return `${event} ${candidate.text()}`
  return event
}

const withBrowserMcpInactivity = async <T>(
  page: ReturnType<typeof getSession>["page"],
  label: string,
  inactivityTimeoutMs: number,
  action: () => Promise<T>,
): Promise<T> => {
  let settled = false
  let lastActivity = "start"
  let timer: ReturnType<typeof setTimeout> | undefined
  let rejectInactive: ((error: Error) => void) | undefined
  const listeners: Array<[string, (...args: unknown[]) => void]> = []
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
      rejectInactive?.(new Error(`${label} inactive for ${inactivityTimeoutMs}ms after ${lastActivity}`))
    }, inactivityTimeoutMs)
  }
  const on = (event: string, handler: (...args: unknown[]) => void) => {
    page.on(event, handler)
    listeners.push([event, handler])
  }
  on("console", (payload) => reset(browserMcpActivityLabel("console", payload)))
  on("response", (payload) => reset(browserMcpActivityLabel("response", payload)))
  on("request", (payload) => reset(browserMcpActivityLabel("request", payload)))
  on("framenavigated", (payload) => reset(browserMcpActivityLabel("framenavigated", payload)))
  reset("start")
  try {
    return await Promise.race([action(), inactive])
  } finally {
    settled = true
    clearTimer()
    for (const [event, handler] of listeners) page.off(event, handler)
  }
}

// ─── 工具注册 ──────────────────────────────────────────────────────────────

const detectOpenedPage = async <T>(
  session: ReturnType<typeof getSession>,
  action: () => Promise<T>,
  liveViewUrl: (sessionId: string) => string,
): Promise<{ result: T; openedPage?: Awaited<ReturnType<typeof getTabInfo>> & { liveViewUrl: string } }> => {
  const popupPromise = session.page
    .waitForEvent("popup", { timeout: 750 })
    .then((page) => ({ page, release: trackPendingBrowserMcpPage(page) }))
    .catch(() => null)
  let result: T
  try {
    result = await action()
  } catch (error) {
    const pending = await popupPromise
    if (pending) {
      await pending.page.close().catch(() => {})
      pending.release()
    }
    throw error
  }
  const pending = await popupPromise
  if (!pending) return { result }
  const { page, release } = pending
  try {
    await page.waitForLoadState("domcontentloaded", { timeout: 5_000 }).catch(() => {})
    const adopted = await adoptPage(session.profileId, page, {
      virtualCursor: session.virtualCursor,
      perfMode: session.perfMode,
    })
    release()
    return {
      result,
      openedPage: {
        ...(await getTabInfo(adopted.sessionId, adopted.sessionId)),
        liveViewUrl: liveViewUrl(adopted.sessionId),
      },
    }
  } catch (error) {
    await page.close().catch(() => {})
    release()
    throw error
  }
}

const safeDownloadFilename = (input: string) => {
  const base = path
    .basename(input)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .slice(0, 160)
  return base || "download"
}

const saveDownload = async (sessionId: string, download: Download) => {
  const item = download
  const dir = path.join(Global.Path.temporary, "browser-downloads", sessionId)
  await fs.mkdir(dir, { recursive: true })
  const filename = `${Date.now()}-${safeDownloadFilename(item.suggestedFilename())}`
  const filePath = path.join(dir, filename)
  await item.saveAs(filePath)
  const entry = recordDownload(sessionId, {
    at: Date.now(),
    suggestedFilename: item.suggestedFilename(),
    path: filePath,
    url: item.url(),
  })
  clearSuccessfulDownloadRequestDiagnostic(sessionId, entry.url)
  return entry
}

const frameTarget = (page: ReturnType<typeof getSession>["page"], frameSelector: string) =>
  page.frameLocator(frameSelector)

const frameLocator = (page: ReturnType<typeof getSession>["page"], frameSelector: string, selector: string) =>
  frameTarget(page, frameSelector).locator(selector)

export type BrowserMcpToolOptions = {
  liveViewOrigin: string
}

export const browserMcpLiveViewUrl = (origin: string, sessionId: string): string => {
  const url = new URL("/monitor", origin)
  url.searchParams.set("session", sessionId)
  return url.toString()
}

export const registerTools = (server: McpServer, options: BrowserMcpToolOptions) => {
  const sessionLiveViewUrl = (sessionId: string) => browserMcpLiveViewUrl(options.liveViewOrigin, sessionId)
  // 拦截所有 registerTool 调用，自动注入 tracing
  const origRegister = server.registerTool.bind(server)
  ;(server as { registerTool: typeof server.registerTool }).registerTool = (
    name: string,
    schema: Parameters<typeof server.registerTool>[1],
    handler: Parameters<typeof server.registerTool>[2],
  ) =>
    origRegister(
      name,
      schema,
      traced(name, handler as Parameters<typeof traced>[1]) as Parameters<typeof server.registerTool>[2],
    )

  // ── Session 生命周期 ──────────────────────────────────────────────────────────

  server.registerTool(
    "session_create",
    {
      description:
        "创建浏览器 session（Page/tab），返回 sessionId 和 profileId。User Profile 代表一个浏览器用户环境（BrowserContext）；同一 profileId 下创建的多个 session 像同一浏览器的多个 tab，会共享 Cookie、Storage 和登录状态。默认 Chrome CDP 模式下，不传 profileId 会在当前已登录 Chrome 环境中创建 MCP 管理的新 tab；isolated 模式下，不传 profileId 会创建新的隔离用户环境。后续复用同一环境时应传回 profileId；不存在或已过期的 profileId 会报错。",
      inputSchema: {
        profileId: z
          .string()
          .optional()
          .describe(
            "要复用的 User Profile ID。用于打开同一已登录用户环境中的新 tab。适用于同一用户继续测试、多个模块共享登录态、或把已登录 profile 分发给并行 sub-agent。不存在或已过期时会报错。",
          ),
        viewport: z.object({ width: z.number(), height: z.number() }).optional().describe("视口尺寸，默认 1280×720"),
        userAgent: z.string().optional().describe("isolated 模式的自定义 User-Agent；当前 Chrome CDP 模式不支持。"),
        baseURL: z
          .string()
          .optional()
          .describe("isolated 模式导航相对路径时使用的 base URL；当前 Chrome CDP 模式不支持。"),
        proxy: z
          .object({
            server: z.string().describe("代理地址，如 http://127.0.0.1:7890"),
            bypass: z.string().optional().describe("不走代理的域名，逗号分隔，如 localhost,127.0.0.1"),
            username: z.string().optional(),
            password: z.string().optional(),
          })
          .optional()
          .describe(
            "isolated 模式的 HTTP 代理配置。未设置时使用 network.proxy.webResearch；该配置未启用时不使用代理。当前 Chrome CDP 模式不支持按 session 修改代理。",
          ),
        hosts: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "isolated 模式的域名到 IP 映射，如 { 'example.com': '192.168.1.1' }。仅对 HTTP 可靠；HTTPS 需目标 IP 的证书包含原域名。当前 Chrome CDP 模式不支持。",
          ),
        virtualCursor: z.boolean().optional().describe("是否注入虚拟光标，默认 true。设为 false 可关闭光标跟踪。"),
        perf: z
          .enum(["close", "silent", "per_tool"])
          .optional()
          .describe(
            "性能监控模式。close（默认）=不采集，零开销；silent=后台采集，需主动调用 get_perf 查询；per_tool=后台采集，每次工具调用完成后自动将同源性能异常附加到响应文本中。",
          ),
        storageState: storageStateSchema
          .optional()
          .describe(
            "isolated 模式用于显式导入 cookie/localStorage 的 Playwright storageState JSON；当前 Chrome CDP 模式直接使用 Chrome 现有登录态，不支持导入。",
          ),
      },
      outputSchema: {
        sessionId: z.string().describe("会话唯一标识符，后续所有操作均需传入"),
        profileId: z
          .string()
          .describe(
            "User Profile ID，代表当前用户环境。登录成功后应保留该值；后续 session_create 传入该值可复用登录态并打开同一用户环境中的新 tab。",
          ),
        liveViewUrl: z.string().url().describe("在本机浏览器打开此地址，可实时旁观该 session 的页面和工具调用。"),
        browserMode: z.enum(["cdp", "isolated"]).describe("浏览器连接模式：当前 Chrome CDP 或独立未登录浏览器。"),
        browserProduct: z.string().describe("当前实际浏览器产品，例如 Google Chrome。"),
      },
    },
    async (args) => {
      const proxy =
        args.proxy ??
        (resolveBrowserMcpConnectionConfig().mode === "isolated"
          ? await resolveBrowserMcpSessionProxy(undefined)
          : undefined)
      const created = await createSession({ ...args, proxy })
      return ok({ ...created, liveViewUrl: sessionLiveViewUrl(created.sessionId) })
    },
  )

  server.registerTool(
    "session_destroy",
    {
      description:
        "销毁浏览器 session（Page/tab）。如果它是 profile 下最后一个 session，默认释放 MCP 持有的 profile：isolated 模式会销毁隔离环境及其登录态；当前 Chrome CDP 模式只关闭 MCP 创建的 tab，不会清除 Chrome 自身的登录态。后续仍需用同一 MCP profile 时，应传 preserveProfile 并明确指定保留时长。",
      inputSchema: {
        sessionId: z.string(),
        preserveProfile: z
          .enum(["30s", "30min", "2h", "1d"])
          .optional()
          .describe(
            '保留当前 session 所属 MCP profile handle 的明确时长，便于后续继续复用环境。仅支持 "30s"、"30min"、"2h"、"1d"；仅在销毁最后一个 session 时生效。不传则立即释放该 handle；Chrome CDP 模式下不会清除 Chrome 自身登录态。',
          ),
      },
      outputSchema: {
        ok: z.boolean(),
        profileId: z.string(),
        profilePreserved: z.boolean(),
        profileExpiresAt: z.number().optional(),
      },
    },
    async ({ sessionId, preserveProfile }) => ok({ ok: true, ...(await destroySession(sessionId, preserveProfile)) }),
  )

  server.registerTool(
    "session_status",
    {
      description:
        "Return whether a browser session is active or unavailable. Use this after a tool reports session unavailable, page closed, context closed, or browser disconnected.",
      inputSchema: { sessionId: z.string() },
      outputSchema: {
        sessionId: z.string(),
        profileId: z.string().optional(),
        status: z.enum(["active", "unavailable", "not_found"]),
        reason: z.string().optional(),
        message: z.string().optional(),
        url: z.string().optional(),
        lastActive: z.number().optional(),
        terminatedAt: z.number().optional(),
        dialogPolicy: z.object({ action: z.enum(["dismiss", "accept"]), promptText: z.string().optional() }).optional(),
        dialogCount: z.number().optional(),
        downloadCount: z.number().optional(),
      },
    },
    async ({ sessionId }) => ok(getSessionStatus(sessionId)),
  )

  const tabSchema = z.object({
    index: z.number(),
    sessionId: z.string(),
    profileId: z.string(),
    url: z.string(),
    title: z.string(),
    active: z.boolean(),
    liveViewUrl: z.string().url().optional(),
  })

  const tabWithLiveView = <T extends { sessionId: string }>(tab: T) => ({
    ...tab,
    liveViewUrl: sessionLiveViewUrl(tab.sessionId),
  })

  server.registerTool(
    "tabs",
    {
      description:
        '管理当前 profile 下由 MCP 创建或采用的 tab/page；不会列出或操作用户原有的 Chrome tab。action="list" 按连续 index 列出 MCP tab；"new" 新建 tab 并可导航到 url；"select" 返回指定 index 的 sessionId，后续工具应使用该 sessionId；"close" 关闭当前或指定 index 的 MCP tab。',
      inputSchema: {
        sessionId: z.string(),
        action: z.enum(["list", "new", "select", "close"]),
        index: z.number().optional().describe("select/close 使用的 tab index；close 省略时关闭当前 session 对应的 tab"),
        url: z.string().optional().describe('action="new" 时可选导航 URL'),
      },
      outputSchema: {
        ok: z.boolean(),
        tabs: z.array(tabSchema).optional(),
        tab: tabSchema.optional(),
        closed: tabSchema.optional(),
        selectedSessionId: z.string().optional(),
      },
    },
    async ({ sessionId, action, index, url }) => {
      if (action === "list")
        return ok({ ok: true, tabs: (await listTabs(sessionId)).map((tab) => tabWithLiveView(tab)) })
      if (action === "new") {
        const tab = await createTab(sessionId)
        if (url) {
          const created = getSession(tab.sessionId)
          await withBrowserMcpInactivity(
            created.page,
            `tabs new ${url}`,
            BROWSER_MCP_DEFAULT_INACTIVITY_TIMEOUT_MS,
            () => created.page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 }),
          )
          return ok({ ok: true, tab: tabWithLiveView(await getTabInfo(tab.sessionId, tab.sessionId)) })
        }
        return ok({ ok: true, tab: tabWithLiveView(tab) })
      }
      if (action === "select") {
        if (index === undefined)
          return failJson({ ok: false, error: { code: "INDEX_REQUIRED", message: "tabs select requires index" } })
        const selectedSessionId = getTabByIndex(sessionId, index)
        return ok({
          ok: true,
          selectedSessionId,
          tab: tabWithLiveView(await getTabInfo(selectedSessionId, selectedSessionId)),
          tabs: (await listTabs(selectedSessionId)).map((tab) => tabWithLiveView(tab)),
        })
      }
      const targetSessionId = index === undefined ? sessionId : getTabByIndex(sessionId, index)
      const closed = await getTabInfo(targetSessionId, sessionId)
      await destroySession(targetSessionId)
      return ok({
        ok: true,
        closed,
        tabs:
          targetSessionId === sessionId ? undefined : (await listTabs(sessionId)).map((tab) => tabWithLiveView(tab)),
      })
    },
  )

  server.registerTool(
    "get_perf",
    {
      description:
        '获取当前 session 的全量累积性能数据。需要在 session_create 时指定 perf: "silent" 或 "per_tool" 才可用。issues 数组包含所有异常（含第三方），thirdParty=true 的条目通常不影响功能。',
      inputSchema: { sessionId: z.string() },
      outputSchema: {
        ok: z.boolean().describe("true = 无同源异常"),
        windowMs: z.number().describe("采集窗口时长（ms）"),
        requests: z.object({
          total: z.number(),
          failed: z.number(),
          slow: z.number(),
        }),
        longTasks: z
          .object({
            count: z.number(),
            maxMs: z.number(),
            p95Ms: z.number(),
            totalBlockedMs: z.number(),
          })
          .nullable()
          .describe("无 long task 时为 null"),
        vitals: z.object({
          lcp: z.number().optional(),
          cls: z.number().optional(),
          inp: z.number().optional(),
          fcp: z.number().optional(),
          ttfb: z.number().optional(),
        }),
        issues: z.array(
          z.object({
            kind: z.enum(["net_fail", "slow", "long_task", "lcp", "cls", "inp", "ttfb", "redirect"]),
            msg: z.string().describe("可读描述"),
            nearStep: z.string().optional().describe("发生时最近的工具调用名"),
            thirdParty: z.boolean().optional().describe("true = 第三方域名或 beacon/ping 类请求"),
          }),
        ),
      },
    },
    async ({ sessionId }) => {
      const result = getPerf(sessionId)
      return {
        content: [{ type: "text" as const, text: formatPerfText(result) }],
        structuredContent: result,
      }
    },
  )

  // ── 导航 ──────────────────────────────────────────────────────────────────────

  server.registerTool(
    "diagnostics_get",
    {
      description:
        "获取当前 session 累积的页面错误证据，包括 console error/warning、pageerror、请求失败和 HTTP 4xx/5xx。",
      inputSchema: { sessionId: z.string() },
      outputSchema: diagnosticsSchema,
    },
    async ({ sessionId }) => ok(getDiagnostics(sessionId)),
  )

  server.registerTool(
    "dialog_policy_set",
    {
      description:
        "Set automatic handling for JavaScript dialogs. Dialogs block page execution, so the browser MCP always handles them immediately and records the history.",
      inputSchema: {
        sessionId: z.string(),
        action: z
          .enum(["dismiss", "accept"])
          .describe("Automatic action for future alert/confirm/prompt/beforeunload dialogs."),
        promptText: z.string().optional().describe("Text used when accepting prompt dialogs."),
      },
      outputSchema: {
        sessionId: z.string(),
        policy: z.object({ action: z.enum(["dismiss", "accept"]), promptText: z.string().optional() }),
      },
    },
    async ({ sessionId, action, promptText }) => ok(setDialogPolicy(sessionId, { action, promptText })),
  )

  server.registerTool(
    "dialog_history",
    {
      description: "Return the current dialog policy and recorded JavaScript dialogs for the session.",
      inputSchema: { sessionId: z.string() },
      outputSchema: {
        sessionId: z.string(),
        policy: z.object({ action: z.enum(["dismiss", "accept"]), promptText: z.string().optional() }),
        dialogs: z.array(
          z.object({
            at: z.number(),
            type: z.string(),
            message: z.string(),
            defaultValue: z.string(),
            action: z.enum(["dismiss", "accept"]),
            url: z.string(),
          }),
        ),
      },
    },
    async ({ sessionId }) => ok(getDialogHistory(sessionId)),
  )

  server.registerTool(
    "viewport_set",
    {
      description:
        "Set the current session viewport size and update the owning profile default viewport for future tabs.",
      inputSchema: {
        sessionId: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      },
      outputSchema: {
        sessionId: z.string(),
        profileId: z.string(),
        viewport: z.object({ width: z.number(), height: z.number() }),
      },
    },
    async ({ sessionId, width, height }) => ok(await setViewport(sessionId, { width, height })),
  )

  server.registerTool(
    "storage_state_export",
    {
      description:
        "Export cookies and localStorage from an MCP-owned isolated profile. Current Chrome CDP mode deliberately refuses export so the user's full signed-in Chrome credentials are not exposed; set OPENCORVUS_BROWSER_MODE=isolated when export is required.",
      inputSchema: { sessionId: z.string() },
      outputSchema: {
        sessionId: z.string(),
        profileId: z.string(),
        storageState: storageStateSchema,
      },
    },
    async ({ sessionId }) => ok(await exportStorageState(sessionId)),
  )

  server.registerTool(
    "storage_state_import",
    {
      description:
        "Create a new isolated session/profile from an explicit Playwright storageState JSON. Requires OPENCORVUS_BROWSER_MODE=isolated; current Chrome CDP mode uses Chrome's existing signed-in state and does not support import.",
      inputSchema: {
        storageState: storageStateSchema,
        viewport: z.object({ width: z.number(), height: z.number() }).optional(),
        userAgent: z.string().optional(),
        baseURL: z.string().optional(),
        virtualCursor: z.boolean().optional(),
        perf: z.enum(["close", "silent", "per_tool"]).optional(),
      },
      outputSchema: {
        sessionId: z.string(),
        profileId: z.string(),
        liveViewUrl: z.string().url(),
        browserMode: z.enum(["cdp", "isolated"]),
        browserProduct: z.string(),
      },
    },
    async (args) => {
      const created = await createSession(args)
      return ok({ ...created, liveViewUrl: sessionLiveViewUrl(created.sessionId) })
    },
  )

  server.registerTool(
    "navigate",
    {
      description:
        "导航到指定 URL。返回实际 URL、页面标题和加载状态。只有导航调用自身失败或浏览器持续无活动才会使工具失败；子资源、console、pageerror 和 HTTP 诊断由 diagnostics_get 保留为独立证据。",
      inputSchema: {
        sessionId: z.string(),
        url: z.string().describe("目标 URL（可为相对路径，若设置了 baseURL）"),
        timeout: z
          .number()
          .optional()
          .describe("导航超时毫秒数，默认 20000。必须小于代理/网关的请求超时，否则代理先断开连接导致响应丢失。"),
        waitUntil: z
          .enum(["domcontentloaded", "load", "networkidle", "commit"])
          .optional()
          .describe("等待阶段，默认 domcontentloaded（更快）。load 等待所有资源，networkidle 最慢谨慎使用。"),
      },
      outputSchema: {
        url: z.string().describe("导航后的实际页面 URL"),
        title: z.string().describe("页面标题"),
        loadStatus: z.literal("full").describe("加载状态；返回成功时页面已完成请求的等待阶段"),
      },
    },
    async ({ sessionId, url, timeout, waitUntil }) => {
      const { page } = getSession(sessionId)
      await withBrowserMcpInactivity(page, `navigate ${url}`, timeout ?? 20_000, () =>
        page.goto(url, { timeout: 0, waitUntil: waitUntil ?? "domcontentloaded" }),
      )
      const title = await page.title()
      return ok({ url: page.url(), title, loadStatus: "full" })
    },
  )

  server.registerTool(
    "get_url",
    {
      description: "获取当前页面 URL。",
      inputSchema: { sessionId: z.string() },
      outputSchema: { url: z.string() },
    },
    async ({ sessionId }) => {
      const { page } = getSession(sessionId)
      return ok({ url: page.url() })
    },
  )

  server.registerTool(
    "reload",
    {
      description: "刷新当前页面。",
      inputSchema: { sessionId: z.string() },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId }) => {
      const { page } = getSession(sessionId)
      await withBrowserMcpInactivity(page, "reload", BROWSER_MCP_DEFAULT_INACTIVITY_TIMEOUT_MS, () =>
        page.reload({ timeout: 0 }),
      )
      return ok({ ok: true })
    },
  )

  server.registerTool(
    "go_back",
    {
      description: "浏览器后退。",
      inputSchema: { sessionId: z.string() },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId }) => {
      const { page } = getSession(sessionId)
      await withBrowserMcpInactivity(page, "go_back", BROWSER_MCP_DEFAULT_INACTIVITY_TIMEOUT_MS, () =>
        page.goBack({ timeout: 0 }),
      )
      return ok({ ok: true })
    },
  )

  server.registerTool(
    "go_forward",
    {
      description: "浏览器前进。",
      inputSchema: { sessionId: z.string() },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId }) => {
      const { page } = getSession(sessionId)
      await withBrowserMcpInactivity(page, "go_forward", BROWSER_MCP_DEFAULT_INACTIVITY_TIMEOUT_MS, () =>
        page.goForward({ timeout: 0 }),
      )
      return ok({ ok: true })
    },
  )

  // ── 视觉 ──────────────────────────────────────────────────────────────────────

  server.registerTool(
    "screenshot",
    {
      description:
        "截取当前视口截图，返回 base64 PNG。模拟人眼视角（仅可见区域）。如需查看页面其他部分，请先调用 scroll。可选截取指定元素区域或指定视口坐标矩形。",
      inputSchema: {
        sessionId: z.string(),
        selector: z.string().optional().describe("仅截取该 CSS selector 对应元素（可选）"),
        clip: z
          .object({
            x: z.number().describe("裁剪矩形左上角相对当前视口的 x 坐标，单位 px。"),
            y: z.number().describe("裁剪矩形左上角相对当前视口的 y 坐标，单位 px。"),
            width: z.number().positive().describe("裁剪矩形宽度，单位 px。"),
            height: z.number().positive().describe("裁剪矩形高度，单位 px。"),
          })
          .optional()
          .describe("按当前视口坐标裁剪截图。适合局部视觉对比；与 selector 类似，只返回指定区域。"),
        hideCursor: z.boolean().optional().describe("截图时隐藏虚拟光标，默认 false。用于获取不含光标的干净页面截图。"),
        fullPage: z
          .boolean()
          .optional()
          .describe("截取完整页面（含滚动区域），默认 false。会产生巨大图片，除非明确需要全页内容，否则不要使用。"),
      },
      outputSchema: {
        data: z.string().describe("base64 编码的 PNG 图片数据"),
        mimeType: z.string().describe("MIME 类型，固定为 image/png"),
        width: z.number().describe("截图原始宽度（像素）"),
        height: z.number().describe("截图原始高度（像素）"),
        pixelSummary: screenshotPixelSummarySchema.describe("截图像素与模型压缩压力摘要。"),
      },
    },
    async ({ sessionId, selector, clip, hideCursor, fullPage }) => {
      const session = getSession(sessionId)
      const { page } = session
      const shouldHide = hideCursor && session.virtualCursor
      if (shouldHide) {
        await page.evaluate(() => {
          const el = document.getElementById("__vt-cursor__")
          if (el) el.style.display = "none"
        })
      }
      try {
        if (selector) {
          const buf = await page.locator(selector).screenshot({ timeout: 10_000 })
          const { width, height } = pngDimensionsStrict(buf)
          return okImage(buf.toString("base64"), width, height)
        }
        if (clip) {
          const buf = await page.screenshot({ clip })
          const { width, height } = pngDimensionsStrict(buf)
          return okImage(buf.toString("base64"), width, height)
        }
        if (fullPage) {
          const buf = await page.screenshot({ fullPage: true })
          const { width, height } = pngDimensionsStrict(buf)
          return okImage(buf.toString("base64"), width, height)
        }
        const { data, width, height } = await captureBrowserMcpViewportScreenshot(page)
        return okImage(data, width, height)
      } finally {
        if (shouldHide) {
          await page.evaluate(() => {
            const el = document.getElementById("__vt-cursor__")
            if (el) el.style.display = ""
          })
        }
      }
    },
  )

  // ── 交互 ──────────────────────────────────────────────────────────────────────

  server.registerTool(
    "observe",
    {
      description:
        "一次性获取当前页面的可判定状态：URL、title、viewport、可见 DOM 摘要、截图和页面诊断。用于 OpenCorvus 在执行动作前后形成证据。",
      inputSchema: {
        sessionId: z.string(),
        includeScreenshot: z.boolean().optional().describe("是否包含当前视口截图，默认 true。"),
        includeDom: z.boolean().optional().describe("是否包含可见文本和交互元素摘要，默认 true。"),
        includeDiagnostics: z.boolean().optional().describe("是否包含累计页面错误证据，默认 true。"),
      },
      outputSchema: {
        url: z.string(),
        title: z.string(),
        viewport: z.object({ width: z.number(), height: z.number() }),
        screenshot: z
          .object({
            data: z.string(),
            mimeType: z.string(),
            width: z.number(),
            height: z.number(),
            pixelSummary: screenshotPixelSummarySchema,
          })
          .optional(),
        dom: z
          .object({
            title: z.string(),
            readyState: z.string(),
            visibleText: z.string(),
            interactive: z.array(z.unknown()),
          })
          .optional(),
        diagnostics: z.object(diagnosticsSchema).optional(),
      },
    },
    async ({ sessionId, includeScreenshot, includeDom, includeDiagnostics }) => {
      const session = getSession(sessionId)
      const { page } = session
      const screenshot =
        includeScreenshot === false
          ? undefined
          : await (async () => {
              const capture = await captureBrowserMcpViewportScreenshot(page)
              return {
                data: capture.data,
                mimeType: "image/png" as const,
                width: capture.width,
                height: capture.height,
                pixelSummary: screenshotPixelSummary(capture.width, capture.height),
              }
            })()
      const result = {
        url: page.url(),
        title: await page.title(),
        viewport: session.viewport,
        screenshot,
        dom: includeDom === false ? undefined : await summarizeDom(page),
        diagnostics: includeDiagnostics === false ? undefined : getDiagnostics(sessionId),
      }
      const content: Array<{ type: "image"; data: string; mimeType: "image/png" } | { type: "text"; text: string }> = []
      if (screenshot) content.push({ type: "image", data: screenshot.data, mimeType: "image/png" })
      content.push({
        type: "text",
        text: JSON.stringify({
          ...result,
          screenshot: screenshot
            ? {
                mimeType: screenshot.mimeType,
                width: screenshot.width,
                height: screenshot.height,
                pixelSummary: screenshot.pixelSummary,
              }
            : undefined,
        }),
      })
      return { content, structuredContent: result }
    },
  )

  const clickInputSchema = {
    sessionId: z.string(),
    selector: z.string().optional().describe("CSS selector（与 x/y 二选一）"),
    x: z.number().optional().describe("页面 X 坐标，绝对像素（与 selector 二选一）"),
    y: z.number().optional().describe("页面 Y 坐标，绝对像素（与 selector 二选一）"),
    force: z.boolean().optional().describe("仅坐标模式有效。true 时跳过 guard 拦截，按原始坐标强制执行。默认 false。"),
  }

  const guardSchema = z
    .object({
      enabled: z.boolean(),
      action: z.string(),
      decision: z.enum(["allow", "warn", "block"]),
      bypassed: z.boolean(),
      confidence: z.number(),
      point: z.object({ x: z.number(), y: z.number() }),
      target: z.unknown().nullable(),
      nearby: z.array(z.unknown()),
      signals: z.array(z.string()),
      risks: z.array(z.string()),
      message: z.string().optional(),
    })
    .optional()

  const guardBlocked = (method: string, point: { x: number; y: number }, guard: GuardResult) =>
    failJson({
      ok: false,
      clicked: false,
      method,
      point,
      target: guard.target,
      guard,
      error: {
        code: "GUARD_BLOCKED",
        message:
          guard.message ?? "Coordinate guard blocked this interaction. Re-call with force:true to execute anyway.",
      },
    })

  server.registerTool(
    "click",
    {
      description:
        "点击元素。通过 selector（CSS selector）或坐标 {x, y} 二选一定位。selector 模式直接点击；坐标模式会自动执行 guard 检查，低置信度时不点击并返回附近候选。需要强制原始坐标点击时传 force:true。",
      inputSchema: clickInputSchema,
      outputSchema: {
        ok: z.boolean(),
        clicked: z.boolean().optional(),
        method: z.string().optional(),
        point: z.object({ x: z.number(), y: z.number() }).optional(),
        guard: guardSchema,
        target: z.unknown().nullable().optional(),
        usedSelector: z.string().optional().describe("实际使用的 selector（仅 selector 模式）"),
        openedPage: tabSchema.optional(),
        element: z
          .object({
            tag: z.string(),
            id: z.string().nullable(),
            testId: z.string().nullable(),
            ariaLabel: z.string().nullable(),
            role: z.string().nullable(),
            classes: z.array(z.string()),
            text: z.string(),
            suggestedSelector: z.string(),
            attrs: z.record(z.string(), z.string()),
          })
          .nullable()
          .optional()
          .describe("命中的 DOM 元素信息（仅坐标模式）"),
        error: z
          .object({
            code: z.string(),
            message: z.string(),
          })
          .optional(),
      },
    },
    async ({ sessionId, selector, x, y, force }) => {
      const session = getSession(sessionId)
      const { page } = session
      try {
        if (selector) {
          const action = await detectOpenedPage(session, async () => page.locator(selector).click(), sessionLiveViewUrl)
          return ok({
            ok: true,
            clicked: true,
            method: "selector",
            usedSelector: selector,
            openedPage: action.openedPage,
          })
        } else if (x !== undefined && y !== undefined) {
          const point = { x, y }
          await page.mouse.move(x, y)
          const guard = await runPointGuard(page, point, clickGuardProfile, force ?? false)
          if (guard.decision === "block") return guardBlocked("coord", point, guard)
          const info = await elementInfoAt(page, x, y).catch(() => null)
          const action = await detectOpenedPage(session, async () => page.mouse.click(x, y), sessionLiveViewUrl)
          return ok({
            ok: true,
            clicked: true,
            method: "coord",
            point,
            target: guard.target,
            guard,
            element: info as Record<string, unknown> | null,
            openedPage: action.openedPage,
          })
        } else {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "click requires either selector or {x, y}" }],
          }
        }
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "double_click",
    {
      description:
        "双击元素。通过 selector 或坐标 {x, y} 定位。坐标模式会自动执行 double_click guard；需要强制原始坐标双击时传 force:true。",
      inputSchema: clickInputSchema,
      outputSchema: {
        ok: z.boolean(),
        clicked: z.boolean().optional(),
        method: z.string().optional(),
        point: z.object({ x: z.number(), y: z.number() }).optional(),
        guard: guardSchema,
        target: z.unknown().nullable().optional(),
        openedPage: tabSchema.optional(),
        error: z
          .object({
            code: z.string(),
            message: z.string(),
          })
          .optional(),
      },
    },
    async ({ sessionId, selector, x, y, force }) => {
      const session = getSession(sessionId)
      const { page } = session
      try {
        if (selector) {
          const action = await detectOpenedPage(
            session,
            async () => page.locator(selector).dblclick(),
            sessionLiveViewUrl,
          )
          return ok({
            ok: true,
            clicked: true,
            method: "selector",
            usedSelector: selector,
            openedPage: action.openedPage,
          })
        } else if (x !== undefined && y !== undefined) {
          const point = { x, y }
          await page.mouse.move(x, y)
          const guard = await runPointGuard(page, point, doubleClickGuardProfile, force ?? false)
          if (guard.decision === "block") return guardBlocked("coord", point, guard)
          const action = await detectOpenedPage(session, async () => page.mouse.dblclick(x, y), sessionLiveViewUrl)
          return ok({
            ok: true,
            clicked: true,
            method: "coord",
            point,
            target: guard.target,
            guard,
            openedPage: action.openedPage,
          })
        } else {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "double_click requires either selector or {x, y}" }],
          }
        }
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "hover",
    {
      description:
        "移动鼠标并悬停（move + hover）。坐标操作时本质是 mouse.move，同时触发 hover 效果（tooltip、hover 菜单等）。【重要】在使用坐标执行 click / scroll 之前，必须先用此工具将鼠标移到目标坐标，通过截图确认坐标准确后再操作，避免点错位置。",
      inputSchema: clickInputSchema,
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, selector, x, y }) => {
      const { page } = getSession(sessionId)
      try {
        if (selector) {
          await page.locator(selector).hover()
        } else if (x !== undefined && y !== undefined) {
          await page.mouse.move(x, y)
        } else {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: "hover requires either selector or {x, y}" }],
          }
        }
        return ok({ ok: true })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "type",
    {
      description: "向输入框输入文字。默认先清空再输入（clear=true）。",
      inputSchema: {
        sessionId: z.string(),
        selector: z.string().describe("目标输入框的 CSS selector"),
        text: z.string().describe("要输入的文字"),
        clear: z.boolean().optional().describe("是否先清空，默认 true"),
      },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, selector, text, clear }) => {
      const { page } = getSession(sessionId)
      try {
        const locator = page.locator(selector)
        if (clear ?? true) await locator.clear()
        await locator.fill(text)
        return ok({ ok: true })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "press_key",
    {
      description: "按下键盘按键，如 Enter / Tab / Escape / ArrowDown 等。",
      inputSchema: {
        sessionId: z.string(),
        key: z.string().describe("Playwright 键名，如 'Enter'、'Tab'、'Escape'"),
      },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, key }) => {
      const { page } = getSession(sessionId)
      try {
        await page.keyboard.press(key)
        return ok({ ok: true })
      } catch (e) {
        return translateError(e)
      }
    },
  )

  server.registerTool(
    "keyboard_shortcut",
    {
      description:
        "Press a keyboard shortcut chord, for example Control+A, Meta+K, Shift+Alt+ArrowDown, or Control+Shift+I.",
      inputSchema: {
        sessionId: z.string(),
        shortcut: z.string().describe("Playwright keyboard chord, such as Control+A or Meta+K."),
      },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, shortcut }) => {
      const { page } = getSession(sessionId)
      try {
        await page.keyboard.press(shortcut)
        return ok({ ok: true })
      } catch (e) {
        return translateError(e)
      }
    },
  )

  server.registerTool(
    "select_option",
    {
      description: "Select one or more options in a <select> element by value, label, or index.",
      inputSchema: {
        sessionId: z.string(),
        selector: z.string(),
        value: z.string().optional().describe("Single option value."),
        values: z.array(z.string()).optional().describe("Multiple option values."),
        label: z.string().optional().describe("Single option label."),
        index: z.number().int().nonnegative().optional().describe("Zero-based option index."),
      },
      outputSchema: { ok: z.boolean(), selectedValues: z.array(z.string()) },
    },
    async ({ sessionId, selector, value, values, label, index }) => {
      const { page } = getSession(sessionId)
      try {
        const choices = [value, values, label, index].filter((item) => item !== undefined)
        if (choices.length !== 1) {
          return failJson({
            ok: false,
            error: {
              code: "SELECT_OPTION_INPUT",
              message: "select_option requires exactly one of value, values, label, or index",
            },
          })
        }
        const option =
          values !== undefined ? values : label !== undefined ? { label } : index !== undefined ? { index } : value!
        const selectedValues = await page.locator(selector).selectOption(option)
        return ok({ ok: true, selectedValues })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "check",
    {
      description: "勾选 checkbox 或 radio。",
      inputSchema: { sessionId: z.string(), selector: z.string() },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, selector }) => {
      const { page } = getSession(sessionId)
      try {
        await page.locator(selector).check()
        return ok({ ok: true })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "drag_and_drop",
    {
      description: "Drag from one element/point to another element/point.",
      inputSchema: {
        sessionId: z.string(),
        sourceSelector: z.string().optional(),
        targetSelector: z.string().optional(),
        sourceX: z.number().optional(),
        sourceY: z.number().optional(),
        targetX: z.number().optional(),
        targetY: z.number().optional(),
      },
      outputSchema: { ok: z.boolean(), method: z.string().optional() },
    },
    async ({ sessionId, sourceSelector, targetSelector, sourceX, sourceY, targetX, targetY }) => {
      const { page } = getSession(sessionId)
      try {
        if (sourceSelector && targetSelector) {
          await page.locator(sourceSelector).dragTo(page.locator(targetSelector))
          return ok({ ok: true, method: "selector" })
        }
        if (sourceX !== undefined && sourceY !== undefined && targetX !== undefined && targetY !== undefined) {
          await page.mouse.move(sourceX, sourceY)
          await page.mouse.down()
          await page.mouse.move(targetX, targetY)
          await page.mouse.up()
          return ok({ ok: true, method: "coord" })
        }
        return failJson({
          ok: false,
          error: {
            code: "DRAG_INPUT",
            message: "drag_and_drop requires sourceSelector+targetSelector or sourceX+sourceY+targetX+targetY",
          },
        })
      } catch (e) {
        return translateError(e, sourceSelector)
      }
    },
  )

  server.registerTool(
    "uncheck",
    {
      description: "取消勾选 checkbox。",
      inputSchema: { sessionId: z.string(), selector: z.string() },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, selector }) => {
      const { page } = getSession(sessionId)
      try {
        await page.locator(selector).uncheck()
        return ok({ ok: true })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "upload_file",
    {
      description: "上传文件到 <input type='file'> 元素。",
      inputSchema: {
        sessionId: z.string(),
        selector: z.string(),
        filePath: z.string().describe("文件绝对路径"),
      },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, selector, filePath }) => {
      const { page } = getSession(sessionId)
      try {
        await page.locator(selector).setInputFiles(filePath)
        return ok({ ok: true })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "download",
    {
      description:
        "Click a target and wait for the next browser download. The file is saved under the process temp directory and the absolute saved path is returned.",
      inputSchema: {
        sessionId: z.string(),
        selector: z.string().optional(),
        x: z.number().optional(),
        y: z.number().optional(),
        timeout: z.number().optional().describe("Download timeout in milliseconds, default 30000."),
        force: z.boolean().optional().describe("Bypass coordinate click guard when using x/y."),
      },
      outputSchema: {
        ok: z.boolean(),
        suggestedFilename: z.string().optional(),
        path: z.string().optional(),
        url: z.string().optional(),
        error: z.object({ code: z.string(), message: z.string() }).optional(),
      },
    },
    async ({ sessionId, selector, x, y, timeout, force }) => {
      const session = getSession(sessionId)
      const { page } = session
      try {
        const downloadPromise = page.waitForEvent("download", { timeout: timeout ?? 30_000 })
        if (selector) {
          await page.locator(selector).click()
        } else if (x !== undefined && y !== undefined) {
          const point = { x, y }
          await page.mouse.move(x, y)
          const guard = await runPointGuard(page, point, clickGuardProfile, force ?? false)
          if (guard.decision === "block") return guardBlocked("coord", point, guard)
          await page.mouse.click(x, y)
        } else {
          return failJson({
            ok: false,
            error: { code: "DOWNLOAD_INPUT", message: "download requires selector or x/y" },
          })
        }
        const entry = await saveDownload(sessionId, await downloadPromise)
        return ok({ ok: true, suggestedFilename: entry.suggestedFilename, path: entry.path, url: entry.url })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "download_history",
    {
      description: "Return downloads captured by the current session.",
      inputSchema: { sessionId: z.string() },
      outputSchema: {
        sessionId: z.string(),
        downloads: z.array(
          z.object({ at: z.number(), suggestedFilename: z.string(), path: z.string(), url: z.string() }),
        ),
      },
    },
    async ({ sessionId }) => ok(getDownloadHistory(sessionId)),
  )

  server.registerTool(
    "frames",
    {
      description: "List frames/iframes in the current page, including URL and name.",
      inputSchema: { sessionId: z.string() },
      outputSchema: {
        frames: z.array(
          z.object({ index: z.number(), name: z.string(), url: z.string(), parentIndex: z.number().nullable() }),
        ),
      },
    },
    async ({ sessionId }) => {
      const { page } = getSession(sessionId)
      const frames = page.frames()
      return ok({
        frames: frames.map((frame, index) => ({
          index,
          name: frame.name(),
          url: frame.url(),
          parentIndex: frame.parentFrame() ? frames.indexOf(frame.parentFrame()!) : null,
        })),
      })
    },
  )

  server.registerTool(
    "frame_click",
    {
      description: "Click an element inside an iframe selected by the iframe CSS selector.",
      inputSchema: { sessionId: z.string(), frameSelector: z.string(), selector: z.string() },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, frameSelector, selector }) => {
      const { page } = getSession(sessionId)
      try {
        await frameLocator(page, frameSelector, selector).click()
        return ok({ ok: true })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "frame_type",
    {
      description: "Fill an input inside an iframe selected by the iframe CSS selector.",
      inputSchema: {
        sessionId: z.string(),
        frameSelector: z.string(),
        selector: z.string(),
        text: z.string(),
        clear: z.boolean().optional(),
      },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, frameSelector, selector, text, clear }) => {
      const { page } = getSession(sessionId)
      try {
        const locator = frameLocator(page, frameSelector, selector)
        if (clear ?? true) await locator.clear()
        await locator.fill(text)
        return ok({ ok: true })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  server.registerTool(
    "frame_get_text",
    {
      description: "Read text content inside an iframe selected by the iframe CSS selector.",
      inputSchema: { sessionId: z.string(), frameSelector: z.string(), selector: z.string() },
      outputSchema: { text: z.string() },
    },
    async ({ sessionId, frameSelector, selector }) => {
      const { page } = getSession(sessionId)
      try {
        const text = (await frameLocator(page, frameSelector, selector).textContent()) ?? ""
        return ok({ text })
      } catch (e) {
        return translateError(e, selector)
      }
    },
  )

  // ── DOM 查询 ──────────────────────────────────────────────────────────────────

  server.registerTool(
    "get_text",
    {
      description:
        "获取元素文字内容。all=false（默认）返回第一个匹配元素的 text；all=true 返回所有匹配元素的 texts 数组。元素不存在时立即返回错误，不等待。",
      inputSchema: {
        sessionId: z.string(),
        selector: z.string(),
        all: z.boolean().optional().describe("true 返回所有匹配元素的文本数组，默认 false"),
      },
      outputSchema: {
        text: z.string().optional().describe("第一个匹配元素的文字（all=false 时）"),
        texts: z.array(z.string()).optional().describe("所有匹配元素的文字数组（all=true 时）"),
      },
    },
    async ({ sessionId, selector, all }) => {
      const { page } = getSession(sessionId)
      return withElement(page, selector, async () => {
        if (all) return { texts: await page.locator(selector).allTextContents() }
        return { text: (await page.locator(selector).first().textContent()) ?? "" }
      })
    },
  )

  server.registerTool(
    "get_attribute",
    {
      description:
        "读取元素属性值（如 aria-label / title / data-* 等），解决 icon button 语义问题。元素不存在时立即返回错误。",
      inputSchema: {
        sessionId: z.string(),
        selector: z.string(),
        attribute: z.string().describe("属性名"),
      },
      outputSchema: {
        value: z.string().nullable().describe("属性值，元素无此属性时为 null"),
      },
    },
    async ({ sessionId, selector, attribute }) => {
      const { page } = getSession(sessionId)
      return withElement(page, selector, async () => {
        const value = await page.locator(selector).first().getAttribute(attribute)
        return { value }
      })
    },
  )

  server.registerTool(
    "get_value",
    {
      description: "获取 input / select / textarea 的当前值。元素不存在时立即返回错误。",
      inputSchema: { sessionId: z.string(), selector: z.string() },
      outputSchema: {
        value: z.string().describe("输入框当前值"),
      },
    },
    async ({ sessionId, selector }) => {
      const { page } = getSession(sessionId)
      return withElement(page, selector, async () => {
        const value = await page.locator(selector).first().inputValue()
        return { value }
      })
    },
  )

  server.registerTool(
    "is_visible",
    {
      description: "判断元素是否可见（存在且在视口内）。元素不存在时返回 { visible: false }，不报错。",
      inputSchema: { sessionId: z.string(), selector: z.string() },
      outputSchema: { visible: z.boolean() },
    },
    async ({ sessionId, selector }) => {
      const { page } = getSession(sessionId)
      const visible = await page.locator(selector).isVisible()
      return ok({ visible })
    },
  )

  server.registerTool(
    "count",
    {
      description: "统计匹配 selector 的元素数量。元素不存在时返回 { count: 0 }，不报错。",
      inputSchema: { sessionId: z.string(), selector: z.string() },
      outputSchema: { count: z.number() },
    },
    async ({ sessionId, selector }) => {
      const { page } = getSession(sessionId)
      const count = await page.locator(selector).count()
      return ok({ count })
    },
  )

  // ── 等待 ──────────────────────────────────────────────────────────────────────

  server.registerTool(
    "wait_for_selector",
    {
      description: "等待元素出现、消失或附加到 DOM。",
      inputSchema: {
        sessionId: z.string(),
        selector: z.string(),
        state: z.enum(["visible", "hidden", "attached", "detached"]).optional().describe("等待状态，默认 visible"),
        timeout: z.number().optional().describe("超时毫秒数，默认 30000"),
      },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, selector, state, timeout }) => {
      const { page } = getSession(sessionId)
      await withBrowserMcpInactivity(page, `wait_for_selector ${selector}`, timeout ?? 30_000, () =>
        page.locator(selector).waitFor({ state: state ?? "visible", timeout: 0 }),
      )
      return ok({ ok: true })
    },
  )

  server.registerTool(
    "wait_for_url",
    {
      description: "等待页面 URL 包含指定字符串（子字符串匹配）。用于等待路由跳转。",
      inputSchema: {
        sessionId: z.string(),
        pattern: z.string().describe("URL 中应包含的字符串"),
        timeout: z.number().optional().describe("超时毫秒数，默认 30000"),
      },
      outputSchema: { url: z.string().describe("跳转后的实际 URL") },
    },
    async ({ sessionId, pattern, timeout }) => {
      const { page } = getSession(sessionId)
      await withBrowserMcpInactivity(page, `wait_for_url ${pattern}`, timeout ?? 30_000, () =>
        page.waitForURL((url) => url.href.includes(pattern), { timeout: 0 }),
      )
      return ok({ url: page.url() })
    },
  )

  server.registerTool(
    "wait_for_load",
    {
      description: "等待页面加载到指定状态。",
      inputSchema: {
        sessionId: z.string(),
        state: z.enum(["load", "domcontentloaded", "networkidle"]).optional().describe("加载状态，默认 load"),
        timeout: z.number().optional().describe("超时毫秒数，默认 30000"),
      },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, state, timeout }) => {
      const { page } = getSession(sessionId)
      await withBrowserMcpInactivity(page, `wait_for_load ${state ?? "load"}`, timeout ?? 30_000, () =>
        page.waitForLoadState(state ?? "load", { timeout: 0 }),
      )
      return ok({ ok: true })
    },
  )

  // ── 滚动 ──────────────────────────────────────────────────────────────────────

  server.registerTool(
    "scroll",
    {
      description:
        "在指定坐标处滚动页面。deltaX/deltaY 单位为像素，正值向右/向下，负值向左/向上。用于将屏幕外内容滚入视口后再截图。【坐标操作前必须先用 hover 确认坐标准确】",
      inputSchema: {
        sessionId: z.string(),
        x: z.number().describe("鼠标位置 X 坐标（页面像素）"),
        y: z.number().describe("鼠标位置 Y 坐标（页面像素）"),
        deltaX: z.number().optional().describe("水平滚动量（像素），默认 0"),
        deltaY: z.number().describe("垂直滚动量（像素），正值向下"),
      },
      outputSchema: { ok: z.boolean() },
    },
    async ({ sessionId, x, y, deltaX, deltaY }) => {
      const { page } = getSession(sessionId)
      try {
        await page.mouse.move(x, y)
        await page.mouse.wheel(deltaX ?? 0, deltaY)
        return ok({ ok: true })
      } catch (e) {
        return translateError(e)
      }
    },
  )

  // ── 执行 ──────────────────────────────────────────────────────────────────────

  server.registerTool(
    "evaluate",
    {
      description:
        "在页面中执行 JavaScript 表达式，返回结果。处理无法用 selector 操作的场景（滚动、LocalStorage 读写等）。",
      inputSchema: {
        sessionId: z.string(),
        expression: z.string().describe("JavaScript 表达式，与 Playwright page.evaluate(string) 用法一致"),
      },
      outputSchema: {
        result: z.unknown().describe("表达式执行结果（任意 JSON 可序列化值）"),
      },
    },
    async ({ sessionId, expression }) => {
      const { page } = getSession(sessionId)
      const result = await page.evaluate(expression)
      return ok({ result: result ?? null })
    },
  )
}

export const createMcpServer = (options: BrowserMcpToolOptions) => {
  const server = new McpServer({ name: "browser", version: "0.1.0" })
  registerTools(server, options)
  return server
}
