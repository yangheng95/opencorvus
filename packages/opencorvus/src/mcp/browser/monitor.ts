import type { IncomingMessage, ServerResponse } from "http"
import { getSession, getSessions, getSessionStats, getToolCalls } from "./sessions.js"
import { BrowserMcpScreenshotTimeoutError, captureBrowserMcpViewportScreenshot } from "./screenshot.js"

const escHtml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!)

export const browserMcpMonitorSelectionJson = (sessionId: string): string =>
  JSON.stringify(sessionId).replace(/[<>&\u2028\u2029]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`)

// 截图端点：/monitor/screenshot/:sessionId
// 每个 session 同时只允许一个 CDP captureScreenshot，并发请求返回明确错误
const screenshotInFlight = new Map<string, boolean>()

const writeMonitorScreenshotError = (res: ServerResponse, status: number, message: string) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify({ ok: false, error: message }))
}

const handleScreenshot = async (sessionId: string, res: ServerResponse) => {
  if (screenshotInFlight.get(sessionId)) {
    writeMonitorScreenshotError(res, 409, `screenshot already in progress for session ${sessionId}`)
    return
  }
  screenshotInFlight.set(sessionId, true)
  try {
    const session = getSession(sessionId)
    const capture = await captureBrowserMcpViewportScreenshot(session.page, { timeoutMs: 2_000 })
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" })
    res.end(capture.buffer)
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e)
    const status =
      e instanceof BrowserMcpScreenshotTimeoutError
        ? 504
        : msg.startsWith("Session not found") || msg.startsWith("Session unavailable")
          ? 404
          : 500
    writeMonitorScreenshotError(res, status, `screenshot failed: ${escHtml(msg)}`)
  } finally {
    screenshotInFlight.delete(sessionId)
  }
}

// 主监控页面
const handleMonitorPage = (res: ServerResponse, selectedSessionId?: string) => {
  const now = Date.now()
  const stats = getSessionStats()
  const list = getSessions().map((s) => ({
    ...s,
    idleSec: Math.round((now - s.lastActive) / 1000),
    ageSec: Math.round((now - s.createdAt) / 1000),
    lastActiveISO: new Date(s.lastActive).toISOString(),
  }))

  const sessionItems = list
    .map(
      (s) => `
    <button class="sess-item" type="button" data-id="${s.id}" data-created-at="${s.createdAt}">
      <div class="sess-id"><span class="sess-dot"></span>${s.id}</div>
      <div class="sess-url" title="${escHtml(s.url)}">${escHtml(s.url || "(blank)")}</div>
      <div class="sess-meta ${s.idleSec > 60 ? "idle-warn" : ""}">age ${s.ageSec}s · idle ${s.idleSec}s</div>
    </button>`,
    )
    .join("")

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>browser-mcp monitor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
  :root {
    --bg: #0a0a0a;
    --bg1: #111;
    --bg2: #161616;
    --border: #1f1f1f;
    --border2: #252525;
    --text: #c8c8c8;
    --text2: #666;
    --text3: #3a3a3a;
    --accent: #4d9cf8;
    --accent2: #2a5a9f;
    --green: #3d9e5f;
    --red: #c0392b;
    --amber: #c87d2a;
    --font: 'JetBrains Mono', monospace;
  }
  body { font-family: var(--font); background: var(--bg); color: var(--text); height: 100vh; display: flex; flex-direction: column; overflow: hidden; font-size: 12px; line-height: 1.5 }

  /* ── 顶栏 ── */
  .topbar { display: flex; align-items: stretch; border-bottom: 1px solid var(--border); flex-shrink: 0; height: 44px }
  .topbar-brand { display: flex; align-items: center; padding: 0 18px; font-size: 12px; font-weight: 600; color: var(--accent); border-right: 1px solid var(--border); letter-spacing: 0.03em; white-space: nowrap }
  .topbar-brand span { color: var(--text2); font-weight: 400; margin-left: 6px }
  .stat-group { display: flex; align-items: stretch; border-right: 1px solid var(--border) }
  .stat-card { display: flex; align-items: center; gap: 10px; padding: 0 18px; border-right: 1px solid var(--border2) }
  .stat-card:last-child { border-right: none }
  .stat-label { font-size: 10px; color: var(--text2); letter-spacing: 0.05em; white-space: nowrap }
  .stat-value { font-size: 14px; font-weight: 600; color: var(--text); white-space: nowrap }
  .stat-value.active { color: var(--green) }
  .topbar-spacer { flex: 1 }
  .topbar-right { display: flex; align-items: center; gap: 0; border-left: 1px solid var(--border) }
  .topbar-ts { padding: 0 14px; font-size: 10px; color: var(--text3); border-right: 1px solid var(--border) }
  .refresh-btn { display: flex; align-items: center; padding: 0 14px; height: 100%; background: transparent; color: var(--text2); border: none; font-family: var(--font); font-size: 11px; cursor: pointer; letter-spacing: 0.03em; white-space: nowrap }
  .refresh-btn:hover { color: var(--text); background: var(--bg2) }

  /* ── 主体：两栏 ── */
  .main { display: flex; flex: 1; overflow: hidden }

  /* ── 左栏 ── */
  .sidebar { width: 260px; flex-shrink: 0; border-right: 1px solid var(--border); overflow-y: auto; background: var(--bg1); display: flex; flex-direction: column }
  .sidebar-header { padding: 9px 12px; font-size: 10px; color: var(--text2); letter-spacing: 0.06em; border-bottom: 1px solid var(--border); position: sticky; top: 0; background: var(--bg1); z-index: 1; display: flex; align-items: center; justify-content: space-between }
  .sidebar-header-count { color: var(--text3) }
  .sess-item { width: 100%; padding: 10px 12px; border: 0; border-bottom: 1px solid var(--border); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer }
  .sess-item:hover { background: var(--bg2) }
  .sess-item.active { background: var(--bg2); border-left: 2px solid var(--accent); padding-left: 10px }
  .sess-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--green); margin-right: 7px; flex-shrink: 0 }
  .sess-id { font-size: 11px; font-weight: 600; color: var(--text); display: flex; align-items: center }
  .sess-url { font-size: 10px; color: var(--text2); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 13px }
  .sess-meta { font-size: 10px; color: var(--text3); margin-top: 3px; padding-left: 13px }
  .idle-warn { color: var(--amber) }
  .empty-list { padding: 32px 16px; font-size: 11px; color: var(--text3); text-align: center; flex: 1; display: flex; align-items: center; justify-content: center }

  /* ── 右栏 ── */
  .preview-pane { flex: 1; display: flex; flex-direction: column; overflow: hidden }
  .preview-header { padding: 0 14px; height: 36px; font-size: 11px; color: var(--text2); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; flex-shrink: 0; background: var(--bg1) }
  .preview-session-id { color: var(--accent); font-weight: 600 }
  .preview-url { color: var(--text2); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
  .preview-refresh-btn { background: transparent; color: var(--text2); border: 1px solid var(--border2); padding: 2px 8px; font-family: var(--font); font-size: 10px; cursor: pointer; flex-shrink: 0 }
  .preview-refresh-btn:hover { color: var(--text); border-color: var(--text3) }

  /* 截图区 */
  .preview-screenshot { flex: 3; overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: 16px; border-bottom: 1px solid var(--border); min-height: 0; background: var(--bg) }
  .preview-img { max-width: 100%; display: block; border: 1px solid var(--border2) }
  .preview-empty { color: var(--text3); font-size: 11px; margin: auto }
  .preview-loading { color: var(--text3); font-size: 11px; margin: auto }

  /* 工具调用日志 */
  .toollog-pane { flex: 2; display: flex; flex-direction: column; overflow: hidden; min-height: 0 }
  .toollog-header { padding: 0 12px; height: 32px; font-size: 10px; color: var(--text2); letter-spacing: 0.06em; border-bottom: 1px solid var(--border); flex-shrink: 0; display: flex; align-items: center; gap: 8px; background: var(--bg1) }
  .toollog-count { color: var(--text); font-weight: 600 }
  .toollog-body { flex: 1; overflow-y: auto }
  .toollog-empty { color: var(--text3); font-size: 11px; padding: 20px; text-align: center }
  .tl-row { display: grid; grid-template-columns: 28px 52px 130px 1fr 54px 18px; align-items: center; gap: 0; padding: 4px 12px; border-bottom: 1px solid var(--border); line-height: 1.4 }
  .tl-row:hover { background: var(--bg2) }
  .tl-idx { color: var(--text3); font-size: 10px; text-align: right; padding-right: 6px }
  .tl-time { color: var(--green); font-size: 10px }
  .tl-tool { font-weight: 500; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 8px }
  .tl-tool.ok { color: var(--accent) }
  .tl-tool.err { color: var(--red) }
  .tl-args { color: var(--text3); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
  .tl-args span { color: var(--text2) }
  .tl-ms { color: var(--text3); font-size: 10px; text-align: right; padding-right: 8px }
  .tl-ms.slow { color: var(--amber) }
  .tl-status { font-size: 10px; text-align: center }
  .tl-status.ok { color: var(--green) }
  .tl-status.err { color: var(--red) }
  .tl-tool.running { color: var(--amber) }
  .tl-status.running { color: var(--amber) }

  /* 滚动条 */
  ::-webkit-scrollbar { width: 4px; height: 4px }
  ::-webkit-scrollbar-track { background: transparent }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px }
  ::-webkit-scrollbar-thumb:hover { background: var(--text3) }
</style>
</head>
<body>

<!-- 顶栏 -->
<div class="topbar">
  <div class="topbar-brand">browser-mcp <span>monitor</span></div>
  <div class="stat-group">
    <div class="stat-card">
      <div class="stat-label">ACTIVE</div>
      <div class="stat-value active" id="stat-active">${stats.active}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">TODAY</div>
      <div class="stat-value" id="stat-today">${stats.todayTotal}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">MONTH</div>
      <div class="stat-value" id="stat-month">${stats.monthTotal}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">RSS</div>
      <div class="stat-value">${stats.rss}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">HEAP</div>
      <div class="stat-value">${stats.heap}</div>
    </div>
  </div>
  <div class="topbar-spacer"></div>
  <div class="topbar-right">
    <div class="topbar-ts" id="ts">${new Date().toISOString()}</div>
    <button class="refresh-btn" onclick="location.reload()">↺ reload</button>
  </div>
</div>

<!-- 主体 -->
<div class="main">
  <!-- 左栏 -->
  <div class="sidebar">
    <div class="sidebar-header">
      SESSIONS
      <span class="sidebar-header-count">${list.length}</span>
    </div>
    ${list.length === 0 ? `<div class="empty-list">no active sessions</div>` : sessionItems}
  </div>

  <!-- 右栏 -->
  <div class="preview-pane">
    <div class="preview-header" id="preview-header">
      <span style="color:var(--text3)">select a session to preview</span>
    </div>
    <div class="preview-screenshot" id="preview-body">
      <div class="preview-empty" id="preview-placeholder">no session selected</div>
    </div>
    <div class="toollog-pane" id="toollog-pane" style="display:none">
      <div class="toollog-header">
        TOOL CALLS &nbsp;<span class="toollog-count" id="toollog-count">0</span>
      </div>
      <div class="toollog-body" id="toollog-body">
        <div class="toollog-empty">no tool calls recorded</div>
      </div>
    </div>
  </div>
</div>

<script>
  let activeId = null
  let refreshTimer = null
  let activeSessionStart = 0
  let screenshotBusy = false

  function selectSession(id, createdAt) {
    document.querySelectorAll('.sess-item').forEach(el => el.classList.remove('active'))
    const item = document.querySelector('.sess-item[data-id="' + id + '"]')
    if (item) item.classList.add('active')

    activeId = id
    activeSessionStart = Number(createdAt) || 0
    const itemUrl = item ? item.querySelector('.sess-url').textContent : ''

    document.getElementById('preview-header').innerHTML =
      '<span class="preview-session-id">' + id + '</span>' +
      '<span class="preview-url"></span>' +
      '<button class="preview-refresh-btn">↺ refresh</button>'
    document.querySelector('#preview-header .preview-url').textContent = itemUrl || '(blank)'
    document.querySelector('#preview-header .preview-refresh-btn').addEventListener('click', refresh)

    document.getElementById('toollog-pane').style.display = 'flex'
    document.getElementById('toollog-pane').style.flexDirection = 'column'

    refresh()

    clearInterval(refreshTimer)
    refreshTimer = setInterval(refresh, 1000)
  }

  function refresh() {
    refreshPreview()
    refreshToolLog()
  }

  function refreshPreview() {
    if (!activeId || screenshotBusy) return
    screenshotBusy = true
    const body = document.getElementById('preview-body')
    if (!body.querySelector('img')) body.innerHTML = '<div class="preview-loading">loading…</div>'
    const img = new Image()
    img.className = 'preview-img'
    img.onload = () => { screenshotBusy = false; body.innerHTML = ''; body.appendChild(img) }
    img.onerror = () => { screenshotBusy = false; body.innerHTML = '<div class="preview-empty">screenshot failed</div>' }
    img.src = 'monitor/screenshot/' + activeId + '?t=' + Date.now()
  }

  function refreshToolLog() {
    if (!activeId) return
    fetch('monitor/toolcalls/' + activeId + '?t=' + Date.now())
      .then(r => r.json())
      .then(calls => renderToolLog(calls))
      .catch(() => {})
  }

  function fmtRelTime(at) {
    const sec = (at - activeSessionStart) / 1000
    return '+' + sec.toFixed(1) + 's'
  }

  function fmtArgs(args) {
    const parts = []
    const keys = ['url','selector','key','text','pattern','state','attribute','value','x','y','deltaY','expression','filePath','timeout']
    for (const k of keys) {
      if (args[k] !== undefined) {
        const v = args[k]
        parts.push('<span>' + k + '=</span>' + escHtml(String(v)))
      }
    }
    return parts.join('  ') || '–'
  }

  function escHtml(s) {
    return s.replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))
  }

  function renderToolLog(calls) {
    const body = document.getElementById('toollog-body')
    document.getElementById('toollog-count').textContent = calls.length
    if (calls.length === 0) {
      body.innerHTML = '<div class="toollog-empty">no tool calls recorded</div>'
      return
    }
    const rows = [...calls].reverse().map((c, i) => {
      const idx = calls.length - i
      const running = c.status === 'running'
      const slow = !running && c.ms > 3000
      const statusCls = c.status === 'error' ? 'err' : running ? 'running' : 'ok'
      const statusIcon = c.status === 'ok' ? '✓' : c.status === 'error' ? '✗' : '…'
      const msText = running ? '…' : c.ms + 'ms'
      return '<div class="tl-row">' +
        '<div class="tl-idx">' + idx + '</div>' +
        '<div class="tl-time">' + fmtRelTime(c.at) + '</div>' +
        '<div class="tl-tool ' + statusCls + '">' + escHtml(c.tool) + '</div>' +
        '<div class="tl-args">' + fmtArgs(c.args) + '</div>' +
        '<div class="tl-ms' + (slow ? ' slow' : '') + '">' + msText + '</div>' +
        '<div class="tl-status ' + statusCls + '">' + statusIcon + '</div>' +
        '</div>'
    }).join('')
    body.innerHTML = rows
  }

  setInterval(() => {
    document.getElementById('ts').textContent = new Date().toISOString()
  }, 1000)

  document.querySelectorAll('.sess-item').forEach(item => {
    item.addEventListener('click', () => selectSession(item.dataset.id, item.dataset.createdAt))
  })

  const requestedSession = ${browserMcpMonitorSelectionJson(selectedSessionId ?? "")}
  if (requestedSession) {
    const selected = document.querySelector('.sess-item[data-id="' + requestedSession + '"]')
    if (selected) selected.click()
  }
</script>
</body></html>`

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(html)
}

// 统一 HTTP 请求分发入口
export const handleMonitorRequest = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1")

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  if (req.method === "GET" && url.pathname.startsWith("/monitor/toolcalls/")) {
    const sessionId = decodeURIComponent(url.pathname.slice("/monitor/toolcalls/".length))
    const calls = getToolCalls(sessionId)
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
    res.end(JSON.stringify(calls))
    return true
  }

  if (req.method === "GET" && url.pathname.startsWith("/monitor/screenshot/")) {
    const sessionId = decodeURIComponent(url.pathname.slice("/monitor/screenshot/".length))
    await handleScreenshot(sessionId, res)
    return true
  }

  if (req.method === "GET" && url.pathname === "/monitor") {
    handleMonitorPage(res, url.searchParams.get("session") ?? undefined)
    return true
  }

  return false
}
