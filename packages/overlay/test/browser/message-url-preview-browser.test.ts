import assert from "node:assert/strict"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { launchBrowser } from "../launch.ts"
import { ensureOverlayDist, overlayStaticResponse } from "../overlay-dist.ts"
import { startBrowserFixture } from "./http-fixture.ts"

await ensureOverlayDist()

const TASK = {
  id: "tsk_message_url_preview",
  title: "Message URL preview task",
  status: "active",
  directory: "D:/overlay/workspace/app",
  sessionID: "ses_message_url_preview",
  time: { created: 1_780_000_000_000, updated: 1_780_000_060_000 },
}

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAALUlEQVR4nGNkYPj/n4GKgImaho0aNmzYsGHDBg0bNmzYsGHDBg0bNjQwMgAA1e4DNxFpUqQAAAAASUVORK5CYII=",
  "base64",
)

function route(url: URL) {
  return url.pathname.replace(/\/+$/, "") || "/"
}

function json(value: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  })
}

function eventStream() {
  return new Response(":\n\n", {
    headers: { "content-type": "text/event-stream; charset=utf-8" },
  })
}

function textMessage(text: string) {
  return {
    info: {
      id: "msg_url_preview",
      sessionID: TASK.sessionID,
      role: "user",
      resolvedRole: "user",
      agent: "user",
      channel: "main",
      time: { created: 1_780_000_010_000, completed: 1_780_000_011_000 },
    },
    parts: [
      {
        id: "part_url_preview",
        messageID: "msg_url_preview",
        sessionID: TASK.sessionID,
        type: "text",
        text,
        role: "user",
        resolvedRole: "user",
        agent: "user",
        channel: "main",
      },
    ],
  }
}

function conversationPayload(previewUrl: string) {
  return {
    lastSequence: 1,
    board: {
      snapshotVersion: "board:tsk_message_url_preview",
      task: TASK,
      goalWorkflows: [],
      interactions: [],
    },
    transcript: [textMessage(`Open the product preview: ${previewUrl}`)],
    timeline: [],
    events: [],
    eventReplay: { cursor: 1, latestSequence: 1, complete: true, limit: 500, sinceTimestamp: null },
    history: { oldestTimestamp: null, oldestMessageID: null, hasMore: false, limit: 160 },
    view: { rootID: "root", order: [], cards: {}, sessions: [] },
    agentView: { rootID: "root", cards: {}, order: [] },
    messageWatermark: 0,
  }
}

async function waitForPreviewAnchor(page: any, previewUrl: string, requestLog: string[], pageErrors: string[]) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = await page.evaluate((url: string) => Boolean(document.querySelector(`a[data-browser-preview-url="${url}"]`)), previewUrl)
    if (found) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const snapshot = await page.evaluate(() => ({
    selectedTask: document.querySelector<HTMLElement>(".global-task-row[data-active='true'] .task-row-main")?.dataset.taskId || "",
    anchors: Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).map((anchor) => ({
      href: anchor.getAttribute("href"),
      preview: anchor.getAttribute("data-browser-preview-url"),
      text: anchor.textContent,
    })),
    body: document.body.textContent?.slice(0, 1400) || "",
  }))
  assert.fail(
    `Timed out waiting for rendered preview URL anchor\n${JSON.stringify({ previewUrl, snapshot, pageErrors, requestLog }, null, 2)}`,
  )
}

test("clicking a rendered markdown URL persists a task browser preview target and opens the Browser panel", async () => {
  assert.equal(process.env.OPENCORVUS_OVERLAY_BROWSER_TEST_NODE_RUNNER, "1")
  assert.equal(typeof globalThis.Bun, "undefined")

  const selectedTargets: unknown[] = []
  const requestLog: string[] = []
  const nativeOpens: string[] = []
  const pageErrors: string[] = []
  let selectedUrl = ""
  let previewUrl = ""

  const server = await startBrowserFixture(async (req) => {
    const url = new URL(req.url)
    const path = route(url)
    requestLog.push(`${req.method} ${url.pathname}${url.search}`)
    if (path === "/log" && req.method === "POST") {
      pageErrors.push(`log: ${await req.text()}`)
      return json({ ok: true })
    }
    if (!previewUrl) previewUrl = `${url.origin}/product-preview`
    if (path === "/" || path === "/ui") return Response.redirect(`${url.origin}/ui/index.html`, 302)
    if (path === "/product-preview") {
      return new Response("<main>Rendered URL preview target</main>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    const staticResponse = await overlayStaticResponse(path)
    if (staticResponse) return staticResponse
    if (path === "/global/health") return json({ version: "1.2.3" })
    if (path === "/tasks" || path === "/global/tasks") return json({ tasks: [{ task: TASK }] })
    if (path === `/task/${TASK.id}/board`) {
      return json(conversationPayload(previewUrl).board, { headers: { etag: '"url-preview-board"' } })
    }
    if (path === `/task/${TASK.id}/conversation`) return json(conversationPayload(previewUrl))
    if (path === `/task/${TASK.id}/transcript`) return json(conversationPayload(previewUrl).transcript)
    if (path === `/task/${TASK.id}/trace`) return json({ events: [], traceDir: `${TASK.directory}/.opencorvus/trace` })
    if (path === "/task/events" || path === `/task/${TASK.id}/events` || path === `/task/${TASK.id}/conversation/events`) {
      return eventStream()
    }
    if (path === `/task/${TASK.id}/browser-preview/target` && req.method === "PUT") {
      const body = await req.json()
      selectedTargets.push(body)
      selectedUrl = typeof body?.url === "string" ? body.url : selectedUrl
      return json(browserPreviewTarget(selectedUrl || previewUrl))
    }
    if (path === `/task/${TASK.id}/browser-preview`) {
      return json(selectedUrl ? browserPreviewTarget(selectedUrl) : missingBrowserPreviewTarget())
    }
    if (path === `/task/${TASK.id}/browser-preview/live/snapshot` && req.method === "POST") {
      return new Response(PNG_BYTES, { headers: { "content-type": "image/png" } })
    }
    if (path === `/task/${TASK.id}/browser-preview/capture` && req.method === "POST") {
      return json({
        status: "passed",
        projectRoot: TASK.directory,
        target: browserPreviewTarget(selectedUrl || previewUrl),
        viewports: viewports(),
        captures: {},
        evidenceIDs: { desktop: "art_message_url_preview_evidence_desktop" },
        diagnostics: [],
      })
    }
    if (path === "/path") return json({ directory: TASK.directory })
    if (path === "/vcs") {
      return json({
        branch: "dev",
        clean: true,
        dirty: false,
        staged: 0,
        modified: 0,
        untracked: 0,
        conflicts: 0,
        ahead: 0,
        behind: 0,
      })
    }
    if (path === "/provider") return json({ all: [], connected: [], default: {} })
    if (path === "/provider/auth") return json({})
    if (path === "/config/providers") return json({ providers: [] })
    if (path === "/config") return json({ model: "" })
    if (path === "/agent") return json([])
    if (path === "/channel") return json([])
    if (path === "/executor") return json([])
    if (path === "/mission") return json([])
    if (path === "/session") return json([])
    if (path === "/coding/sessions") return json({ sessions: [] })
    if (path === "/skill/installed" || path === "/skill") return json([])
    if (path === "/mcp") return json({})
    if (path === "/file") return json({ entries: [] })
    if (path === "/find/file") return json({ entries: [] })
    return json({})
  })

  function viewports() {
    return [
      { id: "desktop", labelKey: "browser_preview.viewport.desktop", width: 1440, height: 900 },
      { id: "tablet", labelKey: "browser_preview.viewport.tablet", width: 834, height: 1112 },
      { id: "mobile", labelKey: "browser_preview.viewport.mobile", width: 390, height: 844 },
    ]
  }

  function browserPreviewTarget(url: string) {
    return {
      id: "art_message_url_preview_target",
      taskID: TASK.id,
      latestEvidenceIDs: { desktop: "art_message_url_preview_evidence_desktop" },
      kind: "task-url",
      status: "ready",
      projectRoot: TASK.directory,
      url,
      viewports: viewports(),
      diagnostics: [],
      candidates: [{ id: "art_message_url_preview_target", url, source: "task-artifact", selected: true, timeUpdated: 1 }],
      source: "task-artifact",
    }
  }

  function missingBrowserPreviewTarget() {
    return {
      kind: "missing",
      status: "missing",
      projectRoot: TASK.directory,
      viewports: viewports(),
      diagnostics: ["No URL selected yet."],
      candidates: [],
      source: "none",
    }
  }

  const browser = await launchBrowser(["--disable-dev-shm-usage"])
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })
    await page.evaluateOnNewDocument(
      ({ serverUrl }) => {
        localStorage.setItem("oc_directory", "D:/overlay/workspace/app")
        localStorage.setItem("oc_server_url", serverUrl)
        localStorage.setItem("oc_workspace_task", "tsk_message_url_preview")
        localStorage.setItem("oc_workspace_task_id", "tsk_message_url_preview")
        localStorage.setItem("oc_workspace_directory", "D:/overlay/workspace/app")
        localStorage.setItem("oc_right_panel_collapsed", "false")
        const settings = {
          serverUrl,
          autoServer: false,
          locale: "en-US",
          directory: "D:/overlay/workspace/app",
          directoryMode: "custom",
          workspaceTaskID: "tsk_message_url_preview",
          workspaceDirectory: "D:/overlay/workspace/app",
        }
        ;(window as any).__TAURI__ = {
          core: {
            invoke: async (command: string, args: Record<string, unknown> = {}) => {
              if (command === "overlay_settings_load") return settings
              if (command === "overlay_settings_save") {
                Object.assign(settings, (args.settings as Record<string, unknown>) || {})
                return true
              }
              if (command === "overlay_open_url") {
                ;(window as any).__nativeOpens = [...((window as any).__nativeOpens || []), args.url]
                return true
              }
              if (command === "overlay_open_path") return true
              return null
            },
          },
          window: {
            getCurrentWindow() {
              return {
                close: async () => true,
                hide: async () => true,
                startDragging: async () => true,
                minimize: async () => true,
              }
            },
          },
        }
      },
      { serverUrl: server.origin },
    )
    page.on("pageerror", (error) => pageErrors.push(`pageerror: ${error.message}`))
    page.on("console", (msg) => {
      if (msg.type() === "error") pageErrors.push(`console: ${msg.text()}`)
    })

    await page.goto(`${server.origin}/ui/index.html`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector(`.task-row-main[data-task-id="${TASK.id}"]`, { state: "attached", timeout: 30_000 })
    await page.evaluate((taskID: string) => {
      const row = document.querySelector<HTMLButtonElement>(`.task-row-main[data-task-id="${taskID}"]`)
      row?.click()
    }, TASK.id)
    await waitForPreviewAnchor(page, previewUrl, requestLog, pageErrors)
    await page.click(`a[data-browser-preview-url="${previewUrl}"]`)
    await page.waitForSelector("#centerWorkbenchBrowser[data-open='true'][data-active='true']", { timeout: 30_000 })
    await page.waitForSelector('[data-ui="browser-preview-live-screenshot"]', { timeout: 30_000 })
    await page.waitForFunction(() => {
      const img = document.querySelector<HTMLImageElement>('[data-ui="browser-preview-live-screenshot"]')
      return !!img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0
    })

    nativeOpens.push(
      ...(await page.evaluate(() => (((window as any).__nativeOpens || []) as unknown[]).map(String))),
    )
    const state = await page.evaluate(() => ({
      browserOpen: document.querySelector<HTMLElement>("#centerWorkbenchBrowser")?.dataset.open || "",
      browserActive: document.querySelector<HTMLElement>("#centerWorkbenchBrowser")?.dataset.active || "",
      buttonActive:
        document.querySelector<HTMLElement>(
          '[data-ui="side-activity-button"][data-side="right"][data-activity="browser"]',
        )?.dataset.active || "",
      selectedUrlText: document.body.textContent?.includes("Rendered URL preview target") ?? false,
      imageLoaded: (() => {
        const img = document.querySelector<HTMLImageElement>('[data-ui="browser-preview-live-screenshot"]')
        return !!img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0
      })(),
    }))

    assert.deepEqual(selectedTargets, [{ url: previewUrl }])
    assert.deepEqual(nativeOpens, [])
    assert.equal(state.browserOpen, "true")
    assert.equal(state.browserActive, "true")
    assert.equal(state.buttonActive, "true")
    assert.equal(state.imageLoaded, true)
    assert.ok(
      requestLog.some((entry) => entry.startsWith(`PUT /task/${TASK.id}/browser-preview/target`)),
      JSON.stringify(requestLog, null, 2),
    )
    assert.deepEqual(pageErrors, [])

    mkdirSync(resolve(".scratch"), { recursive: true })
    writeFileSync(resolve(".scratch/message-url-preview-browser.png"), await page.screenshot({ fullPage: false }))
  } finally {
    await browser.close()
    await server.close()
  }
}, { timeout: 180_000 })
